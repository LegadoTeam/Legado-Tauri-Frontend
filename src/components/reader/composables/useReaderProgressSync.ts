/**
 * 负责阅读进度的本地保存、同步上报与冲突处理。
 */
import type { DialogApi } from 'naive-ui';
import type { ComputedRef, Ref } from 'vue';
import type { ChapterItem } from '@/stores';
import type { AppConfig } from '../../../composables/useAppConfig';
import type { OpenChapterOptions } from './useReaderChapterOpen';
import type {
  ReaderPositionSnapshot,
  ReaderProgressPayload,
  ReaderProgressTarget,
} from './useReaderPosition';

interface ReaderConflictPayload {
  bookId?: string;
  local?: Record<string, unknown>;
  remote?: Record<string, unknown>;
}

interface ReportReaderSessionPayload {
  active: boolean;
  bookId: string;
  chapterIndex: number;
  chapterName: string;
  chapterUrl: string;
  pageIndex: number;
  scrollRatio: number;
  playbackTime: number;
  updatedAt: number;
}

interface ReaderSyncApi {
  syncNow: (mode?: 'push' | 'sync' | 'pull') => Promise<unknown>;
  reportReaderSession: (payload: ReportReaderSessionPayload) => Promise<unknown>;
  listenReadingConflict: (listener: (payload: unknown) => void) => Promise<() => void>;
}

interface ProgressPayload {
  pageIndex?: number;
  scrollRatio?: number;
  playbackTime?: number;
  readerSettings?: string;
}

interface UseReaderProgressSyncOptions {
  getShow: () => boolean;
  config: Ref<AppConfig>;
  dialog: DialogApi;
  sync: ReaderSyncApi;
  currentShelfId: ComputedRef<string | undefined>;
  shouldIgnorePositionEvents: () => boolean;
  getChapter: (index: number) => ChapterItem | undefined;
  readCurrentPosition: () => ReaderPositionSnapshot;
  resolveReadingProgressTarget: (snapshot?: ReaderPositionSnapshot) => ReaderProgressTarget;
  buildProgressPayload: (snapshot?: ReaderPositionSnapshot) => ReaderProgressPayload;
  updateProgress: (
    shelfId: string,
    index: number,
    chapterUrl: string,
    payload: ProgressPayload,
  ) => Promise<unknown>;
  updateSessionVisibility: (visible: boolean) => Promise<void>;
  openChapter: (index: number, options?: OpenChapterOptions) => Promise<void>;
}

const READER_SYNC_DEBOUNCE_MS = 3000;

function isReaderConflictPayload(payload: unknown): payload is ReaderConflictPayload {
  return typeof payload === 'object' && payload !== null;
}

