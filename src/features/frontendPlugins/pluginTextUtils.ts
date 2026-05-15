import * as OpenCC from 'opencc-js';
import { toFileSrcSync } from '@/composables/useFileSrc';
import type { ChineseConvertMode, ReaderSessionAppearanceState } from './pluginTypes';

export function normalizeRelativePath(path: string): string[] {
  const segments = path
    .replace(/\\/g, '/')
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);
  const next: string[] = [];
  for (const segment of segments) {
    if (segment === '.') {
      continue;
    }
    if (segment === '..') {
      next.pop();
      continue;
    }
    next.push(segment);
  }
  return next;
}

export function resolveExtensionAssetUrl(
  extensionRootDir: string,
  fileName: string,
  relativePath: string,
): string {
  if (!extensionRootDir) {
    return relativePath;
  }
  const sep = extensionRootDir.includes('\\') ? '\\' : '/';
  const baseSegments = normalizeRelativePath(fileName).slice(0, -1);
  const relativeSegments = normalizeRelativePath(relativePath);
  const fullPath = [
    extensionRootDir.replace(/[\\/]+$/, ''),
    ...baseSegments,
    ...relativeSegments,
  ].join(sep);
  return toFileSrcSync(fullPath);
}

export function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

export function defaultAppearanceState(): ReaderSessionAppearanceState {
  return {
    theme: {
      name: '默认白',
      backgroundColor: '#ffffff',
      textColor: '#1a1a1a',
      selectionColor: '#b3d4fc',
    },
    themePresetId: '',
    backgroundImage: '',
    backgroundPresetId: '',
    skinPresetId: '',
    viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 0,
    viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
    devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
  };
}

const chineseConverterCache = new Map<ChineseConvertMode, (text: string) => string>();

export function getChineseConverter(mode: ChineseConvertMode): (text: string) => string {
  const cached = chineseConverterCache.get(mode);
  if (cached) {
    return cached;
  }
  const converter = (() => {
    switch (mode) {
      case 's2t':
        return OpenCC.Converter({ from: 'cn', to: 't' });
      case 's2tw':
        return OpenCC.Converter({ from: 'cn', to: 'tw' });
      case 's2hk':
        return OpenCC.Converter({ from: 'cn', to: 'hk' });
      case 't2s':
        return OpenCC.Converter({ from: 't', to: 'cn' });
      case 'tw2s':
        return OpenCC.Converter({ from: 'tw', to: 'cn' });
      case 'hk2s':
        return OpenCC.Converter({ from: 'hk', to: 'cn' });
      default:
        return (text: string) => text;
    }
  })();
  chineseConverterCache.set(mode, converter);
  return converter;
}
