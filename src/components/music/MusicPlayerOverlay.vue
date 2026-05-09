<script setup lang="ts">
import {
  ChevronDown,
  ListMusic,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-vue-next';
/**
 * 全屏沉浸式音乐播放页
 *
 * 设计：
 * - 顶部：返回（最小化到 mini 条）+ 歌单/书名
 * - 中间：大封面（旋转动画）+ 标题/作者 + 进度条 + 时间
 * - 控制：随机/上一首/播放-暂停/下一首/循环模式
 * - 右下：歌单切换按钮（弹出抽屉显示曲目列表）
 *
 * 通过 Teleport 挂载到 body，并接入 useOverlayBackstack 兼容返回键/Esc。
 */
import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';
import { useOverlayBackstack } from '@/composables/useOverlayBackstack';
import { useMusicPlayerStore, type PlayMode } from '@/stores';
import { getCoverImageUrl } from '@/utils/coverImage';

const player = useMusicPlayerStore();
const {
  showFullPlayer,
  hasSession,
  currentTrack,
  currentIndex,
  tracks,
  isPlaying,
  isLoading,
  errorText,
  currentTime,
  duration,
  volume,
  muted,
  playMode,
  book,
} = storeToRefs(player);

const cover = computed(() => getCoverImageUrl(book.value?.coverUrl));
const showQueue = ref(false);

const progressPct = computed(() => {
  if (!Number.isFinite(duration.value) || duration.value <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, (currentTime.value / duration.value) * 100));
});

