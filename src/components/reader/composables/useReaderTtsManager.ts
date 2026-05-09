import type { ComputedRef, Ref } from 'vue';
import { nextTick, ref, watch } from 'vue';
import { useTts, splitIntoSegments } from '@/composables/useTts';
import type { PagedModeApi, ScrollModeApi } from './useReaderModeBridge';

interface UseReaderTtsManagerOptions {
  activeChapterIndex: Ref<number>;
  content: Ref<string>;
  isPagedMode: ComputedRef<boolean>;
  isScrollMode: ComputedRef<boolean>;
  isComicMode: ComputedRef<boolean>;
  isVideoMode: ComputedRef<boolean>;
  pagedPageIndex: Ref<number>;
  activePagedPages: ComputedRef<string[]>;
  hasPrev: ComputedRef<boolean>;
  hasNext: ComputedRef<boolean>;
  pagedModeRef: Ref<PagedModeApi | null>;
  scrollModeRef: Ref<ScrollModeApi | null>;
  blockingLoading: ComputedRef<boolean>;
  setPagedPage: (page: number) => void;
  fetchRawChapterText: (index: number) => Promise<string>;
  gotoNextChapter: () => Promise<void>;
}

/** 从页面 HTML 字符串中提取所有 .reader-line 的纯文本 */
function extractPageLines(html: string): string[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return Array.from(doc.querySelectorAll('.reader-line'))
    .map((el) => el.textContent.trim())
    .filter(Boolean);
}

