import type { MessageApi } from 'naive-ui';
import type { WholeBookSwitchedPayload } from '@/components/reader/types';
import { invokeWithTimeout } from '@/composables/useInvoke';
import {
  useBookshelfStore,
  useFrontendPluginsStore,
  type ChapterItem,
  type ShelfBook,
} from '@/stores';
import { useBookshelfReaderStore } from '../stores/bookshelfReader';
import { useBookshelfUiStore } from '../stores/bookshelfUi';

export function useBookshelfActions(message: MessageApi) {
  const bookshelfStore = useBookshelfStore();
  const frontendPluginsStore = useFrontendPluginsStore();
  const uiStore = useBookshelfUiStore();
  const readerStore = useBookshelfReaderStore();

  function syncOpenReaderBookInfo(bookId: string) {
    readerStore.syncOpenReaderBookInfo(bookshelfStore.books.find((book) => book.id === bookId));
  }

  async function handlePluginCoverGenerate(book: ShelfBook, generatorId: string) {
    try {
      const result = await frontendPluginsStore.runCoverGenerator(generatorId, book);
      if (!result?.coverUrl && !result?.patch) {
        message.info('插件未返回可写回的封面结果');
        return;
      }
      await bookshelfStore.patchBook(book.id, {
        ...result.patch,
        coverUrl: result.coverUrl ?? result.patch?.coverUrl,
      });
      syncOpenReaderBookInfo(book.id);
      message.success(result.message || '已写回插件生成的封面');
    } catch (error: unknown) {
      message.error(`插件封面生成失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function handleMenuSelect(key: string) {
    uiStore.closeContextMenu();
    if (!uiStore.contextBook) {
      return;
    }
    const book = uiStore.contextBook;
    if (key.startsWith('plugin-action:')) {
      try {
        const actionId = key.slice('plugin-action:'.length);
        await frontendPluginsStore.runBookshelfAction(actionId, book);
        await bookshelfStore.loadBooks();
        syncOpenReaderBookInfo(book.id);
      } catch (error: unknown) {
        message.error(`插件动作失败: ${error instanceof Error ? error.message : String(error)}`);
      }
      return;
    }
    if (key === 'open-cover-generator') {
      uiStore.coverGeneratorBook = book;
      uiStore.showCoverGeneratorDialog = true;
      return;
    }
    if (key === 'open-detail' || key === 'edit-detail') {
      uiStore.bookDetailBook = book;
      uiStore.bookDetailMode = key === 'edit-detail' ? 'edit' : 'view';
      uiStore.showBookDetailDialog = true;
      return;
    }
    if (key.startsWith('plugin-cover:')) {
      await handlePluginCoverGenerate(book, key.slice('plugin-cover:'.length));
      return;
    }
    if (key === 'remove') {
      try {
        await bookshelfStore.removeFromShelf(book.id);
        message.success('已移出书架');
      } catch (error: unknown) {
        message.error(`移出失败: ${error instanceof Error ? error.message : String(error)}`);
      }
      return;
    }
    if (key === 'toggle-private') {
      try {
        await bookshelfStore.setBookPrivate(book.id, !book.isPrivate);
        message.success(book.isPrivate ? '已取消隐私' : '已设为隐私');
      } catch (error: unknown) {
        message.error(`操作失败: ${error instanceof Error ? error.message : String(error)}`);
      }
      return;
    }
    if (key === 'reveal-dir') {
      try {
        await invokeWithTimeout('bookshelf_reveal_data_dir', { id: book.id }, 5000);
      } catch (error: unknown) {
        message.error(`打开目录失败: ${error instanceof Error ? error.message : String(error)}`);
      }
      return;
    }
    if (key === 'export') {
      uiStore.exportBook = book;
      try {
        uiStore.exportCachedChapters = await bookshelfStore.getChapters(book.id);
      } catch {
        uiStore.exportCachedChapters = [];
      }
      uiStore.showExportDialog = true;
      return;
    }
    if (key === 'switch-source') {
      uiStore.switchTargetBook = book;
      try {
        const cached = await bookshelfStore.getChapters(book.id);
        uiStore.switchTargetChapters = cached.map((chapter) => ({
          name: chapter.name,
          url: chapter.url,
        }));
      } catch {
        uiStore.switchTargetChapters = [];
      }
      uiStore.showSourceSwitchDialog = true;
      return;
    }
    if (key === 'restore-switch') {
      try {
        const restored = await bookshelfStore.restoreSourceSwitch(book.id);
        await bookshelfStore.loadBooks();
        if (readerStore.showReader && readerStore.readerShelfId === restored.book.id) {
          readerStore.applySourceSwitchToReader({
            shelfBook: restored.book,
            chapters: restored.chapters.map((chapter) => ({
              name: chapter.name,
              url: chapter.url,
            })),
            matchedChapterIndex: restored.book.readChapterIndex,
            matchedChapterUrl: restored.book.readChapterUrl,
            sourceSwitched: true,
          });
        }
        message.success('已恢复到上次换源前的状态');
      } catch (error: unknown) {
        message.error(`恢复失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  function handleReaderSourceSwitched(payload: WholeBookSwitchedPayload) {
    readerStore.applySourceSwitchToReader(payload);
    void bookshelfStore.loadBooks();
  }

  function handleWholeBookSwitched(payload: WholeBookSwitchedPayload) {
    if (readerStore.showReader && readerStore.readerShelfId === payload.shelfBook.id) {
      readerStore.applySourceSwitchToReader(payload);
    }
    void bookshelfStore.loadBooks();
  }

  function currentChaptersForSwitch(targetBook: ShelfBook | null): ChapterItem[] {
    return readerStore.readerShelfId === targetBook?.id
      ? readerStore.readerChapters
      : uiStore.switchTargetChapters;
  }

  return {
    handleMenuSelect,
    handleReaderSourceSwitched,
    handleWholeBookSwitched,
    currentChaptersForSwitch,
    syncOpenReaderBookInfo,
  };
}
