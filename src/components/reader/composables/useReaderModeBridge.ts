import { ref, type ComputedRef, type Ref } from 'vue';
import type { ChapterItem } from '@/stores';

export interface PagedModeApi {
  flipNext?: () => boolean;
  flipPrev?: () => boolean;
  goToPage?: (page: number) => void;
  highlightLine?: (lineIdx: number) => void;
  clearTtsHighlight?: () => void;
  currentPage?: number;
  totalPages?: number;
}

export interface ScrollModeApi {
  $el?: HTMLElement;
  scrollToRatio?: (ratio: number) => void;
  getScrollRatio?: () => number;
  pageDown?: () => boolean;
  pageUp?: () => boolean;
  getFirstVisibleParaIndex?: () => number;
  prepareSeamlessSwap?: (height: number) => void;
}

export interface ComicModeApi {
  goToPage?: (page: number) => void;
  restoreToScrollRatio?: (ratio: number) => Promise<void>;
  scrollToRatio?: (ratio: number) => void;
  getScrollRatio?: () => number;
  currentPage?: number;
  totalPages?: number;
  prepareSeamlessSwap?: (height: number) => void;
}

interface VideoModeApi {
  getCurrentTime?: () => number;
  getDuration?: () => number;
}

interface ProgressPayload {
  pageIndex?: number;
  scrollRatio?: number;
  playbackTime?: number;
  readerSettings?: string;
}

interface UseReaderModeBridgeOptions {
  isVideoMode: ComputedRef<boolean>;
  isComicMode: ComputedRef<boolean>;
  isScrollMode: ComputedRef<boolean>;
  hasPrev: ComputedRef<boolean>;
  hasNext: ComputedRef<boolean>;
  pagedLoading: Ref<boolean>;
  currentShelfId: ComputedRef<string | undefined>;
  activeChapterIndex: Ref<number>;
  currentPageIndex: Ref<number>;
  currentScrollRatio: Ref<number>;
  pagedPageIndex: Ref<number>;
  shouldIgnorePositionEvents: () => boolean;
  setPagedPage: (page: number) => void;
  getChapter: (index: number) => ChapterItem | undefined;
  updateProgress: (
    shelfId: string,
    index: number,
    chapterUrl: string,
    payload: ProgressPayload,
  ) => Promise<unknown>;
  getSettingsJson: () => string;
  gotoNextChapter: () => Promise<void>;
  gotoPrevChapter: () => Promise<void>;
  warnLastPage: () => void;
  warnFirstPage: () => void;
}

function onVideoEnded() {
  // 自动下一集由 VideoMode 内部的 autoNext 处理。
}

export function useReaderModeBridge(options: UseReaderModeBridgeOptions) {
  const pagedModeRef = ref<PagedModeApi | null>(null);
  const scrollModeRef = ref<ScrollModeApi | null>(null);
  const comicModeRef = ref<ComicModeApi | null>(null);
  const videoModeRef = ref<VideoModeApi | null>(null);

  function onPagedPageChange(page: number) {
    options.setPagedPage(page);
  }

  function onPagedProgress(ratio: number) {
    if (options.shouldIgnorePositionEvents()) {
      return;
    }
    options.currentPageIndex.value = options.pagedPageIndex.value;
    options.currentScrollRatio.value = ratio;
  }

  function onScrollProgress(ratio: number) {
    if (options.shouldIgnorePositionEvents()) {
      return;
    }
    options.currentPageIndex.value = -1;
    options.currentScrollRatio.value = ratio;
  }

  function onComicProgress(ratio: number) {
    if (options.shouldIgnorePositionEvents()) {
      return;
    }
    const page = comicModeRef.value?.currentPage;
    if (typeof page === 'number') {
      options.currentPageIndex.value = page;
    }
    options.currentScrollRatio.value = ratio;
  }

  function onVideoProgress(time: number, _duration: number) {
    const shelfId = options.currentShelfId.value;
    if (shelfId !== undefined && shelfId !== '' && time > 0) {
      const chapter = options.getChapter(options.activeChapterIndex.value);
      if (chapter) {
        void options
          .updateProgress(shelfId, options.activeChapterIndex.value, chapter.url, {
            pageIndex: -1,
            scrollRatio: -1,
            playbackTime: time,
            readerSettings: options.getSettingsJson(),
          })
          .catch(() => {});
      }
    }
  }

  function getPlaybackTime(): number {
    return videoModeRef.value?.getCurrentTime?.() ?? -1;
  }

  function flipNext() {
    if (options.isVideoMode.value) {
      return;
    }

    if (options.isComicMode.value || options.isScrollMode.value) {
      if (!options.hasNext.value) {
        options.warnLastPage();
        return;
      }
      void options.gotoNextChapter();
      return;
    }

    if (!options.pagedLoading.value && pagedModeRef.value?.flipNext?.() !== true) {
      options.warnLastPage();
    }
  }

  function flipPrev() {
    if (options.isVideoMode.value) {
      return;
    }

    if (options.isComicMode.value || options.isScrollMode.value) {
      if (!options.hasPrev.value) {
        options.warnFirstPage();
        return;
      }
      void options.gotoPrevChapter();
      return;
    }

    if (!options.pagedLoading.value && pagedModeRef.value?.flipPrev?.() !== true) {
      options.warnFirstPage();
    }
  }

  function volumePageNext() {
    if (options.isVideoMode.value || options.isComicMode.value) {
      return;
    }

    if (options.isScrollMode.value) {
      if (scrollModeRef.value?.pageDown?.() === true) {
        return;
      }
      if (!options.hasNext.value) {
        options.warnLastPage();
        return;
      }
      void options.gotoNextChapter();
      return;
    }

    if (!options.pagedLoading.value && pagedModeRef.value?.flipNext?.() !== true) {
      options.warnLastPage();
    }
  }

  function volumePagePrev() {
    if (options.isVideoMode.value || options.isComicMode.value) {
      return;
    }

    if (options.isScrollMode.value) {
      if (scrollModeRef.value?.pageUp?.() === true) {
        return;
      }
      if (!options.hasPrev.value) {
        options.warnFirstPage();
        return;
      }
      void options.gotoPrevChapter();
      return;
    }

    if (!options.pagedLoading.value && pagedModeRef.value?.flipPrev?.() !== true) {
      options.warnFirstPage();
    }
  }

  return {
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
  };
}
