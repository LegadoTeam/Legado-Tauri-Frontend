import { computed, reactive, readonly } from 'vue';
import type { RuntimePluginRecord } from '@/features/frontendPlugins/pluginRuntimeTypes';
import type {
  ReaderPluginSlot,
  ReaderContentHookStage,
  ReaderLifecycleHook,
  PluginSettingValue,
  ReaderSessionSnapshot,
  ReaderContentPayload,
  ResolvedPluginSettingField,
  PluginDialogOptions,
  PluginDialogState,
  FrontendReaderThemeRecord,
  FrontendReaderBackgroundRecord,
  FrontendReaderSkinRecord,
  BookshelfActionContext,
  FrontendBookshelfActionRecord,
  FrontendReaderContextActionRecord,
  ReaderTextSelectionContext,
  CoverGeneratorContext,
  CoverGeneratorResult,
  FrontendCoverGeneratorRecord,
  CleanupFn,
  PluginSettingsContext,
  FrontendPluginRecord,
  FrontendPluginApi,
} from '@/features/frontendPlugins/pluginTypes';
import { BUILTIN_FRONTEND_PLUGINS } from '@/data/builtinPlugins';
import {
  computePublicThemeState,
  computePublicBackgroundState,
  computePublicSkinState,
  computeReaderAppearanceVars,
} from '@/features/frontendPlugins/pluginAppearanceSync';
import {
  buildPluginDialogState,
  isEntryVisible,
} from '@/features/frontendPlugins/pluginDialogUtils';
import { evaluatePlugin } from '@/features/frontendPlugins/pluginEvaluator';
import {
  notifySessionListeners,
  invokePluginHook,
  emitPluginLifecycle,
} from '@/features/frontendPlugins/pluginHookRunner';
import {
  requestPluginHttp,
  getShelfBookById,
  patchShelfBook,
} from '@/features/frontendPlugins/pluginHttpUtils';
import {
  ensurePluginOrderLoaded,
  readPluginOrder,
  sortExtensionsByPluginOrder,
  writePluginOrder,
} from '@/features/frontendPlugins/pluginOrder';
import { resolvePluginSettingFields } from '@/features/frontendPlugins/pluginSettings';
import { createSlotManager } from '@/features/frontendPlugins/pluginSlotManager';
import {
  buildPluginStorageApi,
  PLUGIN_STORAGE_KEYS,
  type PluginStorageApi,
} from '@/features/frontendPlugins/pluginStorage';
import {
  resolveExtensionAssetUrl,
  cloneValue,
  getChineseConverter,
} from '@/features/frontendPlugins/pluginTextUtils';
import { createEmptyHookMap } from '@/features/frontendPlugins/readerHooks';
import { createEmptySlotMap } from '@/features/frontendPlugins/readerSlots';
import { useAppConfigStore } from '@/stores/appConfig';
import type { ShelfBook } from './useBookshelf';
import { eventEmit, eventListenSync } from './useEventBus';
import {
  getExtensionDir,
  listExtensions,
  readExtension,
  toggleExtension,
  type ExtensionMeta,
} from './useExtension';

const SETTINGS_STORAGE_KEY = PLUGIN_STORAGE_KEYS.settings;

export const FRONTEND_PLUGIN_TOAST_EVENT = 'frontend-plugin:toast';

