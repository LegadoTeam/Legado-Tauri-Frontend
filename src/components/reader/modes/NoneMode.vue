<script setup lang="ts">
/**
 * NoneMode — 无动画翻页模式
 *
 * 专为电子墨水屏等低刷新率屏幕设计。
 * 无任何拖拽跟随、滑动动画效果，满足翻页条件时直接切换页面。
 *
 * 翻页触发：
 *   - 点击右侧 30% → 下一页
 *   - 点击左侧 30% → 上一页
 *   - 点击中间 40% → 切换菜单
 *   - 滑动距离 > 30% 视口宽 或 速度 > 0.3 px/ms → 翻页（无过渡）
 */
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import type { ReaderTypography } from '../types';
import { usePagination } from '../composables/usePagination';

const props = defineProps<{
  content: string;
  chapterTitle?: string;
  typography: ReaderTypography;
  padding: number;
  startFromEnd?: boolean;
  hasPrev?: boolean;
  hasNext?: boolean;
  /** 点击左区占比 0-1 */
  tapZoneLeft?: number;
  /** 点击右区开始占比 0-1 */
  tapZoneRight?: number;
}>();

const emit = defineEmits<{
  (e: 'tap', zone: 'left' | 'center' | 'right'): void;
  (e: 'prev-chapter'): void;
  (e: 'next-chapter'): void;
  (e: 'progress', ratio: number): void;
}>();

/* ============================================================
   分页引擎
   ============================================================ */
const { pages, currentPage, totalPages, paginate, nextPage, prevPage, goToPage } = usePagination();

const containerRef = ref<HTMLElement | null>(null);

// 仅在内容变化时应用 startFromEnd，避免 resize/排版调整时误跳末页
let pendingInitialPage: 'first' | 'last' = props.startFromEnd ? 'last' : 'first';

// 内容变化时根据 startFromEnd 重新设置初始页（修复切换上一章时总是显示第一页的问题）
watch(
  () => props.content,
  () => {
    pendingInitialPage = props.startFromEnd ? 'last' : 'first';
  },
);

function makeTitleHtml(title: string): string {
  return `<p class="reader-chapter-title">${title}</p>`;
}

async function doPaginate() {
  const el = containerRef.value;
  if (!el || !props.content) {
    return;
  }
  const ip = pendingInitialPage;
  pendingInitialPage = 'first';
  const prefix = props.chapterTitle ? makeTitleHtml(props.chapterTitle) : '';
  await paginate(props.content, el, props.typography, props.padding, ip, prefix);
}

watch(
  () => [props.content, props.typography, props.padding] as const,
  () => nextTick(doPaginate),
  { immediate: true, deep: true },
);

let resizeOb: ResizeObserver | null = null;
let resizeTimer = 0;
onMounted(() => {
  requestAnimationFrame(() => nextTick(doPaginate));
  if (containerRef.value) {
    resizeOb = new ResizeObserver(() => {
      cancelAnimationFrame(resizeTimer);
      resizeTimer = requestAnimationFrame(() => doPaginate());
    });
    resizeOb.observe(containerRef.value);
  }
});
onUnmounted(() => resizeOb?.disconnect());

/* ============================================================
   页面内容
   ============================================================ */
const currentPageHTML = computed(() => pages.value[currentPage.value] ?? '');
const pageInfo = computed(() => `${currentPage.value + 1}/${totalPages.value}`);

/* ============================================================
   手势处理 — 无拖拽跟随，仅判定结果
   ============================================================ */
let startX = 0;
let startY = 0;
let startTime = 0;
let hasMoved = false;

const VELOCITY_THRESHOLD = 0.3;
const DISTANCE_RATIO = 0.3;

/* ── 边界提示 ── */
const boundaryMsg = ref('');
let boundaryTimer = 0;
function showBoundary(msg: string) {
  boundaryMsg.value = msg;
  clearTimeout(boundaryTimer);
  boundaryTimer = window.setTimeout(() => {
    boundaryMsg.value = '';
  }, 1500);
}

function onPointerDown(e: PointerEvent) {
  startX = e.clientX;
  startY = e.clientY;
  startTime = Date.now();
  hasMoved = false;
}

