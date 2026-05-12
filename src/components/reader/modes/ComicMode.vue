<script setup lang="ts">
import { eventListen } from '@/composables/useEventBus';
import { toFileSrcSync } from '@/composables/useFileSrc';
/**
 * ComicMode — 漫画阅读模式（纯竖向滚动，显示图片列表）
 *
 * content 格式约定：书源 chapterContent() 返回的文本为 JSON 数组字符串，
 * 例如 `["https://img1.jpg","https://img2.jpg"]`；或以换行分隔的 URL 列表。
 *
 * 支持两种图片加载模式（由 useAppConfig 的 comic_cache_enabled 控制）：
 * - 缓存模式（默认）：前端拿到全部 URL 后立即开始阅读；Rust 后端后台顺序缓存并按页通知前端切换到本地文件
 * - 直读模式：前端直接使用图片 URL，浏览器自动加载
 */
import { storeToRefs } from 'pinia';
import { ref, watch, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useAppConfigStore } from '@/stores';
import { comicDownloadImages, comicGetPageSizes } from '../../../composables/useBookSource';

const props = defineProps<{
  content: string;
  fileName: string;
  chapterUrl: string;
  /** 书籍对应的 bookUrl（用于生成漫画缓存书籍层目录） */
  bookUrl: string;
  /** 书籍显示名称（用于生成可读的缓存目录名） */
  bookName: string;
  /** 当前章节在目录中的序号（0-based） */
  chapterIndex: number;
  hasPrev: boolean;
  hasNext: boolean;
  /** 预加载的上一章图片内容（JSON 数组或换行分隔 URL），空字符串表示尚未加载 */
  prevChapterContent?: string;
  /** 预加载的上一章章节名 */
  prevChapterTitle?: string;
  /** 预加载的下一章图片内容（JSON 数组或换行分隔 URL），空字符串表示尚未加载 */
  nextChapterContent?: string;
  /** 预加载的下一章章节名 */
  nextChapterTitle?: string;
}>();

const emit = defineEmits<{
  (e: 'tap', zone: 'left' | 'center' | 'right'): void;
  (e: 'progress', ratio: number): void;
  (e: 'prevChapter'): void;
  (e: 'nextChapter'): void;
  /** 用户向上滚动进入上一章区域（无缝向前翻章） */
  (e: 'prevChapterEntered'): void;
  /** 用户向下滚动进入下一章区域，携带当前章节内容区高度（用于无缝滚动位置补偿） */
  (e: 'nextChapterEntered', sectionHeight: number): void;
}>();

interface ComicPage {
  remoteUrl: string;
  src: string;
  cachedSrc: string | null;
  loaded: boolean;
  failed: boolean;
  /** 书源需要图片解码时，等待 Rust 后台处理完成，期间不渲染 <img> 避免显示乱序原图 */
  pending: boolean;
  /** Rust 后台经三次重试后仍下载失败，前端可手动触发重新加载 */
  retryFailed: boolean;
}

interface ComicPageCachedPayload {
  file_name: string;
  chapter_url: string;
  page_index: number;
  local_path: string;
}

interface ComicPageFailedPayload {
  file_name: string;
  chapter_url: string;
  page_index: number;
}

const _appCfg = useAppConfigStore();
const { comicCacheEnabled } = storeToRefs(_appCfg);
const containerRef = ref<HTMLDivElement | null>(null);
const pages = ref<ComicPage[]>([]);
/** 每页原始像素尺寸（来自 Rust 后端 _sizes.json 缓存），用于在图片加载前即设定正确 aspect-ratio */
const pageSizes = ref<Array<[number, number] | null>>([]);
const visibleImages = ref<Set<number>>(new Set());
const loading = ref(false);
const error = ref('');
let loadVersion = 0;
let unlistenComicPageCached: (() => void) | null = null;
let unlistenComicPageFailed: (() => void) | null = null;
let observer: IntersectionObserver | null = null;
let restoreCorrectionRaf = 0;

const currentSectionRef = ref<HTMLDivElement | null>(null);
const prevSectionRef = ref<HTMLDivElement | null>(null);
const nextSectionRef = ref<HTMLDivElement | null>(null);
const nextChapterSentinelRef = ref<HTMLDivElement | null>(null);
const prevPages = ref<ComicPage[]>([]);
const nextPages = ref<ComicPage[]>([]);

// ── 无缝切章 ────────────────────────────────────────────────────────
let seamlessSwapAnchorOffset: number | null = null;
let seamlessSwapFallbackOffset = -1;
/** 向上无缝翻章标志：不重置 scrollTop */
let isBackwardSeamless = false;
/** 上一章进入事件是否已触发（每次 prevContent 变化后重置） */
let prevChapterEnteredFired = false;
const atTop = ref(true);
const atBottom = ref(false);
let prevBoundaryFallbackFired = false;
let nextBoundaryFallbackFired = false;