export type {
  ReaderPluginSlot,
  ReaderContentHookStage,
  ReaderLifecycleHook,
  FrontendPluginHookName,
  PluginSettingScalar,
  PluginSettingValue,
  ChineseConvertMode,
  PluginSettingInputType,
  ReaderAppearancePatch,
  ReaderSessionAppearanceState,
  ReaderSessionSnapshot,
  ReaderContentPayload,
  PluginSettingOption,
  PluginSettingField,
  ResolvedPluginSettingField,
  FrontendPluginHttpRequest,
  FrontendPluginHttpResponse,
  PluginDialogField,
  PluginDialogOptions,
  PluginDialogState,
  ReaderThemeDefinition,
  FrontendReaderThemeRecord,
  ReaderBackgroundDefinition,
  FrontendReaderBackgroundRecord,
  ReaderSkinDefinition,
  FrontendReaderSkinRecord,
  BookshelfActionContext,
  BookshelfActionDefinition,
  FrontendBookshelfActionRecord,
  ReaderContextActionDefinition,
  ReaderTextSelectionContext,
  FrontendReaderContextActionRecord,
  CoverGeneratorContext,
  CoverGeneratorResult,
  CoverGeneratorDefinition,
  FrontendCoverGeneratorRecord,
  CleanupFn,
  ReaderSessionListener,
  PluginHookHandler,
  ReaderSlotMount,
  PluginDynamicText,
  PluginSettingsContext,
  PluginSettingsDefinition,
  FrontendPluginRegistration,
  FrontendPluginRecord,
  ReaderBackgroundContext,
  ReaderThemeContext,
  ReaderSkinContext,
  FrontendPluginApi,
  PluginSettingsApi,
} from '@/features/frontendPlugins/pluginTypes';

const state = reactive({
  initialized: false,
  loading: false,
  contentVersion: 0,
  readerAppearanceVars: {} as Record<string, string>,
  lastLoadedAt: 0,
  plugins: [] as FrontendPluginRecord[],
  readerThemes: [] as FrontendReaderThemeRecord[],
  readerBackgrounds: [] as FrontendReaderBackgroundRecord[],
  readerSkins: [] as FrontendReaderSkinRecord[],
  bookshelfActions: [] as FrontendBookshelfActionRecord[],
  readerContextActions: [] as FrontendReaderContextActionRecord[],
  coverGenerators: [] as FrontendCoverGeneratorRecord[],
  pluginDialog: null as PluginDialogState | null,
});

let runtimePlugins: RuntimePluginRecord[] = [];
let loadPromise: Promise<void> | null = null;
let currentReaderSession: ReaderSessionSnapshot | null = null;
let externalListenersReady = false;
let extensionRootDir = '';
let activePluginDialogResolve: ((value: Record<string, PluginSettingValue> | null) => void) | null =
  null;

const slotManager = createSlotManager({
  getRuntimePlugins: () => runtimePlugins,
  getCurrentSession: () => currentReaderSession,
  createPluginApi,
  onMountError: markPluginRuntimeError,
});

function getSettingsStorage(record: RuntimePluginRecord): PluginStorageApi {
  return buildPluginStorageApi(record.pluginId);
}

function getDefaultSettings(record: RuntimePluginRecord): Record<string, PluginSettingValue> {
  return cloneValue(record.settingsDefinition?.defaults ?? {});
}

function readPluginSettings(record: RuntimePluginRecord): Record<string, PluginSettingValue> {
  const storage = getSettingsStorage(record);
  const saved = storage.readJson<Record<string, PluginSettingValue>>(SETTINGS_STORAGE_KEY, {});
  return { ...getDefaultSettings(record), ...saved };
}

function writePluginSettings(
  record: RuntimePluginRecord,
  values: Record<string, PluginSettingValue>,
): void {
  getSettingsStorage(record).writeJson(SETTINGS_STORAGE_KEY, values);
}

function syncPublicPluginState(): void {
  state.plugins = runtimePlugins.map((record) => ({
    fileName: record.fileName,
    pluginId: record.pluginId,
    name: record.name,
    version: record.version,
    description: record.description,
    author: record.author,
    category: record.category,
    enabled: record.enabled,
    order: record.order,
    status: record.status,
    runtimeError: record.runtimeError,
    runtimeHooks: [...record.runtimeHooks],
    runtimeSlots: [...record.runtimeSlots],
    runtimeBookshelfActions: record.bookshelfActions.map((item) => item.id),
    runtimeReaderContextActions: record.readerContextActions.map((item) => item.id),
    runtimeCoverGenerators: record.coverGenerators.map((item) => item.id),
    hasSettings: !!record.settingsDefinition,
    source: record.source,
  }));
}

