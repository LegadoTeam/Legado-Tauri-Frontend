/**
 * 维护上下/漫画三章无缝阅读窗口，并在跨章时保存真实进入章节的位置。
 */
import { nextTick, ref, watch, type ComputedRef, type Ref } from 'vue';
import type { ChapterItem } from '@/stores';
import type { ReaderPositionSnapshot } from './useReaderPosition';

type LinearSeamlessMode = 'scroll' | 'comic';
type SeamlessSide = 'prev' | 'next';

interface SeamlessChapterSlotRefs {
  chapterIndex: Ref<number>;
  chapterUrl: Ref<string>;
  content: Ref<string>;
  title: Ref<string>;
  loading: Ref<boolean>;
}

interface SeamlessReaderModeRef {
  prepareSeamlessSwap?: (sectionHeight: number) => void;
  prepareSeamlessSwapBack?: () => void;
  getAdjacentScrollRatio?: (side: SeamlessSide) => number;
  getAdjacentPageIndex?: (side: SeamlessSide) => number;
  getAdjacentLineAnchor?: (side: SeamlessSide) => number;
  getAdjacentParagraphIndex?: (side: SeamlessSide) => number;
}

interface ReaderProgressPayloadLike {
  pageIndex?: number;
  scrollRatio?: number;
  playbackTime?: number;
  readerSettings?: string;
}

interface UseReaderSeamlessWindowOptions {
  getShow: () => boolean;
  getFileName: () => string;
  getSourceType: () => string | undefined;
  getChapterCount: () => number;
  activeChapterIndex: Ref<number>;
  currentChapterName: ComputedRef<string>;
  currentChapterUrl: ComputedRef<string>;
  currentShelfId: ComputedRef<string | undefined>;
  hasPrev: ComputedRef<boolean>;
  hasNext: ComputedRef<boolean>;
  isScrollMode: ComputedRef<boolean>;
  isComicMode: ComputedRef<boolean>;
  openingChapter: Ref<boolean>;
  restoringPosition: Ref<boolean>;
  navDirection: Ref<string>;
  content: Ref<string>;
  scrollModeRef: Ref<SeamlessReaderModeRef | null>;
  comicModeRef: Ref<SeamlessReaderModeRef | null>;
  getChapter: (index: number) => ChapterItem | undefined;
  fetchProcessedChapterText: (
    index: number,
    finalStage: 'reader.content.beforeRender',
    forceNetwork?: boolean,
  ) => Promise<string>;
  saveDetailedProgress: () => Promise<void> | void;
  openChapter: (index: number, options: { position: 'first' | 'last' }) => Promise<unknown>;
  markChapterRead: (index: number) => void;
  updateProgress: (
    shelfId: string,
    chapterIndex: number,
    chapterUrl: string,
    payload?: ReaderProgressPayloadLike,
  ) => Promise<unknown>;
  buildProgressPayload: (snapshot?: ReaderPositionSnapshot) => ReaderProgressPayloadLike;
  onSeamlessChapterActivated: (snapshot: ReaderPositionSnapshot) => void;
}

function createSeamlessChapterSlot(): SeamlessChapterSlotRefs {
  return {
    chapterIndex: ref(-1),
    chapterUrl: ref(''),
    content: ref(''),
    title: ref(''),
    loading: ref(false),
  };
}

function resetSeamlessChapterSlot(slot: SeamlessChapterSlotRefs) {
  slot.chapterIndex.value = -1;
  slot.chapterUrl.value = '';
  slot.content.value = '';
  slot.title.value = '';
  slot.loading.value = false;
}

function assignSeamlessChapterSlot(
  slot: SeamlessChapterSlotRefs,
  index: number,
  chapterUrl: string,
  contentText: string,
  title: string,
) {
  slot.chapterIndex.value = index;
  slot.chapterUrl.value = chapterUrl;
  slot.content.value = contentText;
  slot.title.value = title;
  slot.loading.value = false;
}

