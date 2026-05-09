<script setup lang="ts">
import type { DropdownOption } from 'naive-ui';

defineProps<{
  show: boolean;
  x: number;
  y: number;
  options: DropdownOption[];
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'select', key: string): void;
}>();
</script>

<template>
  <n-dropdown
    :show="show"
    :x="x"
    :y="y"
    :options="options"
    placement="bottom-start"
    trigger="manual"
    @clickoutside="emit('update:show', false)"
    @select="emit('select', $event)"
  />
</template>
