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
import { ref, computed, type Ref } from 'vue';

export interface PullToLoadOptions {
  /** 滚动容器元素 */
  containerRef: Ref<HTMLElement | null>;
  /** 是否已滚动到底部 */
  atBottom: Ref<boolean>;
  /** 是否有下一章 */
  hasNext: () => boolean;
  /** 触发「下一章」回调 */
  emitNext: () => void;
}

export function usePullToLoad(options: PullToLoadOptions) {
  const { containerRef, atBottom, hasNext, emitNext } = options;

  // ── 常量 ──────────────────────────────────────────────────────────
  /** 上拉触发阈值（px，经过阻尼后的有效距离） */
  const PULL_THRESHOLD = 100;
  /** 阻尼系数 */
  const PULL_DAMPING = 0.45;
  /** 圆形气泡直径 */
  const BUBBLE_D = 120;

  // ── 响应式状态 ────────────────────────────────────────────────────
  const pullDistance = ref(0);
  /** Q弹回弹消失动画进行中 */
  const dismissing = ref(false);
  let dismissTimer = 0;
  /** 回弹动画时长（ms），与 CSS @keyframes pull-bubble-water-drop 一致 */
  const DISMISS_DURATION = 650;
  /**
   * 章节切换锁：从触发 next/prev-chapter 到 resetOnContentChange() 之前，
   * 所有触发路径均不得再次触发，防止连续跳章。
   */
  let chapterChanging = false;
  let pullTriggered = false;

  // ── 边界提示 Toast ────────────────────────────────────────────────
  const boundaryMsg = ref('');
  let boundaryTimer = 0;
  function showBoundary(msg: string) {
    boundaryMsg.value = msg;
    clearTimeout(boundaryTimer);
    boundaryTimer = window.setTimeout(() => {
      boundaryMsg.value = '';
    }, 1500);
  }

  /** 启动 Q弹回弹消失动画 */
  function startDismiss() {
    dismissing.value = true;
    clearTimeout(dismissTimer);
    dismissTimer = window.setTimeout(() => {
      dismissing.value = false;
    }, DISMISS_DURATION);
  }

  // ── 核心触发逻辑 ─────────────────────────────────────────────────
  /** 施加阻尼并在超过阈值时自动触发下一章 */
  function applyPull(rawDelta: number) {
    if (chapterChanging || pullTriggered || rawDelta <= 0) {
      if (rawDelta <= 0) {
        pullDistance.value = 0;
      }
      return;
    }
    const damped = rawDelta * PULL_DAMPING;
    pullDistance.value = Math.min(damped, PULL_THRESHOLD * 1.5);
    if (pullDistance.value >= PULL_THRESHOLD) {
      pullTriggered = true;
      pullDistance.value = 0;
      if (hasNext()) {
        chapterChanging = true;
        startDismiss();
        emitNext();
      } else {
        showBoundary('已经到最后一页了');
      }
    }
  }

  function resetPull() {
    pullDistance.value = 0;
    pullTriggered = false;
  }

  // ── 触摸事件 ─────────────────────────────────────────────────────
  let touchStartY = 0;
  /**
   * 是否已进入「上拉」模式：
   *  - 触摸开始时已在底部 → 立即为 true
   *  - 触摸开始时不在底部 → 滑动到底部后继续上拉时动态切换为 true（与鼠标拖拽逻辑一致）
   */
  let touchPullMode = false;
  /** 进入上拉模式时的手指 Y 坐标，作为计算上拉距离的基准点 */
  let touchPullStartY = 0;

  function onTouchStart(e: TouchEvent) {
    lastTouchStartTime = Date.now(); // 记录触摸时间，用于过滤后续合成 mousedown
    touchStartY = e.touches[0].clientY;
    touchPullMode = atBottom.value; // 已在底部时立即进入上拉模式
    touchPullStartY = e.touches[0].clientY;
    pullTriggered = false;
  }

  function onTouchMove(e: TouchEvent) {
    const currentY = e.touches[0].clientY;

    if (!touchPullMode) {
      // 滑动过程中检测：若刚到达底部且手指继续向上，切换为上拉模式
      if (atBottom.value && touchStartY - currentY > 0) {
        touchPullMode = true;
        touchPullStartY = currentY; // 以当前位置为上拉起点，避免计入之前的滚动距离
        pullTriggered = false;
      }
      pullDistance.value = 0;
      return;
    }

    const pullDy = touchPullStartY - currentY;
    if (pullDy < -5) {
      // 手指往下反划（离开上拉方向），退出上拉模式
      touchPullMode = false;
      pullDistance.value = 0;
      return;
    }
    applyPull(Math.max(0, pullDy));
  }

  function onTouchEnd() {
    resetPull();
    touchPullMode = false;
  }

  // ── 鼠标拖拽（桌面端拖动滚动 + 底部上拉） ──────────────────────
  const isDragging = ref(false);
  let mouseStartY = 0;
  let mouseStartScrollTop = 0;
  let mousePullMode = false;
  /** 累计鼠标拖移像素，用于区分点击与拖拽 */
  let mouseDragTotal = 0;
  /** 最近一次 touchstart 的时间戳，用于过滤移动端合成 mousedown（ghost click 问题） */
  let lastTouchStartTime = 0;

  // ── 鼠标拖拽惯性 ────────────────────────────────────────────────
  /**
   * 惯性滑行：拖拽释放后以「抛出速度」继续滚动，每帧衰减至停止。
   *   - DECEL：每帧保留速度比例（0.93 ≈ 滑行约 0.5s，可调大/小）
   *   - MIN_V：低于此速度（px/frame）停止，避免浮点漂移
   */
  const MOMENTUM_DECEL = 0.93;
  const MOMENTUM_MIN_V = 0.4;
  let momentumVelocity = 0;
  let momentumRafId = 0;

  /**
   * 速度采样窗口：保留最近 VELOCITY_WINDOW_MS 内的 (timestamp, clientY) 记录。
   * mouseup 时用首尾差值估算真实抛出速度，避免只看最后一帧带来的抖动。
   */
  const VELOCITY_WINDOW_MS = 80;
  const velocityHistory: Array<{ t: number; y: number }> = [];

  function recordVelocitySample(clientY: number) {
    const now = performance.now();
    velocityHistory.push({ t: now, y: clientY });
    const cutoff = now - VELOCITY_WINDOW_MS;
    while (velocityHistory.length > 1 && velocityHistory[0].t < cutoff) {
      velocityHistory.shift();
    }
  }

  /**
   * 从采样窗口计算抛出速度（px/16ms-frame）。
   * 方向约定：鼠标上移(clientY 减小) → scrollTop 增大 → 返回正值。
   *           鼠标下移(clientY 增大) → scrollTop 减小 → 返回负值。
   */
  function computeThrowVelocity(): number {
    if (velocityHistory.length < 2) {
      return 0;
    }
    const first = velocityHistory[0];
    const last = velocityHistory[velocityHistory.length - 1];
    const dt = last.t - first.t;
    if (dt < 1) {
      return 0;
    }
    // (first.y - last.y)：clientY 减小时为正，对应 scrollTop 增大方向
    return ((first.y - last.y) / dt) * 16;
  }

  function stopMomentum() {
    if (momentumRafId) {
      cancelAnimationFrame(momentumRafId);
      momentumRafId = 0;
    }
  }

  function startMomentum(el: HTMLElement) {
    stopMomentum();
    if (Math.abs(momentumVelocity) < MOMENTUM_MIN_V) {
      return;
    }

    function tick() {
      momentumVelocity *= MOMENTUM_DECEL;
      if (Math.abs(momentumVelocity) < MOMENTUM_MIN_V) {
        momentumRafId = 0;
        return;
      }
      const before = el.scrollTop;
      el.scrollTop += momentumVelocity;
      // 到达边界（顶/底）时停止，避免空转
      if (el.scrollTop === before) {
        momentumRafId = 0;
        return;
      }
      momentumRafId = requestAnimationFrame(tick);
    }
    momentumRafId = requestAnimationFrame(tick);
  }

  function onMouseDown(e: MouseEvent) {
    if (e.button !== 0) {
      return;
    }
    if ((e.target as HTMLElement).closest('button, a')) {
      return;
    }
    // 过滤移动端触摸后浏览器生成的合成 mousedown（ghost click）
    if (Date.now() - lastTouchStartTime < 600) {
      return;
    }
    const el = containerRef.value;
    if (!el) {
      return;
    }

    // 新拖拽开始时停止上一次惯性
    stopMomentum();
    velocityHistory.length = 0;

    isDragging.value = true;
    mouseStartY = e.clientY;
    mouseStartScrollTop = el.scrollTop;
    mousePullMode = atBottom.value;
    mouseDragTotal = 0;
    momentumVelocity = 0;
    pullTriggered = false;

    recordVelocitySample(e.clientY);
    document.addEventListener('mousemove', onGlobalMouseMove);
    document.addEventListener('mouseup', onGlobalMouseUp, { once: true });
  }

  function onGlobalMouseMove(e: MouseEvent) {
    if (!isDragging.value) {
      return;
    }
    const el = containerRef.value;
    if (!el) {
      return;
    }

    const dy = mouseStartY - e.clientY;
    mouseDragTotal += Math.abs(e.movementY) + Math.abs(e.movementX);

    // 持续采样位置，用于 mouseup 时计算抛出速度
    recordVelocitySample(e.clientY);

    if (!mousePullMode) {
      el.scrollTop = mouseStartScrollTop + dy;
      const reachedBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 2;
      if (reachedBottom && dy > 0) {
        mousePullMode = true;
        mouseStartY = e.clientY;
        pullTriggered = false;
      }
    } else {
      const pullDy = mouseStartY - e.clientY;
      if (pullDy < -5) {
        mousePullMode = false;
        mouseStartScrollTop = el.scrollTop;
        mouseStartY = e.clientY;
        pullDistance.value = 0;
        return;
      }
      applyPull(pullDy);
    }
  }

  function onGlobalMouseUp() {
    isDragging.value = false;
    document.removeEventListener('mousemove', onGlobalMouseMove);

    // 上拉模式下不做惯性（已交由 applyPull 处理），普通滚动模式才启动惯性
    if (!mousePullMode) {
      momentumVelocity = computeThrowVelocity();
      const el = containerRef.value;
      if (el) {
        startMomentum(el);
      }
    }

    velocityHistory.length = 0;
    mousePullMode = false;
    resetPull();
  }

  /** 累计鼠标位移 > 5px 视为拖拽而非点击 */
  function isMouseDragMoved() {
    return mouseDragTotal > 5;
  }

  // ── 滚轮（底部模拟阻尼上拉） ─────────────────────────────────────
  let wheelResetTimer: ReturnType<typeof setTimeout> | null = null;

  function onWheel(e: WheelEvent) {
    const el = containerRef.value;
    if (!el) {
      return;
    }

    // 顶部向上滚 → 不做任何处理，不触发上一章
    if (el.scrollTop <= 0 && e.deltaY < 0) {
      return;
    }

    // 底部向下滚 → 阻尼上拉动画
    if (atBottom.value && e.deltaY > 0) {
      e.preventDefault();
      if (wheelResetTimer) {
        clearTimeout(wheelResetTimer);
      }

      const lineHeight = 20;
      const pixelDelta = e.deltaMode === 1 ? e.deltaY * lineHeight : e.deltaY;
      const step = Math.min(Math.abs(pixelDelta) * 0.22, 18);
      pullDistance.value = Math.min(pullDistance.value + step, PULL_THRESHOLD * 1.5);

      if (!pullTriggered && pullDistance.value >= PULL_THRESHOLD) {
        pullTriggered = true;
        pullDistance.value = 0;
        if (hasNext()) {
          chapterChanging = true;
          startDismiss();
          emitNext();
        } else {
          showBoundary('已经到最后一页了');
        }
        return;
      }

      wheelResetTimer = setTimeout(() => {
        resetPull();
        wheelResetTimer = null;
      }, 700);
    }
  }

  // ── 计算属性 ─────────────────────────────────────────────────────
  const pullProgress = computed(() => Math.min(pullDistance.value / PULL_THRESHOLD, 1));
  /**
   * 上拉到触发阈值时，气泡从屏幕底部进入屏幕内的像素数。
   *
   * 调参指南：
   *  - 0  → 气泡贴底：`bottom: 0` 位置，底边与屏幕齐平（当前默认值）
   *  - 60 → 气泡浮出：底边比屏幕底边高 60px（配合 scale(0.5) 后视觉约 60px 高的球悬在底部）
   *  - 修改后记得同步更新 PullBubble.vue @keyframes pull-bubble-water-drop 0% 处的 translateY
   *    （0% 的 translateY 应与此处推算出的 translateY=-BUBBLE_ENTER_PX 一致）
   */
  const BUBBLE_ENTER_PX = 0;
  const bubbleBottomPx = computed(
    () => -BUBBLE_D + pullProgress.value * (BUBBLE_D + BUBBLE_ENTER_PX),
  );
  const isReady = computed(() => pullProgress.value >= 1);

  // ── 生命周期辅助 ─────────────────────────────────────────────────
  /**
   * 内容变化（章节切换完成）时调用，重置所有锁和状态。
   */
  function resetOnContentChange() {
    chapterChanging = false;
    pullTriggered = false;
    pullDistance.value = 0;
    // 注意：不重置 dismissing，让 Q弹消失动画自然播完再隐藏
    if (isDragging.value && containerRef.value) {
      mouseStartScrollTop = 0;
    }
  }

  /** 在 onBeforeUnmount 中调用，清理残余事件监听和定时器 */
  function cleanup() {
    stopMomentum();
    document.removeEventListener('mousemove', onGlobalMouseMove);
    if (wheelResetTimer) {
      clearTimeout(wheelResetTimer);
    }
    clearTimeout(boundaryTimer);
    clearTimeout(dismissTimer);
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
  };
}