function formatTime(secs: number): string {
  if (!Number.isFinite(secs) || secs <= 0) {
    return '00:00';
  }
  const total = Math.floor(secs);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function close() {
  player.closeFullPlayer();
}

useOverlayBackstack(() => showFullPlayer.value && !showQueue.value, close);
useOverlayBackstack(
  () => showQueue.value,
  () => (showQueue.value = false),
);

// ── 进度条交互 ─────────────────────────────────────────────────────────
const progressBarRef = ref<HTMLElement | null>(null);
function seekFromEvent(e: PointerEvent) {
  const el = progressBarRef.value;
  if (el === null || duration.value <= 0) {
    return;
  }
  const rect = el.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  player.seek(ratio * duration.value);
}

let dragging = false;
function onProgressPointerDown(e: PointerEvent) {
  dragging = true;
  (e.currentTarget as Element).setPointerCapture(e.pointerId);
  seekFromEvent(e);
}
function onProgressPointerMove(e: PointerEvent) {
  if (dragging) {
    seekFromEvent(e);
  }
}
function onProgressPointerUp(e: PointerEvent) {
  if (!dragging) {
    return;
  }
  dragging = false;
  (e.currentTarget as Element).releasePointerCapture(e.pointerId);
  seekFromEvent(e);
}

// ── 控制 ────────────────────────────────────────────────────────────────
const PLAY_MODE_CYCLE: PlayMode[] = ['order', 'list-loop', 'repeat-one', 'shuffle'];
const PLAY_MODE_LABEL: Record<PlayMode, string> = {
  order: '顺序播放',
  'list-loop': '列表循环',
  'repeat-one': '单曲循环',
  shuffle: '随机播放',
};

function togglePlayMode() {
  const current = PLAY_MODE_CYCLE.indexOf(playMode.value);
  const next = PLAY_MODE_CYCLE[(current + 1) % PLAY_MODE_CYCLE.length];
  player.setPlayMode(next);
}

function onVolumeInput(e: Event) {
  const value = Number((e.target as HTMLInputElement).value);
  player.setVolume(value / 100);
}

function selectFromQueue(index: number) {
  showQueue.value = false;
  void player.playIndex(index);
}
</script>

<template>
  <Teleport to="body">
    <Transition name="full-player-fade">
      <div v-if="showFullPlayer && hasSession" class="full-player">
        <!-- 模糊背景 -->
        <div
          class="full-player__bg"
          :style="{ backgroundImage: cover ? `url(${cover})` : 'none' }"
        />
        <div class="full-player__bg-mask" />

        <header class="full-player__header">
          <button type="button" class="fp-icon-btn" aria-label="收起" @click="close">
            <ChevronDown :size="22" />
          </button>
          <div class="full-player__header-title">
            <div class="full-player__header-album">{{ book?.name }}</div>
            <div v-if="book?.sourceName" class="full-player__header-source">
              来自 {{ book.sourceName }}
            </div>
          </div>
          <!-- 仅移动端显示歌单按钮 -->
          <button
            type="button"
            class="fp-icon-btn fp-icon-btn--mobile-only"
            aria-label="歌单"
            @click="showQueue = true"
          >
            <ListMusic :size="20" />
          </button>
          <!-- 桌面端占位 -->
          <div class="fp-icon-btn fp-icon-btn--desktop-only" style="visibility: hidden" />
        </header>

        <!-- 主体：左侧控制区 + 右侧歌单栏 -->
        <div class="full-player__body">
          <main class="full-player__main">
            <div class="full-player__cover-wrap">
              <div
                class="full-player__cover"
                :class="{ 'full-player__cover--spinning': isPlaying }"
              >
                <img v-if="cover" :src="cover" :alt="book?.name ?? ''" />
                <div v-else class="full-player__cover-fallback">♪</div>
              </div>
            </div>

            <div class="full-player__controls-card">
            <div class="full-player__info">
              <h2 class="full-player__title">{{ currentTrack?.name || '未播放' }}</h2>
              <p class="full-player__artist">
                {{ book?.author || book?.name }}
              </p>
              <p v-if="errorText" class="full-player__error">{{ errorText }}</p>
            </div>

            <div class="full-player__progress">
              <span class="full-player__time">{{ formatTime(currentTime) }}</span>
              <div
                ref="progressBarRef"
                class="full-player__progress-bar"
                role="slider"
                :aria-valuenow="Math.floor(currentTime)"
                :aria-valuemin="0"
                :aria-valuemax="Math.floor(duration) || 0"
                @pointerdown="onProgressPointerDown"
                @pointermove="onProgressPointerMove"
                @pointerup="onProgressPointerUp"
              >
                <div class="full-player__progress-track">
                  <div
                    class="full-player__progress-fill"
                    :style="{ width: progressPct + '%' }"
                  />
                </div>
                <div class="full-player__progress-thumb" :style="{ left: progressPct + '%' }" />
              </div>
              <span class="full-player__time">{{ formatTime(duration) }}</span>
            </div>

            <div class="full-player__controls">
              <button
                type="button"
                class="fp-ctrl-btn"
                :aria-label="PLAY_MODE_LABEL[playMode]"
                :title="PLAY_MODE_LABEL[playMode]"
                @click="togglePlayMode"
              >
                <Shuffle v-if="playMode === 'shuffle'" :size="22" />
                <Repeat1 v-else-if="playMode === 'repeat-one'" :size="22" />
                <Repeat
                  v-else
                  :size="22"
                  :class="{ 'fp-ctrl-btn--inactive': playMode === 'order' }"
                />
              </button>
              <button
                type="button"
                class="fp-ctrl-btn"
                aria-label="上一首"
                :disabled="tracks.length <= 1"
                @click="player.prev()"
              >
                <SkipBack :size="28" />
              </button>
              <button
                type="button"
                class="fp-ctrl-btn fp-ctrl-btn--play"
                :aria-label="isPlaying ? '暂停' : '播放'"
                :disabled="isLoading"
                @click="player.togglePlay()"
              >
                <span v-if="isLoading" class="fp-ctrl-btn__spinner" />
                <component v-else :is="isPlaying ? Pause : Play" :size="32" />
              </button>
              <button
                type="button"
                class="fp-ctrl-btn"
                aria-label="下一首"
                :disabled="tracks.length <= 1"
                @click="player.next()"
              >
                <SkipForward :size="28" />
              </button>
              <button
                type="button"
                class="fp-ctrl-btn"
                :aria-label="muted ? '取消静音' : '静音'"
                @click="player.toggleMuted()"
              >
                <VolumeX v-if="muted" :size="22" />
                <Volume2 v-else :size="22" />
              </button>
            </div>

            <div class="full-player__volume">
              <input
                type="range"
                min="0"
                max="100"
                :value="Math.round(volume * 100)"
                aria-label="音量"
                @input="onVolumeInput"
              />
            </div>
            </div><!-- /.full-player__controls-card -->
          </main>

          <!-- 右侧歌单面板（桌面端常驻，移动端隐藏） -->
          <aside class="full-player__sidebar">
            <div class="fp-queue__header">
              <div class="fp-queue__title">
                播放列表
                <span class="fp-queue__count">（{{ tracks.length }}）</span>
              </div>
            </div>
            <ul class="fp-queue__list">
              <li
                v-for="(t, i) in tracks"
                :key="t.chapterUrl + ':' + i"
                class="fp-queue__item"
                :class="{ 'fp-queue__item--active': i === currentIndex }"
                @click="selectFromQueue(i)"
              >
                <span class="fp-queue__index">{{ i + 1 }}</span>
                <span class="fp-queue__name">{{ t.name }}</span>
                <Play
                  v-if="i === currentIndex && isPlaying"
                  class="fp-queue__playing"
                  :size="14"
                />
              </li>
            </ul>
          </aside>
        </div>

        <!-- 移动端歌单抽屉 -->
        <Transition name="queue-fade">
          <div
            v-if="showQueue"
            class="full-player__queue-overlay"
            @click.self="showQueue = false"
          >
            <div class="fp-queue fp-queue--sheet">
              <div class="fp-queue__header">
                <div class="fp-queue__title">
                  播放列表
                  <span class="fp-queue__count">（{{ tracks.length }}）</span>
                </div>
                <button class="fp-icon-btn" aria-label="关闭" @click="showQueue = false">
                  <ChevronDown :size="20" />
                </button>
              </div>
              <ul class="fp-queue__list">
                <li
                  v-for="(t, i) in tracks"
                  :key="t.chapterUrl + ':' + i"
                  class="fp-queue__item"
                  :class="{ 'fp-queue__item--active': i === currentIndex }"
                  @click="selectFromQueue(i)"
                >
                  <span class="fp-queue__index">{{ i + 1 }}</span>
                  <span class="fp-queue__name">{{ t.name }}</span>
                  <Play
                    v-if="i === currentIndex && isPlaying"
                    class="fp-queue__playing"
                    :size="14"
                  />
                </li>
              </ul>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ══════════════════════════════════════════════════════════════
   Design tokens — dark (default) / light via [data-theme='light']
   ══════════════════════════════════════════════════════════════ */
.full-player {
  /* text */
  --fp-text:         #fff;
  --fp-text-soft:    rgba(255, 255, 255, 0.70);
  --fp-text-muted:   rgba(255, 255, 255, 0.44);
  /* background layers */
  --fp-mask:         linear-gradient(
    180deg,
    rgba(0, 0, 0, 0.16) 0%,
    rgba(0, 0, 0, 0.52) 44%,
    rgba(0, 0, 0, 0.86) 100%
  );
  --fp-vignette:     radial-gradient(
    ellipse 140% 100% at 50% 50%,
    transparent 32%, rgba(0, 0, 0, 0.38) 100%
  );
  /* glass card */
  --fp-card-bg:      rgba(255, 255, 255, 0.055);
  --fp-card-border:  rgba(255, 255, 255, 0.10);
  --fp-card-shadow:  0 8px 32px rgba(0, 0, 0, 0.42),
                     0 1px 0 rgba(255, 255, 255, 0.06) inset;
  /* buttons */
  --fp-btn-bg:       rgba(255, 255, 255, 0.09);
  --fp-btn-hover:    rgba(255, 255, 255, 0.17);
  /* play button */
  --fp-play-bg:      #fff;
  --fp-play-color:   #111;
  --fp-play-shadow:  0 4px 20px rgba(255, 255, 255, 0.22), 0 1px 4px rgba(0, 0, 0, 0.22);
  /* progress */
  --fp-track-bg:     rgba(255, 255, 255, 0.16);
  --fp-fill-bg:      rgba(255, 255, 255, 0.90);
  --fp-thumb-bg:     #fff;
  /* cover */
  --fp-cover-shadow: 0 28px 64px rgba(0, 0, 0, 0.65),
                     0 4px 16px rgba(0, 0, 0, 0.38),
                     0 0 0 1px rgba(255, 255, 255, 0.10);
  /* queue */
  --fp-sidebar-bg:   rgba(0, 0, 0, 0.28);
  --fp-sidebar-sep:  rgba(255, 255, 255, 0.07);
  --fp-item-hover:   rgba(255, 255, 255, 0.07);
  --fp-item-active:  #6ee7b7;
  --fp-sheet-bg:     rgba(18, 18, 24, 0.96);
  --fp-sheet-sep:    rgba(255, 255, 255, 0.08);
  /* misc */
  --fp-inactive:     rgba(255, 255, 255, 0.35);
  --fp-error:        #fca5a5;
  --fp-header-grad:  linear-gradient(to bottom, rgba(0, 0, 0, 0.14), transparent);
}

/* Light mode */
:root[data-theme='light'] .full-player {
  --fp-text:         rgba(14, 16, 26, 0.94);
  --fp-text-soft:    rgba(14, 16, 26, 0.64);
  --fp-text-muted:   rgba(14, 16, 26, 0.42);
  --fp-mask:         linear-gradient(
    180deg,
    rgba(255, 252, 248, 0.08) 0%,
    rgba(255, 252, 248, 0.56) 44%,
    rgba(255, 252, 248, 0.90) 100%
  );
  --fp-vignette:     radial-gradient(
    ellipse 140% 100% at 50% 50%,
    transparent 32%, rgba(180, 168, 158, 0.22) 100%
  );
  --fp-card-bg:      rgba(255, 255, 255, 0.52);
  --fp-card-border:  rgba(255, 255, 255, 0.78);
  --fp-card-shadow:  0 8px 32px rgba(0, 0, 0, 0.08), 0 1px 0 rgba(255, 255, 255, 0.90) inset;
  --fp-btn-bg:       rgba(0, 0, 0, 0.07);
  --fp-btn-hover:    rgba(0, 0, 0, 0.13);
  --fp-play-bg:      rgba(14, 16, 26, 0.90);
  --fp-play-color:   #fff;
  --fp-play-shadow:  0 4px 20px rgba(0, 0, 0, 0.22), 0 1px 4px rgba(0, 0, 0, 0.10);
  --fp-track-bg:     rgba(0, 0, 0, 0.13);
  --fp-fill-bg:      rgba(14, 16, 26, 0.82);
  --fp-thumb-bg:     rgba(14, 16, 26, 0.88);
  --fp-cover-shadow: 0 28px 64px rgba(0, 0, 0, 0.20),
                     0 4px 16px rgba(0, 0, 0, 0.10),
                     0 0 0 1px rgba(0, 0, 0, 0.06);
  --fp-sidebar-bg:   rgba(255, 255, 255, 0.42);
  --fp-sidebar-sep:  rgba(0, 0, 0, 0.08);
  --fp-item-hover:   rgba(0, 0, 0, 0.05);
  --fp-item-active:  #0d6640;
  --fp-sheet-bg:     rgba(255, 255, 255, 0.96);
  --fp-sheet-sep:    rgba(0, 0, 0, 0.08);
  --fp-inactive:     rgba(14, 16, 26, 0.30);
  --fp-error:        #dc2626;
  --fp-header-grad:  linear-gradient(to bottom, rgba(255, 252, 248, 0.18), transparent);
}

/* System light (auto / unset) */
@media (prefers-color-scheme: light) {
  :root:not([data-theme]) .full-player,
  :root[data-theme='auto'] .full-player {
    --fp-text:         rgba(14, 16, 26, 0.94);
    --fp-text-soft:    rgba(14, 16, 26, 0.64);
    --fp-text-muted:   rgba(14, 16, 26, 0.42);
    --fp-mask:         linear-gradient(180deg, rgba(255,252,248,.08) 0%, rgba(255,252,248,.56) 44%, rgba(255,252,248,.90) 100%);
    --fp-vignette:     radial-gradient(ellipse 140% 100% at 50% 50%, transparent 32%, rgba(180,168,158,.22) 100%);
    --fp-card-bg:      rgba(255, 255, 255, 0.52);
    --fp-card-border:  rgba(255, 255, 255, 0.78);
    --fp-card-shadow:  0 8px 32px rgba(0,0,0,.08), 0 1px 0 rgba(255,255,255,.90) inset;
    --fp-btn-bg:       rgba(0, 0, 0, 0.07);
    --fp-btn-hover:    rgba(0, 0, 0, 0.13);
    --fp-play-bg:      rgba(14, 16, 26, 0.90);
    --fp-play-color:   #fff;
    --fp-play-shadow:  0 4px 20px rgba(0,0,0,.22), 0 1px 4px rgba(0,0,0,.10);
    --fp-track-bg:     rgba(0, 0, 0, 0.13);
    --fp-fill-bg:      rgba(14, 16, 26, 0.82);
    --fp-thumb-bg:     rgba(14, 16, 26, 0.88);
    --fp-cover-shadow: 0 28px 64px rgba(0,0,0,.20), 0 4px 16px rgba(0,0,0,.10), 0 0 0 1px rgba(0,0,0,.06);
    --fp-sidebar-bg:   rgba(255, 255, 255, 0.42);
    --fp-sidebar-sep:  rgba(0, 0, 0, 0.08);
    --fp-item-hover:   rgba(0, 0, 0, 0.05);
    --fp-item-active:  #0d6640;
    --fp-sheet-bg:     rgba(255, 255, 255, 0.96);
    --fp-sheet-sep:    rgba(0, 0, 0, 0.08);
    --fp-inactive:     rgba(14, 16, 26, 0.30);
    --fp-error:        #dc2626;
    --fp-header-grad:  linear-gradient(to bottom, rgba(255,252,248,.18), transparent);
  }
}

/* ── Base ─────────────────────────────────────────────────────── */
.full-player {
  position: fixed;
  inset: 0;
  z-index: 2000;
  color: var(--fp-text);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* ── Background layers (3 stacked) ──────────────────────────── */
.full-player__bg {
  position: absolute;
  inset: -60px;
  background-color: #1a1a22;
  background-size: cover;
  background-position: center;
  filter: blur(50px) saturate(1.7) brightness(0.88);
  transform: scale(1.15);
}

/* Layer 1: directional gradient */
.full-player__bg-mask {
  position: absolute;
  inset: 0;
  background: var(--fp-mask);
}

/* Layer 2: edge vignette */
.full-player__bg-mask::after {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--fp-vignette);
  pointer-events: none;
}

.full-player__header,
.full-player__body {
  position: relative;
  z-index: 1;
}

/* ── Header ─────────────────────────────────────────────────── */
.full-player__header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  padding-top: calc(16px + env(safe-area-inset-top, 0px));
  flex-shrink: 0;
  background: var(--fp-header-grad);
  border-bottom: 1px solid rgba(128, 128, 128, 0.10);
}

