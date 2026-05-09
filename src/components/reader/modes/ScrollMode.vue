<script setup lang="ts">
/**
 * ScrollMode — 无缝滚动翻页模式
 *
 * 将当前章节与下一章节内联渲染，用户无需手动点击「下一章」——
 * 滚动至下一章区域时自动触发 next-chapter-entered 事件通知父组件切换章节元数据。
 * 无下一章时在底部显示章节结束画面。
 */
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps<{
  content: string;
  chapterTitle?: string;
  /** 预加载的上一章正文（空字符串表示尚未加载或不存在） */
  prevChapterContent?: string;
  /** 预加载的上一章章节名 */
  prevChapterTitle?: string;
  /** 预加载的下一章正文（空字符串表示尚未加载或不存在） */
  nextChapterContent?: string;
  /** 预加载的下一章章节名 */
  nextChapterTitle?: string;
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
  /** 用户向上滚动进入上一章区域（无缝向前翻章） */
  (e: 'prev-chapter-entered'): void;
  /** 用户向下滚动进入下一章区域，携带当前章节内容区高度（用于无缝滚动位置补偿） */
  (e: 'next-chapter-entered', sectionHeight: number): void;
}>();

const scrollRef = ref<HTMLElement | null>(null);
const prevSectionRef = ref<HTMLElement | null>(null);
const currentSectionRef = ref<HTMLElement | null>(null);
const nextChapterSentinelRef = ref<HTMLElement | null>(null);

const paragraphs = ref<string[]>([]);
const prevParagraphs = ref<string[]>([]);
const nextParagraphs = ref<string[]>([]);

/** 是否已滚动到底部附近 */
const atBottom = ref(false);
/** 是否已滚动到顶部 */
const atTop = ref(true);

// ── 无缝切章：记录待补偿的滚动偏移（-1 表示普通翻章，需重置滚动） ─────
let seamlessSwapOffset = -1;
/** 向上无缝翻章标志：不重置 scrollTop */
let isBackwardSeamless = false;
/** 上一章进入事件是否已触发（每次 prevContent 变化后重置） */
let prevChapterEnteredFired = false;

/**
 * 父组件在更新 content prop 之前调用此方法，传入当前章节内容区高度。
 * ScrollMode 的 content watcher 检测到此值 >= 0 时，
 * 会在 DOM 更新后将 scrollTop 减去该高度，实现无缝衔接。
 */
function prepareSeamlessSwap(prevSectionHeight: number) {
  seamlessSwapOffset = prevSectionHeight;
}

/**
 * 向上无缝翻章：父组件更新 content prop 之前调用。
 * 标记本次内容切换为向上翻章，内容 watcher 将保留当前 scrollTop 不变，
 * 因为旧上一章内容（新 content）在 DOM 中位置未移动。
 */
function prepareSeamlessSwapBack() {
  isBackwardSeamless = true;
}

// ── 哨兵观察器：检测用户何时滚动进入下一章区域 ──────────────────────
let sentinelObserver: IntersectionObserver | null = null;

function teardownSentinel() {
  sentinelObserver?.disconnect();
  sentinelObserver = null;
}

function setupSentinel() {
  teardownSentinel();
  const el = nextChapterSentinelRef.value;
  const root = scrollRef.value;
  if (!el || !root) {
    return;
  }
  sentinelObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          teardownSentinel();
          const sectionH = currentSectionRef.value?.offsetHeight ?? 0;
          emit('next-chapter-entered', sectionH);
        }
      }
    },
    {
      root,
      // 哨兵进入视口上半部分时触发（给父组件留出预加载时间）
      rootMargin: '0px 0px -40% 0px',
    },
  );
  sentinelObserver.observe(el);
}

