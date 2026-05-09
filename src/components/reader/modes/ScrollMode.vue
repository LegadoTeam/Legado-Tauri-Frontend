<script setup lang="ts">
/**
 * ScrollMode — 滚动翻页模式
 *
 * 类似长网页式无限滚动阅读，支持触摸滚动和鼠标滚轮。
 * 左右点击不翻页，只有中间点击切换菜单。
 * 底部/顶部提供章节切换按钮（桌面端），移动端需要上拉超过阈值才触发下一章。
 * 上拉/下拉加载逻辑与 ComicMode 共用 usePullToLoad composable。
 */
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue';
import { usePullToLoad } from '../composables/usePullToLoad';
import PullBubble from '../PullBubble.vue';

const props = defineProps<{
  content: string;
  chapterTitle?: string;
  paragraphSpacing: number;
  textIndent: number;
  hasPrev?: boolean;
  hasNext?: boolean;
  tapZoneLeft?: number;
  tapZoneRight?: number;
  layoutDebug?: boolean;
  tapZoneDebug?: boolean;
  /** TTS 当前高亮段落索引，-1 表示无高亮 */
  ttsHighlightIndex?: number;
}>();

const emit = defineEmits<{
  (e: 'progress', ratio: number): void;
  (e: 'reachStart'): void;
  (e: 'reachEnd'): void;
  (e: 'tap', zone: 'left' | 'center' | 'right'): void;
  (e: 'prev-chapter'): void;
  (e: 'next-chapter'): void;
}>();

const scrollRef = ref<HTMLElement | null>(null);

const paragraphs = ref<string[]>([]);

/** 是否已滚动到底部附近 */
const atBottom = ref(false);
/** 是否已滚动到顶部 */
const atTop = ref(true);

// ── 上拉/下拉加载（共用 usePullToLoad composable） ──────────────────
const {
  pullDistance,
  pullProgress,
  bubbleBottomPx,
  isReady,
  dismissing,
  boundaryMsg,
  isDragging,
  onTouchStart: pullTouchStart,
  onTouchMove: pullTouchMove,
  onTouchEnd: pullTouchEnd,
  onMouseDown,
  onWheel,
  isMouseDragMoved,
  resetOnContentChange,
  cleanup,
} = usePullToLoad({
  containerRef: scrollRef,
  atBottom,
  hasNext: () => !!props.hasNext,
  emitNext: () => emit('next-chapter'),
});

// ── 触摸事件包装（添加 tap 检测） ──────────────────────────────────
let touchStartX = 0;
let touchStartY = 0;
/** touch tap 已处理，抑制后续合成 click 事件 */
let suppressNextClick = false;

function onTouchStart(e: TouchEvent) {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  pullTouchStart(e);
}

function onTouchMove(e: TouchEvent) {
  pullTouchMove(e);
}

function onTouchEnd(e: TouchEvent) {
  // 单指轻触 → 视为 tap，切换菜单（移动端可滚动容器内合成 click 不可靠）
  if (e.changedTouches.length === 1) {
    const t = e.changedTouches[0];
    const dx = Math.abs(t.clientX - touchStartX);
    const dy = Math.abs(t.clientY - touchStartY);
    const selection = window.getSelection();
    const hasSelection = !!selection && !selection.isCollapsed && !!selection.toString().trim();
    if (dx < 15 && dy < 15 && !hasSelection) {
      if (!(e.target as HTMLElement).closest('.scroll-mode__chapter-btn')) {
        suppressNextClick = true;
        emit('tap', 'center');
      }
    }
  }
  pullTouchEnd();
}

function onTouchCancel() {
  pullTouchEnd();
}

// ── 拖拽时禁用平滑滚动，确保即时跟手 ───────────────────────────────
watch(isDragging, (dragging) => {
  const el = scrollRef.value;
  if (!el) {
    return;
  }
  if (dragging) {
    el.style.userSelect = 'none';
    el.style.cursor = 'grabbing';
    el.style.scrollBehavior = 'auto';
  } else {
    el.style.userSelect = '';
    el.style.cursor = '';
    el.style.scrollBehavior = '';
    // 拖动结束时抑制后续 click 事件
    if (isMouseDragMoved()) {
      suppressNextClick = true;
    }
  }
});

// ── 清理 ────────────────────────────────────────────────────────────
onBeforeUnmount(() => cleanup());

