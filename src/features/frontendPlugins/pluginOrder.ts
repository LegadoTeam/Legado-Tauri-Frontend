import type { ExtensionMeta } from '@/composables/useExtension';
import {
  ensureFrontendNamespaceLoaded,
  getFrontendStorageItem,
  legacyLocalStorageGet,
  legacyLocalStorageRemove,
  setFrontendStorageItem,
} from '@/composables/useFrontendStorage';
import { PLUGIN_STORAGE_KEYS } from './pluginStorage';

const LEGACY_PLUGIN_ORDER_KEY = 'legado_frontend_plugin_order_v1';

export function ensurePluginOrderLoaded(): Promise<void> {
  return ensureFrontendNamespaceLoaded(PLUGIN_STORAGE_KEYS.orderNamespace, () => {
    const legacy = legacyLocalStorageGet(LEGACY_PLUGIN_ORDER_KEY);
    if (!legacy) {
      return null;
    }
    legacyLocalStorageRemove(LEGACY_PLUGIN_ORDER_KEY);
    return { [PLUGIN_STORAGE_KEYS.orderKey]: legacy };
  }).then(() => {});
}

export function readPluginOrder(): string[] {
  try {
    const raw = getFrontendStorageItem(
      PLUGIN_STORAGE_KEYS.orderNamespace,
      PLUGIN_STORAGE_KEYS.orderKey,
    );
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string')
      : [];
  } catch {
    return [];
  }
}

export function writePluginOrder(fileNames: string[]): void {
  try {
    setFrontendStorageItem(
      PLUGIN_STORAGE_KEYS.orderNamespace,
      PLUGIN_STORAGE_KEYS.orderKey,
      JSON.stringify(fileNames),
    );
  } catch {
    /* ignore */
  }
}

export function sortExtensionsByPluginOrder(list: ExtensionMeta[]): ExtensionMeta[] {
  const order = readPluginOrder();
  const orderMap = new Map(order.map((fileName, index) => [fileName, index]));
  return [...list].toSorted((left, right) => {
    const leftOrder = orderMap.get(left.fileName);
    const rightOrder = orderMap.get(right.fileName);
    if (leftOrder !== undefined || rightOrder !== undefined) {
      return (leftOrder ?? Number.MAX_SAFE_INTEGER) - (rightOrder ?? Number.MAX_SAFE_INTEGER);
    }
    return left.fileName.localeCompare(right.fileName, 'zh-CN');
  });
}
