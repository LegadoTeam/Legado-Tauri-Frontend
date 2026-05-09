import type { ComputedRef, Ref } from 'vue';
import type { OpenChapterOptions } from '@/components/reader/composables/useReaderChapterOpen';

interface ShelfReaderSettingsSnapshot {
  readerSettings?: string;
  readChapterIndex?: number;
  readPageIndex?: number;
  readScrollRatio?: number;
  readPlaybackTime?: number;
}

interface ReaderLifecycleControllerOptions {
  getShelfBookId: () => string | undefined;
  getCurrentIndex: () => number;
  getTrackingPayload: () => Record<string, unknown>;
  readerBodyRef: Ref<HTMLElement | null>;
  activeChapterIndex: Ref<number>;
  pendingRestorePageIndex: Ref<number>;
  pendingRestoreScrollRatio: Ref<number>;
  pendingResumePlaybackTime: Ref<number>;
  isPagedMode: ComputedRef<boolean>;
  ensureFrontendPlugins: () => Promise<void>;
  getShelfBook: (shelfBookId: string) => Promise<ShelfReaderSettingsSnapshot>;
  activateBookSettings: (bookId: string, savedJson?: string) => void;
  deactivateBookSettings: () => void;
  clearLocalAddedShelfId: () => void;
  setShelfDataReady: (ready: Promise<void> | null) => void;
  getShelfDataReady: () => Promise<void> | null;
  observeReaderBody: () => void;
  unobserveReaderBody: () => void;
  resetReaderSessionForOpen: (currentIndex: number) => void;
  resetReaderSessionForClose: () => void;
  resetReaderUiLayers: () => void;
  resetProgressSyncState: () => void;
  openSession: () => Promise<void>;
  closeSession: () => Promise<void>;
  loadShelfStatus: () => Promise<void>;
  openChapter: (index: number, options?: OpenChapterOptions) => Promise<void>;
  reportReaderSession: (visible: boolean) => void;
  triggerReaderProgressSync: () => Promise<void>;
  startAutoSave: () => void;
  stopAutoSave: () => void;
  saveDetailedProgress: () => void;
  clearAllRuntimeCache: () => void;
  invalidatePages: () => void;
  trackSessionOpen: (payload: Record<string, unknown>) => void;
}

export function createReaderLifecycleController(options: ReaderLifecycleControllerOptions) {
  async function prepareShelfData(shelfBookId: string): Promise<void> {
    try {
      const book = await options.getShelfBook(shelfBookId);
      options.activateBookSettings(shelfBookId, book.readerSettings);
      if (book.readChapterIndex === options.getCurrentIndex()) {
        options.pendingRestorePageIndex.value = book.readPageIndex ?? -1;
        options.pendingRestoreScrollRatio.value = book.readScrollRatio ?? -1;
        options.pendingResumePlaybackTime.value = book.readPlaybackTime ?? -1;
      }
    } catch {
      // 读取书架失败时沿用全局设置。
    }
  }

  async function openReader() {
    await options.ensureFrontendPlugins();
    options.observeReaderBody();
    options.resetReaderSessionForOpen(options.getCurrentIndex());
    options.resetReaderUiLayers();
    options.resetProgressSyncState();

    const shelfBookId = options.getShelfBookId();
    if (shelfBookId) {
      options.setShelfDataReady(prepareShelfData(shelfBookId));
    } else {
      options.clearLocalAddedShelfId();
      options.setShelfDataReady(null);
    }

    await options.openSession();
    options.trackSessionOpen(options.getTrackingPayload());
    await options.loadShelfStatus();
    const shelfDataReady = options.getShelfDataReady();
    if (shelfDataReady) {
      await shelfDataReady;
    }

    if (options.isPagedMode.value) {
      const restorePageIndex = options.pendingRestorePageIndex.value;
      const restoreScrollRatio = options.pendingRestoreScrollRatio.value;
      options.pendingRestorePageIndex.value = -1;
      options.pendingRestoreScrollRatio.value = -1;
      const hasRestorePos = restoreScrollRatio >= 0 || restorePageIndex >= 0;
      await options.openChapter(options.activeChapterIndex.value, {
        position: hasRestorePos ? 'resume' : 'first',
        pageIndex: restorePageIndex >= 0 ? restorePageIndex : undefined,
        pageRatio: restoreScrollRatio >= 0 ? restoreScrollRatio : undefined,
      });
    } else {
      await options.openChapter(options.activeChapterIndex.value);
    }

    options.reportReaderSession(true);
    void options.triggerReaderProgressSync();
    options.startAutoSave();
  }

  async function closeReader() {
    options.stopAutoSave();
    options.saveDetailedProgress();
    await options.closeSession();
    options.deactivateBookSettings();
    options.clearAllRuntimeCache();
    options.invalidatePages();
    options.resetReaderSessionForClose();
    options.resetReaderUiLayers();
    options.unobserveReaderBody();
  }

  async function handleVisibilityChange(visible: boolean) {
    if (visible) {
      await openReader();
    } else {
      await closeReader();
    }
  }

  return {
    handleVisibilityChange,
    openReader,
    closeReader,
  };
}
