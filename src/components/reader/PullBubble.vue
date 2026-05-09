<script setup lang="ts">
/**
 * PullBubble — 上拉加载气泡指示器 + 边界提示 Toast
 *
 * 共享组件，用于 ScrollMode 和 ComicMode。
 * 架构要点：
 * - JS 只负责更新 CSS 自定义属性值（--bubble-y / --bubble-scale / --bubble-brightness）
 * - CSS @property 将这些属性注册为可动画属性，引擎负责所有插值计算（更高效）
 * - 拖拽时注入 transition: none，实现零延迟跟手
 * - 触发后 CSS animation 独立播完 Q弹水滴效果，不受 props 干扰
 */
import { ArrowUp } from 'lucide-vue-next';
import { computed } from 'vue';

const props = defineProps<{
  /** 气泡是否可见（通常绑定 atBottom） */
  visible: boolean;
  /** 气泡底部距离屏幕底边的 px（负值 = 在屏幕以下，0 = 刚好贴底可见） */
  bubbleBottomPx: number;
  /** 是否达到触发阈值 */
  isReady: boolean;
  /** 是否正在执行回弹消失动画 */
  dismissing: boolean;
  /** 是否有下一章（决定气泡文案） */
  hasNext: boolean;
  /** 边界提示消息，空字符串不显示 */
  boundaryMsg: string;
  /** 上拉进度 0~1（0 = 未拉起，1 = 达到触发阈值） */
  pullProgress: number;
  /** 是否正在手势拖拽（为 true 时移除所有过渡，实现即时跟手） */
  isDragging: boolean;
}>();

/**
 * 气泡动态样式（只写 CSS 自定义属性，不直接操作 transform / filter）：
 *   --bubble-y:          translateY 偏移，正值 = 向下移出屏幕（120px → 0px 随上拉增大）
 *   --bubble-scale:      等比缩放 1.0 → 0.5（120px → 60px ≈ 手指大小）
 *   --bubble-brightness: 亮度 1.0 → 1.2（越拉越亮，给予触达感）
 * dismiss 期间清空 style，由 CSS animation 独立接管，不存在 JS 干扰。
 */
const bubbleStyle = computed(() => {
  if (props.dismissing) {
    return {};
  }

  // bubbleBottomPx: -120(隐藏) → 0(完全可见)
  // translateY 需要将其反号：120(隐藏) → 0(可见)
  const translateY = -props.bubbleBottomPx;
  const scale = 1 - props.pullProgress * 0.5; // 1.0 → 0.5
  const brightness = 1 + props.pullProgress * 0.2; // 1.0 → 1.2

  const style: Record<string, string> = {
    '--bubble-y': `${translateY}px`,
    '--bubble-scale': scale.toFixed(3),
    '--bubble-brightness': brightness.toFixed(3),
  };

  // 拖拽中禁用所有 CSS transition，手指移动直接同步气泡位置
  if (props.isDragging) {
    style.transition = 'none';
  }

  return style;
});
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
      :style="bubbleStyle"
      aria-hidden="true"
    >
      <ArrowUp class="pull-bubble__icon" :size="20" />
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

/*
 * CSS @property 注册：让 CSS 引擎能够对自定义属性插值。
 * 这样 transition / animation 可以直接作用于 --bubble-y / --bubble-scale
 * 等属性，比 JS 每帧更新 transform 字符串更高效（浏览器可批量计算）。
 */
@property --bubble-y {
  syntax: '<length>';
  inherits: false;
  initial-value: 120px; /* 120px = 刚好隐藏在屏幕底部以下 */
}

@property --bubble-scale {
  syntax: '<number>';
  inherits: false;
  initial-value: 1;
}

@property --bubble-brightness {
  syntax: '<number>';
  inherits: false;
  initial-value: 1;
}