// ── 内容变时重置状态 ────────────────────────────────────────────────
watch(
  () => props.content,
  (val) => {
    paragraphs.value = val.split(/\n+/).filter((p) => p.trim());
    resetOnContentChange();
    atBottom.value = false;
    atTop.value = true;
    nextTick(() => {
      const el = scrollRef.value;
      if (!el) {
        return;
      }
      // 禁用 CSS scroll-behavior: smooth，确保翻章时瞬间回到顶部，无滑动动画
      el.style.scrollBehavior = 'auto';
      el.scrollTop = 0;
      requestAnimationFrame(() => {
        el.style.scrollBehavior = '';
      });
    });
  },
  { immediate: true },
);

function onScroll() {
  const el = scrollRef.value;
  if (!el) {
    return;
  }
  const { scrollTop, scrollHeight, clientHeight } = el;
  const ratio = scrollHeight <= clientHeight ? 1 : scrollTop / (scrollHeight - clientHeight);
  emit('progress', Math.min(1, Math.max(0, ratio)));

  const prevAtTop = atTop.value;
  const prevAtBottom = atBottom.value;
  atTop.value = scrollTop <= 0;
  // 增大底部容差至 8px，避免子像素舍入导致反复触发
  atBottom.value = scrollTop + clientHeight >= scrollHeight - 8;

  // 仅在边沿状态发生变化时发出事件，防止连续触发
  if (!prevAtTop && atTop.value) {
    emit('reachStart');
  }
  if (!prevAtBottom && atBottom.value) {
    emit('reachEnd');
  }
}

/** 允许父组件滚动到指定比例位置（瞬间跳转，禁用 smooth） */
function scrollToRatio(ratio: number) {
  const el = scrollRef.value;
  if (!el) {
    return;
  }
  const max = el.scrollHeight - el.clientHeight;
  // 覆盖 CSS scroll-behavior: smooth，确保恢复位置时瞬间到达
  el.style.scrollBehavior = 'auto';
  el.scrollTop = max * Math.min(1, Math.max(0, ratio));
  // 下一帧恢复 smooth（用户后续手动滚动仍然平滑）
  requestAnimationFrame(() => {
    el.style.scrollBehavior = '';
  });
}

function getScrollRatio(): number {
  const el = scrollRef.value;
  if (!el) {
    return -1;
  }
  const max = el.scrollHeight - el.clientHeight;
  return max <= 0 ? 1 : Math.min(1, Math.max(0, el.scrollTop / max));
}

function scrollByPage(direction: 'up' | 'down'): boolean {
  const el = scrollRef.value;
  if (!el) {
    return false;
  }

  const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
  if (maxScrollTop <= 0) {
    return false;
  }

  const current = el.scrollTop;
  const step = Math.max(80, Math.floor(el.clientHeight * 0.86));
  const target =
    direction === 'down' ? Math.min(maxScrollTop, current + step) : Math.max(0, current - step);

  if (Math.abs(target - current) < 1) {
    return false;
  }

  el.scrollTo({ top: target, behavior: 'smooth' });
  return true;
}

function pageDown(): boolean {
  return scrollByPage('down');
}

function pageUp(): boolean {
  return scrollByPage('up');
}

/** 鼠标点击 → 任意区域均切换菜单（滚动模式不支持点击左右翻章） */
function onClick(e: MouseEvent) {
  const selection = window.getSelection();
  if (selection && !selection.isCollapsed && selection.toString().trim()) {
    return;
  }
  // touch tap 已处理，跳过合成 click 防止重复触发
  if (suppressNextClick) {
    suppressNextClick = false;
    return;
  }
  // 鼠标拖拽不算点击
  if (isMouseDragMoved()) {
    return;
  }
  // 不拦截按钮点击
  if ((e.target as HTMLElement).closest('.scroll-mode__chapter-btn')) {
    return;
  }
  emit('tap', 'center');
}

/** 桌面端保留下一章按鈕；移动端用上拉手势 */
const showNextBtn = computed(() => props.hasNext && atBottom.value && pullDistance.value === 0);
const leftRatio = computed(() => props.tapZoneLeft ?? 0.3);
const rightRatio = computed(() => props.tapZoneRight ?? 0.7);
const centerRatio = computed(() => Math.max(0, rightRatio.value - leftRatio.value));
const showAnyDebug = computed(() => !!props.layoutDebug || !!props.tapZoneDebug);

/** 返回当前视口内第一个可见段落的索引，用于 TTS 定位起始位置 */
function getFirstVisibleParaIndex(): number {
  const el = scrollRef.value;
  if (!el) {
    return 0;
  }
  const containerTop = el.getBoundingClientRect().top;
  const paras = el.querySelectorAll<HTMLElement>('.scroll-mode__para');
  for (let i = 0; i < paras.length; i++) {
    const rect = paras[i]?.getBoundingClientRect();
    if (!rect) {
      continue;
    }
    if (rect.bottom > containerTop + 1) {
      return i;
    }
  }
  return 0;
}

