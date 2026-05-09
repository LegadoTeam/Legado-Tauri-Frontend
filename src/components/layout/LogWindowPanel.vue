<script setup lang="ts">
import { ArrowDown, Copy, Minus, Pause, Play, Trash2, X } from 'lucide-vue-next';
import { useMessage } from 'naive-ui';
import { computed, nextTick, reactive, ref, watch } from 'vue';
import { isMobile } from '@/composables/useEnv';
import { useOverlayBackstack } from '@/composables/useOverlayBackstack';
import { copyText } from '@/utils/clipboard';
import type { FilterType } from './log/useLogState';
import LogEntry from './log/LogEntry.vue';
import LogFab from './log/LogFab.vue';
import { useLogState } from './log/useLogState';

// ─────────────────────────────────────────────────────────────
// Props / Emits
// ─────────────────────────────────────────────────────────────

const props = withDefaults(
  defineProps<{
    show?: boolean;
  }>(),
  { show: false },
);

const emit = defineEmits<{
  'update:show': [value: boolean];
  close: [];
}>();

const message = useMessage();

// ─────────────────────────────────────────────────────────────
// Log state（composable）
// ─────────────────────────────────────────────────────────────

const scrollEl = ref<HTMLElement | null>(null);

const {
  logs,
  filterType,
  filterText,
  filterSource,
  filterLevel,
  paused,
  autoScroll,
  activeHttpTab,
  expandedIds,
  expandedMsgIds,
  sourceNames,
  counts,
  filteredLogs,
  unreadErrorCount,
  clearLogs,
  formatTime,
  scrollToBottom,
  onScroll,
  toggleExpand,
  toggleExpandMsg,
} = useLogState(scrollEl);

// ─────────────────────────────────────────────────────────────
// Minimized state
// ─────────────────────────────────────────────────────────────

/**
 * 最小化时：面板隐藏，显示可拖拽的虫子 FAB 图标（两端通用）。
 * 再次点击 FAB 或面板关闭时，还原为 false。
 */
const minimized = ref(false);

useOverlayBackstack(
  () => props.show && !minimized.value,
  () => {
    close();
  },
);

// 面板关闭时重置最小化，确保下次打开显示完整面板
watch(
  () => props.show,
  (show) => {
    if (!show) {
      minimized.value = false;
      positioned.value = false; // 重置定位标志，每次打开时都重新居中
    }
  },
);

// ─────────────────────────────────────────────────────────────
// Size / Position（桌面端拖拽 + 调整大小）
// ─────────────────────────────────────────────────────────────

const DEFAULT_W = 840;
const DEFAULT_H = 520;

const pos = reactive({ x: 0, y: 0 });
const size = reactive({ w: DEFAULT_W, h: DEFAULT_H });
const positioned = ref(false);

function resetPosition() {
  if (isMobile.value) {
    pos.x = 0;
    pos.y = 0;
    return;
  }
  pos.x = Math.max(8, Math.floor((window.innerWidth - size.w) / 2));
  pos.y = Math.max(8, Math.floor((window.innerHeight - size.h) * 0.25));
}

// 首次打开时居中定位
watch(
  () => props.show,
  (show) => {
    if (show && !positioned.value) {
      positioned.value = true;
      nextTick(() => resetPosition());
    }
  },
  { immediate: true },
);

// ── 拖拽 ───────────────────────────────────────────────────────

let dragActive = false;
let dragSX = 0;
let dragSY = 0;
let dragSPX = 0;
let dragSPY = 0;

function onDragStart(e: PointerEvent) {
  if (isMobile.value) return;
  const target = e.target as HTMLElement;
  if (target.closest('button, select, input, a')) return;
  dragActive = true;
  dragSX = e.clientX;
  dragSY = e.clientY;
  dragSPX = pos.x;
  dragSPY = pos.y;
  window.addEventListener('pointermove', onDragMove, { passive: false });
  window.addEventListener('pointerup', onDragEnd, { once: true });
  e.preventDefault();
}

function onDragMove(e: PointerEvent) {
  if (!dragActive) return;
  pos.x = Math.max(0, Math.min(window.innerWidth - 80, dragSPX + e.clientX - dragSX));
  pos.y = Math.max(0, Math.min(window.innerHeight - 40, dragSPY + e.clientY - dragSY));
  e.preventDefault();
}

function onDragEnd() {
  dragActive = false;
  window.removeEventListener('pointermove', onDragMove);
}

