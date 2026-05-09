import type { RuntimePluginRecord } from './pluginRuntimeTypes';
import type {
  FrontendPluginApi,
  FrontendPluginHookName,
  ReaderLifecycleHook,
  ReaderSessionSnapshot,
} from './pluginTypes';

export function notifySessionListeners(
  record: RuntimePluginRecord,
  currentSession: ReaderSessionSnapshot | null,
): void {
  for (const listener of record.sessionListeners) {
    try {
      listener(currentSession);
    } catch (error) {
      console.error(`[FrontendPlugin][${record.pluginId}] session listener failed`, error);
    }
  }
}

export async function invokePluginHook(
  record: RuntimePluginRecord,
  hookName: FrontendPluginHookName,
  payload: unknown,
  createPluginApi: (r: RuntimePluginRecord) => FrontendPluginApi,
  onError: (record: RuntimePluginRecord, error: unknown) => void,
): Promise<unknown> {
  let result: unknown = payload;
  for (const handler of record.hookMap[hookName]) {
    try {
      const next = await handler(result, createPluginApi(record));
      if (next !== undefined) result = next;
    } catch (error) {
      onError(record, error);
      console.error(`[FrontendPlugin][${record.pluginId}] ${hookName} failed`, error);
    }
  }
  return result;
}

export async function emitPluginLifecycle(
  hookName: ReaderLifecycleHook,
  runtimePlugins: RuntimePluginRecord[],
  currentSession: ReaderSessionSnapshot | null,
  createPluginApi: (r: RuntimePluginRecord) => FrontendPluginApi,
  onError: (record: RuntimePluginRecord, error: unknown) => void,
): Promise<void> {
  for (const record of runtimePlugins.filter((item) => item.enabled)) {
    await invokePluginHook(record, hookName, currentSession, createPluginApi, onError);
    notifySessionListeners(record, currentSession);
  }
}
