import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import type { ChapterItem, ShelfBook } from '@/stores';
import type { ChapterGroup } from '@/stores';
import type { ReaderBookInfo, WholeBookSwitchedPayload } from '@/components/reader/types';
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
  const readerChapterGroups = ref<ChapterGroup[] | undefined>();
  const readerActiveGroupIndex = ref<number | undefined>();
  const refreshingToc = ref(false);

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

  function setCachedChapters(chapters: { name: string; url: string }[]) {
    readerChapters.value = cachedChaptersToChapterItems(
      chapters.map((chapter, index) => ({ index, name: chapter.name, url: chapter.url })),
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
  };
});
