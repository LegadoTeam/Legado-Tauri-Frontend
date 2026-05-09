<script setup lang="ts">
import { openUrl } from '@tauri-apps/plugin-opener';
import { ChevronLeft, Link, Keyboard, ArrowUp } from 'lucide-vue-next';
import { storeToRefs } from 'pinia';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { ChapterItem, ChapterGroup } from '@/types';
import { useAppConfigStore, groupChapters } from '@/stores';
import type { ReaderBookInfo } from '../types';
import {
  ensureFrontendNamespaceLoaded,
  getFrontendStorageItem,
  legacyLocalStorageEntries,
  legacyLocalStorageRemove,
  setFrontendStorageItem,
} from '../../../composables/useFrontendStorage';
import VideoMode from './VideoMode.vue';

const props = defineProps<{
  /** chapterContent 拿到的播放地址（空则展示 loading/error 状态） */
  content: string;
  chapters: ChapterItem[];
  activeChapterIndex: number;
  bookInfo?: ReaderBookInfo;
  /** 正在加载 chapterContent（网络请求阶段） */
  loading: boolean;
  error: string;
  hasPrev: boolean;
  hasNext: boolean;
  fileName: string;
  resumeTime: number;
  /** 视频多线路分组数据（可选，由父组件传入） */
  chapterGroups?: ChapterGroup[];
  /** 初始选中的线路索引 */
  initialGroupIndex?: number;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'goto-chapter', index: number): void;
  (e: 'prev-chapter'): void;
  (e: 'next-chapter'): void;
  (e: 'progress', time: number, duration: number): void;
  (e: 'ended'): void;
  /** 切换线路分组时通知父组件 */
  (e: 'switch-group', groupIndex: number): void;
}>();

// 播放器 ref（完整 expose 类型）
const videoModeRef = ref<{
  getCurrentTime?: () => number;
  getDuration?: () => number;
  play?: () => void;
  pause?: () => void;
  isPaused?: () => boolean;
  seek?: (delta: number) => void;
  getVolume?: () => number;
  setVolume?: (v: number) => void;
  enterFullscreen?: () => void;
  exitFullscreen?: () => void;
  isFullscreen?: () => boolean;
} | null>(null);

const _appCfg = useAppConfigStore();
const { videoAutoNext, videoSeekStepSecs } = storeToRefs(_appCfg);

// ── 分组 & 排序状态 ──────────────────────────────────────────────────────

/** 分组数据（优先使用 props，否则从 chapters 推导） */
const groups = computed<ChapterGroup[]>(() => {
  if (props.chapterGroups && props.chapterGroups.length > 1) {
    return props.chapterGroups;
  }
  return groupChapters(props.chapters);
});

const hasGroups = computed(() => groups.value.length > 1);
const activeGroupIndex = ref(props.initialGroupIndex ?? 0);
const sortOrder = ref<'asc' | 'desc'>('asc');
const STORAGE_NAMESPACE = 'reader.video-page';

/** 前端存储 key，用于记忆标签和排序 */
function vpStorageKey(suffix: string) {
  const bookKey = props.bookInfo?.bookUrl || props.fileName;
  return `vp-video-${bookKey}-${suffix}`;
}

function saveVpTabState() {
  setFrontendStorageItem(STORAGE_NAMESPACE, vpStorageKey('group'), String(activeGroupIndex.value));
  setFrontendStorageItem(STORAGE_NAMESPACE, vpStorageKey('sort'), sortOrder.value);
}

function restoreVpTabState() {
  try {
    const savedGroup = getFrontendStorageItem(STORAGE_NAMESPACE, vpStorageKey('group'));
    if (savedGroup !== null) {
      const idx = Number(savedGroup);
      if (idx >= 0 && idx < groups.value.length) {
        activeGroupIndex.value = idx;
      }
    }
    const savedSort = getFrontendStorageItem(STORAGE_NAMESPACE, vpStorageKey('sort'));
    if (savedSort === 'desc') {
      sortOrder.value = 'desc';
    }
  } catch {
    /* ignore */
  }
}

