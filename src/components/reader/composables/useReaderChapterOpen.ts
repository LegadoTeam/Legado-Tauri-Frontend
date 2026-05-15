import { nextTick, type ComputedRef, type Ref } from 'vue';
import type { ChapterItem } from '@/stores';
import type { usePagedChapterCache } from './usePagedChapterCache';
import type { ReadingAnchor, PageMeta } from './usePagination';
import {
  clampReaderRatio,
  type ReaderPositionMode,
  type ReaderPositionSnapshot,
  type ReaderProgressPayload,
} from './useReaderPosition';

export type ChapterOpenPosition = 'first' | 'last' | 'resume';

export interface OpenChapterOptions {
  position?: ChapterOpenPosition;
  pageIndex?: number;
  pageRatio?: number;
  forceNetwork?: boolean;
  anchor?: ReadingAnchor;
}

interface ComicModeApi {
  goToPage?: (page: number) => void;
  restoreToScrollRatio?: (ratio: number) => Promise<void>;
  scrollToRatio?: (ratio: number) => void;
  getScrollRatio?: () => number;
  currentPage?: number;
  totalPages?: number;
}

interface ScrollModeApi {
  scrollToRatio?: (ratio: number) => void;
  scrollToParagraph?: (index: number) => void;
  scrollToReadingAnchor?: (anchor: number) => void;
  restoreToReadingAnchor?: (anchor: number) => Promise<void>;
  getScrollRatio?: () => number;
}

interface UseReaderChapterOpenOptions {
  getShow: () => boolean;
  getChapterCount: () => number;
  getShelfDataReady: () => Promise<void> | null;
  getChapter: (index: number) => ChapterItem | undefined;
  isPagedMode: ComputedRef<boolean>;
  isComicMode: ComputedRef<boolean>;
  isScrollMode: ComputedRef<boolean>;
  isVideoMode: ComputedRef<boolean>;
  activeChapterIndex: Ref<number>;
  content: Ref<string>;
  error: Ref<string>;
  loading: Ref<boolean>;
  pagedLoading: Ref<boolean>;
  currentPageIndex: Ref<number>;
  currentScrollRatio: Ref<number>;
  pendingRestorePageIndex: Ref<number>;
  pendingRestoreScrollRatio: Ref<number>;
  pendingResumePlaybackTime: Ref<number>;
  openingChapter: Ref<boolean>;
  restoringPosition: Ref<boolean>;
  navDirection: Ref<'forward' | 'backward'>;
  currentShelfId: ComputedRef<string | undefined>;
  pagedCache: ReturnType<typeof usePagedChapterCache>;
  scrollModeRef: Ref<ScrollModeApi | null>;
  comicModeRef: Ref<ComicModeApi | null>;
  fetchProcessedChapterText: (
    index: number,
    finalStage: 'reader.content.beforePaginate' | 'reader.content.beforeRender',
    forceNetwork?: boolean,
  ) => Promise<string>;
  setPagedPage: (page: number) => void;
  markChapterRead: (index: number) => void;
  updateReaderSession: (snapshot: Record<string, unknown>) => Promise<unknown>;
  buildReaderSessionSnapshot: (
    overrides?: Partial<Record<string, unknown>>,
  ) => Record<string, unknown>;
  getPositionMode: () => ReaderPositionMode;
  writePositionSnapshot: (snapshot: ReaderPositionSnapshot) => void;
  buildProgressPayload: (snapshot?: ReaderPositionSnapshot) => ReaderProgressPayload;
  updateProgress: (
    shelfId: string,
    index: number,
    chapterUrl: string,
    payload: ReaderProgressPayload,
  ) => Promise<unknown>;
  waitForLinearSeamlessWindowStable: (index: number) => Promise<void>;
  reportLoadError: (message: string) => void;
  clearRepaginateWork: () => void;
}

