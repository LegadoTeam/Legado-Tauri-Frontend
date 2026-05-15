import { computed, type ComputedRef, type Ref } from 'vue';
import type { ChapterItem } from '@/stores';
import {
  clearChapterRuntimeTextCache,
  clearProcessedRuntimeTextCache,
  createReaderRuntimeTextCache,
} from '@/features/reader/services/readerContentPipeline';
import type {
  PaginationEngine,
  ReaderPagePadding,
  ReaderTypography,
  TemporaryChapterSourceOverride,
} from '../types';
import { usePagedChapterCache } from './usePagedChapterCache';

type ReaderPipelineStage =
  | 'reader.content.raw'
  | 'reader.content.cleaned'
  | 'reader.content.beforePaginate'
  | 'reader.content.beforeRender';
type ValueSource<T> = Ref<T> | ComputedRef<T>;

interface ReaderSettingsLike {
  typography: ReaderTypography;
  pagePadding: number | ReaderPagePadding;
  paginationEngine: PaginationEngine;
}

interface ReaderContentPayload {
  stage: ReaderPipelineStage;
  content: string;
  sourceType: string;
  fileName: string;
  chapterIndex: number;
  chapterName: string;
  chapterUrl: string;
}

interface UseReaderContentStateOptions {
  fileName: ValueSource<string>;
  sourceType: ValueSource<string | undefined>;
  currentShelfId: ComputedRef<string | undefined>;
  activeChapterIndex: Ref<number>;
  temporaryChapterOverrides: Ref<Record<number, TemporaryChapterSourceOverride>>;
  readIndices: Ref<Set<number>>;
  cachedIndices: Ref<Set<number>>;
  hasPrev: ComputedRef<boolean>;
  hasNext: ComputedRef<boolean>;
  measureHostRef: Ref<HTMLElement | null>;
  backgroundMeasureHostRef: Ref<HTMLElement | null>;
  settings: ReaderSettingsLike;
  runChapterContent: (fileName: string, chapterUrl: string) => Promise<unknown>;
  getContent: (shelfId: string, index: number) => Promise<string | null | undefined>;
  saveContent: (shelfId: string, index: number, content: string) => Promise<unknown>;
  getCachedIndices: (shelfId: string) => Promise<Set<number>>;
  getChapter: (index: number) => ChapterItem | undefined;
  buildReaderContentPayload: (
    stage: ReaderPipelineStage,
    contentText: string,
    index: number,
  ) => ReaderContentPayload;
  runReaderContentPipeline: (
    stage: ReaderPipelineStage,
    payload: ReaderContentPayload,
  ) => Promise<string>;
}

function readSource<T>(source: ValueSource<T>): T {
  return source.value;
}

const PAGED_END_SCREEN =
  '<div class="paged-mode-end-screen"><div class="paged-mode-end-screen__icon">📖</div><p class="paged-mode-end-screen__title">已读完最后一章</p><p class="paged-mode-end-screen__sub">全书完，感谢阅读</p></div>';

