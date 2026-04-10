<script setup lang="ts">
/**
 * SimulationMode — 仿真翻页模式
 *
 * 模拟真实书页翻转效果：页面从右侧卷起翻向左侧。
 * 双层结构（同 CoverMode）+ CSS 3D rotateY 实现卷页视觉：
 *
 *   bg（底层）— 静止不动，展示"目标页"
 *   fg（顶层）— 绕左边缘旋转，从 0° 翻转到 -180°
 *
 * 向左翻（下一页）：fg = 当前页，从 0° 旋转到 -180°；bg = 下一页
 * 向右翻（上一页）：fg = 上一页，从 -180° 旋转回 0°；bg = 当前页
 *
 * 拖拽时角度 = dragOffset / containerWidth * 180
 */
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { usePagination } from '../composables/usePagination'
import type { ReaderTypography } from '../types'

const props = defineProps<{
  content: string
  chapterTitle?: string
  typography: ReaderTypography
  padding: number
  startFromEnd?: boolean
  hasPrev?: boolean
  hasNext?: boolean
  /** 点击左区占比 0-1 */
  tapZoneLeft?: number
  /** 点击右区开始占比 0-1 */
  tapZoneRight?: number
}>()

const emit = defineEmits<{
  (e: 'tap', zone: 'left' | 'center' | 'right'): void
  (e: 'prev-chapter'): void
  (e: 'next-chapter'): void
  (e: 'progress', ratio: number): void
}>()

type DragDir = 'left' | 'right' | null

/* ============================================================
   分页引擎
   ============================================================ */
const { pages, currentPage, totalPages, paginate, nextPage, prevPage, goToPage } = usePagination()

const containerRef = ref<HTMLElement | null>(null)

// 仅在内容变化时应用 startFromEnd，避免 resize/排版调整时误跳末页
let pendingInitialPage: 'first' | 'last' = props.startFromEnd ? 'last' : 'first'

function makeTitleHtml(title: string): string {
  return `<p class="reader-chapter-title">${title}</p>`
}

async function doPaginate() {
  const el = containerRef.value
  if (!el || !props.content) return
  const ip = pendingInitialPage
  pendingInitialPage = 'first'
  const prefix = props.chapterTitle ? makeTitleHtml(props.chapterTitle) : ''
  await paginate(props.content, el, props.typography, props.padding, ip, prefix)
}

watch(
  () => props.content,
  () => { pendingInitialPage = props.startFromEnd ? 'last' : 'first' },
)

watch(
  () => [props.content, props.typography, props.padding] as const,
  () => nextTick(doPaginate),
  { immediate: true, deep: true },
)

let resizeOb: ResizeObserver | null = null
let resizeTimer = 0
onMounted(() => {
  requestAnimationFrame(() => nextTick(doPaginate))
  if (containerRef.value) {
    resizeOb = new ResizeObserver(() => {
      cancelAnimationFrame(resizeTimer)
      resizeTimer = requestAnimationFrame(() => doPaginate())
    })
    resizeOb.observe(containerRef.value)
  }
})
onUnmounted(() => resizeOb?.disconnect())

/* ============================================================
   页面内容
   ============================================================ */
const prevPageHTML = computed(() => pages.value[currentPage.value - 1] ?? '')
const currentPageHTML = computed(() => pages.value[currentPage.value] ?? '')
const nextPageHTML = computed(() => pages.value[currentPage.value + 1] ?? '')
const pageInfo = computed(() => `${currentPage.value + 1}/${totalPages.value}`)

/* ============================================================
   拖拽 & 动画状态
   ============================================================ */
const dragOffset = ref(0)
const isSnapping = ref(false)
const snapTarget = ref(0)
const dragDir = ref<DragDir>(null)

function getW(): number {
  return containerRef.value?.clientWidth ?? window.innerWidth
}

/**
 * fg 层内容：
 *   向右翻（上一页进入）→ fg = 上一页
 *   其他               → fg = 当前页
 */
const fgHTML = computed(() =>
  dragDir.value === 'right' ? prevPageHTML.value : currentPageHTML.value,
)

/**
 * fg 层旋转角度（deg）：
 *   向左翻：0° → -180°（当前页翻走）
 *   向右翻：-180° → 0°（上一页翻回来）
 *
 * base = 'right' ? -180 : 0
 * angle = base + offset / W * 180
 */
const fgRotateY = computed<number>(() => {
  const w = getW()
  const base = dragDir.value === 'right' ? -180 : 0
  const offset = isSnapping.value ? snapTarget.value : dragOffset.value
  const angleDelta = w > 0 ? (offset / w) * 180 : 0
  return base + angleDelta
})

/**
 * 折痕阴影强度 0-1，卷曲到 90° 时最强
 */
