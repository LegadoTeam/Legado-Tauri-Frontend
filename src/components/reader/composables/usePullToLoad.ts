/**
 * usePullToLoad — 上拉/下拉加载章节的共享逻辑
 *
 * 同时用于 ScrollMode（小说滚动）和 ComicMode（漫画滚动），
 * 提供统一的触摸拖拽、鼠标拖拽、滚轮上拉/顶部弹跳行为，以及视觉气泡指示器状态。
 *
 * 调用方只需：
 * 1. 提供容器 ref、atBottom、配置回调
 * 2. 将返回的事件处理器绑定到容器
 * 3. 在 content 变化时调用 resetOnContentChange()
 * 4. 在 onBeforeUnmount 中调用 cleanup()
 */
import { ref, computed, type Ref } from 'vue'

export interface PullToLoadOptions {
  /** 滚动容器元素 */
  containerRef: Ref<HTMLElement | null>
  /** 是否已滚动到底部 */
  atBottom: Ref<boolean>
  /** 是否有下一章 */
  hasNext: () => boolean
  /** 触发「下一章」回调 */
  emitNext: () => void
}

export function usePullToLoad(options: PullToLoadOptions) {
  const {
    containerRef,
    atBottom,
    hasNext,
    emitNext,
  } = options

  // ── 常量 ──────────────────────────────────────────────────────────
  /** 上拉触发阈值（px，经过阻尼后的有效距离） */
  const PULL_THRESHOLD = 80
  /** 阻尼系数 */
  const PULL_DAMPING = 0.45
  /** 圆形气泡直径 */
  const BUBBLE_D = 120

  // ── 响应式状态 ────────────────────────────────────────────────────
  const pullDistance = ref(0)
  /** Q弹回弹消失动画进行中 */
  const dismissing = ref(false)
  let dismissTimer = 0
  /** 回弹动画时长（ms），与 CSS @keyframes pull-bubble-bounce-out 一致 */
  const DISMISS_DURATION = 480
  /**
   * 章节切换锁：从触发 next/prev-chapter 到 resetOnContentChange() 之前，
   * 所有触发路径均不得再次触发，防止连续跳章。
   */
  let chapterChanging = false
  let pullTriggered = false

  // ── 边界提示 Toast ────────────────────────────────────────────────
  const boundaryMsg = ref('')
  let boundaryTimer = 0
  function showBoundary(msg: string) {
    boundaryMsg.value = msg
    clearTimeout(boundaryTimer)
    boundaryTimer = window.setTimeout(() => { boundaryMsg.value = '' }, 1500)
  }

  /** 启动 Q弹回弹消失动画 */
  function startDismiss() {
    dismissing.value = true
    clearTimeout(dismissTimer)
    dismissTimer = window.setTimeout(() => { dismissing.value = false }, DISMISS_DURATION)
  }

  // ── 核心触发逻辑 ─────────────────────────────────────────────────
  /** 施加阻尼并在超过阈值时自动触发下一章 */
  function applyPull(rawDelta: number) {
    if (chapterChanging || pullTriggered || rawDelta <= 0) {
      if (rawDelta <= 0) pullDistance.value = 0
      return
    }
    const damped = rawDelta * PULL_DAMPING
    pullDistance.value = Math.min(damped, PULL_THRESHOLD * 1.5)
    if (pullDistance.value >= PULL_THRESHOLD) {
      pullTriggered = true
      pullDistance.value = 0
      if (hasNext()) {
        chapterChanging = true
        startDismiss()
        emitNext()
      } else {
        showBoundary('已经到最后一页了')
      }
    }
  }

  function resetPull() {
    pullDistance.value = 0
    pullTriggered = false
  }

  // ── 触摸事件 ─────────────────────────────────────────────────────
  let touchStartY = 0
  let touchStartAtBottom = false

  function onTouchStart(e: TouchEvent) {
    touchStartY = e.touches[0].clientY
    touchStartAtBottom = atBottom.value
    pullTriggered = false
  }

  function onTouchMove(e: TouchEvent) {
    if (!touchStartAtBottom) { pullDistance.value = 0; return }
    applyPull(touchStartY - e.touches[0].clientY)
  }

  function onTouchEnd() {
    resetPull()
    touchStartAtBottom = false
  }

  // ── 鼠标拖拽（桌面端拖动滚动 + 底部上拉） ──────────────────────
  const isDragging = ref(false)
  let mouseStartY = 0
  let mouseStartScrollTop = 0
  let mousePullMode = false
  /** 累计鼠标拖移像素，用于区分点击与拖拽 */
  let mouseDragTotal = 0

  function onMouseDown(e: MouseEvent) {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('button, a')) return
    const el = containerRef.value
    if (!el) return

    isDragging.value = true
    mouseStartY = e.clientY
    mouseStartScrollTop = el.scrollTop
    mousePullMode = atBottom.value
    mouseDragTotal = 0
    pullTriggered = false

    document.addEventListener('mousemove', onGlobalMouseMove)
    document.addEventListener('mouseup', onGlobalMouseUp, { once: true })
  }

  function onGlobalMouseMove(e: MouseEvent) {
    if (!isDragging.value) return
    const el = containerRef.value
    if (!el) return

    const dy = mouseStartY - e.clientY
    mouseDragTotal += Math.abs(e.movementY) + Math.abs(e.movementX)

    if (!mousePullMode) {
      el.scrollTop = mouseStartScrollTop + dy
      const reachedBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 2
      if (reachedBottom && dy > 0) {
        mousePullMode = true
        mouseStartY = e.clientY
        pullTriggered = false
      }
    } else {
      const pullDy = mouseStartY - e.clientY
      if (pullDy < -5) {
        mousePullMode = false
        mouseStartScrollTop = el.scrollTop
        mouseStartY = e.clientY
        pullDistance.value = 0
        return
      }
      applyPull(pullDy)
    }
  }

  function onGlobalMouseUp() {
    isDragging.value = false
    mousePullMode = false
    resetPull()
    document.removeEventListener('mousemove', onGlobalMouseMove)
  }

  /** 累计鼠标位移 > 5px 视为拖拽而非点击 */
  function isMouseDragMoved() {
    return mouseDragTotal > 5
  }

  // ── 滚轮（底部模拟阻尼上拉） ─────────────────────────────────────
  let wheelResetTimer: ReturnType<typeof setTimeout> | null = null

  function onWheel(e: WheelEvent) {
    const el = containerRef.value
    if (!el) return

    // 顶部向上滚 → 不做任何处理，不触发上一章
    if (el.scrollTop <= 0 && e.deltaY < 0) {
      return
    }

    // 底部向下滚 → 阻尼上拉动画
    if (atBottom.value && e.deltaY > 0) {
      e.preventDefault()
      if (wheelResetTimer) clearTimeout(wheelResetTimer)

      const lineHeight = 20
      const pixelDelta = e.deltaMode === 1 ? e.deltaY * lineHeight : e.deltaY
      const step = Math.min(Math.abs(pixelDelta) * 0.22, 18)
      pullDistance.value = Math.min(pullDistance.value + step, PULL_THRESHOLD * 1.5)

      if (!pullTriggered && pullDistance.value >= PULL_THRESHOLD) {
        pullTriggered = true
        pullDistance.value = 0
        if (hasNext()) {
          chapterChanging = true
          startDismiss()
          emitNext()
        } else {
          showBoundary('已经到最后一页了')
        }
        return
      }

      wheelResetTimer = setTimeout(() => {
        resetPull()
        wheelResetTimer = null
      }, 700)
    }
  }

  // ── 计算属性 ─────────────────────────────────────────────────────
  const pullProgress = computed(() => Math.min(pullDistance.value / PULL_THRESHOLD, 1))
  const bubbleBottomPx = computed(() =>
    -BUBBLE_D + pullDistance.value * (BUBBLE_D / PULL_THRESHOLD),
  )
  const isReady = computed(() => pullProgress.value >= 1)

  // ── 生命周期辅助 ─────────────────────────────────────────────────
  /**
   * 内容变化（章节切换完成）时调用，重置所有锁和状态。
   */
  function resetOnContentChange() {
    chapterChanging = false
    pullTriggered = false
    pullDistance.value = 0
    // 注意：不重置 dismissing，让 Q弹消失动画自然播完再隐藏
    if (isDragging.value && containerRef.value) {
      mouseStartScrollTop = 0
    }
  }

  /** 在 onBeforeUnmount 中调用，清理残余事件监听和定时器 */
  function cleanup() {
    document.removeEventListener('mousemove', onGlobalMouseMove)
    if (wheelResetTimer) clearTimeout(wheelResetTimer)
    clearTimeout(boundaryTimer)
    clearTimeout(dismissTimer)
  }

  return {
    // 响应式状态（模板绑定用）
    pullDistance,
    pullProgress,
    bubbleBottomPx,
    isReady,
    dismissing,
    boundaryMsg,
    showBoundary,
    isDragging,

    // 事件处理器（绑定到容器）
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onMouseDown,
    onWheel,

    // 辅助判断
    isMouseDragMoved,

    // 生命周期
    resetOnContentChange,
    cleanup,
  }
}
