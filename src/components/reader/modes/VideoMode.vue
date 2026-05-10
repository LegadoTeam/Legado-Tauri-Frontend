<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useAppConfigStore } from '@/stores';
import type { IVideoPlayer, VideoPlayerType, VideoSource } from '../video/types';
import { createVideoPlayer } from '../video/createPlayer';
import { parseVideoSource } from '../video/types';

const props = defineProps<{
  /** chapterContent 返回的原始内容（JSON 或纯 URL） */
  content: string;
  fileName: string;
  bookUrl: string;
  chapterUrl: string;
  /** 需要恢复的播放时间（秒），-1 表示从头播放 */
  resumeTime?: number;
}>();

const emit = defineEmits<{
  (e: 'progress', time: number, duration: number): void;
  (e: 'ended'): void;
  (e: 'next-chapter'): void;
}>();

const _appCfg = useAppConfigStore();
const { videoPlayerType, videoDefaultRate, videoAutoplay } = storeToRefs(_appCfg);

const playerContainer = ref<HTMLElement | null>(null);
const playerReady = ref(false);
const playerError = ref('');
/** 跟踪播放暂停状态（初始为暂停） */
const isPausedState = ref(true);

let player: IVideoPlayer | null = null;
let progressTimer: ReturnType<typeof setInterval> | null = null;
let currentSource: VideoSource | null = null;
/** 组件是否已开始卸载，用于防止异步 initPlayer 完成后覆盖已销毁状态 */
let componentDestroyed = false;
/**
 * 初始化代次计数器。
 * 每次调用 initPlayer 时自增；各异步阶段完成后对比当前值，
 * 若已落后则说明有更新的调用抢先，当前调用应丢弃已创建的实例并退出，
 * 以防止并发竞态导致多个播放器同时出声。
 */
let initGeneration = 0;

// ── 播放器生命周期 ──────────────────────────────────────────────────────

async function initPlayer(content: string) {
  // 同一资源 URL 不重建播放器（避免切页重布局触发重建）
  const newSource = parseVideoSource(content);
  if (player && currentSource?.url === newSource.url) {
    console.debug('[VideoMode] initPlayer skip: same url=%s', newSource.url);
    return;
  }

  // 占用当前代次，后续所有异步检查点都必须验证代次一致
  const myGen = ++initGeneration;
  console.debug('[VideoMode] initPlayer start gen=%d type=%s url=%s', myGen, videoPlayerType.value, newSource.url);

  // 清理旧实例
  destroyPlayer();
  playerReady.value = false;
  playerError.value = '';
  isPausedState.value = true;

  if (!content.trim() || !playerContainer.value) {
    console.debug('[VideoMode] initPlayer abort gen=%d: empty content or no container', myGen);
    return;
  }

  try {
    currentSource = parseVideoSource(content);

    const pendingPlayer = await createVideoPlayer(videoPlayerType.value as VideoPlayerType);

    // 检查点 1：await createVideoPlayer 期间，可能组件已卸载或新的 initPlayer 已发起
    if (componentDestroyed || myGen !== initGeneration) {
      console.warn(
        '[VideoMode] initPlayer discard gen=%d (destroyed=%s currentGen=%d): created player not used, destroying immediately',
        myGen, componentDestroyed, initGeneration,
      );
      pendingPlayer.destroy();
      return;
    }

    player = pendingPlayer;
    console.debug('[VideoMode] initPlayer mounting gen=%d', myGen);

    // await mount 确保内部播放器实例已创建，再注册事件
    await player.mount(playerContainer.value!, currentSource);

    // 检查点 2：mount 也是异步的，可能在此期间组件已卸载或代次已更新
    if (componentDestroyed || myGen !== initGeneration) {
      console.warn(
        '[VideoMode] initPlayer discard after mount gen=%d (destroyed=%s currentGen=%d)',
        myGen, componentDestroyed, initGeneration,
      );
      player.destroy();
      player = null;
      return;
    }

    console.debug('[VideoMode] initPlayer ready gen=%d', myGen);

    // 注册事件
    player.on('play', onPlay);
    player.on('pause', onPause);
    player.on('loadedmetadata', onLoadedMetadata);
    player.on('timeupdate', onTimeUpdate);
    player.on('ended', onEnded);
    player.on('error', onError);
    player.on('canplay', onCanPlay);

    // 启动进度定时上报（每 15 秒）
    progressTimer = setInterval(reportProgress, 15_000);
  } catch (err) {
    // 若已被更新代次抢占，不覆盖新实例的错误状态
    if (myGen === initGeneration) {
      playerError.value = `播放器初始化失败: ${err instanceof Error ? err.message : String(err)}`;
      console.error('[VideoMode] initPlayer error gen=%d:', myGen, err);
    }
  }
}

