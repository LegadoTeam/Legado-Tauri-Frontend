/**
 * 阅读器组件 — 公共类型定义
 * 完全独立于 Tauri，可在任何 Vue3 项目中使用
 */
import type { CoverImageInput } from '@/utils/coverImage';

/* ============================================================
   书籍元数据（传入阅读器供目录/详情面板显示）
   ============================================================ */
export interface ReaderBookInfo {
  name: string;
  author: string;
  coverUrl?: CoverImageInput;
  intro?: string;
  kind?: string;
  bookUrl?: string;
  sourceName?: string;
  fileName?: string;
  lastChapter?: string;
  latestChapter?: string;
  latestChapterUrl?: string;
  wordCount?: string;
  chapterCount?: number;
  updateTime?: string;
  status?: string;
  totalChapters?: number;
  addedAt?: number;
  lastReadAt?: number;
}

/* ============================================================
   翻页模式
   ============================================================ */
export type FlipMode = 'scroll' | 'slide' | 'simulation' | 'cover' | 'none';

/* ============================================================
   排版引擎
   ============================================================ */
/**
 * 文本分页排版引擎选择：
 * - `dom`     真实 DOM 渲染测量（默认），天然支持系统字体缩放，兼容性最佳
 * - `pretext` Canvas + Pretext 精确排版，部分旧版 Android WebView 可能字间距异常
 */
export type PaginationEngine = 'dom' | 'pretext';

export type ReaderTapAction = 'prev' | 'next';

/* ============================================================
   字体/排版设置
   ============================================================ */
export interface ReaderTypography {
  /** 字体族，逗号分隔，如 "Noto Serif SC, serif" */
  fontFamily: string;
  /** 字号 px */
  fontSize: number;
  /** 行高倍数 */
  lineHeight: number;
  /** 字间距 px */
  letterSpacing: number;
  /** 词间距 px */
  wordSpacing: number;
  /** 段落间距 px */
  paragraphSpacing: number;
  /** 首行缩进 em */
  textIndent: number;
  /** 字重 100-900 */
  fontWeight: number;
  /** 斜体 */
  fontStyle: 'normal' | 'italic' | 'oblique';
  /** 文字对齐 */
  textAlign: 'left' | 'center' | 'right' | 'justify';
  /** 文字装饰 */
  textDecoration: 'none' | 'underline' | 'line-through';
  /** 字体变体 */
  fontVariant: string;
  /** 文字描边宽度 px */
  textStrokeWidth: number;
  /** 文字描边颜色 */
  textStrokeColor: string;
  /** 文字阴影 CSS 值 */
  textShadow: string;
}

/* ============================================================
   主题 / 颜色
   ============================================================ */
export interface ReaderTheme {
  /** 主题名称 */
  name: string;
  /** 背景色 */
  backgroundColor: string;
  /** 文字颜色 */
  textColor: string;
  /** 选中文字背景色 */
  selectionColor: string;
}

/* ============================================================
    页边距
    ============================================================ */
export interface ReaderPagePadding {
  /** 上边距 px */
  top: number;
  /** 右边距 px */
  right: number;
  /** 下边距 px */
  bottom: number;
  /** 左边距 px */
  left: number;
}

/* ============================================================
   整体阅读器设置
   ============================================================ */
export interface ReaderSettings {
  /** 翻页模式 */
  flipMode: FlipMode;
  /** 排版引擎 */
  paginationEngine: PaginationEngine;
  /** 排版 */
  typography: ReaderTypography;
  /** 主题 */
  theme: ReaderTheme;
  /** 选中的主题方案 ID；空字符串表示使用内置主题 */
  themePresetId: string;
  /** 旧版统一边距，保留用于兼容旧设置 */
  padding: number;
  /** 内容区四边页边距 px */
  pagePadding: ReaderPagePadding;
  /** 页面间距（仅滚动模式有效）px */
  pageGap: number;
  /** 亮度 0-100 */
  brightness: number;
  /** 布局调试叠层 */
  layoutDebugMode: boolean;
  /** 翻页动画时长 ms */
  animationDuration: number;
  /** 屏幕常亮 */
  keepScreenOn: boolean;
  /** 滑动翻页灵敏度 px */
  swipeThreshold: number;
  /** 背景纹理 CSS background-image 值，空字符串表示纯色 */
  backgroundImage: string;
  /** 选中的背景方案 ID；空字符串表示使用内置背景纹理 */
  backgroundPresetId: string;
  /** 选中的阅读器皮肤 ID；空字符串表示使用默认阅读器布局 */
  skinPresetId: string;
  /**
   * 阅读器无菜单/设置状态下按返回键的行为
   * - 'bookshelf'：关闭阅读器停留在书架（默认）
   * - 'desktop'：最小化应用回到手机桌面
   */
  backBehavior: 'bookshelf' | 'desktop';
  /** 移动端打开菜单时隐藏顶部栏 */
  hideTopBarOnMobile: boolean;
  /** 阅读时使用音量键翻页；默认关闭，避免抢占系统音量 */
  volumeKeyPageTurnEnabled: boolean;
  /** 点击区域左分界线（0-1 比例），小于此值为左侧点击区 */
  tapZoneLeft: number;
  /** 点击区域右分界线（0-1 比例），大于此值为右侧点击区 */
  tapZoneRight: number;
  /** 分页模式左侧点击动作 */
  tapLeftAction: ReaderTapAction;
  /** 分页模式右侧点击动作 */
  tapRightAction: ReaderTapAction;
}

