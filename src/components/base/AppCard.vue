<script setup lang="ts">
defineProps<{
  interactive?: boolean;
  selected?: boolean;
  elevation?: 0 | 1 | 2;
  padded?: boolean;
}>();
</script>

<template>
  <div
    class="app-card"
    :class="{ 'app-card--padded': padded !== false, 'app-card--selected': selected }"
    :data-elevation="elevation ?? 1"
    :tabindex="interactive ? 0 : undefined"
    :role="interactive ? 'button' : undefined"
    v-bind="interactive ? { class: 'app-card focusable' } : {}"
  >
    <slot />
  </div>
</template>

<style scoped>
.app-card {
  background: var(--color-surface);
  border-radius: var(--radius-2);
  transition: background var(--dur-fast) var(--ease-standard);
}

.app-card--padded {
  padding: var(--space-4);
}

.app-card[data-elevation='0'] {
  box-shadow: var(--shadow-0);
}

.app-card[data-elevation='1'] {
  box-shadow: var(--shadow-1);
}

.app-card[data-elevation='2'] {
  box-shadow: var(--shadow-2);
}

.app-card--selected {
  background: var(--color-accent-soft);
}

@media (hover: hover) and (pointer: fine) {
  .app-card[tabindex='0']:hover {
    background: var(--color-hover);
  }
}

.app-card[tabindex='0']:active {
  background: var(--color-active);
}
</style>
