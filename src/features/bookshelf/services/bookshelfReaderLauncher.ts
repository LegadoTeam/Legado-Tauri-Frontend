import type { MessageApi } from 'naive-ui';
import {
  useBookshelfStore,
  useMusicPlayerStore,
  useScriptBridgeStore,
  type ChapterItem,
  type ShelfBook,
} from '@/stores';
import { useTocAutoUpdate } from '@/composables/useTocAutoUpdate';
import { useBookshelfReaderStore } from '../stores/bookshelfReader';
import { useBookshelfUiStore } from '../stores/bookshelfUi';
import { chapterItemsToCachedChapters } from '../utils/readerBookInfo';

export function useBookshelfReaderLauncher(message: MessageApi) {
  const readerStore = useBookshelfReaderStore();
  const uiStore = useBookshelfUiStore();
  const bookshelfStore = useBookshelfStore();
  const scriptBridgeStore = useScriptBridgeStore();
  const musicPlayer = useMusicPlayerStore();
  const tocAutoUpdate = useTocAutoUpdate();

  async function openBook(book: ShelfBook) {
    readerStore.setBookMeta(book);

    try {
      const cached = await bookshelfStore.getChapters(book.id);
      readerStore.setCachedChapters(cached);
    } catch {
      readerStore.setChapters([]);
    }
    // 异步加载集数播放进度（不阻塞打开）
    readerStore.loadEpisodeProgress(book.id).catch(() => {});

    if (!readerStore.readerChapters.length) {
      if (!book.bookUrl || !book.fileName) {
        message.warning('无法获取书籍地址，请从发现页重新打开');
        return;
      }
      if (uiStore.openingBookId) {
        return;
      }
      uiStore.openingBookId = book.id;
      try {
        const info = await scriptBridgeStore.runBookInfo(book.fileName, book.bookUrl);
        const tocUrl = (info as { tocUrl?: string }).tocUrl ?? book.bookUrl;
        const raw = await scriptBridgeStore.runChapterList(book.fileName, tocUrl);
        const fetched = (raw as Array<{ name: string; url: string; group?: string }>).map((chapter, index) => ({
          index,
          name: chapter.name,
          url: chapter.url,
          group: chapter.group,
        }));
        readerStore.setChapters(
          fetched.map((chapter) => ({ name: chapter.name, url: chapter.url, group: chapter.group })),
        );
        await bookshelfStore.saveChapters(book.id, fetched);
      } catch (error: unknown) {
        message.error(
          `加载章节目录失败：${error instanceof Error ? error.message : String(error)}`,
        );
        return;
      } finally {
        uiStore.openingBookId = null;
      }
      if (!readerStore.readerChapters.length) {
        message.warning('书源未返回章节列表');
        return;
      }
    }

    const index = book.readChapterIndex >= 0 ? book.readChapterIndex : 0;
    if (book.sourceType === 'music') {
      await musicPlayer.playList(
        {
          shelfId: book.id,
          fileName: book.fileName,
          bookUrl: book.bookUrl,
          name: book.name,
          author: book.author,
          coverUrl: book.coverUrl,
          intro: book.intro,
          sourceName: book.sourceName,
        },
        readerStore.readerChapters.map((c) => ({ chapterUrl: c.url, name: c.name })),
        index,
      );
      return;
    }
    readerStore.openAt(index);

    // 后台静默检测目录更新（不阻塞打开，不弹任何消息）
    tocAutoUpdate.refreshOnBookOpen(book).then((newCount) => {
      if (newCount > 0) {
        // 更新阅读器中的章节列表
        bookshelfStore.getChapters(book.id).then((cached) => {
          if (readerStore.readerShelfId === book.id) {
            readerStore.setCachedChapters(cached);
          }
        });
      }
    });
  }

  async function refreshToc() {
    if (readerStore.refreshingToc) {
      return;
    }
    const bookUrl = readerStore.readerBookInfo?.bookUrl;
    const fileName = readerStore.readerFileName;
    if (!bookUrl || !fileName || !readerStore.readerShelfId) {
      message.warning('无法获取书籍地址，请先确保书籍已加入书架');
      return;
    }
    readerStore.refreshingToc = true;
    try {
      const info = await scriptBridgeStore.runBookInfo(fileName, bookUrl);
      const tocUrl = (info as { tocUrl?: string }).tocUrl ?? bookUrl;
      const raw = await scriptBridgeStore.runChapterList(fileName, tocUrl);
      const fetched = (raw as Array<{ name: string; url: string; group?: string }>).map((chapter, index) => ({
        index,
        name: chapter.name,
        url: chapter.url,
        group: chapter.group,
      }));
      const oldUrls = new Set(readerStore.readerChapters.map((chapter) => chapter.url));
      const newCount = fetched.filter((chapter) => !oldUrls.has(chapter.url)).length;
      readerStore.setChapters(fetched.map((chapter) => ({ name: chapter.name, url: chapter.url, group: chapter.group })));
      await bookshelfStore.saveChapters(readerStore.readerShelfId, fetched);
      if (newCount > 0) {
        message.success(`目录已更新，新增 ${newCount} 章`);
      } else {
        message.info('目录已是最新，无新章节');
      }
    } catch (error: unknown) {
      message.error(`更新目录失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      readerStore.refreshingToc = false;
    }
  }

  function syncOpenReaderBookInfo(bookId: string) {
    readerStore.syncOpenReaderBookInfo(bookshelfStore.books.find((book) => book.id === bookId));
  }

  function currentChaptersForSwitch(targetBook: ShelfBook | null): ChapterItem[] {
    return readerStore.readerShelfId === targetBook?.id
      ? readerStore.readerChapters
      : uiStore.switchTargetChapters;
  }

  function saveReaderChaptersToPayload() {
    return chapterItemsToCachedChapters(readerStore.readerChapters);
  }

  return {
    openBook,
    refreshToc,
    syncOpenReaderBookInfo,
    currentChaptersForSwitch,
    saveReaderChaptersToPayload,
  };
}
