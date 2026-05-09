<script setup lang="ts">
/**
 * SlideMode — 平移翻页模式
 *
 * 渲染 3 页（上一页 | 当前页 | 下一页）水平拼接在一个 track 容器中，
 * 视口只显示一页宽度。track 的 translateX 控制可见区域。
 *
 * 基线位置：track translateX = -containerWidth（展示中间页）
 * 拖拽时：translateX = -containerWidth + dragDelta（跟随手指）
 * 松手后：根据速度/距离判断翻页或回弹
 *   - 翻页→下一页：动画滑到 -2*containerWidth
 *   - 翻页→上一页：动画滑到 0
 *   - 到位后：更新 currentPage，瞬间重置 track 回 -containerWidth
 *
 * 触发翻页条件：
 *   1. 快速滑动（速度 > 0.3 px/ms）
 *   2. 拖拽距离 > 30% 视口宽度
 *   3. 点击左侧 30% / 右侧 30%
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
  () => props.content,
  () => {
    pendingInitialPage = props.startFromEnd ? 'last' : 'first';
  },
);

watch(
  () => [props.content, props.typography, props.padding] as const,
  () => nextTick(doPaginate),
  { immediate: true, deep: true },
);

let resizeOb: ResizeObserver | null = null;
let resizeTimer = 0;
onMounted(() => {
  // 等待一帧确保容器布局完成再分页
  requestAnimationFrame(() => nextTick(doPaginate));
  if (containerRef.value) {
    resizeOb = new ResizeObserver(() => {
      // 去抖：避免过渡动画中多次触发
      cancelAnimationFrame(resizeTimer);
      resizeTimer = requestAnimationFrame(() => doPaginate());
    });
    resizeOb.observe(containerRef.value);
  }
});
onUnmounted(() => resizeOb?.disconnect());

/* ============================================================
   3 页内容（prev / current / next）
   ============================================================ */
const prevPageHTML = computed(() => pages.value[currentPage.value - 1] ?? '');
const currentPageHTML = computed(() => pages.value[currentPage.value] ?? '');
const nextPageHTML = computed(() => pages.value[currentPage.value + 1] ?? '');
const pageInfo = computed(() => `${currentPage.value + 1}/${totalPages.value}`);

/* ============================================================
   track 位置 & 动画
   ============================================================ */
/**
 * dragOffset: 拖拽产生的偏移量
 *   正值 = 右拖（看上一页），负值 = 左拖（看下一页）
 *
 * 基线 = -containerWidth（展示 track 里的第 2 个页面）
 * 实际 translateX = -containerWidth + dragOffset
 */
const dragOffset = ref(0);
const isSnapping = ref(false);
/** snap 动画的目标偏移（相对于基线） */
const snapTargetOffset = ref(0);

function getContainerWidth(): number {
  return containerRef.value?.clientWidth ?? window.innerWidth;
}

const trackTranslateX = computed(() => {
  const w = getContainerWidth();
  const base = -w;
  if (isSnapping.value) {
    return base + snapTargetOffset.value;
  }
  return base + dragOffset.value;
});

/* ============================================================
   手势处理
   ============================================================ */
let dragging = false;
let startX = 0;
let startY = 0;
let startTime = 0;
let hasMoved = false;
let directionLocked = false;
let isHorizontal = false;

const VELOCITY_THRESHOLD = 0.3; // px/ms
const DISTANCE_RATIO = 0.3; // 30% 视口宽

/** 翻章锁：发出翻章事件后到新内容到来之前阻止再次触发 */
let chapterChanging = false;
/**
 * 记录最近 touchstart 的时间戳。
 * 移动端在 touchend 后约 300~600ms 会生成合成 mousedown/mouseup，
 * 导致 onPointerDown/Up 被重复执行引发连续翻页。
 */
let lastTouchTime = 0;

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

