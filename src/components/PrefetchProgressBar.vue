<script setup lang="ts">
import { RefreshCw, X } from 'lucide-vue-next';
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { usePrefetchStore } from '@/stores';

const prefetchStore = usePrefetchStore();
const { manualRunning, manualProgress, manualBookName } = storeToRefs(prefetchStore);
const { cancelManualPrefetch } = prefetchStore;

const pct = computed(() => {
  const { done, total } = manualProgress.value;
  if (!total) {
    return 0;
  }
  return Math.min(100, Math.round((done / total) * 100));
});
</script>

<template>
  <Transition name="prefetch-bar-fade">
    <div v-if="manualRunning" class="prefetch-bar">
      <!-- 进度填充 -->
      <div class="prefetch-bar__fill" :style="{ width: pct + '%' }" />
      <!-- 文字信息 -->
      <div class="prefetch-bar__content">
        <RefreshCw class="prefetch-bar__icon" :size="12" />
        <span class="prefetch-bar__name">{{ manualBookName }}</span>
        <span class="prefetch-bar__count"
          >{{ manualProgress.done }}/{{ manualProgress.total }}</span
        >
        <span class="prefetch-bar__pct">{{ pct }}%</span>
      </div>
      <button class="prefetch-bar__cancel" title="取消缓存" @click="cancelManualPrefetch">
        <X :size="12" :stroke-width="2.5" />
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.prefetch-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  height: 28px;
  display: flex;
  align-items: center;
  background: rgba(20, 20, 30, 0.88);
  backdrop-filter: blur(8px);
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
}

/* 填充进度 */
.prefetch-bar__fill {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(99, 179, 237, 0.25), rgba(129, 140, 248, 0.25));
  transition: width 0.3s ease;
  pointer-events: none;
}

.prefetch-bar__content {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  padding: 0 10px;
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.85);
  white-space: nowrap;
}

.prefetch-bar__icon {
  flex-shrink: 0;
  opacity: 0.7;
  animation: spin-slow 2s linear infinite;
}

@keyframes spin-slow {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.prefetch-bar__name {
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.prefetch-bar__count {
  flex-shrink: 0;
  opacity: 0.6;
}

.prefetch-bar__pct {
  flex-shrink: 0;
  font-weight: 600;
  color: #63b3ed;
  min-width: 36px;
  text-align: right;
}

.prefetch-bar__cancel {
  position: relative;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition:
    color 0.15s,
    background 0.15s;
}

.prefetch-bar__cancel:hover {
  color: #fc8181;
  background: rgba(255, 255, 255, 0.08);
}

/* 进场/退场动画 */
.prefetch-bar-fade-enter-active,
.prefetch-bar-fade-leave-active {
  transition:
    transform 0.2s ease,
    opacity 0.2s;
}

.prefetch-bar-fade-enter-from,
.prefetch-bar-fade-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