// 恢复记忆
onMounted(() => {
  void ensureFrontendNamespaceLoaded(STORAGE_NAMESPACE, () => {
    const bookKey = props.bookInfo?.bookUrl || props.fileName;
    const migrated: Record<string, string> = {};
    const legacy = legacyLocalStorageEntries(`vp-video-${bookKey}-`);
    for (const [key, value] of Object.entries(legacy)) {
      migrated[key] = value;
      legacyLocalStorageRemove(key);
    }
    return Object.keys(migrated).length ? migrated : null;
  }).then(() => {
    if (hasGroups.value) {
      restoreVpTabState();
    }
  });
});

function onGroupTabClick(idx: number) {
  activeGroupIndex.value = idx;
  saveVpTabState();
  emit('switch-group', idx);
}

function toggleVpSort() {
  sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  saveVpTabState();
}

/** 当前分组中的章节列表（含排序） */
const displayEpisodes = computed(() => {
  let list: ChapterItem[];
  if (hasGroups.value) {
    const g = groups.value[activeGroupIndex.value];
    list = g ? g.chapters : [];
  } else {
    list = props.chapters;
  }
  return sortOrder.value === 'desc' ? [...list].toReversed() : list;
});

const activeChapter = computed(() => props.chapters[props.activeChapterIndex]);

// ── URL 处理 ──────────────────────────────────────────────────────────────

/** 尝试从 content 中提取视频流 URL（取首个非空行） */
const videoSourceUrl = computed(() => {
  if (!props.content) {
    return '';
  }
  const line =
    props.content
      .split('\n')
      .map((s) => s.trim())
      .find((s) => s.length > 0) ?? '';
  try {
    const url = new URL(line);
    return url.toString();
  } catch {
    return line;
  }
});

/** 显示用的缩略 URL（去掉协议头，超长截断） */
const videoSourceUrlShort = computed(() => {
  const raw = videoSourceUrl.value;
  if (!raw) {
    return '';
  }
  const stripped = raw.replace(/^https?:\/\//, '');
  return stripped.length > 72 ? stripped.slice(0, 72) + '…' : stripped;
});

async function openSourceUrl() {
  const url = videoSourceUrl.value;
  if (!url) {
    return;
  }
  try {
    await openUrl(url);
  } catch {
    // 非标准 URL（如 m3u8 直链）时回退到复制
    navigator.clipboard.writeText(url).catch(() => {});
  }
}

// ── 播放结束处理（含 auto-next） ─────────────────────────────────────────

function handleEnded() {
  emit('ended');
  if (videoAutoNext.value && props.hasNext) {
    emit('next-chapter');
  }
}

// ── 键盘快捷键 ────────────────────────────────────────────────────────────

/**
 * 全局键盘快捷键（VideoPlayerPage 挂载期间生效）
 *
 * Space / K   ：播放 / 暂停
 * ← / J       ：快退 N 秒
 * → / L       ：快进 N 秒
 * Shift + ←   ：上一集
 * Shift + →   ：下一集
 * F           ：切换全屏
 * M           ：静音切换
 * ↑           ：音量 +10%
 * ↓           ：音量 -10%
 * Esc         ：退出全屏 / 关闭播放器
 */
function onKeydown(e: KeyboardEvent) {
  // 忽略输入框内的按键
  const target = e.target as HTMLElement;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
    return;
  }

  const videoRef = videoModeRef.value;
  const step = videoSeekStepSecs.value;

  switch (e.key) {
    case ' ':
    case 'k':
    case 'K':
      e.preventDefault();
      if (videoRef?.isPaused?.()) {
        videoRef.play?.();
      } else {
        videoRef?.pause?.();
      }
      break;

    case 'ArrowLeft':
      e.preventDefault();
      if (e.shiftKey) {
        if (props.hasPrev) {
          emit('prev-chapter');
        }
      } else {
        videoRef?.seek?.(-step);
      }
      break;

    case 'ArrowRight':
      e.preventDefault();
      if (e.shiftKey) {
        if (props.hasNext) {
          emit('next-chapter');
        }
      } else {
        videoRef?.seek?.(step);
      }
      break;

    case 'j':
    case 'J':
      e.preventDefault();
      videoRef?.seek?.(-step);
      break;

    case 'l':
    case 'L':
      e.preventDefault();
      videoRef?.seek?.(step);
      break;

    case 'f':
    case 'F':
      e.preventDefault();
      if (videoRef?.isFullscreen?.()) {
        videoRef.exitFullscreen?.();
      } else {
        videoRef?.enterFullscreen?.();
      }
      break;

    case 'm':
    case 'M': {
      e.preventDefault();
      const vol = videoRef?.getVolume?.() ?? 1;
      videoRef?.setVolume?.(vol > 0 ? 0 : 1);
      break;
    }

    case 'ArrowUp':
      e.preventDefault();
      videoRef?.setVolume?.(Math.min(1, (videoRef.getVolume?.() ?? 1) + 0.1));
      break;

    case 'ArrowDown':
      e.preventDefault();
      videoRef?.setVolume?.(Math.max(0, (videoRef.getVolume?.() ?? 1) - 0.1));
      break;

    case 'Escape':
      if (videoRef?.isFullscreen?.()) {
        e.preventDefault();
        videoRef.exitFullscreen?.();
      }
      break;
  }
}

