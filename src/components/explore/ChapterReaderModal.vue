<script setup lang="ts">
import { useMessage, useDialog } from 'naive-ui';
import { storeToRefs } from 'pinia';
import { computed, markRaw, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { CachedChapter } from '@/types';
import {
  type ChapterGroup,
  type ChapterItem,
  useAppConfigStore,
  useBookshelfStore,
  useReaderSessionStore,
  useReaderSettingsStore,
  useReaderUiStore,
  useScriptBridgeStore,
} from '@/stores';
import type { ReaderBookInfo, WholeBookSwitchedPayload } from '../reader/types';
import { eventListenSync } from '../../composables/useEventBus';
import {
  FRONTEND_PLUGIN_TOAST_EVENT,
  useFrontendPlugins,
} from '../../composables/useFrontendPlugins';
import { useOverlayBackstack } from '../../composables/useOverlayBackstack';
import { useSync } from '../../composables/useSync';
import { getCoverImageUrl } from '../../utils/coverImage';
import ReaderMenuLayer from '../../features/reader/components/ReaderMenuLayer.vue';
import ReaderModal from '../../features/reader/components/ReaderModal.vue';
import ReaderPluginLayer from '../../features/reader/components/ReaderPluginLayer.vue';
import ReaderShell from '../../features/reader/components/ReaderShell.vue';
import {
  createReaderCacheController,
  createReaderPrefetchController,
} from '../../features/reader/services/readerCache';
import {
  clearAllRuntimeTextCache,
  clearChapterRuntimeTextCache,
  clearProcessedRuntimeTextCache,
  createReaderRuntimeTextCache,
} from '../../features/reader/services/readerContentPipeline';
import { createReaderLifecycleController } from '../../features/reader/services/readerLifecycle';
import { createReaderNavigationController } from '../../features/reader/services/readerNavigation';
import { createReaderSourceSwitchController } from '../../features/reader/services/readerSourceSwitch';
import { usePagedChapterCache } from '../reader/composables/usePagedChapterCache';
import { useReaderChapterOpen } from '../reader/composables/useReaderChapterOpen';
import { useReaderLayoutDump } from '../reader/composables/useReaderLayoutDump';
import { useReaderModeBridge } from '../reader/composables/useReaderModeBridge';
import {
  type ReaderPositionMode,
  useReaderPosition,
} from '../reader/composables/useReaderPosition';
import { useReaderProgressSync } from '../reader/composables/useReaderProgressSync';
import { useReaderSessionBridge } from '../reader/composables/useReaderSessionBridge';
import { useReaderTtsManager } from '../reader/composables/useReaderTtsManager';
import VideoPlayerPage from '../reader/modes/VideoPlayerPage.vue';
import ReaderContentArea from '../reader/ReaderContentArea.vue';

type PagedModeKind = 'slide' | 'cover' | 'simulation' | 'none';

declare global {
  interface Window {
    LegadoAndroidInput?: {
      setVolumeKeyPageTurnEnabled?: (enabled: boolean) => void;
    };
  }
}

const ReaderMenuLayerComponent = markRaw(ReaderMenuLayer);
type ReaderNavigationController = ReturnType<typeof createReaderNavigationController>;

const props = defineProps<{
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
  /** 视频多线路分组数据（可选） */
  chapterGroups?: ChapterGroup[];
  /** 初始选中的线路索引 */
  initialGroupIndex?: number;
}>();

const emit = defineEmits<{
  (e: 'update:show', val: boolean): void;
  (e: 'update:currentIndex', val: number): void;
  (e: 'refresh-toc'): void;
  (e: 'added-to-shelf', shelfId: string): void;
  (e: 'source-switched', payload: WholeBookSwitchedPayload): void;
}>();

const message = useMessage();
const dialog = useDialog();
const _appCfg = useAppConfigStore();
const { config } = storeToRefs(_appCfg);
const { runChapterContent, appendDebugLog } = useScriptBridgeStore();
const sync = useSync();
const {
  updateProgress,
  saveContent,
  getContent,
  deleteContent,
  getCachedIndices,
  getShelfBook,
  addToShelf,
  saveChapters,
  ensureLoaded: ensureShelfLoaded,
} = useBookshelfStore();

/**
 * 在阅读过程中本地获得的书架 ID（通过阅读器内加入书架功能）。
 * 与 props.shelfBookId 合并为 currentShelfId，优先使用 prop 中传入的已有 ID。
 */
const localAddedShelfId = ref('');
/** 当前生效的书架 ID：来自 prop（已在书架中）或阅读中动态加入书架后设置 */
const currentShelfId = computed(() => props.shelfBookId || localAddedShelfId.value);
/** 是否已在书架（含阅读中途加入的情况） */
const isOnShelf = computed(() => !!currentShelfId.value);
const addingToShelf = ref(false);
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
  menuOpenTime,
} = storeToRefs(readerUiStore);
const {
  settings,
  getContentStyle,
  activateBookSettings,
  deactivateBookSettings,
  getSettingsJson,
  tapZoneDebugPreviewVisible,
} = useReaderSettingsStore();
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

const runtimeTextCache = createReaderRuntimeTextCache();
const {
  rawChapterTextCache,
  rawChapterTextRequests,
  processedChapterTextCache,
  processedChapterTextRequests,
} = runtimeTextCache;

const menuLayerRef = ref<InstanceType<typeof ReaderMenuLayer> | null>(null);
const readerBodyRef = ref<HTMLElement | null>(null);
const measureHostRef = ref<HTMLElement | null>(null);
const backgroundMeasureHostRef = ref<HTMLElement | null>(null);

let shelfDataReady: Promise<void> | null = null;
let resizeObserver: ResizeObserver | null = null;
let resizeRaf = 0;
let resizeDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let unlistenPluginToast: (() => void) | null = null;
let readerNavigation: ReaderNavigationController | null = null;

const REPAGINATE_DEBOUNCE_MS = 120;

function closeMenuLayerSettings() {
  const closeSettings = menuLayerRef.value?.closeSettings;
  if (typeof closeSettings === 'function') {
    closeSettings();
  }
}

const isComicMode = computed(() => props.sourceType === 'comic');
const isVideoMode = computed(() => props.sourceType === 'video');
// 皮肤可以锁定翻页模式，优先级高于用户设置
const activeSkinLockedFlipMode = computed<string | null>(() => {
  const skinId = settings.skinPresetId;
  if (!skinId) {
    return null;
  }
  return readerSkins.value.find((s) => s.localId === skinId)?.lockedFlipMode ?? null;
});
const effectiveFlipMode = computed(() => activeSkinLockedFlipMode.value ?? settings.flipMode);
const isScrollMode = computed(
  () => !isComicMode.value && !isVideoMode.value && effectiveFlipMode.value === 'scroll',
);
const pagedMode = computed<PagedModeKind | null>(() => {
  if (isComicMode.value || isVideoMode.value || effectiveFlipMode.value === 'scroll') {
    return null;
  }
  return effectiveFlipMode.value as PagedModeKind;
});
const legacyPagedMode = computed<PagedModeKind | null>(() => {
  if (!pagedMode.value) {
    return null;
  }
  return pagedMode.value;
});
const isPagedMode = computed(() => pagedMode.value !== null);

