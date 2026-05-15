import { defineStore } from 'pinia';
import { computed, ref, shallowRef, type ComputedRef, type Ref } from 'vue';
import type { ReaderBookInfo, TemporaryChapterSourceOverride } from '@/components/reader/types';
import type { ChapterItem } from '@/stores/scriptBridge';

type PagedModeKind = 'slide' | 'cover' | 'simulation' | 'none';
type ValueSource<T> = Ref<T> | ComputedRef<T>;

export interface ReaderContentRefs {
  pagedModeRef: Ref<unknown | null>;
  scrollModeRef: Ref<unknown | null>;
  comicModeRef: Ref<unknown | null>;
  readerBodyRef: Ref<HTMLElement | null>;
  measureHostRef: Ref<HTMLElement | null>;
  backgroundMeasureHostRef: Ref<HTMLElement | null>;
}

export interface ReaderViewBindings {
  chapters: ValueSource<ChapterItem[]>;
  bookInfo: ValueSource<ReaderBookInfo | undefined>;
  sourceType: ValueSource<string | undefined>;
  fileName: ValueSource<string>;
  refreshingToc: ValueSource<boolean | undefined>;
  hasPrev: ValueSource<boolean>;
  hasNext: ValueSource<boolean>;
  readingChapterIndex: ValueSource<number>;
  currentChapterName: ValueSource<string>;
  currentChapterUrl: ValueSource<string>;
  isVideoMode: ValueSource<boolean>;
  isComicMode: ValueSource<boolean>;
  isPagedMode: ValueSource<boolean>;
  legacyPagedMode: ValueSource<PagedModeKind | null>;
  activePagedPages: ValueSource<string[]>;
  prevBoundaryPage: ValueSource<string>;
  nextBoundaryPage: ValueSource<string>;
  blockingLoading: ValueSource<boolean>;
  blockingError: ValueSource<boolean>;
  currentShelfId: ValueSource<string | undefined>;
  isOnShelf: ValueSource<boolean>;
  addingToShelf: ValueSource<boolean>;
  currentChapterOverride: ValueSource<TemporaryChapterSourceOverride | null>;
  ttsProgressText: ValueSource<string>;
  ttsScrollHighlightIdx: ValueSource<number>;
  currentScrollChapterLoading: ValueSource<boolean>;
  prevScrollChapterContent: ValueSource<string>;
  prevScrollChapterTitle: ValueSource<string>;
  prevScrollChapterLoading: ValueSource<boolean>;
  nextScrollChapterContent: ValueSource<string>;
  nextScrollChapterTitle: ValueSource<string>;
  nextScrollChapterLoading: ValueSource<boolean>;
  prevComicChapterContent: ValueSource<string>;
  prevComicChapterTitle: ValueSource<string>;
  nextComicChapterContent: ValueSource<string>;
  nextComicChapterTitle: ValueSource<string>;
  contentRefs: ReaderContentRefs;
}

const emptyContentRefs: ReaderContentRefs = {
  pagedModeRef: ref(null),
  scrollModeRef: ref(null),
  comicModeRef: ref(null),
  readerBodyRef: ref(null),
  measureHostRef: ref(null),
  backgroundMeasureHostRef: ref(null),
};

function readSource<T>(source: ValueSource<T> | undefined, fallback: T): T {
  return source ? source.value : fallback;
}