function syncPublicBookshelfActionState(): void {
  const nextActions: FrontendBookshelfActionRecord[] = [];
  for (const record of runtimePlugins.filter((item) => item.enabled && item.status !== 'error')) {
    for (const action of record.bookshelfActions) {
      nextActions.push({
        id: action.id,
        localId: action.localId,
        pluginId: record.pluginId,
        fileName: record.fileName,
        name: action.name,
        description: action.description,
        category: action.category,
      });
    }
  }
  state.bookshelfActions = nextActions;
}

function syncPublicCoverGeneratorState(): void {
  const nextGenerators: FrontendCoverGeneratorRecord[] = [];
  for (const record of runtimePlugins.filter((item) => item.enabled && item.status !== 'error')) {
    for (const generator of record.coverGenerators) {
      nextGenerators.push({
        id: generator.id,
        localId: generator.localId,
        pluginId: record.pluginId,
        fileName: record.fileName,
        name: generator.name,
        description: generator.description,
        category: generator.category,
      });
    }
  }
  state.coverGenerators = nextGenerators;
}

function syncPublicReaderContextActionState(): void {
  const nextActions: FrontendReaderContextActionRecord[] = [];
  for (const record of runtimePlugins.filter((item) => item.enabled && item.status !== 'error')) {
    for (const action of record.readerContextActions) {
      nextActions.push({
        id: action.id,
        localId: action.localId,
        pluginId: record.pluginId,
        fileName: record.fileName,
        name: action.name,
        description: action.description,
        category: action.category,
      });
    }
  }
  state.readerContextActions = nextActions;
}

async function syncPublicThemeState(): Promise<void> {
  state.readerThemes = await computePublicThemeState(
    runtimePlugins,
    currentReaderSession,
    createPluginApi,
  );
}

async function syncPublicBackgroundState(): Promise<void> {
  state.readerBackgrounds = await computePublicBackgroundState(
    runtimePlugins,
    currentReaderSession,
    createPluginApi,
  );
}

async function syncPublicSkinState(): Promise<void> {
  state.readerSkins = await computePublicSkinState(
    runtimePlugins,
    currentReaderSession,
    createPluginApi,
  );
}

async function recomputeReaderAppearance(): Promise<void> {
  state.readerAppearanceVars = await computeReaderAppearanceVars(
    currentReaderSession,
    runtimePlugins,
    createPluginApi,
  );
}

async function emitPluginToast(
  pluginId: string,
  message: string,
  type: 'info' | 'success' | 'warning' | 'error' = 'info',
): Promise<void> {
  await eventEmit(FRONTEND_PLUGIN_TOAST_EVENT, { pluginId, message, type });
}

function resolvePluginDialog(result: Record<string, PluginSettingValue> | null): void {
  if (!activePluginDialogResolve) {
    return;
  }
  const resolve = activePluginDialogResolve;
  activePluginDialogResolve = null;
  state.pluginDialog = null;
  resolve(result);
}

async function openPluginDialog(
  options: PluginDialogOptions,
): Promise<Record<string, PluginSettingValue> | null> {
  if (activePluginDialogResolve) {
    throw new Error('当前已有一个插件交互对话框正在显示');
  }
  const title = options.title?.trim();
  if (!title) {
    throw new Error('插件对话框缺少标题');
  }
  state.pluginDialog = buildPluginDialogState(options);
  return new Promise((resolve) => {
    activePluginDialogResolve = resolve;
  });
}

