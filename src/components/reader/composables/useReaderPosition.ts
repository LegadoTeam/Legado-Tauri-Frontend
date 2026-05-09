import type { ComputedRef, Ref } from 'vue';
import type { ComicModeApi, PagedModeApi, ScrollModeApi } from './useReaderModeBridge';

export type ReaderPositionMode = 'paged' | 'scroll' | 'comic' | 'video';

export interface ReaderProgressPayload {
  pageIndex: number;
  scrollRatio: number;
  playbackTime: number;
  readerSettings?: string;
}

export interface ReaderPositionSnapshot {
  mode: ReaderPositionMode;
  pageIndex: number;
  scrollRatio: number;
  playbackTime: number;
}

interface UseReaderPositionOptions {
  mode: ComputedRef<ReaderPositionMode>;
  currentPageIndex: Ref<number>;
  pagedPageIndex: Ref<number>;
  currentScrollRatio: Ref<number>;
  pagedModeRef: Ref<PagedModeApi | null>;
  scrollModeRef: Ref<ScrollModeApi | null>;
  comicModeRef: Ref<ComicModeApi | null>;
  getPlaybackTime: () => number;
  getSettingsJson: () => string;
}

export function clampReaderRatio(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function validIndex(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : -1;
}

function validRatio(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? clampReaderRatio(value)
    : -1;
}

function validPlaybackTime(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : -1;
}

function ratioFromPage(pageIndex: number, totalPages: number | undefined): number {
  if (pageIndex < 0) {
    return -1;
  }
  if (totalPages === undefined || totalPages <= 1) {
    return 1;
  }
  return clampReaderRatio(pageIndex / (totalPages - 1));
}

/**
 * 阅读位置的唯一归一化入口。
 *
 * 约定：
 * - `pageIndex = -1` 表示当前模式不使用页码，防止旧分页/漫画页码污染滚动模式。
 * - `scrollRatio = -1` 表示当前模式不使用滚动比例，防止旧滚动比例污染视频模式。
 * - 保存时始终写入完整字段，而不是省略字段；后端收到 -1 会清掉旧模式遗留值。
 */
export function useReaderPosition(options: UseReaderPositionOptions) {
  function readCurrentPosition(): ReaderPositionSnapshot {
    const mode = options.mode.value;

    if (mode === 'paged') {
      const pageIndex = validIndex(options.pagedPageIndex.value);
      const ratio =
        validRatio(options.currentScrollRatio.value) >= 0
          ? validRatio(options.currentScrollRatio.value)
          : ratioFromPage(pageIndex, options.pagedModeRef.value?.totalPages);
      return {
        mode,
        pageIndex,
        scrollRatio: ratio,
        playbackTime: -1,
      };
    }

    if (mode === 'scroll') {
      return {
        mode,
        pageIndex: -1,
        scrollRatio: validRatio(
          options.scrollModeRef.value?.getScrollRatio?.() ?? options.currentScrollRatio.value,
        ),
        playbackTime: -1,
      };
    }

    if (mode === 'comic') {
      return {
        mode,
        pageIndex: validIndex(
          options.comicModeRef.value?.currentPage ?? options.currentPageIndex.value,
        ),
        scrollRatio: validRatio(
          options.comicModeRef.value?.getScrollRatio?.() ?? options.currentScrollRatio.value,
        ),
        playbackTime: -1,
      };
    }

    return {
      mode,
      pageIndex: -1,
      scrollRatio: -1,
      playbackTime: validPlaybackTime(options.getPlaybackTime()),
    };
  }

  function writeSnapshotToRefs(snapshot: ReaderPositionSnapshot) {
    options.currentPageIndex.value = snapshot.pageIndex;
    if (snapshot.mode === 'paged') {
      options.pagedPageIndex.value = snapshot.pageIndex >= 0 ? snapshot.pageIndex : 0;
    }
    options.currentScrollRatio.value = snapshot.scrollRatio;
  }

  function buildProgressPayload(snapshot = readCurrentPosition()): ReaderProgressPayload {
    return {
      pageIndex: snapshot.pageIndex,
      scrollRatio: snapshot.scrollRatio,
      playbackTime: snapshot.playbackTime,
      readerSettings: options.getSettingsJson(),
    };
  }

  return {
    readCurrentPosition,
    writeSnapshotToRefs,
    buildProgressPayload,
  };
}
