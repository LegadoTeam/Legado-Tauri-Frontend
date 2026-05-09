import { invokeWithTimeout } from './useInvoke';
import { transportEmit } from './useTransport';

const STORAGE_EVENT = 'legado:frontend-storage-changed';
const TIMEOUT = 10_000;

/** 向日志窗口发送调试信息（同时保留 console.log） */
export function dbgLog(msg: string, warn = false) {
  if (warn) {
    console.warn(msg);
  } else {
    console.log(msg);
  }
  void transportEmit('app:log', { message: msg }).catch(() => {});
}

type NamespaceCache = {
  loaded: boolean;
  values: Record<string, string>;
  loading: Promise<void> | null;
};

const namespaceCache = new Map<string, NamespaceCache>();

export interface FrontendStorageEntry {
  key: string;
  value: string;
}

export interface FrontendStorageNamespaceSummary {
  namespace: string;
  count: number;
}

export interface StorageDebugDump {
  appConfig?: unknown;
  frontend: Record<string, Record<string, string>>;
  scriptJson: Record<string, Record<string, string>>;
  scriptBytes: Record<string, Record<string, number>>;
  clientStates: Record<string, string>;
  appStatePath?: string | null;
  bookshelfPath?: string | null;
}

function getNamespaceState(namespace: string): NamespaceCache {
  let state = namespaceCache.get(namespace);
  if (!state) {
    state = {
      loaded: false,
      values: {},
      loading: null,
    };
    namespaceCache.set(namespace, state);
  }
  return state;
}

function emitStorageChange(namespace: string, key?: string) {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(
    new CustomEvent(STORAGE_EVENT, {
      detail: { namespace, key: key ?? null },
    }),
  );
}

export function onFrontendStorageChange(
  listener: (payload: { namespace: string; key?: string }) => void,
) {
  if (typeof window === 'undefined') {
    return () => {};
  }
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<{ namespace: string; key?: string }>).detail;
    listener(detail);
  };
  window.addEventListener(STORAGE_EVENT, handler);
  return () => window.removeEventListener(STORAGE_EVENT, handler);
}

export function legacyLocalStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function legacyLocalStorageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function legacyLocalStorageRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function legacyLocalStorageEntries(prefix: string): Record<string, string> {
  if (typeof localStorage === 'undefined') {
    return {};
  }
  const result: Record<string, string> = {};
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith(prefix)) {
        continue;
      }
      const value = localStorage.getItem(key);
      if (value !== null) {
        result[key] = value;
      }
    }
  } catch {
    /* ignore */
  }
  return result;
}

export async function ensureFrontendNamespaceLoaded(
  namespace: string,
  migrate?: (
    cachedValues: Record<string, string>,
  ) => Promise<Record<string, string> | null> | Record<string, string> | null,
): Promise<Record<string, string>> {
  const state = getNamespaceState(namespace);
  if (state.loaded) {
    return state.values;
  }
  state.loading ??= (async () => {
    const entries = await invokeWithTimeout<FrontendStorageEntry[]>(
      'frontend_storage_list',
      { namespace },
      TIMEOUT,
    ).catch(() => []);
    state.values = Object.fromEntries(entries.map((entry) => [entry.key, entry.value]));
    state.loaded = true;

    if (migrate) {
      const migrated = await migrate({ ...state.values });
      if (migrated && Object.keys(state.values).length === 0) {
        for (const [key, value] of Object.entries(migrated)) {
          state.values[key] = value;
          // 后端写入失败（如 Web 模式无 WS）不应阻断流程，数据已写入内存缓存
          await invokeWithTimeout<void>(
            'frontend_storage_set',
            { namespace, key, value },
            TIMEOUT,
          ).catch(() => {});
        }
      }
    }

    emitStorageChange(namespace);
  })().finally(() => {
    state.loading = null;
  });
  await state.loading;
  return state.values;
}

export function getFrontendStorageItem(namespace: string, key: string): string | null {
  return getNamespaceState(namespace).values[key] ?? null;
}

export async function getFrontendStorageItemAsync(
  namespace: string,
  key: string,
): Promise<string | null> {
  await ensureFrontendNamespaceLoaded(namespace);
  return getFrontendStorageItem(namespace, key);
}

/** 更新内存缓存并异步写入后端（fire-and-forget，不需要等待完成） */
export function setFrontendStorageItem(namespace: string, key: string, value: string): void {
  void setFrontendStorageItemAsync(namespace, key, value);
}

