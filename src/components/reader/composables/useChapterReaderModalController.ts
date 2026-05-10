import { useDialog, useMessage } from 'naive-ui';
import { storeToRefs } from 'pinia';
import { computed, markRaw, ref, watch } from 'vue';
import {
  type ChapterGroup,
  type ChapterItem,
  useAppConfigStore,
  useBookshelfStore,
  useReaderActionsStore,
  useReaderSessionStore,
  useReaderSettingsStore,
  useReaderUiStore,
  useReaderViewStore,
  useScriptBridgeStore,
} from '@/stores';
import { useFrontendPlugins } from '@/composables/useFrontendPlugins';
import { useSync } from '@/composables/useSync';
import { createReaderPrefetchController } from '@/features/reader/services/readerCache';
import { createReaderNavigationController } from '@/features/reader/services/readerNavigation';
import type { ReaderBookInfo, WholeBookSwitchedPayload } from '../types';
import { useReaderChapterContext } from './useReaderChapterContext';
import { useReaderChapterOpen } from './useReaderChapterOpen';
import { useReaderContentState } from './useReaderContentState';
import { useReaderLayoutDump } from './useReaderLayoutDump';
import { useReaderModalHost } from './useReaderModalHost';
import { useReaderModeBridge } from './useReaderModeBridge';
import {
  type ReaderPositionMode,
  type ReaderPositionSnapshot,
  type ReaderProgressTarget,
  useReaderPosition,
} from './useReaderPosition';
import { useReaderProgressSync } from './useReaderProgressSync';
import { useReaderSeamlessWindow } from './useReaderSeamlessWindow';
import { useReaderSessionBridge } from './useReaderSessionBridge';
import { useReaderTtsManager } from './useReaderTtsManager';

declare global {
  interface Window {
    LegadoAndroidInput?: {
      setVolumeKeyPageTurnEnabled?: (enabled: boolean) => void;
    };
  }
}

export interface ChapterReaderModalProps {
  show: boolean;
  chapterUrl: string;
  chapterName: string;
  fileName: string;
  chapters: ChapterItem[];
  currentIndex: number;
  shelfBookId?: string;
  bookInfo?: ReaderBookInfo;
  sourceType?: string;
  refreshingToc?: boolean;
  chapterGroups?: ChapterGroup[];
  initialGroupIndex?: number;
}

export interface ChapterReaderModalEmit {
  (e: 'update:show', val: boolean): void;
  (e: 'update:currentIndex', val: number): void;
  (e: 'refresh-toc'): void;
  (e: 'added-to-shelf', shelfId: string): void;
  (e: 'source-switched', payload: WholeBookSwitchedPayload): void;
}

type ReaderNavigationController = ReturnType<typeof createReaderNavigationController>;

