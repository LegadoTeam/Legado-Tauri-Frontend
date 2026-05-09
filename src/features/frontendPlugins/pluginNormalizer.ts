import type { ExtensionMeta } from '@/composables/useExtension';
import type {
  FrontendPluginRegistration,
  ReaderThemeDefinition,
  ReaderBackgroundDefinition,
  ReaderSkinDefinition,
  BookshelfActionDefinition,
  ReaderContextActionDefinition,
  CoverGeneratorDefinition,
  FrontendPluginHookName,
  PluginHookHandler,
  ReaderContentPayload,
  ReaderAppearancePatch,
  BookshelfActionContext,
  ReaderTextSelectionContext,
  CoverGeneratorContext,
  CoverGeneratorResult,
  FrontendPluginApi,
  ReaderThemeContext,
  ReaderBackgroundContext,
  ReaderSkinContext,
} from './pluginTypes';

export interface NormalizerPluginContext {
  pluginId: string;
  category: string;
}

export interface LegacyPluginExports {
  filterContent?: (content: string) => string | Promise<string>;
  onChapterLoaded?: (content: string) => string | Promise<string>;
  onSessionStart?: () => void | Promise<void>;
  onSessionEnd?: () => void | Promise<void>;
  getTheme?: () => ReaderAppearancePatch | null | undefined;
  toggle?: (enabled: boolean) => ReaderAppearancePatch | null | undefined;
}

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

type HookDefinitionMap = Partial<
  Record<FrontendPluginHookName, PluginHookHandler | PluginHookHandler[]>
>;

export interface RuntimeReaderThemeDefinition {
  id: string;
  localId: string;
  name: string;
  description: string;
  category: string;
  previewResolver?: ReaderAppearancePatch | ReaderThemeResolver;
  resolveResolver?: ReaderThemeResolver;
}

export interface RuntimeReaderBackgroundDefinition {
  id: string;
  localId: string;
  name: string;
  description: string;
  category: string;
  previewResolver?: ReaderAppearancePatch | ReaderBackgroundResolver;
  resolveResolver?: ReaderBackgroundResolver;
}

export interface RuntimeReaderSkinDefinition {
  id: string;
  localId: string;
  name: string;
  description: string;
  category: string;
  lockedFlipMode?: string;
  previewResolver?: ReaderAppearancePatch | ReaderSkinResolver;
  resolveResolver?: ReaderSkinResolver;
}

export interface RuntimeBookshelfActionDefinition {
  id: string;
  localId: string;
  name: string;
  description: string;
  category: string;
  visible?: boolean | ((context: BookshelfActionContext) => boolean);
  run: (context: BookshelfActionContext, api: FrontendPluginApi) => void | Promise<void>;
}

export interface RuntimeReaderContextActionDefinition {
  id: string;
  localId: string;
  name: string;
  description: string;
  category: string;
  visible?: boolean | ((context: ReaderTextSelectionContext) => boolean);
  run: (context: ReaderTextSelectionContext, api: FrontendPluginApi) => void | Promise<void>;
}

export interface RuntimeCoverGeneratorDefinition {
  id: string;
  localId: string;
  name: string;
  description: string;
  category: string;
  visible?: boolean | ((context: CoverGeneratorContext) => boolean);
  generate: (
    context: CoverGeneratorContext,
    api: FrontendPluginApi,
  ) =>
    | string
    | CoverGeneratorResult
    | null
    | undefined
    | Promise<string | CoverGeneratorResult | null | undefined>;
}

export function normalizeHandlers<T>(value?: T | T[]): T[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value.filter(Boolean) : [value];
}

export function normalizeRuntimeMetadata(
  meta: ExtensionMeta,
  registration: FrontendPluginRegistration,
) {
  return {
    pluginId:
      registration.id?.trim() ||
      meta.namespace?.trim() ||
      meta.fileName.replace(/\.js$/i, '') ||
      meta.name.trim(),
    name: registration.name?.trim() || meta.name.trim() || meta.fileName,
    version: registration.version?.trim() || meta.version.trim() || '0.0.0',
    description: registration.description?.trim() || meta.description.trim(),
  };
}

export function normalizeThemeDefinitions(
  record: NormalizerPluginContext,
  definitions: ReaderThemeDefinition[],
): RuntimeReaderThemeDefinition[] {
  return definitions
    .map((definition) => {
      const localId = definition.id?.trim();
      const name = definition.name?.trim();
      if (!localId || !name) {
        return null;
      }
      return {
        id: `${record.pluginId}:${localId}`,
        localId,
        name,
        description: definition.description?.trim() ?? '',
        category: definition.category?.trim() || record.category || '其他',
        previewResolver: definition.preview,
        resolveResolver: definition.resolve,
      } satisfies RuntimeReaderThemeDefinition;
    })
    .filter((v) => v !== null) as RuntimeReaderThemeDefinition[];
}

export function normalizeBackgroundDefinitions(
  record: NormalizerPluginContext,
  definitions: ReaderBackgroundDefinition[],
): RuntimeReaderBackgroundDefinition[] {
  return definitions
    .map((definition) => {
      const localId = definition.id?.trim();
      const name = definition.name?.trim();
      if (!localId || !name) {
        return null;
      }
      return {
        id: `${record.pluginId}:${localId}`,
        localId,
        name,
        description: definition.description?.trim() ?? '',
        category: definition.category?.trim() || record.category || '其他',
        previewResolver: definition.preview,
        resolveResolver: definition.resolve,
      } satisfies RuntimeReaderBackgroundDefinition;
    })
    .filter((v) => v !== null) as RuntimeReaderBackgroundDefinition[];
}