.full-player__header-title {
  flex: 1;
  text-align: center;
  min-width: 0;
}

.full-player__header-album {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.full-player__header-source {
  font-size: 11px;
  color: var(--fp-text-muted);
  margin-top: 2px;
}

/* ── Body layout ─────────────────────────────────────────────── */
.full-player__body {
  flex: 1;
  display: flex;
  flex-direction: row;
  min-height: 0;
  overflow: hidden;
}

.full-player__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 12px 20px calc(24px + env(safe-area-inset-bottom, 0px));
  gap: 16px;
  min-height: 0;
  overflow: hidden;
}


/* ── Right sidebar (desktop) ──────────────────────────────────── */
.full-player__sidebar {
  display: none;
}

@media (min-width: 768px) {
  .full-player__sidebar {
    display: flex;
    flex-direction: column;
    width: 300px;
    flex-shrink: 0;
    background: var(--fp-sidebar-bg);
    border-left: 1px solid var(--fp-sidebar-sep);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    overflow: hidden;
  }

  .fp-icon-btn--mobile-only {
    display: none;
  }
}

@media (max-width: 767px) {
  .fp-icon-btn--desktop-only {
    display: none;
  }
}

/* ── Icon buttons ─────────────────────────────────────────── */
.fp-icon-btn {
  width: 38px;
  height: 38px;
  border: none;
  border-radius: 50%;
  background: var(--fp-btn-bg);
  color: var(--fp-text);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background var(--dur-fast, 0.12s) ease;
  -webkit-tap-highlight-color: transparent;
}

