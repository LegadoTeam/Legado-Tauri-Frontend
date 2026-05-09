<script setup lang="ts">
import { Check, ChevronLeft, Copy, Search } from 'lucide-vue-next';
import type { ReaderSettings, ReaderTypography } from '@/components/reader/types';

interface SystemFontItem {
  name: string;
}

defineProps<{
  settings: ReaderSettings;
  systemFonts: SystemFontItem[];
  systemFontsLoading: boolean;
  systemFontsError: string;
  filteredSystemFonts: {
    cjk: SystemFontItem[];
    other: SystemFontItem[];
  };
}>();

const showAllFonts = defineModel<boolean>('showAllFonts', { required: true });
const fontSearchQuery = defineModel<string>('fontSearchQuery', { required: true });

const emit = defineEmits<{
  (e: 'back'): void;
  (e: 'copy-font-list'): void;
  (e: 'update-typography', patch: Partial<ReaderTypography>): void;
}>();
</script>

<template>
  <div class="reader-settings__sub-header">
    <button class="reader-settings__back" @click="emit('back')">
      <ChevronLeft :size="16" />
    </button>
    <span class="reader-settings__sub-title">系统字体</span>
    <button
      class="reader-settings__font-toggle"
      :class="{ 'reader-settings__font-toggle--active': showAllFonts }"
      @click="showAllFonts = !showAllFonts"
    >
      显示全部
    </button>
  </div>

  <div class="reader-settings__font-toolbar">
    <div class="reader-settings__font-search">
      <Search :size="14" style="flex-shrink: 0; opacity: 0.5" />
      <input
        v-model="fontSearchQuery"
        class="reader-settings__font-search-input"
        placeholder="搜索字体名称…"
        type="search"
        autocomplete="off"
      />
      <button
        v-if="fontSearchQuery"
        class="reader-settings__font-search-clear"
        @click="fontSearchQuery = ''"
      >
        ✕
      </button>
    </div>
    <button
      class="reader-settings__font-copy-btn"
      :disabled="systemFonts.length === 0"
      :title="`复制全部 ${systemFonts.length} 个字体名称`"
      @click="emit('copy-font-list')"
    >
      <Copy :size="13" />
      复制列表
    </button>
  </div>

  <div v-if="systemFontsLoading" class="reader-settings__font-state">
    <n-spin size="small" />
    <span>正在读取系统字体…</span>
  </div>
  <div
    v-else-if="systemFontsError"
    class="reader-settings__font-state reader-settings__font-state--error"
  >
    <span>读取失败：{{ systemFontsError }}</span>
  </div>

  <template v-else>
    <div
      v-if="filteredSystemFonts.cjk.length === 0 && filteredSystemFonts.other.length === 0"
      class="reader-settings__font-state"
    >
      <span>未找到匹配字体</span>
    </div>

    <div
      v-else
      class="reader-settings__sys-font-scroll app-scrollbar app-scrollbar--thin app-scrollbar--inverse"
    >
      <template v-if="filteredSystemFonts.cjk.length > 0">
        <div class="reader-settings__font-group-label">中文兼容</div>
        <div class="reader-settings__sys-font-list">
          <button
            v-for="font in filteredSystemFonts.cjk"
            :key="font.name"
            class="reader-settings__sys-font-item"
            :class="{
              'reader-settings__sys-font-item--active':
                settings.typography.fontFamily === font.name,
            }"
            @click="emit('update-typography', { fontFamily: font.name })"
          >
            <div class="reader-settings__sys-font-name">{{ font.name }}</div>
            <div class="reader-settings__sys-font-preview" :style="{ fontFamily: font.name }">
              永字八法 今日春好
            </div>
            <Check
              v-if="settings.typography.fontFamily === font.name"
              class="reader-settings__sys-font-check"
              :size="14"
              stroke="#63e2b7"
              :stroke-width="2.5"
            />
          </button>
        </div>
      </template>

      <template v-if="showAllFonts && filteredSystemFonts.other.length > 0">
        <div class="reader-settings__font-group-label">其他字体</div>
        <div class="reader-settings__sys-font-list">
          <button
            v-for="font in filteredSystemFonts.other"
            :key="font.name"
            class="reader-settings__sys-font-item"
            :class="{
              'reader-settings__sys-font-item--active':
                settings.typography.fontFamily === font.name,
            }"
            @click="emit('update-typography', { fontFamily: font.name })"
          >
            <div class="reader-settings__sys-font-name">{{ font.name }}</div>
            <div class="reader-settings__sys-font-preview" :style="{ fontFamily: font.name }">
              AaBbCc 123 永字八法
            </div>
            <Check
              v-if="settings.typography.fontFamily === font.name"
              class="reader-settings__sys-font-check"
              :size="14"
              stroke="#63e2b7"
              :stroke-width="2.5"
            />
          </button>
        </div>
      </template>
    </div>
  </template>
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

.reader-settings__font-toggle {
  margin-left: auto;
  font-size: 0.6875rem;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.55);
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s,
    border-color 0.15s;
  white-space: nowrap;
}

.reader-settings__font-toggle:hover {
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.9);
}

.reader-settings__font-toggle--active {
  background: rgba(99, 226, 183, 0.15);
  border-color: #63e2b7;
  color: #63e2b7;
}

.reader-settings__font-toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
}

.reader-settings__font-search {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.reader-settings__font-copy-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
  height: 34px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.75rem;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
  white-space: nowrap;
}

.reader-settings__font-copy-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.95);
}

.reader-settings__font-copy-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.reader-settings__font-search-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: inherit;
  font-size: 0.8125rem;
  padding: 0;
  -webkit-appearance: none;
  appearance: none;
}

.reader-settings__font-search-input::placeholder {
  color: rgba(255, 255, 255, 0.35);
}

.reader-settings__font-search-clear {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  padding: 0 2px;
  font-size: 0.75rem;
  line-height: 1;
  transition: color 0.15s;
}

.reader-settings__font-search-clear:hover {
  color: rgba(255, 255, 255, 0.8);
}

.reader-settings__font-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px 0;
  font-size: 0.8125rem;
  opacity: 0.55;
}

.reader-settings__font-state--error {
  color: #ff6b6b;
  opacity: 1;
}

.reader-settings__font-group-label {
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.45;
  padding: 6px 2px 2px;
}

.reader-settings__sys-font-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.reader-settings__sys-font-scroll {
  max-height: 320px;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-right: 4px;
  margin-right: -4px;
}

.reader-settings__sys-font-item {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-rows: auto auto;
  align-items: center;
  row-gap: 2px;
  column-gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  border: none;
  background: rgba(255, 255, 255, 0.04);
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
}

.reader-settings__sys-font-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.reader-settings__sys-font-item--active {
  background: rgba(99, 226, 183, 0.1);
}

.reader-settings__sys-font-name {
  font-size: 0.8125rem;
  font-weight: 500;
  grid-column: 1;
  grid-row: 1;
}

.reader-settings__sys-font-item--active .reader-settings__sys-font-name {
  color: #63e2b7;
}

.reader-settings__sys-font-preview {
  font-size: 0.75rem;
  opacity: 0.55;
  grid-column: 1;
  grid-row: 2;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.reader-settings__sys-font-check {
  grid-column: 2;
  grid-row: 1 / 3;
  flex-shrink: 0;
}
</style>
