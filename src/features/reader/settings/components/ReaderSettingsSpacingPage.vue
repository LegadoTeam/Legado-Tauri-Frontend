<script setup lang="ts">
import { ChevronLeft } from 'lucide-vue-next';
import type { ReaderSettings, ReaderTypography } from '@/components/reader/types';

defineProps<{
  settings: ReaderSettings;
}>();

const emit = defineEmits<{
  back: [];
  'update-typography': [patch: Partial<ReaderTypography>];
}>();
</script>

<template>
  <div class="reader-settings__sub-header">
    <button class="reader-settings__back" @click="emit('back')">
      <ChevronLeft :size="16" />
    </button>
    <span class="reader-settings__sub-title">间距设置</span>
  </div>

  <div class="reader-settings__row">
    <span class="reader-settings__label">行距</span>
    <n-slider
      :value="settings.typography.lineHeight"
      @update:value="(v: number) => emit('update-typography', { lineHeight: v })"
      :min="1.0"
      :max="3.0"
      :step="0.1"
      :format-tooltip="(v: number) => v.toFixed(1)"
      style="flex: 1"
    />
    <span class="reader-settings__val" style="width: 36px">{{
      settings.typography.lineHeight.toFixed(1)
    }}</span>
  </div>
  <div class="reader-settings__row">
    <span class="reader-settings__label">段距</span>
    <n-slider
      :value="settings.typography.paragraphSpacing"
      @update:value="(v: number) => emit('update-typography', { paragraphSpacing: v })"
      :min="0"
      :max="40"
      :step="2"
      style="flex: 1"
    />
    <span class="reader-settings__val" style="width: 36px"
      >{{ settings.typography.paragraphSpacing }}px</span
    >
  </div>
  <div class="reader-settings__row">
    <span class="reader-settings__label">缩进</span>
    <n-slider
      :value="settings.typography.textIndent"
      @update:value="(v: number) => emit('update-typography', { textIndent: v })"
      :min="0"
      :max="4"
      :step="0.5"
      :format-tooltip="(v: number) => v.toFixed(1) + 'em'"
      style="flex: 1"
    />
    <span class="reader-settings__val" style="width: 36px"
      >{{ settings.typography.textIndent }}em</span
    >
  </div>
  <div class="reader-settings__row">
    <span class="reader-settings__label">字距</span>
    <n-slider
      :value="settings.typography.letterSpacing"
      @update:value="(v: number) => emit('update-typography', { letterSpacing: v })"
      :min="0"
      :max="6"
      :step="0.5"
      :format-tooltip="(v: number) => v.toFixed(1) + 'px'"
      style="flex: 1"
    />
    <span class="reader-settings__val" style="width: 36px"
      >{{ settings.typography.letterSpacing }}px</span
    >
  </div>
</template>
