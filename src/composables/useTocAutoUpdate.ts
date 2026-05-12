/**
 * useTocAutoUpdate — 书架目录自动更新
 *
 * 根据偏好设置，在打开图书或 App 启动时自动检测目录更新。
 * 每本书的最小检测间隔由 preferences.tocAutoUpdate.minIntervalSecs 控制（默认 2 小时）。
 * 最近检测时间以 bookId 为 key 持久化在前端存储中。
 */

import { useDynamicConfig } from './useDynamicConfig';
import { useBookshelfStore } from '@/stores/bookshelf';
import { LOCAL_TXT_FILE_NAME } from '@/stores/bookshelf';
import { useScriptBridgeStore } from '@/stores/scriptBridge';
import { usePreferencesStore } from '@/stores/preferences';
import type { ShelfBook } from '@/composables/useBookshelf';

// ── 最近检测时间持久化（bookId → timestamp ms） ───────────────────────────

const lastCheckConfig = useDynamicConfig<Record<string, number>>({
  namespace: 'toc.lastCheckTimes',
  version: 1,
  defaults: () => ({}),
});

function getLastCheckTime(bookId: string): number {
  return lastCheckConfig.state[bookId] ?? 0;
}

function setLastCheckTime(bookId: string, time: number) {
  lastCheckConfig.replace({ ...lastCheckConfig.state, [bookId]: time });
}

// ── 核心刷新逻辑 ─────────────────────────────────────────────────────────

/**
 * 刷新单本书的目录，并更新书架中的 totalChapters。
 * @returns 新增章节数量（-1 表示失败）
 */
async function refreshBookToc(
  book: ShelfBook,
  bookshelfStore: ReturnType<typeof useBookshelfStore>,
  scriptBridgeStore: ReturnType<typeof useScriptBridgeStore>,
): Promise<number> {
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

    const cached = await bookshelfStore.getChapters(book.id);
    const oldUrls = new Set(cached.map((c) => c.url));
    const newCount = fetched.filter((c) => !oldUrls.has(c.url)).length;

    await bookshelfStore.saveChapters(book.id, fetched);

    // 同步更新书架中的 totalChapters
    if (fetched.length !== book.totalChapters) {
      await bookshelfStore.patchBook(book.id, { totalChapters: fetched.length });
    }

    setLastCheckTime(book.id, Date.now());
    return newCount;
  } catch {
    return -1;
  }
}

// ── 导出函数 ─────────────────────────────────────────────────────────────

export function useTocAutoUpdate() {
  const preferencesStore = usePreferencesStore();
  const bookshelfStore = useBookshelfStore();
  const scriptBridgeStore = useScriptBridgeStore();

  /** 检查某本书是否需要更新（根据最小间隔时间限制） */
  function isRefreshDue(bookId: string): boolean {
    const minInterval = preferencesStore.tocAutoUpdate.minIntervalSecs * 1000;
    const last = getLastCheckTime(bookId);
    return Date.now() - last >= minInterval;
  }

  /**
   * 打开图书时触发的自动检测。
   * 仅在设置 enabled + onBookOpen 都开启，且距离上次检测超过最小间隔时才执行。
   * @returns 新增章节数（-1 = 跳过或失败，0 = 已是最新）
   */
  async function refreshOnBookOpen(book: ShelfBook): Promise<number> {
    const cfg = preferencesStore.tocAutoUpdate;
    if (!cfg.enabled || !cfg.onBookOpen) return -1;
    if (book.fileName === LOCAL_TXT_FILE_NAME) return -1; // 本地 TXT 书籍无需自动更新
    if (!isRefreshDue(book.id)) return -1;
    return refreshBookToc(book, bookshelfStore, scriptBridgeStore);
  }

  /**
   * App 启动时对所有书架书籍触发自动检测（逐本串行，避免并发打爆书源）。
   * 仅在设置 enabled + onAppStart 开启，且单本书距离上次超过最小间隔时才执行。
   */
  async function refreshAllOnAppStart(): Promise<void> {
    const cfg = preferencesStore.tocAutoUpdate;
    if (!cfg.enabled || !cfg.onAppStart) return;

    for (const book of bookshelfStore.books) {
      if (!book.fileName || !book.bookUrl) continue;
      if (book.fileName === LOCAL_TXT_FILE_NAME) continue;
      if (!isRefreshDue(book.id)) continue;
      await refreshBookToc(book, bookshelfStore, scriptBridgeStore);
    }
  }

  /**
   * 切换到书架视图时对所有书架书籍触发自动检测（逐本串行）。
   * 仅在设置 enabled + onShelfView 开启，且单本书距离上次超过最小间隔时才执行。
   */
  async function refreshAllOnShelfView(): Promise<void> {
    const cfg = preferencesStore.tocAutoUpdate;
    if (!cfg.enabled || !cfg.onShelfView) return;

    for (const book of bookshelfStore.books) {
      if (!book.fileName || !book.bookUrl) continue;
      if (book.fileName === LOCAL_TXT_FILE_NAME) continue;
      if (!isRefreshDue(book.id)) continue;
      await refreshBookToc(book, bookshelfStore, scriptBridgeStore);
    }
  }

  return {
    refreshOnBookOpen,
    refreshAllOnAppStart,
    refreshAllOnShelfView,
  };
}