function onPointerDown(e: MouseEvent | TouchEvent) {
  if (isSnapping.value) {
    return;
  }
  // 过滤移动端触摸后浏览器自动生成的合成 mousedown（ghost click 问题）
  const isTouch =
    'touches' in e || ('pointerType' in e && (e as PointerEvent).pointerType === 'touch');
  if (isTouch) {
    lastTouchTime = Date.now();
  } else if (Date.now() - lastTouchTime < 600) {
    return;
  }
  if (chapterChanging) {
    return;
  }
  dragging = true;
  hasMoved = false;
  directionLocked = false;
  isHorizontal = false;
  startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
  startY = 'touches' in e ? e.touches[0].clientY : e.clientY;
  startTime = Date.now();
  dragOffset.value = 0;
}

function onPointerMove(e: MouseEvent | TouchEvent) {
  if (!dragging) {
    return;
  }
  const x = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
  const y = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
  const dx = x - startX;
  const dy = y - startY;

  if (!directionLocked && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
    directionLocked = true;
    isHorizontal = Math.abs(dx) > Math.abs(dy);
  }
  if (!isHorizontal) {
    return;
  }

  if ('cancelable' in e && e.cancelable) {
    e.preventDefault();
  }
  hasMoved = true;

  const w = getContainerWidth();
  // 边界阻尼：首页右拉 / 末页左拉
  const atStart = currentPage.value === 0 && dx > 0;
  const atEnd = currentPage.value >= totalPages.value - 1 && dx < 0;
  if (atStart || atEnd) {
    dragOffset.value = dx * 0.2;
  } else {
    dragOffset.value = Math.max(-w, Math.min(w, dx));
  }
}

function onPointerUp(e: MouseEvent | TouchEvent) {
  if (!dragging) {
    return;
  }
  dragging = false;

  if (!hasMoved) {
    handleClick(e);
    return;
  }
  if (!isHorizontal) {
    dragOffset.value = 0;
    return;
  }

  const w = getContainerWidth();
  const dx = dragOffset.value;
  const dt = Date.now() - startTime;
  const velocity = Math.abs(dx) / Math.max(dt, 1);
  const shouldFlip = velocity > VELOCITY_THRESHOLD || Math.abs(dx) > w * DISTANCE_RATIO;

  if (shouldFlip && dx < 0) {
    // 左滑 → 下一页
    if (currentPage.value < totalPages.value - 1) {
      snapTo(-w, () => {
        nextPage();
        finishSnap();
      });
    } else if (props.hasNext) {
      chapterChanging = true;
      emit('next-chapter');
      snapTo(0, finishSnap);
    } else {
      showBoundary('已经到最后一页了');
      snapTo(0, finishSnap);
    }
  } else if (shouldFlip && dx > 0) {
    // 右滑 → 上一页
    if (currentPage.value > 0) {
      snapTo(w, () => {
        prevPage();
        finishSnap();
      });
    } else if (props.hasPrev) {
      chapterChanging = true;
      emit('prev-chapter');
      snapTo(0, finishSnap);
    } else {
      showBoundary('已经到最前了');
      snapTo(0, finishSnap);
    }
  } else {
    // 回弹
    snapTo(0, finishSnap);
  }
}

function handleClick(e: MouseEvent | TouchEvent) {
  const el = containerRef.value;
  if (!el) {
    return;
  }
  const rect = el.getBoundingClientRect();
  const cx = 'changedTouches' in e ? e.changedTouches[0].clientX : (e as MouseEvent).clientX;
  const relX = (cx - rect.left) / rect.width;

  const leftRatio = props.tapZoneLeft ?? 0.3;
  const rightRatio = props.tapZoneRight ?? 0.7;
  if (relX < leftRatio) {
    if (currentPage.value > 0) {
      snapTo(getContainerWidth(), () => {
        prevPage();
        finishSnap();
      });
    } else if (props.hasPrev) {
      chapterChanging = true;
      emit('prev-chapter');
    } else {
      showBoundary('已经到最前了');
    }
  } else if (relX > rightRatio) {
    if (currentPage.value < totalPages.value - 1) {
      snapTo(-getContainerWidth(), () => {
        nextPage();
        finishSnap();
      });
    } else if (props.hasNext) {
      chapterChanging = true;
      emit('next-chapter');
    } else {
      showBoundary('已经到最后一页了');
    }
  } else {
    emit('tap', 'center');
  }
}

/** 启动 snap 动画到 targetOffset */
function snapTo(targetOffset: number, onDone: () => void) {
  snapTargetOffset.value = targetOffset;
  isSnapping.value = true;
  setTimeout(onDone, 260);
}