// ── 调整大小 ────────────────────────────────────────────────────

let resizeActive = false;
let resizeSX = 0;
let resizeSY = 0;
let resizeSW = 0;
let resizeSH = 0;

function onResizeStart(e: PointerEvent) {
  if (isMobile.value) return;
  resizeActive = true;
  resizeSX = e.clientX;
  resizeSY = e.clientY;
  resizeSW = size.w;
  resizeSH = size.h;
  window.addEventListener('pointermove', onResizeMove, { passive: false });
  window.addEventListener('pointerup', onResizeEnd, { once: true });
  e.preventDefault();
  e.stopPropagation();
}

function onResizeMove(e: PointerEvent) {
  if (!resizeActive) return;
  size.w = Math.max(320, resizeSW + e.clientX - resizeSX);
  size.h = Math.max(200, resizeSH + e.clientY - resizeSY);
  e.preventDefault();
}

function onResizeEnd() {
  resizeActive = false;
  window.removeEventListener('pointermove', onResizeMove);
}

// ─────────────────────────────────────────────────────────────
// Panel style
// ─────────────────────────────────────────────────────────────

const panelStyle = computed(() => {
  if (isMobile.value) {
    return {
      left: '0',
      right: '0',
      bottom: '0',
      width: '100%',
      height: '65vh',
      borderRadius: '12px 12px 0 0',
      top: 'unset',
    };
  }
  return {
    left: `${pos.x}px`,
    top: `${pos.y}px`,
    width: `${size.w}px`,
    height: `${size.h}px`,
    borderRadius: '8px',
  };
});

// ─────────────────────────────────────────────────────────────
// Close
// ─────────────────────────────────────────────────────────────

function close() {
  minimized.value = false;
  emit('update:show', false);
  emit('close');
}

function onBackdropClick(e: MouseEvent) {
  if (isMobile.value && e.target === e.currentTarget) {
    minimized.value = true;
  }
}

function formatDetailMap(title: string, detail: Record<string, string>) {
  const lines = Object.entries(detail).map(([key, value]) => `${key}: ${value}`);
  if (lines.length === 0) {
    return '';
  }
  return `${title}:\n${lines.join('\n')}`;
}

function formatLogForCopy() {
  return filteredLogs.value
    .map((entry) => {
      const head = [
        `[${formatTime(entry.time)}]`,
        `[${entry.type.toUpperCase()}]`,
        `[${entry.level.toUpperCase()}]`,
        entry.sourceName ? `[${entry.sourceName}]` : '',
      ]
        .filter(Boolean)
        .join(' ');

      if (!entry.httpDetail) {
        return `${head} ${entry.message}`;
      }

      const sections = [
        `${head} ${entry.message}`,
        `URL: ${entry.httpDetail.url}`,
        `Method: ${entry.httpDetail.method}`,
        `Status: ${entry.httpDetail.status || 'N/A'}`,
        `Elapsed: ${entry.httpDetail.elapsed}ms`,
      ];

      if (entry.httpDetail.error) {
        sections.push(`Error: ${entry.httpDetail.error}`);
      }
      if (entry.httpDetail.requestBody) {
        sections.push(`Request Body:\n${entry.httpDetail.requestBody}`);
      }
      if (entry.httpDetail.responseBody) {
        sections.push(`Response Body:\n${entry.httpDetail.responseBody}`);
      }

      const requestHeaders = formatDetailMap('Request Headers', entry.httpDetail.requestHeaders);
      const responseHeaders = formatDetailMap('Response Headers', entry.httpDetail.responseHeaders);
      if (requestHeaders) {
        sections.push(requestHeaders);
      }
      if (responseHeaders) {
        sections.push(responseHeaders);
      }

      return sections.join('\n');
    })
    .join('\n\n');
}