onMounted(() => document.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown));

// ── 公开方法（供 ChapterReaderModal 获取播放进度） ────────────────────────

function getCurrentTime(): number {
  return videoModeRef.value?.getCurrentTime?.() ?? 0;
}

function getDuration(): number {
  return videoModeRef.value?.getDuration?.() ?? 0;
}

defineExpose({ getCurrentTime, getDuration });
</script>

<template>
  <div class="vp">
    <!-- ── 顶栏 ── -->
    <div class="vp__topbar">
      <n-button text circle class="vp__back-btn" @click="emit('close')">
        <template #icon>
          <ChevronLeft :size="20" :stroke-width="2.5" />
        </template>
      </n-button>
      <div class="vp__topbar-titles">
        <span class="vp__topbar-book">{{ bookInfo?.name ?? '视频播放' }}</span>
        <span v-if="activeChapter" class="vp__topbar-ep">{{ activeChapter.name }}</span>
        <!-- 视频来源 URL -->
        <n-tooltip v-if="videoSourceUrl" placement="bottom" :delay="600">
          <template #trigger>
            <span class="vp__topbar-url" @click="openSourceUrl">
              <Link :size="10" :stroke-width="2.5" class="vp__topbar-url-icon" />
              {{ videoSourceUrlShort }}
            </span>
          </template>
          <div style="max-width: 420px; word-break: break-all; font-size: 0.8rem">
            {{ videoSourceUrl }}<br />
            <span style="opacity: 0.6">点击在浏览器中打开</span>
          </div>
        </n-tooltip>
      </div>

      <!-- 快捷键说明 -->
      <n-tooltip placement="bottom-end" :delay="400">
        <template #trigger>
          <n-button text circle class="vp__hotkey-btn">
            <template #icon>
              <Keyboard :size="16" />
            </template>
          </n-button>
        </template>
        <div class="vp__hotkey-tip">
          <table>
            <tbody>
            <tr>
              <td><kbd>Space</kbd> / <kbd>K</kbd></td>
              <td>播放 / 暂停</td>
            </tr>
            <tr>
              <td><kbd>←</kbd> / <kbd>J</kbd></td>
              <td>快退</td>
            </tr>
            <tr>
              <td><kbd>→</kbd> / <kbd>L</kbd></td>
              <td>快进</td>
            </tr>
            <tr>
              <td><kbd>Shift</kbd>+<kbd>←</kbd></td>
              <td>上一集</td>
            </tr>
            <tr>
              <td><kbd>Shift</kbd>+<kbd>→</kbd></td>
              <td>下一集</td>
            </tr>
            <tr>
              <td><kbd>F</kbd></td>
              <td>切换全屏</td>
            </tr>
            <tr>
              <td><kbd>M</kbd></td>
              <td>静音切换</td>
            </tr>
            <tr>
              <td><kbd>↑</kbd> / <kbd>↓</kbd></td>
              <td>音量调节</td>
            </tr>
            <tr>
              <td><kbd>Esc</kbd></td>
              <td>退出全屏 / 关闭</td>
            </tr>
            </tbody>
          </table>
        </div>
      </n-tooltip>
    </div>

    <!-- ── 主体（左列 + 右侧边栏） ── -->
    <div class="vp__body">
      <!-- 左 / 主列 -->
      <div class="vp__main">
        <!-- 播放器容器（固定 16:9） -->
        <div class="vp__player-wrap">
          <div v-if="loading" class="vp__player-placeholder">
            <n-spin :show="true" />
            <span>获取播放地址…</span>
          </div>
          <div v-else-if="error" class="vp__player-placeholder vp__player-placeholder--error">
            <n-alert type="error" :title="error" style="width: 90%; max-width: 420px" />
          </div>
          <VideoMode
            v-else
            ref="videoModeRef"
            :content="content"
            :file-name="fileName"
            :book-url="bookInfo?.bookUrl ?? ''"
            :chapter-url="activeChapter?.url ?? ''"
            :resume-time="resumeTime"
            @progress="(t, d) => emit('progress', t, d)"
            @ended="handleEnded"
            @next-chapter="emit('next-chapter')"
          />
        </div>

        <!-- 视频信息区 -->
        <div class="vp__info">
          <div class="vp__info-chapter">{{ activeChapter?.name }}</div>
          <div class="vp__info-meta">
            <span class="vp__info-book">{{ bookInfo?.name }}</span>
            <template v-if="bookInfo?.author">
              <span class="vp__info-sep">·</span>
              <span class="vp__info-author">{{ bookInfo.author }}</span>
            </template>
          </div>
          <!-- 来源 URL 行 -->
          <div v-if="videoSourceUrl" class="vp__info-url">
            <Link :size="11" :stroke-width="2.5" class="vp__info-url-icon" />
            <n-tooltip placement="top" :delay="500">
              <template #trigger>
                <span class="vp__info-url-text" @click="openSourceUrl">{{
                  videoSourceUrlShort
                }}</span>
              </template>
              <span style="word-break: break-all; font-size: 0.8rem"
                >{{ videoSourceUrl }}<br /><span style="opacity: 0.6"
                  >点击在浏览器中打开</span
                ></span
              >
            </n-tooltip>
          </div>
          <p v-if="bookInfo?.intro" class="vp__info-intro">{{ bookInfo.intro }}</p>
        </div>

        <!-- 移动端选集区域（多集才显示，桌面端通过 CSS 隐藏） -->
        <div v-if="chapters.length > 1" class="vp__strip">
          <div class="vp__strip-header">
            <div class="vp__strip-label">
              选集
              <span class="vp__strip-count">{{ displayEpisodes.length }} 集</span>
            </div>
            <n-button text size="tiny" class="vp__sort-btn" @click="toggleVpSort">
              {{ sortOrder === 'asc' ? '正序' : '倒序' }}
              <ArrowUp
                :size="12"
                :style="{
                  transform: sortOrder === 'desc' ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s',
                }"
              />
            </n-button>
          </div>
          <!-- 分组标签 -->
          <div v-if="hasGroups" class="vp__strip-tabs app-scrollbar--hidden">
            <button
              v-for="(g, gi) in groups"
              :key="g.name"
              class="vp__tab-btn"
              :class="{ 'vp__tab-btn--active': gi === activeGroupIndex }"
              @click="onGroupTabClick(gi)"
            >
              {{ g.name }}
              <span class="vp__tab-count">{{ g.chapters.length }}</span>
            </button>
          </div>
          <div class="vp__strip-scroll app-scrollbar--hidden">
            <button
              v-for="ch in displayEpisodes"
              :key="`${ch.group || ''}-${ch.url}`"
              class="vp__strip-btn"
              :class="{ 'vp__strip-btn--active': ch.url === activeChapter?.url }"
              @click="emit('goto-chapter', props.chapters.indexOf(ch))"
            >
              {{ ch.name }}
            </button>
          </div>
        </div>
      </div>

      <!-- 桌面端右侧选集侧边栏（单集时整体隐藏） -->
      <div v-if="chapters.length > 1" class="vp__sidebar">
        <div class="vp__sidebar-header">
          <div class="vp__sidebar-heading">
            选集
            <span class="vp__sidebar-count">{{ displayEpisodes.length }} 集</span>
          </div>
          <n-button text size="tiny" class="vp__sort-btn" @click="toggleVpSort">
            {{ sortOrder === 'asc' ? '正序' : '倒序' }}
            <ArrowUp
              :size="12"
              :style="{
                transform: sortOrder === 'desc' ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s',
              }"
            />
          </n-button>
        </div>
        <!-- 分组标签 -->
        <div v-if="hasGroups" class="vp__sidebar-tabs app-scrollbar--hidden">
          <button
            v-for="(g, gi) in groups"
            :key="g.name"
            class="vp__tab-btn"
            :class="{ 'vp__tab-btn--active': gi === activeGroupIndex }"
            @click="onGroupTabClick(gi)"
          >
            {{ g.name }}
            <span class="vp__tab-count">{{ g.chapters.length }}</span>
          </button>
        </div>
        <div class="vp__sidebar-list app-scrollbar app-scrollbar--thin">
          <button
            v-for="(ch, i) in displayEpisodes"
            :key="`${ch.group || ''}-${ch.url}`"
            class="vp__sidebar-item"
            :class="{ 'vp__sidebar-item--active': ch.url === activeChapter?.url }"
            @click="emit('goto-chapter', props.chapters.indexOf(ch))"
          >
            <span class="vp__sidebar-idx">{{
              sortOrder === 'asc' ? i + 1 : displayEpisodes.length - i
            }}</span>
            <div class="vp__sidebar-meta">
              <span class="vp__sidebar-name">{{ ch.name }}</span>
              <span v-if="ch.url === activeChapter?.url" class="vp__sidebar-playing">正在播放</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── 整页容器 ── */
