<script setup lang="ts">
/**
 * ScrollMode — 滚动翻页模式
 *
 * 类似长网页式无限滚动阅读，支持触摸滚动和鼠标滚轮。
 * 左右点击不翻页，只有中间点击切换菜单。
 * 底部/顶部提供章节切换按钮（桌面端），移动端需要上拉超过阈值才触发下一章。
 * 上拉/下拉加载逻辑与 ComicMode 共用 usePullToLoad composable。
 */
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { usePullToLoad } from '../composables/usePullToLoad'
import PullBubble from '../PullBubble.vue'

const props = defineProps<{
  content: string
  chapterTitle?: string
  paragraphSpacing: number
  textIndent: number
  hasPrev?: boolean
  hasNext?: boolean
}>()

const emit = defineEmits<{
  (e: 'progress', ratio: number): void
  (e: 'reachStart'): void
  (e: 'reachEnd'): void
  (e: 'tap', zone: 'left' | 'center' | 'right'): void
  (e: 'prev-chapter'): void
  (e: 'next-chapter'): void
}>()

const scrollRef = ref<HTMLElement | null>(null)

const paragraphs = ref<string[]>([])

/** 是否已滚动到底部附近 */
const atBottom = ref(false)
/** 是否已滚动到顶部 */
const atTop = ref(true)

// ── 上拉/下拉加载（共用 usePullToLoad composable） ──────────────────
const {
  pullDistance,
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
})

// ── 触摸事件包装（添加 tap 检测） ──────────────────────────────────
let touchStartX = 0
let touchStartY = 0
/** touch tap 已处理，抑制后续合成 click 事件 */
let suppressNextClick = false

function onTouchStart(e: TouchEvent) {
  touchStartX = e.touches[0].clientX
  touchStartY = e.touches[0].clientY
  pullTouchStart(e)
}

function onTouchMove(e: TouchEvent) {
  pullTouchMove(e)
}

function onTouchEnd(e: TouchEvent) {
  // 单指轻触 → 视为 tap，切换菜单（移动端可滚动容器内合成 click 不可靠）
  if (e.changedTouches.length === 1) {
    const t = e.changedTouches[0]
    const dx = Math.abs(t.clientX - touchStartX)
    const dy = Math.abs(t.clientY - touchStartY)
    if (dx < 15 && dy < 15) {
      if (!(e.target as HTMLElement).closest('.scroll-mode__chapter-btn')) {
        suppressNextClick = true
        emit('tap', 'center')
      }
    }
  }
  pullTouchEnd()
}

function onTouchCancel() {
  pullTouchEnd()
}

// ── 拖拽时禁用平滑滚动，确保即时跟手 ───────────────────────────────
watch(isDragging, (dragging) => {
  const el = scrollRef.value
  if (!el) return
  if (dragging) {
    el.style.userSelect = 'none'
    el.style.cursor = 'grabbing'
    el.style.scrollBehavior = 'auto'
  } else {
    el.style.userSelect = ''
    el.style.cursor = ''
    el.style.scrollBehavior = ''
    // 拖动结束时抑制后续 click 事件
    if (isMouseDragMoved()) suppressNextClick = true
  }
})

// ── 清理 ────────────────────────────────────────────────────────────
onBeforeUnmount(() => cleanup())

// ── 内容变时重置状态 ────────────────────────────────────────────────
watch(
  () => props.content,
  (val) => {
    paragraphs.value = val.split(/\n+/).filter(p => p.trim())
    resetOnContentChange()
    atBottom.value = false
    atTop.value = true
    nextTick(() => {
      if (scrollRef.value) scrollRef.value.scrollTop = 0
    })
  },
  { immediate: true },
)

function onScroll() {
  const el = scrollRef.value
  if (!el) return
  const { scrollTop, scrollHeight, clientHeight } = el
  const ratio = scrollHeight <= clientHeight ? 1 : scrollTop / (scrollHeight - clientHeight)
  emit('progress', Math.min(1, Math.max(0, ratio)))

  atTop.value = scrollTop <= 0
  atBottom.value = scrollTop + clientHeight >= scrollHeight - 2

  if (atTop.value) emit('reachStart')
  if (atBottom.value) emit('reachEnd')
}

/** 允许父组件滚动到指定比例位置（瞬间跳转，禁用 smooth） */
function scrollToRatio(ratio: number) {
  const el = scrollRef.value
  if (!el) return
  const max = el.scrollHeight - el.clientHeight
  // 覆盖 CSS scroll-behavior: smooth，确保恢复位置时瞬间到达
  el.style.scrollBehavior = 'auto'
  el.scrollTop = max * Math.min(1, Math.max(0, ratio))
  // 下一帧恢复 smooth（用户后续手动滚动仍然平滑）
  requestAnimationFrame(() => { el.style.scrollBehavior = '' })
}

/** 鼠标点击 → 任意区域均切换菜单（滚动模式不支持点击左右翻章） */
function onClick(e: MouseEvent) {
  // touch tap 已处理，跳过合成 click 防止重复触发
  if (suppressNextClick) {
    suppressNextClick = false
    return
  }
  // 鼠标拖拽不算点击
  if (isMouseDragMoved()) return
  // 不拦截按钮点击
  if ((e.target as HTMLElement).closest('.scroll-mode__chapter-btn')) return
  emit('tap', 'center')
}

/** 桌面端保留下一章按鈕；移动端用上拉手势 */
const showNextBtn = computed(() => props.hasNext && atBottom.value && pullDistance.value === 0)

defineExpose({ scrollToRatio })
</script>

<template>
  <div
    ref="scrollRef"
    class="scroll-mode"
    @scroll.passive="onScroll"
    @click="onClick"
    @mousedown="onMouseDown"
    @wheel="onWheel"
    @touchstart.passive="onTouchStart"
    @touchmove.passive="onTouchMove"
    @touchend.passive="onTouchEnd"
    @touchcancel.passive="onTouchCancel"
  >

    <div class="scroll-mode__body">
      <!-- 章节名标题 -->
      <p v-if="chapterTitle" class="reader-chapter-title">{{ chapterTitle }}</p>

      <p
        v-for="(para, i) in paragraphs"
        :key="i"
        class="scroll-mode__para"
        :style="{
          textIndent: `${textIndent}em`,
          marginBottom: `${paragraphSpacing}px`,
        }"
      >
        {{ para }}
      </p>
    </div>

    <!-- 上拉气泡 + 边界提示（共享组件） -->
    <PullBubble
      :visible="atBottom"
      :bubble-bottom-px="bubbleBottomPx"
      :is-ready="isReady"
      :dismissing="dismissing"
      :has-next="!!hasNext"
      :boundary-msg="boundaryMsg"
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
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  scroll-behavior: smooth;
  touch-action: manipulation;
}

.scroll-mode__body {
  padding: var(--reader-padding, 24px);
  min-height: 100%;
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
  text-transform: var(--reader-text-transform);
  font-variant: var(--reader-font-variant);
  writing-mode: var(--reader-writing-mode);
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
}

.scroll-mode ::selection {
  background-color: var(--reader-selection-color);
}

/* 自定义滚动条 */
.scroll-mode::-webkit-scrollbar {
  width: 4px;
}
.scroll-mode::-webkit-scrollbar-track {
  background: transparent;
}
.scroll-mode::-webkit-scrollbar-thumb {
  background: rgba(128, 128, 128, 0.3);
  border-radius: 2px;
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
</style>
