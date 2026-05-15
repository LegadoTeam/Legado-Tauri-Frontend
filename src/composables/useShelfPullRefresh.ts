/**
 * useShelfPullRefresh — 书架下拉刷新逻辑
 *
 * 下拉时触发刷新回调，显示视觉反馈（指示器动画），
 * 刷新完成后自动隐藏指示器。
 */

import { ref, computed, onBeforeUnmount } from 'vue';

export interface UseShelfPullRefreshOptions {
  /** 刷新回调，返回 Promise（刷新完成时 resolve） */
  onRefresh: () => Promise<void>;
}

export function useShelfPullRefresh(options: UseShelfPullRefreshOptions) {
  const { onRefresh } = options;

  // ── 常量 ──────────────────────────────────────────────────────────
  /** 下拉触发阈值（px） */
  const PULL_THRESHOLD = 60;
  /** 阻尼系数 */
  const PULL_DAMPING = 0.35;
  /** 最大下拉距离（px） */
  const MAX_PULL = 120;

  // ── 状态 ──────────────────────────────────────────────────────────
  const pullDistance = ref(0);
  const isRefreshing = ref(false);
  const isReady = ref(false);

  // ── 触摸事件 ──────────────────────────────────────────────────────
  let touchStartY = 0;
  let touchContainer: HTMLElement | null = null;
  let isPulling = false;

  function onTouchStart(e: TouchEvent) {
    touchStartY = e.touches[0].clientY;
    touchContainer = e.currentTarget as HTMLElement;
    isPulling = false;
    pullDistance.value = 0;
    isReady.value = false;
  }

  function onTouchMove(e: TouchEvent) {
    if (!touchContainer) {
      return;
    }

    const currentY = e.touches[0].clientY;
    const dy = currentY - touchStartY;

    // 如果还没开始下拉，且不是向下滑动，或不在顶部，则忽略
    if (!isPulling) {
      if (dy <= 0 || touchContainer.scrollTop > 0) {
        return;
      }
      // 开始下拉
      isPulling = true;
    } else {
      // 正在下拉中，如果向上滑动则停止下拉状态
      if (dy <= 0) {
        isPulling = false;
        pullDistance.value = 0;
        isReady.value = false;
        return;
      }
    }

    // 阻止浏览器默认滚动行为
    e.preventDefault();

    // 应用阻尼
    const damped = dy * PULL_DAMPING;
    pullDistance.value = Math.min(damped, MAX_PULL);

    // 判断是否达到触发阈值
    isReady.value = pullDistance.value >= PULL_THRESHOLD;
  }

  function onTouchEnd() {
    const shouldRefresh = isReady.value && !isRefreshing.value;
    pullDistance.value = 0;
    isReady.value = false;
    isPulling = false;
    touchContainer = null;

    if (shouldRefresh) {
      isRefreshing.value = true;
      onRefresh().finally(() => {
        isRefreshing.value = false;
      });
    }
  }

  // ── 鼠标拖拽（桌面端） ──────────────────────────────────────────
  let isDragging = false;
  let mouseStartY = 0;

  function onMouseDown(e: MouseEvent) {
    // 只有在滚动到顶部时才响应
    const el = e.currentTarget as HTMLElement;
    if (el.scrollTop > 0) {
      return;
    }
    isDragging = true;
    mouseStartY = e.clientY;
    pullDistance.value = 0;
    isReady.value = false;

    document.addEventListener('mousemove', onGlobalMouseMove);
    document.addEventListener('mouseup', onGlobalMouseUp, { once: true });
  }

  function onGlobalMouseMove(e: MouseEvent) {
    if (!isDragging) {
      return;
    }

    const dy = e.clientY - mouseStartY;
    if (dy <= 0) {
      pullDistance.value = 0;
      isReady.value = false;
      return;
    }

    const damped = dy * PULL_DAMPING;
    pullDistance.value = Math.min(damped, MAX_PULL);
    isReady.value = pullDistance.value >= PULL_THRESHOLD;
  }

  function onGlobalMouseUp() {
    isDragging = false;
    document.removeEventListener('mousemove', onGlobalMouseMove);

    if (isReady.value && !isRefreshing.value) {
      pullDistance.value = 0;
      isReady.value = false;
      isRefreshing.value = true;
      onRefresh().finally(() => {
        isRefreshing.value = false;
      });
    } else {
      pullDistance.value = 0;
      isReady.value = false;
    }
  }

  // ── 计算属性 ─────────────────────────────────────────────────────
  const pullProgress = computed(() => Math.min(pullDistance.value / PULL_THRESHOLD, 1));

  // ── 清理 ──────────────────────────────────────────────────────────
  onBeforeUnmount(() => {
    document.removeEventListener('mousemove', onGlobalMouseMove);
  });

  return {
    pullDistance,
    pullProgress,
    isRefreshing,
    isReady,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onMouseDown,
  };
}
