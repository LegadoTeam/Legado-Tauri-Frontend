<script setup lang="ts">
import type { StyleValue } from 'vue';

defineProps<{
  styleValue: StyleValue;
  skinPresetId?: string;
}>();
</script>

<template>
  <div
    class="reader-modal"
    :style="styleValue"
    :data-reader-skin="skinPresetId || ''"
  >
    <slot />
  </div>
</template>
