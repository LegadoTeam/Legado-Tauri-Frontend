import type { DialogApi, MessageApi } from 'naive-ui';
/**
 * 绑定阅读弹层宿主交互、生命周期、缓存控制和窗口重排恢复。
 */
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  watch,
  type ComputedRef,
  type Ref,
} from 'vue';
import type { ChapterItem } from '@/stores';
import type { CachedChapter } from '@/types';
import { eventListenSync } from '@/composables/useEventBus';
import { FRONTEND_PLUGIN_TOAST_EVENT } from '@/composables/useFrontendPlugins';
import { useOverlayBackstack } from '@/composables/useOverlayBackstack';
import { createReaderCacheController } from '@/features/reader/services/readerCache';
import {
  createReaderLifecycleController,
  type ShelfReaderSettingsSnapshot,
} from '@/features/reader/services/readerLifecycle';
import { createReaderSourceSwitchController } from '@/features/reader/services/readerSourceSwitch';
import { getCoverImageUrl } from '@/utils/coverImage';
import type {
  ReaderBookInfo,
  TemporaryChapterSourceOverride,
  WholeBookSwitchedPayload,
} from '../types';
import type { ReadingAnchor } from './usePagination';
import type { OpenChapterOptions } from './useReaderChapterOpen';

interface ReaderProgressPayloadLike {
  pageIndex?: number;
  scrollRatio?: number;
  playbackTime?: number;
  readerSettings?: string;
}

interface ReaderSettingsLike {
  backBehavior: string;
  volumeKeyPageTurnEnabled: boolean;
  flipMode: string;
  typography: Record<string, unknown>;
  pagePadding: string | number | Record<string, unknown>;
  paginationEngine: string;
}

interface ReaderModeRefLike {
  scrollToRatio?: (ratio: number) => void;
  scrollToParagraph?: (index: number) => void;
  scrollToReadingAnchor?: (anchor: number) => void;
  restoreToReadingAnchor?: (anchor: number) => Promise<void>;
}

interface ReaderPagedCacheLike {
  buildAnchorForChapterPage: (chapterIndex: number, pageIndex: number) => ReadingAnchor;
  invalidatePages: () => void;
}

interface ReaderViewStoreLike {
  // eslint-disable-next-line typescript/no-explicit-any
  bind: (...args: any[]) => void;
  clear: () => void;
}

interface ReaderActionsStoreLike {
  // eslint-disable-next-line typescript/no-explicit-any
  bind: (...args: any[]) => void;
  clear: () => void;
}

interface ReaderUiStoreLike {
  openMenu: () => void;
  resetLayers: () => void;
}

interface ReaderSessionStoreLike {
  // eslint-disable-next-line typescript/no-explicit-any
  resetForOpen: (...args: any[]) => void;
  // eslint-disable-next-line typescript/no-explicit-any
  resetForClose: (...args: any[]) => void;
}