function prepareSeamlessSwap(prevSectionHeight: number) {
  const el = containerRef.value;
  const nextTop = nextSectionRef.value?.offsetTop ?? nextChapterSentinelRef.value?.offsetTop;
  if (el && typeof nextTop === 'number') {
    seamlessSwapAnchorOffset = el.scrollTop - nextTop;
    seamlessSwapFallbackOffset = -1;
    return;
  }
  seamlessSwapAnchorOffset = null;
  seamlessSwapFallbackOffset = prevSectionHeight;
}

function prepareSeamlessSwapBack() {
  isBackwardSeamless = true;
}

// ── 哨兵观察器（独立于图片懒加载 observer） ────────────────────────
let sentinelObserver: IntersectionObserver | null = null;

function teardownSentinel() {
  sentinelObserver?.disconnect();
  sentinelObserver = null;
}

function setupSentinel() {
  teardownSentinel();
  const el = nextChapterSentinelRef.value;
  const root = containerRef.value;
  if (!el || !root) {
    return;
  }
  sentinelObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const rootEl = containerRef.value;
          const nextTop = nextSectionRef.value?.offsetTop ?? nextChapterSentinelRef.value?.offsetTop;
          if (rootEl && typeof nextTop === 'number' && rootEl.scrollTop < nextTop - 1) {
            return;
          }
          teardownSentinel();
          const sectionH = currentSectionRef.value?.offsetHeight ?? 0;
          emit('nextChapterEntered', sectionH);
        }
      }
    },
    { root, rootMargin: '0px 0px -40% 0px' },
  );
  sentinelObserver.observe(el);
}

/** loadImages 完成时 resolve，供 restoreToScrollRatio 等待数据就绪 */
let loadResolve: (() => void) | null = null;
let loadComplete: Promise<void> = Promise.resolve();

/** 解析 content 为图片 URL 数组 */
function parseImageUrls(raw: string): string[] {
  const trimmed = raw.trim();
  // 尝试 JSON 数组
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed);
      if (Array.isArray(arr)) {
        return arr.filter((u: unknown) => typeof u === 'string' && u.length > 0);
      }
    } catch {
      /* fallback */
    }
  }
  // 换行分隔
  return trimmed
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.startsWith('http'));
}

function isDirectSrc(src: string): boolean {
  return (
    /^(https?:)?\/\//i.test(src) ||
    src.startsWith('data:') ||
    src.startsWith('blob:') ||
    src.startsWith('asset:')
  );
}

function toRenderableSrc(src: string): string {
  return isDirectSrc(src) ? src : toFileSrcSync(src);
}

function createPages(urls: string[]): ComicPage[] {
  return urls.map((url) => ({
    remoteUrl: url,
    src: url,
    cachedSrc: null,
    loaded: false,
    failed: false,
    pending: false,
    retryFailed: false,
  }));
}

function resetPages(urls: string[]) {
  // 换章时清除旧观察，避免已从 DOM 移除的元素持续占用 observer 内存
  observer?.disconnect();
  visibleImages.value = new Set();
  pageSizes.value = [];
  pages.value = createPages(urls);
}

function applyResolvedSources(sources: string[]) {
  for (const [idx, source] of sources.entries()) {
    const page = pages.value[idx];
    if (!page) {
      continue;
    }
    // 空字符串表示该页需要解码，Rust 暂不提供原始 URL，等待 comic:page-cached 事件
    if (source === '') {
      page.pending = true;
      continue;
    }
    const renderable = toRenderableSrc(source);
    page.cachedSrc = renderable === page.remoteUrl ? null : renderable;
    if (page.src !== renderable) {
      page.src = renderable;
      page.loaded = false;
      page.failed = false;
    }
  }
}

function applyCachedPage(pageIndex: number, localPath: string) {
  const page = pages.value[pageIndex];
  if (!page) {
    return;
  }

  const localSrc = toRenderableSrc(localPath);
  page.cachedSrc = localSrc;

  if (page.pending) {
    // 解码完成：解除占位，切换到处理后的本地文件
    page.pending = false;
    page.src = localSrc;
    page.loaded = false;
    page.failed = false;
  } else if (!page.loaded || page.failed) {
    // 仅在该页还未成功显示，或之前加载失败时切换到本地缓存，避免已显示的远程图片再次闪烁重载。
    page.src = localSrc;
    page.loaded = false;
    page.failed = false;
  }

  scheduleRestoreCorrection();
}

