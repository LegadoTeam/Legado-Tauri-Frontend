import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import type { ReaderBookInfo, WholeBookSwitchedPayload } from '@/components/reader/types';
import type { ChapterItem, EpisodeProgress, ShelfBook, ChapterGroup } from '@/stores';
import { groupChapters, useBookshelfStore } from '@/stores';
import { cachedChaptersToChapterItems, shelfBookToReaderBookInfo } from '../utils/readerBookInfo';

export const useBookshelfReaderStore = defineStore('bookshelfReader', () => {
  const showReader = ref(false);
  const readerFileName = ref('');
  const readerChapterUrl = ref('');
  const readerChapterName = ref('');
  const readerChapters = ref<ChapterItem[]>([]);
  const readerCurrentIndex = ref(0);
  const readerShelfId = ref('');
  const readerBookInfo = ref<ReaderBookInfo | undefined>();
  const readerSourceType = ref('novel');
  const readerChapterGroups = computed<ChapterGroup[] | undefined>(() => {
    const groups = groupChapters(readerChapters.value);
    return groups.length > 1 ? groups : undefined;
  });
  const readerActiveGroupIndex = ref<number | undefined>();
  const refreshingToc = ref(false);
  /** key = chapter URL */
  const episodeProgressMap = ref<Record<string, EpisodeProgress>>({});
  let _progressSaveTimer: ReturnType<typeof setTimeout> | null = null;
  let _pendingProgress: { url: string; time: number; duration: number } | null = null;

  function setBookMeta(book: ShelfBook) {
    readerShelfId.value = book.id;
    readerFileName.value = book.fileName;
    readerSourceType.value = book.sourceType ?? 'novel';
    readerBookInfo.value = shelfBookToReaderBookInfo(book);
  }

  function syncOpenReaderBookInfo(book: ShelfBook | undefined) {
    if (!book || !showReader.value || readerShelfId.value !== book.id) {
      return;
    }
    setBookMeta(book);
  }

  function setChapters(chapters: ChapterItem[]) {
    readerChapters.value = chapters;
    syncCurrentChapter();
  }

  function setCachedChapters(chapters: { name: string; url: string; group?: string }[]) {
    readerChapters.value = cachedChaptersToChapterItems(
      chapters.map((chapter, index) => ({
        index,
        name: chapter.name,
        url: chapter.url,
        group: chapter.group,
      })),
    );
    syncCurrentChapter();
  }

  function syncCurrentChapter() {
    if (readerCurrentIndex.value >= 0 && readerCurrentIndex.value < readerChapters.value.length) {
      const chapter = readerChapters.value[readerCurrentIndex.value];
      readerChapterUrl.value = chapter.url;
      readerChapterName.value = chapter.name;
    }
  }

  function openAt(index: number) {
    readerCurrentIndex.value = Math.max(0, Math.min(index, readerChapters.value.length - 1));
    syncCurrentChapter();
    showReader.value = true;
  }

  function applySourceSwitchToReader(payload: WholeBookSwitchedPayload) {
    setBookMeta(payload.shelfBook);
    readerChapters.value = payload.chapters;
    readerCurrentIndex.value = Math.max(0, payload.matchedChapterIndex);
    const active = payload.chapters[readerCurrentIndex.value];
    readerChapterUrl.value = payload.matchedChapterUrl ?? active?.url ?? '';
    readerChapterName.value = active?.name ?? '';
  }

  function closeIfReadingShelfBook(bookId: string) {
    if (showReader.value && readerShelfId.value === bookId) {
      showReader.value = false;
    }
  }

  async function loadEpisodeProgress(id: string) {
    try {
      const bookshelfStore = useBookshelfStore();
      episodeProgressMap.value = await bookshelfStore.getEpisodeProgress(id);
    } catch {
      episodeProgressMap.value = {};
    }
  }

  /** 节流写盘：内存立即更新，磁盘写入最少间隔 10s */
  function setEpisodeProgress(chapterUrl: string, time: number, duration: number) {
    const prev = episodeProgressMap.value[chapterUrl];
    // 已观看完的不再覆盖进度
    if (prev && prev.duration > 0 && prev.time >= prev.duration * 0.9) {
      return;
    }
    episodeProgressMap.value = {
      ...episodeProgressMap.value,
      [chapterUrl]: { time, duration, lastPlayedAt: Date.now() },
    };
    _pendingProgress = { url: chapterUrl, time, duration };
    if (_progressSaveTimer) {
      return;
    }
    _progressSaveTimer = setTimeout(() => {
      _progressSaveTimer = null;
      const p = _pendingProgress;
      if (!p || !readerShelfId.value) {
        return;
      }
      _pendingProgress = null;
      const bookshelfStore = useBookshelfStore();
      bookshelfStore
        .saveEpisodeProgress(readerShelfId.value, p.url, p.time, p.duration)
        .catch(() => {});
    }, 10_000);
  }

  watch(readerCurrentIndex, syncCurrentChapter);

  return {
    showReader,
    readerFileName,
    readerChapterUrl,
    readerChapterName,
    readerChapters,
    readerCurrentIndex,
    readerShelfId,
    readerBookInfo,
    readerSourceType,
    readerChapterGroups,
    readerActiveGroupIndex,
    refreshingToc,
    setBookMeta,
    syncOpenReaderBookInfo,
    setChapters,
    setCachedChapters,
    syncCurrentChapter,
    openAt,
    applySourceSwitchToReader,
    closeIfReadingShelfBook,
    episodeProgressMap,
    loadEpisodeProgress,
    setEpisodeProgress,
  };
});
