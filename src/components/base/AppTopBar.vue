<script setup lang="ts">
import { ChevronLeft } from 'lucide-vue-next';

defineProps<{
  title?: string;
  showBack?: boolean;
}>();

const emit = defineEmits<{
  back: [];
}>();
</script>

<template>
  <header class="app-top-bar">
    <div class="app-top-bar__leading">
      <button
        v-if="showBack"
        class="app-top-bar__back focusable"
        aria-label="返回"
        @click="$emit('back')"
      >
        <ChevronLeft :size="20" aria-hidden="true" />
      </button>
      <slot name="leading" />
    </div>
    <span v-if="title" class="app-top-bar__title">{{ title }}</span>
    <div class="app-top-bar__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.app-top-bar {
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);

  min-height: var(--topbar-height);
  padding-top: var(--safe-top);
  padding-inline: var(--space-3);

  display: flex;
  align-items: center;
  gap: var(--space-2);

  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.app-top-bar__leading {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-shrink: 0;
}

.app-top-bar__title {
  flex: 1;
  font-size: var(--fs-18);
  font-weight: var(--fw-semibold);
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-top-bar__actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-shrink: 0;
  margin-inline-start: auto;
}

.app-top-bar__back {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: var(--tap-target);
  min-height: var(--tap-target);
  background: transparent;
  border: none;
  border-radius: var(--radius-2);
  color: var(--color-text);
  transition: background var(--dur-fast) var(--ease-standard);
}

@media (hover: hover) and (pointer: fine) {
  .app-top-bar__back:hover {
    background: var(--color-hover);
  }
}
</style>
