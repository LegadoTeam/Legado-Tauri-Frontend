<script setup lang="ts">
import { Pause, Play, SkipForward, X } from 'lucide-vue-next';
/**
 * 全局底部 Mini 播放条
 *
 * - 使用项目 CSS 变量，自动跟随深色/浅色主题
 * - 移动端位于 BottomNav 之上，支持上划展开、左划下一首、右划上一首
 * - 桌面端 hover 微浮动
 */
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { isMobile } from '@/composables/useEnv';
import { useMusicPlayerStore } from '@/stores';
import { getCoverImageUrl } from '@/utils/coverImage';

const player = useMusicPlayerStore();
const {
  hasSession,
  currentTrack,
  isPlaying,
  isLoading,
  currentTime,
  duration,
  book,
  showFullPlayer,
} = storeToRefs(player);

const cover = computed(() => getCoverImageUrl(book.value?.coverUrl));
const progressPct = computed(() => {
  if (!Number.isFinite(duration.value) || duration.value <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, (currentTime.value / duration.value) * 100));
});

function expand() {
  player.openFullPlayer();
}

function onTogglePlay(e: Event) {
  e.stopPropagation();
  void player.togglePlay();
}

function onNext(e: Event) {
  e.stopPropagation();
  void player.next();
}

function onPrev(e: Event) {
  e.stopPropagation();
  void player.prev();
}

function onClose(e: Event) {
  e.stopPropagation();
  player.clearSession();
}

// ── 移动端滑动手势 ────────────────────────────────────────────────────
let touchStartX = 0;
let touchStartY = 0;

function onTouchStart(e: TouchEvent) {
  const t = e.touches[0];
  touchStartX = t.clientX;
  touchStartY = t.clientY;
}