defineExpose({ scrollToRatio, getScrollRatio, pageDown, pageUp, getFirstVisibleParaIndex });
</script>

<template>
  <div
    ref="scrollRef"
    class="scroll-mode app-scrollbar app-scrollbar--thin app-scrollbar--reader"
    @scroll.passive="onScroll"
    @click="onClick"
    @mousedown="onMouseDown"
    @wheel="onWheel"
    @touchstart.passive="onTouchStart"
    @touchmove.passive="onTouchMove"
    @touchend.passive="onTouchEnd"
    @touchcancel.passive="onTouchCancel"
  >
    <div class="scroll-mode__body" :class="{ 'scroll-mode__body--layout-debug': layoutDebug }">
      <!-- 章节名标题 -->
      <p v-if="chapterTitle" class="reader-chapter-title">{{ chapterTitle }}</p>

      <p
        v-for="(para, i) in paragraphs"
        :key="i"
        class="reader-para scroll-mode__para"
        :class="{ 'tts-playing': ttsHighlightIndex === i }"
        :style="{
          textIndent: `${textIndent}em`,
          marginBottom: `${paragraphSpacing}px`,
        }"
      >
        {{ para }}
      </p>
    </div>

    <div v-if="showAnyDebug" class="scroll-mode__debug">
      <template v-if="layoutDebug">
        <div class="scroll-mode__debug-pad scroll-mode__debug-pad--top" />
        <div class="scroll-mode__debug-pad scroll-mode__debug-pad--right" />
        <div class="scroll-mode__debug-pad scroll-mode__debug-pad--bottom" />
        <div class="scroll-mode__debug-pad scroll-mode__debug-pad--left" />
        <div class="scroll-mode__debug-content-box" />
      </template>
      <div v-if="tapZoneDebug" class="scroll-mode__debug-taps">
        <div
          class="scroll-mode__debug-tap scroll-mode__debug-tap--prev"
          :style="{ width: `${leftRatio * 100}%` }"
        />
        <div
          class="scroll-mode__debug-tap scroll-mode__debug-tap--center"
          :style="{ width: `${centerRatio * 100}%` }"
        />
        <div
          class="scroll-mode__debug-tap scroll-mode__debug-tap--next"
          :style="{ width: `${(1 - rightRatio) * 100}%` }"
        />
      </div>
    </div>

    <!-- 上拉气泡 + 边界提示（共享组件） -->
    <PullBubble
      :visible="atBottom"
      :bubble-bottom-px="bubbleBottomPx"
      :is-ready="isReady"
      :dismissing="dismissing"
      :has-next="!!hasNext"
      :boundary-msg="boundaryMsg"
      :pull-progress="pullProgress"
      :is-dragging="isDragging"
    />

    <!-- 下一章按钮（桌面端无触摸时显示） -->
    <Transition name="scroll-btn-fade">
      <button
        v-if="showNextBtn"
        class="scroll-mode__chapter-btn scroll-mode__chapter-btn--bottom"
        @click="emit('next-chapter')"
      >
        下一章 →
      </button>
    </Transition>
  </div>
</template>

<style scoped>
.scroll-mode {
  width: 100%;
  height: 100%;
  position: relative;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  scroll-behavior: smooth;
  touch-action: manipulation;
  /* 防止原生过度滚动（iOS 橡皮筋/Android 发光）与上拉气泡动效竞争 */
  overscroll-behavior-y: none;
}

.scroll-mode__body {
  padding: var(--reader-padding, 24px);
  min-height: 100%;
  -webkit-text-size-adjust: none;
  text-size-adjust: none;
}

/* 章节名标题样式已提取至全局 src/style.css `.reader-chapter-title` */

.scroll-mode__para {
  font-family: var(--reader-font-family);
  font-size: var(--reader-font-size);
  line-height: var(--reader-line-height);
  letter-spacing: var(--reader-letter-spacing);
  word-spacing: var(--reader-word-spacing);
  font-weight: var(--reader-font-weight);
  font-style: var(--reader-font-style);
  text-align: var(--reader-text-align);
  text-decoration: var(--reader-text-decoration);
  font-variant: var(--reader-font-variant);
  -webkit-text-stroke-width: var(--reader-text-stroke-width);
  -webkit-text-stroke-color: var(--reader-text-stroke-color);
  text-shadow: var(--reader-text-shadow);
  color: var(--reader-text-color);
  word-break: break-all;
  overflow-wrap: break-word;
  /* 允许浏览器合成粗体/斜体（解决中文字体无独立字重变体时加粗无效问题） */
  font-synthesis: weight style;
  /* 抗锯齿渲染优化（解决合成层中文字体锦齿丢失导致的锯齿感） */
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  -webkit-text-size-adjust: none;
  text-size-adjust: none;
}

