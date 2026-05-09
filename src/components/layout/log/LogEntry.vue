<script setup lang="ts">
import { computed } from 'vue';
import { isMobile } from '@/composables/useEnv';
import type { HttpDetail, LogEntry } from './useLogState';

const props = defineProps<{
  entry: LogEntry;
  expanded: boolean;
  expandedMsg: boolean;
  activeTab: 'headers' | 'response' | 'request';
}>();

const emit = defineEmits<{
  'toggle-expand': [id: number];
  'toggle-expand-msg': [id: number];
  'update:active-tab': [id: number, tab: 'headers' | 'response' | 'request'];
}>();

function statusClass(status: number) {
  if (status >= 200 && status < 300) return 'lw-status--ok';
  if (status >= 300 && status < 400) return 'lw-status--redirect';
  if (status >= 400) return 'lw-status--error';
  return '';
}

function typeLabel(type: LogEntry['type']): string {
  const MAP: Record<string, string> = {
    script: 'SCR',
    http: 'HTTP',
    ui: 'UI',
    browser: 'BRWS',
    system: 'SYS',
  };
  return MAP[type] ?? type.toUpperCase();
}

function typeBgColor(type: LogEntry['type']): string {
  const MAP: Record<string, string> = {
    script: '#312e81',
    http: '#14532d',
    ui: '#7c2d12',
    browser: '#164e63',
    system: '#1c1c24',
  };
  return MAP[type] ?? '#1c1c24';
}

function typeTextColor(type: LogEntry['type']): string {
  const MAP: Record<string, string> = {
    script: '#a5b4fc',
    http: '#86efac',
    ui: '#fdba74',
    browser: '#67e8f9',
    system: '#a1a1aa',
  };
  return MAP[type] ?? '#d4d4d8';
}

function levelTextColor(level: LogEntry['level']): string {
  const MAP: Record<string, string> = {
    debug: '#71717a',
    info: '#60a5fa',
    warn: '#fbbf24',
    error: '#f87171',
  };
  return MAP[level] ?? '#d4d4d8';
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return (
    d.toLocaleTimeString('zh-CN', { hour12: false }) +
    '.' +
    String(d.getMilliseconds()).padStart(3, '0')
  );
}

/** 消息超过 120 字符或含换行时视为长消息，需要折叠 */
const isLongMsg = computed(
  () => props.entry.message.length > 120 || props.entry.message.includes('\n'),
);

const httpTabs = computed(() => {
  const base: ('headers' | 'response' | 'request')[] = ['headers', 'response'];
  if (props.entry.httpDetail?.requestBody) base.push('request');
  return base;
});
</script>

