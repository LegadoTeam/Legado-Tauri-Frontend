/**
 * usePagination — 文本分页引擎
 *
 * 默认使用 Pretext 引擎（pretext）：
 *   使用 Canvas measureText + Pretext 库做逐行布局，支持 letterSpacing、wordBreak: keep-all、
 *   CJK/标点/混排更贴近浏览器。@chenglou/pretext 0.0.6+ 起支持 letterSpacing 数字像素，
 *   0.0.7 修复大量 CJK/标点/软连字符/字距边界问题。
 *   部分旧版 Android WebView 的 Canvas 测量存在偏差，可切换为 DOM 引擎。
 *
 * 可选 DOM 引擎（dom）：
 *   将文本注入隐藏 DOM 容器，通过 Range.getClientRects() 获取精确行高与行字符边界。
 *   天然支持系统字体缩放、WebView 字体自适应、所有 CSS 排版属性，无需任何补偿系数。
 *
 * 连续标点保护（Pretext 引擎）：连续的 `……`、`——` 等在传入 Pretext 前先插入 U+2060
 * WORD JOINER，阻止在其间产生换行机会；渲染输出前自动剥离。
 *
 * 取消机制（cancelToken）：
 *   每次调用 paginate 递增 cancelToken；
 *   后台任务在每个 await 点检查令牌，不一致则安全退出。
 */
import { layoutNextLine, prepareWithSegments, type LayoutCursor } from '@chenglou/pretext';
import { ref, nextTick } from 'vue';
import type { PaginationEngine, ReaderPagePadding, ReaderTypography } from '../types';

export interface PaginationResult {
  pages: string[];
  currentPage: number;
}

/**
 * 阅读位置锚点 — 用于跨重排恢复阅读位置。
 * 优先级：charOffset > paragraphIndex + paragraphCharOffset > ratio > 0
 */
export interface ReadingAnchor {
  /** 当前页首字在章节全文（splitParagraphs 前原始文本）中的字符偏移 */
  charOffset: number;
  /** 当前页首字所属段落索引（基于 splitParagraphs 结果） */
  paragraphIndex: number;
  /** 当前页首字在段落内的字符偏移 */
  paragraphCharOffset: number;
  /** 阅读进度比例 0-1，作为最终兜底 */
  ratio: number;
}

/** 每页的元数据，用于锚点定位 */
export interface PageMeta {
  /** 该页首字在全文中的字符偏移 */
  charOffset: number;
  /** 该页首字所属段落索引 */
  paragraphIndex: number;
  /** 该页首字在段落内的字符偏移 */
  paragraphCharOffset: number;
}

type PaginationBlockKind = 'title' | 'paragraph';

interface PaginationBlockInput {
  kind: PaginationBlockKind;
  text: string;
  font: string;
  lineHeightPx: number;
  leadingGapPx: number;
  trailingGapPx: number;
  firstLineIndentPx: number;
  textAlign: ReaderTypography['textAlign'];
  /** 字间距 px，传给 Pretext 引擎的 letterSpacing 选项 */
  letterSpacingPx: number;
  /** 该 block 在原始全文中的字符偏移起始 */
  charOffsetInContent: number;
  /** 该 block 在段落列表中的索引（title = -1） */
  paragraphIndex: number;
}

interface PaginationResolvedLine {
  text: string;
  indentPx: number;
  lineHeightPx: number;
  textAlign: 'left' | 'center' | 'right' | 'justify';
  justify: boolean;
  isTerminal: boolean;
  /** 该行首字在 block 原始文本中的字符偏移 */
  charOffsetInBlock: number;
}

interface PaginationResolvedBlock {
  kind: PaginationBlockKind;
  lines: PaginationResolvedLine[];
  leadingGapPx: number;
  trailingGapPx: number;
}

interface PaginationPageGapItem {
  kind: 'gap';
  sizePx: number;
}

interface PaginationPageBlockItem {
  kind: 'block';
  blockKind: PaginationBlockKind;
  lines: PaginationResolvedLine[];
}

type PaginationPageItem = PaginationPageGapItem | PaginationPageBlockItem;

interface PaginationPageState {
  items: PaginationPageItem[];
  usedPx: number;
  hasVisibleContent: boolean;
}

// ─── 工具函数 ──────────────────────────────────────────────────────────────

