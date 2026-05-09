import type { ComputedRef, Ref } from 'vue';
import type { OpenChapterOptions } from '@/components/reader/composables/useReaderChapterOpen';

type NavDirection = 'forward' | 'backward';

interface ReaderNavigationControllerOptions {
  activeChapterIndex: Ref<number>;
  navDirection: Ref<NavDirection>;
  hasPrev: ComputedRef<boolean>;
  hasNext: ComputedRef<boolean>;
  saveDetailedProgress: () => void;
  openChapter: (index: number, options?: OpenChapterOptions) => Promise<void>;
}

export function createReaderNavigationController(options: ReaderNavigationControllerOptions) {
  async function gotoPrevChapter() {
    if (!options.hasPrev.value) {
      return;
    }
    options.saveDetailedProgress();
    options.navDirection.value = 'backward';
    await options.openChapter(options.activeChapterIndex.value - 1, { position: 'first' });
  }

  async function gotoNextChapter() {
    if (!options.hasNext.value) {
      return;
    }
    options.saveDetailedProgress();
    options.navDirection.value = 'forward';
    await options.openChapter(options.activeChapterIndex.value + 1, { position: 'first' });
  }

  async function gotoPrevBoundary() {
    if (!options.hasPrev.value) {
      return;
    }
    options.saveDetailedProgress();
    options.navDirection.value = 'backward';
    await options.openChapter(options.activeChapterIndex.value - 1, { position: 'last' });
  }

  async function gotoNextBoundary() {
    if (!options.hasNext.value) {
      return;
    }
    options.saveDetailedProgress();
    options.navDirection.value = 'forward';
    await options.openChapter(options.activeChapterIndex.value + 1, { position: 'first' });
  }

  async function gotoChapter(index: number) {
    if (index === options.activeChapterIndex.value) {
      return;
    }
    options.saveDetailedProgress();
    options.navDirection.value = index < options.activeChapterIndex.value ? 'backward' : 'forward';
    await options.openChapter(index, { position: 'first' });
  }

  return {
    gotoPrevChapter,
    gotoNextChapter,
    gotoPrevBoundary,
    gotoNextBoundary,
    gotoChapter,
  };
}