/** 加载图片（根据缓存开关选择模式） */
async function loadImages() {
  const currentVersion = ++loadVersion;
  const urls = parseImageUrls(props.content);
  error.value = '';

  // 创建新的 loadComplete Promise，供 restoreToScrollRatio 等待
  loadResolve?.();
  loadComplete = new Promise<void>((resolve) => {
    loadResolve = resolve;
  });

  if (urls.length === 0) {
    loading.value = false;
    pages.value = [];
    pageSizes.value = [];
    loadResolve?.();
    return;
  }

  // 先把整章 URL 放给页面，确保只要拿到图片列表就能开始阅读。
  resetPages(urls);

  // 直读模式：不经过 Rust 后端，直接使用原始 URL
  if (!comicCacheEnabled.value) {
    loading.value = false;
    loadResolve?.();
    return;
  }

  // 缓存模式：立即返回“已缓存本地路径 + 未缓存远程 URL”的混合结果，
  // 同时由 Rust 后端继续后台顺序下载，并通过事件逐页通知前端替换。
  loading.value = true;
  try {
    const resolvedSources = await comicDownloadImages(
      props.fileName,
      props.bookUrl,
      props.bookName,
      props.chapterUrl,
      props.chapterIndex,
      urls,
    );
    if (currentVersion !== loadVersion) {
      return;
    }
    applyResolvedSources(resolvedSources);

    // 查询后端缓存的每页原始像素尺寸，用于在图片加载前设定正确的 aspect-ratio
    try {
      const sizes = await comicGetPageSizes(
        props.fileName,
        props.bookUrl,
        props.bookName,
        props.chapterIndex,
      );
      if (currentVersion === loadVersion) {
        pageSizes.value = sizes;
      }
    } catch {
      // 查询失败不影响正常阅读，pageSizes 保持空数组，DOM 使用默认 3:4 占位
    }
  } catch (e: unknown) {
    if (currentVersion !== loadVersion) {
      return;
    }
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    if (currentVersion === loadVersion) {
      loading.value = false;
      loadResolve?.();
    }
  }
}

watch(
  () => [props.content, props.fileName, props.chapterUrl, comicCacheEnabled.value],
  async () => {
    const anchorOffset = seamlessSwapAnchorOffset;
    const fallbackOffset = seamlessSwapFallbackOffset;
    seamlessSwapAnchorOffset = null;
    seamlessSwapFallbackOffset = -1;
    const backward = isBackwardSeamless;
    isBackwardSeamless = false;
    prevChapterEnteredFired = false;
    prevBoundaryFallbackFired = false;
    nextBoundaryFallbackFired = false;
    atTop.value = true;
    atBottom.value = false;

    await loadImages();

    const el = containerRef.value;
    if (!el) {
      return;
    }

    if (anchorOffset !== null || fallbackOffset >= 0) {
      // 向下无缝翻章：恢复到进入下一章时的相对位置，避免章节高度变化导致瞬移。
      await nextTick();
      if (anchorOffset !== null) {
        const currentTop = currentSectionRef.value?.offsetTop ?? 0;
        el.scrollTop = Math.max(0, currentTop + anchorOffset);
      } else {
        el.scrollTop = Math.max(0, el.scrollTop - fallbackOffset);
      }
    } else if (backward) {
      // 向上无缝翻章：旧上一章内容现在是 current，位置不变
    } else {
      // 普通翻章：滚到当前章节起始（跳过上方预渲染的上一章区域）
      await nextTick();
      el.scrollTop = prevSectionRef.value?.offsetHeight ?? 0;
    }
  },
  { immediate: true },
);

// ── 上一章内容变化：预渲染到顶部，补偿 scrollTop ─────────────────────────
watch(
  () => props.prevChapterContent,
  async (val, oldVal) => {
    const wasEmpty = !oldVal;
    const isNowFilled = !!val;
    prevPages.value = val ? createPages(parseImageUrls(val)) : [];
    prevChapterEnteredFired = false;
    prevBoundaryFallbackFired = false;

    if (wasEmpty && isNowFilled) {
      const el = containerRef.value;
      const savedTop = el?.scrollTop ?? 0;
      await nextTick();
      const prevH = prevSectionRef.value?.offsetHeight ?? 0;
      if (prevH > 0 && el) {
        el.scrollTop = savedTop + prevH;
      }
    }
  },
  { immediate: true },
);

// ── 下一章内容变化 ──────────────────────────────────────────────────
watch(
  () => props.nextChapterContent,
  async (val) => {
    nextPages.value = val ? createPages(parseImageUrls(val)) : [];
    nextBoundaryFallbackFired = false;
    teardownSentinel();
    if (val) {
      await nextTick();
      setupSentinel();
    }
  },
  { immediate: true },
);