export function useChapterReaderModalController(
  props: Readonly<ChapterReaderModalProps>,
  emit: ChapterReaderModalEmit,
) {
  const message = useMessage();
  const dialog = useDialog();
  const appConfigStore = useAppConfigStore();
  const { config } = storeToRefs(appConfigStore);
  const { runChapterContent, appendDebugLog } = useScriptBridgeStore();
  const sync = useSync();
  const {
    updateProgress: updateBookshelfProgress,
    saveContent,
    getContent,
    deleteContent,
    getCachedIndices,
    getShelfBook,
    addToShelf,
    saveChapters,
    ensureLoaded: ensureShelfLoaded,
  } = useBookshelfStore();
  let progressWriteQueue: Promise<unknown> = Promise.resolve();

  function updateProgress(
    ...args: Parameters<typeof updateBookshelfProgress>
  ): ReturnType<typeof updateBookshelfProgress> {
    const nextWrite = progressWriteQueue
      .catch(() => {})
      .then(() => updateBookshelfProgress(...args));
    progressWriteQueue = nextWrite;
    return nextWrite as ReturnType<typeof updateBookshelfProgress>;
  }

  const readerSessionStore = useReaderSessionStore();
  const {
    activeChapterIndex,
    loading,
    pagedLoading,
    content,
    error,
    currentPageIndex,
    currentScrollRatio,
    pagedPageIndex,
    readIndices,
    cachedIndices,
    temporaryChapterOverrides,
    pendingRestorePageIndex,
    pendingRestoreScrollRatio,
    pendingResumePlaybackTime,
    openingChapter,
    restoringPosition,
    navDirection,
  } = storeToRefs(readerSessionStore);

  const readerUiStore = useReaderUiStore();
  const {
    showMenu,
    showToc,
    settingsVisible,
    showSourceSwitchDialog,
    sourceSwitchMode,
  } = storeToRefs(readerUiStore);

  const {
    settings,
    getContentStyle,
    activateBookSettings,
    deactivateBookSettings,
    getSettingsJson,
  } = useReaderSettingsStore();
  const readerActionsStore = useReaderActionsStore();
  const readerViewStore = useReaderViewStore();
  const {
    state: pluginState,
    ensureInitialized: ensureFrontendPlugins,
    openReaderSession,
    updateReaderSession,
    closeReaderSession,
    runReaderContentPipeline,
    readerAppearanceVars,
    readerSkins,
  } = useFrontendPlugins();

  const menuLayerRef = ref<{ closeSettings?: () => void } | null>(null);
  const readerBodyRef = ref<HTMLElement | null>(null);
  const measureHostRef = ref<HTMLElement | null>(null);
  const backgroundMeasureHostRef = ref<HTMLElement | null>(null);
  const shelfBookId = computed(() => props.shelfBookId);
  const sourceType = computed(() => props.sourceType);
  const chapterName = computed(() => props.chapterName);
  const chapterUrl = computed(() => props.chapterUrl);
  const fileName = computed(() => props.fileName);
  const chapters = computed(() => props.chapters);
  const bookInfo = computed(() => props.bookInfo);

  let shelfDataReady: Promise<void> | null = null;
  let readerNavigation: ReaderNavigationController | null = null;
  let clearRepaginateWork = () => {};
  let waitForLinearSeamlessWindowStable = async (_index: number) => {};

  function closeMenuLayerSettings() {
    const closeSettings = menuLayerRef.value?.closeSettings;
    if (typeof closeSettings === 'function') {
      closeSettings();
    }
  }

  const {
    localAddedShelfId,
    currentShelfId,
    isOnShelf,
    addingToShelf,
    getChapter,
    hasPrev,
    hasNext,
    currentChapterName,
    currentChapterUrl,
    currentChapterOverride,
    isComicMode,
    isVideoMode,
    isScrollMode,
    legacyPagedMode,
    isPagedMode,
    effectiveStyle,
  } = useReaderChapterContext({
    shelfBookId,
    sourceType,
    chapterName,
    chapterUrl,
    chapters,
    activeChapterIndex,
    temporaryChapterOverrides,
    settings,
    getContentStyle,
    readerAppearanceVars,
    readerSkins,
  });

  const readingChapterOffset = ref(0);
  const readingChapterIndex = computed(() => {
    if (!chapters.value.length) {
      return activeChapterIndex.value;
    }
    if (isPagedMode.value || isVideoMode.value) {
      return activeChapterIndex.value;
    }
    const nextIndex = activeChapterIndex.value + readingChapterOffset.value;
    return Math.min(Math.max(nextIndex, 0), chapters.value.length - 1);
  });
  const reopenChapterIndex = computed(() => {
    if (!props.show) {
      return props.currentIndex;
    }
    return readingChapterIndex.value;
  });
  const readingChapter = computed(() => getChapter(readingChapterIndex.value));
  const readingChapterName = computed(() => readingChapter.value?.name ?? currentChapterName.value);
  const readingChapterUrl = computed(() => readingChapter.value?.url ?? currentChapterUrl.value);

  function buildReaderContentPayload(
    stage: Parameters<typeof runReaderContentPipeline>[0],
    contentText: string,
    index: number,
  ) {
    const chapter = getChapter(index);
    return {
      stage,
      content: contentText,
      sourceType: sourceType.value ?? 'novel',
      fileName: fileName.value,
      chapterIndex: index,
      chapterName: chapter?.name ?? chapterName.value,
      chapterUrl: chapter?.url ?? chapterUrl.value,
    };
  }

  watch(showMenu, (visible) => {
    if (!visible) {
      if (settingsVisible.value) {
        settingsVisible.value = false;
      }
      closeMenuLayerSettings();
    }
  });

  watch(reopenChapterIndex, (idx) => {
    if (props.show && idx !== props.currentIndex) {
      emit('update:currentIndex', idx);
    }
  });

  watch(
    () => props.show,
    (visible) => {
      if (!visible) {
        if (readingChapterIndex.value !== props.currentIndex) {
          emit('update:currentIndex', readingChapterIndex.value);
        }
        readingChapterOffset.value = 0;
      }
    },
  );

  watch(activeChapterIndex, (idx) => {
    readingChapterOffset.value = 0;
    const count = config.value.cache_prefetch_count;
    if (count === 0 || sourceType.value === 'video' || !currentShelfId.value) {
      return;
    }
    const effectiveCount = count < 0 ? chapters.value.length : count;
    const rangeEnd = Math.min(idx + 1 + effectiveCount, chapters.value.length);
    if (idx + 1 >= chapters.value.length) {
      return;
    }

    let anyUncached = false;
    for (let chapterIndex = idx + 1; chapterIndex < rangeEnd; chapterIndex++) {
      if (!cachedIndices.value.has(chapterIndex)) {
        anyUncached = true;
        break;
      }
    }
    if (!anyUncached) {
      return;
    }

    void readerPrefetch.triggerSilentPrefetch(idx, count);
  });

  watch(
    () => props.currentIndex,
    (idx) => {
      if (!props.show) {
        activeChapterIndex.value = idx;
      }
    },
  );

  const {
    loadShelfStatus,
    markChapterRead,
    fetchRawChapterText,
    fetchProcessedChapterText,
    pagedCache,
    activePagedPages,
    prevBoundaryPage,
    nextBoundaryPage,
    clearChapterRuntimeCache,
    clearProcessedRuntimeCache,
    clearAllRuntimeCache,
    invalidatePages,
  } = useReaderContentState({
    fileName,
    sourceType,
    currentShelfId,
    activeChapterIndex,
    temporaryChapterOverrides,
    readIndices,
    cachedIndices,
    hasPrev,
    hasNext,
    measureHostRef,
    backgroundMeasureHostRef,
    settings,
    runChapterContent,
    getContent,
    saveContent,
    getCachedIndices,
    getChapter,
    buildReaderContentPayload,
    runReaderContentPipeline,
  });

  watch(
    () => pluginState.contentVersion,
    async (version, previous) => {
      if (!props.show || previous === 0 || version === previous) {
        return;
      }

      clearProcessedRuntimeCache();
      invalidatePages();

      if (isPagedMode.value) {
        await openChapter(activeChapterIndex.value, {
          position: 'resume',
          pageIndex: currentPageIndex.value >= 0 ? currentPageIndex.value : undefined,
          pageRatio: currentScrollRatio.value >= 0 ? currentScrollRatio.value : undefined,
        });
        return;
      }

      pendingRestorePageIndex.value = currentPageIndex.value;
      pendingRestoreScrollRatio.value = currentScrollRatio.value;
      await openChapter(activeChapterIndex.value, { position: 'resume' });
    },
  );

  const blockingLoading = computed(() => {
    if (isPagedMode.value) {
      return pagedLoading.value && (activePagedPages.value.length === 0 || openingChapter.value);
    }
    if (isScrollMode.value) {
      return false;
    }
    return loading.value && (!content.value || openingChapter.value);
  });

  const blockingError = computed(() => {
    if (!error.value) {
      return false;
    }
    if (isPagedMode.value) {
      return activePagedPages.value.length === 0;
    }
    return !content.value;
  });

  function setPagedPage(page: number) {
    const total = activePagedPages.value.length;
    if (total <= 0) {
      pagedPageIndex.value = 0;
      currentPageIndex.value = -1;
      currentScrollRatio.value = -1;
      return;
    }

    const nextPage = Math.min(Math.max(page, 0), total - 1);
    pagedPageIndex.value = nextPage;
    currentPageIndex.value = nextPage;
    currentScrollRatio.value = total <= 1 ? 1 : nextPage / (total - 1);
  }

  function shouldIgnorePositionEvents(): boolean {
    return openingChapter.value || restoringPosition.value;
  }

  const {
    pagedModeRef,
    scrollModeRef,
    comicModeRef,
    videoModeRef,
    onPagedPageChange,
    onPagedProgress,
    onScrollProgress,
    onComicProgress,
    onVideoProgress,
    onVideoEnded,
    getPlaybackTime,
    flipNext,
    flipPrev,
    volumePageNext,
    volumePagePrev,
  } = useReaderModeBridge({
    isVideoMode,
    isComicMode,
    isScrollMode,
    hasPrev,
    hasNext,
    pagedLoading,
    currentShelfId,
    activeChapterIndex,
    readingChapterOffset,
    currentPageIndex,
    currentScrollRatio,
    pagedPageIndex,
    shouldIgnorePositionEvents,
    setPagedPage,
    getChapter,
    updateProgress,
    getSettingsJson,
    gotoNextChapter,
    gotoPrevChapter,
    warnLastPage: () => {
      message.warning('已经到最后一页了');
    },
    warnFirstPage: () => {
      message.warning('已经到最前了');
    },
  });
  void videoModeRef;

  const contentRefs = markRaw({
    pagedModeRef,
    scrollModeRef,
    comicModeRef,
    readerBodyRef,
    measureHostRef,
    backgroundMeasureHostRef,
  });

  const positionMode = computed<ReaderPositionMode>(() => {
    if (isVideoMode.value) {
      return 'video';
    }
    if (isComicMode.value) {
      return 'comic';
    }
    return isPagedMode.value ? 'paged' : 'scroll';
  });

  const { readCurrentPosition, writeSnapshotToRefs, buildProgressPayload } = useReaderPosition({
    mode: positionMode,
    currentPageIndex,
    pagedPageIndex,
    currentScrollRatio,
    pagedModeRef,
    scrollModeRef,
    comicModeRef,
    getPlaybackTime,
    getSettingsJson,
  });

  function clampChapterIndex(index: number): number {
    if (!chapters.value.length) {
      return Math.max(0, index);
    }
    return Math.min(Math.max(index, 0), chapters.value.length - 1);
  }

  function resolveReadingProgressTarget(
    snapshot = readCurrentPosition(),
  ): ReaderProgressTarget {
    const chapterIndex = clampChapterIndex(activeChapterIndex.value + snapshot.chapterOffset);
    const chapter = getChapter(chapterIndex);
    const isActiveChapter = chapterIndex === activeChapterIndex.value;
    return {
      chapterIndex,
      chapterName: chapter?.name ?? (isActiveChapter ? currentChapterName.value : chapterName.value),
      chapterUrl: chapter?.url ?? (isActiveChapter ? currentChapterUrl.value : chapterUrl.value),
      position: snapshot,
    };
  }

  function applySeamlessActivatedPosition(snapshot: ReaderPositionSnapshot) {
    readingChapterOffset.value = 0;
    writeSnapshotToRefs({
      ...snapshot,
      chapterOffset: 0,
    });
  }

  const {
    buildReaderSessionSnapshot,
    openSession,
    closeSession,
    syncSessionSnapshot,
    updateSessionVisibility,
  } = useReaderSessionBridge({
    getShow: () => props.show,
    fileName,
    sourceType,
    bookInfo,
    getChapterCount: () => chapters.value.length,
    currentShelfId,
    content,
    settings,
    readerBodyRef,
    resolveReadingProgressTarget,
    openReaderSession,
    updateReaderSession,
    closeReaderSession,
  });

  const { dumpPaginationLayoutDebug } = useReaderLayoutDump({
    readerBodyRef,
    measureHostRef,
    backgroundMeasureHostRef,
    legacyPagedMode,
    isPagedMode,
    pagedPageIndex,
    activePagedPages,
    pagedCache,
    pagedLoading,
    activeChapterIndex,
    hasPrev,
    hasNext,
    getChapter,
    getFallbackChapterName: () => props.chapterName,
    getFallbackChapterUrl: () => props.chapterUrl,
    getChaptersLength: () => props.chapters.length,
    settings,
    appendDebugLog,
    message,
  });

  const { openChapter, openLinearChapter, openPagedChapter } = useReaderChapterOpen({
    getShow: () => props.show,
    getChapterCount: () => props.chapters.length,
    getShelfDataReady: () => shelfDataReady,
    getChapter,
    isPagedMode,
    isComicMode,
    isScrollMode,
    isVideoMode,
    activeChapterIndex,
    content,
    error,
    loading,
    pagedLoading,
    currentPageIndex,
    currentScrollRatio,
    pendingRestorePageIndex,
    pendingRestoreScrollRatio,
    pendingResumePlaybackTime,
    openingChapter,
    restoringPosition,
    navDirection,
    currentShelfId,
    pagedCache,
    scrollModeRef,
    comicModeRef,
    fetchProcessedChapterText,
    setPagedPage,
    markChapterRead,
    updateReaderSession,
    buildReaderSessionSnapshot,
    getPositionMode: () => positionMode.value,
    writePositionSnapshot: writeSnapshotToRefs,
    buildProgressPayload,
    updateProgress,
    waitForLinearSeamlessWindowStable: (index) => waitForLinearSeamlessWindowStable(index),
    reportLoadError: (loadError) => {
      message.error(`加载正文失败: ${loadError}`, { duration: 8000, closable: true });
    },
    clearRepaginateWork: () => clearRepaginateWork(),
  });

  function retryCurrentChapter() {
    void openChapter(activeChapterIndex.value, { forceNetwork: true });
  }

  const readerPrefetch = createReaderPrefetchController({
    currentShelfId,
    getFileName: () => fileName.value,
    message,
    getBookUrl: () => bookInfo.value?.bookUrl ?? '',
    getBookName: () => bookInfo.value?.name ?? '',
    getSourceType: () => sourceType.value ?? 'novel',
    getChapters: () => chapters.value,
    getActiveChapterIndex: () => activeChapterIndex.value,
    markCached: (chapterIndex) => {
      cachedIndices.value.add(chapterIndex);
    },
  });

  const {
    resetProgressSyncState,
    saveDetailedProgress,
    reportReaderSession,
    triggerReaderProgressSync,
    setupReadingConflictListener,
    cleanupReadingConflictListener,
    startAutoSave,
    stopAutoSave,
    onVisibilityChange,
    onBeforeUnloadSave,
  } = useReaderProgressSync({
    getShow: () => props.show,
    config,
    dialog,
    sync,
    currentShelfId,
    shouldIgnorePositionEvents,
    getChapter,
    readCurrentPosition,
    resolveReadingProgressTarget,
    buildProgressPayload,
    updateProgress,
    updateSessionVisibility,
    openChapter,
  });

  readerNavigation = createReaderNavigationController({
    activeChapterIndex,
    navDirection,
    hasPrev,
    hasNext,
    saveDetailedProgress,
    openChapter,
  });

  async function gotoPrevChapter() {
    await readerNavigation?.gotoPrevChapter();
  }

  async function gotoNextChapter() {
    await readerNavigation?.gotoNextChapter();
  }

  async function gotoPrevBoundary() {
    await readerNavigation?.gotoPrevBoundary();
  }

  async function gotoNextBoundary() {
    await readerNavigation?.gotoNextBoundary();
  }

  async function gotoChapter(index: number) {
    await readerNavigation?.gotoChapter(index);
  }

  const seamlessWindow = useReaderSeamlessWindow({
    getShow: () => props.show,
    getFileName: () => props.fileName,
    getSourceType: () => props.sourceType,
    getChapterCount: () => props.chapters.length,
    activeChapterIndex,
    currentChapterName,
    currentChapterUrl,
    currentShelfId,
    hasPrev,
    hasNext,
    isScrollMode,
    isComicMode,
    openingChapter,
    restoringPosition,
    navDirection,
    content,
    scrollModeRef,
    comicModeRef,
    getChapter,
    fetchProcessedChapterText,
    saveDetailedProgress,
    openChapter,
    markChapterRead,
    updateProgress: (shelfId, chapterIndex, chapterUrl, payload) =>
      updateProgress(shelfId, chapterIndex, chapterUrl, payload),
    buildProgressPayload: (snapshot) => buildProgressPayload(snapshot),
    onSeamlessChapterActivated: applySeamlessActivatedPosition,
  });
  waitForLinearSeamlessWindowStable = seamlessWindow.waitForStableWindow;
  const {
    prevScrollChapterContent,
    prevScrollChapterTitle,
    prevScrollChapterLoading,
    nextScrollChapterContent,
    nextScrollChapterTitle,
    nextScrollChapterLoading,
    prevComicChapterContent,
    prevComicChapterTitle,
    nextComicChapterContent,
    nextComicChapterTitle,
    clearAllSeamlessSlots,
    onScrollNextChapterEntered,
    onScrollPrevChapterEntered,
    onComicNextChapterEntered,
    onComicPrevChapterEntered,
  } = seamlessWindow;

  const currentScrollChapterLoading = computed(
    () => isScrollMode.value && loading.value && !content.value,
  );

  const { ttsProgressText, ttsScrollHighlightIdx, showTtsBar, onTtsToggle } = useReaderTtsManager({
    activeChapterIndex,
    content,
    isPagedMode,
    isScrollMode,
    isComicMode,
    isVideoMode,
    pagedPageIndex,
    activePagedPages,
    hasPrev,
    hasNext,
    pagedModeRef,
    scrollModeRef,
    blockingLoading,
    setPagedPage,
    fetchRawChapterText,
    gotoNextChapter,
  });

  const host = useReaderModalHost({
    message,
    dialog,
    settings,
    readerViewStore,
    readerActionsStore,
    readerUiStore,
    readerSessionStore,
    getShow: () => props.show,
    getCurrentIndex: () => reopenChapterIndex.value,
    getShelfBookId: () => props.shelfBookId,
    getChapterName: () => props.chapterName,
    getChapterUrl: () => props.chapterUrl,
    getFileName: () => props.fileName,
    getSourceType: () => props.sourceType,
    getRefreshingToc: () => props.refreshingToc,
    getBookInfo: () => props.bookInfo,
    getChapters: () => props.chapters,
    getReadingChapterIndex: () => readingChapterIndex.value,
    getReadingChapterUrl: () => readingChapterUrl.value,
    emitUpdateShow: (visible) => emit('update:show', visible),
    emitAddedToShelf: (shelfId) => emit('added-to-shelf', shelfId),
    emitRefreshToc: () => emit('refresh-toc'),
    emitSourceSwitched: (payload) => emit('source-switched', payload),
    closeMenuLayerSettings,
    localAddedShelfId,
    currentShelfId,
    isOnShelf,
    addingToShelf,
    activeChapterIndex,
    currentPageIndex,
    currentScrollRatio,
    pagedPageIndex,
    cachedIndices,
    temporaryChapterOverrides,
    pendingRestorePageIndex,
    pendingRestoreScrollRatio,
    pendingResumePlaybackTime,
    openingChapter,
    restoringPosition,
    content,
    showMenu,
    showToc,
    settingsVisible,
    showSourceSwitchDialog,
    sourceSwitchMode,
    showTtsBar,
    hasPrev,
    hasNext,
    isPagedMode,
    legacyPagedMode,
    isComicMode,
    isVideoMode,
    isScrollMode,
    currentChapterName,
    currentChapterUrl,
    currentChapterOverride,
    activePagedPages,
    prevBoundaryPage,
    nextBoundaryPage,
    blockingLoading,
    blockingError,
    ttsProgressText,
    ttsScrollHighlightIdx,
    currentScrollChapterLoading,
    prevScrollChapterContent,
    prevScrollChapterTitle,
    prevScrollChapterLoading,
    nextScrollChapterContent,
    nextScrollChapterTitle,
    nextScrollChapterLoading,
    prevComicChapterContent,
    prevComicChapterTitle,
    nextComicChapterContent,
    nextComicChapterTitle,
    contentRefs,
    pagedLoading,
    readerBodyRef,
    scrollModeRef,
    comicModeRef,
    pagedCache,
    getChapter,
    buildProgressPayload,
    updateProgress,
    ensureShelfLoaded,
    addToShelf,
    saveChapters,
    deleteContent,
    getShelfBook,
    activateBookSettings,
    deactivateBookSettings,
    ensureFrontendPlugins,
    openSession,
    closeSession,
    syncSessionSnapshot,
    loadShelfStatus,
    openChapter,
    openLinearChapter,
    openPagedChapter,
    retryCurrentChapter,
    gotoPrevChapter,
    gotoNextChapter,
    gotoPrevBoundary,
    gotoNextBoundary,
    gotoChapter,
    onPagedPageChange,
    onPagedProgress,
    onScrollProgress,
    onComicProgress,
    onScrollNextChapterEntered,
    onScrollPrevChapterEntered,
    onComicNextChapterEntered,
    onComicPrevChapterEntered,
    onVideoProgress,
    onVideoEnded,
    onTtsToggle,
    flipNext,
    flipPrev,
    volumePageNext,
    volumePagePrev,
    dumpPaginationLayoutDebug,
    prefetchChapters: (count) => readerPrefetch.prefetchChapters(count),
    saveDetailedProgress,
    reportReaderSession,
    triggerReaderProgressSync,
    setupReadingConflictListener,
    cleanupReadingConflictListener,
    startAutoSave,
    stopAutoSave,
    onVisibilityChange,
    onBeforeUnloadSave,
    clearChapterRuntimeCache,
    clearAllRuntimeCache,
    invalidatePages,
    resetProgressSyncState,
    clearAllSeamlessSlots,
    getShelfDataReady: () => shelfDataReady,
    setShelfDataReady: (ready) => {
      shelfDataReady = ready;
    },
  });

  clearRepaginateWork = host.clearRepaginateWork;

  return {
    menuLayerRef,
    videoModeRef,
    effectiveStyle,
    settings,
    isVideoMode,
  };
}