function onPointerMove(e: PointerEvent) {
  if (Math.abs(e.clientX - startX) > 10 || Math.abs(e.clientY - startY) > 10) {
    hasMoved = true;
  }
}

function onPointerUp(e: PointerEvent) {
  if (!hasMoved) {
    return;
  } // 点击由 onClick 处理
  const el = containerRef.value;
  if (!el) {
    return;
  }

  const dx = e.clientX - startX;
  const dy = e.clientY - startY;
  const dt = Date.now() - startTime;
  const velocity = Math.abs(dx) / Math.max(dt, 1);
  const w = el.clientWidth;
  const shouldFlip = velocity > VELOCITY_THRESHOLD || Math.abs(dx) > w * DISTANCE_RATIO;

  if (shouldFlip && Math.abs(dx) > Math.abs(dy)) {
    if (dx < 0) {
      if (!nextPage()) {
        if (props.hasNext) {
          emit('next-chapter');
        } else {
          showBoundary('已经到最后一页了');
        }
      }
    } else {
      if (!prevPage()) {
        if (props.hasPrev) {
          emit('prev-chapter');
        } else {
          showBoundary('已经到最前了');
        }
      }
    }
  }
}

/** 点击判定 — 使用原生 click 事件确保可靠触发 */
function onClick(e: MouseEvent) {
  if (hasMoved) {
    return;
  } // 滑动由 onPointerUp 处理
  const el = containerRef.value;
  if (!el) {
    return;
  }

  const rect = el.getBoundingClientRect();
  const relX = (e.clientX - rect.left) / rect.width;

  const leftRatio = props.tapZoneLeft ?? 0.3;
  const rightRatio = props.tapZoneRight ?? 0.7;
  if (relX < leftRatio) {
    if (!prevPage()) {
      if (props.hasPrev) {
        emit('prev-chapter');
      } else {
        showBoundary('已经到最前了');
      }
    }
  } else if (relX > rightRatio) {
    if (!nextPage()) {
      if (props.hasNext) {
        emit('next-chapter');
      } else {
        showBoundary('已经到最后一页了');
      }
    }
  } else {
    emit('tap', 'center');
  }
}

// 进度上报
watch(currentPage, (p) => {
  const ratio = totalPages.value <= 1 ? 1 : p / (totalPages.value - 1);
  emit('progress', Math.min(1, Math.max(0, ratio)));
});

defineExpose({
  goToPage,
  nextPage,
  prevPage,
  goToFirst: () => goToPage(0),
  goToLast: () => goToPage(totalPages.value - 1),
  get currentPage() {
    return currentPage.value;
  },
  get totalPages() {
    return totalPages.value;
  },
});
</script>

<template>
  <div
    ref="containerRef"
    class="none-mode"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @click="onClick"
  >
    <!-- 单页展示，无动画 -->
    <div class="none-mode__page" v-html="currentPageHTML" />

    <!-- 底部页码 -->
    <div class="none-mode__footer">
      <span class="none-mode__page-info">{{ pageInfo }}</span>
    </div>

    <!-- 边界提示 Toast -->
    <Transition name="boundary-toast">
      <div v-if="boundaryMsg" class="boundary-toast">{{ boundaryMsg }}</div>
    </Transition>
  </div>
</template>

<style scoped>
.none-mode {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  user-select: none;
  touch-action: pan-y;
  cursor: default;
}

.none-mode__page {
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  padding: var(--reader-padding, 24px);
  overflow: hidden;
  background: var(--reader-bg-image, none), var(--reader-bg-color, var(--color-surface));
}

/* 排版样式从 CSS 变量继承 */
.none-mode__page :deep(p) {
  margin: 0;
  padding: 0;
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
}

.none-mode ::selection {
  background-color: var(--reader-selection-color);
}

.none-mode__footer {
  position: absolute;
  bottom: 4px;
  left: 0;
  right: 0;
  text-align: center;
  pointer-events: none;
  z-index: 2;
}

.none-mode__page-info {
  font-size: 0.6875rem;
  opacity: 0.35;
  color: var(--reader-text-color);
}
</style>
