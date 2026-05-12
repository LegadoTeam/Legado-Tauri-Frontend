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
  navigate: [target: 'customFont' | 'uploadedFont'];
  'load-system-fonts': [];
  'load-user-fonts': [];
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

    <!-- 用户上传字体入口 -->
    <button
      class="reader-settings__font-item reader-settings__font-item--nav"
      @click="emit('navigate', 'uploadedFont'); emit('load-user-fonts');"
    >
      <span>上传字体</span>
      <ChevronRight :size="14" />
    </button>

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

<style scoped>
.reader-settings__sub-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.reader-settings__back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background 0.15s;
}

.reader-settings__back:hover {
  background: rgba(255, 255, 255, 0.1);
}

.reader-settings__sub-title {
  font-size: 0.875rem;
  font-weight: 600;
}

.reader-settings__font-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.reader-settings__font-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 8px;
  border: none;
  background: rgba(255, 255, 255, 0.04);
  color: inherit;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background 0.15s;
}

.reader-settings__font-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.reader-settings__font-item--active {
  background: rgba(99, 226, 183, 0.1);
  color: #63e2b7;
}

.reader-settings__font-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
  margin: 4px 0;
}

.reader-settings__font-item--nav {
  justify-content: space-between;
}

.reader-settings__font-custom-badge {
  font-size: 0.625rem;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(99, 226, 183, 0.2);
  color: #63e2b7;
}
</style>