.fp-icon-btn:hover {
  background: var(--fp-btn-hover);
}

.fp-icon-btn:active {
  transform: scale(0.92);
}

/* ── Cover ───────────────────────────────────────────────── */
.full-player__cover-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 0;
  padding: 6px 0;
  filter: drop-shadow(0 16px 32px rgba(0, 0, 0, 0.42));
}

.full-player__cover {
  width: min(58vw, 276px);
  aspect-ratio: 1;
  border-radius: 50%;
  overflow: hidden;
  box-shadow: var(--fp-cover-shadow);
  background: rgba(255, 255, 255, 0.04);
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (min-width: 768px) {
  .full-player__cover {
    width: min(34vw, 252px);
  }
}

.full-player__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.full-player__cover-fallback {
  font-size: 80px;
  color: var(--fp-text-muted);
}

.full-player__cover--spinning {
  animation: fp-spin 22s linear infinite;
}

@keyframes fp-spin {
  to {
    transform: rotate(360deg);
  }
}

/* ── Controls card (glass panel) ──────────────────────── */
.full-player__controls-card {
  width: 100%;
  max-width: 520px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 20px 22px 18px;
  border-radius: 20px;
  background: var(--fp-card-bg);
  border: 1px solid var(--fp-card-border);
  box-shadow: var(--fp-card-shadow);
  backdrop-filter: blur(20px) saturate(1.5);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
  flex-shrink: 0;
}

/* ── Song info ─────────────────────────────────────────── */
.full-player__info {
  text-align: center;
  width: 100%;
}

.full-player__title {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin: 0 0 5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--fp-text);
}

