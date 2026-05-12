/**
 * useTransport — 统一传输层（Tauri IPC / Harmony 桥接 / WebSocket 三模透明切换）
 *
 * 核心设计：
 * - 在 Tauri 壳内：使用原生 IPC（invoke + listen）
 * - 在 Harmony 原生壳内：使用 `__legadoNative` 桥接，语义保持与 invoke/listen 一致
 * - 在浏览器中：自动连接同域 WebSocket 服务器，模拟相同的 invoke/listen 语义
 * - 对上层业务完全透明，无需关心底层通信方式
 *
 * ## WebSocket 协议
 *
 * 客户端 → 服务器（命令调用）：
 * ```json
 * { "type": "invoke", "id": "uuid", "cmd": "booksource_list", "args": {} }
 * ```
 *
 * 服务器 → 客户端（命令响应）：
 * ```json
 * { "type": "response", "id": "uuid", "data": [...] }
 * ```
 *
 * 服务器 → 客户端（事件推送）：
 * ```json
 * { "type": "event", "event": "rust:log", "payload": { "message": "..." } }
 * ```
 */

import { safeRandomUUID } from '@/utils/uuid';
import { hasNativeTransport, isHarmonyNative, isTauri } from './useEnv';

// ── 自定义后端地址（URL 参数持久化） ─────────────────────────────────────

const CUSTOM_WS_URL_PARAM = 'ws';

function readCustomWsUrlFromLocation(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  try {
    return new URL(window.location.href).searchParams.get(CUSTOM_WS_URL_PARAM) ?? '';
  } catch {
    return '';
  }
}

function writeCustomWsUrlToLocation(url: string | null): void {
  if (typeof window === 'undefined') {
    return;
  }
  const nextUrl = new URL(window.location.href);
  if (url && url.trim()) {
    nextUrl.searchParams.set(CUSTOM_WS_URL_PARAM, url.trim());
  } else {
    nextUrl.searchParams.delete(CUSTOM_WS_URL_PARAM);
  }
  window.history.replaceState({}, '', nextUrl.toString());
}

/** 获取用户配置的自定义 WS 后端地址（空字符串表示未配置） */
export function getCustomWsUrl(): string {
  return readCustomWsUrlFromLocation();
}

/** 保存自定义 WS 后端地址并重置探测状态，使下次探测使用新地址 */
export function setCustomWsUrl(url: string): void {
  writeCustomWsUrlToLocation(url);
  resetWsProbe();
}

/** 清除自定义 WS 后端地址并重置探测状态 */
export function clearCustomWsUrl(): void {
  writeCustomWsUrlToLocation(null);
  resetWsProbe();
}

/** 重置 WS 探测状态，使下次调用 probeWsServer 重新探测 */
export function resetWsProbe(): void {
  wsProbed = false;
  wsAvailable = false;
  wsProbePromise = null;
  if (wsTransport) {
    wsTransport.disconnect();
    wsTransport = null;
  }
}

// ── 类型定义 ──────────────────────────────────────────────────────────────

/** WebSocket 连接状态 */
export type WsState = 'disconnected' | 'connecting' | 'connected' | 'error';

/** 事件监听回调 */
export type EventHandler<T = unknown> = (event: { payload: T }) => void;

/** 取消监听函数 */
export type UnlistenFn = () => void;