/* TTS 高亮：使用主题选区色自动适配明暗主题 */
.scroll-mode__para.tts-playing {
  background-color: var(--reader-tts-hl-bg, rgba(99, 226, 183, 0.2));
  border-radius: 4px;
  /* 微内边距让高亮区域与文字有间距感 */
  padding-top: 2px;
  padding-bottom: 2px;
  margin-left: -4px;
  margin-right: -4px;
  padding-left: 4px;
  padding-right: 4px;
  transition: background-color 0.2s ease;
}

.scroll-mode__body--layout-debug .scroll-mode__para {
  position: relative;
  box-shadow: inset 0 0 0 1px rgba(14, 165, 233, 0.9);
  background: rgba(14, 165, 233, 0.05);
}

.scroll-mode__body--layout-debug .scroll-mode__para::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 100%;
  height: var(--reader-paragraph-spacing, 12px);
  background: rgba(244, 63, 94, 0.34);
  border-top: 1px dashed rgba(244, 63, 94, 0.95);
  pointer-events: none;
}

.scroll-mode__para:last-child {
  margin-bottom: 0 !important;
}

.scroll-mode__body--layout-debug .scroll-mode__para:last-child::after {
  display: none;
}

.scroll-mode ::selection {
  background-color: var(--reader-selection-color);
}

/* 章节切换按钮 */
.scroll-mode__chapter-btn {
  display: block;
  width: calc(100% - 48px);
  margin: 12px auto;
  padding: 12px 0;
  border: 1px solid rgba(128, 128, 128, 0.3);
  border-radius: 8px;
  background: transparent;
  color: var(--reader-text-color, inherit);
  font-size: 0.9rem;
  cursor: pointer;
  text-align: center;
  opacity: 0.7;
  transition: opacity 0.15s;
}

.scroll-mode__chapter-btn:hover {
  opacity: 1;
}

.scroll-mode__chapter-btn--top {
  margin-top: 8px;
  margin-bottom: 0;
}

.scroll-mode__chapter-btn--bottom {
  margin-top: 0;
  margin-bottom: 8px;
}

/* 按钮过渡动画 */
.scroll-btn-fade-enter-active,
.scroll-btn-fade-leave-active {
  transition: opacity 0.2s ease;
}
.scroll-btn-fade-enter-from,
.scroll-btn-fade-leave-to {
  opacity: 0;
}

.scroll-mode__debug {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
}

.scroll-mode__debug-pad {
  position: absolute;
}

.scroll-mode__debug-pad--top {
  left: 0;
  right: 0;
  top: 0;
  height: var(--reader-padding-top, 24px);
  background: rgba(239, 68, 68, 0.18);
}

.scroll-mode__debug-pad--right {
  top: var(--reader-padding-top, 24px);
  right: 0;
  bottom: var(--reader-padding-bottom, 24px);
  width: var(--reader-padding-right, 24px);
  background: rgba(245, 158, 11, 0.18);
}

.scroll-mode__debug-pad--bottom {
  left: 0;
  right: 0;
  bottom: 0;
  height: var(--reader-padding-bottom, 24px);
  background: rgba(168, 85, 247, 0.18);
}

.scroll-mode__debug-pad--left {
  top: var(--reader-padding-top, 24px);
  left: 0;
  bottom: var(--reader-padding-bottom, 24px);
  width: var(--reader-padding-left, 24px);
  background: rgba(59, 130, 246, 0.18);
}

.scroll-mode__debug-content-box,
.scroll-mode__debug-content-box {
  position: absolute;
  top: var(--reader-padding-top, 24px);
  right: var(--reader-padding-right, 24px);
  bottom: var(--reader-padding-bottom, 24px);
  left: var(--reader-padding-left, 24px);
}

.scroll-mode__debug-content-box {
  border: 1px dashed rgba(34, 197, 94, 0.95);
  background: rgba(34, 197, 94, 0.08);
}

.scroll-mode__debug-taps {
  position: absolute;
  inset: 0;
  display: flex;
}

.scroll-mode__debug-tap {
  height: 100%;
}

.scroll-mode__debug-tap--prev {
  background: rgba(59, 130, 246, 0.12);
}

.scroll-mode__debug-tap--center {
  background: rgba(16, 185, 129, 0.08);
}

.scroll-mode__debug-tap--next {
  background: rgba(249, 115, 22, 0.12);
}
</style>