// ── 内容变化处理 ────────────────────────────────────────────────────
watch(
  () => props.content,
  async (val) => {
    paragraphs.value = val.split(/\n+/).filter((p) => p.trim());
    atBottom.value = false;
    atTop.value = true;
    prevChapterEnteredFired = false;

    if (seamlessSwapOffset >= 0) {
      // 向下无缝翻章：调整 scrollTop 使画面位置不变
      const offset = seamlessSwapOffset;
      seamlessSwapOffset = -1;
      await nextTick();
      const el = scrollRef.value;
      if (el) {
        el.style.scrollBehavior = 'auto';
        el.scrollTop = Math.max(0, el.scrollTop - offset);
        requestAnimationFrame(() => {
          el.style.scrollBehavior = '';
        });
      }
      return;
    }

    if (isBackwardSeamless) {
      // 向上无缝翻章：旧上一章内容现在是 content，在 DOM 中位置不变，
      // scrollTop 无需调整，直接保持当前值即可。
      isBackwardSeamless = false;
      return;
    }

    // 普通翻章：滚到当前章节起始位置（跳过上方预渲染的上一章区域）
    seamlessSwapOffset = -1;
    await nextTick();
    const el = scrollRef.value;
    if (!el) {
      return;
    }
    el.style.scrollBehavior = 'auto';
    el.scrollTop = prevSectionRef.value?.offsetHeight ?? 0;
    requestAnimationFrame(() => {
      el.style.scrollBehavior = '';
    });
  },
  { immediate: true },
);

// ── 下一章内容变化 ──────────────────────────────────────────────────
watch(
  () => props.nextChapterContent,
  async (val) => {
    nextParagraphs.value = val ? val.split(/\n+/).filter((p) => p.trim()) : [];
    teardownSentinel();
    if (val) {
      await nextTick();
      setupSentinel();
    }
  },
  { immediate: true },
);

// ── 上一章内容变化 ──────────────────────────────────────────────────
watch(
  () => props.prevChapterContent,
  async (val, oldVal) => {
    const wasEmpty = !oldVal;
    const isNowFilled = !!val;
    prevParagraphs.value = val ? val.split(/\n+/).filter((p) => p.trim()) : [];
    prevChapterEnteredFired = false;

    if (wasEmpty && isNowFilled) {
      // 上一章内容被插入到 DOM 顶部，需手动补偿 scrollTop
      // （已通过 overflow-anchor:none 禁用浏览器自动锚定）
      const el = scrollRef.value;
      const savedTop = el?.scrollTop ?? 0;
      await nextTick();
      const prevH = prevSectionRef.value?.offsetHeight ?? 0;
      if (prevH > 0 && el) {
        el.style.scrollBehavior = 'auto';
        el.scrollTop = savedTop + prevH;
        requestAnimationFrame(() => {
          el.style.scrollBehavior = '';
        });
      }
    }
  },
  { immediate: true },
);

onMounted(() => {
  if (props.nextChapterContent) {
    setupSentinel();
  }
});

onBeforeUnmount(() => {
  teardownSentinel();
});

// ── 触摸事件 ────────────────────────────────────────────────────────
let touchStartX = 0;
let touchStartY = 0;
let suppressNextClick = false;

function onTouchStart(e: TouchEvent) {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}

function onTouchEnd(e: TouchEvent) {
  if (e.changedTouches.length === 1) {
    const t = e.changedTouches[0];
    const dx = Math.abs(t.clientX - touchStartX);
    const dy = Math.abs(t.clientY - touchStartY);
    const selection = window.getSelection();
    const hasSelection = !!selection && !selection.isCollapsed && !!selection.toString().trim();
    if (dx < 15 && dy < 15 && !hasSelection) {
      suppressNextClick = true;
      emit('tap', 'center');
    }
  }
}

