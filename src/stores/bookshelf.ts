import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import {
  type AddBookPayload,
  type CachedChapter,
  type EpisodeProgress,
  type PatchShelfBookPayload,
  type ShelfBook,
  type SourceSwitchRestoreResult,
  type UpdateShelfBookPayload,
} from '@/composables/useBookshelf';
import { invokeWithTimeout } from '@/composables/useInvoke';
import { eventListenSync } from '@/composables/useEventBus';
import { safeRandomUUID } from '@/utils/uuid';

/** 本地 TXT 书籍的虚拟书源文件名（用于识别本地书籍） */
export const LOCAL_TXT_FILE_NAME = '__local-txt__';
/** 本地 TXT 书籍的虚拟书源名称 */
export const LOCAL_TXT_SOURCE_NAME = '本地 TXT';

/** 判断一本书是否为本地 TXT 导入 */
export function isLocalTxtBook(book: { fileName: string }): boolean {
  return book.fileName === LOCAL_TXT_FILE_NAME;
}

const TIMEOUT = 10_000;

export const useBookshelfStore = defineStore('bookshelf', () => {
  const books = ref<ShelfBook[]>([]);
  /** bookUrl|fileName → id 的索引，用于快速判断是否在书架 */
  const shelfIndex = ref(new Map<string, string>());
  const loading = ref(false);
  let initialized = false;

  function buildIndex(list: ShelfBook[]) {
    const map = new Map<string, string>();
    for (const b of list) {
      map.set(`${b.bookUrl}|${b.fileName}`, b.id);
    }
    shelfIndex.value = map;
  }

  /** 加载/刷新书架列表 */
  async function loadBooks(): Promise<ShelfBook[]> {
    loading.value = true;
    try {
      const list = await invokeWithTimeout<ShelfBook[]>('bookshelf_list', undefined, TIMEOUT);
      books.value = list;
      buildIndex(list);
      initialized = true;
      return list;
    } finally {
      loading.value = false;
    }
  }

  /** 确保已初始化（首次调用会加载） */
  async function ensureLoaded() {
    if (!initialized) {
      await loadBooks();
    }
  }

  /** 加入书架 */
  async function addToShelf(
    book: AddBookPayload,
    fileName: string,
    sourceName: string,
  ): Promise<ShelfBook> {
    const result = await invokeWithTimeout<ShelfBook>(
      'bookshelf_add',
      { book, fileName, sourceName },
      TIMEOUT,
    );
    await loadBooks();
    return result;
  }

  /** 移出书架 */
  async function removeFromShelf(id: string): Promise<void> {
    await invokeWithTimeout<void>('bookshelf_remove', { id }, TIMEOUT);
    await loadBooks();
  }

  /**
   * 导入本地 TXT 书籍
   *
   * 1. 用随机 UUID 生成虚拟 bookUrl
   * 2. 加入书架（fileName = LOCAL_TXT_FILE_NAME）
   * 3. 保存章节目录（CachedChapter）
   * 4. 批量写入所有章节正文
   */
  async function importLocalTxt(payload: {
    title: string;
    author: string;
    chapters: Array<{ title: string; content: string }>;
    preface: string;
  }): Promise<ShelfBook> {
    const uuid = safeRandomUUID();
    const bookUrl = `local-txt://${uuid}`;

    const lastChapterTitle = payload.chapters[payload.chapters.length - 1]?.title ?? '';

    const shelfBook = await invokeWithTimeout<ShelfBook>(
      'bookshelf_add',
      {
        book: {
          name: payload.title,
          author: payload.author || undefined,
          bookUrl,
          lastChapter: lastChapterTitle || undefined,
          sourceType: 'novel',
        },
        fileName: LOCAL_TXT_FILE_NAME,
        sourceName: LOCAL_TXT_SOURCE_NAME,
      },
      TIMEOUT,
    );

    // 保存章节目录
    const cachedChapters: CachedChapter[] = payload.chapters.map((ch, idx) => ({
      index: idx,
      name: ch.title,
      url: `${bookUrl}:${idx}`,
    }));

    // 如果有前言，在章节目录前插入（索引 -1 用特殊章节名处理，或直接跳过前言附加至第0章）
    // 简单做法：将前言并入第0章内容
    const chapterContents: Array<{ title: string; content: string }> = payload.chapters.map(
      (ch, idx) => ({
        title: ch.title,
        content: idx === 0 && payload.preface ? `${payload.preface}\n\n${ch.content}` : ch.content,
      }),
    );

    await invokeWithTimeout<void>(
      'bookshelf_save_chapters',
      { id: shelfBook.id, chapters: cachedChapters },
      TIMEOUT,
    );

    // 批量写入正文（单次 IPC，不受章节数影响）
    await invokeWithTimeout<void>(
      'bookshelf_save_txt_chapters',
      {
        id: shelfBook.id,
        chapters: chapterContents.map((ch, idx) => ({ index: idx, content: ch.content })),
      },
      60_000, // 大文件宽限 60s
    );

    // 更新总章节数
    await invokeWithTimeout<void>(
      'bookshelf_update_book',
      {
        book: {
          id: shelfBook.id,
          name: shelfBook.name,
          author: shelfBook.author,
          coverUrl: shelfBook.coverUrl,
          intro: shelfBook.intro,
          kind: shelfBook.kind,
          bookUrl: shelfBook.bookUrl,
          fileName: shelfBook.fileName,
          sourceName: shelfBook.sourceName,
          lastChapter: lastChapterTitle || undefined,
          totalChapters: cachedChapters.length,
          readChapterIndex: shelfBook.readChapterIndex,
          readChapterUrl: shelfBook.readChapterUrl,
          sourceType: 'novel',
          addedAt: shelfBook.addedAt,
          lastReadAt: shelfBook.lastReadAt,
          readPageIndex: shelfBook.readPageIndex,
          readScrollRatio: shelfBook.readScrollRatio,
          readPlaybackTime: shelfBook.readPlaybackTime,
          readerSettings: shelfBook.readerSettings,
          isPrivate: shelfBook.isPrivate,
        },
        chapters: null,
      },
      TIMEOUT,
    );

    await loadBooks();
    return shelfBook;
  }

  /** 获取单本详情 */
  async function getShelfBook(id: string): Promise<ShelfBook> {
    return invokeWithTimeout<ShelfBook>('bookshelf_get', { id }, TIMEOUT);
  }

  /** 更新阅读进度 */
  async function updateProgress(
    id: string,
    chapterIndex: number,
    chapterUrl: string,
    opts?: {
      pageIndex?: number;
      scrollRatio?: number;
      playbackTime?: number;
      readerSettings?: string;
    },
  ): Promise<void> {
    await invokeWithTimeout<void>(
      'bookshelf_update_progress',
      {
        id,
        chapterIndex,
        chapterUrl,
        pageIndex: opts?.pageIndex,
        scrollRatio: opts?.scrollRatio,
        playbackTime: opts?.playbackTime,
        readerSettings: opts?.readerSettings,
      },
      TIMEOUT,
    );
    // 同步更新内存缓存
    const book = books.value.find((b) => b.id === id);
    if (book) {
      book.readChapterIndex = chapterIndex;
      book.readChapterUrl = chapterUrl;
      book.lastReadAt = Date.now();
      if (opts?.pageIndex !== undefined) book.readPageIndex = opts.pageIndex;
      if (opts?.scrollRatio !== undefined) book.readScrollRatio = opts.scrollRatio;
      if (opts?.playbackTime !== undefined) book.readPlaybackTime = opts.playbackTime;
      if (opts?.readerSettings !== undefined) book.readerSettings = opts.readerSettings;
    }
  }

  /** 更新书籍隐私标记 */
  async function setBookPrivate(id: string, isPrivate: boolean): Promise<void> {
    await invokeWithTimeout<void>('bookshelf_set_private', { id, isPrivate }, TIMEOUT);
    await loadBooks();
  }

  /** 保存章节目录 */
  async function saveChapters(id: string, chapters: CachedChapter[]): Promise<void> {
    await invokeWithTimeout<void>('bookshelf_save_chapters', { id, chapters }, TIMEOUT);
  }

  /** 获取缓存的章节目录 */
  async function getChapters(id: string): Promise<CachedChapter[]> {
    return invokeWithTimeout<CachedChapter[]>('bookshelf_get_chapters', { id }, TIMEOUT);
  }

  /** 更新书籍元信息，可选替换章节目录 */
  async function updateBook(
    book: UpdateShelfBookPayload,
    chapters?: CachedChapter[],
  ): Promise<ShelfBook> {
    const result = await invokeWithTimeout<ShelfBook>(
      'bookshelf_update_book',
      { book, chapters: chapters ?? null },
      TIMEOUT,
    );
    await loadBooks();
    return result;
  }

  /** 按字段局部更新书籍元信息 */
  async function patchBook(
    id: string,
    patch: PatchShelfBookPayload,
    chapters?: CachedChapter[],
  ): Promise<ShelfBook> {
    const current =
      books.value.find((item) => item.id === id) ??
      (await invokeWithTimeout<ShelfBook>('bookshelf_get', { id }, TIMEOUT));
    return updateBook(
      {
        id,
        name: patch.name ?? current.name,
        author: patch.author ?? current.author,
        coverUrl: patch.coverUrl ?? current.coverUrl,
        intro: patch.intro ?? current.intro,
        kind: patch.kind ?? current.kind,
        groupId: patch.groupId ?? current.groupId,
        bookUrl: patch.bookUrl ?? current.bookUrl,
        fileName: patch.fileName ?? current.fileName,
        sourceName: patch.sourceName ?? current.sourceName,
        lastChapter: patch.lastChapter ?? current.lastChapter,
        totalChapters: patch.totalChapters ?? current.totalChapters,
        readChapterIndex: patch.readChapterIndex ?? current.readChapterIndex,
        readChapterUrl: patch.readChapterUrl ?? current.readChapterUrl,
        sourceType: patch.sourceType ?? current.sourceType,
        addedAt: patch.addedAt ?? current.addedAt,
        lastReadAt: patch.lastReadAt ?? current.lastReadAt,
        readPageIndex: patch.readPageIndex ?? current.readPageIndex,
        readScrollRatio: patch.readScrollRatio ?? current.readScrollRatio,
        readPlaybackTime: patch.readPlaybackTime ?? current.readPlaybackTime,
        readerSettings: patch.readerSettings ?? current.readerSettings,
        isPrivate: patch.isPrivate ?? current.isPrivate,
        createSourceSwitchBackup: patch.createSourceSwitchBackup,
        clearContentCache: patch.clearContentCache,
      },
      chapters,
    );
  }

  /** 恢复最近一次整本换源 */
  async function restoreSourceSwitch(id: string): Promise<SourceSwitchRestoreResult> {
    const result = await invokeWithTimeout<SourceSwitchRestoreResult>(
      'bookshelf_restore_source_switch',
      { id },
      TIMEOUT,
    );
    await loadBooks();
    return result;
  }

  /** 缓存单章正文 */
  async function saveContent(id: string, chapterIndex: number, content: string): Promise<void> {
    await invokeWithTimeout<void>('bookshelf_save_content', { id, chapterIndex, content }, TIMEOUT);
  }

  /** 读取缓存正文 */
  async function getContent(id: string, chapterIndex: number): Promise<string | null> {
    return invokeWithTimeout<string | null>('bookshelf_get_content', { id, chapterIndex }, TIMEOUT);
  }

  /** 删除单章正文缓存 */
  async function deleteContent(id: string, chapterIndex: number): Promise<void> {
    await invokeWithTimeout<void>('bookshelf_delete_content', { id, chapterIndex }, TIMEOUT);
  }

  /** 获取已缓存正文的章节索引集合 */
  async function getCachedIndices(id: string): Promise<Set<number>> {
    const list = await invokeWithTimeout<number[]>('bookshelf_get_cached_indices', { id }, TIMEOUT);
    return new Set(list);
  }

  /** 获取全书各集播放进度 */
  async function getEpisodeProgress(id: string): Promise<Record<string, EpisodeProgress>> {
    return invokeWithTimeout<Record<string, EpisodeProgress>>(
      'bookshelf_get_episode_progress',
      { id },
      TIMEOUT,
    );
  }

  /** 保存单集播放进度 */
  async function saveEpisodeProgress(
    id: string,
    chapterUrl: string,
    time: number,
    duration: number,
  ): Promise<void> {
    await invokeWithTimeout<void>(
      'bookshelf_save_episode_progress',
      { id, chapterUrl, time, duration },
      TIMEOUT,
    );
  }

  /** 判断是否在书架中（同步，基于本地缓存） */
  function isOnShelf(bookUrl: string, fileName: string): boolean {
    return shelfIndex.value.has(`${bookUrl}|${fileName}`);
  }

  /** 获取书架中该书的 ID */
  function getShelfId(bookUrl: string, fileName: string): string | undefined {
    return shelfIndex.value.get(`${bookUrl}|${fileName}`);
  }

  /** 判断书架中的书是否为隐私书籍 */
  function isPrivateShelfBook(id: string): boolean {
    return books.value.find((book) => book.id === id)?.isPrivate ?? false;
  }

  /** 通过 ID 查找书籍 */
  const getBookById = computed(() => (id: string) => books.value.find((b) => b.id === id));

  // 监听后台封面下载完成事件，原地更新内存中的 coverUrl，触发 BookCoverImg 重新渲染
  eventListenSync<{ id: string; localRef: string }>('bookshelf:cover-cached', ({ payload }) => {
    const book = books.value.find((b) => b.id === payload.id);
    if (book) {
      book.coverUrl = payload.localRef;
    }
  });

  return {
    books,
    shelfIndex,
    loading,
    getBookById,
    loadBooks,
    ensureLoaded,
    addToShelf,
    removeFromShelf,
    importLocalTxt,
    getShelfBook,
    updateProgress,
    setBookPrivate,
    saveChapters,
    getChapters,
    updateBook,
    patchBook,
    restoreSourceSwitch,
    saveContent,
    getContent,
    deleteContent,
    getCachedIndices,
    isOnShelf,
    getShelfId,
    isPrivateShelfBook,
    getEpisodeProgress,
    saveEpisodeProgress,
  };
});
