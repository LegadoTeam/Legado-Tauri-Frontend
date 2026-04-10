/**
 * useInvoke — Tauri invoke 超时保护封装
 *
 * 为所有 Tauri IPC 调用提供前端侧的超时兜底。
 * 即使后端 tokio::timeout 生效，前端也不会永久挂起。
 */

import { invoke } from '@tauri-apps/api/core'

/** invoke 超时错误 */
export class InvokeTimeoutError extends Error {
  constructor(command: string, timeoutMs: number) {
    super(`调用 ${command} 超时（${Math.round(timeoutMs / 1000)}s）`)
    this.name = 'InvokeTimeoutError'
  }
}

/**
 * 带超时保护的 Tauri invoke 调用
 *
 * @param command   Tauri 命令名
 * @param args      命令参数
 * @param timeoutMs 超时时间（毫秒），默认 35000ms（略大于后端 30s 超时）
 * @returns         命令返回值
 * @throws          InvokeTimeoutError | 其他 invoke 错误
 */
export async function invokeWithTimeout<T>(
  command: string,
  args?: Record<string, unknown>,
  timeoutMs = 35000,
): Promise<T> {
  return Promise.race([
    invoke<T>(command, args),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new InvokeTimeoutError(command, timeoutMs)), timeoutMs)
    }),
  ])
}