<template>
  <!-- ── 日志行 ── -->
  <div
    class="lw-entry"
    :class="{
      'lw-entry--http': entry.type === 'http' && entry.httpDetail,
      'lw-entry--expanded': expanded,
      [`lw-entry--${entry.level}`]: true,
    }"
    @click="entry.type === 'http' && entry.httpDetail && emit('toggle-expand', entry.id)"
  >
    <!-- ── 桌面端：单行水平布局 ── -->
    <template v-if="!isMobile">
      <span class="lw-entry__time">{{ formatTime(entry.time) }}</span>
      <span
        class="lw-entry__type"
        :style="{ background: typeBgColor(entry.type), color: typeTextColor(entry.type) }"
        >{{ typeLabel(entry.type) }}</span
      >
      <span
        v-if="entry.type !== 'http'"
        class="lw-entry__level"
        :style="{ color: levelTextColor(entry.level) }"
        >{{ entry.level.toUpperCase() }}</span
      >
      <span v-if="entry.sourceName" class="lw-entry__source">{{ entry.sourceName }}</span>

      <!-- HTTP 条目（桌面继续单行） -->
      <template v-if="entry.type === 'http' && entry.httpDetail">
        <span :class="statusClass(entry.httpDetail.status)" class="lw-entry__status-code">{{
          entry.httpDetail.status || (entry.httpDetail.error ? '✗' : '✓')
        }}</span>
        <span class="lw-entry__method">{{ entry.httpDetail.method }}</span>
        <span class="lw-entry__url">{{ entry.httpDetail.url }}</span>
        <span v-if="entry.httpDetail.elapsed" class="lw-entry__elapsed"
          >{{ entry.httpDetail.elapsed }}ms</span
        >
        <span class="lw-entry__expand-icon">{{ expanded ? '▾' : '▸' }}</span>
      </template>

      <!-- 普通消息（桌面单行） -->
      <template v-else>
        <span
          class="lw-entry__msg"
          :class="{ 'lw-entry__msg--collapsed': !expandedMsg && isLongMsg }"
          >{{ entry.message }}</span
        >
        <button
          v-if="isLongMsg"
          class="lw-entry__toggle-msg"
          @click.stop="emit('toggle-expand-msg', entry.id)"
        >
          {{ expandedMsg ? '收起' : '展开' }}
        </button>
      </template>
    </template>

    <!-- ── 移动端：两行布局 ── -->
    <div v-if="isMobile" class="lw-entry__mobile">
      <!-- 第一行：元信息 -->
      <div class="lw-entry__mobile-meta">
        <span class="lw-entry__time">{{ formatTime(entry.time) }}</span>
        <span
          class="lw-entry__type"
          :style="{ background: typeBgColor(entry.type), color: typeTextColor(entry.type) }"
          >{{ typeLabel(entry.type) }}</span
        >
        <span
          v-if="entry.type !== 'http'"
          class="lw-entry__level"
          :style="{ color: levelTextColor(entry.level) }"
          >{{ entry.level.toUpperCase() }}</span
        >
        <span v-if="entry.sourceName" class="lw-entry__source">{{ entry.sourceName }}</span>
        <!-- HTTP 额外信息 -->
        <template v-if="entry.type === 'http' && entry.httpDetail">
          <span :class="statusClass(entry.httpDetail.status)" class="lw-entry__status-code">{{
            entry.httpDetail.status || (entry.httpDetail.error ? '✗' : '✓')
          }}</span>
          <span class="lw-entry__method">{{ entry.httpDetail.method }}</span>
          <span v-if="entry.httpDetail.elapsed" class="lw-entry__elapsed"
            >{{ entry.httpDetail.elapsed }}ms</span
          >
          <span class="lw-entry__expand-icon">{{ expanded ? '▾' : '▸' }}</span>
        </template>
      </div>
      <!-- 第二行：消息内容（撑满宽度） -->
      <div class="lw-entry__mobile-body">
        <template v-if="entry.type === 'http' && entry.httpDetail">
          <span class="lw-entry__url lw-entry__url--mobile">{{ entry.httpDetail.url }}</span>
        </template>
        <template v-else>
          <span
            class="lw-entry__msg"
            :class="{ 'lw-entry__msg--collapsed': !expandedMsg && isLongMsg }"
            >{{ entry.message }}</span
          >
          <button
            v-if="isLongMsg"
            class="lw-entry__toggle-msg"
            @click.stop="emit('toggle-expand-msg', entry.id)"
          >
            {{ expandedMsg ? '收起' : '展开' }}
          </button>
        </template>
      </div>
    </div>
  </div>

  <!-- ── HTTP 详情面板 ── -->
  <div v-if="expanded && entry.httpDetail" class="lw-http-detail">
    <div class="lw-http-detail__tabs">
      <button
        v-for="tab in httpTabs"
        :key="tab"
        class="lw-http-detail__tab"
        :class="{ 'lw-http-detail__tab--active': activeTab === tab }"
        @click.stop="emit('update:active-tab', entry.id, tab)"
      >
        {{ tab === 'headers' ? 'Headers' : tab === 'response' ? 'Response' : 'Request Body' }}
      </button>
    </div>

    <!-- Headers -->
    <div v-if="activeTab === 'headers'" class="lw-http-detail__body app-scrollbar">
      <div class="lw-kv-section">
        <div class="lw-kv-section__title">General</div>
        <div class="lw-kv">
          <span class="lw-kv__k">URL</span><span class="lw-kv__v">{{ entry.httpDetail.url }}</span>
        </div>
        <div class="lw-kv">
          <span class="lw-kv__k">Method</span
          ><span class="lw-kv__v">{{ entry.httpDetail.method }}</span>
        </div>
        <div class="lw-kv">
          <span class="lw-kv__k">Status</span
          ><span class="lw-kv__v" :class="statusClass(entry.httpDetail.status)">{{
            entry.httpDetail.status || 'N/A'
          }}</span>
        </div>
        <div class="lw-kv">
          <span class="lw-kv__k">Elapsed</span
          ><span class="lw-kv__v">{{ entry.httpDetail.elapsed }}ms</span>
        </div>
        <div v-if="entry.httpDetail.error" class="lw-kv">
          <span class="lw-kv__k">Error</span
          ><span class="lw-kv__v lw-status--error">{{ entry.httpDetail.error }}</span>
        </div>
      </div>
      <div v-if="Object.keys(entry.httpDetail.responseHeaders).length" class="lw-kv-section">
        <div class="lw-kv-section__title">Response Headers</div>
        <div v-for="(v, k) in entry.httpDetail.responseHeaders" :key="k" class="lw-kv">
          <span class="lw-kv__k">{{ k }}</span><span class="lw-kv__v">{{ v }}</span>
        </div>
      </div>
      <div v-if="Object.keys(entry.httpDetail.requestHeaders).length" class="lw-kv-section">
        <div class="lw-kv-section__title">Request Headers</div>
        <div v-for="(v, k) in entry.httpDetail.requestHeaders" :key="k" class="lw-kv">
          <span class="lw-kv__k">{{ k }}</span><span class="lw-kv__v">{{ v }}</span>
        </div>
      </div>
    </div>

    <!-- Response Body -->
    <div v-if="activeTab === 'response'" class="lw-http-detail__body app-scrollbar">
      <pre class="lw-http-detail__pre">{{ entry.httpDetail.responseBody || '(empty)' }}</pre>
    </div>

    <!-- Request Body -->
    <div v-if="activeTab === 'request'" class="lw-http-detail__body app-scrollbar">
      <pre class="lw-http-detail__pre">{{ entry.httpDetail.requestBody || '(empty)' }}</pre>
    </div>
  </div>
