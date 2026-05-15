<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';
import type { ReaderSettings, ReaderTypography } from '@/components/reader/types';

type MoreTarget = 'tapControls' | 'spacing' | 'pagePadding' | 'typography' | 'shortcuts';

defineProps<{
  settings: ReaderSettings;
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

  <div class="reader-settings__fw-section">
    <div class="reader-settings__fw-header">
      <span class="reader-settings__fw-label">粗细</span>
      <span class="reader-settings__fw-value">{{ settings.typography.fontWeight }}</span>
    </div>
    <n-slider
      :value="settings.typography.fontWeight"
      :min="100"
      :max="900"
      :step="100"
      :marks="{
        100: '极细',
        200: '超细',
        300: '细体',
        400: '正常',
        500: '中等',
        600: '半粗',
        700: '粗体',
        800: '特粗',
        900: '黑体',
      }"
      :format-tooltip="(v: number) => v.toString()"
      @update:value="(v: number) => emit('update-typography', { fontWeight: v })"
    />
    <div class="reader-settings__fw-warn">
      ⚠️ 大部分字体只内置 400（正常）和 700（粗）两个字重。可变字体（Variable
      Font）才能利用全部字重范围。
    </div>
  </div>

  <div class="reader-settings__row reader-settings__row--col">
    <div class="reader-settings__col-header">
      <span class="reader-settings__label">布局调试</span>
      <n-switch
        :value="settings.layoutDebugMode"
        @update:value="emit('set-layout-debug', $event)"
      />
    </div>
    <span class="reader-settings__hint">显示页边距、内容区和行盒/行距网格</span>
  </div>

  <div v-if="!isComic && !isVideo" class="reader-settings__row reader-settings__row--col">
    <div class="reader-settings__col-header">
      <span class="reader-settings__label">排版诊断</span>
      <button
        class="reader-settings__debug-export-btn"
        :disabled="!canDumpPaginationLayout"
        @click="emit('dump-pagination-layout')"
      >
        输出当前页
      </button>
    </div>
    <span class="reader-settings__hint">导出当前页的详细分页信息到实时日志，仅分页模式可用</span>
  </div>

  <div v-if="!isComic && !isVideo" class="reader-settings__row reader-settings__row--col">
    <div class="reader-settings__col-header">
      <span class="reader-settings__label">音量键</span>
      <n-switch
        :value="settings.volumeKeyPageTurnEnabled"
        @update:value="emit('set-volume-key-page-turn', $event)"
      />
    </div>
    <span class="reader-settings__hint">菜单关闭且未听书时，音量键用于上一页 / 下一页</span>
  </div>

  <div v-if="isMobile" class="reader-settings__row reader-settings__row--col">
    <div class="reader-settings__col-header">
      <span class="reader-settings__label">顶部栏</span>
      <n-switch
        :value="settings.hideTopBarOnMobile"
        @update:value="emit('set-hide-top-bar-on-mobile', $event)"
      />
    </div>
    <span class="reader-settings__hint">手机布局打开菜单时隐藏顶部栏，减少正文遮挡</span>
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

.reader-settings__row--col {
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
  min-height: unset;
}

.reader-settings__col-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.reader-settings__label {
  flex-shrink: 0;
  width: 44px;
  color: rgba(255, 255, 255, 0.65);
  font-size: 13px;
  text-align: left;
}

/* col-header 里标签不限宽，避免换行 */
.reader-settings__col-header .reader-settings__label {
  width: auto;
  white-space: nowrap;
}

/* col 行的标题（占全行，粗细等） */
.reader-settings__row-title {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.65);
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

/* ---- 字体粗细区块 ---- */
.reader-settings__fw-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  /* 为 slider mark 标签留空 */
  padding-bottom: 6px;
}

.reader-settings__fw-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.reader-settings__fw-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.65);
}

.reader-settings__fw-value {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  font-variant-numeric: tabular-nums;
}

.reader-settings__fw-warn {
  font-size: 0.6875rem;
  line-height: 1.5;
  color: rgba(255, 185, 80, 0.85);
  background: rgba(255, 185, 80, 0.08);
  border: 1px solid rgba(255, 185, 80, 0.2);
  border-radius: 6px;
  padding: 6px 10px;
  margin-top: 18px;
}
</style>
