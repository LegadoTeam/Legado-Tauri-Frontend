import { ref, watch, type Ref } from 'vue';
import type { ChapterGroup, ChapterItem } from '@/stores';
import { useMusicPlayerStore } from '@/stores';
import { safeRandomUUID } from '@/utils/uuid';
import type { ReaderBookInfo } from '../components/reader/types';

interface ReaderSwitchShelfBook {
  name: string;
  author: string;
  coverUrl?: string;
  intro?: string;
  kind?: string;
  bookUrl: string;
  sourceName: string;
  fileName: string;
  lastChapter?: string;
  totalChapters: number;
  sourceType?: string;
}

interface ReaderSwitchPayload {
  shelfBook: ReaderSwitchShelfBook;
  chapters: ChapterItem[];
  matchedChapterIndex: number;
  matchedChapterUrl?: string;
}

interface ReadChapterPayload {
  chapterUrl: string;
  chapterName: string;
  index: number;
  bookInfo: ReaderBookInfo;
  sourceType: string;
  tocUrl?: string;
  chapterGroups?: ChapterGroup[];
  activeGroupIndex?: number;
}

interface UseInlineBookReaderOptions {
  showDrawer: Ref<boolean>;
  drawerBookUrl: Ref<string>;
  drawerFileName: Ref<string>;
  privacyExitTick: Ref<unknown>;
  runChapterList: (fileName: string, tocUrl: string, taskId?: string) => Promise<unknown>;
  cancelTask: (taskId: string) => void;
  ensureShelfLoaded: () => Promise<void>;
  getShelfId: (bookUrl: string, fileName: string) => string | undefined;
  isPrivateShelfBook: (shelfId: string) => boolean;
  onTrackReaderOpen?: (payload: ReadChapterPayload) => void;
}

