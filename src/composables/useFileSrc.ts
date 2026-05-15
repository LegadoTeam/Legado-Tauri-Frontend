/**
 * useFileSrc — 统一本地文件 URL 转换
 *
 * 替代 `convertFileSrc` from `@tauri-apps/api/core`。
 * - Tauri 环境：使用 Tauri 原生 `convertFileSrc()`
 * - B/S 环境：通过 HTTP `/asset/` 端点访问本地文件
 */

import { isHarmonyNative, isTauri } from './useEnv';

export const LOCAL_FILE_REF_PREFIX = 'local://';

/** Web 服务器资源 URL 前缀（懒初始化） */
let assetBaseUrl: string | null = null;

function getAssetBaseUrl(): string {
  if (assetBaseUrl) {
    return assetBaseUrl;
  }
  const hostname = window.location.hostname || 'localhost';
  const protocol = window.location.protocol;
  assetBaseUrl = `${protocol}//${hostname}:7688/asset/`;
  return assetBaseUrl;
}

/**
 * 将本地文件路径转换为可在前端使用的 URL
 *
 * @param filePath 本地文件的绝对路径
 * @returns 可用于 `<img src>` 等属性的 URL
 */
export async function toFileSrc(filePath: string): Promise<string> {
  if (isTauri) {
    const { convertFileSrc } = await import('@tauri-apps/api/core');
    return convertFileSrc(filePath);
  }
  if (isHarmonyNative) {
    return `file://${filePath}`;
  }
  // B/S 模式：通过 HTTP 端点访问
  return `${getAssetBaseUrl()}${encodeURIComponent(filePath)}`;
}

/**
 * 同步版本 — 根据当前环境直接返回 URL
 *
 * Tauri 环境下直接调用 runtime 注入的 __TAURI_INTERNALS__.convertFileSrc，
 * 保证 URL 格式与原生一致。
 *
 * @param filePath 本地文件的绝对路径
 * @returns 可用于 `<img src>` 等属性的 URL
 */
export function toFileSrcSync(filePath: string): string {
  if (isTauri) {
    // 直接调用 Tauri runtime 注入的原生转换函数
    return (
      window as unknown as Record<string, Record<string, (p: string, proto: string) => string>>
    ).__TAURI_INTERNALS__.convertFileSrc(filePath, 'asset');
  }
  if (isHarmonyNative) {
    return `file://${filePath}`;
  }
  return `${getAssetBaseUrl()}${encodeURIComponent(filePath)}`;
}

export function isLocalFileRef(src: string): boolean {
  return src.startsWith(LOCAL_FILE_REF_PREFIX);
}

export function extractLocalFilePath(src: string): string {
  return isLocalFileRef(src) ? src.slice(LOCAL_FILE_REF_PREFIX.length) : src;
}

export function toRenderableSrcSync(src?: string): string | undefined {
  if (!src) {
    return undefined;
  }
  return isLocalFileRef(src) ? toFileSrcSync(extractLocalFilePath(src)) : src;
}