interface UseReaderModalHostOptions {
  message: MessageApi;
  dialog: DialogApi;
  settings: ReaderSettingsLike;
  readerViewStore: ReaderViewStoreLike;
  readerActionsStore: ReaderActionsStoreLike;
  readerUiStore: ReaderUiStoreLike;
  readerSessionStore: ReaderSessionStoreLike;
  getShow: () => boolean;
  getCurrentIndex: () => number;
  getShelfBookId: () => string | undefined;
  getChapterName: () => string;
  getChapterUrl: () => string;
  getFileName: () => string;
  getSourceType: () => string | undefined;
  getRefreshingToc: () => boolean | undefined;
  getBookInfo: () => ReaderBookInfo | undefined;
  getChapters: () => ChapterItem[];
  getReadingChapterIndex: () => number;
  getReadingChapterUrl: () => string;
  emitUpdateShow: (visible: boolean) => void;
  emitAddedToShelf: (shelfId: string) => void;
  emitRefreshToc: () => void;
  emitSourceSwitched: (payload: WholeBookSwitchedPayload) => void;
  closeMenuLayerSettings: () => void;
  localAddedShelfId: Ref<string>;
  currentShelfId: ComputedRef<string | undefined>;
  isOnShelf: ComputedRef<boolean>;
  addingToShelf: Ref<boolean>;
  activeChapterIndex: Ref<number>;
  currentPageIndex: Ref<number>;
  currentScrollRatio: Ref<number>;
  pagedPageIndex: Ref<number>;
  cachedIndices: Ref<Set<number>>;
  temporaryChapterOverrides: Ref<Record<number, TemporaryChapterSourceOverride>>;
  pendingRestorePageIndex: Ref<number>;
  pendingRestoreScrollRatio: Ref<number>;
  pendingResumePlaybackTime: Ref<number>;
  openingChapter: Ref<boolean>;
  restoringPosition: Ref<boolean>;
  content: Ref<string>;
  showMenu: Ref<boolean>;
  showToc: Ref<boolean>;
  settingsVisible: Ref<boolean>;
  showSourceSwitchDialog: Ref<boolean>;
  sourceSwitchMode: Ref<'whole-book' | 'chapter-temp'>;
  showTtsBar: Ref<boolean>;
  hasPrev: ComputedRef<boolean>;
  hasNext: ComputedRef<boolean>;
  isPagedMode: ComputedRef<boolean>;
  legacyPagedMode: ComputedRef<string | null>;
  isComicMode: ComputedRef<boolean>;
  isVideoMode: ComputedRef<boolean>;
  isScrollMode: ComputedRef<boolean>;
  currentChapterName: ComputedRef<string>;
  currentChapterUrl: ComputedRef<string>;
  currentChapterOverride: ComputedRef<TemporaryChapterSourceOverride | null>;
  activePagedPages: ComputedRef<string[]>;
  prevBoundaryPage: ComputedRef<string>;
  nextBoundaryPage: ComputedRef<string>;
  blockingLoading: ComputedRef<boolean>;
  blockingError: ComputedRef<boolean>;
  ttsProgressText: Ref<string>;
  ttsScrollHighlightIdx: Ref<number>;
  currentScrollChapterLoading: ComputedRef<boolean>;
  prevScrollChapterContent: Ref<string>;
  prevScrollChapterTitle: Ref<string>;
  prevScrollChapterLoading: Ref<boolean>;
  nextScrollChapterContent: Ref<string>;
  nextScrollChapterTitle: Ref<string>;
  nextScrollChapterLoading: Ref<boolean>;
  prevComicChapterContent: Ref<string>;
  prevComicChapterTitle: Ref<string>;
  nextComicChapterContent: Ref<string>;
  nextComicChapterTitle: Ref<string>;
  contentRefs: Record<string, unknown>;
  pagedLoading: Ref<boolean>;
  readerBodyRef: Ref<HTMLElement | null>;
  scrollModeRef: Ref<ReaderModeRefLike | null>;
  comicModeRef: Ref<ReaderModeRefLike | null>;
  pagedCache: ReaderPagedCacheLike;
  getChapter: (index: number) => ChapterItem | undefined;
  buildProgressPayload: () => ReaderProgressPayloadLike;
  updateProgress: (
    shelfId: string,
    chapterIndex: number,
    chapterUrl: string,
    payload?: ReaderProgressPayloadLike,
  ) => Promise<unknown>;
  ensureShelfLoaded: () => Promise<unknown>;
  addToShelf: (
    book: {
      name: string;
      author: string;
      coverUrl: string;
      intro?: string;
      kind?: string;
      bookUrl: string;
      lastChapter?: string;
      sourceType: string;
    },
    fileName: string,
    sourceName: string,
  ) => Promise<{ id: string }>;
  saveChapters: (shelfId: string, chapters: CachedChapter[]) => Promise<unknown>;
  deleteContent: (shelfId: string, chapterIndex: number) => Promise<unknown>;
  getShelfBook: (shelfId: string) => Promise<ShelfReaderSettingsSnapshot>;
  activateBookSettings: (bookId: string, savedJson?: string) => void;
  deactivateBookSettings: () => void;
  ensureFrontendPlugins: () => Promise<void>;
  openSession: () => Promise<void>;
  closeSession: () => Promise<void>;
  syncSessionSnapshot: () => Promise<unknown>;
  loadShelfStatus: () => Promise<void>;
  openChapter: (index: number, options?: OpenChapterOptions) => Promise<void>;
  openLinearChapter: (index: number) => Promise<unknown>;
  openPagedChapter: (
    index: number,
    options?: { position?: 'resume' | 'first'; pageRatio?: number },
  ) => Promise<unknown>;
  retryCurrentChapter: () => void;
  gotoPrevChapter: () => Promise<void>;
  gotoNextChapter: () => Promise<void>;
  gotoPrevBoundary: () => Promise<void>;
  gotoNextBoundary: () => Promise<void>;
  gotoChapter: (index: number) => Promise<void>;
  onPagedPageChange: (page: number) => void;
  // eslint-disable-next-line typescript/no-explicit-any
  onPagedProgress: (...args: any[]) => void;
  // eslint-disable-next-line typescript/no-explicit-any
  onScrollProgress: (...args: any[]) => void;
  // eslint-disable-next-line typescript/no-explicit-any
  onComicProgress: (...args: any[]) => void;
  onScrollNextChapterEntered: (sectionHeight: number) => Promise<void>;
  onScrollPrevChapterEntered: () => Promise<void>;
  onComicNextChapterEntered: (sectionHeight: number) => Promise<void>;
  onComicPrevChapterEntered: () => Promise<void>;
  // eslint-disable-next-line typescript/no-explicit-any
  onVideoProgress: (...args: any[]) => void;
  onVideoEnded: () => void;
  onTtsToggle: () => void;
  flipNext: () => void;
  flipPrev: () => void;
  volumePageNext: () => void;
  volumePagePrev: () => void;
  dumpPaginationLayoutDebug: () => void;
  prefetchChapters: (count: number) => Promise<unknown>;
  saveDetailedProgress: () => Promise<void> | void;
  reportReaderSession: (active: boolean) => void;
  triggerReaderProgressSync: () => Promise<void>;
  setupReadingConflictListener: () => void;
  cleanupReadingConflictListener: () => void;
  startAutoSave: () => void;
  stopAutoSave: () => void;
  onVisibilityChange: () => void;
  onBeforeUnloadSave: () => void;
  clearChapterRuntimeCache: (index: number) => void;
  clearAllRuntimeCache: () => void;
  invalidatePages: () => void;
  resetProgressSyncState: () => void;
  reportPluginToast?: (text: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  clearAllSeamlessSlots: () => void;
  getShelfDataReady: () => Promise<void> | null;
  setShelfDataReady: (ready: Promise<void> | null) => void;
}

const REPAGINATE_DEBOUNCE_MS = 120;

export function useReaderModalHost(options: UseReaderModalHostOptions) {
  let resizeObserver: ResizeObserver | null = null;
  let resizeRaf = 0;
  let resizeDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let unlistenPluginToast: (() => void) | null = null;

  // 将 bindings 对象保存为局部变量，以便在 show 变为 true 时重新绑定。
  // 多个 ChapterReaderModal 实例（书架视图 + 发现视图）同时挂载时共享同一个
  // readerViewStore 单例，每次有弹层打开时需要重新抢占绑定权。
  const viewStoreBindings = {
    chapters: computed(() => options.getChapters()),
    bookInfo: computed(() => options.getBookInfo()),
    sourceType: computed(() => options.getSourceType()),
    fileName: computed(() => options.getFileName()),
    refreshingToc: computed(() => options.getRefreshingToc()),
    hasPrev: options.hasPrev,
    hasNext: options.hasNext,
    readingChapterIndex: computed(() => options.getReadingChapterIndex()),
    currentChapterName: options.currentChapterName,
    currentChapterUrl: options.currentChapterUrl,
    isVideoMode: options.isVideoMode,
    isComicMode: options.isComicMode,
    isPagedMode: options.isPagedMode,
    legacyPagedMode: options.legacyPagedMode,
    activePagedPages: options.activePagedPages,
    prevBoundaryPage: options.prevBoundaryPage,
    nextBoundaryPage: options.nextBoundaryPage,
    blockingLoading: options.blockingLoading,
    blockingError: options.blockingError,
    currentShelfId: options.currentShelfId,
    isOnShelf: options.isOnShelf,
    addingToShelf: options.addingToShelf,
    currentChapterOverride: options.currentChapterOverride,
    ttsProgressText: options.ttsProgressText,
    ttsScrollHighlightIdx: options.ttsScrollHighlightIdx,
    currentScrollChapterLoading: options.currentScrollChapterLoading,
    prevScrollChapterContent: options.prevScrollChapterContent,
    prevScrollChapterTitle: options.prevScrollChapterTitle,
    prevScrollChapterLoading: options.prevScrollChapterLoading,
    nextScrollChapterContent: options.nextScrollChapterContent,
    nextScrollChapterTitle: options.nextScrollChapterTitle,
    nextScrollChapterLoading: options.nextScrollChapterLoading,
    prevComicChapterContent: options.prevComicChapterContent,
    prevComicChapterTitle: options.prevComicChapterTitle,
    nextComicChapterContent: options.nextComicChapterContent,
    nextComicChapterTitle: options.nextComicChapterTitle,
    contentRefs: options.contentRefs,
  };
  options.readerViewStore.bind(viewStoreBindings);

  const nativeVolumeKeyPageTurnEnabled = computed(
    () =>
      options.getShow() &&
      options.settings.volumeKeyPageTurnEnabled &&
      !options.isVideoMode.value &&
      !options.showTtsBar.value &&
      !options.showMenu.value &&
      !options.showToc.value &&
      !options.settingsVisible.value,
  );

  function syncNativeVolumeKeyPageTurn(enabled: boolean) {
    window.LegadoAndroidInput?.setVolumeKeyPageTurnEnabled?.(enabled);
  }

  watch(nativeVolumeKeyPageTurnEnabled, syncNativeVolumeKeyPageTurn, { immediate: true });

  async function handleAddToShelf(): Promise<boolean> {
    const info = options.getBookInfo();
    if (!info || options.isOnShelf.value || options.addingToShelf.value) {
      return false;
    }
    options.addingToShelf.value = true;
    try {
      await options.ensureShelfLoaded();
      const result = await options.addToShelf(
        {
          name: info.name,
          author: info.author,
          coverUrl: getCoverImageUrl(info.coverUrl) ?? '',
          intro: info.intro,
          kind: info.kind,
          bookUrl: info.bookUrl ?? '',
          lastChapter: info.lastChapter,
          sourceType: options.getSourceType() ?? 'novel',
        },
        options.getFileName(),
        info.sourceName ?? '',
      );

      const chapters = options.getChapters();
      if (chapters.length) {
        const cached: CachedChapter[] = chapters.map((chapter, index) => ({
          index,
          name: chapter.name,
          url: chapter.url,
          group: chapter.group,
        }));
        await options.saveChapters(result.id, cached).catch(() => {});
      }

      options.localAddedShelfId.value = result.id;

      const readingChapterIndex = options.getReadingChapterIndex();
      const chapter = options.getChapter(readingChapterIndex);
      if (chapter) {
        await options
          .updateProgress(
            result.id,
            readingChapterIndex,
            options.getReadingChapterUrl() || chapter.url,
            {
              ...options.buildProgressPayload(),
            },
          )
          .catch(() => {});
      }

      options.message.success('已加入书架');
      options.emitAddedToShelf(result.id);
      return true;
    } catch (error: unknown) {
      options.message.error(
        `加入书架失败: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    } finally {
      options.addingToShelf.value = false;
    }
  }

  async function close() {
    await options.saveDetailedProgress();
    const info = options.getBookInfo();
    if (!options.isOnShelf.value && info && !options.isVideoMode.value) {
      options.dialog.create({
        title: '加入书架',
        content: `《${info.name}》还未加入书架，是否加入？`,
        positiveText: '加入',
        negativeText: '不用了',
        closeOnEsc: false,
        maskClosable: false,
        onPositiveClick: () => {
          void handleAddToShelf().finally(() => {
            options.emitUpdateShow(false);
          });
        },
        onNegativeClick: () => {
          options.emitUpdateShow(false);
        },
      });
      return;
    }
    options.emitUpdateShow(false);
  }

  async function closeWithBackBehavior() {
    await close();
    if (options.settings.backBehavior === 'desktop') {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        await getCurrentWindow().minimize();
      } catch {
        // 非 Tauri 环境忽略
      }
    }
  }

  useOverlayBackstack(
    () => options.getShow(),
    () => {
      void closeWithBackBehavior();
    },
  );

  useOverlayBackstack(
    () => options.getShow() && options.showMenu.value,
    () => {
      options.settingsVisible.value = false;
      options.closeMenuLayerSettings();
      options.showMenu.value = false;
    },
  );

  useOverlayBackstack(
    () => options.getShow() && options.showToc.value,
    () => {
      options.showToc.value = false;
    },
  );

  useOverlayBackstack(
    () => options.getShow() && options.settingsVisible.value,
    () => {
      options.settingsVisible.value = false;
      options.closeMenuLayerSettings();
    },
  );

  useOverlayBackstack(
    () => options.getShow() && options.showSourceSwitchDialog.value,
    () => {
      options.showSourceSwitchDialog.value = false;
    },
  );

  function onTap(zone: 'left' | 'center' | 'right') {
    if (zone === 'center') {
      if (options.showToc.value) {
        options.showToc.value = false;
      } else if (!options.showMenu.value) {
        options.readerUiStore.openMenu();
      } else {
        options.settingsVisible.value = false;
        options.showMenu.value = false;
      }
      return;
    }

    if (zone === 'left') {
      void options.gotoPrevBoundary();
      return;
    }

    void options.gotoNextBoundary();
  }

  function isTextEditingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
      return false;
    }
    return (
      target.isContentEditable ||
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT'
    );
  }

  function handlePageTurnKey(event: KeyboardEvent): boolean {
    if (
      !options.getShow() ||
      options.isVideoMode.value ||
      options.showMenu.value ||
      options.showToc.value ||
      isTextEditingTarget(event.target)
    ) {
      return false;
    }

    switch (event.key) {
      case 'ArrowRight':
      case 'd':
      case 'D':
        event.preventDefault();
        options.flipNext();
        return true;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        event.preventDefault();
        options.flipPrev();
        return true;
      default:
        return false;
    }
  }

  function onPageTurnKeyDownCapture(event: KeyboardEvent) {
    if (event.defaultPrevented) {
      return;
    }
    handlePageTurnKey(event);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (!options.getShow() || event.defaultPrevented) {
      return;
    }

    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (options.showToc.value) {
        options.showToc.value = false;
      } else if (options.showMenu.value) {
        options.settingsVisible.value = false;
        options.showMenu.value = false;
      } else {
        options.readerUiStore.openMenu();
      }
      return;
    }

    if (options.showMenu.value || options.showToc.value) {
      return;
    }

    if (handlePageTurnKey(event)) {
      return;
    }

    switch (event.key) {
      case 'AudioVolumeDown':
        if (
          options.settings.volumeKeyPageTurnEnabled &&
          !options.isVideoMode.value &&
          !options.showTtsBar.value
        ) {
          event.preventDefault();
          options.volumePageNext();
        }
        break;
      case 'AudioVolumeUp':
        if (
          options.settings.volumeKeyPageTurnEnabled &&
          !options.isVideoMode.value &&
          !options.showTtsBar.value
        ) {
          event.preventDefault();
          options.volumePagePrev();
        }
        break;
    }
  }

  const {
    openWholeBookSourceSwitch,
    openTemporaryChapterSwitch,
    clearTemporaryChapterSwitch,
    handleTemporaryChapterSourceSwitched,
    handleWholeBookSourceSwitched,
  } = createReaderSourceSwitchController({
    currentShelfId: options.currentShelfId,
    activeChapterIndex: options.activeChapterIndex,
    readingChapterIndex: computed(() => options.getReadingChapterIndex()),
    temporaryChapterOverrides: options.temporaryChapterOverrides,
    currentChapterOverride: options.currentChapterOverride,
    sourceSwitchMode: options.sourceSwitchMode,
    showSourceSwitchDialog: options.showSourceSwitchDialog,
    message: options.message,
    clearChapterRuntimeCache: options.clearChapterRuntimeCache,
    clearAllRuntimeCache: options.clearAllRuntimeCache,
    invalidatePages: options.invalidatePages,
    openChapter: options.openChapter,
    emitSourceSwitched: options.emitSourceSwitched,
  });

  const {
    forceRefreshChapter,
    clearChapterCache: handleClearChapterCache,
    clearAllCache: handleClearAllCache,
  } = createReaderCacheController({
    currentShelfId: options.currentShelfId,
    getFileName: options.getFileName,
    message: options.message,
    activeChapterIndex: options.activeChapterIndex,
    cachedIndices: options.cachedIndices,
    currentPageIndex: options.currentPageIndex,
    currentScrollRatio: options.currentScrollRatio,
    pagedPageIndex: options.pagedPageIndex,
    pendingRestorePageIndex: options.pendingRestorePageIndex,
    pendingRestoreScrollRatio: options.pendingRestoreScrollRatio,
    isPagedMode: options.isPagedMode,
    isComicMode: options.isComicMode,
    getBookUrl: () => options.getBookInfo()?.bookUrl ?? '',
    getBookName: () => options.getBookInfo()?.name ?? '',
    getChapter: options.getChapter,
    buildAnchorForChapterPage: (chapterIndex, pageIndex) =>
      options.pagedCache.buildAnchorForChapterPage(chapterIndex, pageIndex),
    clearChapterRuntimeCache: options.clearChapterRuntimeCache,
    clearAllRuntimeCache: options.clearAllRuntimeCache,
    invalidatePages: options.invalidatePages,
    deleteContent: options.deleteContent,
    openChapter: options.openChapter,
  });

  const actionStoreBindings = {
    close,
    retryCurrentChapter: options.retryCurrentChapter,
    onTap,
    onPagedPageChange: options.onPagedPageChange,
    onPagedProgress: options.onPagedProgress,
    onScrollProgress: options.onScrollProgress,
    onComicProgress: options.onComicProgress,
    gotoPrevChapter: options.gotoPrevChapter,
    gotoNextChapter: options.gotoNextChapter,
    gotoPrevBoundary: options.gotoPrevBoundary,
    gotoNextBoundary: options.gotoNextBoundary,
    gotoChapter: options.gotoChapter,
    onScrollNextChapterEntered: options.onScrollNextChapterEntered,
    onScrollPrevChapterEntered: options.onScrollPrevChapterEntered,
    onComicNextChapterEntered: options.onComicNextChapterEntered,
    onComicPrevChapterEntered: options.onComicPrevChapterEntered,
    dumpPaginationLayoutDebug: options.dumpPaginationLayoutDebug,
    onTtsToggle: options.onTtsToggle,
    forceRefreshChapter,
    prefetchChapters: (count: number) => options.prefetchChapters(count),
    openWholeBookSourceSwitch,
    openTemporaryChapterSwitch,
    clearTemporaryChapterSwitch,
    handleAddToShelf,
    emitRefreshToc: options.emitRefreshToc,
    handleClearChapterCache,
    handleClearAllCache,
    handleTemporaryChapterSourceSwitched,
    handleWholeBookSourceSwitched,
    onVideoProgress: options.onVideoProgress,
    onVideoEnded: options.onVideoEnded,
  };
  options.readerActionsStore.bind(actionStoreBindings);

  const readerLifecycle = createReaderLifecycleController({
    getShelfBookId: options.getShelfBookId,
    getCurrentIndex: options.getCurrentIndex,
    getTrackingPayload: () => ({
      book_name: options.getBookInfo()?.name,
      author_name: options.getBookInfo()?.author,
      source_file: options.getFileName(),
      source_type: options.getSourceType() ?? 'novel',
      chapter_name: options.getChapterName(),
      chapter_index: options.getCurrentIndex(),
      shelf_book_id: options.getShelfBookId() ?? options.localAddedShelfId.value,
    }),
    readerBodyRef: options.readerBodyRef,
    activeChapterIndex: options.activeChapterIndex,
    pendingRestorePageIndex: options.pendingRestorePageIndex,
    pendingRestoreScrollRatio: options.pendingRestoreScrollRatio,
    pendingResumePlaybackTime: options.pendingResumePlaybackTime,
    isPagedMode: options.isPagedMode,
    ensureFrontendPlugins: options.ensureFrontendPlugins,
    getShelfBook: options.getShelfBook,
    activateBookSettings: options.activateBookSettings,
    deactivateBookSettings: options.deactivateBookSettings,
    clearLocalAddedShelfId: () => {
      options.localAddedShelfId.value = '';
    },
    setShelfDataReady: options.setShelfDataReady,
    getShelfDataReady: options.getShelfDataReady,
    observeReaderBody: () => {
      if (resizeObserver && options.readerBodyRef.value) {
        resizeObserver.observe(options.readerBodyRef.value);
      }
    },
    unobserveReaderBody: () => {
      if (resizeObserver && options.readerBodyRef.value) {
        resizeObserver.unobserve(options.readerBodyRef.value);
      }
    },
    resetReaderSessionForOpen: options.readerSessionStore.resetForOpen,
    resetReaderSessionForClose: options.readerSessionStore.resetForClose,
    resetReaderUiLayers: options.readerUiStore.resetLayers,
    resetProgressSyncState: options.resetProgressSyncState,
    openSession: options.openSession,
    closeSession: options.closeSession,
    loadShelfStatus: options.loadShelfStatus,
    openChapter: options.openChapter,
    reportReaderSession: options.reportReaderSession,
    triggerReaderProgressSync: options.triggerReaderProgressSync,
    startAutoSave: options.startAutoSave,
    stopAutoSave: options.stopAutoSave,
    saveDetailedProgress: options.saveDetailedProgress,
    clearAllRuntimeCache: options.clearAllRuntimeCache,
    invalidatePages: options.invalidatePages,
    trackSessionOpen: (_payload) => {},
  });

  function schedulePagedRepaginate() {
    if (resizeDebounceTimer) {
      clearTimeout(resizeDebounceTimer);
    }

    resizeDebounceTimer = setTimeout(() => {
      resizeDebounceTimer = null;
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        if (!options.getShow() || options.openingChapter.value || options.restoringPosition.value) {
          return;
        }

        void options.syncSessionSnapshot();

        if (options.isPagedMode.value) {
          const total = options.activePagedPages.value.length;
          if (total <= 0 || options.pagedLoading.value) {
            return;
          }
          const anchor = options.pagedCache.buildAnchorForChapterPage(
            options.activeChapterIndex.value,
            options.pagedPageIndex.value,
          );
          options.pagedCache.invalidatePages();
          void options.openChapter(options.activeChapterIndex.value, {
            position: 'resume',
            anchor,
          });
          return;
        }

        if (options.isScrollMode.value) {
          const anchor = options.currentPageIndex.value;
          if (anchor >= 0) {
            void nextTick(() => {
              requestAnimationFrame(() => {
                const restoreAnchor =
                  options.scrollModeRef.value?.restoreToReadingAnchor ??
                  options.scrollModeRef.value?.scrollToReadingAnchor ??
                  options.scrollModeRef.value?.scrollToParagraph;
                restoreAnchor?.(anchor);
              });
            });
            return;
          }

          const ratio = options.currentScrollRatio.value;
          if (ratio >= 0) {
            void nextTick(() => {
              requestAnimationFrame(() => {
                options.scrollModeRef.value?.scrollToRatio?.(ratio);
              });
            });
          }
          return;
        }

        if (options.isComicMode.value) {
          const ratio = options.currentScrollRatio.value;
          if (ratio > 0) {
            void nextTick(() => {
              requestAnimationFrame(() => {
                options.comicModeRef.value?.scrollToRatio?.(ratio);
              });
            });
          }
        }
      });
    }, REPAGINATE_DEBOUNCE_MS);
  }

  function clearRepaginateWork() {
    if (resizeDebounceTimer) {
      clearTimeout(resizeDebounceTimer);
      resizeDebounceTimer = null;
    }
    cancelAnimationFrame(resizeRaf);
    resizeRaf = 0;
  }

  watch(
    () => options.settings.flipMode,
    (nextMode, prevMode) => {
      if (
        !options.getShow() ||
        options.isComicMode.value ||
        options.isVideoMode.value ||
        nextMode === prevMode ||
        !options.content.value
      ) {
        return;
      }

      if (nextMode === 'scroll') {
        if (options.currentScrollRatio.value >= 0) {
          options.pendingRestoreScrollRatio.value = options.currentScrollRatio.value;
        }
        void options.openLinearChapter(options.activeChapterIndex.value);
        return;
      }

      if (prevMode === 'scroll') {
        void options.openPagedChapter(options.activeChapterIndex.value, {
          position: options.currentScrollRatio.value >= 0 ? 'resume' : 'first',
          pageRatio:
            options.currentScrollRatio.value >= 0 ? options.currentScrollRatio.value : undefined,
        });
      }
    },
  );

  watch(
    () =>
      [
        options.settings.typography,
        options.settings.pagePadding,
        options.settings.paginationEngine,
      ] as const,
    () => {
      schedulePagedRepaginate();
    },
    { deep: true },
  );

  watch(
    () => options.getShow(),
    (visible) => {
      // 多个 ChapterReaderModal 同时挂载时，只有当前显示的那个拥有 readerViewStore/readerActionsStore 绑定权。
      // 每次 show 变为 true 时重新抢占，防止其他视图的弹层在挂载时覆盖本实例的绑定。
      if (visible) {
        options.readerViewStore.bind(viewStoreBindings);
        options.readerActionsStore.bind(actionStoreBindings);
      }
      readerLifecycle.handleVisibilityChange(visible);
    },
  );

  onMounted(() => {
    window.addEventListener('keydown', onPageTurnKeyDownCapture, true);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', schedulePagedRepaginate);
    window.addEventListener('orientationchange', schedulePagedRepaginate);
    document.addEventListener('visibilitychange', options.onVisibilityChange);
    window.addEventListener('beforeunload', options.onBeforeUnloadSave);
    resizeObserver = new ResizeObserver(() => {
      schedulePagedRepaginate();
    });
    if (options.readerBodyRef.value) {
      resizeObserver.observe(options.readerBodyRef.value);
    }
    options.setupReadingConflictListener();
    unlistenPluginToast = eventListenSync<{
      pluginId?: string;
      message?: string;
      type?: 'info' | 'success' | 'warning' | 'error';
    }>(FRONTEND_PLUGIN_TOAST_EVENT, (event) => {
      const text = event.payload.message?.trim();
      if (!text) {
        return;
      }
      const prefix = event.payload.pluginId ? `[${event.payload.pluginId}] ` : '';
      switch (event.payload.type) {
        case 'success':
          options.message.success(prefix + text);
          break;
        case 'warning':
          options.message.warning(prefix + text);
          break;
        case 'error':
          options.message.error(prefix + text);
          break;
        default:
          options.message.info(prefix + text);
          break;
      }
    });
  });

  onBeforeUnmount(() => {
    syncNativeVolumeKeyPageTurn(false);
    window.removeEventListener('keydown', onPageTurnKeyDownCapture, true);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('resize', schedulePagedRepaginate);
    window.removeEventListener('orientationchange', schedulePagedRepaginate);
    document.removeEventListener('visibilitychange', options.onVisibilityChange);
    window.removeEventListener('beforeunload', options.onBeforeUnloadSave);
    options.stopAutoSave();
    void options.saveDetailedProgress();
    clearRepaginateWork();
    options.clearAllSeamlessSlots();
    options.readerActionsStore.clear();
    options.readerViewStore.clear();
    resizeObserver?.disconnect();
    options.reportReaderSession(false);
    void options.closeSession();
    options.cleanupReadingConflictListener();
    unlistenPluginToast?.();
  });

  return {
    clearRepaginateWork,
  };
}
