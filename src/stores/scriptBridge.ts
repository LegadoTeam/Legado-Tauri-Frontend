import { defineStore } from 'pinia';
import { reactive, readonly } from 'vue';
import { isTauri } from '@/composables/useEnv';
import { eventListen } from '@/composables/useEventBus';
import { invokeWithTimeout } from '@/composables/useInvoke';
import { isTransportAvailable } from '@/composables/useTransport';
import type { CoverImageInput } from '@/utils/coverImage';
import { safeRandomUUID } from '@/utils/uuid';
import { usePreferencesStore } from './preferences';

// ── 类型定义（与 useScriptBridge 保持一致）──────────────────────────────

export interface ScriptLog {
  time: number;
  message: string;
  source?: 'rust' | 'app';
}

export interface ScriptUiEvent {
  event: string;
  data: unknown;
}

export interface DialogRequest {
  id: string;
  title: string;
  content: unknown;
  kind: string;
}

export interface BookItem {
  name: string;
  author: string;
  bookUrl: string;
  coverUrl?: CoverImageInput;
  lastChapter?: string;
  latestChapter?: string;
  latestChapterUrl?: string;
  wordCount?: string;
  chapterCount?: number;
  updateTime?: string;
  status?: string;
  kind?: string;
  intro?: string;
}

export interface BookDetail {
  name: string;
  author: string;
  coverUrl?: CoverImageInput;
  intro?: string;
  kind?: string;
  lastChapter?: string;
  latestChapter?: string;
  latestChapterUrl?: string;
  wordCount?: string;
  chapterCount?: number;
  updateTime?: string;
  status?: string;
  tocUrl?: string;
}

export interface ChapterItem {
  name: string;
  url: string;
  group?: string;
}

export interface ChapterGroup {
  name: string;
  chapters: ChapterItem[];
}

export function groupChapters(chapters: ChapterItem[]): ChapterGroup[] {
  const hasGroup = chapters.some((ch) => ch.group);
  if (!hasGroup) return [];
  const map = new Map<string, ChapterItem[]>();
  const order: string[] = [];
  for (const ch of chapters) {
    const key = ch.group || '';
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(ch);
  }
  return order.map((key) => ({ name: key || '默认', chapters: map.get(key)! }));
}