function normalizePadding(padding: number | ReaderPagePadding): ReaderPagePadding {
  if (typeof padding === 'number') {
    return {
      top: padding,
      right: padding,
      bottom: padding,
      left: padding,
    };
  }
  return padding;
}

function formatPx(value: number): string {
  const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
  return `${safe}px`;
}

function buildCanvasFont(
  typography: ReaderTypography,
  overrides: Partial<
    Pick<ReaderTypography, 'fontSize' | 'fontWeight' | 'fontStyle' | 'fontVariant'>
  > = {},
): string {
  const fontStyle = overrides.fontStyle ?? typography.fontStyle;
  const fontVariant = overrides.fontVariant ?? typography.fontVariant;
  const fontWeight = overrides.fontWeight ?? typography.fontWeight;
  const fontSize = overrides.fontSize ?? typography.fontSize;
  return `${fontStyle} ${fontVariant} ${fontWeight} ${fontSize}px ${typography.fontFamily}`;
}

/**
 * 将排版属性应用到 DOM 元素。
 * 全量覆写，确保测量时不受容器继承样式影响。
 */
function applyTypographyToEl(
  el: HTMLElement,
  typography: ReaderTypography,
  overrides: { fontSize?: number; fontWeight?: number } = {},
) {
  const fontSize = overrides.fontSize ?? typography.fontSize;
  const fontWeight = overrides.fontWeight ?? typography.fontWeight;
  el.style.fontFamily = typography.fontFamily;
  el.style.fontSize = `${fontSize}px`;
  el.style.lineHeight = `${typography.lineHeight}`;
  el.style.letterSpacing = `${typography.letterSpacing}px`;
  el.style.wordSpacing = `${typography.wordSpacing}px`;
  el.style.fontWeight = `${fontWeight}`;
  el.style.fontStyle = typography.fontStyle;
  el.style.fontVariant = typography.fontVariant;
  el.style.textDecoration = typography.textDecoration;
  el.style.textShadow = typography.textShadow;
  el.style.cssText += `;-webkit-text-stroke-width:${typography.textStrokeWidth}px;-webkit-text-stroke-color:${typography.textStrokeColor}`;
  el.style.textRendering = 'optimizeLegibility';
  el.style.cssText += `;-webkit-font-smoothing:antialiased`;
}
function extractPrefixText(prefixHtml: string): string {
  if (!prefixHtml.trim()) {
    return '';
  }

  const probe = document.createElement('div');
  probe.innerHTML = prefixHtml;
  return probe.textContent?.trim() ?? '';
}

/**
 * 在连续的同类"粘性"标点（`……`、`——`）之间插入 U+2060 WORD JOINER，
 * 阻止 Pretext 在其间产生换行机会。U+2060 零宽，渲染输出前统一剥离。
 * 仅用于 Pretext 引擎路径。
 */
function protectStickyPunct(text: string): string {
  return text.replace(/(…{2,}|—{2,})/g, (match) => [...match].join('\u2060'));
}