</template>

<style scoped>
/* ── 日志行 ── */
.lw-entry {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 3px 10px;
  min-height: 24px;
  transition: background 80ms ease;
  cursor: default;
  overflow: hidden;
  border-bottom: 1px solid transparent;
  border-left: 2px solid transparent;
}


.lw-entry:hover {
  background: rgba(255, 255, 255, 0.03);
}

.lw-entry--http {
  cursor: pointer;
}

.lw-entry--http:hover {
  background: rgba(255, 255, 255, 0.05);
}

.lw-entry--expanded {
  background: rgba(99, 102, 241, 0.06);
  border-bottom-color: #27272a;
}

.lw-entry--error {
  border-left-color: #ef4444;
}

.lw-entry--warn {
  border-left-color: #f59e0b;
}

.lw-entry--debug {
  border-left-color: #3f3f46;
}

.lw-entry__time {
  flex-shrink: 0;
  color: #3f3f46;
  font-size: 11px;
  min-width: 84px;
  padding-top: 2px;
}

.lw-entry__type {
  flex-shrink: 0;
  font-size: 9px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 2px;
  letter-spacing: 0.04em;
  margin-top: 2px;
  align-self: flex-start;
}

.lw-entry__level {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 600;
  min-width: 36px;
  padding-top: 2px;
}

.lw-entry__source {
  flex-shrink: 0;
  color: #71717a;
  font-size: 11px;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding-top: 2px;
}

/* HTTP 专用字段 */
.lw-entry__status-code {
  flex-shrink: 0;
  font-weight: 600;
  font-size: 12px;
  min-width: 28px;
}

