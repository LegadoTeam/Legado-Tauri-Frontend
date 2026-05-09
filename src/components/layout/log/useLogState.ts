import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue';
import { eventListen } from '@/composables/useEventBus';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface HttpDetail {
  url: string;
  method: string;
  status: number;
  elapsed: number;
  requestHeaders: Record<string, string>;
  requestBody?: string;
  responseHeaders: Record<string, string>;
  responseBody: string;
  error: string;
}

export interface LogEntry {
  id: number;
  time: number;
  type: 'script' | 'http' | 'ui' | 'browser' | 'system';
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  sourceName?: string;
  httpDetail?: HttpDetail;
}

export type FilterType = 'all' | 'script' | 'http' | 'ui' | 'browser' | 'system';

const MAX_LOGS = 5000;

// ─────────────────────────────────────────────────────────────
// Composable
// ─────────────────────────────────────────────────────────────

export function useLogState(scrollElRef: { value: HTMLElement | null }) {
  let nextId = 1;

  const logs = ref<LogEntry[]>([]);
  const filterType = ref<FilterType>('all');
  const filterText = ref('');
  const filterSource = ref('');
  const filterLevel = ref<'all' | 'debug' | 'info' | 'warn' | 'error'>('all');
  const paused = ref(false);
  const autoScroll = ref(true);
  const activeHttpTab = reactive<Record<number, 'headers' | 'response' | 'request'>>({});
  const expandedIds = ref<Set<number>>(new Set());
  /** 内容展开的日志条目 id（长消息） */
  const expandedMsgIds = ref<Set<number>>(new Set());

  // ── Helpers ──────────────────────────────────────────────────

  function inferLevel(type: LogEntry['type'], message: string): LogEntry['level'] {
    if (type === 'http') {
      if (/✗|error|failed/i.test(message)) return 'error';
      if (/[45][0-9][0-9]/.test(message)) return 'warn';
      return 'info';
    }
    const t = message.toLowerCase();
    if (t.includes('error') || t.includes('失败') || t.includes('异常')) return 'error';
    if (t.includes('warn') || t.includes('警告')) return 'warn';
    if (t.includes('debug')) return 'debug';
    return 'info';
  }

  function addLog(
    type: LogEntry['type'],
    message: string,
    opts?: { sourceName?: string; httpDetail?: HttpDetail; level?: LogEntry['level'] },
  ) {
    if (paused.value) return;
    logs.value.push({
      id: nextId++,
      time: Date.now(),
      type,
      level: opts?.level ?? inferLevel(type, message),
      message,
      sourceName: opts?.sourceName,
      httpDetail: opts?.httpDetail,
    });
    if (logs.value.length > MAX_LOGS) {
      logs.value.splice(0, logs.value.length - MAX_LOGS);
    }
  }

  function clearLogs() {
    logs.value = [];
    expandedIds.value.clear();
    expandedMsgIds.value.clear();
  }

  function formatTime(ts: number): string {
    const d = new Date(ts);
    return (
      d.toLocaleTimeString('zh-CN', { hour12: false }) +
      '.' +
      String(d.getMilliseconds()).padStart(3, '0')
    );
  }

  function scrollToBottom() {
    if (!autoScroll.value || !scrollElRef.value) return;
    scrollElRef.value.scrollTop = scrollElRef.value.scrollHeight;
  }

  function onScroll() {
    if (!scrollElRef.value) return;
    const el = scrollElRef.value;
    autoScroll.value = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }

  function toggleExpand(id: number) {
    if (expandedIds.value.has(id)) {
      expandedIds.value.delete(id);
    } else {
      expandedIds.value.add(id);
      if (!activeHttpTab[id]) {
        activeHttpTab[id] = 'headers';
      }
    }
  }

  function toggleExpandMsg(id: number) {
    if (expandedMsgIds.value.has(id)) {
      expandedMsgIds.value.delete(id);
    } else {
      expandedMsgIds.value.add(id);
    }
  }

  // ── Computed ─────────────────────────────────────────────────

  const sourceNames = computed(() => {
    const names = new Set<string>();
    for (const l of logs.value) {
      if (l.sourceName) names.add(l.sourceName);
    }
    return Array.from(names).toSorted();
  });

  const counts = computed(() => {
    const c = { all: 0, script: 0, http: 0, ui: 0, browser: 0, system: 0 };
    for (const l of logs.value) {
      c.all++;
      if (l.type in c) (c as Record<string, number>)[l.type]++;
    }
    return c;
  });

  const filteredLogs = computed(() => {
    let r = logs.value;
    if (filterType.value !== 'all') r = r.filter((l) => l.type === filterType.value);
    if (filterLevel.value !== 'all') r = r.filter((l) => l.level === filterLevel.value);
    if (filterSource.value) r = r.filter((l) => l.sourceName === filterSource.value);
    if (filterText.value) {
      const kw = filterText.value.toLowerCase();
      r = r.filter(
        (l) =>
          l.message.toLowerCase().includes(kw) ||
          (l.sourceName?.toLowerCase().includes(kw) ?? false),
      );
    }
    return r;
  });

  const unreadErrorCount = computed(() => {
    let count = 0;
    for (const l of logs.value) {
      if (l.level === 'error' || l.level === 'warn') count++;
    }
    return Math.min(count, 99);
  });

  // ── Event Listeners ──────────────────────────────────────────

  const unlisteners: (() => void)[] = [];

  async function install() {
    unlisteners.push(
      await eventListen<{ message: string; sourceName?: string }>('script:log', (e) => {
        addLog('script', e.payload.message, { sourceName: e.payload.sourceName });
      }),
    );

    unlisteners.push(
      await eventListen<{
        url: string;
        method: string;
        ok: boolean;
        status?: number;
        elapsed?: number;
        requestHeaders?: Record<string, string>;
        requestBody?: string;
        responseHeaders?: Record<string, string>;
        responseBody?: string;
        error?: string;
        sourceName?: string;
      }>('script:http', (e) => {
        const p = e.payload;
        const sc = p.status ? ` ${p.status}` : '';
        const ms = p.elapsed != null ? ` ${p.elapsed}ms` : '';
        addLog('http', `${p.ok ? '✓' : '✗'}${sc} ${p.method} ${p.url}${ms}`, {
          sourceName: p.sourceName,
          level: p.ok ? 'info' : 'error',
          httpDetail: {
            url: p.url,
            method: p.method,
            status: p.status ?? 0,
            elapsed: p.elapsed ?? 0,
            requestHeaders: p.requestHeaders ?? {},
            requestBody: p.requestBody,
            responseHeaders: p.responseHeaders ?? {},
            responseBody: p.responseBody ?? '',
            error: p.error ?? '',
          },
        });
      }),
    );

    unlisteners.push(
      await eventListen<{ event: string; data: unknown; sourceName?: string }>('script:ui', (e) => {
        addLog('ui', `[${e.payload.event}] ${JSON.stringify(e.payload.data)}`, {
          sourceName: e.payload.sourceName,
        });
      }),
    );

    unlisteners.push(
      await eventListen<{ message: string; level?: string }>('app:log', (e) => {
        addLog('system', e.payload.message, {
          sourceName: 'frontend',
          level: (e.payload.level?.toLowerCase() as LogEntry['level'] | undefined) ?? 'info',
        });
      }),
    );

    unlisteners.push(
      await eventListen<{ message: string }>('rust:log', (e) => {
        addLog('system', e.payload.message, { sourceName: 'rust' });
      }),
    );

    unlisteners.push(
      await eventListen<{ event: string; data: unknown }>('script:browser', (e) => {
        addLog('browser', `[${e.payload.event}] ${JSON.stringify(e.payload.data)}`);
      }),
    );

    unlisteners.push(
      await eventListen<unknown>('booksource:changed', (e) => {
        const payload = typeof e.payload === 'string' ? e.payload : JSON.stringify(e.payload);
        addLog('system', `[文件变化] ${payload}`);
      }),
    );

    addLog('system', '日志窗口已就绪，正在监听事件…');
  }

  function uninstall() {
    unlisteners.forEach((fn) => fn());
    unlisteners.length = 0;
  }

  onMounted(() => {
    void install();
  });

  onUnmounted(() => {
    uninstall();
  });

  return {
    logs,
    filterType,
    filterText,
    filterSource,
    filterLevel,
    paused,
    autoScroll,
    activeHttpTab,
    expandedIds,
    expandedMsgIds,
    sourceNames,
    counts,
    filteredLogs,
    unreadErrorCount,
    addLog,
    clearLogs,
    formatTime,
    scrollToBottom,
    onScroll,
    toggleExpand,
    toggleExpandMsg,
  };
}