.full-player__artist {
  font-size: 13px;
  color: var(--fp-text-soft);
  margin: 0;
}

.full-player__error {
  margin: 8px 0 0;
  font-size: 11px;
  color: var(--fp-error);
  word-break: break-all;
  line-height: 1.5;
}

/* ── 进度条 ──────────────────────────────────────────────────────────── */
.full-player__progress {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  max-width: 480px;
}

.full-player__time {
  font-size: 11px;
  opacity: 0.7;
  font-variant-numeric: tabular-nums;
  min-width: 38px;
  text-align: center;
}

.full-player__progress-bar {
  position: relative;
  flex: 1;
  height: 16px;
  display: flex;
  align-items: center;
  cursor: pointer;
  touch-action: none;
}

.full-player__progress-track {
  width: 100%;
  height: 3px;
  background: rgba(255, 255, 255, 0.18);
  border-radius: 2px;
  overflow: hidden;
}

.full-player__progress-fill {
  height: 100%;
  background: #fff;
  transition: width 0.1s linear;
}

.full-player__progress-thumb {
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  transform: translate(-50%, 0);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.full-player__progress-bar:hover .full-player__progress-thumb {
  opacity: 1;
}

/* ── 控制按钮 ────────────────────────────────────────────────────────── */
.full-player__controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  width: 100%;
  max-width: 480px;
}

