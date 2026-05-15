import { defineStore } from 'pinia';
import { shallowRef } from 'vue';
import type {
  TemporaryChapterSourceOverride,
  WholeBookSwitchedPayload,
} from '@/components/reader/types';

type ReaderTapZone = 'left' | 'center' | 'right';
type Asyncish = void | Promise<unknown>;

export interface ReaderActionBindings {
  close: () => Asyncish;
  retryCurrentChapter: () => Asyncish;
  onTap: (zone: ReaderTapZone) => Asyncish;
  onPagedPageChange: (page: number) => Asyncish;
  onPagedProgress: (ratio: number) => Asyncish;
  onScrollProgress: (ratio: number) => Asyncish;
  onComicProgress: (ratio: number) => Asyncish;
  gotoPrevChapter: () => Asyncish;
  gotoNextChapter: () => Asyncish;
  gotoPrevBoundary: () => Asyncish;
  gotoNextBoundary: () => Asyncish;
  gotoChapter: (index: number) => Asyncish;
  onScrollNextChapterEntered: (sectionHeight: number) => Asyncish;
  onScrollPrevChapterEntered: () => Asyncish;
  onComicNextChapterEntered: (sectionHeight: number) => Asyncish;
  onComicPrevChapterEntered: () => Asyncish;
  dumpPaginationLayoutDebug: () => Asyncish;
  onTtsToggle: () => Asyncish;
  forceRefreshChapter: () => Asyncish;
  prefetchChapters: (count: number) => Asyncish;
  openWholeBookSourceSwitch: () => Asyncish;
  openTemporaryChapterSwitch: () => Asyncish;
  clearTemporaryChapterSwitch: () => Asyncish;
  handleAddToShelf: () => Asyncish;
  emitRefreshToc: () => Asyncish;
  handleClearChapterCache: (index: number) => Asyncish;
  handleClearAllCache: () => Asyncish;
  handleTemporaryChapterSourceSwitched: (payload: TemporaryChapterSourceOverride) => Asyncish;
  handleWholeBookSourceSwitched: (payload: WholeBookSwitchedPayload) => Asyncish;
  onVideoProgress: (time: number, duration: number) => Asyncish;
  onVideoEnded: () => Asyncish;
}

function noop(): void {}

function call<TArgs extends unknown[]>(
  action: ((...args: TArgs) => Asyncish) | undefined,
  ...args: TArgs
) {
  if (!action) {
    return;
  }
  return action(...args);
}

export const useReaderActionsStore = defineStore('readerActions', () => {
  const bindings = shallowRef<ReaderActionBindings | null>(null);

  function bind(nextBindings: ReaderActionBindings) {
    bindings.value = nextBindings;
  }

  function clear() {
    bindings.value = null;
  }

  function close() {
    return call(bindings.value?.close);
  }

  function retryCurrentChapter() {
    return call(bindings.value?.retryCurrentChapter);
  }

  function onTap(zone: ReaderTapZone) {
    return call(bindings.value?.onTap, zone);
  }

  function onPagedPageChange(page: number) {
    return call(bindings.value?.onPagedPageChange, page);
  }

  function onPagedProgress(ratio: number) {
    return call(bindings.value?.onPagedProgress, ratio);
  }

  function onScrollProgress(ratio: number) {
    return call(bindings.value?.onScrollProgress, ratio);
  }

  function onComicProgress(ratio: number) {
    return call(bindings.value?.onComicProgress, ratio);
  }

  function gotoPrevChapter() {
    return call(bindings.value?.gotoPrevChapter);
  }

  function gotoNextChapter() {
    return call(bindings.value?.gotoNextChapter);
  }

  function gotoPrevBoundary() {
    return call(bindings.value?.gotoPrevBoundary);
  }

  function gotoNextBoundary() {
    return call(bindings.value?.gotoNextBoundary);
  }

  function gotoChapter(index: number) {
    return call(bindings.value?.gotoChapter, index);
  }

  function onScrollNextChapterEntered(sectionHeight: number) {
    return call(bindings.value?.onScrollNextChapterEntered, sectionHeight);
  }

  function onScrollPrevChapterEntered() {
    return call(bindings.value?.onScrollPrevChapterEntered);
  }

  function onComicNextChapterEntered(sectionHeight: number) {
    return call(bindings.value?.onComicNextChapterEntered, sectionHeight);
  }

  function onComicPrevChapterEntered() {
    return call(bindings.value?.onComicPrevChapterEntered);
  }

  function dumpPaginationLayoutDebug() {
    return call(bindings.value?.dumpPaginationLayoutDebug);
  }

  function onTtsToggle() {
    return call(bindings.value?.onTtsToggle);
  }

  function forceRefreshChapter() {
    return call(bindings.value?.forceRefreshChapter);
  }

  function prefetchChapters(count: number) {
    return call(bindings.value?.prefetchChapters, count);
  }

  function openWholeBookSourceSwitch() {
    return call(bindings.value?.openWholeBookSourceSwitch);
  }

  function openTemporaryChapterSwitch() {
    return call(bindings.value?.openTemporaryChapterSwitch);
  }

  function clearTemporaryChapterSwitch() {
    return call(bindings.value?.clearTemporaryChapterSwitch);
  }

  function handleAddToShelf() {
    return call(bindings.value?.handleAddToShelf);
  }

  function emitRefreshToc() {
    return call(bindings.value?.emitRefreshToc);
  }

  function handleClearChapterCache(index: number) {
    return call(bindings.value?.handleClearChapterCache, index);
  }

  function handleClearAllCache() {
    return call(bindings.value?.handleClearAllCache);
  }

  function handleTemporaryChapterSourceSwitched(payload: TemporaryChapterSourceOverride) {
    return call(bindings.value?.handleTemporaryChapterSourceSwitched, payload);
  }

  function handleWholeBookSourceSwitched(payload: WholeBookSwitchedPayload) {
    return call(bindings.value?.handleWholeBookSourceSwitched, payload);
  }

  function onVideoProgress(time: number, duration: number) {
    return call(bindings.value?.onVideoProgress, time, duration);
  }

  function onVideoEnded() {
    return call(bindings.value?.onVideoEnded);
  }

  return {
    bind,
    clear,
    close,
    retryCurrentChapter,
    onTap,
    onPagedPageChange,
    onPagedProgress,
    onScrollProgress,
    onComicProgress,
    gotoPrevChapter,
    gotoNextChapter,
    gotoPrevBoundary,
    gotoNextBoundary,
    gotoChapter,
    onScrollNextChapterEntered,
    onScrollPrevChapterEntered,
    onComicNextChapterEntered,
    onComicPrevChapterEntered,
    dumpPaginationLayoutDebug,
    onTtsToggle,
    forceRefreshChapter,
    prefetchChapters,
    openWholeBookSourceSwitch,
    openTemporaryChapterSwitch,
    clearTemporaryChapterSwitch,
    handleAddToShelf,
    emitRefreshToc,
    handleClearChapterCache,
    handleClearAllCache,
    handleTemporaryChapterSourceSwitched,
    handleWholeBookSourceSwitched,
    onVideoProgress,
    onVideoEnded,
    noop,
  };
});
