/**
 * 本地 TXT 分章节引擎
 *
 * 内置常见网文章节规则，支持插件注册自定义规则。
 * 分章节结果上限为 MAX_CHAPTERS，防止错误正则炸出海量空章节。
 */

export const MAX_CHAPTERS = 10_000;

// ── 类型定义 ─────────────────────────────────────────────────────────────

export interface SplitChapter {
  /** 章节标题（分隔行本身） */
  title: string;
  /** 章节正文（不含标题行） */
  content: string;
}

export interface SplitResult {
  chapters: SplitChapter[];
  /** 是否触发了章节数上限截断 */
  truncated: boolean;
  /** 前言/序（第一章之前的内容），可能为空 */
  preface: string;
}

/**
 * 分章节规则描述
 * - `test(line)` 判断某一行是否是章节标题
 */
export interface ChapterRule {
  /** 规则唯一标识 */
  id: string;
  /** 展示名称 */
  name: string;
  /** 规则描述 */
  description: string;
  /**
   * 判断某行是否为章节标题。
   * 传入已 trim 的行文本，返回 true 表示该行是章节开始行。
   */
  test: (line: string) => boolean;
  /**
   * 是否为插件规则（运行时注册，非内置）
   * @default false
   */
  isPlugin?: boolean;
}

// ── 内置规则 ─────────────────────────────────────────────────────────────

/**
 * 中文"第X章/节/回/幕/话/卷/部/篇"写法
 * 支持汉字数字（一二三…百千万）、阿拉伯数字、以及混合。
 * 例如：第一章 第12章 第一百零三章 第001回 序章 楔子 尾声 番外
 */
const CN_CHAPTER_RE =
  /^(第[零一二三四五六七八九十百千万亿0-9]+[章节回幕话卷部篇集]|序章|楔子|尾声|后记|番外[一二三四五六七八九十0-9]*|前言|正文)\s*/;

/**
 * 英文 Chapter / Part / Volume + 数字
 */
const EN_CHAPTER_RE = /^(chapter|part|volume|act|scene)\s*[0-9]+/i;

/**
 * 全数字编号行：1. 01. 001. 1、 01、 1） 1) 等
 * 行长度不超过 60 字符，防止把正文数字误识别为章节
 */
const NUM_HEADING_RE = /^([0-9]+[.、)）]\s*.{0,50})$/;

/**
 * 装饰性分隔线：=== --- *** ─── ~~~（至少 3 个相同字符）
 */
const DIVIDER_RE = /^([=\-*─~─━]{3,})\s*$/;

/**
 * 行首全角空格 + 章节样式关键字
 */
const FULLWIDTH_CHAPTER_RE =
  /^[\u3000\s]{0,4}第[零一二三四五六七八九十百千万亿0-9]+[章节回幕话卷部篇集]/;

export const BUILTIN_RULES: ChapterRule[] = [
  {
    id: 'cn-chapter',
    name: '标准中文章节',
    description: '匹配"第X章/节/回/话/卷"等写法，及序章、楔子、尾声、番外等特殊章节',
    test: (line) => CN_CHAPTER_RE.test(line) || FULLWIDTH_CHAPTER_RE.test(line),
  },
  {
    id: 'cn-chapter-loose',
    name: '宽松中文章节',
    description: '在标准规则基础上，额外匹配行首章节关键字开头的短行（≤60字）',
    test: (line) => {
      if (CN_CHAPTER_RE.test(line) || FULLWIDTH_CHAPTER_RE.test(line)) return true;
      // 额外：以"章"/"节"/"卷"/"回"/"话"字结尾的短行（标题感强）
      return line.length <= 60 && /^[第上下][零一二三四五六七八九十百千万亿0-9]+/.test(line);
    },
  },
  {
    id: 'en-chapter',
    name: '英文 Chapter/Part',
    description: '匹配 "Chapter 1"、"Part 2"、"Volume 3" 等英文章节格式',
    test: (line) => EN_CHAPTER_RE.test(line),
  },
  {
    id: 'numbered',
    name: '数字编号行',
    description: '匹配 "1." "01." "1、" "1）" 等数字编号短行（≤60字）',
    test: (line) => NUM_HEADING_RE.test(line),
  },
  {
    id: 'divider',
    name: '装饰分隔线',
    description: '匹配 "===" "---" "***" "───" 等分隔线（至少3个相同字符）',
    test: (line) => DIVIDER_RE.test(line),
  },
  {
    id: 'cn-chapter-or-divider',
    name: '中文章节 + 分隔线（推荐）',
    description: '同时识别中文章节标题和装饰分隔线，适合大多数网文',
    test: (line) =>
      CN_CHAPTER_RE.test(line) ||
      FULLWIDTH_CHAPTER_RE.test(line) ||
      DIVIDER_RE.test(line),
  },
];

