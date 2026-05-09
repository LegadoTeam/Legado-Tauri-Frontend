import type {
  FlipMode,
  ReaderTapAction,
  ReaderTheme,
  ReaderTypography,
} from '@/components/reader/types';

export const THEME_ELEGANT_NAMES: Record<string, string> = {
  默认白: '霜白',
  护眼绿: '碧荫',
  羊皮纸: '书香',
  暮光蓝: '暮蓝',
  纯黑夜: '子夜',
  柔粉色: '桃粉',
};

export const FLIP_OPTIONS: { label: string; value: FlipMode }[] = [
  { label: '仿真', value: 'simulation' },
  { label: '覆盖', value: 'cover' },
  { label: '平移', value: 'slide' },
  { label: '上下', value: 'scroll' },
  { label: '无动画', value: 'none' },
];

export const COMIC_FLIP_OPTIONS: { label: string; value: FlipMode }[] = [
  { label: '上下', value: 'scroll' },
];

export const EXPERIMENTAL_FLIP_MODES: Set<FlipMode> = new Set(['simulation']);
export const EXPERIMENTAL_FLIP_MODE_HINT =
  '该模式仍在持续测试中，当前表现可能不够稳定，部分书籍或设备上可能出现翻页异常。';

export const TAP_ACTION_OPTIONS: { label: string; value: ReaderTapAction }[] = [
  { label: '上一页', value: 'prev' },
  { label: '下一页', value: 'next' },
];

export const FONT_PRESETS: { label: string; value: string }[] = [
  { label: '系统默认', value: 'system-ui, -apple-system, sans-serif' },
  { label: '衬线体', value: '"Noto Serif SC", "Source Han Serif CN", "SimSun", serif' },
  { label: '宋体', value: '"SimSun", "宋体", serif' },
  { label: '楷体', value: '"KaiTi", "楷体", serif' },
  { label: '黑体', value: '"SimHei", "黑体", sans-serif' },
  { label: '仿宋', value: '"FangSong", "仿宋", serif' },
  { label: 'serif', value: 'serif' },
];

export const FONT_WEIGHT_PRESETS = [
  { label: '细', value: 300 },
  { label: '正常', value: 400 },
  { label: '粗', value: 700 },
];

export const TEXT_ALIGN_OPTIONS: { label: string; value: ReaderTypography['textAlign'] }[] = [
  { label: '左', value: 'left' },
  { label: '居中', value: 'center' },
  { label: '右', value: 'right' },
  { label: '两端', value: 'justify' },
];

export const TEXT_SHADOW_PRESETS = [
  { label: '无', value: 'none' },
  { label: '轻描', value: '0 1px 3px rgba(0,0,0,0.35)' },
  { label: '浮雕', value: '1px 1px 0 rgba(0,0,0,0.45), -1px -1px 0 rgba(255,255,255,0.08)' },
  { label: '发光', value: '0 0 8px rgba(255,255,255,0.5)' },
];

export interface BuiltinBgPreset {
  id: string;
  name: string;
  value: string;
  thumb: string;
}

export const BG_PRESETS: BuiltinBgPreset[] = [
  { id: 'builtin:plain', name: '纯色', value: '', thumb: '' },
  {
    id: 'builtin:paper',
    name: '纸纹',
    value:
      'repeating-linear-gradient(0deg, transparent, transparent 28px, rgba(0,0,0,0.04) 28px, rgba(0,0,0,0.04) 29px)',
    thumb:
      'repeating-linear-gradient(0deg, transparent, transparent 6px, rgba(0,0,0,0.08) 6px, rgba(0,0,0,0.08) 7px)',
  },
  {
    id: 'builtin:kraft',
    name: '牛皮纸',
    value:
      'radial-gradient(ellipse at 20% 80%, rgba(180,140,100,0.12) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(180,140,100,0.08) 0%, transparent 50%)',
    thumb: 'radial-gradient(ellipse at 30% 70%, rgba(180,140,100,0.25) 0%, transparent 60%)',
  },
  {
    id: 'builtin:fabric',
    name: '织物',
    value:
      'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.02) 2px, rgba(0,0,0,0.02) 4px), repeating-linear-gradient(-45deg, transparent, transparent 2px, rgba(0,0,0,0.02) 2px, rgba(0,0,0,0.02) 4px)',
    thumb:
      'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px), repeating-linear-gradient(-45deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px)',
  },
  {
    id: 'builtin:stars',
    name: '星点',
    value:
      'radial-gradient(1px 1px at 10% 20%, rgba(255,255,255,0.12) 1px, transparent 0), radial-gradient(1px 1px at 40% 60%, rgba(255,255,255,0.09) 1px, transparent 0), radial-gradient(1px 1px at 70% 15%, rgba(255,255,255,0.1) 1px, transparent 0), radial-gradient(1px 1px at 90% 80%, rgba(255,255,255,0.08) 1px, transparent 0)',
    thumb:
      'radial-gradient(1px 1px at 25% 35%, rgba(255,255,255,0.3) 1px, transparent 0), radial-gradient(1px 1px at 65% 55%, rgba(255,255,255,0.2) 1px, transparent 0)',
  },
];

export interface ThemeOption {
  id: string;
  name: string;
  description?: string;
  source: 'builtin' | 'plugin';
  theme?: ReaderTheme;
  preview: {
    backgroundColor: string;
    textColor: string;
    selectionColor?: string;
  };
}
