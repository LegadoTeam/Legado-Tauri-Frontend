import type { ExtensionMeta } from '@/composables/useExtension';

export interface BuiltinPluginDefinition {
  id: string;
  source: string;
  meta: ExtensionMeta;
}

export const BUILTIN_FRONTEND_PLUGINS: BuiltinPluginDefinition[] = [];
