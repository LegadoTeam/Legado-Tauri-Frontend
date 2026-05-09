/**
 * useBookshelf — 书架数据管理
 *
 * 封装全部书架 Tauri 命令调用，提供响应式书架状态与 CRUD 操作。
 * 全局单例模式，可在任意组件中 `const shelf = useBookshelf()` 使用。
 */

import { ref } from 'vue';
import { invokeWithTimeout } from './useInvoke';

// ── 类型定义 ──────────────────────────────────────────────────────────────

export interface ShelfBook {
  id: string;
  name: string;
  author: string;
  coverUrl?: string;
  /** 封面图片下载时所需的 Referer（来自书源 `@url`），配合 BookCoverImg 缓存使用 */
  coverReferer?: string;
  intro?: string;
  kind?: string;
  bookUrl: string;
  fileName: string;
  sourceName: string;
  lastChapter?: string;
  addedAt: number;
  lastReadAt: number;
  /** 当前阅读到的章节索引，-1 = 未开始 */
  readChapterIndex: number;
  readChapterUrl?: string;
  totalChapters: number;
  /** 书源类型："novel"（默认）| "comic" | "video" */
  sourceType: string;
  /** 分页模式下的页码索引，-1 = 未记录 */
  readPageIndex: number;
  /** 滚动模式下的滚动比例 0-1，-1 = 未记录 */
  readScrollRatio: number;
  /** 视频播放进度（秒），-1 = 未记录 */
  readPlaybackTime: number;
  /** 每本书独立阅读器设置（JSON 字符串），undefined = 使用全局 */
  readerSettings?: string;
  /** 是否为隐私书籍 */
  isPrivate: boolean;
}

export interface UpdateShelfBookPayload {
  id: string;
  name: string;
  author: string;
  coverUrl?: string;
  intro?: string;
  kind?: string;
  bookUrl: string;
  fileName: string;
  sourceName: string;
  lastChapter?: string;
  totalChapters: number;
  readChapterIndex: number;
  readChapterUrl?: string;
  sourceType: string;
  addedAt?: number;
  lastReadAt?: number;
  readPageIndex?: number;
  readScrollRatio?: number;
  readPlaybackTime?: number;
  readerSettings?: string;
  isPrivate?: boolean;
  createSourceSwitchBackup?: boolean;
  clearContentCache?: boolean;
}

export interface PatchShelfBookPayload {
  name?: string;
  author?: string;
  coverUrl?: string;
  intro?: string;
  kind?: string;
  bookUrl?: string;
  fileName?: string;
  sourceName?: string;
  lastChapter?: string;
  totalChapters?: number;
  readChapterIndex?: number;
  readChapterUrl?: string;
  sourceType?: string;
  addedAt?: number;
  lastReadAt?: number;
  readPageIndex?: number;
  readScrollRatio?: number;
  readPlaybackTime?: number;
  readerSettings?: string;
  isPrivate?: boolean;
  createSourceSwitchBackup?: boolean;
  clearContentCache?: boolean;
}

export interface SourceSwitchRestoreResult {
  book: ShelfBook;
  chapters: CachedChapter[];
}

export interface AddBookPayload {
  name: string;
  author: string;
  coverUrl?: string;
  intro?: string;
  kind?: string;
  bookUrl: string;
  lastChapter?: string;
  /** 书源类型："novel"（默认）| "comic" | "video" */
  sourceType?: string;
}

export interface CachedChapter {
  index: number;
  name: string;
  url: string;
}

// ── 全局状态（单例） ──────────────────────────────────────────────────────

const books = ref<ShelfBook[]>([]);
/** bookUrl|fileName → id 的索引，用于快速判断是否在书架 */
const shelfIndex = ref(new Map());
let initialized = false;

function buildIndex(list: ShelfBook[]) {
  const map = new Map<string, string>();
  for (const b of list) {
    map.set(`${b.bookUrl}|${b.fileName}`, b.id);
  }
  shelfIndex.value = map;
}

// ── 超时常量（文件 CRUD） ─────────────────────────────────────────────────
const TIMEOUT = 10_000;

// ── 导出 ──────────────────────────────────────────────────────────────────

export function useBookshelf() {
  /** 加载/刷新书架列表 */
  async function loadBooks(): Promise<ShelfBook[]> {
    const list = await invokeWithTimeout<ShelfBook[]>('bookshelf_list', undefined, TIMEOUT);
    books.value = list;
    buildIndex(list);
    initialized = true;
    return list;
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
      {
        book,
        fileName,
        sourceName,
      },
      TIMEOUT,
    );
    // 刷新列表
    await loadBooks();
    return result;
  }

  /** 移出书架 */
  async function removeFromShelf(id: string): Promise<void> {
    await invokeWithTimeout<void>('bookshelf_remove', { id }, TIMEOUT);
    await loadBooks();
  }

  /** 获取单本详情 */
  async function getShelfBook(id: string): Promise<ShelfBook> {
    return invokeWithTimeout<ShelfBook>('bookshelf_get', { id }, TIMEOUT);
  }

  /** 更新阅读进度（支持分页页码 / 滚动比例 / 每本书独立设置） */
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
    // 同步更新内存缓存：确保关闭阅读器再次打开时 books.value 的数据是最新的，
    // 避免 openBook 使用旧 readChapterIndex 导致打开错误章节 / 无法恢复阅读位置。
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
    await invokeWithTimeout<void>(
      'bookshelf_save_chapters',
      {
        id,
        chapters,
      },
      TIMEOUT,
    );
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
      {
        book,
        chapters: chapters ?? null,
      },
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
    await invokeWithTimeout<void>(
      'bookshelf_save_content',
      {
        id,
        chapterIndex,
        content,
      },
      TIMEOUT,
    );
  }

  /** 读取缓存正文 */
  async function getContent(id: string, chapterIndex: number): Promise<string | null> {
    return invokeWithTimeout<string | null>(
      'bookshelf_get_content',
      {
        id,
        chapterIndex,
      },
      TIMEOUT,
    );
  }

  /** 删除单章正文缓存（幂等：文件不存在时也返回成功） */
  async function deleteContent(id: string, chapterIndex: number): Promise<void> {
    await invokeWithTimeout<void>(
      'bookshelf_delete_content',
      {
        id,
        chapterIndex,
      },
      TIMEOUT,
    );
  }

  /** 获取已缓存正文的章节索引集合（用于目录面板标记"已下载"状态） */
  async function getCachedIndices(id: string): Promise<Set<number>> {
    const list = await invokeWithTimeout<number[]>('bookshelf_get_cached_indices', { id }, TIMEOUT);
    return new Set(list);
  }

  /** 判断是否在书架中（同步，基于本地缓存） */
  function isOnShelf(bookUrl: string, fileName: string): boolean {
    return shelfIndex.value.has(`${bookUrl}|${fileName}`);
  }

  /** 获取书架中该书的 ID（不在书架返回 undefined） */
  function getShelfId(bookUrl: string, fileName: string): string | undefined {
    return shelfIndex.value.get(`${bookUrl}|${fileName}`);
  }

  /** 判断书架中的书是否为隐私书籍 */
  function isPrivateShelfBook(id: string): boolean {
    return books.value.find((book) => book.id === id)?.isPrivate ?? false;
  }

  return {
    /** 响应式书架列表 */
    books,
    loadBooks,
    ensureLoaded,
    addToShelf,
    removeFromShelf,
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
  };
}