function onTouchEnd(e: TouchEvent) {
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStartX;
  const dy = t.clientY - touchStartY;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  // 滑动距离不足 40px 视为点击（由 @click 处理）
  if (adx < 40 && ady < 40) {
    return;
  }
  e.preventDefault();
  if (ady > adx) {
    // 上划：展开全屏
    if (dy < 0) {
      expand();
    }
  } else {
    // 左划：下一首；右划：上一首
    if (dx < 0) {
      void player.next();
    } else {
      void player.prev();
    }
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="mini-player-fade">
      <div
        v-if="hasSession && !showFullPlayer"
        class="mini-player"
        :class="{ 'mini-player--mobile': isMobile }"
        role="button"
        tabindex="0"
        @click="expand"
        @keydown.enter="expand"
        @keydown.space.prevent="expand"
        @touchstart.passive="onTouchStart"
        @touchend="onTouchEnd"
      >
        <!-- 顶部进度条 -->
        <div class="mini-player__progress" :style="{ width: progressPct + '%' }" />

        <!-- 封面 -->
        <div class="mini-player__cover">
          <img v-if="cover" :src="cover" :alt="book?.name ?? ''" loading="lazy" />
          <div v-else class="mini-player__cover-fallback">♪</div>
        </div>

        <!-- 曲目信息 -->
        <div class="mini-player__meta">
          <div class="mini-player__title" :title="currentTrack?.name">
            {{ currentTrack?.name || '未播放' }}
          </div>
          <div class="mini-player__sub" :title="book?.name">
            {{ book?.name }}<span v-if="book?.author"> · {{ book.author }}</span>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="mini-player__actions">
          <!-- 移动端多显一个上一首 -->
          <button
            v-if="isMobile"
            type="button"
            class="mini-player__btn"
            aria-label="上一首"
            @click="onPrev"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
            </svg>
          </button>
          <button
            type="button"
            class="mini-player__btn mini-player__btn--play"
            :aria-label="isPlaying ? '暂停' : '播放'"
            :disabled="isLoading"
            @click="onTogglePlay"
          >
            <component :is="isPlaying ? Pause : Play" :size="20" />
          </button>
          <button type="button" class="mini-player__btn" aria-label="下一首" @click="onNext">
            <SkipForward :size="18" />
          </button>
          <button
            type="button"
            class="mini-player__btn mini-player__btn--close"
            aria-label="关闭播放器"
            @click="onClose"
          >
            <X :size="16" />
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ── 基础 ────────────────────────────────────────────────────────────── */
.mini-player {
  position: fixed;
  left: 12px;
  right: 12px;
  bottom: 12px;
  z-index: 1900;

  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 10px 0 8px;
  height: 62px;

  border-radius: 14px;
  border: 1px solid var(--color-border);
  background: var(--mini-player-bg);
  backdrop-filter: blur(20px) saturate(1.6);
  -webkit-backdrop-filter: blur(20px) saturate(1.6);
  box-shadow: var(--mini-player-shadow);

  cursor: pointer;
  overflow: hidden;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  transition:
    transform var(--dur-fast, 0.12s) ease,
    box-shadow var(--dur-fast, 0.12s) ease;
}

/* 浅色主题 */
:root,
[data-theme='light'] {
  --mini-player-bg: rgba(255, 255, 255, 0.88);
  --mini-player-shadow: 0 4px 24px rgba(0, 0, 0, 0.1), 0 1px 4px rgba(0, 0, 0, 0.06);
  --mini-player-btn-hover: rgba(0, 0, 0, 0.06);
  --mini-player-play-bg: var(--color-accent, #3452e6);
  --mini-player-play-color: #fff;
}

/* 深色主题 */
[data-theme='dark'] {
  --mini-player-bg: rgba(30, 32, 40, 0.9);
  --mini-player-shadow: 0 4px 24px rgba(0, 0, 0, 0.4), 0 1px 4px rgba(0, 0, 0, 0.2);
  --mini-player-btn-hover: rgba(255, 255, 255, 0.1);
  --mini-player-play-bg: var(--color-accent, #8fafff);
  --mini-player-play-color: #111;
}

/* 系统深色（auto/未设置主题） */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]),
  [data-theme='auto'] {
    --mini-player-bg: rgba(30, 32, 40, 0.9);
    --mini-player-shadow: 0 4px 24px rgba(0, 0, 0, 0.4), 0 1px 4px rgba(0, 0, 0, 0.2);
    --mini-player-btn-hover: rgba(255, 255, 255, 0.1);
    --mini-player-play-bg: var(--color-accent, #8fafff);
    --mini-player-play-color: #111;
  }
}

/* 桌面端悬停 */
@media (hover: hover) {
  .mini-player:hover {
    transform: translateY(-2px);
    box-shadow: var(--mini-player-shadow), 0 8px 32px rgba(0, 0, 0, 0.12);
  }
}

/* ── 移动端：浮于 BottomNav 之上 ────────────────────────────────────── */
.mini-player--mobile {
  left: 8px;
  right: 8px;
  bottom: calc(var(--bottom-bar-height, 2.5rem) + var(--safe-bottom, 0px) + 8px);
  height: 58px;
  border-radius: 12px;
}

/* ── 进度条 ──────────────────────────────────────────────────────────── */
.mini-player__progress {
  position: absolute;
  left: 0;
  top: 0;
  height: 2px;
  border-radius: 0 2px 2px 0;
  background: var(--color-accent, #3452e6);
  transition: width 0.2s linear;
}

/* ── 封面 ────────────────────────────────────────────────────────────── */
.mini-player__cover {
  flex: 0 0 46px;
  width: 46px;
  height: 46px;
  border-radius: 8px;
  overflow: hidden;
  background: var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.mini-player__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mini-player__cover-fallback {
  font-size: 22px;
  color: var(--color-text-muted);
}

/* ── 文字 ────────────────────────────────────────────────────────────── */
.mini-player__meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.mini-player__title {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.mini-player__sub {
  font-size: 11px;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

/* ── 操作区 ──────────────────────────────────────────────────────────── */
.mini-player__actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.mini-player__btn {
  width: 38px;
  height: 38px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--color-text);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background var(--dur-fast, 0.12s) ease;
  -webkit-tap-highlight-color: transparent;
}

.mini-player__btn:hover:not(:disabled) {
  background: var(--mini-player-btn-hover);
}

.mini-player__btn:active:not(:disabled) {
  transform: scale(0.9);
}

.mini-player__btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* 主播放按钮：填充主题色 */
.mini-player__btn--play {
  width: 40px;
  height: 40px;
  background: var(--mini-player-play-bg);
  color: var(--mini-player-play-color);
}

.mini-player__btn--play:hover:not(:disabled) {
  filter: brightness(1.1);
  background: var(--mini-player-play-bg);
}

.mini-player__btn--close {
  width: 30px;
  height: 30px;
  color: var(--color-text-muted);
}

/* ── 入场/离场动画 ────────────────────────────────────────────────────── */
.mini-player-fade-enter-active,
.mini-player-fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.22s ease;
}

.mini-player-fade-enter-from,
.mini-player-fade-leave-to {
  opacity: 0;
  transform: translateY(16px);
}
</style>
