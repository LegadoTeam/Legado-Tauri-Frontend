/**
 * 发现分类缓存 + 发现书籍缓存（stale-while-revalidate）
 *
 * 命名空间：
 *   explore.cats  —— 分类列表  键：{fileName}  值：JSON 字符串数组
 *   explore.books —— 书籍列表  键：{fileName}|{category}  值：BooksCacheEntry JSON
 *
 * 使用方式：
 *  1. ExploreView.onMounted 中 await preloadExploreCategoryCache() / preloadExploreBooksCache()
 *  2. SourceExploreSection 中用相应 get/set 函数
 */
import type { BookItem } from '@/stores';
import {
  ensureFrontendNamespaceLoaded,
  getFrontendStorageItem,
  setFrontendStorageItem,
} from './useFrontendStorage';

// ── 分类缓存 ──────────────────────────────────────────────────────────────

const CATS_NS = 'explore.cats';

/** 预热命名空间（ExploreView mount 时调用一次） */
export async function preloadExploreCategoryCache(): Promise<void> {
  await ensureFrontendNamespaceLoaded(CATS_NS);
}

/** 同步读取缓存的分类列表，若不存在返回 null */
export function getCachedExploreCategories(fileName: string): string[] | null {
  const raw = getFrontendStorageItem(CATS_NS, fileName);
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return null;
    }
    return parsed.filter((v): v is string => typeof v === 'string');
  } catch {
    return null;
  }
}

/** 持久化分类列表（fire-and-forget） */
export function setCachedExploreCategories(fileName: string, cats: string[]): void {
  setFrontendStorageItem(CATS_NS, fileName, JSON.stringify(cats));
}

// ── 书籍缓存（第 1 页，有效期 1 天）────────────────────────────────────────

const BOOKS_NS = 'explore.books';
const BOOKS_TTL_MS = 24 * 60 * 60 * 1000; // 1 天

interface BooksCacheEntry {
  ts: number;
  books: BookItem[];
}

/** 拼接持久化 key */
function booksCacheKey(fileName: string, category: string): string {
  return `${fileName}|${category}`;
}

/** 预热命名空间（ExploreView mount 时调用一次） */
export async function preloadExploreBooksCache(): Promise<void> {
  await ensureFrontendNamespaceLoaded(BOOKS_NS);
}

/**
 * 同步读取缓存的书籍列表（仅第 1 页）。
 * 若不存在或已超过 1 天有效期，返回 null。
 */
export function getCachedExploreBooks(fileName: string, category: string): BookItem[] | null {
  const raw = getFrontendStorageItem(BOOKS_NS, booksCacheKey(fileName, category));
  if (!raw) {
    return null;
  }
  try {
    const entry = JSON.parse(raw) as BooksCacheEntry;
    if (!entry || typeof entry.ts !== 'number' || !Array.isArray(entry.books)) {
      return null;
    }
    if (Date.now() - entry.ts > BOOKS_TTL_MS) {
      return null;
    } // 已过期
    return entry.books;
  } catch {
    return null;
  }
}

/** 持久化书籍列表（仅第 1 页，fire-and-forget） */
export function setCachedExploreBooks(fileName: string, category: string, books: BookItem[]): void {
  const entry: BooksCacheEntry = { ts: Date.now(), books };
  setFrontendStorageItem(BOOKS_NS, booksCacheKey(fileName, category), JSON.stringify(entry));
}
