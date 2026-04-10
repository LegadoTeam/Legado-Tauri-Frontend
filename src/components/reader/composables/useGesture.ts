/**
 * useGesture — 触摸/鼠标手势处理
 *
 * 支持：点击区域判定（上一页/菜单/下一页）、左右滑动、长按
 * 完全独立，不依赖任何外部库
 */
import { ref, onMounted, onBeforeUnmount, type Ref } from 'vue'

export interface GestureCallbacks {
  onTapLeft?: () => void
  onTapCenter?: () => void
  onTapRight?: () => void
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onSwipeUp?: () => void
  onSwipeDown?: () => void
}

export interface GestureOptions {
  /** 滑动触发阈值 px */
  swipeThreshold?: number
  /** 点击左区占比 0-1 */
  tapLeftRatio?: number
  /** 点击右区占比 0-1 */
  tapRightRatio?: number
}

export function useGesture(
  elRef: Ref<HTMLElement | null>,
  callbacks: GestureCallbacks,
  options: GestureOptions = {},
) {
  const { swipeThreshold = 50, tapLeftRatio = 0.3, tapRightRatio = 0.7 } = options

  const isSwiping = ref(false)

  let startX = 0
  let startY = 0
  let startTime = 0
  let moved = false

  function onPointerDown(e: PointerEvent) {
    startX = e.clientX
    startY = e.clientY
    startTime = Date.now()
    moved = false
    isSwiping.value = false
  }

  function onPointerMove(e: PointerEvent) {
    const dx = e.clientX - startX
    const dy = e.clientY - startY
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      moved = true
      isSwiping.value = true
    }
  }

  function onPointerUp(e: PointerEvent) {
    const dx = e.clientX - startX
    const dy = e.clientY - startY
    const duration = Date.now() - startTime
    const el = elRef.value
    if (!el) return

    if (moved) {
      // 手势滑动
      const absDx = Math.abs(dx)
      const absDy = Math.abs(dy)
      if (absDx > absDy && absDx > swipeThreshold) {
        if (dx < 0) callbacks.onSwipeLeft?.()
        else callbacks.onSwipeRight?.()
      } else if (absDy > absDx && absDy > swipeThreshold) {
        if (dy < 0) callbacks.onSwipeUp?.()
        else callbacks.onSwipeDown?.()
      }
    } else if (duration < 300) {
      // 点击区域判定
      const rect = el.getBoundingClientRect()
      const relX = (e.clientX - rect.left) / rect.width
      if (relX < tapLeftRatio) {
        callbacks.onTapLeft?.()
      } else if (relX > tapRightRatio) {
        callbacks.onTapRight?.()
      } else {
        callbacks.onTapCenter?.()
      }
    }

    isSwiping.value = false
  }

  onMounted(() => {
    const el = elRef.value
    if (!el) return
    el.addEventListener('pointerdown', onPointerDown, { passive: true })
    el.addEventListener('pointermove', onPointerMove, { passive: true })
    el.addEventListener('pointerup', onPointerUp, { passive: true })
  })

  onBeforeUnmount(() => {
    const el = elRef.value
    if (!el) return
    el.removeEventListener('pointerdown', onPointerDown)
    el.removeEventListener('pointermove', onPointerMove)
    el.removeEventListener('pointerup', onPointerUp)
  })

  return { isSwiping }
}