function destroyPlayer() {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
  if (player) {
    // 上报最终进度
    reportProgress();
    console.debug('[VideoMode] destroyPlayer: unregistering events and destroying player');
    player.off('play', onPlay);
    player.off('pause', onPause);
    player.off('loadedmetadata', onLoadedMetadata);
    player.off('timeupdate', onTimeUpdate);
    player.off('ended', onEnded);
    player.off('error', onError);
    player.off('canplay', onCanPlay);
    player.destroy();
    player = null;
  }
  // 清空容器
  if (playerContainer.value) {
    playerContainer.value.innerHTML = '';
  }
  playerReady.value = false;
  currentSource = null;
}

// ── 事件处理 ────────────────────────────────────────────────────────────

function onPlay() {
  isPausedState.value = false;
}
function onPause() {
  isPausedState.value = true;
}

function onLoadedMetadata() {
  playerReady.value = true;
  // 恢复播放位置
  if (props.resumeTime && props.resumeTime > 0 && player) {
    player.seek(props.resumeTime);
  }
  // 应用默认播放速率
  if (player && videoDefaultRate.value !== 1.0) {
    player.setPlaybackRate(videoDefaultRate.value);
  }
  // 自动开始播放
  if (videoAutoplay.value && player) {
    player.play();
  }
}

function onCanPlay() {
  playerReady.value = true;
}

function onTimeUpdate() {
  // timeupdate 事件频率很高，不在此处上报进度
}

function onEnded() {
  reportProgress();
  emit('ended');
  // auto-next 由父组件 VideoPlayerPage 负责（它拥有 hasNext prop）
}

function onError() {
  playerError.value = '视频播放出错，请检查视频源是否有效';
  console.error('[VideoMode] player error event, source url=%s', currentSource?.url);
}

function reportProgress() {
  if (!player) {
    return;
  }
  const time = player.getCurrentTime();
  const duration = player.getDuration();
  if (time > 0 && duration > 0) {
    emit('progress', time, duration);
  }
}

// ── 公开方法（供父组件调用） ──────────────────────────────────────────────

function getCurrentTime(): number {
  return player?.getCurrentTime() ?? 0;
}

function getDuration(): number {
  return player?.getDuration() ?? 0;
}

function play(): void {
  player?.play();
  isPausedState.value = false;
}

function pause(): void {
  player?.pause();
  isPausedState.value = true;
}

function isPaused(): boolean {
  return isPausedState.value;
}

function seek(delta: number): void {
  if (!player) {
    return;
  }
  const dur = player.getDuration();
  const cur = player.getCurrentTime();
  player.seek(Math.max(0, dur > 0 ? Math.min(dur - 0.5, cur + delta) : cur + delta));
}

function getVolume(): number {
  return player?.getVolume() ?? 1;
}

function setVolume(v: number): void {
  player?.setVolume(Math.max(0, Math.min(1, v)));
}

function enterFullscreen(): void {
  player?.enterFullscreen();
}

function exitFullscreen(): void {
  player?.exitFullscreen();
}

function isFullscreen(): boolean {
  return player?.isFullscreen() ?? false;
}

defineExpose({
  getCurrentTime,
  getDuration,
  play,
  pause,
  isPaused,
  seek,
  getVolume,
  setVolume,
  enterFullscreen,
  exitFullscreen,
  isFullscreen,
});

// ── 监听内容变化 ────────────────────────────────────────────────────────

watch(
  () => props.content,
  async (newContent) => {
    if (newContent) {
      await nextTick();
      void initPlayer(newContent);
    }
  },
  { immediate: true },
);

// 播放器预加载（组件挂载即触发，动态 import 已缓存后后续切集更快）
onMounted(() => {
  import('../video/createPlayer')
    .then((m) => m.preloadPlayerModule?.(videoPlayerType.value as VideoPlayerType))
    .catch(() => {});
});

// ── 清理 ────────────────────────────────────────────────────────────────

onBeforeUnmount(() => {
  componentDestroyed = true;
  console.debug('[VideoMode] onBeforeUnmount: destroying player');
  destroyPlayer();
});
</script>

<template>
  <div class="video-mode">
    <!-- 播放器容器 -->
    <div ref="playerContainer" class="video-mode__player" />

    <!-- 加载状态 -->
    <div v-if="!playerReady && !playerError" class="video-mode__loading">
      <n-spin :show="true" />
      <span>加载播放器中...</span>
    </div>

    <!-- 错误状态 -->
    <n-alert v-if="playerError" type="error" :title="playerError" style="margin: 16px" />
  </div>
</template>

<style scoped>
.video-mode {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: #000;
  position: relative;
}

.video-mode__player {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 确保播放器元素填满容器 */
.video-mode__player :deep(video),
.video-mode__player :deep(.video-js),
.video-mode__player :deep(.xgplayer),
.video-mode__player :deep(.dplayer) {
  width: 100% !important;
  max-height: 100%;
}

.video-mode__loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #ccc;
  background: #000;
  z-index: 1;
}
</style>
