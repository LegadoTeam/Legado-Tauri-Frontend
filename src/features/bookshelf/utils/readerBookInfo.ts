import type { CachedChapter, ChapterItem, ShelfBook } from '@/stores';
import type { ReaderBookInfo } from '@/components/reader/types';

export function shelfBookToReaderBookInfo(book: ShelfBook): ReaderBookInfo {
  return {
    name: book.name,
    author: book.author,
    coverUrl: book.coverUrl,
    intro: book.intro,
    kind: book.kind,
    bookUrl: book.bookUrl,
    sourceName: book.sourceName,
    fileName: book.fileName,
    lastChapter: book.lastChapter,
    totalChapters: book.totalChapters,
    addedAt: book.addedAt,
    lastReadAt: book.lastReadAt,
  };
}

export function cachedChaptersToChapterItems(chapters: CachedChapter[]): ChapterItem[] {
  return chapters.map((chapter) => ({ name: chapter.name, url: chapter.url, group: chapter.group }));
}

export function chapterItemsToCachedChapters(chapters: ChapterItem[]): CachedChapter[] {
  return chapters.map((chapter, index) => ({
    index,
    name: chapter.name,
    url: chapter.url,
    group: chapter.group,
  }));
}