const shadowOpacity = computed<number>(() => {
  const angle = Math.abs(fgRotateY.value % 180)
  return Math.sin((angle / 180) * Math.PI) * 0.4
})

/**
 * bg 层内容：
 *   向右翻 → 当前页
 *   其他   → 下一页
 */
const bgHTML = computed(() =>
  dragDir.value === 'right' ? currentPageHTML.value : nextPageHTML.value,
)

/* ============================================================
   手势处理
   ============================================================ */
let dragging = false
let startX = 0, startY = 0, startTime = 0
let hasMoved = false, dirLocked = false, isHorizontal = false

const VELOCITY_THRESHOLD = 0.3
const DISTANCE_RATIO = 0.30

/* ── 边界提示 ── */
const boundaryMsg = ref('')
let boundaryTimer = 0
function showBoundary(msg: string) {
  boundaryMsg.value = msg
  clearTimeout(boundaryTimer)
  boundaryTimer = window.setTimeout(() => { boundaryMsg.value = '' }, 1500)
}

function onPointerDown(e: MouseEvent | TouchEvent) {
  if (isSnapping.value) return
  dragging = true
  hasMoved = false
  dirLocked = false
  isHorizontal = false
  startX = 'touches' in e ? e.touches[0].clientX : e.clientX
  startY = 'touches' in e ? e.touches[0].clientY : e.clientY
  startTime = Date.now()
  dragOffset.value = 0
  dragDir.value = null
}

function onPointerMove(e: MouseEvent | TouchEvent) {
  if (!dragging) return
  const x = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX
  const y = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY
  const dx = x - startX
  const dy = y - startY

  if (!dirLocked && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
    dirLocked = true
    isHorizontal = Math.abs(dx) > Math.abs(dy)
    if (isHorizontal) dragDir.value = dx < 0 ? 'left' : 'right'
  }
  if (!isHorizontal) return
  if ('cancelable' in e && e.cancelable) e.preventDefault()

  hasMoved = true
  const w = getW()
  const atStart = currentPage.value === 0 && dx > 0
  const atEnd = currentPage.value >= totalPages.value - 1 && dx < 0
  dragOffset.value = (atStart || atEnd)
    ? dx * 0.2
    : Math.max(-w, Math.min(w, dx))
}

function onPointerUp(e: MouseEvent | TouchEvent) {
  if (!dragging) return
  dragging = false

  if (!hasMoved) {
    dragDir.value = null
    handleClick(e)
    return
  }
  if (!isHorizontal) {
    dragOffset.value = 0
    dragDir.value = null
    return
  }

  const w = getW()
  const dx = dragOffset.value
  const dt = Date.now() - startTime
  const velocity = Math.abs(dx) / Math.max(dt, 1)
  const shouldFlip = velocity > VELOCITY_THRESHOLD || Math.abs(dx) > w * DISTANCE_RATIO

  if (shouldFlip && dx < 0) {
    if (currentPage.value < totalPages.value - 1) {
      snapTo(-w, () => { nextPage(); finishSnap() })
    } else if (props.hasNext) {
      emit('next-chapter')
      snapTo(-w, finishSnap)
    } else {
      showBoundary('已经到最后一页了')
      snapTo(0, finishSnap)
    }
  } else if (shouldFlip && dx > 0) {
    if (currentPage.value > 0) {
      snapTo(w, () => { prevPage(); finishSnap() })
    } else if (props.hasPrev) {
      emit('prev-chapter')
      snapTo(w, finishSnap)
    } else {
      showBoundary('已经到最前了')
      snapTo(0, finishSnap)
    }
  } else {
    snapTo(0, finishSnap)
  }
}

async function handleClick(e: MouseEvent | TouchEvent) {
  const el = containerRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const cx = 'changedTouches' in e ? e.changedTouches[0].clientX : (e as MouseEvent).clientX
  const relX = (cx - rect.left) / rect.width

  const leftRatio = props.tapZoneLeft ?? 0.3
  const rightRatio = props.tapZoneRight ?? 0.7
  if (relX < leftRatio) {
    if (currentPage.value > 0) {
      await flipPrev()
    } else if (props.hasPrev) {
      emit('prev-chapter')
    } else {
      showBoundary('已经到最前了')
    }
  } else if (relX > rightRatio) {
    if (currentPage.value < totalPages.value - 1) {
      await flipNext()
    } else if (props.hasNext) {
      emit('next-chapter')
    } else {
      showBoundary('已经到最后一页了')
    }
  } else {
    emit('tap', 'center')
  }
}

/** 点击翻下一页：当前页从 0° 旋转到 -180° */
async function flipNext() {
  dragDir.value = 'left'
  await nextTick()
  containerRef.value?.offsetHeight
  snapTo(-getW(), () => { nextPage(); finishSnap() })
}

