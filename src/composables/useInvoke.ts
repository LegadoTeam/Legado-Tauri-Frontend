/**
 * useInvoke — 统一命令调用封装
 *
 * 为所有后端命令调用提供统一入口和超时保护。
 * 自动检测运行环境，在 Tauri 壳内使用原生 IPC，
 * 在浏览器中自动通过 WebSocket 通信。
 */

import { transportInvoke } from './useTransport';

/** invoke 超时错误 */
export class InvokeTimeoutError extends Error {
  constructor(command: string, timeoutMs: number) {
    super(`调用 ${command} 超时（${Math.round(timeoutMs / 1000)}s）`);
    this.name = 'InvokeTimeoutError';
  }
}

/** 当前运行环境不支持 Tauri invoke（且 WS 也不可用） */
export class InvokeUnavailableError extends Error {
  constructor(command: string) {
    super(`当前环境不支持 ${command}，请在 Tauri 桌面端或连接 WebSocket 服务后使用`);
    this.name = 'InvokeUnavailableError';
  }
}

/**
 * 带超时保护的统一命令调用
 *
 * 自动选择通信方式：
 * - Tauri 环境：使用原生 IPC（invoke）
 * - 浏览器环境：使用 WebSocket 通信
 *
 * @param command   命令名（如 `"booksource_list"`）
 * @param args      命令参数
 * @param timeoutMs 超时时间（毫秒），默认 35000ms
 * @returns         命令返回值
 * @throws          InvokeTimeoutError | InvokeUnavailableError | 其他错误
 */
export async function invokeWithTimeout<T>(
  command: string,
  args?: Record<string, unknown>,
  timeoutMs = 35000,
): Promise<T> {
  return transportInvoke<T>(command, args, timeoutMs);
}
