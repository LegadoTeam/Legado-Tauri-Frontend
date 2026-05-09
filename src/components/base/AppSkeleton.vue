<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    variant?: 'text' | 'rect' | 'circle' | 'cover';
    width?: string;
    height?: string;
    lines?: number;
  }>(),
  {
    variant: 'rect',
    width: undefined,
    height: undefined,
    lines: 3,
  },
);

const style = computed(() => {
  const s: Record<string, string> = {};
  if (props.width) {
    s.width = props.width;
  }
  if (props.height && props.variant !== 'cover') {
    s.height = props.height;
  }
  return s;
});
</script>

<template>
  <!-- 多行文字骨架 -->
  <div v-if="variant === 'text'" class="skeleton-text-block">
    <div
      v-for="i in lines"
      :key="i"
      class="skeleton skeleton--text"
      :style="i === lines && lines > 1 ? { width: '60%' } : {}"
    />
  </div>

  <!-- 圆形骨架（头像等） -->
  <div
    v-else-if="variant === 'circle'"
    class="skeleton skeleton--circle"
    :style="style"
    aria-hidden="true"
  />

  <!-- 封面比例骨架 -->
  <div
    v-else-if="variant === 'cover'"
    class="skeleton skeleton--cover"
    :style="props.width ? { width: props.width } : {}"
    aria-hidden="true"
  />

  <!-- 矩形骨架（默认） -->
  <div v-else class="skeleton skeleton--rect" :style="style" aria-hidden="true" />
</template>

<style scoped>
@keyframes skeleton-shine {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.skeleton {
  display: block;
  background: linear-gradient(
    90deg,
    var(--color-border) 25%,
    var(--color-surface-elevated) 50%,
    var(--color-border) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-shine 1.4s ease infinite;
  border-radius: var(--radius-1);
}

.skeleton--rect {
  width: 100%;
  height: 1rem;
  border-radius: var(--radius-1);
}

.skeleton--text {
  width: 100%;
  height: 0.875rem;
  border-radius: var(--radius-1);
}

.skeleton--circle {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: var(--radius-pill);
  flex-shrink: 0;
}

.skeleton--cover {
  width: 100%;
  aspect-ratio: var(--cover-ratio);
  border-radius: var(--cover-radius);
}

.skeleton-text-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
}

@media (prefers-reduced-motion: reduce) {
  .skeleton {
    animation: none;
    background: var(--color-border);
  }
}
</style>
