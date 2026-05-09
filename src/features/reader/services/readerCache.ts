import type { ComputedRef, Ref } from 'vue';
import type { MessageApi } from 'naive-ui';
import { usePrefetchStore, useAppConfigStore, type ChapterItem, type PrefetchPayload } from '@/stores';
import type { ReadingAnchor } from '@/components/reader/composables/usePagination';
import type { OpenChapterOptions } from '@/components/reader/composables/useReaderChapterOpen';
import { comicCacheClear, comicCacheClearChapter } from '@/composables/useBookSource';

export interface ReaderPrefetchControllerOptions {
  currentShelfId: ComputedRef<string | undefined>;
  fileName: string;
  message: MessageApi;
  getBookUrl: () => string;
  getBookName: () => string;
  getSourceType: () => string;
  getChapters: () => ChapterItem[];
  getActiveChapterIndex: () => number;
  markCached: (chapterIndex: number) => void;
}

export function createReaderPrefetchController(options: ReaderPrefetchControllerOptions) {
  function buildPrefetchPayload(startIndex: number, count: number): PrefetchPayload {
    return {
      id: options.currentShelfId.value ?? '',
      fileName: options.fileName,
      bookUrl: options.getBookUrl(),
      bookName: options.getBookName(),
      sourceType: options.getSourceType(),
      chapters: options.getChapters().map((chapter, index) => ({
        index,
        name: chapter.name,
        url: chapter.url,
      })),
      startIndex,
      count,
    };
  }

  async function triggerSilentPrefetch(fromIndex: number, count: number) {
    if (!options.currentShelfId.value || !options.getChapters().length) {
      return;
    }
    try {
      const concurrency =
        useAppConfigStore().config.cache_prefetch_concurrency || 2;
      await usePrefetchStore().startSilentPrefetch(
        { ...buildPrefetchPayload(fromIndex, count), concurrency },
        options.markCached,
      );
    } catch {
      // 静默模式不打断阅读。
    }
  }

  async function prefetchChapters(count: number) {
    if (count === 0 || options.getSourceType() === 'video') {
      return;
    }
    if (!options.currentShelfId.value) {
      options.message.warning('请先将书籍加入书架，再使用缓存功能');
      return;
    }
    if (!options.getChapters().length) {
      options.message.warning('章节列表为空，无法缓存');
      return;
    }
    try {
      const concurrency = useAppConfigStore().config.cache_prefetch_concurrency || 2;
      await usePrefetchStore().startManualPrefetch(
        { ...buildPrefetchPayload(options.getActiveChapterIndex(), count), concurrency },
        options.markCached,
      );
    } catch (error) {
      options.message.error(`启动缓存失败: ${error}`);
    }
  }

  return {
    buildPrefetchPayload,
    triggerSilentPrefetch,
    prefetchChapters,
  };
}

export interface ReaderCacheControllerOptions {
  currentShelfId: ComputedRef<string | undefined>;
  fileName: string;
  message: MessageApi;
  activeChapterIndex: Ref<number>;
  cachedIndices: Ref<Set<number>>;
  currentPageIndex: Ref<number>;
  currentScrollRatio: Ref<number>;
  pagedPageIndex: Ref<number>;
  pendingRestorePageIndex: Ref<number>;
  pendingRestoreScrollRatio: Ref<number>;
  isPagedMode: ComputedRef<boolean>;
  isComicMode: ComputedRef<boolean>;
  getBookUrl: () => string;
  getBookName: () => string;
  getChapter: (index: number) => ChapterItem | undefined;
  buildAnchorForChapterPage: (chapterIndex: number, pageIndex: number) => ReadingAnchor | undefined;
  clearChapterRuntimeCache: (index: number) => void;
  clearAllRuntimeCache: () => void;
  invalidatePages: () => void;
  deleteContent: (shelfId: string, chapterIndex: number) => Promise<unknown>;
  openChapter: (index: number, options?: OpenChapterOptions) => Promise<void>;
}

export function createReaderCacheController(options: ReaderCacheControllerOptions) {
  async function forceRefreshChapter() {
    const index = options.activeChapterIndex.value;
    const chapter = options.getChapter(index);
    if (!chapter) {
      return;
    }

    let anchor: ReadingAnchor | undefined;
    if (options.isPagedMode.value) {
      anchor = options.buildAnchorForChapterPage(index, options.pagedPageIndex.value);
      options.pendingRestorePageIndex.value = options.pagedPageIndex.value;
      options.pendingRestoreScrollRatio.value = -1;
    } else {
      options.pendingRestorePageIndex.value = options.currentPageIndex.value;
      options.pendingRestoreScrollRatio.value = options.currentScrollRatio.value;
    }

    options.clearChapterRuntimeCache(index);

    if (options.isComicMode.value) {
      try {
        await comicCacheClearChapter(
          options.fileName,
          options.getBookUrl(),
          options.getBookName(),
          index,
        );
      } catch (cause) {
        console.warn('[forceRefresh] 清除漫画章节缓存失败:', cause);
      }
      options.cachedIndices.value.delete(index);
    }

    if (options.currentShelfId.value) {
      try {
        await options.deleteContent(options.currentShelfId.value, index);
      } catch {
        // 删除失败仍继续强制刷新。
      }
      options.cachedIndices.value.delete(index);
    }

    if (options.isPagedMode.value) {
      await options.openChapter(index, {
        position: 'resume',
        anchor,
        forceNetwork: true,
      });
      options.pendingRestorePageIndex.value = -1;
      options.pendingRestoreScrollRatio.value = -1;
    } else {
      await options.openChapter(index, { forceNetwork: true });
    }

    options.message.success('刷新成功');
  }

  async function clearChapterCache(index: number) {
    const chapter = options.getChapter(index);
    if (!chapter) {
      return;
    }

    options.clearChapterRuntimeCache(index);

    if (options.isComicMode.value) {
      try {
        await comicCacheClearChapter(
          options.fileName,
          options.getBookUrl(),
          options.getBookName(),
          index,
        );
      } catch (cause) {
        options.message.error(`清理漫画缓存失败: ${cause}`);
        return;
      }
    }

    if (options.currentShelfId.value) {
      try {
        await options.deleteContent(options.currentShelfId.value, index);
      } catch {
        // 静默忽略。
      }
    }

    options.cachedIndices.value.delete(index);
    options.message.success(`已清理第 ${index + 1} 章缓存`);
  }

  async function clearAllCache() {
    options.clearAllRuntimeCache();
    options.invalidatePages();

    if (options.isComicMode.value) {
      try {
        await comicCacheClear(options.fileName);
      } catch (cause) {
        options.message.error(`清理漫画缓存失败: ${cause}`);
        return;
      }
    }

    if (options.currentShelfId.value) {
      const shelfId = options.currentShelfId.value;
      await Promise.allSettled(
        [...options.cachedIndices.value].map((index) => options.deleteContent(shelfId, index)),
      );
    }

    options.cachedIndices.value = new Set();
    options.message.success('已清理全书缓存');
  }

  return {
    forceRefreshChapter,
    clearChapterCache,
    clearAllCache,
  };
}
