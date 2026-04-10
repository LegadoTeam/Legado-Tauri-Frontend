<script setup lang="ts">
/**
 * PullBubble — 上拉加载气泡指示器 + 边界提示 Toast
 *
 * 共享组件，用于 ScrollMode 和 ComicMode。
 * 包含：
 * - 从屏幕底部拉出的圆形气泡（带粘性跟随 & Q弹回弹动画）
 * - 边界提示 Toast（居中半透明，自动消失）
 */
defineProps<{
  /** 气泡是否可见（通常绑定 atBottom） */
  visible: boolean
  /** 气泡底部距离屏幕底边的 px */
  bubbleBottomPx: number
  /** 是否达到触发阈值 */
  isReady: boolean
  /** 是否正在执行回弹消失动画 */
  dismissing: boolean
  /** 是否有下一章（决定气泡文案） */
  hasNext: boolean
  /** 边界提示消息，空字符串不显示 */
  boundaryMsg: string
}>()
</script>

<template>
  <!-- 上拉气泡：圈在屏幕底边以外，逐渐被拉出 -->
  <Teleport to="body">
    <div
      v-if="visible || dismissing"
      class="pull-bubble"
      :class="{
        'pull-bubble--ready': isReady,
        'pull-bubble--dismiss': dismissing,
      }"
      :style="dismissing ? undefined : { bottom: `${bubbleBottomPx}px` }"
      aria-hidden="true"
    >
      <svg class="pull-bubble__icon" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 19V5M5 12l7-7 7 7"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <span class="pull-bubble__text">
        {{ isReady || dismissing ? (hasNext ? '下一章' : '已经到最后一页了') : '继续上拉' }}
      </span>
    </div>
  </Teleport>

  <!-- 边界提示 Toast -->
  <Teleport to="body">
    <Transition name="boundary-toast">
      <div v-if="boundaryMsg" class="boundary-toast">{{ boundaryMsg }}</div>
    </Transition>
  </Teleport>
</template>

<style>
/* ═══════════════════════════════════════════════════════════════════
   上拉气泡（PullBubble）— 全局样式（非 scoped，因为 Teleport 到 body）
   边界提示 Toast 样式已提取至全局 src/style.css
   ═══════════════════════════════════════════════════════════════════ */
.pull-bubble {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: rgba(99, 102, 241, 0.82);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow: 0 -6px 32px rgba(99, 102, 241, 0.35), 0 2px 12px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  pointer-events: none;
  z-index: 9999;
  will-change: bottom, transform;
  /* 粘性跟随：cubic-bezier 给出一个有弹性的缓动感 */
  transition:
    bottom 0.18s cubic-bezier(0.22, 1, 0.36, 1),
    background 0.2s ease,
    box-shadow 0.2s ease;
}

/* 达到阈值 → 高亮 */
.pull-bubble--ready {
  background: rgba(99, 102, 241, 1);
  box-shadow: 0 -8px 40px rgba(99, 102, 241, 0.55), 0 2px 12px rgba(0, 0, 0, 0.18);
}

/* Q弹回弹消失动画 */
.pull-bubble--dismiss {
  animation: pull-bubble-bounce-out 0.48s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

@keyframes pull-bubble-bounce-out {
  0% {
    bottom: 10px;
    transform: translateX(-50%) scale(1);
    opacity: 1;
  }
  30% {
    bottom: 24px;
    transform: translateX(-50%) scale(1.18);
    opacity: 1;
  }
  60% {
    bottom: 8px;
    transform: translateX(-50%) scale(0.92);
    opacity: 0.85;
  }
  100% {
    bottom: -140px;
    transform: translateX(-50%) scale(0.5);
    opacity: 0;
  }
}

.pull-bubble__icon {
  width: 26px;
  height: 26px;
  color: #fff;
  flex-shrink: 0;
}

.pull-bubble__text {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.92);
  white-space: nowrap;
  letter-spacing: 0.08em;
  line-height: 1;
}
</style>