function createPluginApi(record: RuntimePluginRecord): FrontendPluginApi {
  const appConfigStore = useAppConfigStore();
  return {
    meta: readonly(record) as Readonly<FrontendPluginRecord>,
    storage: getSettingsStorage(record),
    settings: {
      getAll: () => readPluginSettings(record),
      get(key, fallback) {
        const values = readPluginSettings(record);
        return (values[key] ?? fallback) as typeof fallback;
      },
      set: async (key, value) => {
        await applyPluginSettingChange(record, key, value);
      },
      remove: async (key) => {
        await applyPluginSettingChange(record, key, undefined);
      },
      reset: async () => {
        await resetPluginSettingsInternal(record);
      },
    },
    assets: {
      resolve: (relativePath) =>
        resolveExtensionAssetUrl(extensionRootDir, record.fileName, relativePath),
    },
    log: (...args: unknown[]) => {
      console.log(`[FrontendPlugin][${record.pluginId}]`, ...args);
    },
    registerCleanup(cleanup) {
      record.cleanupTasks.add(cleanup);
    },
    reader: {
      getSession: () => currentReaderSession,
      onSessionChange(listener) {
        record.sessionListeners.add(listener);
        return () => {
          record.sessionListeners.delete(listener);
        };
      },
      refreshAppearance: async () => {
        await recomputeReaderAppearance();
      },
      remountSlots: async () => {
        await slotManager.remountAllReaderSlots();
      },
    },
    http: {
      request: requestPluginHttp,
      get: async (url, headers, options) =>
        (
          await requestPluginHttp({
            url,
            method: 'GET',
            headers,
            timeoutSecs: options?.timeoutSecs,
          })
        ).body,
      post: async (url, body, headers, options) =>
        (
          await requestPluginHttp({
            url,
            method: 'POST',
            body: body ?? '',
            headers,
            timeoutSecs: options?.timeoutSecs,
          })
        ).body,
    },
    bookshelf: {
      getBook: getShelfBookById,
      patchBook: patchShelfBook,
    },
    text: {
      convertChinese: (text, mode) => getChineseConverter(mode)(text),
    },
    ui: {
      toast: async (message, type) => emitPluginToast(record.pluginId, message, type),
      prompt: openPluginDialog,
      getAppTheme: () => appConfigStore.config.ui_theme ?? 'auto',
      setAppTheme: async (mode) => {
        const current = appConfigStore.config.ui_theme ?? 'auto';
        if (current === mode) {
          return;
        }
        await appConfigStore.setConfig('ui_theme', mode);
      },
    },
  };
}

function markPluginRuntimeError(record: RuntimePluginRecord, error: unknown): void {
  record.status = 'error';
  record.runtimeError = error instanceof Error ? error.message : String(error);
  syncPublicPluginState();
  void syncPublicThemeState();
  void syncPublicBackgroundState();
  void syncPublicSkinState();
  syncPublicBookshelfActionState();
  syncPublicReaderContextActionState();
  syncPublicCoverGeneratorState();
}

async function emitLifecycle(hookName: ReaderLifecycleHook): Promise<void> {
  await emitPluginLifecycle(
    hookName,
    runtimePlugins,
    currentReaderSession,
    createPluginApi,
    markPluginRuntimeError,
  );
}

async function teardownRuntimePlugins(records: RuntimePluginRecord[]): Promise<void> {
  for (const record of records) {
    await slotManager.cleanupMountedSlots(record);
    for (const cleanup of [...record.cleanupTasks]) {
      try {
        await cleanup();
      } catch {
        /* ignore plugin cleanup failure */
      }
    }
    record.cleanupTasks.clear();
    record.sessionListeners.clear();
  }
}

function syncOrderToRecords(records: RuntimePluginRecord[]): void {
  const ordered = readPluginOrder();
  const orderMap = new Map(ordered.map((fileName, index) => [fileName, index]));
  for (const record of records) {
    record.order = orderMap.get(record.fileName) ?? Number.MAX_SAFE_INTEGER;
  }
}

function makeErrorRecord(meta: ExtensionMeta, source: string, error: unknown): RuntimePluginRecord {
  return {
    fileName: meta.fileName,
    pluginId: meta.namespace || meta.fileName.replace(/\.js$/i, ''),
    name: meta.name || meta.fileName,
    version: meta.version || '0.0.0',
    description: meta.description || '',
    author: meta.author || '',
    category: meta.category || '其他',
    enabled: true,
    order: 0,
    status: 'error',
    runtimeError: error instanceof Error ? error.message : String(error),
    runtimeHooks: [],
    runtimeSlots: [],
    runtimeBookshelfActions: [],
    runtimeReaderContextActions: [],
    runtimeCoverGenerators: [],
    hasSettings: false,
    source,
    meta,
    settingsDefinition: undefined,
    mountedSlots: new Map(),
    cleanupTasks: new Set(),
    sessionListeners: new Set(),
    hookMap: createEmptyHookMap(),
    slotMap: createEmptySlotMap(),
    themes: [],
    backgrounds: [],
    skins: [],
    bookshelfActions: [],
    readerContextActions: [],
    coverGenerators: [],
  };
}