/* ── 滚动状态 ── */

function onScroll() {
  const el = containerRef.value;
  if (!el) {
    return;
  }
  const { scrollTop, scrollHeight, clientHeight } = el;
  const prevH = prevSectionRef.value?.offsetHeight ?? 0;
  const nextTop = nextSectionRef.value?.offsetTop ?? Number.POSITIVE_INFINITY;

  // 进度按当前章节区域计算（不含上/下章预渲染部分）
  const currentSectionH = currentSectionRef.value?.offsetHeight ?? Math.max(0, scrollHeight - prevH);
  const adjustedScrollTop = Math.max(0, scrollTop - prevH);
  const ratio =
    currentSectionH <= clientHeight
      ? 1
      : adjustedScrollTop / (currentSectionH - clientHeight);
  emit('progress', Math.min(1, Math.max(0, ratio)));

  const prevAtTop = atTop.value;
  const prevAtBottom = atBottom.value;
  atTop.value = scrollTop <= 0;
  atBottom.value = scrollTop + clientHeight >= scrollHeight - 8;

  if (!atTop.value) {
    prevBoundaryFallbackFired = false;
  }
  if (!atBottom.value) {
    nextBoundaryFallbackFired = false;
  }

  // 检测向上翻章：滚到上一章区域前 60% 时触发一次
  if (!prevChapterEnteredFired && prevH > 0 && hasPrevChapterContent.value) {
    if (scrollTop <= prevH * 0.6) {
      prevChapterEnteredFired = true;
      emit('prevChapterEntered');
    }
  }

  if (
    !nextBoundaryFallbackFired &&
    hasNextChapterContent.value &&
    props.hasNext &&
    scrollTop >= nextTop - 1
  ) {
    nextBoundaryFallbackFired = true;
    emit('nextChapterEntered', currentSectionRef.value?.offsetHeight ?? 0);
  }

  if (
    !prevBoundaryFallbackFired &&
    !hasPrevChapterContent.value &&
    props.hasPrev &&
    !prevAtTop &&
    atTop.value
  ) {
    prevBoundaryFallbackFired = true;
    emit('prevChapterEntered');
  }

  if (
    !nextBoundaryFallbackFired &&
    !hasNextChapterContent.value &&
    props.hasNext &&
    !prevAtBottom &&
    atBottom.value
  ) {
    nextBoundaryFallbackFired = true;
    emit('nextChapterEntered', currentSectionRef.value?.offsetHeight ?? 0);
  }
}

/* ── 触控区域 ── */
function onTapContainer() {
  emit('tap', 'center');
}

onBeforeUnmount(() => {
  teardownSentinel();
});

/* ── 图片懒加载观察器 ── */
function setupObserver() {
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const idx = Number((entry.target as HTMLElement).dataset.idx);
        if (entry.isIntersecting) {
          visibleImages.value.add(idx);
        } else {
          visibleImages.value.delete(idx);
        }
      }
    },
    { root: containerRef.value, rootMargin: '200px 0px' },
  );
}

const shouldShow = (idx: number) => visibleImages.value.has(idx);

function updatePageNaturalSize(idx: number, img: HTMLImageElement) {
  if (pageSizes.value[idx]) {
    return;
  }
  if (img.naturalWidth <= 0 || img.naturalHeight <= 0) {
    return;
  }
  const next = [...pageSizes.value];
  next[idx] = [img.naturalWidth, img.naturalHeight];
  pageSizes.value = next;
}

function scheduleRestoreCorrection() {
  if (!isRestoring.value || restoreRatio.value < 0) {
    return;
  }
  cancelAnimationFrame(restoreCorrectionRaf);
  restoreCorrectionRaf = requestAnimationFrame(() => {
    scrollToRatio(restoreRatio.value);
  });
}

function onImageLoad(idx: number, event: Event) {
  const page = pages.value[idx];
  if (!page) {
    return;
  }
  updatePageNaturalSize(idx, event.target as HTMLImageElement);
  page.loaded = true;
  page.failed = false;
  scheduleRestoreCorrection();
}

function onImageError(idx: number) {
  const page = pages.value[idx];
  if (!page) {
    return;
  }

  if (page.cachedSrc && page.src !== page.cachedSrc) {
    page.src = page.cachedSrc;
    page.loaded = false;
    page.failed = false;
    return;
  }

  page.failed = true;
  page.loaded = false;
}

