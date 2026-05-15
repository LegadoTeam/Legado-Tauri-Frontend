import { readonly } from 'vue';
import type {
  RuntimeReaderThemeDefinition,
  RuntimeReaderBackgroundDefinition,
  RuntimeReaderSkinDefinition,
} from './pluginNormalizer';
import type { RuntimePluginRecord } from './pluginRuntimeTypes';
import type {
  FrontendPluginRecord,
  FrontendPluginApi,
  FrontendReaderThemeRecord,
  FrontendReaderBackgroundRecord,
  FrontendReaderSkinRecord,
  ReaderBackgroundContext,
  ReaderThemeContext,
  ReaderSkinContext,
  ReaderSessionSnapshot,
  ReaderSessionAppearanceState,
  ReaderAppearancePatch,
} from './pluginTypes';
import { applyAppearancePatchVars } from './pluginAppearanceUtils';
import { cloneValue, defaultAppearanceState } from './pluginTextUtils';

function getAppearanceState(
  currentSession: ReaderSessionSnapshot | null,
): ReaderSessionAppearanceState {
  return cloneValue(currentSession?.appearance ?? defaultAppearanceState());
}

export function buildReaderBackgroundContext(
  record: RuntimePluginRecord,
  currentSession: ReaderSessionSnapshot | null,
): ReaderBackgroundContext {
  return {
    session: currentSession,
    appearance: getAppearanceState(currentSession),
    meta: readonly(record) as Readonly<FrontendPluginRecord>,
  };
}

export function buildReaderThemeContext(
  record: RuntimePluginRecord,
  currentSession: ReaderSessionSnapshot | null,
): ReaderThemeContext {
  return {
    session: currentSession,
    appearance: getAppearanceState(currentSession),
    meta: readonly(record) as Readonly<FrontendPluginRecord>,
  };
}

export function buildReaderSkinContext(
  record: RuntimePluginRecord,
  currentSession: ReaderSessionSnapshot | null,
): ReaderSkinContext {
  return {
    session: currentSession,
    appearance: getAppearanceState(currentSession),
    meta: readonly(record) as Readonly<FrontendPluginRecord>,
  };
}

export async function resolveReaderThemePatch(
  record: RuntimePluginRecord,
  theme: RuntimeReaderThemeDefinition,
  mode: 'preview' | 'resolve',
  currentSession: ReaderSessionSnapshot | null,
  createPluginApi: (r: RuntimePluginRecord) => FrontendPluginApi,
): Promise<ReaderAppearancePatch | undefined> {
  const resolver =
    mode === 'preview'
      ? (theme.previewResolver ?? theme.resolveResolver)
      : (theme.resolveResolver ?? theme.previewResolver);
  if (!resolver) {
    return undefined;
  }
  if (typeof resolver === 'function') {
    return (
      (await resolver(buildReaderThemeContext(record, currentSession), createPluginApi(record))) ??
      undefined
    );
  }
  return resolver;
}

export async function resolveReaderBackgroundPatch(
  record: RuntimePluginRecord,
  background: RuntimeReaderBackgroundDefinition,
  mode: 'preview' | 'resolve',
  currentSession: ReaderSessionSnapshot | null,
  createPluginApi: (r: RuntimePluginRecord) => FrontendPluginApi,
): Promise<ReaderAppearancePatch | undefined> {
  const resolver =
    mode === 'preview'
      ? (background.previewResolver ?? background.resolveResolver)
      : (background.resolveResolver ?? background.previewResolver);
  if (!resolver) {
    return undefined;
  }
  if (typeof resolver === 'function') {
    return (
      (await resolver(
        buildReaderBackgroundContext(record, currentSession),
        createPluginApi(record),
      )) ?? undefined
    );
  }
  return resolver;
}

export async function resolveReaderSkinPatch(
  record: RuntimePluginRecord,
  skin: RuntimeReaderSkinDefinition,
  mode: 'preview' | 'resolve',
  currentSession: ReaderSessionSnapshot | null,
  createPluginApi: (r: RuntimePluginRecord) => FrontendPluginApi,
): Promise<ReaderAppearancePatch | undefined> {
  const resolver =
    mode === 'preview'
      ? (skin.previewResolver ?? skin.resolveResolver)
      : (skin.resolveResolver ?? skin.previewResolver);
  if (!resolver) {
    return undefined;
  }
  if (typeof resolver === 'function') {
    return (
      (await resolver(buildReaderSkinContext(record, currentSession), createPluginApi(record))) ??
      undefined
    );
  }
  return resolver;
}

