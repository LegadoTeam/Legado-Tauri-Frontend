import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { TemporaryChapterSourceOverride } from '@/components/reader/types';
import type { ChapterItem } from '@/stores';

export const useReaderSessionStore = defineStore('readerSession', () => {
  const activeChapterIndex = ref(0);
  const loading = ref(false);
  const pagedLoading = ref(false);
  const content = ref('');
  const error = ref('');

  const currentPageIndex = ref(-1);
  const currentScrollRatio = ref(-1);
  const pagedPageIndex = ref(0);
  const pendingRestorePageIndex = ref(-1);
  const pendingRestoreScrollRatio = ref(-1);
  const pendingResumePlaybackTime = ref(-1);

  const openingChapter = ref(false);
  const restoringPosition = ref(false);
  const navDirection = ref<'forward' | 'backward'>('forward');

  const readIndices = ref<Set<number>>(new Set());
  const cachedIndices = ref<Set<number>>(new Set());
  const temporaryChapterOverrides = ref<Record<number, TemporaryChapterSourceOverride>>({});

  function resetForOpen(currentIndex: number) {
    activeChapterIndex.value = currentIndex;
    loading.value = false;
    pagedLoading.value = false;
    content.value = '';
    error.value = '';
    currentPageIndex.value = -1;
    currentScrollRatio.value = -1;
    pagedPageIndex.value = 0;
    pendingRestorePageIndex.value = -1;
    pendingRestoreScrollRatio.value = -1;
    pendingResumePlaybackTime.value = -1;
    openingChapter.value = false;
    restoringPosition.value = false;
    navDirection.value = 'forward';
    readIndices.value = new Set();
    cachedIndices.value = new Set();
    temporaryChapterOverrides.value = {};
  }

  function resetForClose() {
    content.value = '';
    error.value = '';
    readIndices.value = new Set();
    cachedIndices.value = new Set();
    temporaryChapterOverrides.value = {};
  }

  function getChapter(chapters: ChapterItem[], index = activeChapterIndex.value) {
    return index >= 0 && index < chapters.length ? chapters[index] : undefined;
  }

  function markChapterRead(index: number) {
    readIndices.value.add(index);
  }

  function setCached(index: number) {
    cachedIndices.value.add(index);
  }

  function deleteCached(index: number) {
    cachedIndices.value.delete(index);
  }

  function setTemporaryOverride(payload: TemporaryChapterSourceOverride) {
    temporaryChapterOverrides.value = {
      ...temporaryChapterOverrides.value,
      [payload.chapterIndex]: payload,
    };
  }

  function clearTemporaryOverride(index: number) {
    const next = { ...temporaryChapterOverrides.value };
    delete next[index];
    temporaryChapterOverrides.value = next;
  }

  return {
    activeChapterIndex,
    loading,
    pagedLoading,
    content,
    error,
    currentPageIndex,
    currentScrollRatio,
    pagedPageIndex,
    pendingRestorePageIndex,
    pendingRestoreScrollRatio,
    pendingResumePlaybackTime,
    openingChapter,
    restoringPosition,
    navDirection,
    readIndices,
    cachedIndices,
    temporaryChapterOverrides,
    resetForOpen,
    resetForClose,
    getChapter,
    markChapterRead,
    setCached,
    deleteCached,
    setTemporaryOverride,
    clearTemporaryOverride,
  };
});