async function ensureInitialized(): Promise<void> {
  if (state.initialized) {
    return;
  }
  state.initialized = true;

  if (!externalListenersReady) {
    externalListenersReady = true;
    eventListenSync<{ fileName?: string }>('extension:changed', () => {
      void loadPlugins({ force: true });
    });
  }

  await loadPlugins();
}

async function loadPlugins(options: { force?: boolean } = {}): Promise<void> {
  if (loadPromise && !options.force) {
    return loadPromise;
  }

  loadPromise = (async () => {
    state.loading = true;
    try {
      await ensurePluginOrderLoaded();
      if (activePluginDialogResolve) {
        resolvePluginDialog(null);
      }

      const [extensionList, extensionDir] = await Promise.all([
        listExtensions(),
        getExtensionDir(),
      ]);
      extensionRootDir = extensionDir;
      const extensions = sortExtensionsByPluginOrder(extensionList);
      const nextRuntime: RuntimePluginRecord[] = [];

      for (const meta of extensions) {
        const source = await readExtension(meta.fileName);
        try {
          const record = await evaluatePlugin(meta, source, createPluginApi);
          if (!meta.enabled) {
            record.enabled = false;
            record.status = 'disabled';
          }
          nextRuntime.push(record);
        } catch (error) {
          nextRuntime.push(makeErrorRecord(meta, source, error));
        }
      }

      for (const builtin of BUILTIN_FRONTEND_PLUGINS) {
        try {
          const record = await evaluatePlugin(builtin.meta, builtin.source, createPluginApi);
          if (!builtin.meta.enabled) {
            record.enabled = false;
            record.status = 'disabled';
          }
          nextRuntime.push(record);
        } catch (error) {
          nextRuntime.push(makeErrorRecord(builtin.meta, builtin.source, error));
        }
      }

      syncOrderToRecords(nextRuntime);
      nextRuntime.sort((left, right) => left.order - right.order);

      await teardownRuntimePlugins(runtimePlugins);
      runtimePlugins = nextRuntime;
      syncPublicPluginState();
      await syncPublicThemeState();
      await syncPublicBackgroundState();
      await syncPublicSkinState();
      syncPublicBookshelfActionState();
      syncPublicReaderContextActionState();
      syncPublicCoverGeneratorState();
      state.lastLoadedAt = Date.now();
      state.contentVersion += 1;

      await recomputeReaderAppearance();
      await slotManager.remountAllReaderSlots();
      if (currentReaderSession) {
        await emitLifecycle('reader.session.enter');
      }
    } finally {
      state.loading = false;
      loadPromise = null;
    }
  })();

  return loadPromise;
}

async function resolvePluginSettings(record: RuntimePluginRecord): Promise<{
  values: Record<string, PluginSettingValue>;
  fields: ResolvedPluginSettingField[];
}> {
  const values = readPluginSettings(record);
  if (!record.settingsDefinition) {
    return { values, fields: [] };
  }

  const api = createPluginApi(record);
  const context: PluginSettingsContext = {
    values: cloneValue(values),
    session: currentReaderSession,
    meta: readonly(record) as Readonly<FrontendPluginRecord>,
    api,
  };
  return {
    values,
    fields: await resolvePluginSettingFields(record.settingsDefinition.schema, context),
  };
}

async function triggerSettingsRefresh(record: RuntimePluginRecord): Promise<void> {
  state.contentVersion += 1;
  await recomputeReaderAppearance();
  await slotManager.remountAllReaderSlots();
  await syncPublicThemeState();
  await syncPublicBackgroundState();
  await syncPublicSkinState();
  for (const plugin of runtimePlugins.filter((item) => item.enabled)) {
    notifySessionListeners(plugin, currentReaderSession);
  }
  syncPublicPluginState();
  if (record.enabled && currentReaderSession) {
    await emitLifecycle('reader.chapter.change');
  }
}