export async function computePublicThemeState(
  runtimePlugins: RuntimePluginRecord[],
  currentSession: ReaderSessionSnapshot | null,
  createPluginApi: (r: RuntimePluginRecord) => FrontendPluginApi,
): Promise<FrontendReaderThemeRecord[]> {
  const nextThemes: FrontendReaderThemeRecord[] = [];
  for (const record of runtimePlugins.filter((item) => item.enabled && item.status !== 'error')) {
    for (const theme of record.themes) {
      const preview =
        (await resolveReaderThemePatch(
          record,
          theme,
          'preview',
          currentSession,
          createPluginApi,
        )) ?? {};
      nextThemes.push({
        id: theme.id,
        localId: theme.localId,
        pluginId: record.pluginId,
        fileName: record.fileName,
        name: theme.name,
        description: theme.description,
        category: theme.category,
        preview,
      });
    }
  }
  return nextThemes;
}

export async function computePublicBackgroundState(
  runtimePlugins: RuntimePluginRecord[],
  currentSession: ReaderSessionSnapshot | null,
  createPluginApi: (r: RuntimePluginRecord) => FrontendPluginApi,
): Promise<FrontendReaderBackgroundRecord[]> {
  const nextBackgrounds: FrontendReaderBackgroundRecord[] = [];
  for (const record of runtimePlugins.filter((item) => item.enabled && item.status !== 'error')) {
    for (const background of record.backgrounds) {
      const preview =
        (await resolveReaderBackgroundPatch(
          record,
          background,
          'preview',
          currentSession,
          createPluginApi,
        )) ?? {};
      nextBackgrounds.push({
        id: background.id,
        localId: background.localId,
        pluginId: record.pluginId,
        fileName: record.fileName,
        name: background.name,
        description: background.description,
        category: background.category,
        preview,
      });
    }
  }
  return nextBackgrounds;
}

export async function computePublicSkinState(
  runtimePlugins: RuntimePluginRecord[],
  currentSession: ReaderSessionSnapshot | null,
  createPluginApi: (r: RuntimePluginRecord) => FrontendPluginApi,
): Promise<FrontendReaderSkinRecord[]> {
  const nextSkins: FrontendReaderSkinRecord[] = [];
  for (const record of runtimePlugins.filter((item) => item.enabled && item.status !== 'error')) {
    for (const skin of record.skins) {
      const preview =
        (await resolveReaderSkinPatch(record, skin, 'preview', currentSession, createPluginApi)) ??
        {};
      nextSkins.push({
        id: skin.id,
        localId: skin.localId,
        pluginId: record.pluginId,
        fileName: record.fileName,
        name: skin.name,
        description: skin.description,
        category: skin.category,
        preview,
        lockedFlipMode: skin.lockedFlipMode,
      });
    }
  }
  return nextSkins;
}

export async function computeReaderAppearanceVars(
  currentSession: ReaderSessionSnapshot | null,
  runtimePlugins: RuntimePluginRecord[],
  createPluginApi: (r: RuntimePluginRecord) => FrontendPluginApi,
): Promise<Record<string, string>> {
  if (!currentSession) {
    return {};
  }

  const nextVars: Record<string, string> = {};

  const selectedThemeId = currentSession.appearance?.themePresetId;
  if (selectedThemeId) {
    for (const record of runtimePlugins.filter((item) => item.enabled)) {
      const theme = record.themes.find((item) => item.id === selectedThemeId);
      if (!theme) {
        continue;
      }
      const patch = await resolveReaderThemePatch(
        record,
        theme,
        'resolve',
        currentSession,
        createPluginApi,
      );
      applyAppearancePatchVars(nextVars, patch);
      break;
    }
  }

  const selectedBackgroundId = currentSession.appearance?.backgroundPresetId;
  if (selectedBackgroundId) {
    for (const record of runtimePlugins.filter((item) => item.enabled)) {
      const background = record.backgrounds.find((item) => item.id === selectedBackgroundId);
      if (!background) {
        continue;
      }
      const patch = await resolveReaderBackgroundPatch(
        record,
        background,
        'resolve',
        currentSession,
        createPluginApi,
      );
      applyAppearancePatchVars(nextVars, patch);
      break;
    }
  }

  const selectedSkinId = currentSession.appearance?.skinPresetId;
  if (selectedSkinId) {
    for (const record of runtimePlugins.filter((item) => item.enabled)) {
      const skin = record.skins.find((item) => item.id === selectedSkinId);
      if (!skin) {
        continue;
      }
      const patch = await resolveReaderSkinPatch(
        record,
        skin,
        'resolve',
        currentSession,
        createPluginApi,
      );
      applyAppearancePatchVars(nextVars, patch);
      break;
    }
  }

  return nextVars;
}