function clampRatio(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

function normalizePageIndex(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

export function useReaderSeamlessWindow(options: UseReaderSeamlessWindowOptions) {
  const prevScrollChapterSlot = createSeamlessChapterSlot();
  const nextScrollChapterSlot = createSeamlessChapterSlot();
  const prevComicChapterSlot = createSeamlessChapterSlot();
  const nextComicChapterSlot = createSeamlessChapterSlot();

  const prevScrollChapterContent = prevScrollChapterSlot.content;
  const prevScrollChapterTitle = prevScrollChapterSlot.title;
  const prevScrollChapterLoading = prevScrollChapterSlot.loading;
  const nextScrollChapterContent = nextScrollChapterSlot.content;
  const nextScrollChapterTitle = nextScrollChapterSlot.title;
  const nextScrollChapterLoading = nextScrollChapterSlot.loading;
  const prevComicChapterContent = prevComicChapterSlot.content;
  const prevComicChapterTitle = prevComicChapterSlot.title;
  const nextComicChapterContent = nextComicChapterSlot.content;
  const nextComicChapterTitle = nextComicChapterSlot.title;

  let prevChapterPrefetchAbort: AbortController | null = null;
  let nextChapterPrefetchAbort: AbortController | null = null;
  let prevChapterPrefetchTask: Promise<void> | null = null;
  let nextChapterPrefetchTask: Promise<void> | null = null;

  function getLinearSeamlessMode(): LinearSeamlessMode | null {
    if (options.isComicMode.value) {
      return 'comic';
    }
    if (options.isScrollMode.value) {
      return 'scroll';
    }
    return null;
  }

  function getSeamlessModeSlots(mode: LinearSeamlessMode) {
    if (mode === 'comic') {
      return {
        prev: prevComicChapterSlot,
        next: nextComicChapterSlot,
      };
    }
    return {
      prev: prevScrollChapterSlot,
      next: nextScrollChapterSlot,
    };
  }

  function getModeRef(mode: LinearSeamlessMode) {
    return mode === 'comic' ? options.comicModeRef.value : options.scrollModeRef.value;
  }

  function clearSeamlessSlots(mode: LinearSeamlessMode) {
    const slots = getSeamlessModeSlots(mode);
    resetSeamlessChapterSlot(slots.prev);
    resetSeamlessChapterSlot(slots.next);
  }

  function clearAllSeamlessSlots() {
    prevChapterPrefetchAbort?.abort();
    nextChapterPrefetchAbort?.abort();
    prevChapterPrefetchAbort = null;
    nextChapterPrefetchAbort = null;
    prevChapterPrefetchTask = null;
    nextChapterPrefetchTask = null;
    clearSeamlessSlots('scroll');
    clearSeamlessSlots('comic');
  }

  function slotMatchesChapter(slot: SeamlessChapterSlotRefs, index: number): boolean {
    const chapter = options.getChapter(index);
    const chapterUrl = chapter?.url ?? '';
    return slot.chapterIndex.value === index && slot.chapterUrl.value === chapterUrl;
  }

  async function prefetchAdjacentChapterForSeamless(
    mode: LinearSeamlessMode,
    side: SeamlessSide,
    index: number,
  ) {
    const slot = getSeamlessModeSlots(mode)[side];
    const controller = new AbortController();

    if (side === 'prev') {
      prevChapterPrefetchAbort?.abort();
      prevChapterPrefetchAbort = controller;
    } else {
      nextChapterPrefetchAbort?.abort();
      nextChapterPrefetchAbort = controller;
    }

    slot.loading.value = true;

    if (index < 0 || index >= options.getChapterCount()) {
      resetSeamlessChapterSlot(slot);
      return;
    }

    const chapter = options.getChapter(index);
    const chapterUrl = chapter?.url ?? '';
    const title = chapter?.name ?? '';
    slot.chapterIndex.value = index;
    slot.chapterUrl.value = chapterUrl;
    slot.title.value = title;
    slot.content.value = '';

    try {
      const text = await options.fetchProcessedChapterText(index, 'reader.content.beforeRender');
      if (controller.signal.aborted || getLinearSeamlessMode() !== mode) {
        return;
      }
      if (!text) {
        resetSeamlessChapterSlot(slot);
        return;
      }
      assignSeamlessChapterSlot(slot, index, chapterUrl, text, title);
    } catch {
      if (!controller.signal.aborted && getLinearSeamlessMode() === mode) {
        resetSeamlessChapterSlot(slot);
      }
    } finally {
      const activeController =
        side === 'prev' ? prevChapterPrefetchAbort : nextChapterPrefetchAbort;
      if (activeController === controller && !slot.content.value) {
        slot.loading.value = false;
      }
      if (side === 'prev' && prevChapterPrefetchAbort === controller) {
        prevChapterPrefetchTask = null;
      }
      if (side === 'next' && nextChapterPrefetchAbort === controller) {
        nextChapterPrefetchTask = null;
      }
    }
  }

  function waitNextFrame(): Promise<void> {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  function isAdjacentSlotStable(slot: SeamlessChapterSlotRefs, index: number): boolean {
    if (index < 0 || index >= options.getChapterCount()) {
      return true;
    }
    if (slot.loading.value) {
      return false;
    }
    return slotMatchesChapter(slot, index) || !slot.content.value;
  }

  async function waitForStableWindow(index = options.activeChapterIndex.value): Promise<void> {
    const mode = getLinearSeamlessMode();
    if (!options.getShow() || mode !== 'scroll') {
      return;
    }

    await syncLinearSeamlessWindow();
    const slots = getSeamlessModeSlots(mode);
    const prevIndex = index - 1;
    const nextIndex = index + 1;
    const tasks: Promise<void>[] = [];
    if (prevIndex >= 0 && slots.prev.loading.value && prevChapterPrefetchTask) {
      tasks.push(prevChapterPrefetchTask);
    }
    if (
      nextIndex < options.getChapterCount() &&
      slots.next.loading.value &&
      nextChapterPrefetchTask
    ) {
      tasks.push(nextChapterPrefetchTask);
    }
    if (tasks.length > 0) {
      await Promise.allSettled(tasks);
    }

    for (let frame = 0; frame < 90; frame++) {
      if (
        isAdjacentSlotStable(slots.prev, prevIndex) &&
        isAdjacentSlotStable(slots.next, nextIndex)
      ) {
        await nextTick();
        await waitNextFrame();
        await waitNextFrame();
        return;
      }
      await waitNextFrame();
    }
  }

  async function syncLinearSeamlessWindow() {
    if (!options.getShow()) {
      clearAllSeamlessSlots();
      return;
    }

    const mode = getLinearSeamlessMode();
    if (!mode) {
      clearAllSeamlessSlots();
      return;
    }

    clearSeamlessSlots(mode === 'scroll' ? 'comic' : 'scroll');

    const { prev, next } = getSeamlessModeSlots(mode);
    const prevIndex = options.activeChapterIndex.value - 1;
    const nextIndex = options.activeChapterIndex.value + 1;
    const prevMatches = slotMatchesChapter(prev, prevIndex);
    const nextMatches = slotMatchesChapter(next, nextIndex);

    if (prevIndex < 0) {
      prevChapterPrefetchAbort?.abort();
      prevChapterPrefetchAbort = null;
      resetSeamlessChapterSlot(prev);
    } else if (!prev.loading.value && (!prevMatches || !prev.content.value)) {
      if (!prevMatches) {
        resetSeamlessChapterSlot(prev);
      }
      prevChapterPrefetchTask = prefetchAdjacentChapterForSeamless(mode, 'prev', prevIndex);
      void prevChapterPrefetchTask;
    }

    if (nextIndex >= options.getChapterCount()) {
      nextChapterPrefetchAbort?.abort();
      nextChapterPrefetchAbort = null;
      resetSeamlessChapterSlot(next);
    } else if (!next.loading.value && (!nextMatches || !next.content.value)) {
      if (!nextMatches) {
        resetSeamlessChapterSlot(next);
      }
      nextChapterPrefetchTask = prefetchAdjacentChapterForSeamless(mode, 'next', nextIndex);
      void nextChapterPrefetchTask;
    }
  }

  function captureEnteringPosition(
    mode: LinearSeamlessMode,
    side: SeamlessSide,
  ): ReaderPositionSnapshot {
    const modeRef = getModeRef(mode);
    const chapterOffset = side === 'next' ? 1 : -1;
    return {
      mode,
      chapterOffset,
      pageIndex:
        mode === 'scroll'
          ? normalizePageIndex(
              modeRef?.getAdjacentLineAnchor?.(side) ?? modeRef?.getAdjacentParagraphIndex?.(side),
            )
          : -1,
      scrollRatio: mode === 'scroll' ? clampRatio(modeRef?.getAdjacentScrollRatio?.(side)) : -1,
      playbackTime: -1,
    };
  }

  async function syncProgressForSeamlessChapter(index: number, position: ReaderPositionSnapshot) {
    const chapter = options.getChapter(index);
    if (chapter && options.currentShelfId.value) {
      void options
        .updateProgress(
          options.currentShelfId.value,
          index,
          chapter.url,
          options.buildProgressPayload(position),
        )
        .catch(() => {});
    }
  }

  async function enterAdjacentChapter(
    mode: LinearSeamlessMode,
    side: SeamlessSide,
    sectionHeight?: number,
  ) {
    const isForward = side === 'next';
    const canEnter = isForward ? options.hasNext.value : options.hasPrev.value;
    if (!canEnter || options.openingChapter.value || options.restoringPosition.value) {
      return;
    }

    const slots = getSeamlessModeSlots(mode);
    const enteringSlot = isForward ? slots.next : slots.prev;
    const newIndex = options.activeChapterIndex.value + (isForward ? 1 : -1);
    const newContent = enteringSlot.content.value;
    const enteringPosition = captureEnteringPosition(mode, side);

    if (!newContent) {
      await options.saveDetailedProgress();
      options.navDirection.value = isForward ? 'forward' : 'backward';
      void syncLinearSeamlessWindow();
      void options.openChapter(newIndex, { position: isForward ? 'first' : 'last' });
      return;
    }

    const modeRef = getModeRef(mode);
    if (isForward) {
      modeRef?.prepareSeamlessSwap?.(sectionHeight ?? 0);
    } else {
      modeRef?.prepareSeamlessSwapBack?.();
    }

    options.navDirection.value = isForward ? 'forward' : 'backward';

    const oldIndex = options.activeChapterIndex.value;
    const oldContent = options.content.value;
    const oldTitle = options.currentChapterName.value;
    const oldChapterUrl = options.currentChapterUrl.value;

    if (isForward) {
      assignSeamlessChapterSlot(slots.prev, oldIndex, oldChapterUrl, oldContent, oldTitle);
      resetSeamlessChapterSlot(slots.next);
    } else {
      assignSeamlessChapterSlot(slots.next, oldIndex, oldChapterUrl, oldContent, oldTitle);
      resetSeamlessChapterSlot(slots.prev);
    }

    options.activeChapterIndex.value = newIndex;
    options.content.value = newContent;
    options.markChapterRead(newIndex);
    options.onSeamlessChapterActivated({
      ...enteringPosition,
      chapterOffset: 0,
    });
    await syncProgressForSeamlessChapter(newIndex, {
      ...enteringPosition,
      chapterOffset: 0,
    });
    void syncLinearSeamlessWindow();
  }

  async function onScrollNextChapterEntered(sectionHeight: number) {
    await enterAdjacentChapter('scroll', 'next', sectionHeight);
  }

  async function onScrollPrevChapterEntered() {
    await enterAdjacentChapter('scroll', 'prev');
  }

  async function onComicNextChapterEntered(sectionHeight: number) {
    await enterAdjacentChapter('comic', 'next', sectionHeight);
  }

  async function onComicPrevChapterEntered() {
    await enterAdjacentChapter('comic', 'prev');
  }

  watch(
    [
      () => options.getShow(),
      options.activeChapterIndex,
      options.isScrollMode,
      options.isComicMode,
      () => options.getFileName(),
      () => options.getSourceType(),
      () => options.getChapterCount(),
      options.currentChapterUrl,
    ],
    () => {
      void syncLinearSeamlessWindow();
    },
    { immediate: true },
  );

  return {
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
    syncLinearSeamlessWindow,
    waitForStableWindow,
    onScrollNextChapterEntered,
    onScrollPrevChapterEntered,
    onComicNextChapterEntered,
    onComicPrevChapterEntered,
  };
}
