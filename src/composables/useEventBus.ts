/**
 * useEventBus — 统一事件总线
 *
 * 提供与 `@tauri-apps/api/event` 完全兼容的 `listen` API，
 * 内部自动根据运行环境选择底层实现：
 * - Tauri 环境：直接调用 Tauri 原生 event API
 * - 浏览器环境：通过 WebSocket 接收后端事件推送
 *
 * ## 使用方式
 *
 * ```ts
 * import { eventListen } from '@/composables/useEventBus';
 *
 * // 与原来的 listen 用法完全一致
 * const unlisten = await eventListen<{ message: string }>('rust:log', (e) => {
 *   console.log(e.payload.message);
 * });
 *
 * // 组件卸载时取消监听
 * onUnmounted(() => unlisten());
 * ```
 */

import { transportListen, transportEmit, type EventHandler, type UnlistenFn } from './useTransport';

/**
 * 监听后端事件（统一入口）
 *
 * 功能等价于 `@tauri-apps/api/event` 的 `listen()`，
 * 但在非 Tauri 环境下自动回退到 WebSocket 接收。
 *
 * @param event   事件名（如 `"rust:log"`, `"booksource:changed"`）
 * @param handler 事件处理回调
 * @returns       取消监听函数
 */
export async function eventListen<T = unknown>(
  event: string,
  handler: EventHandler<T>,
): Promise<UnlistenFn> {
  return transportListen<T>(event, handler);
}

/**
 * 同步注册事件监听（不等待连接完成）
 *
 * 在不方便使用 async/await 的场景中使用。
 * 监听会在连接就绪后自动生效。
 *
 * @returns 取消监听函数
 */
export function eventListenSync<T = unknown>(event: string, handler: EventHandler<T>): () => void {
  let unlisten: UnlistenFn | null = null;
  let cancelled = false;

  transportListen<T>(event, handler).then((fn) => {
    if (cancelled) {
      fn(); // 已取消，立即解除
    } else {
      unlisten = fn;
    }
  });

  return () => {
    cancelled = true;
    if (unlisten) unlisten();
  };
}

/**
 * 发送事件（统一入口）
 *
 * 功能等价于 `@tauri-apps/api/event` 的 `emit()`，
 * 但在非 Tauri 环境下自动回退到本地事件广播。
 *
 * @param event   事件名
 * @param payload 事件数据
 */
export async function eventEmit<T = unknown>(event: string, payload?: T): Promise<void> {
  return transportEmit(event, payload);
}
