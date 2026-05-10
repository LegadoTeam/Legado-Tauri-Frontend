import { defineStore } from 'pinia';
import { computed } from 'vue';
import { useDynamicConfig } from '@/composables/useDynamicConfig';

export interface BookmarkEntry {
  id: string;
  /** 书架书籍的 bookUrl（本地文件可能为空字符串） */
  bookUrl: string;
  /** 文件名，作为备用唯一标识 */
  fileName: string;
  chapterIndex: number;
  chapterName: string;
  text: string;
  createdAt: number;
}

interface BookmarksState {
  items: BookmarkEntry[];
}

export const useReaderBookmarksStore = defineStore('readerBookmarks', () => {
  const config = useDynamicConfig<BookmarksState>({
    namespace: 'reader-bookmarks',
    version: 1,
    defaults: () => ({ items: [] }),
  });

  const bookmarks = computed(() => config.state.items as BookmarkEntry[]);

  function getChapterBookmarks(
    bookUrl: string,
    fileName: string,
    chapterIndex: number,
  ): BookmarkEntry[] {
    return (config.state.items as BookmarkEntry[]).filter(
      (b) =>
        b.fileName === fileName &&
        b.chapterIndex === chapterIndex &&
        b.bookUrl === bookUrl,
    );
  }

  function findBookmark(
    bookUrl: string,
    fileName: string,
    chapterIndex: number,
    text: string,
  ): BookmarkEntry | undefined {
    return (config.state.items as BookmarkEntry[]).find(
      (b) =>
        b.fileName === fileName &&
        b.chapterIndex === chapterIndex &&
        b.text === text &&
        b.bookUrl === bookUrl,
    );
  }

  async function addBookmark(
    entry: Omit<BookmarkEntry, 'id' | 'createdAt'>,
  ): Promise<void> {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const items: BookmarkEntry[] = [
      ...(config.state.items as BookmarkEntry[]),
      { ...entry, id, createdAt: Date.now() },
    ];
    await config.replace({ items });
  }

  async function removeBookmark(id: string): Promise<void> {
    const items = (config.state.items as BookmarkEntry[]).filter((b) => b.id !== id);
    await config.replace({ items });
  }

  return {
    bookmarks,
    getChapterBookmarks,
    findBookmark,
    addBookmark,
    removeBookmark,
  };
});
