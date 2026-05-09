import { watch, type ComputedRef, type Ref } from 'vue';
import type { ChapterItem } from '@/stores';
import type {
  ReaderSessionSnapshot,
  ReaderSessionAppearanceState,
} from '../../../composables/useFrontendPlugins';
import type { ReaderBookInfo } from '../types';

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
  fallbackChapterName: ValueSource<string>;
  fallbackChapterUrl: ValueSource<string>;
  currentShelfId: ComputedRef<string | undefined>;
  activeChapterIndex: Ref<number>;
  currentPageIndex: Ref<number>;
  currentScrollRatio: Ref<number>;
  content: Ref<string>;
  settings: ReaderSessionSettingsState;
  readerBodyRef: Ref<HTMLElement | null>;
  getChapter: (index: number) => ChapterItem | undefined;
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
    const chapter = options.getChapter(options.activeChapterIndex.value);
    const viewport = getReaderViewportSize();
    return {
      fileName: readSource(options.fileName),
      sourceType: readSource(options.sourceType) ?? 'novel',
      shelfBookId: options.currentShelfId.value || undefined,
      bookInfo: readSource(options.bookInfo),
      chapterIndex: options.activeChapterIndex.value,
      totalChapters: options.getChapterCount(),
      chapterName: chapter?.name ?? readSource(options.fallbackChapterName),
      chapterUrl: chapter?.url ?? readSource(options.fallbackChapterUrl),
      content: options.content.value,
      pageIndex: options.currentPageIndex.value >= 0 ? options.currentPageIndex.value : undefined,
      scrollRatio:
        options.currentScrollRatio.value >= 0 ? options.currentScrollRatio.value : undefined,
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
    () =>
      [
        options.activeChapterIndex.value,
        options.currentPageIndex.value,
        options.currentScrollRatio.value,
        options.content.value,
      ] as const,
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
