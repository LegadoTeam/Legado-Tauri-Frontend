/**
 * UUID 工具函数
 *
 * 在 HTTP 非安全上下文（如局域网 IP、HarmonyOS WebView）中，
 * `crypto.randomUUID` 可能不可用，此函数统一提供安全回退。
 */

/**
 * 生成 UUID v4。
 * 优先使用原生 `crypto.randomUUID`，不可用时回退到 Math.random 实现。
 */
export function safeRandomUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback：RFC 4122 v4 格式
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