/** 待处理的 invoke 请求 */
interface PendingRequest {
  resolve: (data: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface HarmonyPendingRequest {
  resolve: (data: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

type HarmonyEventHandler<T = unknown> = (event: { payload: T }) => void;

interface HarmonyUiBridgeRuntime {
  invoke: <T>(cmd: string, args?: Record<string, unknown>, timeoutMs?: number) => Promise<T>;
  listen: <T = unknown>(event: string, handler: HarmonyEventHandler<T>) => UnlistenFn;
  emitLocal: <T = unknown>(event: string, payload?: T) => void;
}

interface HarmonyNativeBridge {
  invoke: (reqId: string, cmd: string, argsJson: string) => string;
  subscribe?: () => string;
  getEnv?: () => string;
  openDebugTool?: () => void;
  closeDebugTool?: () => void;
}

// ── WebSocket 传输实现 ───────────────────────────────────────────────────

/** WebSocket 传输管理器（单例） */
class WsTransport {
  private ws: WebSocket | null = null;
  private state: WsState = 'disconnected';
  private pending = new Map<string, PendingRequest>();
  private eventHandlers = new Map<string, Set<EventHandler>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseReconnectDelay = 1000; // 1 秒
  private wsUrl = '';
  private connectPromise: Promise<void> | null = null;
  private connectResolve: (() => void) | null = null;

  /** 初始化连接到指定 WS 地址 */
  connect(url: string): Promise<void> {
    if (this.state === 'connected' && this.ws?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    this.wsUrl = url;

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = new Promise<void>((resolve) => {
      this.connectResolve = resolve;
      this.doConnect();
    });

    return this.connectPromise;
  }

  private doConnect() {
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.onopen = null;
      try {
        this.ws.close();
      } catch {}
    }

    this.state = 'connecting';

    try {
      this.ws = new WebSocket(this.wsUrl);
    } catch (e) {
      console.error('[Transport] WebSocket 创建失败:', e);
      this.state = 'error';
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      console.log('[Transport] WebSocket 已连接:', this.wsUrl);
      this.state = 'connected';
      this.reconnectAttempts = 0;

      if (this.connectResolve) {
        this.connectResolve();
        this.connectResolve = null;
        this.connectPromise = null;
      }
    };

    this.ws.onclose = (e) => {
      console.warn('[Transport] WebSocket 断开:', e.code, e.reason);
      this.state = 'disconnected';
      this.rejectAllPending('WebSocket 连接断开');
      this.scheduleReconnect();
    };

    this.ws.onerror = (e) => {
      console.error('[Transport] WebSocket 错误:', e);
      this.state = 'error';
    };

    this.ws.onmessage = (e) => {
      this.handleMessage(e.data);
    };
  }

  /** 处理收到的 WS 消息 */
  private handleMessage(raw: string) {
    let msg: {
      type: string;
      id?: string;
      data?: unknown;
      error?: string;
      event?: string;
      payload?: unknown;
    };

    try {
      msg = JSON.parse(raw);
    } catch {
      console.warn('[Transport] 无法解析 WS 消息:', raw.slice(0, 200));
      return;
    }

    if (msg.type === 'response' && msg.id) {
      // 命令响应
      const pending = this.pending.get(msg.id);
      if (pending) {
        clearTimeout(pending.timer);
        this.pending.delete(msg.id);
        if (msg.error) {
          pending.reject(new Error(msg.error));
        } else {
          pending.resolve(msg.data);
        }
      }
    } else if (msg.type === 'event' && msg.event) {
      // 事件推送
      const handlers = this.eventHandlers.get(msg.event);
      if (handlers) {
        const eventObj = { payload: msg.payload };
        for (const handler of handlers) {
          try {
            handler(eventObj);
          } catch (e) {
            console.error(`[Transport] 事件处理器错误 [${msg.event}]:`, e);
          }
        }
      }
    }
  }

  /** 发送命令调用并等待响应 */
  async invoke<T>(cmd: string, args?: Record<string, unknown>, timeoutMs = 35000): Promise<T> {
    // 确保已连接
    if (this.state !== 'connected' || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.connect(this.wsUrl);
    }

    const id = safeRandomUUID();

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`调用 ${cmd} 超时（${Math.round(timeoutMs / 1000)}s）`));
      }, timeoutMs);

      this.pending.set(id, {
        resolve: resolve as (data: unknown) => void,
        reject,
        timer,
      });

      const message = JSON.stringify({
        type: 'invoke',
        id,
        cmd,
        args: args ?? {},
      });

      try {
        this.ws!.send(message);
      } catch (e) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(new Error(`发送命令失败: ${e}`));
      }
    });
  }

  /** 监听事件 */
  listen<T = unknown>(event: string, handler: EventHandler<T>): UnlistenFn {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler as EventHandler);

    return () => {
      const handlers = this.eventHandlers.get(event);
      if (handlers) {
        handlers.delete(handler as EventHandler);
        if (handlers.size === 0) {
          this.eventHandlers.delete(event);
        }
      }
    };
  }

  /** 重连调度 */
  private scheduleReconnect() {
    if (this.reconnectTimer) {
      return;
    }
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[Transport] 已达最大重连次数，停止重连');
      return;
    }

    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
      30000, // 最长 30 秒
    );
    this.reconnectAttempts++;

    console.log(`[Transport] ${delay}ms 后重连（第 ${this.reconnectAttempts} 次）...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.doConnect();
    }, delay);
  }

  /** 拒绝所有待处理请求 */
  private rejectAllPending(reason: string) {
    for (const [id, req] of this.pending) {
      clearTimeout(req.timer);
      req.reject(new Error(reason));
    }
    this.pending.clear();
  }

  /** 获取当前连接状态 */
  getState(): WsState {
    return this.state;
  }

  /** 断开连接 */
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.state = 'disconnected';
    this.rejectAllPending('主动断开连接');
  }
}

// ── 全局单例 ──────────────────────────────────────────────────────────────

/** WebSocket 传输实例（单例，懒初始化） */
let wsTransport: WsTransport | null = null;

/** 获取或创建 WsTransport 单例 */
function getWsTransport(): WsTransport {
  wsTransport ??= new WsTransport();
  return wsTransport;
}

/** WS 是否已探测并连接成功 */
let wsProbed = false;
let wsAvailable = false;
let wsProbePromise: Promise<boolean> | null = null;

// ── Harmony 原生桥接实现 ────────────────────────────────────────────────

let harmonyBridgeRuntime: HarmonyUiBridgeRuntime | null = null;

function getHarmonyNativeBridge(): HarmonyNativeBridge | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return ((window as Record<string, unknown>).__legadoNative as HarmonyNativeBridge) ?? null;
}

function ensureHarmonyBridgeRuntime(): HarmonyUiBridgeRuntime {
  if (harmonyBridgeRuntime) {
    return harmonyBridgeRuntime;
  }

  const nativeBridge = getHarmonyNativeBridge();
  if (!nativeBridge) {
    throw new Error('Harmony 原生桥接未注入');
  }

  const pending = new Map<string, HarmonyPendingRequest>();
  const listeners = new Map<string, Set<HarmonyEventHandler>>();
  let seq = 0;

  const bridgeObj = {
    invoke<T>(cmd: string, args?: Record<string, unknown>, timeoutMs = 35000): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        const reqId = `harmony_${++seq}_${Date.now().toString(36)}`;
        const timer = setTimeout(() => {
          pending.delete(reqId);
          reject(new Error(`调用 ${cmd} 超时（${Math.round(timeoutMs / 1000)}s）`));
        }, timeoutMs);

        pending.set(reqId, {
          resolve: resolve as (data: unknown) => void,
          reject,
          timer,
        });

        try {
          nativeBridge.invoke(reqId, cmd, JSON.stringify(args ?? {}));
        } catch (error) {
          clearTimeout(timer);
          pending.delete(reqId);
          reject(new Error(`Harmony invoke 调用失败: ${String(error)}`));
        }
      });
    },
    listen<T = unknown>(event: string, handler: HarmonyEventHandler<T>): UnlistenFn {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)!.add(handler as HarmonyEventHandler);

      return () => {
        const set = listeners.get(event);
        if (!set) {
          return;
        }
        set.delete(handler as HarmonyEventHandler);
        if (set.size === 0) {
          listeners.delete(event);
        }
      };
    },
    emitLocal<T = unknown>(event: string, payload?: T): void {
      const handlers = listeners.get(event);
      if (!handlers) {
        return;
      }
      const eventObj = { payload };
      for (const handler of handlers) {
        try {
          handler(eventObj as { payload: unknown });
        } catch (error) {
          console.error(`[Transport] Harmony 本地事件广播错误 [${event}]:`, error);
        }
      }
    },
  } satisfies HarmonyUiBridgeRuntime;

  const globalBridge = {
    invoke: bridgeObj.invoke,
    listen: bridgeObj.listen,
    resolve(reqId: string, ok: boolean, data: unknown) {
      const pendingReq = pending.get(reqId);
      if (!pendingReq) {
        return;
      }
      pending.delete(reqId);
      clearTimeout(pendingReq.timer);
      if (ok) {
        pendingReq.resolve(data);
      } else {
        pendingReq.reject(new Error(typeof data === 'string' ? data : JSON.stringify(data)));
      }
    },
    event(name: string, payload: unknown) {
      bridgeObj.emitLocal(name, payload);
    },
    isHarmony: true,
  };

  (window as Record<string, unknown>).__legadoUiBridge = globalBridge;

  try {
    nativeBridge.subscribe?.();
  } catch (error) {
    console.warn('[Transport] Harmony 事件订阅失败:', error);
  }

  harmonyBridgeRuntime = bridgeObj;
  return harmonyBridgeRuntime;
}

/**
 * 探测 WebSocket 服务是否可用
 *
 * 自动检测同域下的 WS 服务器：
 * - 如果是 localhost/127.0.0.1，尝试连接 ws://localhost:7688/ws
 * - 否则尝试同域 ws://{hostname}:7688/ws
 */
async function probeWsServer(): Promise<boolean> {
  if (wsProbed) {
    return wsAvailable;
  }

  if (wsProbePromise) {
    return wsProbePromise;
  }

  wsProbePromise = new Promise<boolean>((resolve) => {
    // 优先使用 URL 参数中的自定义地址
    const customUrl = getCustomWsUrl();
    const hostname = window.location.hostname || 'localhost';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const defaultUrl = `${protocol}//${hostname}:7688/ws`;
    const url = customUrl || defaultUrl;

    console.log('[Transport] 探测 WebSocket 服务:', url);

    const transport = getWsTransport();

    // 5 秒超时
    const timer = setTimeout(() => {
      wsProbed = true;
      wsAvailable = false;
      wsProbePromise = null;
      console.warn('[Transport] WebSocket 探测超时');
      resolve(false);
    }, 5000);

    transport
      .connect(url)
      .then(() => {
        clearTimeout(timer);
        wsProbed = true;
        wsAvailable = true;
        wsProbePromise = null;
        console.log('[Transport] WebSocket 服务可用');
        resolve(true);
      })
      .catch(() => {
        clearTimeout(timer);
        wsProbed = true;
        wsAvailable = false;
        wsProbePromise = null;
        console.warn('[Transport] WebSocket 服务不可用');
        resolve(false);
      });
  });

  return wsProbePromise;
}

