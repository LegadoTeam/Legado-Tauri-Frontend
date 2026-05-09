import type { ReaderBookInfo, ReaderTheme } from '@/components/reader/types';
import type { PatchShelfBookPayload, ShelfBook } from '@/composables/useBookshelf';
import type { PluginStorageApi } from './pluginStorage';

export type ReaderPluginSlot =
  | 'background'
  | 'overlay-top-left'
  | 'overlay-top-right'
  | 'overlay-bottom-left'
  | 'overlay-bottom-right';

export type ReaderContentHookStage =
  | 'reader.content.raw'
  | 'reader.content.cleaned'
  | 'reader.content.beforePaginate'
  | 'reader.content.beforeRender';

export type ReaderLifecycleHook =
  | 'reader.session.enter'
  | 'reader.session.exit'
  | 'reader.session.pause'
  | 'reader.session.resume'
  | 'reader.chapter.change';

export type FrontendPluginHookName = ReaderContentHookStage | ReaderLifecycleHook;

export type PluginSettingScalar = string | number | boolean;
export type PluginSettingValue = PluginSettingScalar | string[];
export type ChineseConvertMode = 's2t' | 's2tw' | 's2hk' | 't2s' | 'tw2s' | 'hk2s';
export type PluginSettingInputType =
  | 'text'
  | 'textarea'
  | 'password'
  | 'number'
  | 'switch'
  | 'select'
  | 'radio'
  | 'color'
  | 'slider'
  | 'string-list'
  | 'info'
  | 'divider';

export interface ReaderAppearancePatch {
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
  backgroundRepeat?: string;
  backgroundAttachment?: string;
  backgroundBlendMode?: string;
  textColor?: string;
  selectionColor?: string;
  styleVars?: Record<string, string>;
}

export interface ReaderSessionAppearanceState {
  theme: ReaderTheme;
  themePresetId: string;
  backgroundImage: string;
  backgroundPresetId: string;
  skinPresetId: string;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
}

export interface ReaderSessionSnapshot {
  fileName: string;
  sourceType: string;
  shelfBookId?: string;
  bookInfo?: ReaderBookInfo;
  chapterIndex: number;
  totalChapters?: number;
  chapterName: string;
  chapterUrl: string;
  content?: string;
  pageIndex?: number;
  scrollRatio?: number;
  visible: boolean;
  appearance?: ReaderSessionAppearanceState;
}

export interface ReaderContentPayload {
  stage: ReaderContentHookStage;
  content: string;
  sourceType: string;
  fileName: string;
  chapterIndex: number;
  chapterName: string;
  chapterUrl: string;
}

export interface PluginSettingOption {
  label: PluginDynamicText;
  value: string | number;
  description?: PluginDynamicText;
}

export interface PluginSettingField {
  type: PluginSettingInputType;
  key?: string;
  label?: PluginDynamicText;
  description?: PluginDynamicText;
  placeholder?: PluginDynamicText;
  hidden?: boolean | ((context: PluginSettingsContext) => boolean);
  disabled?: boolean | ((context: PluginSettingsContext) => boolean);
  min?: number;
  max?: number;
  step?: number;
  rows?: number;
  options?: PluginSettingOption[] | ((context: PluginSettingsContext) => PluginSettingOption[]);
}

export interface ResolvedPluginSettingField {
  type: PluginSettingInputType;
  key?: string;
  label: string;
  description: string;
  placeholder: string;
  disabled: boolean;
  min?: number;
  max?: number;
  step?: number;
  rows?: number;
  options?: Array<{
    label: string;
    value: string | number;
    description: string;
  }>;
}

export interface FrontendPluginHttpRequest {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutSecs?: number;
}

export interface FrontendPluginHttpResponse {
  status: number;
  headers: Array<[string, string]>;
  body: string;
}

