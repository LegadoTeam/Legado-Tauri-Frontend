<script setup lang="ts">
import AppInput from '@/components/base/AppInput.vue';

defineProps<{
  show: boolean;
  searchKw: string;
}>();

const emit = defineEmits<{
  (e: 'update:searchKw', value: string): void;
}>();
</script>

<template>
  <div v-if="show" class="bs-toolbar">
    <AppInput
      :model-value="searchKw"
      placeholder="搜索书架..."
      style="max-width: 280px"
      @update:model-value="emit('update:searchKw', $event)"
    />
  </div>
</template>

<style scoped>
.bs-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 24px 8px;
}
@media (pointer: coarse), (max-width: 640px) {
  .bs-toolbar {
    padding: 4px 16px 8px;
  }
}
</style>