export const useScriptBridgeStore = defineStore('scriptBridge', () => {
  const state = reactive({
    logs: [] as ScriptLog[],
    dialogs: [] as DialogRequest[],
    lastUiEvent: null as ScriptUiEvent | null,
    initialized: false,
  });

  const unlisteners: (() => void)[] = [];

  function pushLog(entry: ScriptLog) {
    state.logs.push(entry);
    if (state.logs.length > 500) {
      state.logs.shift();
    }
  }

  async function initialize() {
    if (state.initialized) return;

    const available = await isTransportAvailable();
    if (!available) {
      state.initialized = true;
      return;
    }

    state.initialized = true;

    unlisteners.push(
      await eventListen<{ message: string }>('script:log', (e) => {
        pushLog({ time: Date.now(), message: e.payload.message });
      }),
    );

    unlisteners.push(
      await eventListen<{ message: string }>('rust:log', (e) => {
        pushLog({ time: Date.now(), message: e.payload.message, source: 'rust' });
      }),
    );

    unlisteners.push(
      await eventListen<{ message: string; level?: string }>('app:log', (e) => {
        pushLog({ time: Date.now(), message: e.payload.message, source: 'app' });
      }),
    );

    unlisteners.push(
      await eventListen<ScriptUiEvent>('script:ui', (e) => {
        state.lastUiEvent = e.payload;
        if (e.payload.event === 'dialog:open') {
          const req = e.payload.data as DialogRequest;
          state.dialogs.push(req);
        }
      }),
    );

    unlisteners.push(
      await eventListen<DialogRequest>('script:dialog:open', (e) => {
        state.dialogs.push(e.payload);
      }),
    );
  }

  // ── 公共 API ──────────────────────────────────────────────────────────

  async function resolveDialog(id: string, value: unknown) {
    const idx = state.dialogs.findIndex((d) => d.id === id);
    if (idx !== -1) {
      state.dialogs.splice(idx, 1);
    }
    await invokeWithTimeout('script_dialog_result', { id, value }, 10000);
  }

  function openDialog(req: Omit<DialogRequest, 'id'>): string {
    const id = safeRandomUUID();
    state.dialogs.push({ id, ...req });
    return id;
  }

  async function runSearch(fileName: string, keyword: string, page = 1, sourceDir?: string) {
    const prefs = usePreferencesStore();
    const timeoutMs = (prefs.search.searchTimeoutSecs || 35) * 1000;
    return invokeWithTimeout<unknown>(
      'booksource_search',
      { fileName, keyword, page, sourceDir: sourceDir ?? null },
      timeoutMs,
    );
  }

  async function runBookInfo(fileName: string, bookUrl: string, sourceDir?: string) {
    const prefs = usePreferencesStore();
    const timeoutMs = (prefs.search.searchTimeoutSecs || 35) * 1000;
    return invokeWithTimeout<unknown>(
      'booksource_book_info',
      { fileName, bookUrl, sourceDir: sourceDir ?? null },
      timeoutMs,
    );
  }

  async function runChapterList(
    fileName: string,
    bookUrl: string,
    taskId?: string,
    sourceDir?: string,
  ) {
    const prefs = usePreferencesStore();
    const timeoutMs = (prefs.search.chapterListTimeoutSecs || 125) * 1000;
    return invokeWithTimeout<unknown>(
      'booksource_chapter_list',
      { fileName, bookUrl, taskId: taskId ?? null, sourceDir: sourceDir ?? null },
      timeoutMs,
    );
  }

  async function cancelTask(taskId: string) {
    try {
      await invokeWithTimeout<void>('booksource_cancel', { taskId }, 3000);
    } catch {
      // 取消信号发送失败不影响 UI
    }
  }

  async function runChapterContent(
    fileName: string,
    chapterUrl: string,
    sourceDir?: string,
    categoryParams?: Record<string, string>,
  ) {
    const prefs = usePreferencesStore();
    const timeoutMs = (prefs.search.chapterContentTimeoutSecs || 35) * 1000;
    return invokeWithTimeout<unknown>(
      'booksource_chapter_content',
      {
        fileName,
        chapterUrl,
        sourceDir: sourceDir ?? null,
        categoryParams: categoryParams && Object.keys(categoryParams).length > 0 ? categoryParams : null,
      },
      timeoutMs,
    );
  }

  async function runExplore(
    fileName: string,
    category: string,
    page = 1,
    noCache = false,
    sourceDir?: string,
  ) {
    const prefs = usePreferencesStore();
    const timeoutMs = (prefs.search.exploreTimeoutSecs || 35) * 1000;
    return invokeWithTimeout<unknown>(
      'booksource_explore',
      { fileName, page, category, noCache: noCache || null, sourceDir: sourceDir ?? null },
      timeoutMs,
    );
  }

  async function clearExploreCache(fileName?: string) {
    return invokeWithTimeout<void>('explore_clear_cache', { fileName: fileName ?? null }, 5000);
  }

  async function replEval(code: string, contextFile?: string): Promise<string> {
    return invokeWithTimeout<string>(
      'script_repl_eval',
      { code, contextFile: contextFile ?? null },
      20000,
    );
  }

  async function callSourceFn(
    fileName: string,
    fnName: string,
    args: unknown[] = [],
    sourceDir?: string,
  ) {
    return invokeWithTimeout<unknown>(
      'booksource_call_fn',
      { fileName, fnName, args, sourceDir: sourceDir ?? null },
      35000,
    );
  }

  function clearLogs() {
    state.logs.splice(0, state.logs.length);
  }

  function appendDebugLog(message: string, source: 'rust' | 'app' | undefined = 'app') {
    pushLog({ time: Date.now(), message, source });
  }

  // 确保在 isTauri 环境下，initialize 在首次访问 store 时自动触发
  if (isTauri && !state.initialized) {
    initialize().catch((e) => console.error('[ScriptBridgeStore] 初始化失败:', e));
  }

  return {
    state: readonly(state) as typeof state,
    initialize,
    resolveDialog,
    openDialog,
    runSearch,
    runBookInfo,
    runChapterList,
    cancelTask,
    runChapterContent,
    runExplore,
    clearExploreCache,
    replEval,
    callSourceFn,
    clearLogs,
    appendDebugLog,
  };
});