.fp-ctrl-btn {
  width: 52px;
  height: 52px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    background 0.15s ease,
    transform 0.1s ease;
}

.fp-ctrl-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
}

.fp-ctrl-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.fp-ctrl-btn:active:not(:disabled) {
  transform: scale(0.94);
}

.fp-ctrl-btn--play {
  width: 64px;
  height: 64px;
  background: #fff;
  color: #111;
}

.fp-ctrl-btn--play:hover:not(:disabled) {
  background: #f1f1f1;
}

.fp-ctrl-btn--inactive {
  opacity: 0.55;
}

.fp-ctrl-btn__spinner {
  width: 22px;
  height: 22px;
  border: 2px solid rgba(0, 0, 0, 0.2);
  border-top-color: #111;
  border-radius: 50%;
  animation: fp-spin 0.7s linear infinite;
}

/* ── 音量 ────────────────────────────────────────────────────────────── */
.full-player__volume {
  width: 100%;
  max-width: 280px;
  display: flex;
  align-items: center;
}

.full-player__volume input[type='range'] {
  width: 100%;
  accent-color: #fff;
}

/* ── Queue panel ──────────────────────────────────────────────── */
.fp-queue__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--fp-sidebar-sep);
  flex-shrink: 0;
}

.fp-queue__title {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.01em;
  color: var(--fp-text);
}