/** 点击翻上一页：上一页从 -180° 旋转回 0° */
async function flipPrev() {
  dragDir.value = 'right'
  await nextTick()
  containerRef.value?.offsetHeight
  snapTo(getW(), () => { prevPage(); finishSnap() })
}

function snapTo(target: number, onDone: () => void) {
  snapTarget.value = target
  isSnapping.value = true
  setTimeout(onDone, 360)
}

function finishSnap() {
  isSnapping.value = false
  dragOffset.value = 0
  snapTarget.value = 0
  dragDir.value = null
}

watch(currentPage, (p) => {
  const ratio = totalPages.value <= 1 ? 1 : p / (totalPages.value - 1)
  emit('progress', Math.min(1, Math.max(0, ratio)))
})

defineExpose({
  goToPage,
  nextPage,
  prevPage,
  goToFirst: () => goToPage(0),
  goToLast: () => goToPage(totalPages.value - 1),
  get currentPage() { return currentPage.value },
  get totalPages() { return totalPages.value },
})
</script>

<template>
  <div
    ref="containerRef"
    class="sim-mode"
  >
    <!-- 手势捕获层：置于所有内容层之上，避免 fg/bg DOM 重建导致触摸序列中断 -->
    <div
      class="sim-mode__gesture"
      @mousedown.prevent="onPointerDown"
      @mousemove="onPointerMove"
      @mouseup="onPointerUp"
      @mouseleave="onPointerUp"
      @touchstart.passive="onPointerDown"
      @touchmove="onPointerMove"
      @touchend="onPointerUp"
      @touchcancel="onPointerUp"
    />

    <!-- 底层：目标页，静止 -->
    <div class="sim-mode__page sim-mode__bg" v-html="bgHTML" />

    <!-- 顶层：卷曲页 -->
    <div
      class="sim-mode__page sim-mode__fg"
      :class="{ 'sim-mode__fg--snapping': isSnapping }"
      :style="{ transform: `rotateY(${fgRotateY}deg)` }"
      v-html="fgHTML"
    />

    <!-- 折痕阴影 -->
    <div
      class="sim-mode__shadow"
      :class="{ 'sim-mode__shadow--snapping': isSnapping }"
      :style="{ opacity: shadowOpacity }"
    />

    <!-- 底部页码 -->
    <div class="sim-mode__footer">
      <span class="sim-mode__page-info">{{ pageInfo }}</span>
    </div>

    <!-- 边界提示 Toast -->
    <Transition name="boundary-toast">
      <div v-if="boundaryMsg" class="boundary-toast">{{ boundaryMsg }}</div>
    </Transition>
  </div>
</template>

<style scoped>
.sim-mode {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  user-select: none;
  touch-action: pan-y;
  cursor: default;
  /* 3D 透视容器 */
  perspective: 1500px;
}

/* 手势捕获层：透明，覆盖所有内容层，防止 v-html 重建中断触摸序列 */
.sim-mode__gesture {
  position: absolute;
  inset: 0;
  z-index: 10;
}

/* 两层页面绝对铺满 */
.sim-mode__page {
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  padding: var(--reader-padding, 24px);
  overflow: hidden;
  background: var(--reader-bg-image, none), var(--reader-bg-color, var(--color-surface));
}

.sim-mode__bg {
  z-index: 0;
}

.sim-mode__fg {
  z-index: 1;
  will-change: transform;
  /* 沿左边缘旋转，模拟书脊翻页 */
  transform-origin: left center;
  /* 隐藏背面，翻转超过 90° 后不可见 */
  backface-visibility: hidden;
}

/* 仅在 snap 动画期间启用 transition */
.sim-mode__fg--snapping {
  transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}

/* 折痕阴影：投射在底层页面上，模拟卷曲阴影 */
.sim-mode__shadow {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background: linear-gradient(
    to right,
    rgba(0, 0, 0, 0.25) 0%,
    rgba(0, 0, 0, 0.08) 8%,
    transparent 20%
  );
  opacity: 0;
}

.sim-mode__shadow--snapping {
  transition: opacity 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}

/* 排版样式从 CSS 变量继承 */
.sim-mode__page :deep(p) {
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
  text-transform: var(--reader-text-transform);
  font-variant: var(--reader-font-variant);
  writing-mode: var(--reader-writing-mode);
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

.sim-mode ::selection {
  background-color: var(--reader-selection-color);
}

.sim-mode__footer {
  position: absolute;
  bottom: 4px;
  left: 0;
  right: 0;
  text-align: center;
  pointer-events: none;
  z-index: 3;
}

.sim-mode__page-info {
  font-size: 0.6875rem;
  opacity: 0.35;
  color: var(--reader-text-color);
}
</style>