async function handleCopyLogs() {
  if (filteredLogs.value.length === 0) {
    message.warning('当前没有可复制的日志');
    return;
  }
  try {
    await copyText(formatLogForCopy());
    message.success(`已复制 ${filteredLogs.value.length} 条日志`);
  } catch (error) {
    message.error(`复制失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function handlePauseToggle() {
  paused.value = !paused.value;
  message.info(paused.value ? '已暂停接收新日志' : '已继续接收实时日志');
}

function handleClearLogs() {
  clearLogs();
  message.success('日志已清空');
}

// 自动滚动
watch(
  () => filteredLogs.value.length,
  () => nextTick(scrollToBottom),
);
</script>

<template>
  <Teleport to="body">
    <!-- FAB（虫子图标）：仅在面板打开且已最小化时显示，桌面/移动通用 -->
    <Transition name="lw-fade">
      <LogFab v-if="show && minimized" :unread-count="unreadErrorCount" @open="minimized = false" />
    </Transition>

    <!-- 背景遮罩（仅移动端展开时） -->
    <Transition name="lw-fade">
      <div v-if="show && !minimized && isMobile" class="lw-backdrop" @click="onBackdropClick" />
    </Transition>

    <!-- 日志面板（最小化时隐藏，改由 FAB 代替） -->
    <Transition name="lw-slide">
      <div
        v-if="show && !minimized"
        class="lw-panel"
        :style="panelStyle"
        role="dialog"
        aria-label="实时日志"
        aria-modal="true"
      >
        <!-- ── 标题栏 ── -->
        <div
          class="lw-header"
          :class="{ 'lw-header--draggable': !isMobile }"
          @pointerdown="onDragStart"
        >
          <div class="lw-header__top-row">
            <div class="lw-header__title-row">
              <span
                class="lw-header__dot"
                :class="paused ? 'lw-header__dot--paused' : 'lw-header__dot--live'"
              />
              <span class="lw-header__title">实时日志</span>
              <span class="lw-header__count">{{ counts.all }}</span>
            </div>
            <div class="lw-header__controls">
              <button class="lw-ctrl-btn" title="复制当前日志" @click="handleCopyLogs">
                <Copy :size="12" />
              </button>
              <button
                class="lw-ctrl-btn"
                :title="paused ? '继续接收' : '暂停接收'"
                @click="handlePauseToggle"
              >
                <Play v-if="paused" :size="12" />
                <Pause v-else :size="12" />
              </button>
              <n-popconfirm
                :z-index="10000"
                positive-text="清空"
                negative-text="取消"
                @positive-click="handleClearLogs"
              >
                <template #trigger>
                  <button class="lw-ctrl-btn" title="清空日志">
                    <Trash2 :size="12" />
                  </button>
                </template>
                确认清空 {{ logs.length }} 条日志？
              </n-popconfirm>
              <button
                class="lw-ctrl-btn"
                title="最小化（显示浮动虫子图标）"
                @click="minimized = true"
              >
                <Minus :size="12" />
              </button>
              <button class="lw-ctrl-btn lw-ctrl-btn--close" title="关闭" @click="close">
                <X :size="10" :stroke-width="1.5" />
              </button>
            </div>
          </div>
          <div class="lw-type-tabs">
            <button
              v-for="t in ['all', 'script', 'http', 'ui', 'browser', 'system'] as FilterType[]"
              :key="t"
              class="lw-type-tab"
              :class="{ 'lw-type-tab--active': filterType === t }"
              @click="filterType = t"
            >
              {{
                t === 'all'
                  ? '全部'
                  : t === 'script'
                    ? '脚本'
                    : t === 'http'
                      ? 'HTTP'
                      : t === 'ui'
                        ? 'UI'
                        : t === 'browser'
                          ? '浏览器'
                          : '系统'
              }}
              <span class="lw-type-tab__count">{{ counts[t] }}</span>
            </button>
          </div>
        </div>

        <!-- ── 工具栏 ── -->
        <div class="lw-toolbar">
          <div class="lw-level-pills">
            <button
              v-for="lv in ['all', 'debug', 'info', 'warn', 'error'] as const"
              :key="lv"
              class="lw-level-pill"
              :class="[`lw-level-pill--${lv}`, { 'lw-level-pill--active': filterLevel === lv }]"
              @click="filterLevel = lv"
            >
              {{ lv.toUpperCase() }}
            </button>
          </div>
          <select v-if="sourceNames.length > 0" v-model="filterSource" class="lw-source-select">
            <option value="">全部书源</option>
            <option v-for="name in sourceNames" :key="name" :value="name">{{ name }}</option>
          </select>
          <input
            v-model="filterText"
            type="text"
            class="lw-search"
            placeholder="搜索…"
            @keydown.esc.stop="filterText = ''"
          />
          <button
            class="lw-toolbar-btn"
            :class="{ 'lw-toolbar-btn--active': autoScroll }"
            title="自动滚动"
            @click="
              autoScroll = !autoScroll;
              autoScroll && scrollToBottom();
            "
          >
            <ArrowDown :size="12" />
          </button>
        </div>

        <!-- ── 日志列表 ── -->
        <div ref="scrollEl" class="lw-list app-scrollbar" @scroll="onScroll">
          <div v-if="filteredLogs.length === 0" class="lw-empty">
            {{ paused ? '已暂停 — 点击 ▶ 继续' : '等待日志…' }}
          </div>
          <template v-for="entry in filteredLogs" :key="entry.id">
            <LogEntry
              :entry="entry"
              :expanded="expandedIds.has(entry.id)"
              :expanded-msg="expandedMsgIds.has(entry.id)"
              :active-tab="activeHttpTab[entry.id] ?? 'headers'"
              @toggle-expand="toggleExpand"
              @toggle-expand-msg="toggleExpandMsg"
              @update:active-tab="(id, tab) => (activeHttpTab[id] = tab)"
            />
          </template>
        </div>

        <!-- ── 状态栏 ── -->
        <div class="lw-statusbar">
          <span>共 {{ counts.all }} 条</span>
          <span
            v-if="filterType !== 'all' || filterText || filterSource || filterLevel !== 'all'"
            class="lw-statusbar__filter"
            >已过滤：{{ filteredLogs.length }} 条</span
          >
          <span v-if="paused" class="lw-statusbar__paused">⏸ 已暂停</span>
          <span class="lw-statusbar__spacer" />
          <span class="lw-statusbar__hint">{{
            isMobile ? '下滑关闭' : '可拖动 · 可调整大小'
          }}</span>
        </div>

        <!-- 调整大小手柄（仅桌面端） -->
        <div v-if="!isMobile" class="lw-resize-handle" @pointerdown="onResizeStart" />
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ── 背景遮罩 ── */
.lw-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 9998;
}

/* ── 面板 ── */
.lw-panel {
  position: fixed;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  background: #0e0e12;
  color: #d4d4d8;
  font-family: var(--font-mono, 'JetBrains Mono', 'Cascadia Code', Consolas, monospace);
  font-size: 12px;
  line-height: 1.5;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow:
    0 24px 64px rgba(0, 0, 0, 0.7),
    0 0 0 1px rgba(255, 255, 255, 0.04);
  overflow: hidden;
  min-width: 280px;
  min-height: 120px;
}

/* ── 过渡动画 ── */
.lw-fade-enter-active,
.lw-fade-leave-active {
  transition: opacity 180ms ease;
}

.lw-fade-enter-from,
.lw-fade-leave-to {
  opacity: 0;
}

.lw-slide-enter-active,
.lw-slide-leave-active {
  transition:
    opacity 200ms ease,
    transform 200ms cubic-bezier(0.2, 0, 0, 1);
}

.lw-slide-enter-from,
.lw-slide-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

/* ── 标题栏 ── */
.lw-header {
  flex-shrink: 0;
  background: #18181b;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 8px 6px 12px;
}

.lw-header__top-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 28px;
}

.lw-header--draggable {
  cursor: grab;
}

.lw-header--draggable:active {
  cursor: grabbing;
}

.lw-header__title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.lw-header__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.lw-header__dot--live {
  background: #4ade80;
  box-shadow: 0 0 0 3px rgba(74, 222, 128, 0.22);
  animation: lw-pulse 2s infinite;
}

.lw-header__dot--paused {
  background: #fbbf24;
}

@keyframes lw-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 3px rgba(74, 222, 128, 0.22);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(74, 222, 128, 0);
  }
}

.lw-header__title {
  font-size: 13px;
  font-weight: 600;
  color: #fafafa;
  white-space: nowrap;
}

.lw-header__count {
  font-size: 11px;
  color: #52525b;
  background: #27272a;
  padding: 0 6px;
  border-radius: 999px;
  min-width: 20px;
  text-align: center;
}

.lw-type-tabs {
  display: flex;
  gap: 2px;
  width: 100%;
  min-width: 0;
  flex-wrap: nowrap;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.lw-type-tabs::-webkit-scrollbar {
  display: none;
}

.lw-type-tab {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  font-size: 11px;
  font-family: inherit;
  border: 1px solid #3f3f46;
  border-radius: 4px;
  background: transparent;
  color: #71717a;
  cursor: pointer;
  transition: all 100ms ease;
  white-space: nowrap;
}

.lw-type-tab:hover {
  background: #27272a;
  color: #d4d4d8;
}

.lw-type-tab--active {
  background: #1e1b4b;
  border-color: #6366f1;
  color: #a5b4fc;
}

.lw-type-tab__count {
  font-size: 9px;
  opacity: 0.65;
}

.lw-header__controls {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  margin-left: auto;
}

.lw-ctrl-btn {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #71717a;
  cursor: pointer;
  transition:
    background 100ms ease,
    color 100ms ease;
}

.lw-ctrl-btn:hover {
  background: #27272a;
  color: #d4d4d8;
}

.lw-ctrl-btn--close:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}

/* ── 工具栏 ── */
.lw-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  background: #18181b;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  flex-wrap: wrap;
}

.lw-level-pills {
  display: flex;
  gap: 3px;
}

.lw-level-pill {
  padding: 1px 7px;
  font-size: 10px;
  font-weight: 600;
  font-family: inherit;
  border-radius: 3px;
  border: 1px solid transparent;
  background: #27272a;
  cursor: pointer;
  transition: all 100ms ease;
  color: #71717a;
}

.lw-level-pill--all {
  color: #a1a1aa;
}
.lw-level-pill--debug {
  color: #71717a;
}
.lw-level-pill--info {
  color: #60a5fa;
}
.lw-level-pill--warn {
  color: #fbbf24;
}
.lw-level-pill--error {
  color: #f87171;
}

.lw-level-pill--active.lw-level-pill--all {
  background: #3f3f46;
  border-color: #52525b;
  color: #d4d4d8;
}
.lw-level-pill--active.lw-level-pill--debug {
  background: #1c1c24;
  border-color: #3f3f46;
}
.lw-level-pill--active.lw-level-pill--info {
  background: #1e3a5f;
  border-color: #3b82f6;
}
.lw-level-pill--active.lw-level-pill--warn {
  background: #451a03;
  border-color: #f59e0b;
}
.lw-level-pill--active.lw-level-pill--error {
  background: #450a0a;
  border-color: #ef4444;
}

.lw-source-select {
  padding: 3px 6px;
  font-size: 11px;
  font-family: inherit;
  border: 1px solid #3f3f46;
  border-radius: 4px;
  background: #09090b;
  color: #d4d4d8;
  outline: none;
  max-width: 140px;
  cursor: pointer;
}

.lw-source-select:focus {
  border-color: #6366f1;
}

.lw-source-select option {
  background: #18181b;
}

.lw-search {
  flex: 1;
  min-width: 80px;
  max-width: 200px;
  padding: 3px 8px;
  font-size: 11px;
  font-family: inherit;
  border: 1px solid #3f3f46;
  border-radius: 4px;
  background: #09090b;
  color: #d4d4d8;
  outline: none;
}

.lw-search:focus {
  border-color: #6366f1;
}

.lw-search::placeholder {
  color: #3f3f46;
}

.lw-toolbar-btn {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #3f3f46;
  border-radius: 4px;
  background: transparent;
  color: #71717a;
  cursor: pointer;
  transition: all 100ms ease;
}

.lw-toolbar-btn:hover {
  background: #27272a;
  color: #d4d4d8;
}

.lw-toolbar-btn--active {
  border-color: #6366f1;
  color: #a5b4fc;
}

/* ── 日志列表 ── */
.lw-list {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 2px 0;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
}

.lw-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 80px;
  color: #3f3f46;
  font-size: 13px;
}

/* ── 状态栏 ── */
.lw-statusbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 3px 10px;
  background: #18181b;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 11px;
  color: #52525b;
  min-height: 22px;
}

.lw-statusbar__filter {
  color: #6366f1;
}

.lw-statusbar__paused {
  color: #fbbf24;
}

.lw-statusbar__spacer {
  flex: 1;
}

.lw-statusbar__hint {
  color: #2a2a2e;
  font-size: 10px;
}

/* ── 调整大小手柄 ── */
.lw-resize-handle {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 14px;
  height: 14px;
  cursor: se-resize;
  background: linear-gradient(135deg, transparent 50%, rgba(255, 255, 255, 0.08) 50%);
  border-radius: 0 0 8px 0;
}

/* ── 移动端适配 ── */
@media (max-width: 767px) {
  .lw-panel {
    border-top: 1px solid rgba(255, 255, 255, 0.12);
    border-left: none;
    border-right: none;
    border-bottom: none;
  }

  .lw-header {
    padding: 8px;
    gap: 6px;
  }

  .lw-header__top-row {
    min-height: 32px;
  }

  .lw-type-tabs {
    padding-bottom: 2px;
  }

  .lw-search {
    max-width: none;
    flex: 1;
  }
}
</style>
