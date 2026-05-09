<script setup lang="ts">
import ReaderPluginHost from '@/components/reader/ReaderPluginHost.vue';

defineProps<{
  background?: boolean;
}>();
</script>

<template>
  <div
    v-if="background"
    class="reader-modal__plugin-layer reader-modal__plugin-layer--background"
    aria-hidden="true"
  >
    <ReaderPluginHost
      slot-id="background"
      class="reader-modal__plugin-host reader-modal__plugin-host--background"
    />
  </div>

  <div v-else class="reader-modal__plugin-layer" aria-hidden="true">
    <div class="reader-modal__plugin-host reader-modal__plugin-host--top-left">
      <ReaderPluginHost slot-id="overlay-top-left" />
    </div>
    <div class="reader-modal__plugin-host reader-modal__plugin-host--top-right">
      <ReaderPluginHost slot-id="overlay-top-right" />
    </div>
    <div class="reader-modal__plugin-host reader-modal__plugin-host--bottom-left">
      <ReaderPluginHost slot-id="overlay-bottom-left" />
    </div>
    <div class="reader-modal__plugin-host reader-modal__plugin-host--bottom-right">
      <ReaderPluginHost slot-id="overlay-bottom-right" />
    </div>
  </div>
</template>

<style scoped>
.reader-modal__plugin-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 6;
}

.reader-modal__plugin-layer--background {
  z-index: 0;
}

.reader-modal__plugin-host {
  position: absolute;
  pointer-events: none;
}

.reader-modal__plugin-host--background {
  inset: 0;
}

.reader-modal__plugin-host--top-left {
  top: var(--reader-plugin-top-left-top);
  left: var(--reader-plugin-top-left-left);
}

.reader-modal__plugin-host--top-right {
  top: var(--reader-plugin-top-right-top);
  right: var(--reader-plugin-top-right-right);
}

.reader-modal__plugin-host--bottom-left {
  left: var(--reader-plugin-bottom-left-left);
  bottom: var(--reader-plugin-bottom-left-bottom);
}

.reader-modal__plugin-host--bottom-right {
  right: var(--reader-plugin-bottom-right-right);
  bottom: var(--reader-plugin-bottom-right-bottom);
}
</style>
