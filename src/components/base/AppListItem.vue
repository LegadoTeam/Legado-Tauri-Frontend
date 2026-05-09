<script setup lang="ts">
defineProps<{
  title: string;
  desc?: string;
  selected?: boolean;
  disabled?: boolean;
  role?: string;
}>();

const emit = defineEmits<{
  click: [];
}>();

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    emit('click');
  }
}
</script>

<template>
  <div
    class="app-list-item focusable"
    :class="{
      'app-list-item--selected': selected,
      'app-list-item--disabled': disabled,
    }"
    :tabindex="disabled ? -1 : 0"
    :role="role ?? 'listitem'"
    :aria-selected="selected ? 'true' : undefined"
    :aria-disabled="disabled ? 'true' : undefined"
    @click="!disabled && $emit('click')"
    @keydown="onKeyDown"
  >
    <span v-if="$slots.leading" class="app-list-item__leading">
      <slot name="leading" />
    </span>
    <span class="app-list-item__body">
      <span class="app-list-item__title">{{ title }}</span>
      <span v-if="desc" class="app-list-item__desc">{{ desc }}</span>
    </span>
    <span v-if="$slots.trailing" class="app-list-item__trailing">
      <slot name="trailing" />
    </span>
  </div>
</template>

<style scoped>
.app-list-item {
  min-height: var(--tap-target);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-2);
  display: flex;
  align-items: center;
  gap: var(--space-3);
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease-standard);
}

.app-list-item__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.app-list-item__title {
  font-size: var(--fs-15);
  color: var(--color-text);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}

.app-list-item__desc {
  font-size: var(--fs-13);
  color: var(--color-text-soft);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-list-item__leading {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.app-list-item__trailing {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.app-list-item--selected {
  background: var(--color-accent-soft);
  color: var(--color-accent);
}

.app-list-item--selected .app-list-item__title {
  color: var(--color-accent);
}

.app-list-item--disabled {
  opacity: 0.56;
  cursor: not-allowed;
}

@media (hover: hover) and (pointer: fine) {
  .app-list-item:not(.app-list-item--disabled):hover {
    background: var(--color-hover);
  }
}
</style>
