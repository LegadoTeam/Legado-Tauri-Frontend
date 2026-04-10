<script setup lang="ts">
/**
 * CoverMode — 覆盖翻页模式
 *
 * 两层结构（独立绝对定位，互不依赖）：
 *   bg（底层 z=0）— 静止不动，始终展示"目标页"
 *   fg（顶层 z=1）— 移动层，滑走后露出底层
 *
 * 向左翻（下一页）：fg = 当前页，向左滑出；bg = 下一页，静止被揭开
 * 向右翻（上一页）：fg = 上一页，从左侧 -W 滑入覆盖；bg = 当前页，静止
 *
 * fg 位置公式：
 *   base = dragDir==='right' ? -W : 0
 *   isSnapping → fgX = base + snapTarget
 *   dragging   → fgX = base + dragOffset
 *
 * 触发翻页条件同 SlideMode：
 *   速度 > 0.3 px/ms  或  距离 > 30% 视口宽
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
/** snap 目标偏移（相对于 base） */
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
 * fg 层 translateX：
 *   base = 'right' ? -W : 0
 *   fgX  = base + (isSnapping ? snapTarget : dragOffset)
 */
const fgTranslateX = computed<number>(() => {
  const w = getW()
  const base = dragDir.value === 'right' ? -w : 0
  return base + (isSnapping.value ? snapTarget.value : dragOffset.value)
})

/**
 * bg 层内容：
 *   向右翻 → bg = 当前页（被上一页覆盖进来）
 *   其他   → bg = 下一页（被当前页滑走揭开）
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
    // 向左 → 下一页
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
    // 向右 → 上一页
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

/**
 * 点击翻页（含首帧定位 + 强制 reflow，确保 CSS transition 有明确起始位置）
 */
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

/**
 * 点击翻下一页：fg（当前页）从 0 向左滑出
 * 不需要预定位，直接从当前已展示的 translateX(0) 出发
 */
async function flipNext() {
  dragDir.value = 'left'
  await nextTick()
  // 强制浏览器提交样式，使 CSS transition 有起始帧
  containerRef.value?.offsetHeight
  snapTo(-getW(), () => { nextPage(); finishSnap() })
}

/**
 * 点击翻上一页：fg（上一页）从 -W 滑入覆盖
 * 需先将 fg 定位到 -W（无动画），再启动 transition
 */
async function flipPrev() {
  dragDir.value = 'right'
  // 等 Vue 将 fgX = -W 渲染到 DOM
  await nextTick()
  // 强制浏览器提交，使 -W 成为 transition 的起始位置
  containerRef.value?.offsetHeight
  snapTo(getW(), () => { prevPage(); finishSnap() })
}

function snapTo(target: number, onDone: () => void) {
  snapTarget.value = target
  isSnapping.value = true
  setTimeout(onDone, 260)
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
    class="cover-mode"
  >
    <!-- 手势捕获层：置于所有内容层之上，避免 fg/bg DOM 重建导致触摸序列中断 -->
    <div
      class="cover-mode__gesture"
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
    <div class="cover-mode__page cover-mode__bg" v-html="bgHTML" />

    <!-- 顶层：移动页，滑动 -->
    <div
      class="cover-mode__page cover-mode__fg"
      :class="{ 'cover-mode__fg--snapping': isSnapping }"
      :style="{ transform: `translateX(${fgTranslateX}px)` }"
      v-html="fgHTML"
    />

    <!-- 底部页码 -->
    <div class="cover-mode__footer">
      <span class="cover-mode__page-info">{{ pageInfo }}</span>
    </div>

    <!-- 边界提示 Toast -->
    <Transition name="boundary-toast">
      <div v-if="boundaryMsg" class="boundary-toast">{{ boundaryMsg }}</div>
    </Transition>
  </div>
</template>

<style scoped>
.cover-mode {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  user-select: none;
  touch-action: pan-y;
  cursor: default;
}

/* 手势捕获层：透明，覆盖所有内容层，防止 v-html 重建中断触摸序列 */
.cover-mode__gesture {
  position: absolute;
  inset: 0;
  z-index: 10;
}

/* 两层页面绝对铺满 */
.cover-mode__page {
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  padding: var(--reader-padding, 24px);
  overflow: hidden;
  /* 不透明背景：防止上下两层同时可见 */
  background: var(--reader-bg-image, none), var(--reader-bg-color, var(--color-surface));
}

.cover-mode__bg {
  z-index: 0;
}

.cover-mode__fg {
  z-index: 1;
  will-change: transform;
  /* 右侧投影：上层页面盖在下层时产生深度感 */
  box-shadow: 4px 0 20px rgba(0, 0, 0, 0.12);
}

/* 仅在 snap 动画期间启用 transition */
.cover-mode__fg--snapping {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

/* 排版样式从 CSS 变量继承 */
.cover-mode__page :deep(p) {
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

.cover-mode ::selection {
  background-color: var(--reader-selection-color);
}

.cover-mode__footer {
  position: absolute;
  bottom: 4px;
  left: 0;
  right: 0;
  text-align: center;
  pointer-events: none;
  z-index: 2;
}

.cover-mode__page-info {
  font-size: 0.6875rem;
  opacity: 0.35;
  color: var(--reader-text-color);
}
</style>
