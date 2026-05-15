<script setup lang="ts">
import { ChevronLeft } from 'lucide-vue-next';
import type { ReaderSettings, ReaderPagePadding } from '@/components/reader/types';

defineProps<{
  settings: ReaderSettings;
}>();

const emit = defineEmits<{
  back: [];
  'update-page-padding': [patch: Partial<ReaderPagePadding>];
}>();
</script>

<template>
  <div class="reader-settings__sub-header">
    <button class="reader-settings__back" @click="emit('back')">
      <ChevronLeft :size="16" />
    </button>
    <span class="reader-settings__sub-title">页边距设置</span>
  </div>

  <div class="reader-settings__row">
    <span class="reader-settings__label">上边距</span>
    <n-slider
      :value="settings.pagePadding.top"
      @update:value="(v: number) => emit('update-page-padding', { top: v })"
      :min="4"
      :max="96"
      :step="4"
      style="flex: 1"
    />
    <span class="reader-settings__val" style="width: 40px">{{ settings.pagePadding.top }}px</span>
  </div>
  <div class="reader-settings__row">
    <span class="reader-settings__label">右边距</span>
    <n-slider
      :value="settings.pagePadding.right"
      @update:value="(v: number) => emit('update-page-padding', { right: v })"
      :min="4"
      :max="96"
      :step="4"
      style="flex: 1"
    />
    <span class="reader-settings__val" style="width: 40px">{{ settings.pagePadding.right }}px</span>
  </div>
  <div class="reader-settings__row">
    <span class="reader-settings__label">下边距</span>
    <n-slider
      :value="settings.pagePadding.bottom"
      @update:value="(v: number) => emit('update-page-padding', { bottom: v })"
      :min="4"
      :max="96"
      :step="4"
      style="flex: 1"
    />
    <span class="reader-settings__val" style="width: 40px"
      >{{ settings.pagePadding.bottom }}px</span
    >
  </div>
  <div class="reader-settings__row">
    <span class="reader-settings__label">左边距</span>
    <n-slider
      :value="settings.pagePadding.left"
      @update:value="(v: number) => emit('update-page-padding', { left: v })"
      :min="4"
      :max="96"
      :step="4"
      style="flex: 1"
    />
    <span class="reader-settings__val" style="width: 40px">{{ settings.pagePadding.left }}px</span>
  </div>
</template>