// ── 滚动事件 ────────────────────────────────────────────────────────
function onScroll() {
  const el = scrollRef.value;
  if (!el) {
    return;
  }
  const { scrollTop, scrollHeight, clientHeight } = el;
  const prevH = prevSectionRef.value?.offsetHeight ?? 0;

  // 进度按当前章节区域计算（不含上/下章预渲染部分）
  const currentSectionH = currentSectionRef.value?.offsetHeight ?? Math.max(0, scrollHeight - prevH);
  const adjustedScrollTop = Math.max(0, scrollTop - prevH);
  const ratio =
    currentSectionH <= clientHeight
      ? 1
      : Math.min(1, Math.max(0, adjustedScrollTop / (currentSectionH - clientHeight)));
  emit('progress', ratio);

  const prevAtTop = atTop.value;
  const prevAtBottom = atBottom.value;
  atTop.value = scrollTop <= 0;
  atBottom.value = scrollTop + clientHeight >= scrollHeight - 8;

  if (!prevAtTop && atTop.value) {
    emit('reachStart');
  }
  if (!prevAtBottom && atBottom.value) {
    emit('reachEnd');
  }

  // 检测向上进入上一章：滚到上一章区域前 60% 时触发一次
  if (!prevChapterEnteredFired && prevH > 0 && hasPrevChapterContent.value) {
    if (scrollTop <= prevH * 0.6) {
      prevChapterEnteredFired = true;
      emit('prev-chapter-entered');
    }
  }
}

// ── 点击 ────────────────────────────────────────────────────────────
function onClick(_e: MouseEvent) {
  const selection = window.getSelection();
  if (selection && !selection.isCollapsed && selection.toString().trim()) {
    return;
  }
  if (suppressNextClick) {
    suppressNextClick = false;
    return;
  }
  emit('tap', 'center');
}

// ── 公开方法 ─────────────────────────────────────────────────────────
function scrollToRatio(ratio: number) {
  const el = scrollRef.value;
  if (!el) {
    return;
  }
  const prevH = prevSectionRef.value?.offsetHeight ?? 0;
  const currentH = currentSectionRef.value?.offsetHeight ?? Math.max(0, el.scrollHeight - prevH);
  const max = Math.max(0, currentH - el.clientHeight);
  el.style.scrollBehavior = 'auto';
  el.scrollTop = prevH + max * Math.min(1, Math.max(0, ratio));
  requestAnimationFrame(() => {
    el.style.scrollBehavior = '';
  });
}

