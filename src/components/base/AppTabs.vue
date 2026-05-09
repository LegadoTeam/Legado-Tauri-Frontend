<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  modelValue: string | number;
  tabs: Array<{ key: string | number; label: string }>;
}>();

const emit = defineEmits<{
  'update:modelValue': [key: string | number];
}>();

function selectTab(key: string | number) {
  emit('update:modelValue', key);
}

function onKeyDown(event: KeyboardEvent) {
  const currentIdx = props.tabs.findIndex((t) => t.key === props.modelValue);
  if (currentIdx === -1) {
    return;
  }

  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    event.preventDefault();
    const next = props.tabs[(currentIdx + 1) % props.tabs.length];
    selectTab(next.key);
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    event.preventDefault();
    const prev = props.tabs[(currentIdx - 1 + props.tabs.length) % props.tabs.length];
    selectTab(prev.key);
  }
}

const activeIdx = computed(() => props.tabs.findIndex((t) => t.key === props.modelValue));
</script>

<template>
  <div class="app-tabs" role="tablist" @keydown="onKeyDown">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      class="app-tabs__tab focusable"
      role="tab"
      :aria-selected="modelValue === tab.key ? 'true' : 'false'"
      :tabindex="modelValue === tab.key ? 0 : -1"
      @click="selectTab(tab.key)"
    >
      {{ tab.label }}
    </button>
    <span
      class="app-tabs__indicator"
      :style="{ '--tab-active-idx': activeIdx, '--tab-count': tabs.length }"
    />
  </div>
</template>

<style scoped>
.app-tabs {
  position: relative;
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--color-border);
  overflow-x: auto;
  scrollbar-width: none;
}

.app-tabs::-webkit-scrollbar {
  display: none;
}

.app-tabs__tab {
  position: relative;
  flex-shrink: 0;
  min-height: var(--control-md);
  padding-inline: var(--space-4);
  border: none;
  background: transparent;
  font-size: var(--fs-14);
  font-weight: var(--fw-medium);
  color: var(--color-text-soft);
  cursor: pointer;
  transition: color var(--dur-fast) var(--ease-standard);
}

.app-tabs__tab[aria-selected='true'] {
  color: var(--color-accent);
}

@media (hover: hover) and (pointer: fine) {
  .app-tabs__tab:not([aria-selected='true']):hover {
    color: var(--color-text);
  }
}

.app-tabs__indicator {
  position: absolute;
  bottom: 0;
  height: 2px;
  background: var(--color-accent);
  width: calc(100% / var(--tab-count));
  left: calc(var(--tab-active-idx) * (100% / var(--tab-count)));
  border-radius: 2px 2px 0 0;
  transition: left var(--dur-base) var(--ease-standard);
}
</style>
