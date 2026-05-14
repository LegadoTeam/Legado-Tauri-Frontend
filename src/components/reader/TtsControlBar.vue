<!--
  TtsControlBar — 阅读器朗读功能的浮动控制条，展示进度、播放控制、倍速和测试提示。
-->
<script setup lang="ts">
import { SkipBack, Loader2, Pause, Play, SkipForward, X } from 'lucide-vue-next';
/**
 * TtsControlBar — TTS 浮动控制条
 *
 * 定位在阅读器底部菜单上方，固定于屏幕底部居中。
 * 通过 useTts() 全局单例控制播放状态。
 * progressText 由父组件传入，反映当前页/段落位置。
 */
import { useTts } from '@/composables/useTts';

const props = defineProps<{
  visible: boolean;
  /** 进度文本，如 "第3页" 或 "第12段" — 由父组件维护 */
  progressText?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const tts = useTts();

const RATE_OPTIONS = [
  { label: '0.5×', value: 0.5 },
  { label: '0.75×', value: 0.75 },
  { label: '1×', value: 1.0 },
  { label: '1.25×', value: 1.25 },
  { label: '1.5×', value: 1.5 },
  { label: '2×', value: 2.0 },
];

function handleClose() {
  tts.stop();
  emit('close');
}

function togglePlayPause() {
  if (tts.isPlaying.value) {
    tts.pause();
  } else {
    tts.play();
  }
}
</script>

<template>
  <Transition name="tts-bar">
    <div v-if="visible" class="tts-control-bar" role="toolbar" aria-label="朗读控制">
      <div class="tts-control-bar__notice">朗读功能仅供测试，很多人反馈有问题</div>

      <!-- 进度（由父组件提供） -->
      <span class="tts-control-bar__progress">
        {{ progressText ?? '—' }}
      </span>

      <!-- 上一段 -->
      <button class="tts-control-bar__btn" title="上一段" @click="tts.prevSegment()">
        <SkipBack :size="18" />
      </button>

      <!-- 播放 / 暂停 -->
      <button
        class="tts-control-bar__btn tts-control-bar__btn--play"
        :title="tts.isPlaying.value ? '暂停' : '播放'"
        @click="togglePlayPause"
      >
        <!-- 加载中 spinner -->
        <Loader2 v-if="tts.isLoading.value" class="tts-control-bar__spin" :size="20" />
        <!-- 暂停图标 -->
        <Pause v-else-if="tts.isPlaying.value" :size="20" />
        <!-- 播放图标 -->
        <Play v-else :size="20" />
      </button>

      <!-- 下一段 -->
      <button class="tts-control-bar__btn" title="下一段" @click="tts.nextSegment()">
        <SkipForward :size="18" />
      </button>

      <!-- 播放速度选择 -->
      <div class="tts-control-bar__rate">
        <button
          v-for="opt in RATE_OPTIONS"
          :key="opt.value"
          class="tts-control-bar__rate-btn"
          :class="{ 'tts-control-bar__rate-btn--active': tts.playbackRate.value === opt.value }"
          @click="tts.setPlaybackRate(opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>

      <!-- 关闭 -->
      <button
        class="tts-control-bar__btn tts-control-bar__btn--close"
        title="关闭朗读"
        @click="handleClose"
      >
        <X :size="16" :stroke-width="2.5" />
      </button>

      <!-- 错误提示 -->
      <div v-if="tts.error.value" class="tts-control-bar__error">
        {{ tts.error.value }}
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.tts-control-bar {
  position: fixed;
  bottom: 72px; /* 悬浮在底部菜单上方 */
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  border-radius: 32px;
  background: rgba(30, 30, 35, 0.92);
  backdrop-filter: blur(16px);
  color: #e8e8e8;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
  white-space: nowrap;
  max-width: calc(100vw - 32px);
  overflow: visible;
}

.tts-control-bar__progress {
  font-size: 0.75rem;
  opacity: 0.7;
  min-width: 3.5em;
  text-align: center;
}

.tts-control-bar__notice {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  max-width: calc(100vw - 48px);
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(30, 30, 35, 0.92);
  color: #ffd98a;
  font-size: 0.6875rem;
  line-height: 1.4;
  text-align: center;
  white-space: nowrap;
  overflow-wrap: anywhere;
  pointer-events: none;
}

.tts-control-bar__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 6px;
  border-radius: 50%;
  transition:
    background 0.15s,
    opacity 0.15s;
  flex-shrink: 0;
}

.tts-control-bar__btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
}

.tts-control-bar__btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.tts-control-bar__btn--play {
  width: 40px;
  height: 40px;
  background: rgba(99, 226, 183, 0.18);
  color: #63e2b7;
}
.tts-control-bar__btn--play:hover:not(:disabled) {
  background: rgba(99, 226, 183, 0.28);
}

.tts-control-bar__btn--close {
  opacity: 0.6;
  margin-left: 4px;
}
.tts-control-bar__btn--close:hover {
  opacity: 1;
}

/* 速度按钮组 */
.tts-control-bar__rate {
  display: flex;
  gap: 2px;
  margin: 0 4px;
}

.tts-control-bar__rate-btn {
  background: none;
  border: none;
  color: inherit;
  font-size: 0.6875rem;
  cursor: pointer;
  padding: 3px 6px;
  border-radius: 10px;
  opacity: 0.55;
  transition:
    background 0.15s,
    opacity 0.15s;
}
.tts-control-bar__rate-btn:hover {
  opacity: 0.9;
  background: rgba(255, 255, 255, 0.1);
}
.tts-control-bar__rate-btn--active {
  opacity: 1;
  background: rgba(99, 226, 183, 0.2);
  color: #63e2b7;
}

/* loading spinner */
.tts-control-bar__spin {
  animation: tts-spin 0.9s linear infinite;
}
@keyframes tts-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* 错误提示：绝对定位在控制条下方 */
.tts-control-bar__error {
  position: absolute;
  top: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(220, 60, 60, 0.9);
  color: #fff;
  font-size: 0.75rem;
  padding: 4px 12px;
  border-radius: 8px;
  white-space: nowrap;
  max-width: calc(100vw - 32px);
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 进出场动画 */
.tts-bar-enter-active,
.tts-bar-leave-active {
  transition:
    opacity 0.2s,
    transform 0.2s;
}
.tts-bar-enter-from,
.tts-bar-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(12px);
}
</style>