const effectiveStyle = computed(() => {
  const base = getContentStyle();
  if (isComicMode.value || isVideoMode.value) {
    base['--reader-bg-color'] = '#000000';
    base['--reader-bg-image'] = 'none';
    base['--reader-bg-size'] = 'auto';
    base['--reader-bg-position'] = 'center';
    base['--reader-bg-repeat'] = 'no-repeat';
    base['--reader-bg-attachment'] = 'scroll';
    base['--reader-bg-blend-mode'] = 'normal';
    base['--reader-text-color'] = '#ffffff';
  }
  Object.assign(base, readerAppearanceVars.value);
  // TTS 高亮色：由选区色派生，自动适配任意主题
  // 使用 CSS color-mix 确保与主题深浅完美融合
  base['--reader-tts-hl-bg'] = 'color-mix(in srgb, var(--reader-selection-color) 65%, transparent)';
  return base;
});

function buildReaderContentPayload(
  stage: Parameters<typeof runReaderContentPipeline>[0],
  contentText: string,
  index: number,
) {
  const chapter = getChapter(index);
  return {
    stage,
    content: contentText,
    sourceType: props.sourceType ?? 'novel',
    fileName: props.fileName,
    chapterIndex: index,
    chapterName: chapter?.name ?? props.chapterName,
    chapterUrl: chapter?.url ?? props.chapterUrl,
  };
}

function getChapter(index: number): ChapterItem | undefined {
  return index >= 0 && index < props.chapters.length ? props.chapters[index] : undefined;
}

const activeChapter = computed(() => getChapter(activeChapterIndex.value));
const hasPrev = computed(() => activeChapterIndex.value > 0);
const hasNext = computed(() => activeChapterIndex.value < props.chapters.length - 1);
const currentChapterName = computed(() => activeChapter.value?.name ?? props.chapterName);
const currentChapterUrl = computed(() => activeChapter.value?.url ?? props.chapterUrl);
const currentChapterOverride = computed(
  () => temporaryChapterOverrides.value[activeChapterIndex.value] ?? null,
);

const {
  buildReaderSessionSnapshot,
  openSession,
  closeSession,
  syncSessionSnapshot,
  updateSessionVisibility,
} = useReaderSessionBridge({
  getShow: () => props.show,
  fileName: props.fileName,
  sourceType: props.sourceType,
  bookInfo: props.bookInfo,
  getChapterCount: () => props.chapters.length,
  fallbackChapterName: props.chapterName,
  fallbackChapterUrl: props.chapterUrl,
  currentShelfId,
  activeChapterIndex,
  currentPageIndex,
  currentScrollRatio,
  content,
  settings,
  readerBodyRef,
  getChapter,
  openReaderSession,
  updateReaderSession,
  closeReaderSession,
});

watch(showMenu, (visible) => {
  if (!visible) {
    // 菜单关闭时，如果设置面板仍然开着（理论上不应发生，但做保险处理），
    // 强制同步关闭并让统一返回栈 watcher 完成注销。
    if (settingsVisible.value) {
      settingsVisible.value = false;
    }
    closeMenuLayerSettings();
  }
});

watch(activeChapterIndex, (idx) => {
  if (idx !== props.currentIndex) {
    emit('update:currentIndex', idx);
  }
});