onMounted(async () => {
  setupObserver();
  // 关键修复：Vue 3 的 :ref 回调在 onMounted 之前执行，彼时 observer 尚为 null，
  // 导致初次渲染的页面元素全部未被注册。在 observer 创建后立即补扫 DOM，
  // 确保直读模式（同步完成）和所有图片已缓存（立即 resolve）等场景均能正确显示图片。
  containerRef.value?.querySelectorAll<HTMLElement>('.comic-mode__page').forEach((el, i) => {
    el.dataset.idx = String(i);
    observer?.observe(el);
  });
  unlistenComicPageCached = await eventListen<ComicPageCachedPayload>(
    'comic:page-cached',
    (event) => {
      const { payload } = event;
      if (payload.file_name !== props.fileName || payload.chapter_url !== props.chapterUrl) {
        return;
      }
      applyCachedPage(payload.page_index, payload.local_path);
    },
  );

  unlistenComicPageFailed = await eventListen<ComicPageFailedPayload>(
    'comic:page-failed',
    (event) => {
      const { payload } = event;
      if (payload.file_name !== props.fileName || payload.chapter_url !== props.chapterUrl) {
        return;
      }
      const page = pages.value[payload.page_index];
      if (page) {
        page.retryFailed = true;
        page.failed = true;
      }
    },
  );
});
onBeforeUnmount(() => {
  cancelAnimationFrame(restoreCorrectionRaf);
  observer?.disconnect();
  unlistenComicPageCached?.();
  unlistenComicPageFailed?.();
});

/** 注册图片元素到观察器 */
function observeImg(el: Element | null, idx: number) {
  if (el && observer) {
    (el as HTMLElement).dataset.idx = String(idx);
    observer.observe(el);
  }
}

/* ── 页码显示（0-based，与其他翻页模式保持一致） ── */
const currentPage = computed(() => {
  const sorted = [...visibleImages.value].toSorted((a: number, b: number) => a - b);
  return sorted.length > 0 ? sorted[0] : 0;
});
const totalPages = computed(() => pages.value.length);
const currentPageDisplay = computed(() => (totalPages.value > 0 ? currentPage.value + 1 : 0));

/**
 * 跳到指定图片页（0-based），通过 offsetTop 瞬间定位，
 * 不依赖 scrollHeight（受未加载图片高度影响），更加稳定。
 */
function goToPage(idx: number) {
  const container = containerRef.value;
  if (!container) {
    return;
  }
  const pageEls = container.querySelectorAll<HTMLElement>('.comic-mode__page');
  const target = pageEls[idx];
  if (target) {
    container.scrollTop = target.offsetTop;
  }
}

function getScrollRatio(): number {
  return getReadingScrollRatio();
}

function getReadingChapterOffset(): number {
  const el = containerRef.value;
  if (!el) {
    return 0;
  }
  const currentTop = currentSectionRef.value?.offsetTop ?? 0;
  const nextTop = nextSectionRef.value?.offsetTop ?? Number.POSITIVE_INFINITY;
  if (hasPrevChapterContent.value && el.scrollTop < currentTop - 1) {
    return -1;
  }
  if (hasNextChapterContent.value && el.scrollTop >= nextTop - 1) {
    return 1;
  }
  return 0;
}

function getSectionRatio(section: HTMLElement | null): number {
  const el = containerRef.value;
  if (!el || !section) {
    return -1;
  }
  const sectionTop = section.offsetTop;
  const sectionHeight = section.offsetHeight;
  const adjustedScrollTop = Math.max(0, el.scrollTop - sectionTop);
  const max = Math.max(0, sectionHeight - el.clientHeight);
  return max <= 0 ? 1 : Math.min(1, Math.max(0, adjustedScrollTop / max));
}

function getReadingScrollRatio(): number {
  const offset = getReadingChapterOffset();
  if (offset < 0) {
    return getSectionRatio(prevSectionRef.value);
  }
  if (offset > 0) {
    return getSectionRatio(nextSectionRef.value);
  }
  return getSectionRatio(currentSectionRef.value);
}

function getAdjacentScrollRatio(side: 'prev' | 'next'): number {
  return side === 'prev' ? getSectionRatio(prevSectionRef.value) : getSectionRatio(nextSectionRef.value);
}

function getPageIndexWithin(section: HTMLElement | null): number {
  const container = containerRef.value;
  if (!container || !section) {
    return 0;
  }
  const pageEls = section.querySelectorAll<HTMLElement>('.comic-mode__page');
  if (pageEls.length === 0) {
    return 0;
  }
  const containerTop = container.getBoundingClientRect().top;
  for (let i = 0; i < pageEls.length; i++) {
    const rect = pageEls[i]?.getBoundingClientRect();
    if (!rect) {
      continue;
    }
    if (rect.bottom > containerTop + 1) {
      return i;
    }
  }
  return Math.max(0, pageEls.length - 1);
}

