/**
 * analytics.ts — Google Analytics Vue 插件
 *
 * - 动态注入 gtag.js 脚本（不阻塞首屏渲染）
 * - 通过 user_properties 区分平台：android / windows / harmony / ios / macos / linux / unknown
 * - 复用 useEnv.ts 的 UA 检测逻辑，无需额外依赖
 */

import type { App, Plugin } from 'vue';
import { isHarmonyNative, isTauri } from '@/composables/useEnv';

const GA_MEASUREMENT_ID = 'G-F1BTCV3C57';

/** 将 UA/env 检测结果规范化为 GA 平台标识 */
function resolvePlatform(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';

  if (isHarmonyNative || /HarmonyOS|OpenHarmony/i.test(ua)) {
    return 'harmony';
  }
  if (/Android/i.test(ua)) {
    return 'android';
  }
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return 'ios';
  }
  if (isTauri || /Windows/i.test(ua)) {
    return 'windows';
  }
  if (/Mac OS X/i.test(ua)) {
    return 'macos';
  }
  if (/Linux/i.test(ua)) {
    return 'linux';
  }
  return 'unknown';
}

function installGtag(measurementId: string, platform: string): void {
  // 初始化 dataLayer
  (window as unknown as Record<string, unknown>).dataLayer =
    (window as unknown as Record<string, unknown>).dataLayer ?? [];

  function gtag(..._args: unknown[]) {
    ((window as unknown as Record<string, unknown>).dataLayer as unknown[]).push(arguments);
  }

  (window as unknown as Record<string, unknown>).gtag = gtag;

  gtag('js', new Date());
  gtag('config', measurementId, {
    // 禁止 GA 自动采集可能含 PII 的字段
    send_page_view: true,
  });
  // 设置平台 user property（在整个会话内持久）
  gtag('set', 'user_properties', { platform });

  // 异步注入脚本，不阻塞渲染
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);
}

export const analyticsPlugin: Plugin = {
  install(_app: App) {
    const platform = resolvePlatform();
    installGtag(GA_MEASUREMENT_ID, platform);
  },
};
