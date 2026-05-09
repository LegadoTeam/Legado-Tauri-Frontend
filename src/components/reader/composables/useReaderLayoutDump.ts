import type { ComputedRef, Ref } from 'vue';
import { nextTick } from 'vue';
import type { ChapterItem } from '@/stores';
import type { ReaderSettings } from '../types';
import type { usePagedChapterCache } from './usePagedChapterCache';

type PagedCacheInstance = ReturnType<typeof usePagedChapterCache>;

interface UseReaderLayoutDumpOptions {
  readerBodyRef: Ref<HTMLElement | null>;
  measureHostRef: Ref<HTMLElement | null>;
  backgroundMeasureHostRef: Ref<HTMLElement | null>;
  legacyPagedMode: ComputedRef<string | null>;
  isPagedMode: ComputedRef<boolean>;
  pagedPageIndex: Ref<number>;
  activePagedPages: ComputedRef<string[]>;
  pagedCache: PagedCacheInstance;
  pagedLoading: Ref<boolean>;
  activeChapterIndex: Ref<number>;
  hasPrev: ComputedRef<boolean>;
  hasNext: ComputedRef<boolean>;
  getChapter: (index: number) => ChapterItem | undefined;
  getFallbackChapterName: () => string;
  getFallbackChapterUrl: () => string;
  getChaptersLength: () => number;
  settings: ReaderSettings;
  appendDebugLog: (msg: string) => void;
  message: { warning: (msg: string) => void; success: (msg: string) => void };
}

function formatDebugNumber(value: number, digits = 2): number {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : 0;
}

function buildRectSnapshot(rect: DOMRect | DOMRectReadOnly) {
  return {
    left: formatDebugNumber(rect.left),
    top: formatDebugNumber(rect.top),
    width: formatDebugNumber(rect.width),
    height: formatDebugNumber(rect.height),
    right: formatDebugNumber(rect.right),
    bottom: formatDebugNumber(rect.bottom),
  };
}

function collectReaderCssVars(target: HTMLElement) {
  const style = getComputedStyle(target);
  const varNames = [
    '--reader-font-family',
    '--reader-font-size',
    '--reader-line-height',
    '--reader-letter-spacing',
    '--reader-word-spacing',
    '--reader-paragraph-spacing',
    '--reader-text-indent',
    '--reader-font-weight',
    '--reader-font-style',
    '--reader-text-align',
    '--reader-text-decoration',
    '--reader-font-variant',
    '--reader-text-stroke-width',
    '--reader-text-stroke-color',
    '--reader-text-shadow',
    '--reader-text-color',
    '--reader-bg-color',
    '--reader-selection-color',
    '--reader-padding-top',
    '--reader-padding-right',
    '--reader-padding-bottom',
    '--reader-padding-left',
    '--reader-padding',
    '--reader-bg-image',
    '--reader-bg-size',
    '--reader-bg-position',
    '--reader-bg-repeat',
    '--reader-bg-attachment',
    '--reader-bg-blend-mode',
  ] as const;

  return Object.fromEntries(varNames.map((name) => [name, style.getPropertyValue(name).trim()]));
}

function buildStyleSnapshot(target: HTMLElement) {
  const style = getComputedStyle(target);
  const cssProps = [
    'display',
    'position',
    'overflow',
    'overflowX',
    'overflowY',
    'boxSizing',
    'width',
    'height',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'marginTop',
    'marginRight',
    'marginBottom',
    'marginLeft',
    'fontFamily',
    'fontSize',
    'fontWeight',
    'fontStyle',
    'lineHeight',
    'letterSpacing',
    'wordSpacing',
    'textAlign',
    'textIndent',
    'whiteSpace',
    'wordBreak',
    'overflowWrap',
    'transform',
    'transformOrigin',
    'opacity',
    'zIndex',
  ] as const;

  return Object.fromEntries(cssProps.map((name) => [name, style[name]]));
}