/* ============================================================
   章节数据
   ============================================================ */
export interface ChapterData {
  /** 章节索引 */
  index: number;
  /** 章节标题 */
  title: string;
  /** 章节正文（纯文本或 HTML） */
  content: string;
}

/* ============================================================
   阅读进度
   ============================================================ */
export interface ReadingProgress {
  /** 章节索引 */
  chapterIndex: number;
  /** 当前页码（分页模式）或滚动比例（滚动模式 0-1） */
  position: number;
  /** 总页数（分页模式）/ 1（滚动模式） */
  totalPages: number;
}

/* ============================================================
   预设主题
   ============================================================ */
export const PRESET_THEMES: ReaderTheme[] = [
  { name: '默认白', backgroundColor: '#ffffff', textColor: '#1a1a1a', selectionColor: '#b3d4fc' },
  { name: '护眼绿', backgroundColor: '#cce8cf', textColor: '#2d4a22', selectionColor: '#a3c99e' },
  { name: '羊皮纸', backgroundColor: '#f5e6c8', textColor: '#5b4636', selectionColor: '#d4b896' },
  { name: '暮光蓝', backgroundColor: '#1e293b', textColor: '#cbd5e1', selectionColor: '#475569' },
  { name: '纯黑夜', backgroundColor: '#0a0a0a', textColor: '#d4d4d4', selectionColor: '#404040' },
  { name: '柔粉色', backgroundColor: '#fde8e8', textColor: '#6b2c2c', selectionColor: '#f5b7b1' },
];

/* ============================================================
   默认排版
   ============================================================ */
export const DEFAULT_TYPOGRAPHY: ReaderTypography = {
  fontFamily: '"Noto Serif SC", "Source Han Serif CN", "SimSun", serif',
  fontSize: 18,
  lineHeight: 1.8,
  letterSpacing: 0,
  wordSpacing: 0,
  paragraphSpacing: 12,
  textIndent: 2,
  fontWeight: 400,
  fontStyle: 'normal',
  textAlign: 'justify',
  textDecoration: 'none',
  fontVariant: 'normal',
  textStrokeWidth: 0,
  textStrokeColor: 'transparent',
  textShadow: 'none',
};

/* ============================================================
   默认设置
   ============================================================ */
export const DEFAULT_SETTINGS: ReaderSettings = {
  flipMode: 'slide',
  paginationEngine: 'dom',
  typography: { ...DEFAULT_TYPOGRAPHY },
  theme: { ...PRESET_THEMES[0] },
  themePresetId: '',
  padding: 24,
  pagePadding: {
    top: 24,
    right: 24,
    bottom: 24,
    left: 24,
  },
  pageGap: 0,
  brightness: 100,
  layoutDebugMode: false,
  animationDuration: 300,
  keepScreenOn: false,
  swipeThreshold: 50,
  backgroundImage: '',
  backgroundPresetId: '',
  skinPresetId: '',
  backBehavior: 'bookshelf',
  hideTopBarOnMobile: false,
  volumeKeyPageTurnEnabled: false,
  tapZoneLeft: 0.3,
  tapZoneRight: 0.7,
  tapLeftAction: 'prev',
  tapRightAction: 'next',
};

/* ============================================================
   换源相关（ChapterReaderModal 与 ReaderMenuLayer 共用）
   ============================================================ */

import type { ChapterItem, ShelfBook } from '@/stores';

export interface WholeBookSwitchedPayload {
  shelfBook: ShelfBook;
  chapters: ChapterItem[];
  matchedChapterIndex: number;
  matchedChapterUrl?: string;
  sourceSwitched: boolean;
}

export interface TemporaryChapterSourceOverride {
  chapterIndex: number;
  fileName: string;
  sourceName: string;
  sourceBookUrl: string;
  chapterUrl: string;
  chapterName: string;
  reason: string;
  score: number;
}