// ── 统一 API 导出 ────────────────────────────────────────────────────────

/**
 * 统一 invoke 调用
 *
 * - Tauri 环境：使用原生 IPC
 * - Harmony 环境：使用原生桥接
 * - 浏览器环境：自动连接 WS 服务器并通过 WS 调用
 */
export async function transportInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
  timeoutMs = 35000,
): Promise<T> {
  if (isTauri) {
    // Tauri 原生 IPC
    const { invoke } = await import('@tauri-apps/api/core');
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      return await Promise.race([
        invoke<T>(command, args),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`调用 ${command} 超时（${Math.round(timeoutMs / 1000)}s）`)),
            timeoutMs,
          );
        }),
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  if (isHarmonyNative) {
    return ensureHarmonyBridgeRuntime().invoke<T>(command, args, timeoutMs);
  }

  // WS 模式
  const available = await probeWsServer();
  if (!available) {
    throw new Error(`当前环境不支持 ${command}，WebSocket 服务不可用`);
  }

  return getWsTransport().invoke<T>(command, args, timeoutMs);
}

/**
 * 统一事件监听
 *
 * - Tauri 环境：使用 @tauri-apps/api/event listen
 * - Harmony 环境：使用 `__legadoNative` + JS 回调桥接
 * - 浏览器环境：通过 WS 接收事件推送
 *
 * @returns 取消监听函数（与 Tauri listen 返回值一致）
 */
