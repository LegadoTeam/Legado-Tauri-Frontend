import { nextTick, type ComputedRef, type Ref } from 'vue';
import type { OpenChapterOptions } from '@/components/reader/composables/useReaderChapterOpen';
import type {
  TemporaryChapterSourceOverride,
  WholeBookSwitchedPayload,
} from '@/components/reader/types';

type SourceSwitchMode = 'whole-book' | 'chapter-temp';

interface ReaderSourceSwitchMessage {
  warning(content: string): void;
  success(content: string): void;
}

interface ReaderSourceSwitchControllerOptions {
  currentShelfId: ComputedRef<string | undefined>;
  activeChapterIndex: Ref<number>;
  readingChapterIndex: ComputedRef<number>;
  temporaryChapterOverrides: Ref<Record<number, TemporaryChapterSourceOverride>>;
  currentChapterOverride: ComputedRef<TemporaryChapterSourceOverride | null>;
  sourceSwitchMode: Ref<SourceSwitchMode>;
  showSourceSwitchDialog: Ref<boolean>;
  message: ReaderSourceSwitchMessage;
  clearChapterRuntimeCache: (index: number) => void;
  clearAllRuntimeCache: () => void;
  invalidatePages: () => void;
  openChapter: (index: number, options?: OpenChapterOptions) => Promise<void>;
  emitSourceSwitched: (payload: WholeBookSwitchedPayload) => void;
}

export function createReaderSourceSwitchController(options: ReaderSourceSwitchControllerOptions) {
  function openWholeBookSourceSwitch() {
    if (!options.currentShelfId.value) {
      options.message.warning('请先将书籍加入书架，再使用整本换源');
      return;
    }
    options.sourceSwitchMode.value = 'whole-book';
    options.showSourceSwitchDialog.value = true;
  }

  function openTemporaryChapterSwitch() {
    options.sourceSwitchMode.value = 'chapter-temp';
    options.showSourceSwitchDialog.value = true;
  }

  async function clearTemporaryChapterSwitch() {
    if (!options.currentChapterOverride.value) {
      return;
    }
    const next = { ...options.temporaryChapterOverrides.value };
    delete next[options.readingChapterIndex.value];
    options.temporaryChapterOverrides.value = next;
    options.clearChapterRuntimeCache(options.readingChapterIndex.value);
    await options.openChapter(options.readingChapterIndex.value, { forceNetwork: true });
    options.message.success('已恢复当前章节的原始正文');
  }

  async function handleTemporaryChapterSourceSwitched(payload: TemporaryChapterSourceOverride) {
    options.temporaryChapterOverrides.value = {
      ...options.temporaryChapterOverrides.value,
      [payload.chapterIndex]: payload,
    };
    options.clearChapterRuntimeCache(payload.chapterIndex);
    await options.openChapter(payload.chapterIndex, { forceNetwork: true });
    options.message.success(`当前章节已临时切到 ${payload.sourceName}`);
  }

  async function handleWholeBookSourceSwitched(payload: WholeBookSwitchedPayload) {
    options.temporaryChapterOverrides.value = {};
    options.clearChapterRuntimeCache(options.readingChapterIndex.value);
    options.emitSourceSwitched(payload);
    await nextTick();
    if (!payload.sourceSwitched) {
      return;
    }
    options.clearAllRuntimeCache();
    options.invalidatePages();
    await options.openChapter(
      payload.matchedChapterIndex >= 0
        ? payload.matchedChapterIndex
        : options.readingChapterIndex.value,
      { position: 'resume' },
    );
  }

  return {
    openWholeBookSourceSwitch,
    openTemporaryChapterSwitch,
    clearTemporaryChapterSwitch,
    handleTemporaryChapterSourceSwitched,
    handleWholeBookSourceSwitched,
  };
}
