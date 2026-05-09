/**
 * 全局音乐播放器 Store
 *
 * - 持有单例 HTMLAudioElement
 * - 维护当前书（专辑/歌单）+ 章节列表（曲目）+ 播放索引
 * - 通过书源 `runChapterContent` 解析每一首歌的真实音频 URL（首次按需，可缓存）
 * - 提供播放/暂停/上一首/下一首/seek/volume/playMode 等动作
 * - 持久化最近一次队列与索引（用于刷新后恢复 mini 条）
 */
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { getFrontendStorageItem, setFrontendStorageJson } from '@/composables/useFrontendStorage';
import { isTauri } from '@/composables/useEnv';
import { toFileSrcSync } from '@/composables/useFileSrc';
import { useScriptBridgeStore } from './scriptBridge';

const STORAGE_NAMESPACE = 'music.player';
const STATE_KEY = 'lastSession';

export type PlayMode = 'order' | 'repeat-one' | 'shuffle' | 'list-loop';

export interface PlayerTrack {
  /** 章节 URL（书源原始 URL，需 runChapterContent 解析为真实音频 URL） */
  chapterUrl: string;
  name: string;
  /** 已解析的音频 URL（缓存） */
  audioUrl?: string;
}

export interface PlayerBookContext {
  /** 书架 ID（如已在书架，否则空） */
  shelfId?: string;
  fileName: string;
  bookUrl: string;
  name: string;
  author: string;
  coverUrl?: string;
  intro?: string;
  sourceName?: string;
}

interface PersistedSession {
  book: PlayerBookContext;
  tracks: PlayerTrack[];
  index: number;
}

function isNonEmpty(v: string | undefined | null): v is string {
  return typeof v === 'string' && v.length > 0;
}

function rawToText(raw: unknown): string {
  if (raw === null || raw === undefined) {
    return '';
  }
  if (typeof raw === 'string') {
    return raw;
  }
  if (typeof raw === 'number' || typeof raw === 'boolean') {
    return String(raw);
  }
  try {
    return JSON.stringify(raw);
  } catch {
    return '';
  }
}

/**
 * 规范化音频 URL：
 * - `//host/path` → `https://host/path`
 * - 相对路径 + 提供了 chapterUrl → 合并为绝对 URL
 * - 已是 http/https 的直接返回
 */
function normalizeAudioUrl(url: string, chapterUrl?: string): string {
  const u = url.trim();
  if (u.length === 0) {
    return '';
  }
  if (u.startsWith('//')) {
    return `https:${u}`;
  }
  if (/^https?:\/\//i.test(u)) {
    return u;
  }
  // 相对路径：用章节 URL 的 origin 解析
  if (chapterUrl !== undefined && chapterUrl.length > 0) {
    try {
      return new URL(u, chapterUrl).href;
    } catch {
      /* ignore */
    }
  }
  return u;
}

/** 尝试从对象中提取音频 URL（常见字段名） */
function extractUrlFromObject(obj: Record<string, unknown>): string {
  const keys = [
    'url', 'link', 'mp3Url', 'mp3_url', 'audioUrl', 'audio_url',
    'playUrl', 'play_url', 'src', 'source', 'path', 'fileLink',
    'song_file_link', 'listenUrl', 'listen_url', 'streamUrl', 'stream_url',
  ];
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && /^https?:\/\//i.test(v.trim())) {
      return v.trim();
    }
  }
  // 递归第一层嵌套对象
  for (const v of Object.values(obj)) {
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      const nested = extractUrlFromObject(v as Record<string, unknown>);
      if (nested.length > 0) {
        return nested;
      }
    }
    if (Array.isArray(v) && v.length > 0) {
      const first = v[0];
      if (typeof first === 'object' && first !== null) {
        const nested = extractUrlFromObject(first as Record<string, unknown>);
        if (nested.length > 0) {
          return nested;
        }
      }
    }
  }
  return '';
}

