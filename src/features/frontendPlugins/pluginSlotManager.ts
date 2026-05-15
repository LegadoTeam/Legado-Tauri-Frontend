import type { RuntimePluginRecord } from './pluginRuntimeTypes';
import type {
  ReaderPluginSlot,
  FrontendPluginApi,
  CleanupFn,
  ReaderSessionSnapshot,
} from './pluginTypes';
import { SUPPORTED_READER_PLUGIN_SLOTS } from './readerSlots';

export interface SlotManagerDeps {
  getRuntimePlugins: () => RuntimePluginRecord[];
  getCurrentSession: () => ReaderSessionSnapshot | null;
  createPluginApi: (record: RuntimePluginRecord) => FrontendPluginApi;
  onMountError: (record: RuntimePluginRecord, error: unknown) => void;
}

async function runSlotCleanup(cleanup?: CleanupFn | null): Promise<void> {
  if (!cleanup) {
    return;
  }
  await cleanup();
}

export function createSlotManager(deps: SlotManagerDeps) {
  const slotHosts = new Map<ReaderPluginSlot, Set<HTMLElement>>();

  async function cleanupMountedSlots(record: RuntimePluginRecord): Promise<void> {
    for (const mountedList of record.mountedSlots.values()) {
      for (const mounted of mountedList) {
        try {
          await runSlotCleanup(mounted.cleanup);
        } finally {
          mounted.root.remove();
        }
      }
    }
    record.mountedSlots.clear();
  }

  async function remountSlot(slot: ReaderPluginSlot): Promise<void> {
    const hosts = slotHosts.get(slot);
    if (!hosts || hosts.size === 0) {
      return;
    }

    const runtimePlugins = deps.getRuntimePlugins();
    for (const record of runtimePlugins) {
      const mountedList = record.mountedSlots.get(slot) ?? [];
      for (const mounted of mountedList) {
        try {
          await runSlotCleanup(mounted.cleanup);
        } finally {
          mounted.root.remove();
        }
      }
      record.mountedSlots.set(slot, []);
    }

    if (!deps.getCurrentSession()) {
      return;
    }

    for (const host of hosts) {
      host.replaceChildren();
      for (const record of runtimePlugins.filter((item) => item.enabled)) {
        const slotHandlers = record.slotMap[slot];
        if (!slotHandlers.length) {
          continue;
        }
        for (const mount of slotHandlers) {
          const root = document.createElement('div');
          root.dataset.pluginId = record.pluginId;
          root.dataset.pluginSlot = slot;
          host.appendChild(root);
          let cleanup: CleanupFn | null = null;
          try {
            const maybeCleanup = await mount(root, deps.createPluginApi(record));
            cleanup = typeof maybeCleanup === 'function' ? maybeCleanup : null;
            const mountedList = record.mountedSlots.get(slot) ?? [];
            mountedList.push({ host, root, cleanup });
            record.mountedSlots.set(slot, mountedList);
          } catch (error) {
            root.remove();
            deps.onMountError(record, error);
          }
        }
      }
    }
  }

  async function remountAllReaderSlots(): Promise<void> {
    for (const slot of SUPPORTED_READER_PLUGIN_SLOTS) {
      await remountSlot(slot);
    }
  }

  function registerReaderHost(slot: ReaderPluginSlot, element: HTMLElement): CleanupFn {
    if (!slotHosts.has(slot)) {
      slotHosts.set(slot, new Set());
    }
    slotHosts.get(slot)!.add(element);
    void remountSlot(slot);
    return () => {
      const hosts = slotHosts.get(slot);
      hosts?.delete(element);
      if (hosts?.size === 0) {
        slotHosts.delete(slot);
      }
      element.replaceChildren();
    };
  }

  return {
    cleanupMountedSlots,
    remountSlot,
    remountAllReaderSlots,
    registerReaderHost,
  };
}
