<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';
import type { ReaderSettings, ReaderTypography } from '@/components/reader/types';

type MoreTarget = 'tapControls' | 'spacing' | 'pagePadding' | 'typography' | 'shortcuts';

defineProps<{
  settings: ReaderSettings;
  fontWeightPresets: Array<{ label: string; value: number }>;
  isComic: boolean;
  isVideo: boolean;
  isMobile: boolean;
  canDumpPaginationLayout: boolean;
}>();

const emit = defineEmits<{
  (e: 'back'): void;
  (e: 'reset'): void;
  (e: 'update-typography', patch: Partial<ReaderTypography>): void;
  (e: 'set-layout-debug', value: boolean): void;
  (e: 'set-volume-key-page-turn', value: boolean): void;
  (e: 'set-hide-top-bar-on-mobile', value: boolean): void;
  (e: 'dump-pagination-layout'): void;
  (e: 'navigate', target: MoreTarget): void;
}>();
</script>

<template>
  <div class="reader-settings__sub-header">
    <button class="reader-settings__back" @click="emit('back')">
      <ChevronLeft :size="16" />
    </button>
    <span class="reader-settings__sub-title">更多设置</span>
    <button
      class="reader-settings__reset-btn"
      title="恢复所有阅读设置为默认值"
      @click="emit('reset')"
    >
      恢复默认
    </button>
  </div>

  <div class="reader-settings__row">
    <span class="reader-settings__label">粗细</span>
    <div class="reader-settings__pill-group">
      <button
        v-for="weight in fontWeightPresets"
        :key="weight.value"
        class="reader-settings__pill"
        :class="{ 'reader-settings__pill--active': settings.typography.fontWeight === weight.value }"
        :style="{ fontWeight: weight.value }"
        @click="emit('update-typography', { fontWeight: weight.value })"
      >
        {{ weight.label }}
      </button>
    </div>
  </div>

  <div class="reader-settings__row">
    <span class="reader-settings__label">布局调试</span>
    <div class="reader-settings__switch-row">
      <span class="reader-settings__hint">显示页边距、内容区和行盒/行距网格</span>
      <n-switch
        :value="settings.layoutDebugMode"
        @update:value="emit('set-layout-debug', $event)"
      />
    </div>
  </div>

  <div v-if="!isComic && !isVideo" class="reader-settings__row">
    <span class="reader-settings__label">排版诊断</span>
    <div class="reader-settings__switch-row">
      <span class="reader-settings__hint">导出当前页的详细分页信息到实时日志，仅分页模式可用</span>
      <button
        class="reader-settings__debug-export-btn"
        :disabled="!canDumpPaginationLayout"
        @click="emit('dump-pagination-layout')"
      >
        输出当前页
      </button>
    </div>
  </div>

  <div v-if="!isComic && !isVideo" class="reader-settings__row">
    <span class="reader-settings__label">音量键</span>
    <div class="reader-settings__switch-row">
      <span class="reader-settings__hint">菜单关闭且未听书时，音量键用于上一页 / 下一页</span>
      <n-switch
        :value="settings.volumeKeyPageTurnEnabled"
        @update:value="emit('set-volume-key-page-turn', $event)"
      />
    </div>
  </div>

  <div v-if="isMobile" class="reader-settings__row">
    <span class="reader-settings__label">顶部栏</span>
    <div class="reader-settings__switch-row">
      <span class="reader-settings__hint">手机布局打开菜单时隐藏顶部栏，减少正文遮挡</span>
      <n-switch
        :value="settings.hideTopBarOnMobile"
        @update:value="emit('set-hide-top-bar-on-mobile', $event)"
      />
    </div>
  </div>

  <div class="reader-settings__more-list">
    <button
      v-if="!isComic"
      class="reader-settings__more-item"
      @click="emit('navigate', 'tapControls')"
    >
      <span>点击控制</span>
      <ChevronRight :size="14" />
    </button>
    <button class="reader-settings__more-item" @click="emit('navigate', 'spacing')">
      <span>间距设置</span>
      <ChevronRight :size="14" />
    </button>
    <button class="reader-settings__more-item" @click="emit('navigate', 'pagePadding')">
      <span>页边距设置</span>
      <ChevronRight :size="14" />
    </button>
    <button class="reader-settings__more-item" @click="emit('navigate', 'typography')">
      <span>字体样式</span>
      <ChevronRight :size="14" />
    </button>
    <button class="reader-settings__more-item" @click="emit('navigate', 'shortcuts')">
      <span>快捷键说明</span>
      <ChevronRight :size="14" />
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

.reader-settings__reset-btn,
.reader-settings__debug-export-btn {
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s,
    border-color 0.15s;
  white-space: nowrap;
}

.reader-settings__reset-btn {
  margin-left: auto;
  padding: 3px 10px;
  font-size: 0.6875rem;
}

.reader-settings__reset-btn:hover {
  background: rgba(251, 191, 36, 0.15);
  border-color: #fbbf24;
  color: #fbbf24;
}

.reader-settings__row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 36px;
}

.reader-settings__label {
  flex-shrink: 0;
  width: 44px;
  color: rgba(255, 255, 255, 0.65);
  font-size: 13px;
  text-align: left;
}

.reader-settings__hint {
  font-size: 12px;
  line-height: 1.35;
  color: rgba(255, 255, 255, 0.5);
}

.reader-settings__switch-row {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.reader-settings__debug-export-btn {
  flex-shrink: 0;
  padding: 4px 10px;
  font-size: 0.75rem;
}

.reader-settings__debug-export-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.14);
  color: rgba(255, 255, 255, 0.95);
}

.reader-settings__debug-export-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.reader-settings__pill-group {
  display: flex;
  gap: 6px;
  flex: 1;
}

.reader-settings__pill-group .reader-settings__pill {
  flex: 1;
}

.reader-settings__pill {
  height: 36px;
  min-width: 0;
  padding: 0 12px;
  border: 0;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.08);
  color: inherit;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
}

.reader-settings__pill:hover {
  background: rgba(255, 255, 255, 0.14);
}

.reader-settings__pill--active {
  background: rgba(99, 226, 183, 0.15);
  color: #63e2b7;
}

.reader-settings__more-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 4px;
}

.reader-settings__more-item {
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

.reader-settings__more-item:hover {
  background: rgba(255, 255, 255, 0.1);
}
</style>
