<script setup lang="ts">
import { ChevronLeft, ChevronRight, Check } from 'lucide-vue-next';
import type { ReaderSettings, ReaderTypography } from '@/components/reader/types';

defineProps<{
  settings: ReaderSettings;
  fontPresets: Array<{ label: string; value: string }>;
}>();

const emit = defineEmits<{
  back: [];
  'update-typography': [patch: Partial<ReaderTypography>];
  navigate: [target: 'customFont'];
  'load-system-fonts': [];
}>();
</script>

<template>
  <div class="reader-settings__sub-header">
    <button class="reader-settings__back" @click="emit('back')">
      <ChevronLeft :size="16" />
    </button>
    <span class="reader-settings__sub-title">字体选择</span>
  </div>

  <div class="reader-settings__font-list">
    <button
      v-for="fp in fontPresets"
      :key="fp.label"
      class="reader-settings__font-item"
      :class="{
        'reader-settings__font-item--active': settings.typography.fontFamily === fp.value,
      }"
      :style="{ fontFamily: fp.value }"
      @click="emit('update-typography', { fontFamily: fp.value })"
    >
      <span>{{ fp.label }}</span>
      <Check
        v-if="settings.typography.fontFamily === fp.value"
        :size="16"
        stroke="#63e2b7"
        :stroke-width="2.5"
      />
    </button>

    <!-- 分隔线 -->
    <div class="reader-settings__font-divider" />

    <!-- 自定义系统字体入口 -->
    <button
      class="reader-settings__font-item reader-settings__font-item--nav"
      :class="{
        'reader-settings__font-item--active':
          !fontPresets.some((p) => p.value === settings.typography.fontFamily) &&
          settings.typography.fontFamily !== '',
      }"
      @click="emit('navigate', 'customFont'); emit('load-system-fonts');"
    >
      <span>自定义系统字体</span>
      <div style="display: flex; align-items: center; gap: 6px">
        <span
          v-if="
            !fontPresets.some((p) => p.value === settings.typography.fontFamily) &&
            settings.typography.fontFamily
          "
          class="reader-settings__font-custom-badge"
          >已选</span
        >
        <ChevronRight :size="14" />
      </div>
    </button>
  </div>
</template>
