import type { DialogApi } from 'naive-ui';
import type { ComputedRef, Ref } from 'vue';
import type { ChapterItem } from '@/stores';
import type { AppConfig } from '../../../composables/useAppConfig';
import type { OpenChapterOptions } from './useReaderChapterOpen';
import type { ReaderPositionSnapshot, ReaderProgressPayload } from './useReaderPosition';

type ValueSource<T> = Ref<T> | ComputedRef<T>;

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
  activeChapterIndex: Ref<number>;
  shouldIgnorePositionEvents: () => boolean;
  getChapter: (index: number) => ChapterItem | undefined;
  fallbackChapterName: ValueSource<string>;
  fallbackChapterUrl: ValueSource<string>;
  readCurrentPosition: () => ReaderPositionSnapshot;
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

function readSource<T>(source: ValueSource<T>): T {
  return source.value;
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
  let unlistenReadingConflict: (() => void) | null = null;

  function resetProgressSyncState() {
    lastSavedChapterIndex = -1;
    lastReaderSyncAt = 0;
    readerSyncRunning = false;
  }

  function reportReaderSession(active: boolean) {
    const bookId = options.currentShelfId.value;
    if (bookId === undefined || bookId === '') {
      return;
    }
    const chapter = options.getChapter(options.activeChapterIndex.value);
    const position = options.readCurrentPosition();
    void options.sync
      .reportReaderSession({
        active,
        bookId,
        chapterIndex: options.activeChapterIndex.value,
        chapterName: chapter?.name ?? readSource(options.fallbackChapterName),
        chapterUrl: chapter?.url ?? readSource(options.fallbackChapterUrl),
        pageIndex: position.pageIndex,
        scrollRatio: position.scrollRatio,
        playbackTime: position.playbackTime,
        updatedAt: Date.now(),
      })
      .catch(() => {});
  }

  function saveDetailedProgress() {
    const shelfId = options.currentShelfId.value;
    if (shelfId === undefined || shelfId === '' || options.shouldIgnorePositionEvents()) {
      return;
    }

    const chapter = options.getChapter(options.activeChapterIndex.value);
    if (!chapter) {
      return;
    }

    const position = options.readCurrentPosition();

    if (
      options.activeChapterIndex.value === lastSavedChapterIndex &&
      position.pageIndex < 0 &&
      position.scrollRatio < 0 &&
      position.playbackTime < 0
    ) {
      return;
    }

    lastSavedChapterIndex = options.activeChapterIndex.value;
    void options
      .updateProgress(
        shelfId,
        options.activeChapterIndex.value,
        chapter.url,
        options.buildProgressPayload(position),
      )
      .catch(() => {});
    reportReaderSession(true);
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
            saveDetailedProgress();
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
      saveDetailedProgress();
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
      saveDetailedProgress();
    } else if (!document.hidden && options.getShow()) {
      void triggerReaderProgressSync();
    }
  }

  function onBeforeUnloadSave() {
    saveDetailedProgress();
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
