import { nextTick, reactive, type Ref } from 'vue';
import type { PaginationEngine, ReaderPagePadding, ReaderTypography } from '../types';
import { usePagination, type ReadingAnchor, type PageMeta } from './usePagination';

interface ChapterPageEntry {
  pages?: string[];
  pageMetas?: PageMeta[];
  pagesComplete?: boolean;
  pagePromise?: Promise<string[]>;
  completePromise?: Promise<string[]>;
  /** 锚点断页后解析出的目标页索引（仅在 anchor 模式下有值） */
  anchorResolvedPage?: number;
}

interface UsePagedChapterCacheOptions {
  activeHostRef: Ref<HTMLElement | null>;
  backgroundHostRef: Ref<HTMLElement | null>;
  loadChapterText: (index: number, forceNetwork?: boolean) => Promise<string>;
  getChapterTitle: (index: number) => string;
  getTypography: () => ReaderTypography;
  getPadding: () => number | ReaderPagePadding;
  getPaginationEngine?: () => PaginationEngine;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function waitForHost(hostRef: Ref<HTMLElement | null>): Promise<HTMLElement> {
  await nextTick();
  for (let i = 0; i < 90; i++) {
    const host = hostRef.value;
    if (host && host.clientWidth > 0 && host.clientHeight > 0) {
      return host;
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  throw new Error('分页容器未就绪');
}

export function usePagedChapterCache(options: UsePagedChapterCacheOptions) {
  const pageEntries = reactive(new Map<number, ChapterPageEntry>());

  function getEntry(index: number): ChapterPageEntry {
    let entry = pageEntries.get(index);
    if (!entry) {
      entry = {};
      pageEntries.set(index, entry);
    }
    return entry;
  }

  function setEntry(index: number, patch: Partial<ChapterPageEntry>) {
    const current = getEntry(index);
    pageEntries.set(index, { ...current, ...patch });
  }

  function getPages(index: number): string[] {
    return pageEntries.get(index)?.pages ?? [];
  }

  function getBoundaryPage(index: number, edge: 'first' | 'last'): string {
    const pages = getPages(index);
    if (!pages.length) {
      return '';
    }
    return edge === 'first' ? pages[0] : pages[pages.length - 1];
  }

  async function paginateWithHost(
    index: number,
    hostRef: Ref<HTMLElement | null>,
    forceNetwork = false,
    waitForComplete = false,
    anchor?: ReadingAnchor,
  ): Promise<string[]> {
    const host = await waitForHost(hostRef);
    const text = await options.loadChapterText(index, forceNetwork);
    const paginator = usePagination();
    const title = options.getChapterTitle(index);
    const prefixHtml = title ? `<p class="reader-chapter-title">${escapeHtml(title)}</p>` : '';

    const paginateJob = paginator.paginate(
      text,
      host,
      options.getTypography(),
      options.getPadding(),
      'first',
      prefixHtml,
      anchor,
      options.getPaginationEngine?.() ?? 'dom',
    );

    for (let i = 0; i < 120; i++) {
      if (paginator.pages.value.length > 0 || !paginator.isPaginating.value) {
        break;
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    const initialPages = paginator.pages.value.length > 0 ? paginator.pages.value : ['<p></p>'];
    const initialMetas = paginator.pageMetas.value.length > 0 ? paginator.pageMetas.value : [];
    setEntry(index, { pages: initialPages, pageMetas: initialMetas, pagesComplete: false });

    const completePromise = paginateJob.then(() => {
      const finalPages = paginator.pages.value.length > 0 ? paginator.pages.value : ['<p></p>'];
      const finalMetas = paginator.pageMetas.value;
      const resolvedPage = anchor ? paginator.currentPage.value : undefined;
      setEntry(index, {
        pages: finalPages,
        pageMetas: finalMetas,
        pagesComplete: true,
        completePromise: undefined,
        anchorResolvedPage: resolvedPage,
      });
      return finalPages;
    });

    setEntry(index, { completePromise });

    if (waitForComplete) {
      return completePromise;
    }

    void completePromise.catch(() => {});
    return initialPages;
  }

  function ensurePages(
    index: number,
    optionsArg: {
      background?: boolean;
      forceNetwork?: boolean;
      waitForComplete?: boolean;
      anchor?: ReadingAnchor;
    } = {},
  ): Promise<string[]> {
    if (index < 0) {
      return Promise.resolve([]);
    }

    const entry = getEntry(index);
    const forceNetwork = optionsArg.forceNetwork ?? false;

    if (forceNetwork) {
      setEntry(index, {
        pages: undefined,
        pagesComplete: false,
        pagePromise: undefined,
        completePromise: undefined,
      });
    }

    const waitForComplete = optionsArg.waitForComplete ?? false;

    if (entry.pages && !forceNetwork && (!waitForComplete || entry.pagesComplete === true)) {
      return Promise.resolve(entry.pages);
    }

    if (waitForComplete && entry.completePromise && !forceNetwork) {
      return entry.completePromise;
    }

    if (entry.pagePromise && !forceNetwork) {
      if (waitForComplete) {
        return entry.pagePromise.then(() => {
          const current = getEntry(index);
          return current.completePromise ?? Promise.resolve(current.pages ?? []);
        });
      }
      return entry.pagePromise;
    }

    const hostRef =
      optionsArg.background === true ? options.backgroundHostRef : options.activeHostRef;
    const promise = paginateWithHost(
      index,
      hostRef,
      forceNetwork,
      waitForComplete,
      optionsArg.anchor,
    ).finally(() => {
      if (getEntry(index).pagePromise === promise) {
        setEntry(index, { pagePromise: undefined });
      }
    });

    setEntry(index, { pagePromise: promise });
    return promise;
  }

  async function warmPages(indices: number[]) {
    const seen = new Set<number>();
    for (const index of indices) {
      if (index < 0 || seen.has(index)) {
        continue;
      }
      seen.add(index);
      try {
        // eslint-disable-next-line no-await-in-loop
        await ensurePages(index, { background: true });
      } catch {
        // 后台预排版失败不影响当前阅读
      }
    }
  }

  function invalidatePages(indices?: number[]) {
    if (!indices) {
      pageEntries.clear();
      return;
    }

    for (const index of indices) {
      pageEntries.delete(index);
    }
  }

  function dropChapter(index: number) {
    pageEntries.delete(index);
  }

  function getPageMetas(index: number): PageMeta[] {
    return pageEntries.get(index)?.pageMetas ?? [];
  }

  /**
   * 为指定章节的指定页构建阅读锚点。
   */
  function buildAnchorForChapterPage(chapterIndex: number, pageIndex: number): ReadingAnchor {
    const metas = getPageMetas(chapterIndex);
    const total = getPages(chapterIndex).length;
    if (pageIndex < 0 || pageIndex >= metas.length || total <= 0) {
      return { charOffset: -1, paragraphIndex: -1, paragraphCharOffset: -1, ratio: 0 };
    }
    const meta = metas[pageIndex];
    return {
      charOffset: meta.charOffset,
      paragraphIndex: meta.paragraphIndex,
      paragraphCharOffset: meta.paragraphCharOffset,
      ratio: total > 1 ? pageIndex / (total - 1) : 0,
    };
  }

  function getAnchorResolvedPage(index: number): number | undefined {
    return pageEntries.get(index)?.anchorResolvedPage;
  }

  return {
    ensurePages,
    getPages,
    getPageMetas,
    getAnchorResolvedPage,
    getBoundaryPage,
    warmPages,
    invalidatePages,
    dropChapter,
    buildAnchorForChapterPage,
  };
}