.vp {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  background: var(--color-surface);
  color: var(--color-text-primary);
  overflow: hidden;
}

/* ── 顶栏 ── */
.vp__topbar {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 56px;
  padding: 0 12px 0 6px;
  flex-shrink: 0;
  background: var(--color-surface-raised);
  border-bottom: 1px solid var(--color-border);
}

.vp__back-btn {
  flex-shrink: 0;
}

.vp__topbar-titles {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.vp__topbar-book {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}

.vp__topbar-ep {
  font-size: 0.73rem;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.25;
}

/* 顶栏来源 URL */
.vp__topbar-url {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 0.65rem;
  color: var(--color-text-muted);
  opacity: 0.65;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  line-height: 1.2;
  transition: opacity var(--transition-fast);
  font-family: 'Consolas', 'Menlo', monospace;
}

.vp__topbar-url:hover {
  opacity: 1;
  color: var(--color-accent);
}

.vp__topbar-url-icon {
  flex-shrink: 0;
  opacity: 0.7;
}

.vp__hotkey-btn {
  flex-shrink: 0;
  color: var(--color-text-muted);
  opacity: 0.7;
  transition: opacity var(--transition-fast);
}

.vp__hotkey-btn:hover {
  opacity: 1;
}

.vp__hotkey-tip table {
  border-collapse: collapse;
  font-size: 0.78rem;
}

.vp__hotkey-tip tr td:first-child {
  padding-right: 14px;
  white-space: nowrap;
  padding-bottom: 4px;
  opacity: 0.85;
}

.vp__hotkey-tip kbd {
  display: inline-block;
  padding: 1px 5px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.1);
  font-size: 0.72rem;
  font-family: inherit;
}

