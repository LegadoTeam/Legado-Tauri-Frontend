/**
 * useTts v2 — TTS（文字转语音）流式播放引擎
 *
 * 设计：
 * - 动态队列：调用方通过 TtsStartOptions.initialSegments 提供首批段落，
 *   队列耗尽时通过 onNeedMore 回调获取下一批（可跨章节/翻页）。
 * - 预合成：播放第 N 段时提前在后台合成 N+1 ~ N+PRELOAD_AHEAD 段。
 * - 回调驱动：onSegmentStart 通知高亮，onAllDone 通知结束，
 *   onNeedMore 获取下一批（返回 null 表示无更多内容）。
 * - 降级：invoke 失败时自动切换 speechSynthesis。
 * - 跨平台兼容：Tauri 壳与纯 Web/WS 模式均可用。
 */

import { ref, readonly } from 'vue';
import { invokeWithTimeout } from './useInvoke';

// ── 常量 ─────────────────────────────────────────────────────────────────

/** 预加载窗口：播放第 N 段时，提前合成后续 PRELOAD_AHEAD 段 */
const PRELOAD_AHEAD = 3;

/** 单段最大字数（用于 splitIntoSegments 辅助函数） */
const MAX_SEGMENT_CHARS = 200;

/** TTS 合成 invoke 超时（ms） */
const TTS_TIMEOUT_MS = 30_000;

/** 历史回退缓冲大小 */
const MAX_HISTORY = 8;

// ── 类型 ─────────────────────────────────────────────────────────────────

export interface TtsOptions {
  voice?: string;
  rate?: string;
  volume?: string;
  pitch?: string;
}

/**
 * TTS 启动选项（流式队列模式）。
 *
 * 调用方负责将文本切段，并通过 onNeedMore 回调实现跨页/跨章节的流式推进。
 */
export interface TtsStartOptions extends TtsOptions {
  /** 第一批要朗读的文本段落 */
  initialSegments: string[];
  /**
   * 队列剩余段落 <= PRELOAD_AHEAD 时调用。
   * 返回下一批段落；返回 null 表示没有更多内容，播完后触发 onAllDone。
   * 允许异步（例如：需要等章节加载完毕）。
   */
  onNeedMore?: () => Promise<string[] | null>;
  /**
   * 每段开始播放时触发，传入该段的全局累计索引（0-based）。
   * 用于更新 DOM 高亮、自动翻页等。
   */
  onSegmentStart?: (globalIdx: number) => void;
  /** 所有段落全部播完且 onNeedMore 返回 null 后触发 */
  onAllDone?: () => void;
}

// ── 段落分割工具（供外部调用方使用） ─────────────────────────────────────

/**
 * 将连续文本拆分为适合 TTS 朗读的段落数组。
 */
export function splitIntoSegments(text: string): string[] {
  if (!text.trim()) return [];
  const lines = text.split(/\n+/).filter((l) => l.trim());
  const rawSegments: string[] = [];

  for (const line of lines) {
    const parts = line.split(/(?<=[。！？…；!?])/u);
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      if (trimmed.length <= MAX_SEGMENT_CHARS) {
        rawSegments.push(trimmed);
      } else {
        let remaining = trimmed;
        while (remaining.length > MAX_SEGMENT_CHARS) {
          let cutAt = MAX_SEGMENT_CHARS;
          for (let i = MAX_SEGMENT_CHARS - 1; i > MAX_SEGMENT_CHARS / 2; i--) {
            if (/[。！？…；!?,，、]/.test(remaining[i]!)) {
              cutAt = i + 1;
              break;
            }
          }
          rawSegments.push(remaining.slice(0, cutAt).trim());
          remaining = remaining.slice(cutAt).trim();
        }
        if (remaining) rawSegments.push(remaining);
      }
    }
  }
  return rawSegments.filter((s) => s.length > 0);
}

// ── base64 → Blob URL ────────────────────────────────────────────────────

function base64ToBlobUrl(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
}

// ── 全局单例状态 ─────────────────────────────────────────────────────────

interface QueueItem {
  text: string;
  globalIdx: number;
}

const isPlaying = ref(false);
const isLoading = ref(false);
const playbackRate = ref(1.0);
const error = ref<string | null>(null);
const currentGlobalIdx = ref(-1);

/** 待播放队列 */
const queue: QueueItem[] = [];
/** 已播放历史，用于 prevSegment */
const playedHistory: QueueItem[] = [];
/** 正在播放中的当前条目 */
let currentItem: QueueItem | null = null;

