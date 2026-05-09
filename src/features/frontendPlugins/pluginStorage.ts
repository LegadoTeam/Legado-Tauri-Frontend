import {
  ensureFrontendNamespaceLoaded,
  getFrontendStorageItem,
  legacyLocalStorageEntries,
  legacyLocalStorageRemove,
  readFrontendStorageJson,
  removeFrontendStorageItem,
  setFrontendStorageItem,
  setFrontendStorageJson,
} from '@/composables/useFrontendStorage';
export type { PluginSettingValue } from './types';

export const PLUGIN_STORAGE_KEYS = {
  settings: '__settings__',
  orderNamespace: 'frontend-plugins.order',
  orderKey: 'fileNames',
  legacyPluginStoragePrefix: 'legado_frontend_plugin_storage_v1:',
} as const;

export interface PluginStorageApi {
  read(key: string): string | null;
  write(key: string, value: string): void;
  remove(key: string): void;
  readJson<T>(key: string, fallback: T): T;
  writeJson<T>(key: string, value: T): void;
}

export function buildPluginStorageApi(pluginId: string): PluginStorageApi {
  const namespace = `frontend-plugin.${pluginId}`;
  void ensureFrontendNamespaceLoaded(namespace, () => {
    const prefix = `${PLUGIN_STORAGE_KEYS.legacyPluginStoragePrefix}${pluginId}:`;
    const legacyEntries = legacyLocalStorageEntries(prefix);
    const migrated: Record<string, string> = {};
    for (const [key, value] of Object.entries(legacyEntries)) {
      migrated[key.slice(prefix.length)] = value;
      legacyLocalStorageRemove(key);
    }
    return Object.keys(migrated).length ? migrated : null;
  });
  return {
    read(key) {
      return getFrontendStorageItem(namespace, key);
    },
    write(key, value) {
      setFrontendStorageItem(namespace, key, value);
    },
    remove(key) {
      removeFrontendStorageItem(namespace, key);
    },
    readJson(key, fallback) {
      return readFrontendStorageJson(namespace, key, fallback);
    },
    writeJson(key, value) {
      setFrontendStorageJson(namespace, key, value);
    },
  };
}