export function normalizeSkinDefinitions(
  record: NormalizerPluginContext,
  definitions: ReaderSkinDefinition[],
): RuntimeReaderSkinDefinition[] {
  return definitions
    .map((definition) => {
      const localId = definition.id?.trim();
      const name = definition.name?.trim();
      if (!localId || !name) {
        return null;
      }
      return {
        id: `${record.pluginId}:${localId}`,
        localId,
        name,
        description: definition.description?.trim() ?? '',
        category: definition.category?.trim() || record.category || '其他',
        lockedFlipMode: definition.lockedFlipMode?.trim() || undefined,
        previewResolver: definition.preview,
        resolveResolver: definition.resolve,
      } satisfies RuntimeReaderSkinDefinition;
    })
    .filter((v) => v !== null) as RuntimeReaderSkinDefinition[];
}

export function normalizeBookshelfActionDefinitions(
  record: NormalizerPluginContext,
  definitions: BookshelfActionDefinition[],
): RuntimeBookshelfActionDefinition[] {
  return definitions
    .map((definition) => {
      const localId = definition.id?.trim();
      const name = definition.name?.trim();
      if (!localId || !name || typeof definition.run !== 'function') {
        return null;
      }
      return {
        id: `${record.pluginId}:${localId}`,
        localId,
        name,
        description: definition.description?.trim() ?? '',
        category: definition.category?.trim() || record.category || '其他',
        visible: definition.when,
        run: definition.run,
      } satisfies RuntimeBookshelfActionDefinition;
    })
    .filter((v) => v !== null) as RuntimeBookshelfActionDefinition[];
}

export function normalizeReaderContextActionDefinitions(
  record: NormalizerPluginContext,
  definitions: ReaderContextActionDefinition[],
): RuntimeReaderContextActionDefinition[] {
  return definitions
    .map((definition) => {
      const localId = definition.id?.trim();
      const name = definition.name?.trim();
      if (!localId || !name || typeof definition.run !== 'function') {
        return null;
      }
      return {
        id: `${record.pluginId}:${localId}`,
        localId,
        name,
        description: definition.description?.trim() ?? '',
        category: definition.category?.trim() || record.category || '其他',
        visible: definition.when,
        run: definition.run,
      } satisfies RuntimeReaderContextActionDefinition;
    })
    .filter((v) => v !== null) as RuntimeReaderContextActionDefinition[];
}

export function normalizeCoverGeneratorDefinitions(
  record: NormalizerPluginContext,
  definitions: CoverGeneratorDefinition[],
): RuntimeCoverGeneratorDefinition[] {
  return definitions
    .map((definition) => {
      const localId = definition.id?.trim();
      const name = definition.name?.trim();
      if (!localId || !name || typeof definition.generate !== 'function') {
        return null;
      }
      return {
        id: `${record.pluginId}:${localId}`,
        localId,
        name,
        description: definition.description?.trim() ?? '',
        category: definition.category?.trim() || record.category || '其他',
        visible: definition.when,
        generate: definition.generate,
      } satisfies RuntimeCoverGeneratorDefinition;
    })
    .filter((v) => v !== null) as RuntimeCoverGeneratorDefinition[];
}

export function extractLegacyExports(
  source: string,
  legado: Record<string, unknown>,
): LegacyPluginExports {
  const runner = new Function(
    'legado',
    `${source}
return {
  filterContent: typeof filterContent === 'function' ? filterContent : undefined,
  onChapterLoaded: typeof onChapterLoaded === 'function' ? onChapterLoaded : undefined,
  onSessionStart: typeof onSessionStart === 'function' ? onSessionStart : undefined,
  onSessionEnd: typeof onSessionEnd === 'function' ? onSessionEnd : undefined,
  getTheme: typeof getTheme === 'function' ? getTheme : undefined,
  toggle: typeof toggle === 'function' ? toggle : undefined,
};`,
  );
  return runner(legado) as LegacyPluginExports;
}

export function convertLegacyPlugin(
  meta: ExtensionMeta,
  legacy: LegacyPluginExports,
): FrontendPluginRegistration | null {
  const hooks: HookDefinitionMap = {};

  if (legacy.filterContent) {
    hooks['reader.content.beforePaginate'] = async (payload) =>
      legacy.filterContent?.((payload as ReaderContentPayload).content);
    hooks['reader.content.beforeRender'] = async (payload) =>
      legacy.filterContent?.((payload as ReaderContentPayload).content);
  }
  if (legacy.onChapterLoaded) {
    hooks['reader.content.beforeRender'] = [
      ...normalizeHandlers(hooks['reader.content.beforeRender']),
      async (payload) => legacy.onChapterLoaded?.((payload as ReaderContentPayload).content),
    ];
  }
  if (legacy.onSessionStart) {
    hooks['reader.session.enter'] = async () => legacy.onSessionStart?.();
  }
  if (legacy.onSessionEnd) {
    hooks['reader.session.exit'] = async () => legacy.onSessionEnd?.();
  }

  const themes =
    legacy.getTheme || legacy.toggle
      ? [
          {
            id: 'legacy-theme',
            name: meta.name || meta.fileName,
            description: meta.description,
            resolve: () => legacy.getTheme?.() ?? legacy.toggle?.(true) ?? undefined,
          } satisfies ReaderThemeDefinition,
        ]
      : [];

  if (!Object.keys(hooks).length && themes.length === 0) {
    return null;
  }

  return {
    id: meta.namespace?.trim() || meta.fileName.replace(/\.js$/i, ''),
    name: meta.name,
    version: meta.version,
    description: meta.description,
    hooks,
    themes,
  };
}