export interface PluginDialogField {
  type: PluginSettingInputType;
  key?: string;
  label?: string;
  description?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  rows?: number;
  options?: Array<{
    label: string;
    value: string | number;
    description?: string;
  }>;
}

export interface PluginDialogOptions {
  title: string;
  message?: string;
  submitText?: string;
  cancelText?: string;
  width?: number;
  initialValues?: Record<string, PluginSettingValue>;
  fields: PluginDialogField[];
}

export interface PluginDialogState {
  title: string;
  message: string;
  submitText: string;
  cancelText: string;
  width: number;
  fields: PluginDialogField[];
  values: Record<string, PluginSettingValue>;
}

// Private resolver types needed by public interface definitions
type ReaderThemeResolver = (
  context: ReaderThemeContext,
  api: FrontendPluginApi,
) => ReaderAppearancePatch | Promise<ReaderAppearancePatch | undefined> | undefined;

type ReaderBackgroundResolver = (
  context: ReaderBackgroundContext,
  api: FrontendPluginApi,
) => ReaderAppearancePatch | Promise<ReaderAppearancePatch | undefined> | undefined;

type ReaderSkinResolver = (
  context: ReaderSkinContext,
  api: FrontendPluginApi,
) => ReaderAppearancePatch | Promise<ReaderAppearancePatch | undefined> | undefined;

export interface ReaderThemeDefinition {
  id: string;
  name: string;
  description?: string;
  category?: string;
  preview?: ReaderAppearancePatch | ReaderThemeResolver;
  resolve?: ReaderThemeResolver;
}

export interface FrontendReaderThemeRecord {
  id: string;
  localId: string;
  pluginId: string;
  fileName: string;
  name: string;
  description: string;
  category: string;
  preview: ReaderAppearancePatch;
}

export interface ReaderBackgroundDefinition {
  id: string;
  name: string;
  description?: string;
  category?: string;
  preview?: ReaderAppearancePatch | ReaderBackgroundResolver;
  resolve?: ReaderBackgroundResolver;
}

export interface FrontendReaderBackgroundRecord {
  id: string;
  localId: string;
  pluginId: string;
  fileName: string;
  name: string;
  description: string;
  category: string;
  preview: ReaderAppearancePatch;
}

export interface ReaderSkinDefinition {
  id: string;
  name: string;
  description?: string;
  category?: string;
  /** 使用此皮肤时强制锁定的翻页模式。留空则不强制覆盖。 */
  lockedFlipMode?: string;
  preview?: ReaderAppearancePatch | ReaderSkinResolver;
  resolve?: ReaderSkinResolver;
}

export interface FrontendReaderSkinRecord {
  id: string;
  localId: string;
  pluginId: string;
  fileName: string;
  name: string;
  description: string;
  category: string;
  preview: ReaderAppearancePatch;
  /** 使用此皮肤时强制锁定的翻页模式；undefined 表示不锁定。 */
  lockedFlipMode?: string;
}

export interface BookshelfActionContext {
  book: ShelfBook;
}

type BookshelfActionVisible = (context: BookshelfActionContext) => boolean;
type BookshelfActionRunner = (
  context: BookshelfActionContext,
  api: FrontendPluginApi,
) => void | Promise<void>;

export interface BookshelfActionDefinition {
  id: string;
  name: string;
  description?: string;
  category?: string;
  when?: boolean | BookshelfActionVisible;
  run: BookshelfActionRunner;
}

export interface FrontendBookshelfActionRecord {
  id: string;
  localId: string;
  pluginId: string;
  fileName: string;
  name: string;
  description: string;
  category: string;
}

export interface CoverGeneratorContext {
  book: ShelfBook;
}

export interface CoverGeneratorResult {
  coverUrl?: string;
  patch?: PatchShelfBookPayload;
  message?: string;
}

type CoverGeneratorVisible = (context: CoverGeneratorContext) => boolean;
type CoverGeneratorRunner = (
  context: CoverGeneratorContext,
  api: FrontendPluginApi,
) =>
  | string
  | CoverGeneratorResult
  | null
  | undefined
  | Promise<string | CoverGeneratorResult | null | undefined>;