function getReadingPageIndex(): number {
  const offset = getReadingChapterOffset();
  if (offset < 0) {
    return getPageIndexWithin(prevSectionRef.value);
  }
  if (offset > 0) {
    return getPageIndexWithin(nextSectionRef.value);
  }
  return currentPage.value;
}

function getAdjacentPageIndex(side: 'prev' | 'next'): number {
  return side === 'prev' ? getPageIndexWithin(prevSectionRef.value) : getPageIndexWithin(nextSectionRef.value);
}

/** 是否正在恢复阅读位置（显示 loading 遮罩期间为 true） */
const isRestoring = ref(false);
const restoreRatio = ref(-1);

/** 获取指定页的内联样式：如果有缓存尺寸则使用真实 aspect-ratio，否则不设置（CSS 默认 3:4） */
function pageStyle(idx: number): Record<string, string> {
  const size = pageSizes.value[idx];
  if (size) {
    const [w, h] = size;
    if (w > 0 && h > 0) {
      return { aspectRatio: `${w} / ${h}` };
    }
  }
  return {};
}

/**
 * 恢复到指定滚动比例（0-1）。
 *
 * 实现思路：
 * 1. 显示 loading 遮罩
 * 2. 等待 loadImages 完成（确保 pageSizes 已应用到 DOM，布局高度接近最终值）
 * 3. 等 Vue 渲染 + 浏览器排版完成
 * 4. 按比例设置 scrollTop = ratio × (scrollHeight - clientHeight)
 * 5. 隐藏遮罩
 *
 * 因为 pageSizes 已在 DOM 上通过 aspect-ratio 撑起正确高度，
 * 布局在图片加载前就已接近最终状态，scrollRatio 恢复精度高。
 */
async function restoreToScrollRatio(ratio: number) {
  if (ratio < 0) {
    return;
  }

  isRestoring.value = true;
  restoreRatio.value = Math.min(1, Math.max(0, ratio));
  try {
    // 等待 loadImages 完成（pageSizes 已获取并应用）
    await loadComplete;
    // 等 Vue 将 pageSizes 变化渲染到 DOM
    await nextTick();
    // 等浏览器完成布局重排
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    scrollToRatio(restoreRatio.value);

    // 图片尺寸探测和缓存替换可能在后续几帧内继续影响 scrollHeight。
    // 恢复期锁定比例反复校正，避免定位完成后出现肉眼可见的细微漂移。
    let stableFrames = 0;
    let lastScrollHeight = -1;
    for (let i = 0; i < 12; i++) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const el = containerRef.value;
      if (!el) {
        break;
      }
      scrollToRatio(restoreRatio.value);
      if (Math.abs(el.scrollHeight - lastScrollHeight) < 1) {
        stableFrames += 1;
        if (stableFrames >= 3) {
          break;
        }
      } else {
        stableFrames = 0;
        lastScrollHeight = el.scrollHeight;
      }
    }
  } finally {
    restoreRatio.value = -1;
    isRestoring.value = false;
  }
}

/**
 * 按比例直接设置滚动位置（0-1），无遮罩无延迟，供 resize 后快速修正使用。
 * 与 restoreToScrollRatio 的区别：不等待 loadImages，不显示遮罩，直接设置 scrollTop。
 */
function scrollToRatio(ratio: number) {
  const el = containerRef.value;
  if (!el || ratio < 0) {
    return;
  }
  const prevH = prevSectionRef.value?.offsetHeight ?? 0;
  const currentH = currentSectionRef.value?.offsetHeight ?? Math.max(0, el.scrollHeight - prevH);
  const maxScroll = Math.max(0, currentH - el.clientHeight);
  el.scrollTop = prevH + ratio * maxScroll;
}

/** 手动重新加载某页（后台下载失败后用户触发） */
async function retryPage(idx: number) {
  const page = pages.value[idx];
  if (!page) {
    return;
  }
  // 重置该页状态，让占位继续显示为加载中
  page.retryFailed = false;
  page.failed = false;
  page.loaded = false;
  // 重新触发整章下载：已缓存的页会被跳过，仅重试失败的页
  try {
    const resolvedSources = await comicDownloadImages(
      props.fileName,
      props.bookUrl,
      props.bookName,
      props.chapterUrl,
      props.chapterIndex,
      pages.value.map((p) => p.remoteUrl),
    );
    applyResolvedSources(resolvedSources);
  } catch {
    // 重新触发失败，再次标记为失败让用户可以再试
    if (pages.value[idx]) {
      pages.value[idx].retryFailed = true;
      pages.value[idx].failed = true;
    }
  }
}