/** Blob URL 缓存：globalIdx → URL */
const blobUrlCache = new Map<number, string>();
/** 合成中 Promise，防止重复请求 */
const synthInFlight = new Map<number, Promise<string | null>>();

let nextGlobalIdx = 0;
let activeOptions: TtsStartOptions | null = null;
let audioEl: HTMLAudioElement | null = null;
let speechSynthesisFallback = false;
let stopped = false;
let loadingMore = false;
/** 当 loadMore 完成时 resolve 的 Promise，用于 playNext 等待 */
let loadMoreResolve: (() => void) | null = null;

// ── speechSynthesis 降级 ─────────────────────────────────────────────────

function cancelSpeechSynthesis(): void {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

// ── 合成 ─────────────────────────────────────────────────────────────────

async function synthesizeItem(item: QueueItem): Promise<string | null> {
  const { globalIdx, text } = item;
  if (blobUrlCache.has(globalIdx)) return blobUrlCache.get(globalIdx)!;
  if (synthInFlight.has(globalIdx)) return synthInFlight.get(globalIdx)!;
  if (speechSynthesisFallback) return null;

  const opts = activeOptions;
  const p = (async (): Promise<string | null> => {
    try {
      const b64 = await invokeWithTimeout<string>(
        'tts_synthesize',
        {
          text,
          voice: opts?.voice,
          rate: opts?.rate,
          volume: opts?.volume,
          pitch: opts?.pitch,
        },
        TTS_TIMEOUT_MS,
      );
      const url = base64ToBlobUrl(b64);
      blobUrlCache.set(globalIdx, url);
      return url;
    } catch (e) {
      console.warn('[TTS] 后端合成失败，切换降级模式', e);
      speechSynthesisFallback = true;
      return null;
    } finally {
      synthInFlight.delete(globalIdx);
    }
  })();
  synthInFlight.set(globalIdx, p);
  return p;
}

/** 预合成队列前 PRELOAD_AHEAD 个段落 */
function triggerPreload(): void {
  for (let i = 0; i < Math.min(PRELOAD_AHEAD, queue.length); i++) {
    const item = queue[i]!;
    if (!blobUrlCache.has(item.globalIdx) && !synthInFlight.has(item.globalIdx)) {
      void synthesizeItem(item);
    }
  }
}

// ── 加载更多 ─────────────────────────────────────────────────────────────

async function maybeLoadMore(): Promise<void> {
  if (loadingMore || !activeOptions?.onNeedMore) return;
  if (queue.length > PRELOAD_AHEAD) return;

  loadingMore = true;
  try {
    const more = await activeOptions.onNeedMore();
    if (more && more.length > 0) {
      for (const text of more) {
        queue.push({ text, globalIdx: nextGlobalIdx++ });
      }
      triggerPreload();
    }
    // null → 无更多，playNext 会处理队列为空的情况
  } finally {
    loadingMore = false;
    loadMoreResolve?.();
    loadMoreResolve = null;
  }
}

// ── 播放核心 ─────────────────────────────────────────────────────────────

async function playNext(): Promise<void> {
  if (stopped || !isPlaying.value) return;

  // 触发后台加载（不等待）
  void maybeLoadMore();

  // 队列为空时等待加载
  if (queue.length === 0) {
    if (loadingMore) {
      isLoading.value = true;
      await new Promise<void>((resolve) => {
        loadMoreResolve = resolve;
      });
      isLoading.value = false;
    }
    if (stopped || !isPlaying.value) return;
    if (queue.length === 0) {
      // 确实没有更多内容
      isPlaying.value = false;
      activeOptions?.onAllDone?.();
      return;
    }
  }

  const item = queue.shift()!;
  currentItem = item;
  currentGlobalIdx.value = item.globalIdx;
  activeOptions?.onSegmentStart?.(item.globalIdx);

  // 推入历史
  playedHistory.push(item);
  if (playedHistory.length > MAX_HISTORY) playedHistory.shift();

  if (speechSynthesisFallback) {
    const utter = new SpeechSynthesisUtterance(item.text);
    utter.rate = playbackRate.value;
    utter.onend = () => {
      currentItem = null;
      if (!stopped && isPlaying.value) void playNext();
    };
    utter.onerror = () => {
      currentItem = null;
      if (!stopped && isPlaying.value) void playNext();
    };
    window.speechSynthesis?.speak(utter);
    return;
  }

  isLoading.value = true;
  error.value = null;
  const url = await synthesizeItem(item);
  isLoading.value = false;
  if (stopped || !isPlaying.value) return;

  if (!url) {
    // 合成失败降级
    const utter = new SpeechSynthesisUtterance(item.text);
    utter.rate = playbackRate.value;
    utter.onend = () => {
      currentItem = null;
      if (!stopped && isPlaying.value) void playNext();
    };
    window.speechSynthesis?.speak(utter);
    return;
  }

  const audio = new Audio(url);
  audioEl = audio;
  audio.playbackRate = playbackRate.value;
  audio.onended = () => {
    currentItem = null;
    audioEl = null;
    if (!stopped && isPlaying.value) void playNext();
  };
  audio.onerror = () => {
    currentItem = null;
    audioEl = null;
    error.value = '音频播放出错';
    if (!stopped && isPlaying.value) void playNext();
  };
  try {
    await audio.play();
  } catch (e) {
    error.value = `播放失败: ${e}`;
    if (!stopped && isPlaying.value) void playNext();
  }
}

// ── 清理 ─────────────────────────────────────────────────────────────────

function clearAudio(): void {
  if (audioEl) {
    audioEl.pause();
    audioEl.onended = null;
    audioEl.onerror = null;
    audioEl = null;
  }
  cancelSpeechSynthesis();
}

function revokeBlobUrls(): void {
  for (const url of blobUrlCache.values()) URL.revokeObjectURL(url);
  blobUrlCache.clear();
  synthInFlight.clear();
}

// ── 公开 API ─────────────────────────────────────────────────────────────

/**
 * 开始朗读。调用方通过 TtsStartOptions 提供段落和回调。
 */
function startReading(options: TtsStartOptions): void {
  stop();
  stopped = false;
  speechSynthesisFallback = false;
  activeOptions = options;
  nextGlobalIdx = 0;
  currentGlobalIdx.value = -1;
  error.value = null;
  currentItem = null;
  playedHistory.length = 0;

  for (const text of options.initialSegments) {
    queue.push({ text, globalIdx: nextGlobalIdx++ });
  }
  triggerPreload();
  isPlaying.value = true;
  void playNext();
}

function play(): void {
  if (isPlaying.value) return;
  if (!activeOptions && queue.length === 0) return;
  isPlaying.value = true;
  if (currentItem) {
    // 恢复暂停的音频
    if (audioEl) {
      audioEl.play().catch(() => {});
      return;
    }
    // 音频已清除，重新播放当前 item
    queue.unshift(currentItem);
    currentItem = null;
  }
  void playNext();
}

function pause(): void {
  if (!isPlaying.value) return;
  isPlaying.value = false;
  if (audioEl) audioEl.pause();
  cancelSpeechSynthesis();
}

function stop(): void {
  stopped = true;
  isPlaying.value = false;
  isLoading.value = false;
  error.value = null;
  clearAudio();
  revokeBlobUrls();
  queue.length = 0;
  playedHistory.length = 0;
  currentItem = null;
  activeOptions = null;
  currentGlobalIdx.value = -1;
  loadingMore = false;
  loadMoreResolve?.();
  loadMoreResolve = null;
}

function nextSegment(): void {
  clearAudio();
  currentItem = null;
  if (isPlaying.value) void playNext();
}

function prevSegment(): void {
  if (playedHistory.length < 2) return;
  // 当前已在 history 末尾，取倒数第二个
  const current = playedHistory.pop()!;
  const prev = playedHistory[playedHistory.length - 1]!;
  // 放回队列头
  if (currentItem) queue.unshift(currentItem);
  queue.unshift(current);
  queue.unshift(prev);
  currentItem = null;
  clearAudio();
  if (isPlaying.value) void playNext();
}

function setPlaybackRate(rate: number): void {
  playbackRate.value = rate;
  if (audioEl) audioEl.playbackRate = rate;
}

// ── 导出 ─────────────────────────────────────────────────────────────────

export function useTts() {
  return {
    isPlaying: readonly(isPlaying),
    isLoading: readonly(isLoading),
    playbackRate: readonly(playbackRate),
    currentGlobalIdx: readonly(currentGlobalIdx),
    error: readonly(error),

    startReading,
    play,
    pause,
    stop,
    nextSegment,
    prevSegment,
    setPlaybackRate,
  };
}