/* ── 主体（flex 容器，mobile=column，desktop=row） ── */
.vp__body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── 左/主列 ── */
.vp__main {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

/* ── 播放器容器（保持 16:9） ── */
.vp__player-wrap {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #000;
  flex-shrink: 0;
  position: relative;
}

.vp__player-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.875rem;
}

.vp__player-placeholder--error {
  background: rgba(0, 0, 0, 0.6);
}

/* ── 信息区 ── */
.vp__info {
  padding: 14px 16px 12px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.vp__info-chapter {
  font-size: 1.0625rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 6px;
  line-height: 1.35;
}

.vp__info-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  margin-bottom: 6px;
}

.vp__info-sep {
  opacity: 0.4;
}

/* 信息区来源 URL */
.vp__info-url {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 8px;
  color: var(--color-text-muted);
  font-size: 0.78rem;
}

.vp__info-url-icon {
  flex-shrink: 0;
  opacity: 0.5;
}

.vp__info-url-text {
  font-family: 'Consolas', 'Menlo', monospace;
  font-size: 0.75rem;
  opacity: 0.7;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  transition:
    opacity var(--transition-fast),
    color var(--transition-fast);
}

.vp__info-url-text:hover {
  opacity: 1;
  color: var(--color-accent);
}

.vp__info-intro {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-text-secondary, var(--color-text-muted));
  line-height: 1.65;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  overflow: hidden;
}