const hasPrevChapterContent = computed(() => !!props.prevChapterContent);
const hasNextChapterContent = computed(() => !!props.nextChapterContent);
/** 无下一章且无预加载内容时显示结束画面 */
const showEndScreen = computed(() => !props.hasNext && !hasNextChapterContent.value);

defineExpose({
  goToPage,
  restoreToScrollRatio,
  scrollToRatio,
  getScrollRatio,
  getReadingChapterOffset,
  getReadingScrollRatio,
  getReadingPageIndex,
  getAdjacentScrollRatio,
  getAdjacentPageIndex,
  prepareSeamlessSwap,
  prepareSeamlessSwapBack,
  get currentPage() {
    return currentPage.value;
  },
  get totalPages() {
    return totalPages.value;
  },
});
</script>

<template>
  <div
    ref="containerRef"
    class="comic-mode"
    @click="onTapContainer"
    @scroll.passive="onScroll"
  >
    <div v-if="loading && totalPages === 0" class="comic-mode__loading">
      <n-spin size="large" />
      <span>加载图片中...</span>
    </div>

    <div v-else-if="error && totalPages === 0" class="comic-mode__error">
      <n-alert type="warning" :title="error" />
    </div>

    <template v-else>
      <div v-if="error" class="comic-mode__error comic-mode__error--inline">
        <n-alert type="warning" :title="error" />
      </div>

      <!-- ── 上一章预览区域（顶部预渲染，无缝向上翻章） ── -->
      <template v-if="hasPrevChapterContent">
        <div ref="prevSectionRef">
          <div
            v-for="(page, idx) in prevPages"
            :key="`prev-${idx}`"
            class="comic-mode__page comic-mode__page--prev"
          >
            <img
              :src="page.src"
              :alt="`上一章第 ${idx + 1} 页`"
              class="comic-mode__img comic-mode__img--ready"
              loading="lazy"
            />
          </div>
        </div>
        <!-- 章节分隔线（上一章 → 当前章） -->
        <div class="comic-mode__chapter-sep">
          <div class="comic-mode__chapter-sep-line" />
          <p class="comic-mode__chapter-sep-title">{{ prevChapterTitle || '上一章' }}结束</p>
        </div>
      </template>

      <!-- ── 当前章节页面展示区域 ── -->
      <div ref="currentSectionRef">
        <div
          v-for="(page, idx) in pages"
          :key="idx"
          :ref="(el) => observeImg(el as Element, idx)"
          class="comic-mode__page"
          :style="pageStyle(idx)"
        >
          <template v-if="shouldShow(idx)">
            <!-- 书源需要解码时显示占位，等待 Rust 处理完成 -->
            <template v-if="page.pending">
              <div class="comic-mode__placeholder comic-mode__placeholder--overlay">
                <n-spin size="small" />
                <span>第 {{ idx + 1 }} 页解码中...</span>
              </div>
            </template>
            <template v-else>
              <img
                :src="page.src"
                :alt="`第 ${idx + 1} 页`"
                :class="['comic-mode__img', { 'comic-mode__img--ready': page.loaded }]"
                loading="lazy"
                @load="onImageLoad(idx, $event)"
                @error="onImageError(idx)"
              />
              <div
                v-if="!page.loaded"
                class="comic-mode__placeholder comic-mode__placeholder--overlay"
              >
                <n-spin v-if="!page.failed" size="small" />
                <template v-if="page.retryFailed">
                  <span class="comic-mode__fail-text">第 {{ idx + 1 }} 页下载失败</span>
                  <n-button
                    size="small"
                    type="primary"
                    style="margin-top: 4px"
                    @click.stop="retryPage(idx)"
                  >
                    重新加载
                  </n-button>
                </template>
                <span v-else>{{ page.failed ? '图片加载失败' : `第 ${idx + 1} 页加载中...` }}</span>
              </div>
            </template>
          </template>
          <div v-else class="comic-mode__placeholder">
            {{ idx + 1 }}
          </div>
        </div>

        <!-- 底部提示（无下一章预加载时显示） -->
        <div v-if="!hasNextChapterContent" class="comic-mode__footer">
          <span v-if="!hasNext">已是最后一章</span>
          <span v-else class="comic-mode__footer-hint">继续滚动加载下一章</span>
        </div>
      </div>

      <!-- ── 下一章预览区域（无缝拼接） ── -->
      <template v-if="hasNextChapterContent">
        <!-- 章节分隔线 + 标题 -->
        <div class="comic-mode__chapter-sep">
          <div class="comic-mode__chapter-sep-line" />
          <p class="comic-mode__chapter-sep-title">{{ nextChapterTitle || '下一章' }}</p>
        </div>
        <!-- 哨兵元素：进入视口时触发章节切换 -->
        <div ref="nextChapterSentinelRef" class="comic-mode__sentinel" aria-hidden="true" />
        <!-- 下一章图片（直接显示，不经过内容缓存） -->
        <div ref="nextSectionRef">
          <div
            v-for="(page, idx) in nextPages"
            :key="`next-${idx}`"
            class="comic-mode__page comic-mode__page--next"
          >
            <img
              :src="page.src"
              :alt="`下一章第 ${idx + 1} 页`"
              class="comic-mode__img comic-mode__img--ready"
              loading="lazy"
            />
          </div>
        </div>
      </template>

      <!-- ── 结束画面（无下一章） ── -->
      <div v-if="showEndScreen" class="chapter-end-screen">
        <div class="chapter-end-screen__icon">📖</div>
        <p class="chapter-end-screen__title">已读完最后一章</p>
        <p class="chapter-end-screen__sub">全书完，感谢阅读</p>
      </div>
    </template>

    <!-- 恢复阅读位置遮罩：等待目标页上方图片加载完毕期间显示，防止画面跳动 -->
    <div v-if="isRestoring" class="comic-mode__restore-overlay">
      <n-spin size="large" />
      <span>正在定位阅读位置...</span>
    </div>

    <!-- 页码指示器 -->
    <div v-if="totalPages > 0" class="comic-mode__indicator">
      {{ currentPageDisplay }} / {{ totalPages }}
    </div>
  </div>