// ── 插件注册 ─────────────────────────────────────────────────────────────

const pluginRules: ChapterRule[] = [];

/**
 * 注册自定义分章节规则（插件扩展点）。
 * 插件可在初始化时调用此函数注入自定义规则，注入后对话框中会展示插件规则选项。
 */
export function registerChapterRule(rule: ChapterRule): void {
  if (pluginRules.some((r) => r.id === rule.id)) {
    // 同 id 覆盖更新
    const idx = pluginRules.findIndex((r) => r.id === rule.id);
    pluginRules.splice(idx, 1, { ...rule, isPlugin: true });
  } else {
    pluginRules.push({ ...rule, isPlugin: true });
  }
}

/**
 * 注销插件规则
 */
export function unregisterChapterRule(id: string): void {
  const idx = pluginRules.findIndex((r) => r.id === id);
  if (idx !== -1) pluginRules.splice(idx, 1);
}

/**
 * 获取所有可用规则（内置 + 插件）
 */
export function getAllRules(): ChapterRule[] {
  return [...BUILTIN_RULES, ...pluginRules];
}

// ── 核心分割逻辑 ─────────────────────────────────────────────────────────

/**
 * 按指定规则将 TXT 内容分割为章节列表。
 *
 * @param text     文件全文（字符串）
 * @param rule     所用分章节规则
 * @returns        分章节结果
 */
export function splitChapters(text: string, rule: ChapterRule): SplitResult {
  const lines = text.split(/\r?\n/);

  let preface = '';
  const chapters: SplitChapter[] = [];
  let truncated = false;

  let currentTitle = '';
  let currentLines: string[] = [];
  let started = false;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (trimmed && rule.test(trimmed)) {
      if (!started) {
        // 第一章之前的内容作为前言
        preface = currentLines.join('\n').trim();
        started = true;
      } else {
        // 保存上一章
        if (chapters.length >= MAX_CHAPTERS) {
          truncated = true;
          break;
        }
        chapters.push({
          title: currentTitle,
          content: currentLines.join('\n').trimStart(),
        });
      }
      currentTitle = trimmed;
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  // 保存最后一章（或全文为无章节结构）
  if (started && currentTitle) {
    if (!truncated || chapters.length < MAX_CHAPTERS) {
      chapters.push({
        title: currentTitle,
        content: currentLines.join('\n').trimStart(),
      });
    }
  }

  // 若全文没匹配到任何章节，将整本书作为单章节返回
  if (chapters.length === 0) {
    return {
      chapters: [{ title: '正文', content: text.trim() }],
      truncated: false,
      preface: '',
    };
  }

  return { chapters, truncated, preface };
}

/**
 * 检测所有规则，返回每个规则的预估章节数（用于 UI 选择提示）
 */
export function previewAllRules(
  text: string,
  rules?: ChapterRule[],
): Array<{ rule: ChapterRule; count: number; firstChapters: string[] }> {
  const target = rules ?? getAllRules();
  return target.map((rule) => {
    const result = splitChapters(text, rule);
    return {
      rule,
      count: result.chapters.length,
      firstChapters: result.chapters.slice(0, 5).map((c) => c.title),
    };
  });
}