async function applyPluginSettingChange(
  record: RuntimePluginRecord,
  key: string,
  nextValue: PluginSettingValue | undefined,
): Promise<void> {
  const previousValues = readPluginSettings(record);
  const nextValues = { ...previousValues };
  const previousValue = previousValues[key];

  if (nextValue === undefined) {
    delete nextValues[key];
  } else {
    nextValues[key] = cloneValue(nextValue);
  }
  writePluginSettings(record, nextValues);

  if (record.settingsDefinition?.onChange) {
    const api = createPluginApi(record);
    await record.settingsDefinition.onChange({
      values: cloneValue(nextValues),
      session: currentReaderSession,
      meta: readonly(record) as Readonly<FrontendPluginRecord>,
      api,
      changedKey: key,
      previousValue,
      nextValue,
    });
  }

  await triggerSettingsRefresh(record);
}

async function resetPluginSettingsInternal(record: RuntimePluginRecord): Promise<void> {
  getSettingsStorage(record).remove(SETTINGS_STORAGE_KEY);
  await triggerSettingsRefresh(record);
}

async function movePlugin(fileName: string, direction: -1 | 1): Promise<void> {
  await ensureInitialized();
  const currentOrder = runtimePlugins.map((record) => record.fileName);
  const currentIndex = currentOrder.indexOf(fileName);
  if (currentIndex < 0) {
    return;
  }
  const nextIndex = currentIndex + direction;
  if (nextIndex < 0 || nextIndex >= currentOrder.length) {
    return;
  }
  [currentOrder[currentIndex], currentOrder[nextIndex]] = [
    currentOrder[nextIndex],
    currentOrder[currentIndex],
  ];
  writePluginOrder(currentOrder);
  await loadPlugins({ force: true });
}

async function reloadPlugin(fileName?: string): Promise<void> {
  await ensureInitialized();
  if (fileName) {
    const currentOrder = readPluginOrder();
    if (!currentOrder.includes(fileName)) {
      currentOrder.push(fileName);
      writePluginOrder(currentOrder);
    }
  }
  await loadPlugins({ force: true });
}

async function setPluginEnabled(fileName: string, enabled: boolean): Promise<void> {
  await toggleExtension(fileName, enabled);
  await loadPlugins({ force: true });
}

async function getPluginSettings(fileName: string): Promise<{
  plugin: FrontendPluginRecord;
  values: Record<string, PluginSettingValue>;
  fields: ResolvedPluginSettingField[];
}> {
  await ensureInitialized();
  const record = runtimePlugins.find((item) => item.fileName === fileName);
  if (!record) {
    throw new Error(`未找到插件 ${fileName}`);
  }
  const resolved = await resolvePluginSettings(record);
  return {
    plugin: {
      fileName: record.fileName,
      pluginId: record.pluginId,
      name: record.name,
      version: record.version,
      description: record.description,
      author: record.author,
      category: record.category,
      enabled: record.enabled,
      order: record.order,
      status: record.status,
      runtimeError: record.runtimeError,
      runtimeHooks: [...record.runtimeHooks],
      runtimeSlots: [...record.runtimeSlots],
      runtimeBookshelfActions: record.bookshelfActions.map((item) => item.id),
      runtimeReaderContextActions: record.readerContextActions.map((item) => item.id),
      runtimeCoverGenerators: record.coverGenerators.map((item) => item.id),
      hasSettings: !!record.settingsDefinition,
      source: record.source,
    },
    values: resolved.values,
    fields: resolved.fields,
  };
}

async function updatePluginSetting(
  fileName: string,
  key: string,
  value: PluginSettingValue | undefined,
): Promise<void> {
  await ensureInitialized();
  const record = runtimePlugins.find((item) => item.fileName === fileName);
  if (!record) {
    throw new Error(`未找到插件 ${fileName}`);
  }
  await applyPluginSettingChange(record, key, value);
}

async function resetPluginSettings(fileName: string): Promise<void> {
  await ensureInitialized();
  const record = runtimePlugins.find((item) => item.fileName === fileName);
  if (!record) {
    throw new Error(`未找到插件 ${fileName}`);
  }
  await resetPluginSettingsInternal(record);
}