.lw-entry__method {
  flex-shrink: 0;
  color: #a5b4fc;
  font-weight: 600;
  font-size: 11px;
}

.lw-entry__url {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #c4b5fd;
  font-size: 11px;
}

.lw-entry__elapsed {
  flex-shrink: 0;
  color: #71717a;
  font-size: 10px;
}

.lw-entry__expand-icon {
  flex-shrink: 0;
  color: #52525b;
  font-size: 10px;
}

/* 消息体（支持多行 + 折叠展开） */
.lw-entry__msg {
  flex: 1;
  color: #d4d4d8;
  font-size: 12px;
  word-break: break-word;
  white-space: pre-wrap;
  line-height: 1.5;
}

.lw-entry__msg--collapsed {
  /* 折叠时最多显示 3 行 */
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
}

.lw-entry--error .lw-entry__msg {
  color: #fca5a5;
}

.lw-entry--warn .lw-entry__msg {
  color: #fcd34d;
}

.lw-entry__toggle-msg {
  flex-shrink: 0;
  align-self: flex-end;
  font-size: 10px;
  font-family: inherit;
  border: none;
  background: none;
  color: #6366f1;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1.8;
  white-space: nowrap;
}

.lw-entry__toggle-msg:hover {
  color: #a5b4fc;
}

/* 状态码颜色 */
.lw-status--ok {
  color: #4ade80;
}

.lw-status--redirect {
  color: #fbbf24;
}

.lw-status--error {
  color: #f87171;
}

/* ── HTTP 详情面板 ── */
.lw-http-detail {
  background: #09090b;
  border-bottom: 1px solid #1f1f23;
}

.lw-http-detail__tabs {
  display: flex;
  border-bottom: 1px solid #27272a;
  padding: 0 10px;
}

.lw-http-detail__tab {
  padding: 4px 12px;
  font-size: 11px;
  font-family: inherit;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #71717a;
  cursor: pointer;
  transition: color 100ms ease;
}

.lw-http-detail__tab:hover {
  color: #d4d4d8;
}

.lw-http-detail__tab--active {
  color: #a5b4fc;
  border-bottom-color: #6366f1;
}

.lw-http-detail__body {
  max-height: 240px;
  overflow: auto;
  padding: 8px 10px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.08) transparent;
}

.lw-http-detail__pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 11px;
  color: #a1a1aa;
  font-family: inherit;
}

.lw-kv-section {
  margin-bottom: 8px;
}

.lw-kv-section__title {
  font-size: 10px;
  font-weight: 700;
  color: #52525b;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding-bottom: 4px;
  margin-bottom: 4px;
  border-bottom: 1px solid #1f1f23;
}

.lw-kv {
  display: flex;
  gap: 8px;
  padding: 1px 0;
  min-height: 18px;
  flex-wrap: wrap;
}

.lw-kv__k {
  flex-shrink: 0;
  color: #71717a;
  font-size: 11px;
  min-width: 100px;
  word-break: break-all;
}

.lw-kv__v {
  flex: 1;
  color: #d4d4d8;
  font-size: 11px;
  word-break: break-all;
}

/* ── 移动端适配 ── */
@media (max-width: 767px) {
  .lw-entry {
    padding: 5px 8px;
    min-height: unset;
  }

  .lw-entry__mobile {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
  }

  .lw-entry__mobile-meta {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-wrap: nowrap;
    overflow: hidden;
  }

  .lw-entry__mobile-body {
    display: flex;
    align-items: flex-start;
    gap: 4px;
    padding-left: 2px;
  }

  .lw-entry__time {
    font-size: 10px;
    min-width: unset;
    flex-shrink: 0;
  }

  .lw-entry__source {
    max-width: 80px;
    font-size: 10px;
  }

  .lw-entry__msg {
    font-size: 12px;
    width: 100%;
  }

  .lw-entry__url--mobile {
    font-size: 11px;
    color: #c4b5fd;
    word-break: break-all;
    white-space: normal;
    width: 100%;
  }
}
</style>