.pull-bubble {
  position: fixed;
  bottom: 0; /* 锚定屏幕底部，定位完全依赖 transform */
  left: 50%;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: rgba(99, 102, 241, 0.82);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow:
    0 -6px 32px rgba(99, 102, 241, 0.35),
    0 2px 12px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  pointer-events: none;
  z-index: 9999;

  /*
   * 所有位移 / 缩放通过 transform 完成（GPU 合成层，不触发 layout）：
   *   translateX(-50%)  — 水平居中
   *   translateY(--bubble-y) — 纵向出入屏（120px=隐藏，0=可见）
   *   scale(--bubble-scale)  — 1.0 → 0.5，跟随上拉进度收缩
   * 从底部中心缩放：气泡从屏幕底部「挤出」，底边始终贴屏。
   */
  transform: translateX(-50%) translateY(var(--bubble-y)) scale(var(--bubble-scale));
  transform-origin: center bottom;

  /* 亮度跟随上拉进度增强（GPU filter，不触发 layout） */
  filter: brightness(var(--bubble-brightness));

  will-change: transform, filter;

  /*
   * CSS 引擎对 @property 自定义属性进行平滑插值
   * 拖拽时 JS 注入 transition: none 覆盖此处，实现零延迟跟手
   */
  transition:
    --bubble-y 0.18s cubic-bezier(0.22, 1, 0.36, 1),
    --bubble-scale 0.15s cubic-bezier(0.22, 1, 0.36, 1),
    --bubble-brightness 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease;
}

/* 达到阈值 → 高亮 */
.pull-bubble--ready {
  background: rgba(99, 102, 241, 1);
  box-shadow:
    0 -8px 40px rgba(99, 102, 241, 0.55),
    0 2px 12px rgba(0, 0, 0, 0.18);
}

/*
 * Q弹水滴消失动画
 * 物理感：拉伸弹起 → 压扁落底 → 二次弹起 → 二次压扁 → 消散
 * 每帧单独设定 animation-timing-function 模拟物理加减速
 */
.pull-bubble--dismiss {
  animation: pull-bubble-water-drop 0.65s linear forwards;
}

@keyframes pull-bubble-water-drop {
  /* 触发时状态：scale=0.5，贴底可见，明度已拉满 */
  0% {
    animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1); /* 加速弹出 */
    transform: translateX(-50%) translateY(0) scale(0.5);
    filter: brightness(1.25);
    opacity: 1;
  }

  /* 快速向上弹起，纵向拉伸（水滴离地瞬间） */
  12% {
    animation-timing-function: cubic-bezier(0.4, 1.4, 0.6, 1); /* 减速+超调落回 */
    transform: translateX(-50%) translateY(-30px) scaleX(0.76) scaleY(1.32);
    filter: brightness(1.65);
    opacity: 1;
  }

  /* 落回压扁（水滴撞击地面） */
  26% {
    animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1); /* 加速二次弹 */
    transform: translateX(-50%) translateY(-3px) scaleX(1.38) scaleY(0.6);
    filter: brightness(0.8);
    opacity: 1;
  }

  /* 二次弹起，适度拉伸 */
  41% {
    animation-timing-function: cubic-bezier(0.4, 1.2, 0.6, 1); /* 减速+超调 */
    transform: translateX(-50%) translateY(-18px) scaleX(0.88) scaleY(1.2);
    filter: brightness(1.45);
    opacity: 1;
  }

  /* 二次落回压扁（幅度减半，能量衰减） */
  55% {
    animation-timing-function: ease-out;
    transform: translateX(-50%) translateY(-2px) scaleX(1.18) scaleY(0.82);
    filter: brightness(0.95);
    opacity: 0.88;
  }

  /* 微弹尾音，气泡开始消散 */
  67% {
    animation-timing-function: ease-in;
    transform: translateX(-50%) translateY(-8px) scale(0.72);
    filter: brightness(1.1);
    opacity: 0.66;
  }

  /* 快速沉降 */
  82% {
    animation-timing-function: ease-in;
    transform: translateX(-50%) translateY(22px) scale(0.38);
    filter: brightness(0.78);
    opacity: 0.3;
  }

  /* 彻底消失在屏幕底部以下 */
  100% {
    transform: translateX(-50%) translateY(110px) scale(0.05);
    filter: brightness(0.5);
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
