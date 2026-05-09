<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  /** 当前章节索引（0-based） */
  currentIndex: number;
  /** 总章节数 */
  totalChapters: number;
}>();

/** 进度 0–1 */
const progress = computed(() =>
  props.totalChapters > 0
    ? Math.min(Math.max(props.currentIndex / (props.totalChapters - 1), 0), 1)
    : 0,
);
</script>

<template>
  <div
    class="reader-progress"
    role="progressbar"
    :aria-valuenow="currentIndex + 1"
    :aria-valuemin="1"
    :aria-valuemax="totalChapters"
    :aria-label="`第 ${currentIndex + 1} 章，共 ${totalChapters} 章`"
  >
    <div class="reader-progress__bar" :style="{ '--progress': progress }" />
  </div>
</template>

<style scoped>
.reader-progress {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  z-index: var(--z-sticky);
  background: var(--color-border);
  overflow: hidden;
}

.reader-progress__bar {
  height: 100%;
  width: calc(var(--progress, 0) * 100%);
  background: var(--color-accent);
  transition: width var(--dur-base) var(--ease-standard);
  border-radius: 0 2px 2px 0;
}
</style>