function findPageByAnchorFromMetas(
  anchor: ReadingAnchor,
  metas: PageMeta[],
  total: number,
): number {
  if (total <= 0) {
    return 0;
  }
  if (total === 1) {
    return 0;
  }

  if (anchor.charOffset >= 0 && metas.length > 0) {
    let best = 0;
    for (let i = 0; i < metas.length; i++) {
      if (metas[i].charOffset <= anchor.charOffset) {
        best = i;
      } else {
        break;
      }
    }
    return Math.min(best, total - 1);
  }

  if (anchor.paragraphIndex >= 0 && metas.length > 0) {
    let best = 0;
    for (let i = 0; i < metas.length; i++) {
      const meta = metas[i];
      if (
        meta.paragraphIndex < anchor.paragraphIndex ||
        (meta.paragraphIndex === anchor.paragraphIndex &&
          meta.paragraphCharOffset <= anchor.paragraphCharOffset)
      ) {
        best = i;
      } else if (meta.paragraphIndex > anchor.paragraphIndex) {
        break;
      }
    }
    return Math.min(best, total - 1);
  }

  if (anchor.ratio >= 0) {
    return Math.min(Math.round(anchor.ratio * (total - 1)), total - 1);
  }

  return 0;
}

function waitUntilReady(getter: () => unknown, maxFrames = 60): Promise<boolean> {
  return new Promise((resolve) => {
    let frames = 0;
    const check = () => {
      if (getter() !== undefined) {
        resolve(true);
        return;
      }
      if (++frames >= maxFrames) {
        resolve(false);
        return;
      }
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  });
}

export function useReaderChapterOpen(options: UseReaderChapterOpenOptions) {
  let openChapterToken = 0;
  let warmAdjacentToken = 0;
  let openChapterSequence = 0;

  function consumeLinearRestore(openOptions: OpenChapterOptions): {
    pageIndex: number;
    scrollRatio: number;
  } {
    let pageIndex = options.pendingRestorePageIndex.value;
    let scrollRatio = options.pendingRestoreScrollRatio.value;
    options.pendingRestorePageIndex.value = -1;
    options.pendingRestoreScrollRatio.value = -1;

    if (openOptions.position === 'first') {
      pageIndex = options.isComicMode.value ? 0 : -1;
      // 新章节从头开始不需要走恢复流程；子组件的 content watcher 会回到顶部。
      scrollRatio = -1;
    } else if (openOptions.position === 'last') {
      pageIndex = typeof openOptions.pageIndex === 'number' ? openOptions.pageIndex : -1;
      scrollRatio = 1;
    } else {
      if (typeof openOptions.pageIndex === 'number') {
        pageIndex = openOptions.pageIndex;
      }
      if (typeof openOptions.pageRatio === 'number') {
        scrollRatio = openOptions.pageRatio;
      }
    }

    return {
      pageIndex: pageIndex >= 0 ? Math.floor(pageIndex) : -1,
      scrollRatio: scrollRatio >= 0 ? clampReaderRatio(scrollRatio) : -1,
    };
  }

  function writeRestoredPosition(pageIndex: number, scrollRatio: number) {
    options.writePositionSnapshot({
      mode: options.getPositionMode(),
      chapterOffset: 0,
      pageIndex,
      scrollRatio,
      playbackTime: -1,
    });
  }

  async function restoreLinearPosition(restore: { pageIndex: number; scrollRatio: number }) {
    const shelfDataReady = options.getShelfDataReady();
    if (shelfDataReady) {
      await shelfDataReady;
    }

    const { pageIndex, scrollRatio } = restore;

    if (scrollRatio < 0 && pageIndex < 0) {
      return;
    }

    options.restoringPosition.value = true;
    try {
      if (options.isComicMode.value) {
        writeRestoredPosition(-1, -1);
        return;
      }

      if (options.isScrollMode.value && pageIndex >= 0) {
        const ready = await waitUntilReady(
          () =>
            options.scrollModeRef.value?.restoreToReadingAnchor ??
            options.scrollModeRef.value?.scrollToReadingAnchor ??
            options.scrollModeRef.value?.scrollToParagraph,
        );
        if (ready && options.scrollModeRef.value) {
          await options.waitForLinearSeamlessWindowStable(options.activeChapterIndex.value);
          await nextTick();
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          const restoreAnchor =
            options.scrollModeRef.value.restoreToReadingAnchor ??
            options.scrollModeRef.value.scrollToReadingAnchor ??
            options.scrollModeRef.value.scrollToParagraph;
          await Promise.resolve(restoreAnchor?.(pageIndex));
          writeRestoredPosition(
            pageIndex,
            options.scrollModeRef.value.getScrollRatio?.() ?? options.currentScrollRatio.value,
          );
        }
        return;
      }

      if (scrollRatio >= 0) {
        const ready = await waitUntilReady(() => options.scrollModeRef.value?.scrollToRatio);
        if (ready && options.scrollModeRef.value?.scrollToRatio) {
          if (options.isScrollMode.value) {
            await options.waitForLinearSeamlessWindowStable(options.activeChapterIndex.value);
          }
          await nextTick();
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          options.scrollModeRef.value.scrollToRatio(clampReaderRatio(scrollRatio));
          writeRestoredPosition(
            -1,
            options.scrollModeRef.value.getScrollRatio?.() ?? clampReaderRatio(scrollRatio),
          );
        }
      }
    } finally {
      await nextTick();
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      options.restoringPosition.value = false;
    }
  }

  function warmAdjacentPages(index: number) {
    if (!options.getShow() || !options.isPagedMode.value) {
      return;
    }

    const nextIndex = index + 1;
    const prevIndex = index - 1;
    const order =
      options.navDirection.value === 'backward' ? [prevIndex, nextIndex] : [nextIndex, prevIndex];
    const token = ++warmAdjacentToken;

    void Promise.allSettled(
      order.map((chapterIndex) =>
        options
          .fetchProcessedChapterText(chapterIndex, 'reader.content.beforePaginate')
          .catch(() => ''),
      ),
    ).then(async () => {
      if (token !== warmAdjacentToken || !options.getShow() || !options.isPagedMode.value) {
        return;
      }
      await options.pagedCache.warmPages(order);
    });
  }

  async function openPagedChapter(index: number, openOptions: OpenChapterOptions = {}) {
    const chapter = options.getChapter(index);
    if (!chapter) {
      return;
    }

    const token = ++openChapterToken;
    options.error.value = '';
    options.loading.value = false;

    const needsBlocking =
      options.pagedCache.getPages(index).length === 0 || openOptions.forceNetwork === true;
    if (needsBlocking) {
      options.pagedLoading.value = true;
    }

    try {
      const text = await options.fetchProcessedChapterText(
        index,
        'reader.content.beforeRender',
        openOptions.forceNetwork,
      );
      if (token !== openChapterToken) {
        return;
      }

      const needsStablePagination =
        openOptions.position === 'last' ||
        typeof openOptions.pageIndex === 'number' ||
        typeof openOptions.pageRatio === 'number' ||
        openOptions.anchor !== undefined;
      const pages = await options.pagedCache.ensurePages(index, {
        forceNetwork: openOptions.forceNetwork,
        waitForComplete: needsStablePagination,
        anchor: openOptions.anchor,
      });
      if (token !== openChapterToken) {
        return;
      }

      options.content.value = text;
      options.activeChapterIndex.value = index;
      options.markChapterRead(index);

      let targetPage: number;
      if (openOptions.anchor) {
        const resolvedPage = options.pagedCache.getAnchorResolvedPage(index);
        if (resolvedPage !== undefined && resolvedPage >= 0 && resolvedPage < pages.length) {
          targetPage = resolvedPage;
        } else {
          const metas = options.pagedCache.getPageMetas(index);
          targetPage = findPageByAnchorFromMetas(openOptions.anchor, metas, pages.length);
        }
      } else if (typeof openOptions.pageIndex === 'number') {
        targetPage = openOptions.pageIndex;
      } else if (typeof openOptions.pageRatio === 'number' && pages.length > 1) {
        targetPage = Math.round(
          Math.min(1, Math.max(0, openOptions.pageRatio)) * (pages.length - 1),
        );
      } else if (openOptions.position === 'last') {
        targetPage = pages.length - 1;
      } else {
        targetPage = 0;
      }

      options.setPagedPage(targetPage);
      await options.updateReaderSession(options.buildReaderSessionSnapshot({ content: text }));

      const shelfId = options.currentShelfId.value;
      if (shelfId !== undefined && shelfId !== '') {
        void options
          .updateProgress(shelfId, index, chapter.url, {
            ...options.buildProgressPayload(),
          })
          .catch(() => {});
      }

      warmAdjacentPages(index);
    } catch (cause) {
      if (token !== openChapterToken) {
        return;
      }
      options.error.value = cause instanceof Error ? cause.message : String(cause);
      options.reportLoadError(options.error.value);
    } finally {
      if (token === openChapterToken) {
        options.pagedLoading.value = false;
      }
    }
  }

  async function openLinearChapter(index: number, openOptions: OpenChapterOptions = {}) {
    const chapter = options.getChapter(index);
    if (!chapter) {
      return;
    }

    const token = ++openChapterToken;
    const restore = consumeLinearRestore(openOptions);
    options.error.value = '';
    options.pagedLoading.value = false;
    options.loading.value =
      !options.content.value ||
      openOptions.forceNetwork === true ||
      options.activeChapterIndex.value !== index;

    try {
      if (options.isScrollMode.value) {
        options.activeChapterIndex.value = index;
        options.content.value = '';
        options.currentPageIndex.value = -1;
        options.currentScrollRatio.value =
          restore.scrollRatio >= 0 ? clampReaderRatio(restore.scrollRatio) : 0;
      }

      const text = await options.fetchProcessedChapterText(
        index,
        'reader.content.beforeRender',
        openOptions.forceNetwork,
      );
      if (token !== openChapterToken) {
        return;
      }

      options.content.value = text;
      options.activeChapterIndex.value = index;
      options.currentPageIndex.value = -1;
      options.currentScrollRatio.value =
        options.isScrollMode.value || options.isComicMode.value
          ? restore.scrollRatio >= 0
            ? clampReaderRatio(restore.scrollRatio)
            : 0
          : -1;
      if (options.isComicMode.value && restore.pageIndex >= 0) {
        options.currentPageIndex.value = restore.pageIndex;
      }
      if (options.isVideoMode.value) {
        options.pendingResumePlaybackTime.value = -1;
      }
      options.markChapterRead(index);

      if (!options.isComicMode.value && !options.isVideoMode.value) {
        void options
          .fetchProcessedChapterText(index + 1, 'reader.content.beforePaginate')
          .catch(() => {});
      }

      // ⚠️ 【易错点·勿删】必须在 restoreLinearPosition 之前清除 loading，
      // 让 ScrollMode / ComicMode 子组件完成 DOM 挂载（scrollModeRef/comicModeRef 变为非 null）。
      //
      // 背景：ChapterReaderModal 的 blockingLoading 计算为：
      //   loading.value && (!content.value || openingChapter.value)
      // 整个 openChapter 调用期间 openingChapter.value 始终为 true，
      // 因此若 loading.value 不提前置 false，blockingLoading 持续为 true，
      // ReaderContentArea 会渲染 spinner 而非 ScrollMode，
      // 导致 scrollModeRef.value === null：
      //   - restoreLinearPosition 的 waitUntilReady 永远等不到组件 → 位置无法恢复
      //   - buildProgressPayload 读不到 getScrollRatio() → 位置保存为 -1 / 0
      // 此行已多次被误删或后移，请保持它在 restoreLinearPosition 之前。
      options.loading.value = false;

      await restoreLinearPosition(restore);
      await options.updateReaderSession(options.buildReaderSessionSnapshot({ content: text }));
    } catch (cause) {
      if (token !== openChapterToken) {
        return;
      }
      options.error.value = cause instanceof Error ? cause.message : String(cause);
      options.reportLoadError(options.error.value);
    } finally {
      // loading 在正常流程中已经提前清除（见上方注释），
      // 这里保留兜底：确保异常路径也能清除 loading 标志。
      if (token === openChapterToken) {
        options.loading.value = false;
      }
    }
  }

  async function openChapter(index: number, openOptions: OpenChapterOptions = {}) {
    if (index < 0 || index >= options.getChapterCount()) {
      return;
    }

    const sequence = ++openChapterSequence;
    options.openingChapter.value = true;
    try {
      if (options.isPagedMode.value) {
        await openPagedChapter(index, openOptions);
        return;
      }

      await openLinearChapter(index, openOptions);
    } finally {
      if (sequence === openChapterSequence) {
        options.openingChapter.value = false;
        options.clearRepaginateWork();
      }
    }
  }

  return {
    openChapter,
    openLinearChapter,
    openPagedChapter,
  };
}