export function useReaderTtsManager(options: UseReaderTtsManagerOptions) {
  const {
    activeChapterIndex,
    content,
    isPagedMode: _isPagedMode,
    isScrollMode,
    isComicMode,
    isVideoMode,
    pagedPageIndex,
    activePagedPages,
    hasPrev: _hasPrev,
    hasNext,
    pagedModeRef,
    scrollModeRef,
    blockingLoading,
    setPagedPage,
    fetchRawChapterText,
    gotoNextChapter,
  } = options;

  void _hasPrev; // referenced in future: not currently used
  void _isPagedMode;

  const tts = useTts();
  const ttsProgressText = ref('—');
  const ttsScrollHighlightIdx = ref(-1);
  const showTtsBar = ref(false);

  // TTS 分页模式状态（跨章节持续累计）
  let ttsPageRanges: { page: number; chapterIdx: number; start: number; end: number }[] = [];
  let ttsFeedPage = 0;
  let ttsFeedChapter = -1;

  /**
   * 等待下一章加载完成后返回。
   */
  async function gotoNextChapterAndWait(): Promise<void> {
    if (!hasNext.value) {
      return;
    }
    const targetIdx = activeChapterIndex.value + 1;
    await gotoNextChapter();
    if (blockingLoading.value) {
      await new Promise<void>((resolve) => {
        const stop = watch(
          [blockingLoading, activeChapterIndex] as const,
          ([isLoading, idx]) => {
            if (idx === targetIdx && !isLoading) {
              stop();
              resolve();
            }
          },
          { immediate: true },
        );
      });
    }
  }

  /** 构建分页模式的 TTS 启动参数 */
  function buildPagedTtsOptions() {
    const startPage = pagedPageIndex.value;
    const pages = activePagedPages.value;
    if (pages.length === 0) {
      return null;
    }

    ttsPageRanges = [];
    ttsFeedPage = startPage;
    ttsFeedChapter = activeChapterIndex.value;
    let globalIdx = 0;

    const firstLines = extractPageLines(pages[startPage] ?? '');
    if (firstLines.length > 0) {
      ttsPageRanges.push({
        page: startPage,
        chapterIdx: ttsFeedChapter,
        start: 0,
        end: firstLines.length,
      });
      globalIdx = firstLines.length;
    }

    const onNeedMore = async (): Promise<string[] | null> => {
      const nextPage = ttsFeedPage + 1;
      const currentPages = activePagedPages.value;

      if (nextPage < currentPages.length) {
        ttsFeedPage = nextPage;
        const lines = extractPageLines(currentPages[nextPage] ?? '');
        if (lines.length > 0) {
          ttsPageRanges.push({
            page: nextPage,
            chapterIdx: ttsFeedChapter,
            start: globalIdx,
            end: globalIdx + lines.length,
          });
          globalIdx += lines.length;
        }
        return lines.length > 0 ? lines : onNeedMore();
      }

      if (!hasNext.value) {
        return null;
      }
      void fetchRawChapterText(activeChapterIndex.value + 1);
      await gotoNextChapterAndWait();

      ttsFeedPage = 0;
      ttsFeedChapter = activeChapterIndex.value;
      const newPages = activePagedPages.value;
      if (newPages.length === 0) {
        return null;
      }

      const lines = extractPageLines(newPages[0] ?? '');
      if (lines.length > 0) {
        ttsPageRanges.push({
          page: 0,
          chapterIdx: ttsFeedChapter,
          start: globalIdx,
          end: globalIdx + lines.length,
        });
        globalIdx += lines.length;
      }
      return lines.length > 0 ? lines : onNeedMore();
    };

    const onSegmentStart = (gIdx: number) => {
      const range = ttsPageRanges.find((r) => gIdx >= r.start && gIdx < r.end);
      if (!range) {
        return;
      }

      const localIdx = gIdx - range.start;
      const total =
        range.chapterIdx === activeChapterIndex.value ? activePagedPages.value.length : 0;
      ttsProgressText.value =
        total > 0 ? `第 ${range.page + 1}/${total} 页` : `第 ${range.page + 1} 页`;

      if (range.chapterIdx === activeChapterIndex.value && range.page !== pagedPageIndex.value) {
        setPagedPage(range.page);
      }

      void nextTick(() => {
        pagedModeRef.value?.highlightLine?.(localIdx);
      });
    };

    return {
      initialSegments: firstLines,
      onNeedMore,
      onSegmentStart,
      onAllDone: () => {
        showTtsBar.value = false;
      },
    };
  }

  /** 构建滚动模式的 TTS 启动参数 */
  function buildScrollTtsOptions() {
    const startPara = scrollModeRef.value?.getFirstVisibleParaIndex?.() ?? 0;
    ttsFeedChapter = activeChapterIndex.value;

    const paragraphs = content.value.split(/\n+/).filter((p) => p.trim());
    const initialSegs = paragraphs.slice(startPara).flatMap((p) => splitIntoSegments(p));

    if (initialSegs.length === 0) {
      return null;
    }

    const segToParaMap: number[] = [];
    for (let pi = startPara; pi < paragraphs.length; pi++) {
      const segs = splitIntoSegments(paragraphs[pi] ?? '');
      for (let si = 0; si < segs.length; si++) {
        segToParaMap.push(pi);
      }
    }
    let totalInitialSegs = initialSegs.length;

    const onNeedMore = async (): Promise<string[] | null> => {
      if (!hasNext.value) {
        return null;
      }
      void fetchRawChapterText(activeChapterIndex.value + 1);
      await gotoNextChapterAndWait();
      ttsFeedChapter = activeChapterIndex.value;
      const newParas = content.value.split(/\n+/).filter((p) => p.trim());
      const newSegs = newParas.flatMap((p) => splitIntoSegments(p));
      for (let pi = 0; pi < newParas.length; pi++) {
        const segs = splitIntoSegments(newParas[pi] ?? '');
        for (let si = 0; si < segs.length; si++) {
          segToParaMap.push(pi);
        }
      }
      totalInitialSegs += newSegs.length;
      return newSegs.length > 0 ? newSegs : null;
    };

    const onSegmentStart = (gIdx: number) => {
      const paraIdx = segToParaMap[gIdx] ?? -1;
      if (paraIdx >= 0) {
        ttsScrollHighlightIdx.value = paraIdx;
        ttsProgressText.value = `第 ${paraIdx + 1} 段`;
        void nextTick(() => {
          const el = scrollModeRef.value;
          if (!el) {
            return;
          }
          const container = el.$el ?? null;
          if (!container) {
            return;
          }
          const paras = container.querySelectorAll<HTMLElement>('.scroll-mode__para');
          paras[paraIdx]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }
    };

    return {
      initialSegments: initialSegs,
      onNeedMore,
      onSegmentStart,
      onAllDone: () => {
        showTtsBar.value = false;
      },
    };
  }

  function onTtsToggle() {
    if (showTtsBar.value) {
      showTtsBar.value = false;
      tts.stop();
      return;
    }

    if (isComicMode.value || isVideoMode.value) {
      return;
    }

    let opts: ReturnType<typeof buildPagedTtsOptions>;
    if (isScrollMode.value) {
      opts = buildScrollTtsOptions();
    } else {
      opts = buildPagedTtsOptions();
    }
    if (!opts) {
      return;
    }

    showTtsBar.value = true;
    ttsProgressText.value = '—';
    tts.startReading(opts);
  }

  // TTS 控制条关闭时停止播放 + 清除高亮
  watch(
    () => showTtsBar.value,
    (v) => {
      if (!v) {
        tts.stop();
        ttsScrollHighlightIdx.value = -1;
        pagedModeRef.value?.clearTtsHighlight?.();
        ttsProgressText.value = '—';
      }
    },
  );

  // 章节切换时如果 TTS 未在播放，清理遗留状态
  watch(activeChapterIndex, () => {
    if (!showTtsBar.value) {
      tts.stop();
      ttsScrollHighlightIdx.value = -1;
    }
  });

  return {
    tts,
    ttsProgressText,
    ttsScrollHighlightIdx,
    showTtsBar,
    onTtsToggle,
  };
}
