<script setup lang="ts">
defineProps<{
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
  loading?: boolean;
  disabled?: boolean;
}>();
</script>

<template>
  <button
    class="app-button focusable"
    :data-variant="variant ?? 'secondary'"
    :data-size="size ?? 'md'"
    :class="{ 'app-button--block': block }"
    :disabled="disabled || loading"
    :aria-disabled="disabled || loading ? 'true' : undefined"
    :aria-busy="loading ? 'true' : undefined"
  >
    <span v-if="loading" class="app-button__spinner" aria-hidden="true" />
    <slot />
  </button>
</template>

<style scoped>
.app-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);

  min-height: var(--tap-target);
  padding-inline: var(--space-4);
  padding-block: var(--space-2);

  border: none;
  border-radius: var(--radius-2);
  font-size: var(--fs-15);
  font-weight: var(--fw-medium);
  line-height: var(--lh-tight);
  white-space: nowrap;
  text-decoration: none;

  cursor: pointer;
  transition:
    background var(--dur-fast) var(--ease-standard),
    color var(--dur-fast) var(--ease-standard),
    opacity var(--dur-fast) var(--ease-standard);
}

.app-button--block {
  width: 100%;
}

/* size */
.app-button[data-size='sm'] {
  min-height: var(--control-sm);
  padding-inline: var(--space-3);
  font-size: var(--fs-13);
}

.app-button[data-size='lg'] {
  min-height: var(--control-lg);
  padding-inline: var(--space-5);
  font-size: var(--fs-16);
}

/* variant: primary */
.app-button[data-variant='primary'] {
  background: var(--color-accent);
  color: var(--color-accent-contrast);
}

@media (hover: hover) and (pointer: fine) {
  .app-button[data-variant='primary']:hover {
    background: var(--color-accent-hover);
  }
}

.app-button[data-variant='primary']:active {
  background: var(--color-accent-hover);
}

/* variant: secondary */
.app-button[data-variant='secondary'] {
  background: var(--color-surface);
  color: var(--color-text);
  box-shadow: inset 0 0 0 1px var(--color-border);
}

@media (hover: hover) and (pointer: fine) {
  .app-button[data-variant='secondary']:hover {
    background: var(--color-hover);
  }
}

/* variant: ghost */
.app-button[data-variant='ghost'] {
  background: transparent;
  color: var(--color-text);
}

@media (hover: hover) and (pointer: fine) {
  .app-button[data-variant='ghost']:hover {
    background: var(--color-hover);
  }
}

/* variant: danger */
.app-button[data-variant='danger'] {
  background: var(--color-danger-bg);
  color: var(--color-danger);
  box-shadow: inset 0 0 0 1px var(--color-danger-border);
}

@media (hover: hover) and (pointer: fine) {
  .app-button[data-variant='danger']:hover {
    opacity: 0.85;
  }
}

/* disabled / loading */
.app-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* spinner */
.app-button__spinner {
  width: 1em;
  height: 1em;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: app-button-spin 0.7s linear infinite;
  flex-shrink: 0;
}

@keyframes app-button-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