</template>

<style scoped>
.comic-mode {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  /* 漫画背景必须固定白色，避免透明漫画在深色主题/皮肤下出现脏底。 */
  background: #ffffff;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: contain;
  /* 禁用浏览器自动滚动锚定，改为手动精确补偿 */
  overflow-anchor: none;
}

.comic-mode__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  color: var(--color-text-muted);
}

.comic-mode__error {
  padding: 24px;
}

.comic-mode__page {
  position: relative;
  width: 100%;
  /* 预留 3:4 宽高比空间，图片加载前就占位，避免加载后布局抖动 */
  min-height: 200px;
  aspect-ratio: 3 / 4;
  display: flex;
  align-items: center;
  justify-content: center;
  /* 配合 overflow-anchor：每个页面块参与锚定计算 */
  overflow-anchor: auto;
}

/* 图片加载完毕后撑开为实际高度，取消固定宽高比 */
.comic-mode__page:has(.comic-mode__img--ready) {
  aspect-ratio: auto;
  min-height: 0;
}

.comic-mode__img {
  width: 100%;
  height: auto;
  display: block;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
  opacity: 0;
  transition: opacity 0.16s ease;
}

.comic-mode__img--ready {
  opacity: 1;
}

.comic-mode__placeholder {
  width: 100%;
  height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  font-size: 1.5rem;
  opacity: 0.3;
}

.comic-mode__placeholder--overlay {
  position: absolute;
  inset: 0;
  height: auto;
  gap: 10px;
  flex-direction: column;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.92));
  font-size: 0.95rem;
  opacity: 1;
}

.comic-mode__fail-text {
  color: #ff7875;
  font-size: 0.9rem;
}

.comic-mode__error--inline {
  padding: 16px 16px 0;
}

.comic-mode__footer {
  padding: 16px 24px 28px;
  text-align: center;
  color: rgba(32, 32, 32, 0.55);
  font-size: 0.875rem;
}

.comic-mode__footer-hint {
  opacity: 0.45;
  font-size: 0.78rem;
}

.comic-mode__indicator {
  position: fixed;
  bottom: 16px;
  right: 16px;
  background: rgba(255, 255, 255, 0.88);
  color: #fff;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.75rem;
  pointer-events: none;
  z-index: 20;
}

.comic-mode__restore-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  background: rgba(255, 255, 255, 0.92);
  color: rgba(32, 32, 32, 0.7);
  font-size: 0.9rem;
  z-index: 30;
  pointer-events: all;
}

/* 章节分隔 */
.comic-mode__chapter-sep {
  padding: 22px 24px 8px;
  text-align: center;
}

.comic-mode__chapter-sep-line {
  width: min(180px, 46vw);
  height: 2px;
  margin: 0 auto 14px;
  border-radius: 999px;
  background: linear-gradient(to right, rgba(0, 0, 0, 0.04), rgba(0, 0, 0, 0.18), rgba(0, 0, 0, 0.04));
}

.comic-mode__chapter-sep-title {
  text-align: center;
  color: rgba(28, 28, 28, 0.7);
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  padding: 0 12px 6px;
  text-transform: uppercase;
}

/* 哨兵 */
.comic-mode__sentinel {
  height: 0;
  overflow: hidden;
  pointer-events: none;
}
</style>