function splitParagraphs(content: string): string[] {
  return content
    .split(/\r?\n+/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

function wrapRawPageHtml(contentHtml: string): string {
  return `<div class="reader-page-fragments">${contentHtml}</div>`;
}

function renderManualPage(items: PaginationPageItem[]): string {
  const body = items
    .map((item) => {
      if (item.kind === 'gap') {
        return `<div class="reader-gap" style="height:${formatPx(item.sizePx)}"></div>`;
      }

      const blockClass =
        item.blockKind === 'title'
          ? 'reader-block reader-block--title reader-chapter-title'
          : 'reader-block reader-block--paragraph';

      const lines = item.lines
        .map((line) => {
          const classes = ['reader-line'];
          if (line.justify) {
            classes.push('reader-line--justify');
          }
          if (line.isTerminal) {
            classes.push('reader-line--terminal');
          }

          const styles = [
            `min-height:${formatPx(line.lineHeightPx)}`,
            `line-height:${formatPx(line.lineHeightPx)}`,
            `text-align:${line.textAlign}`,
          ];
          if (line.indentPx > 0) {
            styles.push(`padding-inline-start:${formatPx(line.indentPx)}`);
          }

          return `<div class="${classes.join(' ')}" style="${styles.join(';')}">${escapeHtml(line.text.replace(/\u2060/g, ''))}</div>`;
        })
        .join('');

      return `<div class="${blockClass}">${lines}</div>`;
    })
    .join('');

  return `<div class="reader-page-fragments reader-page-fragments--manual-lines">${body}</div>`;
}

function createPageState(): PaginationPageState {
  return {
    items: [],
    usedPx: 0,
    hasVisibleContent: false,
  };
}

function pushGapItem(page: PaginationPageState, sizePx: number) {
  if (sizePx <= 0) {
    return;
  }

  const last = page.items[page.items.length - 1];
  if (last?.kind === 'gap') {
    last.sizePx += sizePx;
    return;
  }

  page.items.push({ kind: 'gap', sizePx });
}

function pushBlockItem(
  page: PaginationPageState,
  blockKind: PaginationBlockKind,
  lines: PaginationResolvedLine[],
) {
  if (lines.length === 0) {
    return;
  }

  page.items.push({
    kind: 'block',
    blockKind,
    lines: [...lines],
  });
}
// ─── block 输入构建 ────────────────────────────────────────────────────────

function resolveHorizontalBlocks(
  content: string,
  prefixHtml: string,
  typography: ReaderTypography,
): PaginationBlockInput[] {
  const blocks: PaginationBlockInput[] = [];
  const titleText = extractPrefixText(prefixHtml);
  const titleBaseFontSize = typography.fontSize + 4;

  if (titleText) {
    blocks.push({
      kind: 'title',
      text: titleText,
      font: buildCanvasFont(typography, { fontSize: titleBaseFontSize, fontWeight: 700 }),
      lineHeightPx: titleBaseFontSize * 1.5,
      leadingGapPx: titleBaseFontSize * 0.5,
      trailingGapPx: titleBaseFontSize * 1.5,
      firstLineIndentPx: 0,
      textAlign: 'left',
      letterSpacingPx: typography.letterSpacing,
      charOffsetInContent: -1,
      paragraphIndex: -1,
    });
  }

  const paragraphs = splitParagraphs(content);
  let searchFrom = 0;
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    const pos = content.indexOf(paragraph, searchFrom);
    const charOffset = pos >= 0 ? pos : searchFrom;
    blocks.push({
      kind: 'paragraph',
      text: paragraph,
      font: buildCanvasFont(typography),
      lineHeightPx: typography.fontSize * typography.lineHeight,
      leadingGapPx: 0,
      trailingGapPx: Math.max(0, typography.paragraphSpacing),
      firstLineIndentPx: Math.max(0, typography.textIndent * typography.fontSize),
      textAlign: typography.textAlign,
      letterSpacingPx: typography.letterSpacing,
      charOffsetInContent: charOffset,
      paragraphIndex: i,
    });
    searchFrom = charOffset + paragraph.length;
  }

  return blocks;
}

/**
 * 行首禁则：这些字符不应出现在行的开头。
 * 同时涵盖 `……` 和 `——` 分拆保护：
 * 当第二个 `…`/`—` 落在行首时，会被吸回上一行，保持双符号同行。
 */
const LINE_START_PROHIBITED = new Set<string>([
  '，',
  '。',
  '！',
  '？',
  '；',
  '：',
  '、',
  '）',
  '〕',
  '】',
  '〉',
  '》',
  '」',
  '』',
  '〗',
  '〙',
  '\u201D' /* " */,
  '\u2019' /* ' */,
  '…',
  '—',
  '·',
  ')',
  ']',
  '}',
]);

/**
 * 行尾禁则：这些字符不应出现在行的结尾。
 */
const LINE_END_PROHIBITED = new Set<string>([
  '（',
  '〔',
  '【',
  '〈',
  '《',
  '「',
  '『',
  '〘',
  '\u201C' /* " */,
  '\u2018' /* ' */,
  '(',
  '[',
  '{',
]);

/**
 * 对已排好的行列表应用中文禁则（行首/行尾禁则）。
 *
 * - Pull（吸入）：下一行行首为行首禁则字符 → 将其拼入当前行末尾（允许轻微视觉溢出）。
 * - Push（推出）：当前行末尾为行尾禁则字符 → 将其移到下一行行首。
 * - 多轮迭代处理级联禁则（如 `"）` 需要两轮才能同时修正）。
 * - 因调整导致的空行会被过滤，并修复 isTerminal / justify 标志。
 */
function applyKinsoku(
  lines: PaginationResolvedLine[],
  textAlign: ReaderTypography['textAlign'],
): PaginationResolvedLine[] {
  if (lines.length <= 1) {
    return lines;
  }

  const result = lines.map((line) => ({ ...line }));

  // 最多 4 轮，处理级联禁则场景（如同时出现 `……）`）
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;

    for (let i = 0; i < result.length - 1; i++) {
      const curr = result[i];
      const next = result[i + 1];

      // Pull：下一行行首是行首禁则字符 → 吸入当前行末（`……`/`——` 分拆同样由此修复）
      if (next.text.length > 0 && LINE_START_PROHIBITED.has(next.text[0])) {
        curr.text += next.text[0];
        next.text = next.text.slice(1);
        changed = true;
      }

      // Push：当前行末是行尾禁则字符 → 推入下一行行首
      if (curr.text.length > 0 && LINE_END_PROHIBITED.has(curr.text[curr.text.length - 1])) {
        const lastChar = curr.text[curr.text.length - 1];
        curr.text = curr.text.slice(0, -1);
        next.text = lastChar + next.text;
        changed = true;
      }
    }

    if (!changed) {
      break;
    }
  }

  // 过滤因禁则调整产生的空行（单字符行被整体吸走时会出现）
  const filtered = result.filter((line) => line.text.length > 0);
  if (filtered.length === 0) {
    return lines;
  }

  // 修复 isTerminal / justify / textAlign 标志
  const isJustify = textAlign === 'justify';
  for (let i = 0; i < filtered.length; i++) {
    const isLast = i === filtered.length - 1;
    filtered[i].isTerminal = isLast;
    filtered[i].justify = isJustify && !isLast;
    if (isJustify) {
      filtered[i].textAlign = isLast ? 'left' : 'justify';
    }
  }

  return filtered;
}