function extractAudioUrl(raw: unknown): string {
  // 如果原始值就是对象，直接提取
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    const url = extractUrlFromObject(raw as Record<string, unknown>);
    if (url.length > 0) {
      return url;
    }
  }
  const text = rawToText(raw);
  if (text.length === 0) {
    return '';
  }
  // 尝试 JSON 解析
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        const url = extractUrlFromObject(parsed as Record<string, unknown>);
        if (url.length > 0) {
          return url;
        }
      }
      if (Array.isArray(parsed) && parsed.length > 0) {
        const first = parsed[0];
        if (typeof first === 'object' && first !== null) {
          const url = extractUrlFromObject(first as Record<string, unknown>);
          if (url.length > 0) {
            return url;
          }
        }
        if (typeof first === 'string' && /^https?:\/\//i.test(first.trim())) {
          return first.trim();
        }
      }
    } catch {
      /* not JSON, continue */
    }
  }
  // 逐行找第一个看起来像 URL 的行
  const lines = text.split('\n').map((s) => s.trim()).filter((s) => s.length > 0);
  const urlLine = lines.find((s) => /^https?:\/\//i.test(s) || s.startsWith('//'));
  if (urlLine !== undefined) {
    return urlLine;
  }
  // 在文本中搜索嵌入的音频 URL（如 var meida = {https://...mp3; 格式）
  const embeddedMatch = text.match(
    /https?:\/\/[^\s"';{}<>]+\.(?:mp3|m4a|ogg|flac|wav|aac|opus|ape|wma|flv)(?:[^\s"';{}<>]*)?/i,
  );
  if (embeddedMatch !== null) {
    return embeddedMatch[0];
  }
  // 最后兜底：第一行
  return lines[0] ?? ''
}

export const useMusicPlayerStore = defineStore('musicPlayer', () => {
  // ── 状态 ──────────────────────────────────────────────────────────────
  const book = ref<PlayerBookContext | null>(null);
  const tracks = ref<PlayerTrack[]>([]);
  const currentIndex = ref(-1);
  const isPlaying = ref(false);
  const isLoading = ref(false);
  const errorText = ref('');
  const currentTime = ref(0);
  const duration = ref(0);
  const volume = ref(1);
  const muted = ref(false);
  const playMode = ref<PlayMode>('order');
  /** 全屏播放页是否打开 */
  const showFullPlayer = ref(false);
  /** 是否曾经触发过播放（用于决定是否显示 mini 条） */
  const hasSession = computed(() => book.value !== null && tracks.value.length > 0);
  const currentTrack = computed<PlayerTrack | null>(() => {
    if (currentIndex.value < 0 || currentIndex.value >= tracks.value.length) {
      return null;
    }
    return tracks.value[currentIndex.value];
  });

  let audio: HTMLAudioElement | null = null;
  let pendingPlayId = 0;

  function ensureAudio(): HTMLAudioElement {
    if (audio !== null) {
      return audio;
    }
    if (typeof window === 'undefined') {
      throw new Error('音频不可用：非浏览器环境');
    }
    const el = new Audio();
    el.preload = 'metadata';
    el.volume = volume.value;
    el.addEventListener('play', () => {
      isPlaying.value = true;
    });
    el.addEventListener('pause', () => {
      isPlaying.value = false;
    });
    el.addEventListener('timeupdate', () => {
      currentTime.value = Number.isFinite(el.currentTime) ? el.currentTime : 0;
    });
    el.addEventListener('loadedmetadata', () => {
      duration.value = Number.isFinite(el.duration) ? el.duration : 0;
    });
    el.addEventListener('durationchange', () => {
      duration.value = Number.isFinite(el.duration) ? el.duration : 0;
    });
    el.addEventListener('ended', () => {
      void handleEnded();
    });
    el.addEventListener('error', () => {
      const err = el.error;
      const code = err ? err.code : 0;
      const msg = err ? err.message : '';
      const url = el.src ?? '';
      const codeNames: Record<number, string> = {
        1: 'MEDIA_ERR_ABORTED',
        2: 'MEDIA_ERR_NETWORK',
        3: 'MEDIA_ERR_DECODE',
        4: 'MEDIA_ERR_SRC_NOT_SUPPORTED',
      };
      console.error(
        '[MusicPlayer] 音频加载失败',
        '\n  code:', code, `(${codeNames[code] ?? 'unknown'})`,
        '\n  message:', msg || '（空）',
        '\n  el.src (完整):', url || '（空）',
        '\n  networkState:', el.networkState,
        '\n  readyState:', el.readyState,
        '\n  currentTrack:', tracks.value[currentIndex.value],
      );
      errorText.value = `音频加载失败（code=${code} ${codeNames[code] ?? ''}）${msg ? ': ' + msg : ''}${url ? '\nURL: ' + url.slice(0, 200) : ''}`;
      isPlaying.value = false;
    });
    audio = el;
    return el;
  }

  // ── 持久化 ────────────────────────────────────────────────────────────
  function persist(): void {
    const ctx = book.value;
    if (ctx === null || tracks.value.length === 0) {
      return;
    }
    const session: PersistedSession = {
      book: ctx,
      tracks: tracks.value.map((t) => ({
        chapterUrl: t.chapterUrl,
        name: t.name,
      })),
      index: currentIndex.value,
    };
    setFrontendStorageJson(STORAGE_NAMESPACE, STATE_KEY, session);
  }

  function tryRestoreLastSession(): void {
    if (book.value !== null) {
      return;
    }
    const raw = getFrontendStorageItem(STORAGE_NAMESPACE, STATE_KEY);
    if (!isNonEmpty(raw)) {
      return;
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) {
        return;
      }
      const data = parsed as Partial<PersistedSession>;
      if (data.book === undefined || !Array.isArray(data.tracks) || data.tracks.length === 0) {
        return;
      }
      book.value = data.book;
      tracks.value = data.tracks;
      const idx = typeof data.index === 'number' ? data.index : 0;
      currentIndex.value = Math.max(0, Math.min(idx, data.tracks.length - 1));
    } catch {
      /* ignore */
    }
  }

  // ── 解析 + 播放 ───────────────────────────────────────────────────────
  async function resolveTrackUrl(track: PlayerTrack): Promise<string> {
    if (isNonEmpty(track.audioUrl)) {
      return track.audioUrl;
    }
    const ctx = book.value;
    if (ctx === null) {
      throw new Error('未设置当前歌单');
    }
    const bridge = useScriptBridgeStore();
    console.log(
      '[MusicPlayer] 开始解析音频 URL',
      '\n  fileName:', ctx.fileName,
      '\n  chapterUrl:', track.chapterUrl,
      '\n  trackName:', track.name,
    );
    const raw = await bridge.runChapterContent(ctx.fileName, track.chapterUrl);
    console.log('[MusicPlayer] runChapterContent 原始返回:', raw);
    const raw_url = extractAudioUrl(raw);
    console.log('[MusicPlayer] extractAudioUrl 提取结果:', raw_url || '（空）');
    if (raw_url.length === 0) {
      const preview = rawToText(raw).slice(0, 300);
      console.error('[MusicPlayer] 未提取到 URL，书源完整返回:', rawToText(raw));
      throw new Error(`未解析到音频地址。书源返回：${preview || '（空）'}`);
    }
    const url = normalizeAudioUrl(raw_url, track.chapterUrl);
    console.log('[MusicPlayer] 规范化后音频 URL:', url);

    // Tauri 环境：通过后端代理下载（携带正确 Referer），缓存后返回本地路径
    if (isTauri) {
      const { invoke } = await import('@tauri-apps/api/core');
      console.log('[MusicPlayer] 通过 Tauri audio_resolve_cache 代理下载，referer:', track.chapterUrl);
      try {
        const result = await invoke<{ localPath: string }>('audio_resolve_cache', {
          request: {
            url,
            referer: track.chapterUrl,
          },
        });
        const localUrl = toFileSrcSync(result.localPath);
        console.log('[MusicPlayer] 音频已缓存，本地路径:', result.localPath, '\n  播放 URL:', localUrl);
        track.audioUrl = localUrl;
        return localUrl;
      } catch (proxyErr) {
        console.warn('[MusicPlayer] audio_resolve_cache 失败，回退直接播放:', proxyErr);
        // 代理失败时仍尝试直接播放（非 Referer 限制的源可能成功）
      }
    }

    track.audioUrl = url;
    return url;
  }

  async function playIndex(index: number): Promise<void> {
    if (tracks.value.length === 0) {
      return;
    }
    const safeIndex = Math.max(0, Math.min(index, tracks.value.length - 1));
    currentIndex.value = safeIndex;
    const track = tracks.value[safeIndex];
    errorText.value = '';
    isLoading.value = true;
    pendingPlayId += 1;
    const playId = pendingPlayId;
    try {
      const el = ensureAudio();
      const url = await resolveTrackUrl(track);
      if (playId !== pendingPlayId) {
        return; // 已被新的请求覆盖
      }
      console.log(
        '[MusicPlayer] 准备播放',
        '\n  index:', safeIndex,
        '\n  name:', track.name,
        '\n  audioUrl:', url,
      );
      el.src = url;
      currentTime.value = 0;
      duration.value = 0;
      try {
        await el.play();
        console.log('[MusicPlayer] el.play() 成功');
      } catch (err) {
        // 自动播放策略导致的异常需要用户交互后重试
        console.error('[MusicPlayer] el.play() 异常:', err, '\n  src:', el.src);
        errorText.value = `播放失败：${err instanceof Error ? err.message : String(err)}`;
      }
      persist();
    } catch (err) {
      if (playId !== pendingPlayId) {
        return;
      }
      errorText.value = err instanceof Error ? err.message : String(err);
      isPlaying.value = false;
    } finally {
      if (playId === pendingPlayId) {
        isLoading.value = false;
      }
    }
  }

  /** 设置一个新的歌单并从 startIndex 开始播放 */
  async function playList(
    bookCtx: PlayerBookContext,
    list: PlayerTrack[],
    startIndex = 0,
  ): Promise<void> {
    book.value = bookCtx;
    tracks.value = list.map((t) => ({ chapterUrl: t.chapterUrl, name: t.name }));
    currentIndex.value = -1;
    showFullPlayer.value = true;
    if (list.length > 0) {
      await playIndex(startIndex);
    }
  }

  function pause(): void {
    if (audio !== null) {
      audio.pause();
    }
  }

  function resume(): void {
    if (audio === null) {
      return;
    }
    void audio.play().catch(() => {});
  }

  async function togglePlay(): Promise<void> {
    if (tracks.value.length === 0) {
      return;
    }
    if (audio === null || audio.src.length === 0) {
      const start = currentIndex.value < 0 ? 0 : currentIndex.value;
      await playIndex(start);
      return;
    }
    if (isPlaying.value) {
      pause();
    } else {
      resume();
    }
  }

  function seek(seconds: number): void {
    if (audio === null) {
      return;
    }
    const dur = audio.duration;
    const limit = Number.isFinite(dur) ? dur : seconds;
    const safe = Math.max(0, Math.min(seconds, limit));
    audio.currentTime = safe;
    currentTime.value = safe;
  }

  function setVolume(v: number): void {
    const safe = Math.max(0, Math.min(1, v));
    volume.value = safe;
    if (audio !== null) {
      audio.volume = safe;
    }
    if (safe > 0 && muted.value) {
      muted.value = false;
      if (audio !== null) {
        audio.muted = false;
      }
    }
  }

  function toggleMuted(): void {
    muted.value = !muted.value;
    if (audio !== null) {
      audio.muted = muted.value;
    }
  }

  function setPlayMode(mode: PlayMode): void {
    playMode.value = mode;
  }

  function pickShuffleIndex(): number {
    if (tracks.value.length <= 1) {
      return currentIndex.value;
    }
    let pick = currentIndex.value;
    while (pick === currentIndex.value) {
      pick = Math.floor(Math.random() * tracks.value.length);
    }
    return pick;
  }

  async function playNext(): Promise<void> {
    if (tracks.value.length === 0) {
      return;
    }
    if (playMode.value === 'shuffle') {
      await playIndex(pickShuffleIndex());
      return;
    }
    let i = currentIndex.value + 1;
    if (i >= tracks.value.length) {
      if (playMode.value === 'list-loop' || playMode.value === 'repeat-one') {
        i = 0;
      } else {
        // order: 到底停止
        pause();
        return;
      }
    }
    await playIndex(i);
  }

  async function playPrev(): Promise<void> {
    if (tracks.value.length === 0) {
      return;
    }
    if (playMode.value === 'shuffle') {
      await playIndex(pickShuffleIndex());
      return;
    }
    let i = currentIndex.value - 1;
    if (i < 0) {
      i = playMode.value === 'list-loop' ? tracks.value.length - 1 : 0;
    }
    await playIndex(i);
  }

  async function handleEnded(): Promise<void> {
    if (playMode.value === 'repeat-one') {
      if (audio !== null) {
        audio.currentTime = 0;
        try {
          await audio.play();
        } catch {
          /* ignore */
        }
      }
      return;
    }
    await playNext();
  }

  function openFullPlayer(): void {
    if (hasSession.value) {
      showFullPlayer.value = true;
    }
  }

  function closeFullPlayer(): void {
    showFullPlayer.value = false;
  }

  function stop(): void {
    pendingPlayId += 1;
    if (audio !== null) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    isPlaying.value = false;
    currentTime.value = 0;
    duration.value = 0;
  }

  /** 关闭播放器并清空当前会话（mini 条隐藏） */
  function clearSession(): void {
    stop();
    book.value = null;
    tracks.value = [];
    currentIndex.value = -1;
    showFullPlayer.value = false;
  }

  return {
    // state
    book,
    tracks,
    currentIndex,
    isPlaying,
    isLoading,
    errorText,
    currentTime,
    duration,
    volume,
    muted,
    playMode,
    showFullPlayer,
    // getters
    hasSession,
    currentTrack,
    // actions
    playList,
    playIndex,
    togglePlay,
    pause,
    resume,
    next: playNext,
    prev: playPrev,
    seek,
    setVolume,
    toggleMuted,
    setPlayMode,
    openFullPlayer,
    closeFullPlayer,
    clearSession,
    tryRestoreLastSession,
  };
});