/** snap 结束，瞬间重置 track 到基线 */
function finishSnap() {
  isSnapping.value = false;
  dragOffset.value = 0;
  snapTargetOffset.value = 0;
}

// 内容变化时解除翻章锁
watch(
  () => props.content,
  () => {
    chapterChanging = false;
  },
);

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
  /**
   * 尝试页内翻到下一页。
   * @returns true 表示页内翻页成功；false 表示已到末页，由父组件处理连章逻辑
   */
  flipNext(): boolean {
    if (isSnapping.value) {
      return false;
    } // 动画进行中，拒绝新翻页，防止双重触发
    if (currentPage.value < totalPages.value - 1) {
      snapTo(-getContainerWidth(), () => {
        nextPage();
        finishSnap();
      });
      return true;
    }
    return false;
  },
  /**
   * 尝试页内翻到上一页。
   * @returns true 表示页内翻页成功；false 表示已到首页，由父组件处理连章逻辑
   */
  flipPrev(): boolean {
    if (isSnapping.value) {
      return false;
    } // 动画进行中，拒绝新翻页，防止双重触发
    if (currentPage.value > 0) {
      snapTo(getContainerWidth(), () => {
        prevPage();
        finishSnap();
      });
      return true;
    }
    return false;
  },
  get currentPage() {
    return currentPage.value;
  },
  get totalPages() {
    return totalPages.value;
  },
});
</script>

<template>
  <div ref="containerRef" class="slide-mode">
    <!-- 手势捕获层：置于所有内容层之上，避免翻页时 DOM 重建导致触摸序列中断 -->
    <div
      class="slide-mode__gesture"
      @mousedown.prevent="onPointerDown"
      @mousemove="onPointerMove"
      @mouseup="onPointerUp"
      @mouseleave="onPointerUp"
      @touchstart.passive="onPointerDown"
      @touchmove="onPointerMove"
      @touchend="onPointerUp"
      @touchcancel="onPointerUp"
    />

    <!-- 3 页水平拼接 track -->
    <div
      class="slide-mode__track"
      :class="{ 'slide-mode__track--snapping': isSnapping }"
      :style="{ transform: `translateX(${trackTranslateX}px)` }"
    >
      <div class="slide-mode__page" v-html="prevPageHTML" />
      <div class="slide-mode__page" v-html="currentPageHTML" />
      <div class="slide-mode__page" v-html="nextPageHTML" />
    </div>

    <!-- 底部页码 -->
    <div class="slide-mode__footer">
      <span class="slide-mode__page-info">{{ pageInfo }}</span>
    </div>

    <!-- 边界提示 Toast -->
    <Transition name="boundary-toast">
      <div v-if="boundaryMsg" class="boundary-toast">{{ boundaryMsg }}</div>
    </Transition>
  </div>
</template>

<style scoped>
.slide-mode {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  user-select: none;
  touch-action: pan-y;
  cursor: default;
}

/* 手势捕获层：透明，覆盖所有内容层，防止 v-html 重建中断触摸序列 */
.slide-mode__gesture {
  position: absolute;
  inset: 0;
  z-index: 5;
}

/* 水平条带：总宽 = 3 × 视口宽 */
.slide-mode__track {
  display: flex;
  width: 300%;
  height: 100%;
  will-change: transform;
}
.slide-mode__track--snapping {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

/* 每页占 track 的 1/3 = 视口宽 */
.slide-mode__page {
  width: calc(100% / 3);
  height: 100%;
  flex-shrink: 0;
  box-sizing: border-box;
  padding: var(--reader-padding, 24px);
  overflow: hidden;
}

/* 排版样式从 CSS 变量继承 */
.slide-mode__page :deep(p) {
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

.slide-mode ::selection {
  background-color: var(--reader-selection-color);
}

.slide-mode__footer {
  position: absolute;
  bottom: 4px;
  left: 0;
  right: 0;
  text-align: center;
  pointer-events: none;
}

.slide-mode__page-info {
  font-size: 0.6875rem;
  opacity: 0.35;
  color: var(--reader-text-color);
}
</style>