// ─── DOM 排版引擎 ──────────────────────────────────────────────────────────

/**
 * 在容器内创建不可见的测量层。
 * 返回该层 DOM 元素，调用方负责在使用完毕后 remove()。
 */
function createMeasureLayer(container: HTMLElement): HTMLDivElement {
  const layer = document.createElement('div');
  layer.style.position = 'absolute';
  layer.style.top = '0';
  layer.style.left = '0';
  layer.style.visibility = 'hidden';
  layer.style.pointerEvents = 'none';
  layer.style.overflow = 'hidden';
  layer.style.zIndex = '-9999';
  container.appendChild(layer);
  return layer;
}

/**
 * 通过 Range.getClientRects() 检测文本元素中每行的起始字符偏移。
 *
 * 返回 [{ charOffset, top }] 列表。charOffset 为该行在段落文本中的偏移。
 */
function extractLineOffsetsFromTextNode(
  textNode: Text,
  text: string,
): { charOffset: number; top: number }[] {
  if (text.length === 0) {
    return [];
  }

  const range = document.createRange();
  const lineOffsets: { charOffset: number; top: number }[] = [];
  let lastTop = -Infinity;

  for (let i = 0; i < text.length; i++) {
    range.setStart(textNode, i);
    range.setEnd(textNode, i + 1);
    const rects = range.getClientRects();
    if (rects.length === 0) {
      continue;
    }
    const top = rects[0].top;
    if (top > lastTop + 0.5) {
      lineOffsets.push({ charOffset: i, top });
      lastTop = top;
    }
  }

  return lineOffsets;
}

/**
 * 用 DOM 测量对单个 block 进行行拆分，返回 PaginationResolvedBlock。
 */