/**
 * 更新内存缓存并异步写入后端，返回 Promise。
 * 关键业务路径（如按鈕确认）应使用此方法并 await，确保数据写入后端后再继续。
 */
export async function setFrontendStorageItemAsync(
  namespace: string,
  key: string,
  value: string,
): Promise<void> {
  const state = getNamespaceState(namespace);
  state.values[key] = value;
  state.loaded = true;
  emitStorageChange(namespace, key);
  const preview = value.length > 120 ? value.slice(0, 120) + '…' : value;
  dbgLog(`[Storage] set ${namespace}/${key} = ${preview}`);
  try {
    await invokeWithTimeout<void>('frontend_storage_set', { namespace, key, value }, TIMEOUT);
    dbgLog(`[Storage] set ${namespace}/${key}: 后端写入成功`);
  } catch (err) {
    dbgLog(`[Storage] set ${namespace}/${key}: 后端写入失败 → ` + String(err), true);
    throw err;
  }
}

export function removeFrontendStorageItem(namespace: string, key: string): void {
  const state = getNamespaceState(namespace);
  delete state.values[key];
  state.loaded = true;
  emitStorageChange(namespace, key);
  void invokeWithTimeout<void>('frontend_storage_remove', { namespace, key }, TIMEOUT);
}

export function listFrontendStorageNamespaceSync(namespace: string): Record<string, string> {
  return { ...getNamespaceState(namespace).values };
}

export async function listFrontendStorageNamespaces(): Promise<FrontendStorageNamespaceSummary[]> {
  return invokeWithTimeout<FrontendStorageNamespaceSummary[]>(
    'frontend_storage_list_namespaces',
    undefined,
    TIMEOUT,
  );
}

/**
 * 应用启动时调用一次，从后端批量拉取所有已存在命名空间的数据到内存缓存。
 * 完成后 useDynamicConfig 的 ready 可瞬间 resolve。
 */
export async function initFrontendStorage(): Promise<void> {
  try {
    console.log('[Storage] initFrontendStorage: 开始从后端拉取所有命名空间');
    const namespaces = await invokeWithTimeout<FrontendStorageNamespaceSummary[]>(
      'frontend_storage_list_namespaces',
      undefined,
      5_000,
    ).catch((err) => {
      console.warn('[Storage] initFrontendStorage: list_namespaces 失败 →', String(err));
      return [] as FrontendStorageNamespaceSummary[];
    });

    console.log(
      `[Storage] initFrontendStorage: 共 ${namespaces.length} 个命名空间:`,
      namespaces.map((n) => n.namespace).join(', ') || '（空）',
    );

    await Promise.all(
      namespaces.map(async ({ namespace }) => {
        const state = getNamespaceState(namespace);
        if (state.loaded) {
          console.log(`[Storage] ${namespace}: 已在缓存，跳过`);
          return;
        }
        const entries = await invokeWithTimeout<FrontendStorageEntry[]>(
          'frontend_storage_list',
          { namespace },
          5_000,
        ).catch((err) => {
          console.warn(`[Storage] ${namespace}: list 失败 →`, String(err));
          return [] as FrontendStorageEntry[];
        });
        state.values = Object.fromEntries(entries.map((e) => [e.key, e.value]));
        state.loaded = true;
        console.log(
          `[Storage] ${namespace}: 加载完成，${entries.length} 条记录`,
          entries.map((e) => e.key).join(', ') || '（空）',
        );
      }),
    );
    dbgLog('[Storage] initFrontendStorage: 全部命名空间加载完毕');
  } catch (err) {
    dbgLog('[Storage] initFrontendStorage: 意外错误 → ' + String(err), true);
  }
}

export async function loadStorageDebugDump(): Promise<StorageDebugDump> {
  return invokeWithTimeout<StorageDebugDump>('storage_debug_dump', undefined, TIMEOUT);
}

export function readFrontendStorageJson<T>(namespace: string, key: string, fallback: T): T {
  const raw = getFrontendStorageItem(namespace, key);
  if (!raw) {
    return structuredCloneFallback(fallback);
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return structuredCloneFallback(fallback);
  }
}

export function setFrontendStorageJson(namespace: string, key: string, value: unknown): void {
  setFrontendStorageItem(namespace, key, JSON.stringify(value));
}

function structuredCloneFallback<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}
