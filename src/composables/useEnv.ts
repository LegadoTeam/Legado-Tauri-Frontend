/**
 * useEnv — 运行环境检测（单例，模块加载时初始化一次）
 *
 * 暴露的变量：
 *   isTauri    — 是否运行在 Tauri 原生壳中
 *   isMobile   — 是否为移动端（响应式 computed，受 layoutMode 影响）
 *   autoIsMobile — 自动检测结果（固定值，不受覆盖影响）
 *   platform   — 操作系统平台字符串（响应式，Tauri 环境下由 Rust 侧准确返回）
 *   envLabel   — 人类可读的环境标签（用于 UI 展示 / 调试）
 *   layoutMode — 当前布局模式 ref（"auto" | "mobile" | "desktop"）
 *   setLayoutMode — 设置布局模式覆盖
 *
 * 用法：
 *   import { isTauri, isMobile, envLabel, platform } from '@/composables/useEnv'
 */

import { ref, computed, type ComputedRef } from 'vue';

/** 是否运行在 Tauri 原生壳中 */
export const isTauri: boolean = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/** 是否运行在鸿蒙原生桥接壳中（非 Tauri，但提供 invoke/listen 桥接） */
export const isHarmonyNative: boolean = typeof window !== 'undefined' && '__legadoNative' in window;

/** 是否具备原生传输能力（Tauri IPC 或鸿蒙桥接） */
export const hasNativeTransport: boolean = isTauri || isHarmonyNative;

/** 自动检测的移动端结果（固定值，不受模式覆盖影响） */
export const autoIsMobile: boolean =
  typeof window !== 'undefined' &&
  (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    window.matchMedia('(pointer: coarse)').matches);

/**
 * UA-based 平台检测（作为初始值 / 非 Tauri 环境回退）。
 * 注意检测顺序：Android UA 中包含 "Linux"，必须先检测 Android/iPhone/iPad。
 */
function detectPlatformFromUA(): string {
  if (typeof navigator === 'undefined') {
    return '';
  }
  const ua = navigator.userAgent;
  if (/HarmonyOS|OpenHarmony/i.test(ua)) {
    return 'HarmonyOS';
  }
  if (/Android/i.test(ua)) {
    return 'Android';
  }
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return 'iOS';
  }
  if (/Windows/i.test(ua)) {
    return 'Windows';
  }
  if (/Mac OS X/i.test(ua)) {
    return 'macOS';
  }
  if (/Linux/i.test(ua)) {
    return 'Linux';
  }
  return '';
}

/**
 * 操作系统平台（响应式 ref）。
 *
 * - 初始值：UA 解析（修正了 Android 先于 Linux 的顺序）
 * - Tauri 环境：`initPlatformFromRust()` 初始化后由 Rust 编译期 cfg 精确覆盖
 *
 * 平台标识对照：
 *   UA 端         Rust 端
 *   'Windows'   ← 'windows'
 *   'macOS'     ← 'macos'
 *   'Linux'     ← 'linux'
 *   'Android'   ← 'android'
 *   'iOS'       ← 'ios'
 */
const _platform = ref(detectPlatformFromUA());

/** 只读平台标识字符串，支持响应式访问 */
export const platform: ComputedRef<string> = computed(() => _platform.value);

/**
 * 在 Tauri / WS 环境下调用 Rust 命令获取精确平台信息并更新响应式值。
 * 应在应用启动时（如 App.vue onMounted）调用一次。
 */
export async function initPlatformFromRust(): Promise<void> {
  // 映射：将 Rust 返回的小写标识映射为展示用的标准字符串
  const map: Record<string, string> = {
    windows: 'Windows',
    macos: 'macOS',
    linux: 'Linux',
    android: 'Android',
    ios: 'iOS',
  };

  if (isTauri) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const raw = await invoke<string>('get_platform');
      _platform.value = map[raw] ?? raw;
    } catch (e) {
      console.warn('[useEnv] get_platform 失败，保持 UA 检测结果:', e);
    }
    return;
  }

  // WS 模式：通过 transportInvoke 获取平台信息
  if (hasNativeTransport) {
    return; // 鸿蒙桥接模式通过 UA 已能准确识别，不需要额外请求
  }
  try {
    const { transportInvoke } = await import('./useTransport');
    const raw = await transportInvoke<string>('get_platform', undefined, 5000);
    _platform.value = map[raw] ?? raw;
  } catch {
    // WS 未连接或命令不支持时静默降级
  }
}

// ── 布局模式覆盖（"auto" | "mobile" | "desktop"） ─────────────────────────

/** 当前布局模式（由 useAppConfig 加载后通过 setLayoutMode 设置） */
export const layoutMode = ref('auto');

/** 设置布局模式覆盖 */
export function setLayoutMode(mode: string) {
  layoutMode.value = mode;
}

/**
 * 是否为移动端布局（响应式）
 * - auto：使用自动检测结果
 * - mobile：强制移动端
 * - desktop：强制桌面端
 */
export const isMobile: ComputedRef<boolean> = computed(() => {
  switch (layoutMode.value) {
    case 'mobile':
      return true;
    case 'desktop':
      return false;
    default:
      return autoIsMobile;
  }
});

/** 人类可读的环境标签 */
export const envLabel: string = (() => {
  if (isTauri) {
    return 'Tauri';
  }
  if (isHarmonyNative) {
    return 'Harmony';
  }
  if (autoIsMobile) {
    return '移动端浏览器';
  }
  return '浏览器';
})();