// 自动预缓存：每次切换章节后，静默检查并补齐未缓存章节
watch(activeChapterIndex, (idx) => {
  const count = config.value.cache_prefetch_count;
  // 0 = 关闭；视频不缓存；未在书架
  if (count === 0 || props.sourceType === 'video' || !currentShelfId.value) {
    return;
  }
  // 确定需要缓存的范围
  const effectiveCount = count < 0 ? props.chapters.length : count;
  const rangeEnd = Math.min(idx + 1 + effectiveCount, props.chapters.length);
  if (idx + 1 >= props.chapters.length) {
    return;
  }

  // 检查范围内是否有任何未缓存章节
  let anyUncached = false;
  for (let n = idx + 1; n < rangeEnd; n++) {
    if (!cachedIndices.value.has(n)) {
      anyUncached = true;
      break;
    }
  }
  if (!anyUncached) {
    return;
  }

  // 静默启动，不阻塞阅读，不显示任何通知
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

watch(
  () => pluginState.contentVersion,
  async (version, previous) => {
    if (!props.show || previous === 0 || version === previous) {
      return;
    }

    clearProcessedRuntimeTextCache(runtimeTextCache);
    pagedCache.invalidatePages();

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
    await openChapter(activeChapterIndex.value, {
      position: 'resume',
    });
  },
);

async function loadShelfStatus() {
  if (!currentShelfId.value) {
    return;
  }

  try {
    cachedIndices.value = await getCachedIndices(currentShelfId.value);
  } catch {
    cachedIndices.value = new Set();
  }

  const nextRead = new Set<number>();
  const readUpTo = activeChapterIndex.value >= 0 ? activeChapterIndex.value : -1;
  for (let index = 0; index <= readUpTo; index++) {
    nextRead.add(index);
  }
  readIndices.value = nextRead;
}

function markChapterRead(index: number) {
  readIndices.value.add(index);
}

async function fetchRawChapterText(index: number, forceNetwork = false): Promise<string> {
  const chapter = getChapter(index);
  if (!chapter) {
    return '';
  }
  const chapterOverride = temporaryChapterOverrides.value[index];

  if (forceNetwork) {
    rawChapterTextCache.delete(index);
    rawChapterTextRequests.delete(index);
  }

  const cached = rawChapterTextCache.get(index);
  if (!forceNetwork && cached !== undefined) {
    return cached;
  }

  const inflight = rawChapterTextRequests.get(index);
  if (!forceNetwork && inflight) {
    return inflight;
  }

  const request = (async () => {
    let text: string | null = null;

    if (chapterOverride) {
      const raw = await runChapterContent(chapterOverride.fileName, chapterOverride.chapterUrl);
      text = typeof raw === 'string' ? raw : String(raw ?? '');
    }

    if (!text && !forceNetwork && currentShelfId.value) {
      try {
        text = await getContent(currentShelfId.value, index);
        // 兼容旧版预加载的漫画 marker（仅写了 "comic" 而非图片 URL 列表）
        if (props.sourceType === 'comic' && text === 'comic') {
          text = null;
        }
      } catch {
        // 回退到网络请求
      }
    }

    if (!text) {
      const raw = await runChapterContent(props.fileName, chapter.url);
      text = typeof raw === 'string' ? raw : String(raw ?? '');
      if (currentShelfId.value && text) {
        saveContent(currentShelfId.value, index, text).catch(() => {});
      }
    }

    const nextText = text ?? '';
    rawChapterTextCache.set(index, nextText);

    if (currentShelfId.value && nextText) {
      cachedIndices.value.add(index);
    }

    return nextText;
  })();

  rawChapterTextRequests.set(index, request);

  try {
    return await request;
  } finally {
    if (rawChapterTextRequests.get(index) === request) {
      rawChapterTextRequests.delete(index);
    }
  }
}

async function fetchProcessedChapterText(
  index: number,
  finalStage: 'reader.content.beforePaginate' | 'reader.content.beforeRender',
  forceNetwork = false,
): Promise<string> {
  if (props.sourceType === 'comic' || props.sourceType === 'video') {
    return fetchRawChapterText(index, forceNetwork);
  }

  const cacheKey = `${index}:${finalStage}`;
  if (forceNetwork) {
    processedChapterTextCache.delete(cacheKey);
    processedChapterTextRequests.delete(cacheKey);
  }

  const cached = processedChapterTextCache.get(cacheKey);
  if (!forceNetwork && cached !== undefined) {
    return cached;
  }

  const inflight = processedChapterTextRequests.get(cacheKey);
  if (!forceNetwork && inflight) {
    return inflight;
  }

  const request = (async () => {
    let nextText = await fetchRawChapterText(index, forceNetwork);
    nextText = await runReaderContentPipeline(
      'reader.content.raw',
      buildReaderContentPayload('reader.content.raw', nextText, index),
    );
    nextText = await runReaderContentPipeline(
      'reader.content.cleaned',
      buildReaderContentPayload('reader.content.cleaned', nextText, index),
    );
    nextText = await runReaderContentPipeline(
      'reader.content.beforePaginate',
      buildReaderContentPayload('reader.content.beforePaginate', nextText, index),
    );
    if (finalStage === 'reader.content.beforeRender') {
      nextText = await runReaderContentPipeline(
        'reader.content.beforeRender',
        buildReaderContentPayload('reader.content.beforeRender', nextText, index),
      );
    }
    processedChapterTextCache.set(cacheKey, nextText);
    return nextText;
  })();

  processedChapterTextRequests.set(cacheKey, request);

  try {
    return await request;
  } finally {
    if (processedChapterTextRequests.get(cacheKey) === request) {
      processedChapterTextRequests.delete(cacheKey);
    }
  }
}

const pagedCache = usePagedChapterCache({
  activeHostRef: measureHostRef,
  backgroundHostRef: backgroundMeasureHostRef,
  loadChapterText: (index, forceNetwork) =>
    fetchProcessedChapterText(index, 'reader.content.beforePaginate', forceNetwork),
  getChapterTitle: (index) => getChapter(index)?.name ?? '',
  getTypography: () => settings.typography,
  getPadding: () => settings.pagePadding,
  getPaginationEngine: () => settings.paginationEngine,
});

const activePagedPages = computed(() => pagedCache.getPages(activeChapterIndex.value));
const prevBoundaryPage = computed(() =>
  hasPrev.value ? pagedCache.getBoundaryPage(activeChapterIndex.value - 1, 'last') : '',
);
const nextBoundaryPage = computed(() => {
  if (!hasNext.value) {
    return '<div class="paged-mode-end-screen"><div class="paged-mode-end-screen__icon">📖</div><p class="paged-mode-end-screen__title">已读完最后一章</p><p class="paged-mode-end-screen__sub">全书完，感谢阅读</p></div>';
  }
  return pagedCache.getBoundaryPage(activeChapterIndex.value + 1, 'first');
});

// ── 无缝滚动/漫画 下一章预加载 ──────────────────────────────────────────
const nextScrollChapterContent = ref('');
const nextScrollChapterTitle = ref('');
const nextComicChapterContent = ref('');
const nextComicChapterTitle = ref('');
let nextChapterPrefetchAbort: AbortController | null = null;

async function prefetchNextChapterForSeamless(index: number) {
  nextChapterPrefetchAbort?.abort();
  nextChapterPrefetchAbort = new AbortController();
  const signal = nextChapterPrefetchAbort.signal;

  if (index < 0 || index >= props.chapters.length) {
    nextScrollChapterContent.value = '';
    nextScrollChapterTitle.value = '';
    nextComicChapterContent.value = '';
    nextComicChapterTitle.value = '';
    return;
  }

  const chapter = getChapter(index);
  const title = chapter?.name ?? '';

  try {
    const text = await fetchProcessedChapterText(index, 'reader.content.beforeRender');
    if (signal.aborted) {
      return;
    }
    if (isComicMode.value) {
      nextComicChapterContent.value = text;
      nextComicChapterTitle.value = title;
    } else {
      nextScrollChapterContent.value = text;
      nextScrollChapterTitle.value = title;
    }
  } catch {
    if (!signal.aborted) {
      nextScrollChapterContent.value = '';
      nextScrollChapterTitle.value = '';
      nextComicChapterContent.value = '';
      nextComicChapterTitle.value = '';
    }
  }
}

watch(
  [activeChapterIndex, isScrollMode, isComicMode],
  () => {
    nextScrollChapterContent.value = '';
    nextScrollChapterTitle.value = '';
    nextComicChapterContent.value = '';
    nextComicChapterTitle.value = '';
    if ((isScrollMode.value || isComicMode.value) && hasNext.value) {
      void prefetchNextChapterForSeamless(activeChapterIndex.value + 1);
    }
  },
  { immediate: true },
);

/** 滚动模式：用户向下滚动进入下一章区域，无缝切换章节 */
async function onScrollNextChapterEntered(sectionHeight: number) {
  if (!hasNext.value) {
    return;
  }
  const newContent = nextScrollChapterContent.value;
  if (!newContent) {
    // 预缓存失败或内容尚未就绪，回退到标准加载流程（显示 loading 状态与错误提示）
    saveDetailedProgress();
    navDirection.value = 'forward';
    void openChapter(activeChapterIndex.value + 1, { position: 'first' });
    return;
  }
  scrollModeRef.value?.prepareSeamlessSwap?.(sectionHeight);
  saveDetailedProgress();
  navDirection.value = 'forward';
  const newIndex = activeChapterIndex.value + 1;
  const oldContent = content.value;
  const oldTitle = currentChapterName.value;
  // 将当前章节保存为新的上一章（三章节滑动窗口）
  prevScrollChapterContent.value = oldContent;
  prevScrollChapterTitle.value = oldTitle;
  activeChapterIndex.value = newIndex;
  content.value = newContent;
  nextScrollChapterContent.value = '';
  nextScrollChapterTitle.value = '';
  markChapterRead(newIndex);
  const chapter = getChapter(newIndex);
  if (chapter && currentShelfId.value) {
    void updateProgress(currentShelfId.value, newIndex, chapter.url, buildProgressPayload()).catch(() => {});
  }
  if (newIndex + 1 < props.chapters.length) {
    void prefetchNextChapterForSeamless(newIndex + 1);
  }
}

/** 滚动模式：用户向上滚动进入上一章区域，无缝向前切换章节 */
async function onScrollPrevChapterEntered() {
  if (!hasPrev.value || !prevScrollChapterContent.value) {
    return;
  }
  scrollModeRef.value?.prepareSeamlessSwapBack?.();
  saveDetailedProgress();
  navDirection.value = 'backward';
  const newIndex = activeChapterIndex.value - 1;
  const oldContent = content.value;
  const oldTitle = currentChapterName.value;
  const newContent = prevScrollChapterContent.value;
  // 将当前章节保存为新的下一章
  nextScrollChapterContent.value = oldContent;
  nextScrollChapterTitle.value = oldTitle;
  activeChapterIndex.value = newIndex;
  content.value = newContent;
  prevScrollChapterContent.value = '';
  prevScrollChapterTitle.value = '';
  markChapterRead(newIndex);
  const chapter = getChapter(newIndex);
  if (chapter && currentShelfId.value) {
    void updateProgress(currentShelfId.value, newIndex, chapter.url, buildProgressPayload()).catch(() => {});
  }
  if (newIndex - 1 >= 0) {
    void prefetchPrevChapterForSeamless(newIndex - 1);
  }
}

/** 漫画模式：用户向下滚动进入下一章区域，无缝切换章节 */
async function onComicNextChapterEntered(sectionHeight: number) {
  if (!hasNext.value) {
    return;
  }
  const newContent = nextComicChapterContent.value;
  if (!newContent) {
    // 预缓存失败或内容尚未就绪，回退到标准加载流程
    saveDetailedProgress();
    navDirection.value = 'forward';
    void openChapter(activeChapterIndex.value + 1, { position: 'first' });
    return;
  }
  comicModeRef.value?.prepareSeamlessSwap?.(sectionHeight);
  saveDetailedProgress();
  navDirection.value = 'forward';
  const newIndex = activeChapterIndex.value + 1;
  const oldContent = content.value;
  const oldTitle = currentChapterName.value;
  // 将当前章节保存为新的上一章
  prevComicChapterContent.value = oldContent;
  prevComicChapterTitle.value = oldTitle;
  activeChapterIndex.value = newIndex;
  content.value = newContent;
  nextComicChapterContent.value = '';
  nextComicChapterTitle.value = '';
  markChapterRead(newIndex);
  const chapter = getChapter(newIndex);
  if (chapter && currentShelfId.value) {
    void updateProgress(currentShelfId.value, newIndex, chapter.url, buildProgressPayload()).catch(() => {});
  }
  if (newIndex + 1 < props.chapters.length) {
    void prefetchNextChapterForSeamless(newIndex + 1);
  }
}

/** 漫画模式：用户向上滚动进入上一章区域，无缝向前切换 */
async function onComicPrevChapterEntered() {
  if (!hasPrev.value || !prevComicChapterContent.value) {
    return;
  }
  comicModeRef.value?.prepareSeamlessSwapBack?.();
  saveDetailedProgress();
  navDirection.value = 'backward';
  const newIndex = activeChapterIndex.value - 1;
  const oldContent = content.value;
  const oldTitle = currentChapterName.value;
  const newContent = prevComicChapterContent.value;
  nextComicChapterContent.value = oldContent;
  nextComicChapterTitle.value = oldTitle;
  activeChapterIndex.value = newIndex;
  content.value = newContent;
  prevComicChapterContent.value = '';
  prevComicChapterTitle.value = '';
  markChapterRead(newIndex);
  const chapter = getChapter(newIndex);
  if (chapter && currentShelfId.value) {
    void updateProgress(currentShelfId.value, newIndex, chapter.url, buildProgressPayload()).catch(() => {});
  }
  if (newIndex - 1 >= 0) {
    void prefetchPrevChapterForSeamless(newIndex - 1);
  }
}

const blockingLoading = computed(() => {
  if (isPagedMode.value) {
    return pagedLoading.value && (activePagedPages.value.length === 0 || openingChapter.value);
  }
  // 滚动/线性模式：切换章节时（openingChapter）也显示加载动画，
  // 避免未下载的章节无动画、界面冻结在旧内容。
  //
  // ⚠️ 【易错点·勿改】此值为 true 时，ReaderContentArea 渲染 spinner 而非 ScrollMode，
  // scrollModeRef.value 为 null，无法恢复/读取滚动位置。
  // useReaderChapterOpen.openLinearChapter 在内容就绪后会提前将 loading.value 置 false，
  // 保证 restoreLinearPosition 执行时 blockingLoading 已经为 false，ScrollMode 已挂载。
  // 不要把 loading.value = false 推迟到 finally，否则位置恢复失效。
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

const {
  pagedModeRef,
  scrollModeRef,
  comicModeRef,
  videoModeRef, // bound in template via ref="videoModeRef"
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
// videoModeRef is written via template ref="videoModeRef"; the composable reads it internally
void videoModeRef;

// markRaw plain object so Vue never proxies/unwraps the contained Ref objects
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

// ── TTS Manager ──────────────────────────────────────────────────────────
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

const nativeVolumeKeyPageTurnEnabled = computed(
  () =>
    props.show &&
    settings.volumeKeyPageTurnEnabled &&
    !isVideoMode.value &&
    !showTtsBar.value &&
    !showMenu.value &&
    !showToc.value &&
    !settingsVisible.value,
);

function syncNativeVolumeKeyPageTurn(enabled: boolean) {
  window.LegadoAndroidInput?.setVolumeKeyPageTurnEnabled?.(enabled);
}

watch(nativeVolumeKeyPageTurnEnabled, syncNativeVolumeKeyPageTurn, { immediate: true });

// ── Layout Dump ───────────────────────────────────────────────────────────
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

function shouldIgnorePositionEvents(): boolean {
  return openingChapter.value || restoringPosition.value;
}

function clearRepaginateWork() {
  // 取消 openChapter 执行期间被 settings watcher 调度的冗余重排定时器
  // （典型场景：activateBookSettings 修改排版参数触发 watcher，但 openChapter
  //   已经使用最新设置完成分页，再次重排是多余的且会导致页面闪烁）
  if (resizeDebounceTimer) {
    clearTimeout(resizeDebounceTimer);
    resizeDebounceTimer = null;
  }
  cancelAnimationFrame(resizeRaf);
  resizeRaf = 0;
}

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
  reportLoadError: (loadError) => {
    message.error(`加载正文失败: ${loadError}`, { duration: 8000, closable: true });
  },
  clearRepaginateWork,
});

function retryCurrentChapter() {
  void openChapter(activeChapterIndex.value, { forceNetwork: true });
}

const readerPrefetch = createReaderPrefetchController({
  currentShelfId,
  fileName: props.fileName,
  message,
  getBookUrl: () => props.bookInfo?.bookUrl ?? '',
  getBookName: () => props.bookInfo?.name ?? '',
  getSourceType: () => props.sourceType ?? 'novel',
  getChapters: () => props.chapters,
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
  activeChapterIndex,
  shouldIgnorePositionEvents,
  getChapter,
  fallbackChapterName: props.chapterName,
  fallbackChapterUrl: props.chapterUrl,
  readCurrentPosition,
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

/**
 * 将当前书籍加入书架，并保存当前阅读进度与章节列表。
 * 可在阅读器内（菜单按钮）或关闭时（弹窗确认）调用。
 */
async function handleAddToShelf(): Promise<boolean> {
  if (!props.bookInfo || isOnShelf.value || addingToShelf.value) {
    return false;
  }
  addingToShelf.value = true;
  try {
    await ensureShelfLoaded();
    const info = props.bookInfo;
    const result = await addToShelf(
      {
        name: info.name,
        author: info.author,
        coverUrl: getCoverImageUrl(info.coverUrl),
        intro: info.intro,
        kind: info.kind,
        bookUrl: info.bookUrl ?? '',
        lastChapter: info.lastChapter,
        sourceType: props.sourceType ?? 'novel',
      },
      props.fileName,
      info.sourceName ?? '',
    );

    // 同时保存章节目录
    if (props.chapters.length) {
      const cached: CachedChapter[] = props.chapters.map((ch, i) => ({
        index: i,
        name: ch.name,
        url: ch.url,
      }));
      await saveChapters(result.id, cached).catch(() => {});
    }

    // 记录已加载的书架 ID，后续进度保存使用
    localAddedShelfId.value = result.id;

    // 立即保存当前阅读进度
    const chapter = getChapter(activeChapterIndex.value);
    if (chapter) {
      await updateProgress(result.id, activeChapterIndex.value, chapter.url, {
        ...buildProgressPayload(),
      }).catch(() => {});
    }

    message.success('已加入书架');
    emit('added-to-shelf', result.id);
    return true;
  } catch (e: unknown) {
    message.error(`加入书架失败: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  } finally {
    addingToShelf.value = false;
  }
}

function close() {
  saveDetailedProgress();
  // 如果书籍尚未加入书架且有书籍信息，提示用户是否加入书架
  if (!isOnShelf.value && props.bookInfo && !isVideoMode.value) {
    dialog.create({
      title: '加入书架',
      content: `《${props.bookInfo.name}》还未加入书架，是否加入？`,
      positiveText: '加入',
      negativeText: '不用了',
      closeOnEsc: false,
      maskClosable: false,
      onPositiveClick: () => {
        handleAddToShelf().finally(() => {
          emit('update:show', false);
        });
      },
      onNegativeClick: () => {
        emit('update:show', false);
      },
    });
    return;
  }
  emit('update:show', false);
}

async function closeWithBackBehavior() {
  close();
  if (settings.backBehavior === 'desktop') {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().minimize();
    } catch {
      // 非 Tauri 环境忽略
    }
  }
}

useOverlayBackstack(
  () => props.show,
  () => {
    void closeWithBackBehavior();
  },
);

useOverlayBackstack(
  () => props.show && showMenu.value,
  () => {
    settingsVisible.value = false;
    closeMenuLayerSettings();
    showMenu.value = false;
  },
);

useOverlayBackstack(
  () => props.show && showToc.value,
  () => {
    showToc.value = false;
  },
);

useOverlayBackstack(
  () => props.show && settingsVisible.value,
  () => {
    settingsVisible.value = false;
    closeMenuLayerSettings();
  },
);

useOverlayBackstack(
  () => props.show && showSourceSwitchDialog.value,
  () => {
    showSourceSwitchDialog.value = false;
  },
);

function onMenuOverlayClick() {
  if (Date.now() - menuOpenTime.value > 200) {
    settingsVisible.value = false;
    showMenu.value = false;
  }
}

function onTap(zone: 'left' | 'center' | 'right') {
  if (zone === 'center') {
    if (showToc.value) {
      showToc.value = false;
    } else {
      if (!showMenu.value) {
        readerUiStore.openMenu();
      } else {
        settingsVisible.value = false;
        showMenu.value = false;
      }
    }
    return;
  }

  if (zone === 'left') {
    void gotoPrevBoundary();
    return;
  }

  void gotoNextBoundary();
}

function onSettingsVisibleChange(val: boolean) {
  settingsVisible.value = val;
}

function openToc() {
  if (settingsVisible.value) {
    settingsVisible.value = false;
    closeMenuLayerSettings();
  }
  readerUiStore.openToc();
}

function onKeyDown(event: KeyboardEvent) {
  if (!props.show) {
    return;
  }
  if (event.defaultPrevented) {
    return;
  }

  if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault();
    if (showToc.value) {
      showToc.value = false;
    } else if (showMenu.value) {
      settingsVisible.value = false;
      showMenu.value = false;
    } else {
      readerUiStore.openMenu();
    }
    return;
  }

  if (showMenu.value || showToc.value) {
    return;
  }

  switch (event.key) {
    case 'ArrowRight':
    case 'd':
    case 'D':
      event.preventDefault();
      flipNext();
      break;
    case 'ArrowLeft':
    case 'a':
    case 'A':
      event.preventDefault();
      flipPrev();
      break;
    case 'AudioVolumeDown':
      if (settings.volumeKeyPageTurnEnabled && !isVideoMode.value && !showTtsBar.value) {
        event.preventDefault();
        volumePageNext();
      }
      break;
    case 'AudioVolumeUp':
      if (settings.volumeKeyPageTurnEnabled && !isVideoMode.value && !showTtsBar.value) {
        event.preventDefault();
        volumePagePrev();
      }
      break;
  }
}

function clearChapterRuntimeCache(index: number) {
  clearChapterRuntimeTextCache(runtimeTextCache, index);
  pagedCache.dropChapter(index);
}

const {
  openWholeBookSourceSwitch,
  openTemporaryChapterSwitch,
  clearTemporaryChapterSwitch,
  handleTemporaryChapterSourceSwitched,
  handleWholeBookSourceSwitched,
} = createReaderSourceSwitchController({
  currentShelfId,
  activeChapterIndex,
  temporaryChapterOverrides,
  currentChapterOverride,
  sourceSwitchMode,
  showSourceSwitchDialog,
  message,
  clearChapterRuntimeCache,
  clearAllRuntimeCache: () => clearAllRuntimeTextCache(runtimeTextCache),
  invalidatePages: () => pagedCache.invalidatePages(),
  openChapter,
  emitSourceSwitched: (payload) => emit('source-switched', payload),
});

const {
  forceRefreshChapter,
  clearChapterCache: handleClearChapterCache,
  clearAllCache: handleClearAllCache,
} = createReaderCacheController({
  currentShelfId,
  fileName: props.fileName,
  message,
  activeChapterIndex,
  cachedIndices,
  currentPageIndex,
  currentScrollRatio,
  pagedPageIndex,
  pendingRestorePageIndex,
  pendingRestoreScrollRatio,
  isPagedMode,
  isComicMode,
  getBookUrl: () => props.bookInfo?.bookUrl ?? '',
  getBookName: () => props.bookInfo?.name ?? '',
  getChapter,
  buildAnchorForChapterPage: (chapterIndex, pageIndex) =>
    pagedCache.buildAnchorForChapterPage(chapterIndex, pageIndex),
  clearChapterRuntimeCache,
  clearAllRuntimeCache: () => clearAllRuntimeTextCache(runtimeTextCache),
  invalidatePages: () => pagedCache.invalidatePages(),
  deleteContent,
  openChapter,
});

const readerLifecycle = createReaderLifecycleController({
  getShelfBookId: () => props.shelfBookId,
  getCurrentIndex: () => props.currentIndex,
  getTrackingPayload: () => ({
    book_name: props.bookInfo?.name,
    author_name: props.bookInfo?.author,
    source_file: props.fileName,
    source_type: props.sourceType ?? 'novel',
    chapter_name: props.chapterName,
    chapter_index: props.currentIndex,
    shelf_book_id: props.shelfBookId || localAddedShelfId.value,
  }),
  readerBodyRef,
  activeChapterIndex,
  pendingRestorePageIndex,
  pendingRestoreScrollRatio,
  pendingResumePlaybackTime,
  isPagedMode,
  ensureFrontendPlugins,
  getShelfBook,
  activateBookSettings,
  deactivateBookSettings,
  clearLocalAddedShelfId: () => {
    localAddedShelfId.value = '';
  },
  setShelfDataReady: (ready) => {
    shelfDataReady = ready;
  },
  getShelfDataReady: () => shelfDataReady,
  observeReaderBody: () => {
    if (resizeObserver && readerBodyRef.value) {
      resizeObserver.observe(readerBodyRef.value);
    }
  },
  unobserveReaderBody: () => {
    if (resizeObserver && readerBodyRef.value) {
      resizeObserver.unobserve(readerBodyRef.value);
    }
  },
  resetReaderSessionForOpen: readerSessionStore.resetForOpen,
  resetReaderSessionForClose: readerSessionStore.resetForClose,
  resetReaderUiLayers: readerUiStore.resetLayers,
  resetProgressSyncState,
  openSession,
  closeSession,
  loadShelfStatus,
  openChapter,
  reportReaderSession,
  triggerReaderProgressSync,
  startAutoSave,
  stopAutoSave,
  saveDetailedProgress,
  clearAllRuntimeCache: () => clearAllRuntimeTextCache(runtimeTextCache),
  invalidatePages: () => pagedCache.invalidatePages(),
  trackSessionOpen: (payload) => {
  },
});

function schedulePagedRepaginate() {
  if (resizeDebounceTimer) {
    clearTimeout(resizeDebounceTimer);
  }

  resizeDebounceTimer = setTimeout(() => {
    resizeDebounceTimer = null;
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
      if (!props.show || openingChapter.value || restoringPosition.value) {
        return;
      }

      void syncSessionSnapshot();

      if (isPagedMode.value) {
        const total = activePagedPages.value.length;
        if (total <= 0 || pagedLoading.value) {
          return;
        }
        // 构建精确阅读锚点（字符偏移 + 段落级 + 比例多级回退）
        const anchor = pagedCache.buildAnchorForChapterPage(
          activeChapterIndex.value,
          pagedPageIndex.value,
        );
        pagedCache.invalidatePages();
        void openChapter(activeChapterIndex.value, {
          position: 'resume',
          anchor,
        });
        return;
      }

      if (isScrollMode.value) {
        const ratio = currentScrollRatio.value;
        if (ratio >= 0) {
          void nextTick(() => {
            requestAnimationFrame(() => {
              scrollModeRef.value?.scrollToRatio?.(ratio);
            });
          });
        }
        return;
      }

      if (isComicMode.value) {
        // 漫画模式按滚动比例恢复位置，避免 visibleImages 尚未就绪时 currentPage=0 导致误跳顶部
        const ratio = currentScrollRatio.value;
        if (ratio > 0) {
          void nextTick(() => {
            requestAnimationFrame(() => {
              comicModeRef.value?.scrollToRatio?.(ratio);
            });
          });
        }
      }
    });
  }, REPAGINATE_DEBOUNCE_MS);
}

watch(
  () => settings.flipMode,
  (nextMode, prevMode) => {
    // 跳过初始化阶段（content 为空表示章节内容尚未加载）和无意义的同值变更
    if (
      !props.show ||
      isComicMode.value ||
      isVideoMode.value ||
      nextMode === prevMode ||
      !content.value
    ) {
      return;
    }

    if (nextMode === 'scroll') {
      // 分页切换为滚动：使用当前页面比例恢复等效滚动位置
      if (currentScrollRatio.value >= 0) {
        pendingRestoreScrollRatio.value = currentScrollRatio.value;
      }
      void openLinearChapter(activeChapterIndex.value);
      return;
    }

    if (prevMode === 'scroll') {
      // 滚动切换为分页：用滚动比例恢复等效页面（比页码更鲁棒）
      void openPagedChapter(activeChapterIndex.value, {
        position: currentScrollRatio.value >= 0 ? 'resume' : 'first',
        pageRatio: currentScrollRatio.value >= 0 ? currentScrollRatio.value : undefined,
      });
    }
  },
);

watch(
  () => [settings.typography, settings.pagePadding, settings.paginationEngine] as const,
  () => {
    schedulePagedRepaginate();
  },
  { deep: true },
);

watch(
  () => props.show,
  (visible) => readerLifecycle.handleVisibilityChange(visible),
);

onMounted(() => {
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', schedulePagedRepaginate);
  window.addEventListener('orientationchange', schedulePagedRepaginate);
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('beforeunload', onBeforeUnloadSave);
  resizeObserver = new ResizeObserver(() => {
    schedulePagedRepaginate();
  });
  if (readerBodyRef.value) {
    resizeObserver.observe(readerBodyRef.value);
  }
  setupReadingConflictListener();
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
        message.success(prefix + text);
        break;
      case 'warning':
        message.warning(prefix + text);
        break;
      case 'error':
        message.error(prefix + text);
        break;
      default:
        message.info(prefix + text);
        break;
    }
  });
});

onBeforeUnmount(() => {
  syncNativeVolumeKeyPageTurn(false);
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('resize', schedulePagedRepaginate);
  window.removeEventListener('orientationchange', schedulePagedRepaginate);
  document.removeEventListener('visibilitychange', onVisibilityChange);
  window.removeEventListener('beforeunload', onBeforeUnloadSave);
  stopAutoSave();
  // 组件卸载前最后一次保存机会
  saveDetailedProgress();
  if (resizeDebounceTimer) {
    clearTimeout(resizeDebounceTimer);
  }
  cancelAnimationFrame(resizeRaf);
  resizeObserver?.disconnect();
  reportReaderSession(false);
  void closeSession();
  cleanupReadingConflictListener();
  unlistenPluginToast?.();
});
</script>

<template>
  <ReaderModal :show="show" @update:show="emit('update:show', $event)">
    <!-- ── 视频模式：YouTube 风格独立布局 ── -->
    <VideoPlayerPage
      v-if="isVideoMode"
      ref="videoModeRef"
      :content="content"
      :chapters="chapters"
      :active-chapter-index="activeChapterIndex"
      :book-info="bookInfo"
      :loading="blockingLoading"
      :error="error"
      :has-prev="hasPrev"
      :has-next="hasNext"
      :file-name="fileName"
      :resume-time="pendingResumePlaybackTime"
      :chapter-groups="chapterGroups"
      :initial-group-index="initialGroupIndex"
      @close="close"
      @goto-chapter="gotoChapter"
      @prev-chapter="gotoPrevChapter"
      @next-chapter="gotoNextChapter"
      @progress="onVideoProgress"
      @ended="onVideoEnded"
      @retry="retryCurrentChapter"
    />

    <!-- ── 小说 / 漫画模式：沉浸全屏阅读器 ── -->
    <ReaderShell v-else :style-value="effectiveStyle" :skin-preset-id="settings.skinPresetId">
      <ReaderPluginLayer background />
      <ReaderContentArea
        :content="content"
        :is-comic-mode="isComicMode"
        :is-paged-mode="isPagedMode"
        :paged-mode="pagedMode"
        :legacy-paged-mode="legacyPagedMode"
        :pages="activePagedPages"
        :paged-page-index="pagedPageIndex"
        :prev-boundary-page="prevBoundaryPage"
        :next-boundary-page="nextBoundaryPage"
        :has-prev="hasPrev"
        :has-next="hasNext"
        :blocking-loading="blockingLoading"
        :blocking-error="blockingError"
        :error="error"
        :paged-loading="pagedLoading"
        :current-chapter-name="currentChapterName"
        :current-chapter-url="currentChapterUrl"
        :chapter-index="activeChapterIndex"
        :file-name="fileName"
        :source-type="sourceType ?? 'novel'"
        :book-url="bookInfo?.bookUrl ?? ''"
        :book-name="bookInfo?.name ?? ''"
        :tts-scroll-highlight-idx="ttsScrollHighlightIdx"
        :tap-zone-left="settings.tapZoneLeft"
        :tap-zone-right="settings.tapZoneRight"
        :tap-left-action="settings.tapLeftAction"
        :tap-right-action="settings.tapRightAction"
        :layout-debug-mode="settings.layoutDebugMode"
        :tap-zone-debug="tapZoneDebugPreviewVisible"
        :paragraph-spacing="settings.typography.paragraphSpacing"
        :text-indent="settings.typography.textIndent"
        :content-refs="contentRefs"
        :prev-scroll-chapter-content="prevScrollChapterContent"
        :prev-scroll-chapter-title="prevScrollChapterTitle"
        :next-scroll-chapter-content="nextScrollChapterContent"
        :next-scroll-chapter-title="nextScrollChapterTitle"
        :prev-comic-chapter-content="prevComicChapterContent"
        :prev-comic-chapter-title="prevComicChapterTitle"
        :next-comic-chapter-content="nextComicChapterContent"
        :next-comic-chapter-title="nextComicChapterTitle"
        @tap="onTap"
        @paged-page-change="onPagedPageChange"
        @paged-progress="onPagedProgress"
        @scroll-progress="onScrollProgress"
        @comic-progress="onComicProgress"
        @prev-chapter="gotoPrevChapter"
        @next-chapter="gotoNextChapter"
        @prev-boundary="gotoPrevBoundary"
        @next-boundary="gotoNextBoundary"
        @scroll-next-chapter-entered="onScrollNextChapterEntered"
        @scroll-prev-chapter-entered="onScrollPrevChapterEntered"
        @comic-next-chapter-entered="onComicNextChapterEntered"
        @comic-prev-chapter-entered="onComicPrevChapterEntered"
        @retry="retryCurrentChapter"
      />

      <ReaderPluginLayer />

      <component
        :is="ReaderMenuLayerComponent"
        ref="menuLayerRef"
        :show-menu="showMenu"
        :show-toc="showToc"
        :settings-visible="settingsVisible"
        :show-tts-bar="showTtsBar"
        :tts-progress-text="ttsProgressText"
        :show-source-switch-dialog="showSourceSwitchDialog"
        :source-switch-mode="sourceSwitchMode"
        :chapters="chapters"
        :active-chapter-index="activeChapterIndex"
        :book-info="bookInfo"
        :source-type="sourceType"
        :has-prev="hasPrev"
        :has-next="hasNext"
        :current-chapter-name="currentChapterName"
        :current-chapter-url="currentChapterUrl"
        :is-video-mode="isVideoMode"
        :is-on-shelf="isOnShelf"
        :adding-to-shelf="addingToShelf"
        :current-chapter-override="currentChapterOverride"
        :current-shelf-id="currentShelfId"
        :file-name="fileName"
        :read-indices="readIndices"
        :cached-indices="cachedIndices"
        :refreshing-toc="props.refreshingToc"
        :menu-open-time="menuOpenTime"
        @update:show-menu="showMenu = $event"
        @update:show-toc="showToc = $event"
        @update:settings-visible="settingsVisible = $event"
        @update:show-tts-bar="showTtsBar = $event"
        @update:show-source-switch-dialog="showSourceSwitchDialog = $event"
        @overlay-click="onMenuOverlayClick"
        @prev="gotoPrevChapter"
        @next="gotoNextChapter"
        @goto="gotoChapter"
        @open-toc="openToc"
        @settings-visible="onSettingsVisibleChange"
        @dump-pagination-layout="dumpPaginationLayoutDebug"
        @tts-toggle="onTtsToggle"
        @close="close"
        @refresh-chapter="forceRefreshChapter"
        @cache-chapters="readerPrefetch.prefetchChapters"
        @whole-book-switch="openWholeBookSourceSwitch"
        @temporary-switch="openTemporaryChapterSwitch"
        @clear-temporary-switch="clearTemporaryChapterSwitch"
        @add-to-shelf="handleAddToShelf"
        @select-toc="gotoChapter"
        @refresh-toc="emit('refresh-toc')"
        @clear-chapter-cache="handleClearChapterCache"
        @clear-all-cache="handleClearAllCache"
        @chapter-temp-switched="handleTemporaryChapterSourceSwitched"
        @whole-book-switched="handleWholeBookSourceSwitched"
      />
    </ReaderShell>
  </ReaderModal>
</template>

<style scoped>
.reader-modal {
  --reader-body-top: 0px;
  --reader-body-right: 0px;
  --reader-body-bottom: 0px;
  --reader-body-left: 0px;
  --reader-body-max-width: none;
  --reader-body-margin: 0;
  --reader-body-surface: transparent;
  --reader-body-border: none;
  --reader-body-shadow: none;
  --reader-body-radius: 0px;
  --reader-body-backdrop-filter: none;
  --reader-top-left: 0px;
  --reader-top-right: 0px;
  --reader-top-top: 0px;
  --reader-top-max-width: none;
  --reader-top-margin: 0;
  --reader-top-radius: 0px;
  --reader-top-border: none;
  --reader-top-shadow: none;
  --reader-bottom-left: 0px;
  --reader-bottom-right: 0px;
  --reader-bottom-bottom: 0px;
  --reader-bottom-max-width: none;
  --reader-bottom-margin: 0;
  --reader-bottom-radius: 0px;
  --reader-bottom-border: none;
  --reader-bottom-shadow: none;
  --reader-menu-overlay-bg: rgba(0, 0, 0, 0.35);
  --reader-shell-title-display: none;
  --reader-shell-title-text: '';
  --reader-shell-title-height: 0px;
  --reader-shell-title-bg: transparent;
  --reader-shell-title-color: inherit;
  --reader-shell-title-padding: 0;
  --reader-shell-title-border: none;
  --reader-shell-title-font: inherit;
  --reader-shell-title-z-index: 9;
  --reader-shell-winctrls-display: none;
  --reader-shell-winctrls-text: '';
  --reader-shell-winctrls-height: 0px;
  --reader-shell-winctrls-bg: transparent;
  --reader-shell-winctrls-color: inherit;
  --reader-shell-winctrls-font: inherit;
  --reader-shell-winctrls-z-index: 9;
  --reader-plugin-top-left-top: calc(
    var(--safe-area-inset-top, env(safe-area-inset-top, 0px)) + 14px
  );
  --reader-plugin-top-left-left: 14px;
  --reader-plugin-top-right-top: calc(
    var(--safe-area-inset-top, env(safe-area-inset-top, 0px)) + 14px
  );
  --reader-plugin-top-right-right: 14px;
  --reader-plugin-bottom-left-left: 14px;
  --reader-plugin-bottom-left-bottom: calc(env(safe-area-inset-bottom, 0px) + 14px);
  --reader-plugin-bottom-right-right: 14px;
  --reader-plugin-bottom-right-bottom: calc(env(safe-area-inset-bottom, 0px) + 14px);
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  box-sizing: border-box;
  position: relative;
  overflow: hidden;
  background-color: var(--reader-bg-color, var(--color-surface));
  background-image: var(--reader-bg-image, none);
  background-size: var(--reader-bg-size, auto);
  background-position: var(--reader-bg-position, 0 0);
  background-repeat: var(--reader-bg-repeat, repeat);
  background-attachment: var(--reader-bg-attachment, scroll);
  background-blend-mode: var(--reader-bg-blend-mode, normal);
  color: var(--reader-text-color, var(--color-text-primary));
  font-synthesis: weight style;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  touch-action: manipulation;
  padding-top: var(--safe-area-inset-top, env(safe-area-inset-top, 0px));
  -webkit-text-size-adjust: none;
  text-size-adjust: none;
}

.reader-modal::before {
  content: var(--reader-shell-title-text);
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: var(--reader-shell-title-z-index);
  display: var(--reader-shell-title-display);
  align-items: center;
  height: var(--reader-shell-title-height);
  box-sizing: border-box;
  padding: var(--reader-shell-title-padding);
  border: var(--reader-shell-title-border);
  background: var(--reader-shell-title-bg);
  color: var(--reader-shell-title-color);
  font: var(--reader-shell-title-font);
  pointer-events: none;
  white-space: pre;
}

/* 右侧窗口控制按钮（最小化 / 最大化 / 关闭），皮肤可通过 --reader-shell-winctrls-* 启用 */
.reader-modal::after {
  content: var(--reader-shell-winctrls-text);
  position: absolute;
  top: 0;
  right: 0;
  z-index: var(--reader-shell-winctrls-z-index);
  display: var(--reader-shell-winctrls-display);
  align-items: center;
  height: var(--reader-shell-winctrls-height);
  box-sizing: border-box;
  background: var(--reader-shell-winctrls-bg);
  color: var(--reader-shell-winctrls-color);
  font: var(--reader-shell-winctrls-font);
  pointer-events: none;
  white-space: pre;
  letter-spacing: 0.04em;
}

.reader-modal__body {
  position: absolute;
  top: var(--reader-body-top);
  right: var(--reader-body-right);
  bottom: var(--reader-body-bottom);
  left: var(--reader-body-left);
  z-index: 1;
  width: auto;
  height: auto;
  max-width: var(--reader-body-max-width);
  margin: var(--reader-body-margin);
  overflow: hidden;
  background: var(--reader-body-surface);
  border: var(--reader-body-border);
  border-radius: var(--reader-body-radius);
  box-shadow: var(--reader-body-shadow);
  backdrop-filter: var(--reader-body-backdrop-filter);
  -webkit-text-size-adjust: none;
  text-size-adjust: none;
}

.reader-modal[data-reader-skin='reader-disguise-skins:notepad'] :deep(.scroll-mode__body),
.reader-modal[data-reader-skin='reader-disguise-skins:notepad-light'] :deep(.scroll-mode__body) {
  padding: var(--reader-padding, 8px 10px 8px);
}

.reader-modal[data-reader-skin='reader-disguise-skins:notepad'] :deep(.scroll-mode__para),
.reader-modal[data-reader-skin='reader-disguise-skins:notepad-light'] :deep(.scroll-mode__para) {
  margin-bottom: 0 !important;
  text-indent: 0 !important;
  white-space: pre-wrap;
}

.reader-modal[data-reader-skin='reader-disguise-skins:notepad'] :deep(.reader-chapter-title),
.reader-modal[data-reader-skin='reader-disguise-skins:notepad-light'] :deep(.reader-chapter-title) {
  display: none;
}

.reader-modal__spin {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.reader-modal__measure-host {
  position: absolute;
  top: var(--reader-body-top);
  right: var(--reader-body-right);
  bottom: var(--reader-body-bottom);
  left: var(--reader-body-left);
  max-width: var(--reader-body-max-width);
  margin: var(--reader-body-margin);
  border-radius: var(--reader-body-radius);
  visibility: hidden;
  pointer-events: none;
  z-index: -1;
}
</style>