function resolveBlockDOM(
  block: PaginationBlockInput,
  measureLayer: HTMLDivElement,
  availW: number,
  typography: ReaderTypography,
): PaginationResolvedBlock {
  if (!block.text) {
    return {
      kind: block.kind,
      lines: [],
      leadingGapPx: block.leadingGapPx,
      trailingGapPx: block.trailingGapPx,
    };
  }

  const isTitle = block.kind === 'title';
  const titleBaseFontSize = typography.fontSize + 4;

  const div = document.createElement('div');
  div.style.width = availW + 'px';
  div.style.boxSizing = 'border-box';
  div.style.whiteSpace = 'normal';
  div.style.wordBreak = 'break-all';
  div.style.overflowWrap = 'break-word';
  div.style.margin = '0';
  div.style.padding = '0';
  div.style.border = 'none';

  if (isTitle) {
    applyTypographyToEl(div, typography, { fontSize: titleBaseFontSize, fontWeight: 700 });
    div.style.textAlign = 'left';
    div.style.textIndent = '0';
  } else {
    applyTypographyToEl(div, typography);
    div.style.textAlign = block.textAlign;
    if (block.firstLineIndentPx > 0) {
      div.style.textIndent = block.firstLineIndentPx + 'px';
    }
  }

  div.textContent = block.text;
  measureLayer.appendChild(div);

  const textNode = div.firstChild as Text | null;
  let lineOffsets: { charOffset: number; top: number }[] = [];
  let lineHeightPx = block.lineHeightPx;

  if (textNode && textNode.nodeType === Node.TEXT_NODE) {
    lineOffsets = extractLineOffsetsFromTextNode(textNode, block.text);
    if (lineOffsets.length > 0) {
      const totalH = div.getBoundingClientRect().height;
      if (totalH > 0) {
        lineHeightPx = totalH / lineOffsets.length;
      }
    }
  }

  div.remove();

  if (!Number.isFinite(lineHeightPx) || lineHeightPx <= 0) {
    lineHeightPx = block.lineHeightPx;
  }

  const resultLines: PaginationResolvedLine[] = [];

  if (lineOffsets.length === 0) {
    resultLines.push({
      text: block.text,
      indentPx: block.firstLineIndentPx,
      lineHeightPx,
      textAlign: block.textAlign === 'justify' ? 'left' : block.textAlign,
      justify: false,
      isTerminal: true,
      charOffsetInBlock: 0,
    });
  } else {
    const isJustify = block.textAlign === 'justify';
    for (let i = 0; i < lineOffsets.length; i++) {
      const start = lineOffsets[i].charOffset;
      const end = i + 1 < lineOffsets.length ? lineOffsets[i + 1].charOffset : block.text.length;
      const lineText = block.text.slice(start, end);
      const isTerminal = i === lineOffsets.length - 1;
      const indentPx = i === 0 ? block.firstLineIndentPx : 0;

      resultLines.push({
        text: lineText,
        indentPx,
        lineHeightPx,
        textAlign: isJustify ? (isTerminal ? 'left' : 'justify') : block.textAlign,
        justify: isJustify && !isTerminal,
        isTerminal,
        charOffsetInBlock: start,
      });
    }
  }

  return {
    kind: block.kind,
    lines: applyKinsoku(resultLines, block.textAlign),
    leadingGapPx: block.leadingGapPx,
    trailingGapPx: block.trailingGapPx,
  };
}

// ─── Pretext 排版引擎 ──────────────────────────────────────────────────────

function resolveBlockPretext(block: PaginationBlockInput, availW: number): PaginationResolvedBlock {
  const lines: PaginationResolvedLine[] = [];
  if (!block.text) {
    return {
      kind: block.kind,
      lines,
      leadingGapPx: block.leadingGapPx,
      trailingGapPx: block.trailingGapPx,
    };
  }

  const prepared = prepareWithSegments(protectStickyPunct(block.text), block.font, {
    wordBreak: 'keep-all',
    letterSpacing: block.letterSpacingPx > 0 ? block.letterSpacingPx : undefined,
  });
  const firstLineIndentPx = Math.min(block.firstLineIndentPx, Math.max(0, availW - 1));
  let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 };
  let isFirstLine = true;
  let charConsumed = 0;

  while (true) {
    const indentPx = isFirstLine ? firstLineIndentPx : 0;
    const lineWidth = Math.max(1, availW - indentPx);
    const line = layoutNextLine(prepared, cursor, lineWidth);
    if (line === null) {
      break;
    }

    lines.push({
      text: line.text,
      indentPx,
      lineHeightPx: block.lineHeightPx,
      textAlign: block.textAlign === 'justify' ? 'left' : block.textAlign,
      justify: false,
      isTerminal: false,
      charOffsetInBlock: charConsumed,
    });
    charConsumed += line.text.replace(/\u2060/g, '').length;
    cursor = line.end;
    isFirstLine = false;
  }

  for (let index = 0; index < lines.length; index++) {
    const isTerminal = index === lines.length - 1;
    lines[index].isTerminal = isTerminal;
    lines[index].justify = block.textAlign === 'justify' && !isTerminal;
    if (block.textAlign === 'justify' && !isTerminal) {
      lines[index].textAlign = 'justify';
    }
  }

  return {
    kind: block.kind,
    lines: applyKinsoku(lines, block.textAlign),
    leadingGapPx: block.leadingGapPx,
    trailingGapPx: block.trailingGapPx,
  };
}

