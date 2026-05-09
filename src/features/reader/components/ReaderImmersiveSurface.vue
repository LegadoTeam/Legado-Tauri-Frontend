<script setup lang="ts">
import type { StyleValue } from 'vue';
import { ref } from 'vue';
import ReaderContentArea from '@/components/reader/ReaderContentArea.vue';
import ReaderMenuLayer from './ReaderMenuLayer.vue';
import ReaderPluginLayer from './ReaderPluginLayer.vue';
import ReaderShell from './ReaderShell.vue';

defineProps<{
  styleValue: StyleValue;
  skinPresetId?: string;
}>();

const menuLayerRef = ref<{ closeSettings?: () => void } | null>(null);

function closeSettings() {
  menuLayerRef.value?.closeSettings?.();
}

defineExpose({ closeSettings });
</script>

<template>
  <ReaderShell :style-value="styleValue" :skin-preset-id="skinPresetId">
    <ReaderPluginLayer background />
    <ReaderContentArea />
    <ReaderPluginLayer />
    <ReaderMenuLayer ref="menuLayerRef" />
  </ReaderShell>
</template>