/* ── 移动端选集区域 ── */
.vp__strip {
  flex-shrink: 0;
  padding: 10px 0 12px;
  border-bottom: 1px solid var(--color-border);
}

.vp__strip-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 8px;
}

.vp__strip-label {
  display: flex;
  align-items: baseline;
  gap: 5px;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--color-text-primary);
}

.vp__strip-count {
  font-size: 0.72rem;
  font-weight: 400;
  color: var(--color-text-muted);
}

.vp__strip-tabs {
  display: flex;
  gap: 6px;
  padding: 0 16px 8px;
  overflow-x: auto;
}

.vp__strip-scroll {
  display: flex;
  gap: 8px;
  padding: 0 16px;
  overflow-x: auto;
}

.vp__strip-btn {
  flex-shrink: 0;
  min-width: 40px;
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-raised);
  color: var(--color-text-primary);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast);
}

.vp__strip-btn:hover {
  border-color: var(--color-accent);
}

.vp__strip-btn--active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: #fff;
  font-weight: 700;
}

/* ── 共用标签按钮（移动端 strip + 桌面端 sidebar 复用） ── */
.vp__tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  padding: 4px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-raised);
  color: var(--color-text-primary);
  font-size: 0.8125rem;
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast);
}

.vp__tab-btn:hover {
  border-color: var(--color-accent);
}

.vp__tab-btn--active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: #fff;
  font-weight: 600;
}

.vp__tab-count {
  font-size: 0.6875rem;
  opacity: 0.7;
}

/* ── 排序按钮 ── */
.vp__sort-btn {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  cursor: pointer;
}

/* ── 桌面端侧边栏（移动端不显示） ── */
.vp__sidebar {
  display: none;
}

/* ────────────────────────────────────────────────────
   桌面端布局（≥ 768px）
   ─────────────────────────────────────────────────── */
@media (min-width: 768px) {
  .vp__body {
    flex-direction: row;
  }

  .vp__main {
    overflow-y: auto;
  }

  /* 移动端横条在桌面隐藏 */
  .vp__strip {
    display: none;
  }

  /* 侧边栏显现 */
  .vp__sidebar {
    display: flex;
    flex-direction: column;
    width: 300px;
    flex-shrink: 0;
    border-left: 1px solid var(--color-border);
    background: var(--color-surface-raised);
    overflow: hidden;
  }

  .vp__sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .vp__sidebar-heading {
    display: flex;
    align-items: baseline;
    gap: 6px;
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--color-text-primary);
    letter-spacing: 0.01em;
  }

  .vp__sidebar-count {
    font-size: 0.75rem;
    font-weight: 400;
    color: var(--color-text-muted);
  }

  .vp__sidebar-tabs {
    display: flex;
    gap: 6px;
    padding: 8px 16px;
    flex-shrink: 0;
    overflow-x: auto;
    border-bottom: 1px solid var(--color-border);
  }

  .vp__sidebar-list {
    flex: 1;
    overflow-y: auto;
  }

  .vp__sidebar-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    width: 100%;
    padding: 11px 16px;
    border: none;
    border-bottom: 1px solid var(--color-border);
    background: transparent;
    color: var(--color-text-primary);
    cursor: pointer;
    text-align: left;
    transition: background var(--transition-fast);
  }

  .vp__sidebar-item:last-child {
    border-bottom: none;
  }

  .vp__sidebar-item:hover {
    background: color-mix(in srgb, var(--color-accent) 6%, var(--color-surface));
  }

  .vp__sidebar-item--active {
    background: color-mix(in srgb, var(--color-accent) 12%, transparent);
  }

  .vp__sidebar-idx {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-xs, 4px);
    background: var(--color-surface);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--color-text-muted);
    margin-top: 1px;
    transition:
      background var(--transition-fast),
      color var(--transition-fast);
  }

  .vp__sidebar-item--active .vp__sidebar-idx {
    background: var(--color-accent);
    color: #fff;
  }

  .vp__sidebar-meta {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .vp__sidebar-name {
    font-size: 0.8125rem;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text-primary);
  }

  .vp__sidebar-item--active .vp__sidebar-name {
    color: var(--color-accent);
    font-weight: 600;
  }

  .vp__sidebar-playing {
    font-size: 0.6875rem;
    color: var(--color-accent);
    font-weight: 500;
  }
}
</style>