export function usePagination() {
  const pages = ref<string[]>([]);
  const currentPage = ref(0);
  const totalPages = ref(0);
  const isPaginating = ref(false);
  /** 每页的元数据（与 pages 一一对应），用于锚点定位 */
  const pageMetas = ref<PageMeta[]>([]);

  /** 每次 paginate 调用递增，旧后台任务据此终止 */
  let cancelToken = 0;

  /**
   * 从锚点查找最匹配的页面索引。
   * 多级回退：charOffset → paragraphIndex+offset → ratio → 0
   */
  function findPageByAnchor(anchor: ReadingAnchor, metas: PageMeta[], total: number): number {
    if (total <= 0) {
      return 0;
    }
    if (total === 1) {
      return 0;
    }

    // 1. 精确字符偏移匹配：找到 charOffset <= anchor.charOffset 的最后一页
    if (anchor.charOffset >= 0) {
      let best = 0;
      for (let i = 0; i < metas.length; i++) {
        if (metas[i].charOffset <= anchor.charOffset) {
          best = i;
        } else {
          break;
        }
      }
      return Math.min(best, total - 1);
    }

    // 2. 段落级匹配
    if (anchor.paragraphIndex >= 0) {
      let best = 0;
      for (let i = 0; i < metas.length; i++) {
        const m = metas[i];
        if (
          m.paragraphIndex < anchor.paragraphIndex ||
          (m.paragraphIndex === anchor.paragraphIndex &&
            m.paragraphCharOffset <= anchor.paragraphCharOffset)
        ) {
          best = i;
        } else if (m.paragraphIndex > anchor.paragraphIndex) {
          break;
        }
      }
      return Math.min(best, total - 1);
    }

    // 3. 比例回退
    if (anchor.ratio >= 0) {
      return Math.min(Math.round(anchor.ratio * (total - 1)), total - 1);
    }

    return 0;
  }

  /**
   * 为指定页面构建锚点。
   */
  function buildAnchorForPage(pageIndex: number): ReadingAnchor {
    const metas = pageMetas.value;
    const total = totalPages.value;
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

  async function paginate(
    content: string,
    container: HTMLElement,
    typography: ReaderTypography,
    padding: number | ReaderPagePadding,
    initialPage: 'first' | 'last' = 'first',
    prefixHtml = '',
    /** 用于恢复阅读位置的锚点，优先于 initialPage */
    anchor?: ReadingAnchor,
    /**
     * 排版引擎选择：
     * - 'pretext' Canvas + Pretext 精确排版（默认），支持 letterSpacing/wordBreak/CJK 优化
     * - 'dom'     真实 DOM 渲染测量，天然支持系统缩放，兼容性最佳，部分旧版 Android 可能更准
     * 旧值 'auto'/'simple' 向后兼容，均视为 'pretext'
     */
    paginationEngine: PaginationEngine = 'pretext',
  ) {
    const myToken = ++cancelToken;
    isPaginating.value = true;

    await nextTick();

    const cW = container.clientWidth;
    const cH = container.clientHeight;
    if (cW <= 0 || cH <= 0) {
      isPaginating.value = false;
      return;
    }

    const resolvedPadding = normalizePadding(padding);
    const availW = cW - resolvedPadding.left - resolvedPadding.right;
    const availH = cH - resolvedPadding.top - resolvedPadding.bottom;
    if (availW <= 0 || availH <= 0) {
      pages.value = [wrapRawPageHtml('')];
      totalPages.value = 1;
      currentPage.value = 0;
      isPaginating.value = false;
      return;
    }

    // 向后兼容旧存储值 'auto'/'simple'，默认为 'pretext'
    const effectiveEngine: 'dom' | 'pretext' = paginationEngine === 'dom' ? 'dom' : 'pretext';

    const blocks = resolveHorizontalBlocks(content, prefixHtml, typography);

    // DOM 引擎：创建复用的测量层，所有 block 共享，最后统一清理
    let measureLayer: HTMLDivElement | null = null;
    if (effectiveEngine === 'dom') {
      measureLayer = createMeasureLayer(container);
    }
    if (blocks.length === 0) {
      pages.value = [wrapRawPageHtml('')];
      pageMetas.value = [{ charOffset: 0, paragraphIndex: 0, paragraphCharOffset: 0 }];
      totalPages.value = 1;
      currentPage.value = 0;
      isPaginating.value = false;
      return;
    }

    const builtPages: string[] = [];
    const builtMetas: PageMeta[] = [];
    let page = createPageState();
    /** 当前页首个可见内容行对应的 block 信息（用于生成 PageMeta） */
    let pageFirstBlockInfo: {
      charOffsetInContent: number;
      paragraphIndex: number;
      charOffsetInBlock: number;
    } | null = null;
    let publishedCount = 0;
    const useAnchor = anchor !== undefined;
    const deferForLast = !useAnchor && initialPage === 'last';
    let firstVisiblePublished = false;

    // ── 锚点强制断页 ──────────────────────────────────────────────
    // 当 anchor 提供了有效 charOffset 时，在分页过程中到达该偏移的行时
    // 强制插入一次断页，使锚点所在行成为新页的首行，保证首字不变。
    const anchorBreakOffset = useAnchor && anchor.charOffset > 0 ? anchor.charOffset : -1;
    let anchorBreakDone = false;
    /** 锚点断页后产生的页面索引（用于最终 currentPage 定位） */
    let anchorPageIndex = -1;

    const publishPendingPages = (force = false) => {
      if ((deferForLast && !force) || builtPages.length === 0) {
        return;
      }

      if (!firstVisiblePublished) {
        pages.value = builtPages.slice();
        pageMetas.value = builtMetas.slice();
        totalPages.value = pages.value.length;
        if (useAnchor) {
          // 锚点断页完成时直接用记录的索引，否则用搜索兜底
          currentPage.value =
            anchorPageIndex >= 0
              ? anchorPageIndex
              : findPageByAnchor(anchor, builtMetas, builtPages.length);
        } else {
          currentPage.value = 0;
        }
        isPaginating.value = false;
        publishedCount = pages.value.length;
        firstVisiblePublished = true;
        return;
      }

      if (publishedCount < builtPages.length) {
        pages.value.push(...builtPages.slice(publishedCount));
        pageMetas.value.push(...builtMetas.slice(publishedCount));
        totalPages.value = pages.value.length;
        if (useAnchor && anchorPageIndex >= 0) {
          currentPage.value = anchorPageIndex;
        }
        publishedCount = pages.value.length;
      }
    };

    const finalizePage = () => {
      if (!page.hasVisibleContent && page.items.length === 0) {
        return;
      }
      builtPages.push(renderManualPage(page.items));
      // 记录本页的元数据
      if (pageFirstBlockInfo) {
        const charOffset =
          pageFirstBlockInfo.charOffsetInContent >= 0
            ? pageFirstBlockInfo.charOffsetInContent + pageFirstBlockInfo.charOffsetInBlock
            : -1;
        builtMetas.push({
          charOffset,
          paragraphIndex: pageFirstBlockInfo.paragraphIndex,
          paragraphCharOffset: pageFirstBlockInfo.charOffsetInBlock,
        });
      } else {
        // title-only 页或空页
        builtMetas.push({ charOffset: 0, paragraphIndex: -1, paragraphCharOffset: 0 });
      }
      page = createPageState();
      pageFirstBlockInfo = null;
    };

    for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
      const inputBlock = blocks[blockIndex];
      const block =
        effectiveEngine === 'dom'
          ? resolveBlockDOM(inputBlock, measureLayer!, availW, typography)
          : resolveBlockPretext(inputBlock, availW);
      if (block.lines.length === 0) {
        continue;
      }

      if (block.leadingGapPx > 0) {
        if (page.hasVisibleContent && page.usedPx + block.leadingGapPx > availH) {
          finalizePage();
          publishPendingPages();
        }
        pushGapItem(page, block.leadingGapPx);
        page.usedPx += block.leadingGapPx;
      }

      let fragmentLines: PaginationResolvedLine[] = [];
      const flushFragment = () => {
        if (fragmentLines.length === 0) {
          return;
        }
        pushBlockItem(page, block.kind, fragmentLines);
        fragmentLines = [];
      };

      for (const line of block.lines) {
        // ── 锚点强制断页：到达锚点字符偏移时立即断页 ──
        // 保证锚点所在行成为新页首行，维持"首字不变"。
        if (!anchorBreakDone && anchorBreakOffset > 0 && inputBlock.charOffsetInContent >= 0) {
          const lineGlobalOffset = inputBlock.charOffsetInContent + line.charOffsetInBlock;
          if (lineGlobalOffset >= anchorBreakOffset && page.hasVisibleContent) {
            flushFragment();
            finalizePage();
            publishPendingPages();
            anchorBreakDone = true;
            anchorPageIndex = builtPages.length; // 下一页（即将创建的页）的索引
          }
        }

        const fitsCurrentPage = page.usedPx + line.lineHeightPx <= availH + 0.01;
        if (!fitsCurrentPage && page.hasVisibleContent) {
          flushFragment();
          finalizePage();
          publishPendingPages();
        }

        // 记录当前页的首个可见内容行信息
        if (!pageFirstBlockInfo && !page.hasVisibleContent) {
          pageFirstBlockInfo = {
            charOffsetInContent: inputBlock.charOffsetInContent,
            paragraphIndex: inputBlock.paragraphIndex,
            charOffsetInBlock: line.charOffsetInBlock,
          };
        }

        fragmentLines.push(line);
        page.usedPx += line.lineHeightPx;
        page.hasVisibleContent = true;
      }

      flushFragment();

      const hasNextBlock = blockIndex < blocks.length - 1;
      if (hasNextBlock && block.trailingGapPx > 0) {
        if (page.usedPx + block.trailingGapPx <= availH + 0.01) {
          pushGapItem(page, block.trailingGapPx);
          page.usedPx += block.trailingGapPx;
        } else {
          finalizePage();
          publishPendingPages();
        }
      }

      if ((blockIndex + 1) % 8 === 0) {
        await yieldToMain();
        if (myToken !== cancelToken) {
          measureLayer?.remove();
          return;
        }
        publishPendingPages();
      }
    }

    finalizePage();
    measureLayer?.remove();
    if (myToken !== cancelToken) {
      return;
    }

    if (builtPages.length === 0) {
      builtPages.push(wrapRawPageHtml(''));
      builtMetas.push({ charOffset: 0, paragraphIndex: 0, paragraphCharOffset: 0 });
    }

    if (!firstVisiblePublished || deferForLast) {
      pages.value = builtPages;
      pageMetas.value = builtMetas;
      totalPages.value = builtPages.length;
      if (useAnchor) {
        currentPage.value =
          anchorPageIndex >= 0
            ? Math.min(anchorPageIndex, totalPages.value - 1)
            : findPageByAnchor(anchor, builtMetas, builtPages.length);
      } else {
        currentPage.value = initialPage === 'last' ? Math.max(0, totalPages.value - 1) : 0;
      }
      isPaginating.value = false;
      return;
    }

    publishPendingPages(true);
    // 最终定位：锚点断页完成时直接定位，否则搜索兜底
    if (useAnchor) {
      currentPage.value =
        anchorPageIndex >= 0
          ? Math.min(anchorPageIndex, pages.value.length - 1)
          : findPageByAnchor(anchor, pageMetas.value, pages.value.length);
    }
    totalPages.value = pages.value.length;
    isPaginating.value = false;
    return;
  }

  function goToPage(page: number) {
    if (page >= 0 && page < totalPages.value) {
      currentPage.value = page;
    }
  }

  function nextPage(): boolean {
    if (currentPage.value < totalPages.value - 1) {
      currentPage.value++;
      return true;
    }
    return false;
  }

  function prevPage(): boolean {
    if (currentPage.value > 0) {
      currentPage.value--;
      return true;
    }
    return false;
  }

  function goToStart() {
    currentPage.value = 0;
  }

  function goToEnd() {
    currentPage.value = Math.max(0, totalPages.value - 1);
  }

  return {
    pages,
    currentPage,
    totalPages,
    isPaginating,
    pageMetas,
    paginate,
    goToPage,
    nextPage,
    prevPage,
    goToStart,
    goToEnd,
    buildAnchorForPage,
    findPageByAnchor,
  };
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