export function useReaderContentState(options: UseReaderContentStateOptions) {
  const runtimeTextCache = createReaderRuntimeTextCache();
  const {
    rawChapterTextCache,
    rawChapterTextRequests,
    processedChapterTextCache,
    processedChapterTextRequests,
  } = runtimeTextCache;

  async function loadShelfStatus() {
    if (!options.currentShelfId.value) {
      return;
    }

    try {
      options.cachedIndices.value = await options.getCachedIndices(options.currentShelfId.value);
    } catch {
      options.cachedIndices.value = new Set();
    }

    const nextRead = new Set<number>();
    const readUpTo = options.activeChapterIndex.value >= 0 ? options.activeChapterIndex.value : -1;
    for (let index = 0; index <= readUpTo; index++) {
      nextRead.add(index);
    }
    options.readIndices.value = nextRead;
  }

  function markChapterRead(index: number) {
    options.readIndices.value.add(index);
  }

  async function fetchRawChapterText(index: number, forceNetwork = false): Promise<string> {
    const chapter = options.getChapter(index);
    if (!chapter) {
      return '';
    }
    const chapterOverride = options.temporaryChapterOverrides.value[index];

    const isVideo = readSource(options.sourceType) === 'video';

    if (forceNetwork || isVideo) {
      rawChapterTextCache.delete(index);
      rawChapterTextRequests.delete(index);
    }

    const cached = rawChapterTextCache.get(index);
    if (!forceNetwork && !isVideo && cached !== undefined) {
      return cached;
    }

    const inflight = rawChapterTextRequests.get(index);
    if (!forceNetwork && !isVideo && inflight) {
      return inflight;
    }

    const request = (async () => {
      let text: string | null = null;

      if (chapterOverride) {
        const raw = await options.runChapterContent(
          chapterOverride.fileName,
          chapterOverride.chapterUrl,
        );
        text = typeof raw === 'string' ? raw : String(raw ?? '');
      }

      // 视频类型跳过磁盘缓存读取：m3u8 URL 有时效性，不能复用
      if (!text && !forceNetwork && !isVideo && options.currentShelfId.value) {
        try {
          const shelfText = await options.getContent(options.currentShelfId.value, index);
          text = typeof shelfText === 'string' ? shelfText : null;
          if (readSource(options.sourceType) === 'comic' && text === 'comic') {
            text = null;
          }
        } catch {
          // 回退到网络请求
        }
      }

      if (!text) {
        const raw = await options.runChapterContent(readSource(options.fileName), chapter.url);
        text = typeof raw === 'string' ? raw : String(raw ?? '');
        // 视频类型不写入磁盘缓存：m3u8 URL 有时效性
        if (!isVideo && options.currentShelfId.value && text) {
          void options.saveContent(options.currentShelfId.value, index, text).catch(() => {});
        }
      }

      const nextText = text ?? '';
      // 视频类型不写入内存缓存
      if (!isVideo) {
        rawChapterTextCache.set(index, nextText);
      }

      if (!isVideo && options.currentShelfId.value && nextText) {
        options.cachedIndices.value.add(index);
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
    const sourceType = readSource(options.sourceType);
    if (sourceType === 'comic' || sourceType === 'video') {
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
      nextText = await options.runReaderContentPipeline(
        'reader.content.raw',
        options.buildReaderContentPayload('reader.content.raw', nextText, index),
      );
      nextText = await options.runReaderContentPipeline(
        'reader.content.cleaned',
        options.buildReaderContentPayload('reader.content.cleaned', nextText, index),
      );
      nextText = await options.runReaderContentPipeline(
        'reader.content.beforePaginate',
        options.buildReaderContentPayload('reader.content.beforePaginate', nextText, index),
      );
      if (finalStage === 'reader.content.beforeRender') {
        nextText = await options.runReaderContentPipeline(
          'reader.content.beforeRender',
          options.buildReaderContentPayload('reader.content.beforeRender', nextText, index),
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
    activeHostRef: options.measureHostRef,
    backgroundHostRef: options.backgroundMeasureHostRef,
    loadChapterText: (index, forceNetwork) =>
      fetchProcessedChapterText(index, 'reader.content.beforePaginate', forceNetwork),
    getChapterTitle: (index) => options.getChapter(index)?.name ?? '',
    getTypography: () => options.settings.typography,
    getPadding: () => options.settings.pagePadding,
    getPaginationEngine: () => options.settings.paginationEngine,
  });

  const activePagedPages = computed(() => pagedCache.getPages(options.activeChapterIndex.value));
  const prevBoundaryPage = computed(() =>
    options.hasPrev.value
      ? pagedCache.getBoundaryPage(options.activeChapterIndex.value - 1, 'last')
      : '',
  );
  const nextBoundaryPage = computed(() => {
    if (!options.hasNext.value) {
      return PAGED_END_SCREEN;
    }
    return pagedCache.getBoundaryPage(options.activeChapterIndex.value + 1, 'first');
  });

  function clearChapterRuntimeCache(index: number) {
    clearChapterRuntimeTextCache(runtimeTextCache, index);
    pagedCache.dropChapter(index);
  }

  function clearProcessedRuntimeCache() {
    clearProcessedRuntimeTextCache(runtimeTextCache);
  }

  function clearAllRuntimeCache() {
    rawChapterTextCache.clear();
    rawChapterTextRequests.clear();
    processedChapterTextCache.clear();
    processedChapterTextRequests.clear();
  }

  function invalidatePages() {
    pagedCache.invalidatePages();
  }

  return {
    runtimeTextCache,
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
  };
}