export interface CoverGeneratorDefinition {
  id: string;
  name: string;
  description?: string;
  category?: string;
  when?: boolean | CoverGeneratorVisible;
  generate: CoverGeneratorRunner;
}

export interface FrontendCoverGeneratorRecord {
  id: string;
  localId: string;
  pluginId: string;
  fileName: string;
  name: string;
  description: string;
  category: string;
}

export interface ReaderTextSelectionContext {
  text: string;
  sourceType: string;
  fileName: string;
  chapterIndex: number;
  chapterName: string;
  chapterUrl: string;
  bookName?: string;
  bookUrl?: string;
}

type ReaderContextActionVisible = (context: ReaderTextSelectionContext) => boolean;
type ReaderContextActionRunner = (
  context: ReaderTextSelectionContext,
  api: FrontendPluginApi,
) => void | Promise<void>;

export interface ReaderContextActionDefinition {
  id: string;
  name: string;
  description?: string;
  category?: string;
  when?: boolean | ReaderContextActionVisible;
  run: ReaderContextActionRunner;
}

export interface FrontendReaderContextActionRecord {
  id: string;
  localId: string;
  pluginId: string;
  fileName: string;
  name: string;
  description: string;
  category: string;
}

export type CleanupFn = () => void | Promise<void>;
export type ReaderSessionListener = (session: ReaderSessionSnapshot | null) => void;
export type PluginHookHandler<T = unknown> = (
  payload: T,
  api: FrontendPluginApi,
) => unknown | Promise<unknown>;
export type ReaderSlotMount = (
  container: HTMLElement,
  api: FrontendPluginApi,
) => void | CleanupFn | Promise<void | CleanupFn>;
export type PluginDynamicText = string | ((context: PluginSettingsContext) => string);

// Private map type aliases needed by FrontendPluginRegistration
type HookDefinitionMap = Partial<
  Record<FrontendPluginHookName, PluginHookHandler | PluginHookHandler[]>
>;
type SlotDefinitionMap = Partial<Record<ReaderPluginSlot, ReaderSlotMount | ReaderSlotMount[]>>;

export interface PluginSettingsContext {
  values: Record<string, PluginSettingValue>;
  session: ReaderSessionSnapshot | null;
  meta: Readonly<FrontendPluginRecord>;
  api: FrontendPluginApi;
}

export interface PluginSettingsDefinition {
  defaults?: Record<string, PluginSettingValue>;
  schema:
    | PluginSettingField[]
    | ((context: PluginSettingsContext) => PluginSettingField[] | Promise<PluginSettingField[]>);
  onChange?: (
    context: PluginSettingsContext & {
      changedKey: string;
      previousValue: PluginSettingValue | undefined;
      nextValue: PluginSettingValue | undefined;
    },
  ) => void | Promise<void>;
}

export interface FrontendPluginRegistration {
  id?: string;
  name?: string;
  version?: string;
  description?: string;
  hooks?: HookDefinitionMap;
  slots?: SlotDefinitionMap;
  themes?: ReaderThemeDefinition[];
  backgrounds?: ReaderBackgroundDefinition[];
  skins?: ReaderSkinDefinition[];
  bookshelfActions?: BookshelfActionDefinition[];
  readerContextActions?: ReaderContextActionDefinition[];
  coverGenerators?: CoverGeneratorDefinition[];
  settings?: PluginSettingsDefinition;
  setup?: (api: FrontendPluginApi) =>
    | void
    | {
        hooks?: HookDefinitionMap;
        slots?: SlotDefinitionMap;
        themes?: ReaderThemeDefinition[];
        backgrounds?: ReaderBackgroundDefinition[];
        skins?: ReaderSkinDefinition[];
        bookshelfActions?: BookshelfActionDefinition[];
        readerContextActions?: ReaderContextActionDefinition[];
        coverGenerators?: CoverGeneratorDefinition[];
        settings?: PluginSettingsDefinition;
        dispose?: CleanupFn;
      }
    | Promise<void | {
        hooks?: HookDefinitionMap;
        slots?: SlotDefinitionMap;
        themes?: ReaderThemeDefinition[];
        backgrounds?: ReaderBackgroundDefinition[];
        skins?: ReaderSkinDefinition[];
        bookshelfActions?: BookshelfActionDefinition[];
        readerContextActions?: ReaderContextActionDefinition[];
        coverGenerators?: CoverGeneratorDefinition[];
        settings?: PluginSettingsDefinition;
        dispose?: CleanupFn;
      }>;
}