export const useReaderViewStore = defineStore('readerView', () => {
  const bindings = shallowRef<ReaderViewBindings | null>(null);

  const chapters = computed<ChapterItem[]>(() => readSource(bindings.value?.chapters, []));
  const bookInfo = computed<ReaderBookInfo | undefined>(() =>
    readSource(bindings.value?.bookInfo, undefined),
  );
  const sourceType = computed(() => readSource(bindings.value?.sourceType, 'novel'));
  const fileName = computed(() => readSource(bindings.value?.fileName, ''));
  const refreshingToc = computed(() => readSource(bindings.value?.refreshingToc, false));
  const hasPrev = computed(() => readSource(bindings.value?.hasPrev, false));
  const hasNext = computed(() => readSource(bindings.value?.hasNext, false));
  const readingChapterIndex = computed(() => readSource(bindings.value?.readingChapterIndex, 0));
  const currentChapterName = computed(() => readSource(bindings.value?.currentChapterName, ''));
  const currentChapterUrl = computed(() => readSource(bindings.value?.currentChapterUrl, ''));
  const isVideoMode = computed(() => readSource(bindings.value?.isVideoMode, false));
  const isComicMode = computed(() => readSource(bindings.value?.isComicMode, false));
  const isPagedMode = computed(() => readSource(bindings.value?.isPagedMode, false));
  const legacyPagedMode = computed<PagedModeKind | null>(() =>
    readSource(bindings.value?.legacyPagedMode, null),
  );
  const activePagedPages = computed<string[]>(() =>
    readSource(bindings.value?.activePagedPages, []),
  );
  const prevBoundaryPage = computed(() => readSource(bindings.value?.prevBoundaryPage, ''));
  const nextBoundaryPage = computed(() => readSource(bindings.value?.nextBoundaryPage, ''));
  const blockingLoading = computed(() => readSource(bindings.value?.blockingLoading, false));
  const blockingError = computed(() => readSource(bindings.value?.blockingError, false));
  const currentShelfId = computed(() => readSource(bindings.value?.currentShelfId, undefined));
  const isOnShelf = computed(() => readSource(bindings.value?.isOnShelf, false));
  const addingToShelf = computed(() => readSource(bindings.value?.addingToShelf, false));
  const currentChapterOverride = computed<TemporaryChapterSourceOverride | null>(() =>
    readSource(bindings.value?.currentChapterOverride, null),
  );
  const ttsProgressText = computed(() => readSource(bindings.value?.ttsProgressText, ''));
  const ttsScrollHighlightIdx = computed(() =>
    readSource(bindings.value?.ttsScrollHighlightIdx, -1),
  );
  const currentScrollChapterLoading = computed(() =>
    readSource(bindings.value?.currentScrollChapterLoading, false),
  );
  const prevScrollChapterContent = computed(() =>
    readSource(bindings.value?.prevScrollChapterContent, ''),
  );
  const prevScrollChapterTitle = computed(() =>
    readSource(bindings.value?.prevScrollChapterTitle, ''),
  );
  const prevScrollChapterLoading = computed(() =>
    readSource(bindings.value?.prevScrollChapterLoading, false),
  );
  const nextScrollChapterContent = computed(() =>
    readSource(bindings.value?.nextScrollChapterContent, ''),
  );
  const nextScrollChapterTitle = computed(() =>
    readSource(bindings.value?.nextScrollChapterTitle, ''),
  );
  const nextScrollChapterLoading = computed(() =>
    readSource(bindings.value?.nextScrollChapterLoading, false),
  );
  const prevComicChapterContent = computed(() =>
    readSource(bindings.value?.prevComicChapterContent, ''),
  );
  const prevComicChapterTitle = computed(() =>
    readSource(bindings.value?.prevComicChapterTitle, ''),
  );
  const nextComicChapterContent = computed(() =>
    readSource(bindings.value?.nextComicChapterContent, ''),
  );
  const nextComicChapterTitle = computed(() =>
    readSource(bindings.value?.nextComicChapterTitle, ''),
  );
  const contentRefs = computed(() => bindings.value?.contentRefs ?? emptyContentRefs);
  const bookName = computed(() => bookInfo.value?.name ?? '');
  const bookUrl = computed(() => bookInfo.value?.bookUrl ?? '');

  function bind(nextBindings: ReaderViewBindings) {
    bindings.value = nextBindings;
  }

  function clear() {
    bindings.value = null;
  }

  return {
    chapters,
    bookInfo,
    sourceType,
    fileName,
    refreshingToc,
    hasPrev,
    hasNext,
    readingChapterIndex,
    currentChapterName,
    currentChapterUrl,
    isVideoMode,
    isComicMode,
    isPagedMode,
    legacyPagedMode,
    activePagedPages,
    prevBoundaryPage,
    nextBoundaryPage,
    blockingLoading,
    blockingError,
    currentShelfId,
    isOnShelf,
    addingToShelf,
    currentChapterOverride,
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
    bookName,
    bookUrl,
    bind,
    clear,
  };
});