export function useInlineBookReader(options: UseInlineBookReaderOptions) {
  const showReader = ref(false);
  const readerChapterUrl = ref('');
  const readerChapterName = ref('');
  const readerFileName = ref('');
  const readerChapters = ref<ChapterItem[]>([]);
  const readerChaptersKey = ref('');
  const readerCurrentIndex = ref(0);
  const readerBookInfo = ref<ReaderBookInfo | undefined>();
  const readerSourceType = ref('novel');
  const readerShelfId = ref('');
  const readerChapterGroups = ref<ChapterGroup[] | undefined>();
  const readerActiveGroupIndex = ref<number | undefined>();
  const chapterListTaskId = ref<string | null>(null);

  function applySourceSwitchToReader(payload: ReaderSwitchPayload) {
    readerFileName.value = payload.shelfBook.fileName;
    readerSourceType.value = payload.shelfBook.sourceType ?? readerSourceType.value;
    readerChapters.value = payload.chapters;
    readerCurrentIndex.value = Math.max(0, payload.matchedChapterIndex);
    const chapter = payload.chapters[readerCurrentIndex.value];
    readerChapterUrl.value = payload.matchedChapterUrl ?? chapter?.url ?? '';
    readerChapterName.value = chapter?.name ?? '';
    readerBookInfo.value = {
      name: payload.shelfBook.name,
      author: payload.shelfBook.author,
      coverUrl: payload.shelfBook.coverUrl,
      intro: payload.shelfBook.intro,
      kind: payload.shelfBook.kind,
      bookUrl: payload.shelfBook.bookUrl,
      sourceName: payload.shelfBook.sourceName,
      fileName: payload.shelfBook.fileName,
      lastChapter: payload.shelfBook.lastChapter,
      totalChapters: payload.shelfBook.totalChapters,
    };
  }

  async function onReadChapter(payload: ReadChapterPayload) {
    options.onTrackReaderOpen?.(payload);

    if (payload.sourceType === 'music') {
      // 音乐源：拉一次章节列表，然后交由全局播放器接管
      const player = useMusicPlayerStore();
      let list: ChapterItem[] = readerChapters.value;
      const bookKey = `${options.drawerFileName.value}|${options.drawerBookUrl.value}`;
      if (readerChaptersKey.value !== bookKey || !list.length) {
        readerChaptersKey.value = bookKey;
        try {
          const tocUrl = payload.tocUrl ?? options.drawerBookUrl.value;
          const raw = await options.runChapterList(options.drawerFileName.value, tocUrl);
          list = Array.isArray(raw) ? (raw as ChapterItem[]) : [];
          readerChapters.value = list;
        } catch {
          list = [];
        }
      }
      await player.playList(
        {
          fileName: options.drawerFileName.value,
          bookUrl: options.drawerBookUrl.value,
          name: payload.bookInfo.name,
          author: payload.bookInfo.author,
          coverUrl: payload.bookInfo.coverUrl,
          intro: payload.bookInfo.intro,
          sourceName: payload.bookInfo.sourceName,
        },
        list.map((c) => ({ chapterUrl: c.url, name: c.name })),
        Math.max(0, payload.index),
      );
      return;
    }

    readerChapterUrl.value = payload.chapterUrl;
    readerChapterName.value = payload.chapterName;
    readerFileName.value = options.drawerFileName.value;
    readerCurrentIndex.value = payload.index;
    readerBookInfo.value = payload.bookInfo;
    readerSourceType.value = payload.sourceType;
    readerChapterGroups.value = payload.chapterGroups;
    readerActiveGroupIndex.value = payload.activeGroupIndex;

    try {
      await options.ensureShelfLoaded();
      readerShelfId.value =
        options.getShelfId(options.drawerBookUrl.value, options.drawerFileName.value) ?? '';
    } catch {
      readerShelfId.value = '';
    }

    const bookKey = `${options.drawerFileName.value}|${options.drawerBookUrl.value}`;
    if (readerChaptersKey.value !== bookKey) {
      readerChapters.value = [];
      readerChaptersKey.value = bookKey;
      if (chapterListTaskId.value) {
        options.cancelTask(chapterListTaskId.value);
        chapterListTaskId.value = null;
      }
    }

    if (!readerChapters.value.length) {
      const taskId = safeRandomUUID();
      chapterListTaskId.value = taskId;
      try {
        const tocUrl = payload.tocUrl ?? options.drawerBookUrl.value;
        const raw = await options.runChapterList(options.drawerFileName.value, tocUrl, taskId);
        readerChapters.value = Array.isArray(raw) ? (raw as ChapterItem[]) : [];
      } catch {
        // 加载失败不阻塞阅读
      } finally {
        chapterListTaskId.value = null;
      }
    }

    showReader.value = true;
  }

  function onReaderClose() {
    if (chapterListTaskId.value) {
      options.cancelTask(chapterListTaskId.value);
      chapterListTaskId.value = null;
    }
  }

  watch(readerCurrentIndex, (index) => {
    if (index >= 0 && index < readerChapters.value.length) {
      const chapter = readerChapters.value[index];
      readerChapterUrl.value = chapter.url;
      readerChapterName.value = chapter.name;
    }
  });

  watch(options.privacyExitTick, () => {
    if (!showReader.value || !readerShelfId.value) {
      return;
    }
    if (!options.isPrivateShelfBook(readerShelfId.value)) {
      return;
    }
    showReader.value = false;
  });

  watch(showReader, (visible) => {
    if (!visible) {
      onReaderClose();
    }
  });

  watch(options.showDrawer, (visible) => {
    if (!visible) {
      onReaderClose();
    }
  });

  return {
    showReader,
    readerChapterUrl,
    readerChapterName,
    readerFileName,
    readerChapters,
    readerCurrentIndex,
    readerBookInfo,
    readerSourceType,
    readerShelfId,
    readerChapterGroups,
    readerActiveGroupIndex,
    applySourceSwitchToReader,
    onReadChapter,
    onReaderClose,
  };
}