export interface FrontendPluginRecord {
  fileName: string;
  pluginId: string;
  name: string;
  version: string;
  description: string;
  author: string;
  category: string;
  enabled: boolean;
  order: number;
  status: 'active' | 'disabled' | 'error';
  runtimeError: string;
  runtimeHooks: readonly FrontendPluginHookName[];
  runtimeSlots: readonly ReaderPluginSlot[];
  runtimeBookshelfActions: readonly string[];
  runtimeReaderContextActions: readonly string[];
  runtimeCoverGenerators: readonly string[];
  hasSettings: boolean;
  source: string;
}

export interface ReaderBackgroundContext {
  session: ReaderSessionSnapshot | null;
  appearance: ReaderSessionAppearanceState;
  meta: Readonly<FrontendPluginRecord>;
}

export interface ReaderThemeContext {
  session: ReaderSessionSnapshot | null;
  appearance: ReaderSessionAppearanceState;
  meta: Readonly<FrontendPluginRecord>;
}

export interface ReaderSkinContext {
  session: ReaderSessionSnapshot | null;
  appearance: ReaderSessionAppearanceState;
  meta: Readonly<FrontendPluginRecord>;
}

export interface PluginSettingsApi {
  getAll: () => Record<string, PluginSettingValue>;
  get: <T extends PluginSettingValue>(key: string, fallback: T) => T;
  set: (key: string, value: PluginSettingValue) => Promise<void>;
  remove: (key: string) => Promise<void>;
  reset: () => Promise<void>;
}

export interface FrontendPluginApi {
  meta: Readonly<FrontendPluginRecord>;
  storage: PluginStorageApi;
  settings: PluginSettingsApi;
  assets: {
    resolve: (relativePath: string) => string;
  };
  log: (...args: unknown[]) => void;
  registerCleanup: (cleanup: CleanupFn) => void;
  reader: {
    getSession: () => ReaderSessionSnapshot | null;
    onSessionChange: (listener: ReaderSessionListener) => CleanupFn;
    refreshAppearance: () => Promise<void>;
    remountSlots: () => Promise<void>;
  };
  http: {
    request: (request: FrontendPluginHttpRequest) => Promise<FrontendPluginHttpResponse>;
    get: (
      url: string,
      headers?: Record<string, string>,
      options?: { timeoutSecs?: number },
    ) => Promise<string>;
    post: (
      url: string,
      body?: string,
      headers?: Record<string, string>,
      options?: { timeoutSecs?: number },
    ) => Promise<string>;
  };
  bookshelf: {
    getBook: (id: string) => Promise<ShelfBook>;
    patchBook: (id: string, patch: PatchShelfBookPayload) => Promise<ShelfBook>;
  };
  text: {
    convertChinese: (text: string, mode: ChineseConvertMode) => string;
  };
  ui: {
    toast: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => Promise<void>;
    prompt: (options: PluginDialogOptions) => Promise<Record<string, PluginSettingValue> | null>;
    getAppTheme: () => string;
    setAppTheme: (mode: 'auto' | 'light' | 'dark') => Promise<void>;
  };
}
