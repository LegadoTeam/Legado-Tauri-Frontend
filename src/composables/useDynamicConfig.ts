import { reactive, type UnwrapNestedRefs } from 'vue';
import {
  ensureFrontendNamespaceLoaded,
  getFrontendStorageItem,
  onFrontendStorageChange,
  setFrontendStorageItemAsync,
  legacyLocalStorageGet,
  legacyLocalStorageRemove,
  dbgLog,
} from './useFrontendStorage';

type DynamicConfigEnvelope<T> = {
  version: number;
  data: T;
};

type DynamicConfigMigrationContext = {
  storedVersion: number | null;
  storedData: unknown | null;
  readLegacy: (key: string) => string | null;
};

export interface DynamicConfigOptions<T extends Record<string, unknown>> {
  namespace: string;
  version: number;
  defaults: () => T;
  migrate?: (context: DynamicConfigMigrationContext) => T | null;
  legacyKeys?: string[];
}

export interface DynamicConfigStore<T extends Record<string, unknown>> {
  state: UnwrapNestedRefs<T>;
  /** 后端存储加载完成后 resolve，可用于 onMounted 中等待真实持久化数据就绪再读取状态 */
  ready: Promise<void>;
  reset: () => void;
  replace: (next: T) => Promise<void>;
  reload: () => void;
}

const storeRegistry = new Map<string, DynamicConfigStore<Record<string, unknown>>>();
const STORAGE_NAMESPACE_PREFIX = 'dynamic-config.';
const STATE_KEY = 'state';

function clonePlain<T>(value: T): T {
  // 用 JSON 往返而非 structuredClone，确保剥离 Vue Proxy 及不可克隆对象
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * 从后端内存缓存读取 envelope。
 * 仅在 ensureFrontendNamespaceLoaded 完成之后调用，此时缓存已有真实数据。
 */
function readFromCache<T>(namespace: string): DynamicConfigEnvelope<T> | null {
  try {
    const raw = getFrontendStorageItem(namespace, STATE_KEY);
    if (raw != null && raw !== '') {
      return JSON.parse(raw) as DynamicConfigEnvelope<T>;
    }
    return null;
  } catch {
    return null;
  }
}

/** 写入后端持久化存储，返回 Promise。关键路径应 await 此函数以确保写入成功。 */
function writeToBackend(namespace: string, version: number, data: unknown): Promise<void> {
  const payload: DynamicConfigEnvelope<unknown> = { version, data: clonePlain(data) };
  return setFrontendStorageItemAsync(namespace, STATE_KEY, JSON.stringify(payload));
}

function syncReactiveState<T extends Record<string, unknown>>(target: Record<string, unknown>, next: T) {
  const cloned = clonePlain(next);
  for (const key of Object.keys(target)) {
    if (!(key in cloned)) {
      delete (target as Record<string, unknown>)[key];
    }
  }
  Object.assign(target, cloned);
}

/**
 * 从已加载的后端缓存还原状态（版本匹配返回存储值，否则返回 defaults）。
 * 仅在 ready 之后调用。
 */
function hydrateFromCache<T extends Record<string, unknown>>(
  storageNamespace: string,
  options: DynamicConfigOptions<T>,
): T {
  const stored = readFromCache<T>(storageNamespace);
  if (stored?.version === options.version && stored.data && typeof stored.data === 'object') {
    return clonePlain(stored.data);
  }
  return clonePlain(options.defaults());
}

export function useDynamicConfig<T extends Record<string, unknown>>(
  options: DynamicConfigOptions<T>,
): DynamicConfigStore<T> {
  const existing = storeRegistry.get(options.namespace);
  if (existing) {
    return existing as DynamicConfigStore<T>;
  }

  const storageNamespace = `${STORAGE_NAMESPACE_PREFIX}${options.namespace}`;

  // 初始状态始终为 defaults；真实数据在 ready 之后通过 syncReactiveState 应用
  const state = reactive(clonePlain(options.defaults())) as UnwrapNestedRefs<T>;

  const persist = (): Promise<void> => {
    return writeToBackend(storageNamespace, options.version, state);
  };

  const readyPromise: Promise<void> = ensureFrontendNamespaceLoaded(
    storageNamespace,
    async (cachedValues) => {
      const keys = Object.keys(cachedValues);
      dbgLog(
        `[DynConfig] ${options.namespace}: ensureLoaded 回调，后端 key 数=${keys.length} | ` +
          (keys.length ? keys.join(', ') : '（空）'),
      );
      // 后端已有数据 → 直接使用，不做任何覆盖
      if (keys.length > 0) {
        return null;
      }
      // 后端无数据（首次使用）→ 尝试从旧 localStorage keys 一次性迁移
      const migrated = options.migrate?.({
        storedVersion: null,
        storedData: null,
        readLegacy: (key) => legacyLocalStorageGet(key),
      });
      if (migrated) {
        dbgLog(`[DynConfig] ${options.namespace}: 迁移旧数据成功 → ` + JSON.stringify(migrated));
        for (const legacyKey of options.legacyKeys ?? []) {
          legacyLocalStorageRemove(legacyKey);
        }
        return {
          [STATE_KEY]: JSON.stringify({ version: options.version, data: migrated }),
        };
      }
      // 无迁移数据 → 将默认值持久化到后端，下次启动可直接命中预取缓存
      dbgLog(`[DynConfig] ${options.namespace}: 写入默认值到后端`);
      return {
        [STATE_KEY]: JSON.stringify({ version: options.version, data: options.defaults() }),
      };
    },
  ).then(() => {
    // 后端加载完毕，从缓存读取真实数据并更新响应式状态
    const hydrated = hydrateFromCache(storageNamespace, options);
    dbgLog(`[DynConfig] ${options.namespace}: ready，从后端还原的配置 → ` + JSON.stringify(hydrated));
    syncReactiveState(state, hydrated);
  });

  const store: DynamicConfigStore<T> = {
    state,
    ready: readyPromise,
    reset() {
      syncReactiveState(state, options.defaults());
      void persist();
    },
    replace(next) {
      syncReactiveState(state, next);
      return persist();
    },
    reload() {
      syncReactiveState(state, hydrateFromCache(storageNamespace, options));
    },
  };

  onFrontendStorageChange(({ namespace }) => {
    if (namespace !== storageNamespace) {
      return;
    }
    syncReactiveState(state, hydrateFromCache(storageNamespace, options));
  });

  storeRegistry.set(options.namespace, store as DynamicConfigStore<Record<string, unknown>>);
  return store;
}
