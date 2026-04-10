/**
 * 阅读器组件 — 公共类型定义
 * 完全独立于 Tauri，可在任何 Vue3 项目中使用
 */

/* ============================================================
   书籍元数据（传入阅读器供目录/详情面板显示）
   ============================================================ */
export interface ReaderBookInfo {
  name: string
  author: string
  coverUrl?: string
  intro?: string
  kind?: string
  bookUrl?: string
  sourceName?: string
  fileName?: string
  lastChapter?: string
  totalChapters?: number
  addedAt?: number
  lastReadAt?: number
}

/* ============================================================
   翻页模式
   ============================================================ */
export type FlipMode = 'scroll' | 'slide' | 'simulation' | 'cover' | 'none'

/* ============================================================
   字体/排版设置
   ============================================================ */
export interface ReaderTypography {
  /** 字体族，逗号分隔，如 "Noto Serif SC, serif" */
  fontFamily: string
  /** 字号 px */
  fontSize: number
  /** 行高倍数 */
  lineHeight: number
  /** 字间距 px */
  letterSpacing: number
  /** 词间距 px */
  wordSpacing: number
  /** 段落间距 px */
  paragraphSpacing: number
  /** 首行缩进 em */
  textIndent: number
  /** 字重 100-900 */
  fontWeight: number
  /** 斜体 */
  fontStyle: 'normal' | 'italic' | 'oblique'
  /** 文字对齐 */
  textAlign: 'left' | 'center' | 'right' | 'justify'
  /** 文字装饰 */
  textDecoration: 'none' | 'underline' | 'line-through'
  /** 文字转换 */
  textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
  /** 字体变体 */
  fontVariant: string
  /** 书写模式 */
  writingMode: 'horizontal-tb' | 'vertical-rl' | 'vertical-lr'
  /** 文字描边宽度 px */
  textStrokeWidth: number
  /** 文字描边颜色 */
  textStrokeColor: string
  /** 文字阴影 CSS 值 */
  textShadow: string
}

/* ============================================================
   主题 / 颜色
   ============================================================ */
export interface ReaderTheme {
  /** 主题名称 */
  name: string
  /** 背景色 */
  backgroundColor: string
  /** 文字颜色 */
  textColor: string
  /** 选中文字背景色 */
  selectionColor: string
}

/* ============================================================
   整体阅读器设置
   ============================================================ */
export interface ReaderSettings {
  /** 翻页模式 */
  flipMode: FlipMode
  /** 排版 */
  typography: ReaderTypography
  /** 主题 */
  theme: ReaderTheme
  /** 内容区内边距 px */
  padding: number
  /** 页面间距（仅滚动模式有效）px */
  pageGap: number
  /** 亮度 0-100 */
  brightness: number
  /** 翻页动画时长 ms */
  animationDuration: number
  /** 屏幕常亮 */
  keepScreenOn: boolean
  /** 滑动翻页灵敏度 px */
  swipeThreshold: number
  /** 背景纹理 CSS background-image 值，空字符串表示纯色 */
  backgroundImage: string
  /**
   * 阅读器无菜单/设置状态下按返回键的行为
   * - 'bookshelf'：关闭阅读器停留在书架（默认）
   * - 'desktop'：最小化应用回到手机桌面
   */
  backBehavior: 'bookshelf' | 'desktop'
  /** 点击区域左分界线（0-1 比例），小于此值为「上一页」区 */
  tapZoneLeft: number
  /** 点击区域右分界线（0-1 比例），大于此值为「下一页」区 */
  tapZoneRight: number
}

/* ============================================================
   章节数据
   ============================================================ */
export interface ChapterData {
  /** 章节索引 */
  index: number
  /** 章节标题 */
  title: string
  /** 章节正文（纯文本或 HTML） */
  content: string
}

/* ============================================================
   阅读进度
   ============================================================ */
export interface ReadingProgress {
  /** 章节索引 */
  chapterIndex: number
  /** 当前页码（分页模式）或滚动比例（滚动模式 0-1） */
  position: number
  /** 总页数（分页模式）/ 1（滚动模式） */
  totalPages: number
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
]

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
  textTransform: 'none',
  fontVariant: 'normal',
  writingMode: 'horizontal-tb',
  textStrokeWidth: 0,
  textStrokeColor: 'transparent',
  textShadow: 'none',
}

/* ============================================================
   默认设置
   ============================================================ */
export const DEFAULT_SETTINGS: ReaderSettings = {
  flipMode: 'slide',
  typography: { ...DEFAULT_TYPOGRAPHY },
  theme: { ...PRESET_THEMES[0] },
  padding: 24,
  pageGap: 0,
  brightness: 100,
  animationDuration: 300,
  keepScreenOn: false,
  swipeThreshold: 50,
  backgroundImage: '',
  backBehavior: 'bookshelf',
  tapZoneLeft: 0.3,
  tapZoneRight: 0.7,
}