export async function transportListen<T = unknown>(
  event: string,
  handler: EventHandler<T>,
): Promise<UnlistenFn> {
  if (isTauri) {
    const { listen } = await import('@tauri-apps/api/event');
    return listen<T>(event, handler);
  }

  if (isHarmonyNative) {
    return ensureHarmonyBridgeRuntime().listen<T>(event, handler);
  }

  // WS 模式：确保已连接
  await probeWsServer();
  return getWsTransport().listen<T>(event, handler);
}

/**
 * 检测传输层是否可用
 *
 * - Tauri / Harmony 原生壳：始终可用
 * - 浏览器环境：探测 WS 服务是否存在
 */
export async function isTransportAvailable(): Promise<boolean> {
  if (hasNativeTransport) {
    return true;
  }
  return probeWsServer();
}

/**
 * 获取传输层类型标识
 */
export function getTransportType(): 'tauri' | 'harmony' | 'websocket' | 'none' {
  if (isTauri) {
    return 'tauri';
  }
  if (isHarmonyNative) {
    return 'harmony';
  }
  if (wsAvailable) {
    return 'websocket';
  }
  return 'none';
}

/**
 * 统一事件发送
 *
 * - Tauri 环境：使用 @tauri-apps/api/event emit
 * - Harmony / 浏览器环境：在本地事件总线上广播，让同页面的 listen 回调收到事件
 */
export async function transportEmit<T = unknown>(event: string, payload?: T): Promise<void> {
  if (isTauri) {
    const { emit } = await import('@tauri-apps/api/event');
    return emit(event, payload);
  }

  if (isHarmonyNative) {
    ensureHarmonyBridgeRuntime().emitLocal(event, payload);
    return;
  }

  // WS 模式：在本地事件处理器中广播
  const transport = getWsTransport();
  const handlers = transport['eventHandlers'].get(event);
  if (handlers) {
    const eventObj = { payload };
    for (const handler of handlers) {
      try {
        handler(eventObj as { payload: unknown });
      } catch (e) {
        console.error(`[Transport] 本地事件广播错误 [${event}]:`, e);
      }
    }
  }
}
