<script setup lang="ts">
defineProps<{
  /** 下拉进度（0-1） */
  progress: number;
  /** 是否正在刷新 */
  refreshing: boolean;
  /** 是否达到触发阈值 */
  ready: boolean;
}>();
</script>

<template>
  <div
    class="pull-indicator"
    :class="{
      'pull-indicator--ready': ready,
      'pull-indicator--refreshing': refreshing,
    }"
    :style="{ '--pull-progress': progress }"
  >
    <div class="pull-indicator__content">
      <!-- 刷新动画（旋转的圆圈） -->
      <div v-if="refreshing" class="pull-indicator__spinner">
        <svg viewBox="0 0 24 24" fill="none">
          <circle
            class="pull-indicator__spinner-track"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="2"
          />
          <circle
            class="pull-indicator__spinner-head"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-dasharray="31.4"
            stroke-dashoffset="10"
          />
        </svg>
      </div>
      <!-- 下拉箭头 -->
      <div v-else class="pull-indicator__arrow" :class="{ 'pull-indicator__arrow--up': ready }">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      </div>
      <!-- 提示文字 -->
      <span class="pull-indicator__text">
        <template v-if="refreshing">刷新中...</template>
        <template v-else-if="ready">释放刷新</template>
        <template v-else>下拉刷新</template>
      </span>
    </div>
  </div>
</template>

<style scoped>
.pull-indicator {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 0;
  overflow: hidden;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  pointer-events: none;
  z-index: 10;
  transition: height 0.1s ease-out;
}

.pull-indicator__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding-top: 8px;
  transform: translateY(calc(var(--pull-progress, 0) * 1px));
  opacity: var(--pull-progress, 0);
  transition: opacity 0.15s ease;
}

.pull-indicator__spinner {
  width: 20px;
  height: 20px;
  color: var(--color-accent);
}

.pull-indicator__spinner svg {
  width: 100%;
  height: 100%;
}

.pull-indicator__spinner-track {
  opacity: 0.25;
}

.pull-indicator__spinner-head {
  transform-origin: center;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.pull-indicator__arrow {
  width: 20px;
  height: 20px;
  color: var(--color-text-muted);
  transition: transform 0.2s ease, color 0.2s ease;
}

.pull-indicator__arrow svg {
  width: 100%;
  height: 100%;
}

.pull-indicator--ready .pull-indicator__arrow {
  color: var(--color-accent);
}

.pull-indicator__arrow--up {
  transform: rotate(180deg);
}

.pull-indicator__text {
  font-size: 12px;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.pull-indicator--ready .pull-indicator__text {
  color: var(--color-accent);
}

.pull-indicator--refreshing .pull-indicator__text {
  color: var(--color-accent);
}

/* 刷新时的样式 */
.pull-indicator--refreshing .pull-indicator__content {
  transform: translateY(0);
  opacity: 1;
}

.pull-indicator--refreshing {
  height: auto;
}
</style>