export function useReaderProgressSync(options: UseReaderProgressSyncOptions) {
  let autoSaveTimer: ReturnType<typeof setInterval> | null = null;
  let readerSyncRunning = false;
  let lastReaderSyncAt = 0;
  let lastSavedChapterIndex = -1;
  let lastDetailedSaveAt = 0;
  let detailedSaveInFlight: Promise<void> | null = null;
  let unlistenReadingConflict: (() => void) | null = null;

  function resetProgressSyncState() {
    lastSavedChapterIndex = -1;
    lastDetailedSaveAt = 0;
    detailedSaveInFlight = null;
    lastReaderSyncAt = 0;
    readerSyncRunning = false;
  }

  function reportReaderSession(active: boolean) {
    const bookId = options.currentShelfId.value;
    if (bookId === undefined || bookId === '') {
      return;
    }
    const position = options.readCurrentPosition();
    const target = options.resolveReadingProgressTarget(position);
    void options.sync
      .reportReaderSession({
        active,
        bookId,
        chapterIndex: target.chapterIndex,
        chapterName: target.chapterName,
        chapterUrl: target.chapterUrl,
        pageIndex: target.position.pageIndex,
        scrollRatio: target.position.scrollRatio,
        playbackTime: target.position.playbackTime,
        updatedAt: Date.now(),
      })
      .catch(() => {});
  }

  async function saveDetailedProgress(): Promise<void> {
    if (detailedSaveInFlight) {
      return detailedSaveInFlight;
    }
    if (Date.now() - lastDetailedSaveAt < 1200) {
      return;
    }

    detailedSaveInFlight = doSaveDetailedProgress().finally(() => {
      detailedSaveInFlight = null;
    });
    return detailedSaveInFlight;
  }

  async function doSaveDetailedProgress(): Promise<void> {
    const shelfId = options.currentShelfId.value;
    if (shelfId === undefined || shelfId === '' || options.shouldIgnorePositionEvents()) {
      return;
    }

    const position = options.readCurrentPosition();
    const target = options.resolveReadingProgressTarget(position);

    if (target.chapterIndex < 0 || !target.chapterUrl) {
      return;
    }

    if (
      target.chapterIndex === lastSavedChapterIndex &&
      target.position.pageIndex < 0 &&
      target.position.scrollRatio < 0 &&
      target.position.playbackTime < 0
    ) {
      return;
    }

    lastSavedChapterIndex = target.chapterIndex;
    try {
      await options.updateProgress(
        shelfId,
        target.chapterIndex,
        target.chapterUrl,
        options.buildProgressPayload(target.position),
      );
      lastDetailedSaveAt = Date.now();
      reportReaderSession(true);
    } catch {
      // 保存失败不阻断退出或翻章；下次自动保存/同步会继续尝试。
    }
  }

  function canSyncReaderProgress() {
    const syncConfig = options.config.value;
    return (
      options.getShow() &&
      options.currentShelfId.value !== undefined &&
      options.currentShelfId.value !== '' &&
      syncConfig.sync_enabled &&
      syncConfig.sync_scope_reading_progress
    );
  }

  async function triggerReaderProgressSync() {
    if (!canSyncReaderProgress() || readerSyncRunning) {
      return;
    }
    const now = Date.now();
    if (now - lastReaderSyncAt < READER_SYNC_DEBOUNCE_MS) {
      return;
    }
    lastReaderSyncAt = now;
    reportReaderSession(true);
    readerSyncRunning = true;
    try {
      await options.sync.syncNow('sync');
    } catch {
      // 同步失败不打断阅读
    } finally {
      readerSyncRunning = false;
    }
  }

  function setupReadingConflictListener() {
    void options.sync
      .listenReadingConflict((payload) => {
        if (!isReaderConflictPayload(payload)) {
          return;
        }
        const data = payload;
        if (
          data.bookId === undefined ||
          data.bookId === '' ||
          data.bookId !== options.currentShelfId.value
        ) {
          return;
        }
        const remote = data.remote ?? {};
        const chapterIndex = Number(remote.chapterIndex ?? -1);
        const chapter = options.getChapter(chapterIndex);
        options.dialog.warning({
          title: '阅读进度不一致',
          content: `服务器进度为「${chapter?.name ?? `第 ${chapterIndex + 1} 章`}」。可以跳转到服务器进度，也可以保留当前位置继续阅读。`,
          positiveText: '跳转到服务器进度',
          negativeText: '保留当前位置',
          onPositiveClick: () => {
            const pageIndex = Number(remote.pageIndex ?? -1);
            const scrollRatio = Number(remote.scrollRatio ?? -1);
            if (chapterIndex >= 0) {
              void options.openChapter(chapterIndex, {
                position: scrollRatio >= 0 || pageIndex >= 0 ? 'resume' : 'first',
                pageIndex: pageIndex >= 0 ? pageIndex : undefined,
                pageRatio: scrollRatio >= 0 ? scrollRatio : undefined,
              });
            }
          },
          onNegativeClick: () => {
            void saveDetailedProgress();
          },
        });
      })
      .then((fn) => {
        unlistenReadingConflict = fn;
      })
      .catch(() => {});
  }

  function cleanupReadingConflictListener() {
    unlistenReadingConflict?.();
    unlistenReadingConflict = null;
  }

  function startAutoSave() {
    stopAutoSave();
    autoSaveTimer = setInterval(() => {
      void saveDetailedProgress();
    }, 30_000);
  }

  function stopAutoSave() {
    if (autoSaveTimer !== null) {
      clearInterval(autoSaveTimer);
      autoSaveTimer = null;
    }
  }

  function onVisibilityChange() {
    if (options.getShow()) {
      void options.updateSessionVisibility(!document.hidden);
    }
    if (document.hidden && options.getShow()) {
      void saveDetailedProgress();
    } else if (!document.hidden && options.getShow()) {
      void triggerReaderProgressSync();
    }
  }

  function onBeforeUnloadSave() {
    void saveDetailedProgress();
  }

  return {
    resetProgressSyncState,
    saveDetailedProgress,
    reportReaderSession,
    triggerReaderProgressSync,
    setupReadingConflictListener,
    cleanupReadingConflictListener,
    startAutoSave,
    stopAutoSave,
    onVisibilityChange,
    onBeforeUnloadSave,
  };
}
