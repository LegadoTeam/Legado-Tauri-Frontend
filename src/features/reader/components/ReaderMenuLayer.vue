<script setup lang="ts">
import LegacyReaderMenuLayer from '@/components/explore/ReaderMenuLayer.vue';

defineOptions({
  inheritAttrs: false,
});
</script>

<template>
  <LegacyReaderMenuLayer v-bind="$attrs" />
</template>
