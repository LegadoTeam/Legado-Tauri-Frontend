/**
 * 将当前阅读器状态同步给前端插件运行时，章节与位置统一由进度解析器提供。
 */
import { watch, type ComputedRef, type Ref } from 'vue';
import type {
  ReaderSessionSnapshot,
  ReaderSessionAppearanceState,
} from '../../../composables/useFrontendPlugins';
import type { ReaderBookInfo } from '../types';
import type { ReaderProgressTarget } from './useReaderPosition';

type ValueSource<T> = Ref<T> | ComputedRef<T>;

interface ReaderSessionSettingsState {
  theme: ReaderSessionAppearanceState['theme'];
  themePresetId: string;
  backgroundImage: string;
  backgroundPresetId: string;
  skinPresetId: string;
}

interface UseReaderSessionBridgeOptions {
  getShow: () => boolean;
  fileName: ValueSource<string>;
  sourceType: ValueSource<string | undefined>;
  bookInfo: ValueSource<ReaderBookInfo | undefined>;
  getChapterCount: () => number;
  currentShelfId: ComputedRef<string | undefined>;
  content: Ref<string>;
  settings: ReaderSessionSettingsState;
  readerBodyRef: Ref<HTMLElement | null>;
  resolveReadingProgressTarget: () => ReaderProgressTarget;
  openReaderSession: (session: ReaderSessionSnapshot) => Promise<void>;
  updateReaderSession: (patch: Partial<ReaderSessionSnapshot>) => Promise<void>;
  closeReaderSession: () => Promise<void>;
}

function readSource<T>(source: ValueSource<T>): T {
  return source.value;
}

export function useReaderSessionBridge(options: UseReaderSessionBridgeOptions) {
  function getReaderViewportSize() {
    return {
      width: options.readerBodyRef.value?.clientWidth ?? window.innerWidth ?? 0,
      height: options.readerBodyRef.value?.clientHeight ?? window.innerHeight ?? 0,
    };
  }

  function buildReaderSessionSnapshot(
    overrides: Partial<Record<string, unknown>> = {},
  ): ReaderSessionSnapshot & Record<string, unknown> {
    const target = options.resolveReadingProgressTarget();
    const position = target.position;
    const viewport = getReaderViewportSize();
    return {
      fileName: readSource(options.fileName),
      sourceType: readSource(options.sourceType) ?? 'novel',
      shelfBookId: options.currentShelfId.value ?? undefined,
      bookInfo: readSource(options.bookInfo),
      chapterIndex: target.chapterIndex,
      totalChapters: options.getChapterCount(),
      chapterName: target.chapterName,
      chapterUrl: target.chapterUrl,
      content: options.content.value,
      pageIndex: position.pageIndex >= 0 ? position.pageIndex : undefined,
      scrollRatio: position.scrollRatio >= 0 ? position.scrollRatio : undefined,
      visible: options.getShow() && !document.hidden,
      appearance: {
        theme: { ...options.settings.theme },
        themePresetId: options.settings.themePresetId,
        backgroundImage: options.settings.backgroundImage,
        backgroundPresetId: options.settings.backgroundPresetId,
        skinPresetId: options.settings.skinPresetId,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
        devicePixelRatio: window.devicePixelRatio || 1,
      },
      ...overrides,
    };
  }

  async function openSession() {
    await options.openReaderSession(buildReaderSessionSnapshot());
  }

  async function closeSession() {
    await options.closeReaderSession();
  }

  async function syncSessionSnapshot(
    overrides: Partial<Record<string, unknown>> = {},
  ): Promise<void> {
    await options.updateReaderSession(buildReaderSessionSnapshot(overrides));
  }

  async function updateSessionVisibility(visible: boolean): Promise<void> {
    await options.updateReaderSession({ visible });
  }

  watch(
    () => {
      const target = options.resolveReadingProgressTarget();
      return [
        target.chapterIndex,
        target.position.pageIndex,
        target.position.scrollRatio,
        target.position.playbackTime,
        options.content.value,
      ] as const;
    },
    () => {
      if (!options.getShow()) {
        return;
      }
      void syncSessionSnapshot();
    },
  );

  watch(
    () =>
      [
        options.settings.theme.name,
        options.settings.theme.backgroundColor,
        options.settings.theme.textColor,
        options.settings.theme.selectionColor,
        options.settings.themePresetId,
        options.settings.backgroundImage,
        options.settings.backgroundPresetId,
        options.settings.skinPresetId,
      ] as const,
    () => {
      if (!options.getShow()) {
        return;
      }
      void syncSessionSnapshot();
    },
  );

  return {
    buildReaderSessionSnapshot,
    openSession,
    closeSession,
    syncSessionSnapshot,
    updateSessionVisibility,
  };
}