function trimDebugText(text: string, maxChars: number) {
  const normalized = text.trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, maxChars)}\n...[truncated ${normalized.length - maxChars} chars]`;
}

function prettifyHtmlForDebug(html: string, maxChars: number) {
  return trimDebugText(html.replace(/></g, '>\n<'), maxChars);
}

export function useReaderLayoutDump(options: UseReaderLayoutDumpOptions) {
  const {
    readerBodyRef,
    measureHostRef,
    backgroundMeasureHostRef,
    legacyPagedMode,
    isPagedMode,
    pagedPageIndex,
    activePagedPages,
    pagedCache,
    pagedLoading,
    activeChapterIndex,
    hasPrev,
    hasNext,
    getChapter,
    getFallbackChapterName,
    getFallbackChapterUrl,
    getChaptersLength,
    settings,
    appendDebugLog,
    message,
  } = options;

  function getCurrentPagedPageElement() {
    const root = readerBodyRef.value;
    if (!root) {
      return null;
    }

    if (legacyPagedMode.value === 'slide') {
      return root.querySelector<HTMLElement>(
        '.paged-mode__slide-track > .paged-mode__page:nth-child(2)',
      );
    }

    if (legacyPagedMode.value === 'cover' || legacyPagedMode.value === 'simulation') {
      return root.querySelector<HTMLElement>('.paged-mode__fg');
    }

    if (legacyPagedMode.value === 'none') {
      return root.querySelector<HTMLElement>('.paged-mode__page--none');
    }

    return root.querySelector<HTMLElement>('.paged-mode__page');
  }

  async function dumpPaginationLayoutDebug() {
    await nextTick();

    if (!isPagedMode.value) {
      appendDebugLog('[ReaderLayoutDump] 当前不是分页模式，未输出排版诊断。');
      message.warning('当前不是分页模式');
      return;
    }

    const chapter = getChapter(activeChapterIndex.value);
    const currentPage = Math.max(0, pagedPageIndex.value);
    const pages = activePagedPages.value;
    const pageHtml = pages[currentPage] ?? '';
    const pageMetas = pagedCache.getPageMetas(activeChapterIndex.value);
    const pageMeta = pageMetas[currentPage] ?? null;
    const anchor = pagedCache.buildAnchorForChapterPage(activeChapterIndex.value, currentPage);
    const pageElement = getCurrentPagedPageElement();
    const readerRoot = readerBodyRef.value;
    const pageCount = pages.length;

    if (!readerRoot || !pageElement) {
      appendDebugLog('[ReaderLayoutDump] 找不到当前页 DOM，未输出排版诊断。');
      message.warning('当前页 DOM 未就绪');
      return;
    }

    const pageBlocks = Array.from(pageElement.querySelectorAll<HTMLElement>('.reader-block'));
    const pageLines = Array.from(pageElement.querySelectorAll<HTMLElement>('.reader-line'));
    const pageGaps = Array.from(pageElement.querySelectorAll<HTMLElement>('.reader-gap'));
    const pageText = pageElement.innerText;
    const pageRect = pageElement.getBoundingClientRect();
    const readerRect = readerRoot.getBoundingClientRect();
    const modeRoot =
      readerRoot.querySelector<HTMLElement>('.paged-mode') ?? readerRoot;

    const dump = {
      tag: 'ReaderLayoutDump',
      createdAt: new Date().toISOString(),
      chapter: {
        index: activeChapterIndex.value,
        name: chapter?.name ?? getFallbackChapterName(),
        url: chapter?.url ?? getFallbackChapterUrl(),
        totalChapters: getChaptersLength(),
      },
      paging: {
        flipMode: settings.flipMode,
        paginationEngine: settings.paginationEngine,
        currentPage,
        pageCount,
        currentDisplay: `${Math.min(currentPage + 1, Math.max(pageCount, 1))}/${Math.max(pageCount, 1)}`,
        loading: pagedLoading.value,
        hasPrevChapter: hasPrev.value,
        hasNextChapter: hasNext.value,
        anchorResolvedPage: pagedCache.getAnchorResolvedPage(activeChapterIndex.value) ?? null,
        pageMeta,
        anchor,
      },
      viewport: {
        readerBodyRect: buildRectSnapshot(readerRect),
        modeRootRect: buildRectSnapshot(modeRoot.getBoundingClientRect()),
        pageRect: buildRectSnapshot(pageRect),
        clientWidth: readerRoot.clientWidth,
        clientHeight: readerRoot.clientHeight,
        devicePixelRatio: window.devicePixelRatio || 1,
        windowInnerWidth: window.innerWidth,
        windowInnerHeight: window.innerHeight,
        measureHost: measureHostRef.value
          ? {
              clientWidth: measureHostRef.value.clientWidth,
              clientHeight: measureHostRef.value.clientHeight,
            }
          : null,
        backgroundMeasureHost: backgroundMeasureHostRef.value
          ? {
              clientWidth: backgroundMeasureHostRef.value.clientWidth,
              clientHeight: backgroundMeasureHostRef.value.clientHeight,
            }
          : null,
      },
      settings: {
        typography: { ...settings.typography },
        pagePadding: { ...settings.pagePadding },
        theme: { ...settings.theme },
        themePresetId: settings.themePresetId,
        backgroundImage: settings.backgroundImage,
        backgroundPresetId: settings.backgroundPresetId,
        skinPresetId: settings.skinPresetId,
        tapZoneLeft: settings.tapZoneLeft,
        tapZoneRight: settings.tapZoneRight,
        tapLeftAction: settings.tapLeftAction,
        tapRightAction: settings.tapRightAction,
        layoutDebugMode: settings.layoutDebugMode,
      },
      cssVars: collectReaderCssVars(readerRoot),
      modeRootStyle: buildStyleSnapshot(modeRoot),
      pageStyle: buildStyleSnapshot(pageElement),
      pageDom: {
        tagName: pageElement.tagName,
        className: pageElement.className,
        childElementCount: pageElement.childElementCount,
        scrollWidth: pageElement.scrollWidth,
        scrollHeight: pageElement.scrollHeight,
        clientWidth: pageElement.clientWidth,
        clientHeight: pageElement.clientHeight,
        offsetWidth: pageElement.offsetWidth,
        offsetHeight: pageElement.offsetHeight,
        textLength: pageText.length,
        htmlLength: pageHtml.length,
        blockCount: pageBlocks.length,
        lineCount: pageLines.length,
        gapCount: pageGaps.length,
      },
      blocks: pageBlocks.map((block, index) => {
        const rect = block.getBoundingClientRect();
        const lines = Array.from(block.querySelectorAll<HTMLElement>('.reader-line'));
        return {
          index,
          className: block.className,
          rect: buildRectSnapshot(rect),
          lineCount: lines.length,
          textLength: block.innerText.trim().length,
          textPreview: trimDebugText(block.innerText, 240),
        };
      }),
      lines: pageLines.map((line, index) => {
        const rect = line.getBoundingClientRect();
        const style = getComputedStyle(line);
        const text = line.innerText;
        return {
          index,
          className: line.className,
          rect: buildRectSnapshot(rect),
          textLength: text.trim().length,
          text,
          paddingInlineStart: style.paddingInlineStart,
          textAlign: style.textAlign,
          lineHeight: style.lineHeight,
        };
      }),
      gaps: pageGaps.map((gap, index) => ({
        index,
        className: gap.className,
        rect: buildRectSnapshot(gap.getBoundingClientRect()),
        inlineHeight: gap.style.height || getComputedStyle(gap).height,
      })),
      pageText: trimDebugText(pageText, 12000),
      pageHtml: prettifyHtmlForDebug(pageHtml, 16000),
    };

    appendDebugLog(`[ReaderLayoutDump]\n${JSON.stringify(dump, null, 2)}`);
    message.success('当前页排版信息已输出到实时日志');
  }

  return { dumpPaginationLayoutDebug };
}
