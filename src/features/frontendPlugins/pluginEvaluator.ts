import type { ExtensionMeta } from '@/composables/useExtension';
import type { RuntimePluginRecord } from './pluginRuntimeTypes';
import type {
  FrontendPluginApi,
  FrontendPluginRegistration,
  PluginHookHandler,
  ReaderSlotMount,
} from './pluginTypes';
import {
  normalizeHandlers,
  normalizeRuntimeMetadata,
  normalizeThemeDefinitions,
  normalizeBackgroundDefinitions,
  normalizeSkinDefinitions,
  normalizeBookshelfActionDefinitions,
  normalizeReaderContextActionDefinitions,
  normalizeCoverGeneratorDefinitions,
  extractLegacyExports,
  convertLegacyPlugin,
} from './pluginNormalizer';
import { createEmptyHookMap, SUPPORTED_FRONTEND_PLUGIN_HOOKS } from './readerHooks';
import { createEmptySlotMap, SUPPORTED_READER_PLUGIN_SLOTS } from './readerSlots';

export async function evaluatePlugin(
  meta: ExtensionMeta,
  source: string,
  createPluginApi: (record: RuntimePluginRecord) => FrontendPluginApi,
): Promise<RuntimePluginRecord> {
  const registrations: FrontendPluginRegistration[] = [];
  const legado = {
    registerPlugin(registration: FrontendPluginRegistration) {
      registrations.push(registration);
    },
  };

  const legacy = extractLegacyExports(source, legado);
  const registration = registrations[0] ?? convertLegacyPlugin(meta, legacy);
  if (!registration) {
    throw new Error('插件未调用 legado.registerPlugin，且未识别到兼容的旧接口');
  }

  const normalized = normalizeRuntimeMetadata(meta, registration);
  const baseRecord: RuntimePluginRecord = {
    fileName: meta.fileName,
    pluginId: normalized.pluginId,
    name: normalized.name,
    version: normalized.version,
    description: normalized.description,
    author: meta.author,
    category: meta.category || '其他',
    enabled: meta.enabled,
    order: 0,
    status: 'active',
    runtimeError: '',
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

  const api = createPluginApi(baseRecord);
  const setupOutput = registration.setup ? await registration.setup(api) : undefined;

  const hookDefs = { ...registration.hooks, ...setupOutput?.hooks };
  const slotDefs = { ...registration.slots, ...setupOutput?.slots };
  const themeDefs = [
    ...normalizeHandlers(registration.themes),
    ...normalizeHandlers(setupOutput?.themes),
  ];
  const backgroundDefs = [
    ...normalizeHandlers(registration.backgrounds),
    ...normalizeHandlers(setupOutput?.backgrounds),
  ];
  const skinDefs = [
    ...normalizeHandlers(registration.skins),
    ...normalizeHandlers(setupOutput?.skins),
  ];
  const bookshelfActionDefs = [
    ...normalizeHandlers(registration.bookshelfActions),
    ...normalizeHandlers(setupOutput?.bookshelfActions),
  ];
  const readerContextActionDefs = [
    ...normalizeHandlers(registration.readerContextActions),
    ...normalizeHandlers(setupOutput?.readerContextActions),
  ];
  const coverGeneratorDefs = [
    ...normalizeHandlers(registration.coverGenerators),
    ...normalizeHandlers(setupOutput?.coverGenerators),
  ];

  baseRecord.settingsDefinition = setupOutput?.settings ?? registration.settings;
  baseRecord.hasSettings = !!baseRecord.settingsDefinition;
  baseRecord.themes = normalizeThemeDefinitions(baseRecord, themeDefs);
  baseRecord.backgrounds = normalizeBackgroundDefinitions(baseRecord, backgroundDefs);
  baseRecord.skins = normalizeSkinDefinitions(baseRecord, skinDefs);
  baseRecord.bookshelfActions = normalizeBookshelfActionDefinitions(
    baseRecord,
    bookshelfActionDefs,
  );
  baseRecord.readerContextActions = normalizeReaderContextActionDefinitions(
    baseRecord,
    readerContextActionDefs,
  );
  baseRecord.coverGenerators = normalizeCoverGeneratorDefinitions(baseRecord, coverGeneratorDefs);
  baseRecord.runtimeBookshelfActions = baseRecord.bookshelfActions.map((item) => item.id);
  baseRecord.runtimeReaderContextActions = baseRecord.readerContextActions.map((item) => item.id);
  baseRecord.runtimeCoverGenerators = baseRecord.coverGenerators.map((item) => item.id);

  if (setupOutput?.dispose) {
    baseRecord.cleanupTasks.add(setupOutput.dispose);
  }

  for (const hookName of SUPPORTED_FRONTEND_PLUGIN_HOOKS) {
    baseRecord.hookMap[hookName] = normalizeHandlers(hookDefs[hookName] as PluginHookHandler[]);
    if (baseRecord.hookMap[hookName].length) {
      baseRecord.runtimeHooks = [...baseRecord.runtimeHooks, hookName];
    }
  }

  for (const slotName of SUPPORTED_READER_PLUGIN_SLOTS) {
    baseRecord.slotMap[slotName] = normalizeHandlers(slotDefs[slotName] as ReaderSlotMount[]);
    if (baseRecord.slotMap[slotName].length) {
      baseRecord.runtimeSlots = [...baseRecord.runtimeSlots, slotName];
    }
  }

  return baseRecord;
}
