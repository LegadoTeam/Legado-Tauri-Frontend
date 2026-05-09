<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useFrontendPlugins, type ReaderPluginSlot } from '@/composables/useFrontendPlugins';

const props = defineProps<{
  slotId: ReaderPluginSlot;
}>();

const hostRef = ref<HTMLElement | null>(null);
const { registerReaderHost } = useFrontendPlugins();

let cleanup: (() => void | Promise<void>) | null = null;

onMounted(() => {
  if (!hostRef.value) {
    return;
  }
  cleanup = registerReaderHost(props.slotId, hostRef.value);
});

onBeforeUnmount(() => {
  void cleanup?.();
  cleanup = null;
});
</script>

<template>
  <div ref="hostRef" class="reader-plugin-host" :data-slot-id="slotId" />
</template>

<style scoped>
.reader-plugin-host {
  width: 100%;
  height: 100%;
}
</style>