function getBookshelfActionsForBook(book: ShelfBook): FrontendBookshelfActionRecord[] {
  const context: BookshelfActionContext = { book };
  return state.bookshelfActions.filter((action) => {
    const record = runtimePlugins.find(
      (item) => item.pluginId === action.pluginId && item.fileName === action.fileName,
    );
    const runtimeAction = record?.bookshelfActions.find((item) => item.id === action.id);
    return !!runtimeAction && isEntryVisible(runtimeAction, context);
  });
}

function getCoverGeneratorsForBook(book: ShelfBook): FrontendCoverGeneratorRecord[] {
  const context: CoverGeneratorContext = { book };
  return state.coverGenerators.filter((generator) => {
    const record = runtimePlugins.find(
      (item) => item.pluginId === generator.pluginId && item.fileName === generator.fileName,
    );
    const runtimeGenerator = record?.coverGenerators.find((item) => item.id === generator.id);
    return !!runtimeGenerator && isEntryVisible(runtimeGenerator, context);
  });
}

function getReaderContextActions(
  context: ReaderTextSelectionContext,
): FrontendReaderContextActionRecord[] {
  if (context.sourceType !== 'novel' || !context.text.trim()) {
    return [];
  }
  return state.readerContextActions.filter((action) => {
    const record = runtimePlugins.find(
      (item) => item.pluginId === action.pluginId && item.fileName === action.fileName,
    );
    const runtimeAction = record?.readerContextActions.find((item) => item.id === action.id);
    return !!runtimeAction && isEntryVisible(runtimeAction, context);
  });
}

async function runBookshelfAction(actionId: string, book: ShelfBook): Promise<void> {
  await ensureInitialized();
  const record = runtimePlugins.find((item) =>
    item.bookshelfActions.some((action) => action.id === actionId),
  );
  const action = record?.bookshelfActions.find((item) => item.id === actionId);
  if (!record || !action) {
    throw new Error(`未找到书架动作 ${actionId}`);
  }
  if (!isEntryVisible(action, { book })) {
    throw new Error('当前书籍不可用这个插件动作');
  }
  try {
    await action.run({ book }, createPluginApi(record));
  } catch (error) {
    markPluginRuntimeError(record, error);
    throw error;
  }
}

async function runReaderContextAction(
  actionId: string,
  context: ReaderTextSelectionContext,
): Promise<void> {
  await ensureInitialized();
  if (context.sourceType !== 'novel') {
    throw new Error('阅读器文本菜单动作仅支持小说');
  }
  const record = runtimePlugins.find((item) =>
    item.readerContextActions.some((action) => action.id === actionId),
  );
  const action = record?.readerContextActions.find((item) => item.id === actionId);
  if (!record || !action) {
    throw new Error(`未找到阅读器文本菜单动作 ${actionId}`);
  }
  if (!isEntryVisible(action, context)) {
    throw new Error('当前选中文本不可用这个插件动作');
  }
  try {
    await action.run(context, createPluginApi(record));
  } catch (error) {
    markPluginRuntimeError(record, error);
    throw error;
  }
}

async function runCoverGenerator(
  actionId: string,
  book: ShelfBook,
): Promise<CoverGeneratorResult | null> {
  await ensureInitialized();
  const record = runtimePlugins.find((item) =>
    item.coverGenerators.some((generator) => generator.id === actionId),
  );
  const generator = record?.coverGenerators.find((item) => item.id === actionId);
  if (!record || !generator) {
    throw new Error(`未找到封面生成器 ${actionId}`);
  }
  if (!isEntryVisible(generator, { book })) {
    throw new Error('当前书籍不可用这个封面生成器');
  }
  try {
    const result = await generator.generate({ book }, createPluginApi(record));
    if (typeof result === 'string') {
      return { coverUrl: result };
    }
    return result ?? null;
  } catch (error) {
    markPluginRuntimeError(record, error);
    throw error;
  }
}

