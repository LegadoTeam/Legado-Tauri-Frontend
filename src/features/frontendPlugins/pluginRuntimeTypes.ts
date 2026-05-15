import type { ExtensionMeta } from '@/composables/useExtension';
import type {
  RuntimeReaderThemeDefinition,
  RuntimeReaderBackgroundDefinition,
  RuntimeReaderSkinDefinition,
  RuntimeBookshelfActionDefinition,
  RuntimeReaderContextActionDefinition,
  RuntimeCoverGeneratorDefinition,
} from './pluginNormalizer';
import type {
  FrontendPluginRecord,
  ReaderPluginSlot,
  FrontendPluginHookName,
  PluginHookHandler,
  ReaderSlotMount,
  CleanupFn,
  ReaderSessionListener,
  PluginSettingsDefinition,
} from './pluginTypes';

export interface MountedSlotRecord {
  host: HTMLElement;
  root: HTMLElement;
  cleanup: CleanupFn | null;
}

export interface RuntimePluginRecord extends FrontendPluginRecord {
  meta: ExtensionMeta;
  settingsDefinition?: PluginSettingsDefinition;
  mountedSlots: Map<ReaderPluginSlot, MountedSlotRecord[]>;
  cleanupTasks: Set<CleanupFn>;
  sessionListeners: Set<ReaderSessionListener>;
  hookMap: Record<FrontendPluginHookName, PluginHookHandler[]>;
  slotMap: Record<ReaderPluginSlot, ReaderSlotMount[]>;
  themes: RuntimeReaderThemeDefinition[];
  backgrounds: RuntimeReaderBackgroundDefinition[];
  skins: RuntimeReaderSkinDefinition[];
  bookshelfActions: RuntimeBookshelfActionDefinition[];
  readerContextActions: RuntimeReaderContextActionDefinition[];
  coverGenerators: RuntimeCoverGeneratorDefinition[];
}