.fp-queue__count {
  font-size: 12px;
  color: var(--fp-text-muted);
  font-weight: normal;
}

.fp-queue__list {
  list-style: none;
  margin: 0;
  padding: 4px 0;
  overflow-y: auto;
  flex: 1;
  scrollbar-width: thin;
}

.fp-queue__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 16px;
  cursor: pointer;
  font-size: 13px;
  color: var(--fp-text);
  transition: background 0.12s ease;
  -webkit-tap-highlight-color: transparent;
}

.fp-queue__item:hover {
  background: var(--fp-item-hover);
}

.fp-queue__item:active {
  background: var(--fp-btn-hover);
}

.fp-queue__item--active {
  color: var(--fp-item-active);
}

.fp-queue__index {
  width: 26px;
  text-align: center;
  font-variant-numeric: tabular-nums;
  color: var(--fp-text-muted);
  font-size: 11px;
  flex-shrink: 0;
}

.fp-queue__name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fp-queue__playing {
  flex: 0 0 14px;
  color: var(--fp-item-active);
}

/* ── 移动端歌单抽屉 overlay ─────────────────────────────────────────── */
.full-player__queue-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.fp-queue--sheet {
  width: 100%;
  max-width: 520px;
  max-height: 70vh;
  background: #161616;
  border-radius: 14px 14px 0 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Transitions ─────────────────────────────────────────── */
.full-player-fade-enter-active,
.full-player-fade-leave-active {
  transition: opacity 0.28s ease;
}

.full-player-fade-enter-from,
.full-player-fade-leave-to {
  opacity: 0;
}

.full-player-fade-enter-active .full-player__main,
.full-player-fade-leave-active .full-player__main {
  transition: transform 0.32s cubic-bezier(0.22, 0.68, 0, 1.2);
}

.full-player-fade-enter-from .full-player__main,
.full-player-fade-leave-to .full-player__main {
  transform: translateY(48px);
}

.queue-fade-enter-active,
.queue-fade-leave-active {
  transition: opacity 0.22s ease;
}

.queue-fade-enter-active .fp-queue--sheet,
.queue-fade-leave-active .fp-queue--sheet {
  transition: transform 0.26s ease;
}

.queue-fade-enter-from,
.queue-fade-leave-to {
  opacity: 0;
}

.queue-fade-enter-from .fp-queue--sheet,
.queue-fade-leave-to .fp-queue--sheet {
  transform: translateY(60%);
}
</style>