async function runReaderContentPipeline(
  stage: ReaderContentHookStage,
  payload: ReaderContentPayload,
): Promise<string> {
  await ensureInitialized();
  let nextContent = payload.content;
  for (const record of runtimePlugins.filter((item) => item.enabled)) {
    const result = await invokePluginHook(
      record,
      stage,
      { ...payload, content: nextContent },
      createPluginApi,
      markPluginRuntimeError,
    );
    if (typeof result === 'string') {
      nextContent = result;
      continue;
    }
    if (
      result &&
      typeof result === 'object' &&
      'content' in (result as Record<string, unknown>) &&
      typeof (result as Record<string, unknown>).content === 'string'
    ) {
      nextContent = (result as { content: string }).content;
    }
  }
  return nextContent;
}

async function openReaderSession(session: ReaderSessionSnapshot): Promise<void> {
  await ensureInitialized();
  currentReaderSession = { ...session };
  await syncPublicThemeState();
  await syncPublicBackgroundState();
  await syncPublicSkinState();
  await recomputeReaderAppearance();
  await emitLifecycle('reader.session.enter');
  await slotManager.remountAllReaderSlots();
}

async function updateReaderSession(patch: Partial<ReaderSessionSnapshot>): Promise<void> {
  if (!currentReaderSession) {
    return;
  }

  const previous = currentReaderSession;
  currentReaderSession = { ...currentReaderSession, ...patch };

  const chapterChanged =
    patch.chapterIndex !== undefined &&
    (patch.chapterIndex !== previous.chapterIndex || patch.chapterUrl !== previous.chapterUrl);
  const visibilityChanged = patch.visible !== undefined && patch.visible !== previous.visible;

  if (chapterChanged) {
    await emitLifecycle('reader.chapter.change');
  }
  if (visibilityChanged) {
    await emitLifecycle(
      currentReaderSession.visible ? 'reader.session.resume' : 'reader.session.pause',
    );
  }

  for (const record of runtimePlugins.filter((item) => item.enabled)) {
    notifySessionListeners(record, currentReaderSession);
  }
  await syncPublicThemeState();
  await syncPublicBackgroundState();
  await syncPublicSkinState();
  await recomputeReaderAppearance();
}

async function closeReaderSession(): Promise<void> {
  if (!currentReaderSession) {
    return;
  }
  await emitLifecycle('reader.session.exit');
  currentReaderSession = null;
  for (const record of runtimePlugins) {
    notifySessionListeners(record, currentReaderSession);
  }
  state.readerAppearanceVars = {};
  await syncPublicThemeState();
  await syncPublicBackgroundState();
  await syncPublicSkinState();
  await slotManager.remountAllReaderSlots();
}

function registerReaderHost(slot: ReaderPluginSlot, element: HTMLElement): CleanupFn {
  return slotManager.registerReaderHost(slot, element);
}

export function useFrontendPlugins() {
  const orderedPlugins = computed(() =>
    [...state.plugins].toSorted((left, right) => left.order - right.order),
  );

  return {
    state: readonly(state),
    plugins: orderedPlugins,
    readerThemes: computed(() => state.readerThemes),
    readerBackgrounds: computed(() => state.readerBackgrounds),
    readerSkins: computed(() => state.readerSkins),
    bookshelfActions: computed(() => state.bookshelfActions),
    readerContextActions: computed(() => state.readerContextActions),
    coverGenerators: computed(() => state.coverGenerators),
    pluginDialog: computed(() => state.pluginDialog),
    ensureInitialized,
    loadPlugins,
    reloadPlugin,
    movePlugin,
    setPluginEnabled,
    getPluginSettings,
    updatePluginSetting,
    resetPluginSettings,
    getBookshelfActionsForBook,
    getReaderContextActions,
    getCoverGeneratorsForBook,
    runBookshelfAction,
    runReaderContextAction,
    runCoverGenerator,
    resolvePluginDialog,
    runReaderContentPipeline,
    registerReaderHost,
    openReaderSession,
    updateReaderSession,
    closeReaderSession,
    readerAppearanceVars: computed(() => state.readerAppearanceVars),
  };
}