function getScrollRatio(): number {
  const el = scrollRef.value;
  if (!el) {
    return -1;
  }
  const prevH = prevSectionRef.value?.offsetHeight ?? 0;
  const currentH = currentSectionRef.value?.offsetHeight ?? Math.max(0, el.scrollHeight - prevH);
  const adjustedScrollTop = Math.max(0, el.scrollTop - prevH);
  const max = Math.max(0, currentH - el.clientHeight);
  return max <= 0 ? 1 : Math.min(1, Math.max(0, adjustedScrollTop / max));
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

// ── Debug 辅助 ───────────────────────────────────────────────────────
const leftRatio = computed(() => props.tapZoneLeft ?? 0.3);
const rightRatio = computed(() => props.tapZoneRight ?? 0.7);
const centerRatio = computed(() => Math.max(0, rightRatio.value - leftRatio.value));
const showAnyDebug = computed(() => !!props.layoutDebug || !!props.tapZoneDebug);

// ── 章节边界条件 ─────────────────────────────────────────────────────
const hasPrevChapterContent = computed(() => !!props.prevChapterContent);
const hasNextChapterContent = computed(() => !!props.nextChapterContent);
/** 无下一章且无预加载内容时显示结束画面 */
const showEndScreen = computed(() => !props.hasNext && !hasNextChapterContent.value);

defineExpose({
  scrollToRatio,
  getScrollRatio,
  pageDown,
  pageUp,
  getFirstVisibleParaIndex,
  prepareSeamlessSwap,
  prepareSeamlessSwapBack,
});
</script>

<template>
  <div
    ref="scrollRef"
    class="scroll-mode app-scrollbar app-scrollbar--thin app-scrollbar--reader"
    @scroll.passive="onScroll"
    @click="onClick"
    @touchstart.passive="onTouchStart"
    @touchend.passive="onTouchEnd"
  >
    <!-- ── 上一章节内容区（顶部预渲染，无缝向上翻章） ── -->
    <template v-if="hasPrevChapterContent">
      <div
        ref="prevSectionRef"
        class="scroll-mode__body scroll-mode__body--prev"
        :class="{ 'scroll-mode__body--layout-debug': layoutDebug }"
      >
        <p v-if="prevChapterTitle" class="reader-chapter-title">{{ prevChapterTitle }}</p>
        <p
          v-for="(para, i) in prevParagraphs"
          :key="`prev-${i}`"
          class="reader-para scroll-mode__para"
          :style="{
            textIndent: `${textIndent}em`,
            marginBottom: `${paragraphSpacing}px`,
          }"
        >
          {{ para }}
        </p>
      </div>
      <!-- 章节分隔线（上一章 → 当前章） -->
      <div class="scroll-mode__chapter-sep">
        <div class="scroll-mode__chapter-sep-line" />
        <p class="scroll-mode__chapter-sep-title reader-chapter-title">
          {{ chapterTitle || '当前章节' }}
        </p>
      </div>
    </template>

    <!-- ── 当前章节内容区 ── -->
    <div
      ref="currentSectionRef"
      class="scroll-mode__body"
      :class="{ 'scroll-mode__body--layout-debug': layoutDebug }"
    >
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

    <!-- ── 下一章区域（预渲染，无缝拼接） ── -->
    <template v-if="hasNextChapterContent">
      <!-- 章节分隔 + 标题 -->
      <div class="scroll-mode__chapter-sep">
        <div class="scroll-mode__chapter-sep-line" />
        <p class="scroll-mode__chapter-sep-title reader-chapter-title">
          {{ nextChapterTitle || '下一章' }}
        </p>
      </div>

      <!-- 哨兵元素：进入视口时触发章节切换 -->
      <div ref="nextChapterSentinelRef" class="scroll-mode__sentinel" aria-hidden="true" />

      <!-- 下一章正文 -->
      <div
        class="scroll-mode__body scroll-mode__body--next"
        :class="{ 'scroll-mode__body--layout-debug': layoutDebug }"
      >
        <p
          v-for="(para, i) in nextParagraphs"
          :key="i"
          class="reader-para scroll-mode__para"
          :style="{
            textIndent: `${textIndent}em`,
            marginBottom: `${paragraphSpacing}px`,
          }"
        >
          {{ para }}
        </p>
      </div>
    </template>

    <!-- ── 结束画面（无下一章） ── -->
    <div v-if="showEndScreen" class="chapter-end-screen">
      <div class="chapter-end-screen__icon">📖</div>
      <p class="chapter-end-screen__title">已读完最后一章</p>
      <p class="chapter-end-screen__sub">全书完，感谢阅读</p>
    </div>

    <!-- ── Debug 覆盖层 ── -->
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
  overscroll-behavior-y: contain;
  /* 禁用浏览器自动滚动锚定，改为手动精确补偿 */
  overflow-anchor: none;
}

.scroll-mode__body {
  padding: var(--reader-padding, 24px);
  -webkit-text-size-adjust: none;
  text-size-adjust: none;
}

/* 章节分隔线 + 下一章标题 */
.scroll-mode__chapter-sep {
  padding: 8px var(--reader-padding-left, 24px) 0;
}

.scroll-mode__chapter-sep-line {
  height: 1px;
  background: linear-gradient(
    to right,
    transparent,
    var(--reader-text-color, currentColor) 20%,
    var(--reader-text-color, currentColor) 80%,
    transparent
  );
  opacity: 0.15;
  margin-bottom: 16px;
}

/* 哨兵：零高度不可见元素 */
.scroll-mode__sentinel {
  height: 0;
  overflow: hidden;
  pointer-events: none;
}

/* 段落样式 */
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
  font-synthesis: weight style;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  -webkit-text-size-adjust: none;
  text-size-adjust: none;
}

.scroll-mode__para.tts-playing {
  background-color: var(--reader-tts-hl-bg, rgba(99, 226, 183, 0.2));
  border-radius: 4px;
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

/* Debug 覆盖层 */
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

.scroll-mode__debug-content-box {
  position: absolute;
  top: var(--reader-padding-top, 24px);
  right: var(--reader-padding-right, 24px);
  bottom: var(--reader-padding-bottom, 24px);
  left: var(--reader-padding-left, 24px);
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
  background: rgba(239, 68, 68, 0.12);
}
</style>
