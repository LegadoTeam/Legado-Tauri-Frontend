<script setup lang="ts">
import { useOverlayBackstack } from '@/composables/useOverlayBackstack';

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
}>();

useOverlayBackstack(
  () => props.show,
  () => emit('update:show', false),
);
</script>

<template>
  <n-modal
    :show="show"
    :mask-closable="false"
    :auto-focus="false"
    :trap-focus="false"
    transform-origin="center"
    @update:show="emit('update:show', $event)"
  >
    <slot />
  </n-modal>
</template>
