<!--
  阅读器目录与书籍详情抽屉，负责章节检索、跳转、缓存操作和当前阅读章节定位。
-->
<script setup lang="ts">
import { openUrl } from '@tauri-apps/plugin-opener';
import { useVirtualList } from '@vueuse/core';
import { Trash2, RefreshCw, Download } from 'lucide-vue-next';
import { ref, nextTick, watch, computed } from 'vue';
import type { ChapterItem } from '@/stores';
import type { ReaderBookInfo } from './types';
import AppInput from '../base/AppInput.vue';
import AppTabs from '../base/AppTabs.vue';
import BookCoverImg from '../BookCoverImg.vue';

defineOptions({ inheritAttrs: false });

const props = defineProps<{
  show: boolean;
  chapters: ChapterItem[];
  currentIndex: number;
  bookInfo?: ReaderBookInfo;
  /** 已阅读过的章节索引集合（0 ~ 当前章节） */
  readIndices?: Set<number>;
  /** 已下载缓存的章节索引集合 */
  cachedIndices?: Set<number>;
  /** 目录刷新中（父组件控制加载状态） */
  refreshingToc?: boolean;
  /** 书源类型：novel | comic */
  sourceType?: string;
}>();

const emit = defineEmits<{
  (e: 'update:show', val: boolean): void;
  (e: 'select', idx: number): void;
  (e: 'refresh-toc'): void;
  /** 清理单章缓存（章节索引） */
  (e: 'clear-chapter-cache', idx: number): void;
  /** 清理全书所有章节缓存 */
  (e: 'clear-all-cache'): void;
}>();

type TabKey = 'toc' | 'detail';
const TOC_ITEM_HEIGHT = 48;
const activeTab = ref<TabKey>('toc');
const tocTabs = [
  { key: 'toc', label: '目录' },
  { key: 'detail', label: '详情' },
];

const searchQuery = ref('');

/** 过滤后的章节列表（带原始索引） */
const filteredChapters = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) {
    return props.chapters.map((ch, index) => ({ ch, index }));
  }
  return props.chapters
    .map((ch, index) => ({ ch, index }))
    .filter(({ ch }) => ch.name.toLowerCase().includes(q));
});

const {
  list: virtualList,
  containerProps,
  wrapperProps,
  scrollTo,
} = useVirtualList(filteredChapters, { itemHeight: TOC_ITEM_HEIGHT, overscan: 8 });

function getTocListElement() {
  return document.querySelector<HTMLElement>('.reader-toc__list');
}

async function scrollCurrentChapterIntoView() {
  const idx = filteredChapters.value.findIndex((item) => item.index === props.currentIndex);
  if (idx < 0) {
    return;
  }

  const listEl = getTocListElement();
  const visibleCount = listEl
    ? Math.max(1, Math.floor(listEl.clientHeight / TOC_ITEM_HEIGHT))
    : 1;
  const firstVisibleIndex = Math.max(0, idx - Math.floor(visibleCount / 2));

  // 虚拟列表的 scrollTo 默认会把目标项贴到顶部；这里先滚到目标附近，
  // 再按容器实际高度修正 scrollTop，让“阅读中”章节尽量停在列表中部。
  scrollTo(firstVisibleIndex);
  await nextTick();

  requestAnimationFrame(() => {
    const currentListEl = getTocListElement();
    if (!currentListEl) {
      return;
    }
    const centeredTop = Math.max(
      0,
      idx * TOC_ITEM_HEIGHT - Math.max(0, currentListEl.clientHeight - TOC_ITEM_HEIGHT) / 2,
    );
    currentListEl.scrollTo({ top: centeredTop, behavior: 'auto' });
  });
}

let tocSwipePointerId: number | null = null;
let tocSwipeStartX = 0;
let tocSwipeStartY = 0;

function onTocPointerDown(e: PointerEvent) {
  if (!e.isPrimary) {
    return;
  }
  tocSwipePointerId = e.pointerId;
  tocSwipeStartX = e.clientX;
  tocSwipeStartY = e.clientY;
}

function onTocPointerUp(e: PointerEvent) {
  if (tocSwipePointerId !== e.pointerId) {
    return;
  }
  const dx = e.clientX - tocSwipeStartX;
  const dy = e.clientY - tocSwipeStartY;
  tocSwipePointerId = null;
  if (dx < -64 && Math.abs(dx) > Math.abs(dy) * 1.35) {
    emit('update:show', false);
  }
}

function onTocPointerCancel(e: PointerEvent) {
  if (tocSwipePointerId === e.pointerId) {
    tocSwipePointerId = null;
  }
}

watch(
  () => props.show,
  (val) => {
    if (val) {
      nextTick(() => {
        if (activeTab.value === 'toc') {
          void scrollCurrentChapterIntoView();
        }
      });
    }
  },
);

watch(
  () => [props.currentIndex, props.show, activeTab.value, searchQuery.value] as const,
  ([, show, tab]) => {
    if (!show || tab !== 'toc') {
      return;
    }
    nextTick(() => {
      void scrollCurrentChapterIntoView();
    });
  },
);

function onSelect(idx: number) {
  emit('select', idx);
  emit('update:show', false);
}

function formatTime(ts?: number) {
  if (!ts) {
    return '—';
  }
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const detailRows = computed(() => {
  const b = props.bookInfo;
  if (!b) {
    return [];
  }
  const rows: { label: string; value: string; isUrl?: boolean }[] = [];
  if (b.sourceName) {
    rows.push({ label: '来源扩展', value: b.sourceName });
  }
  if (b.fileName) {
    rows.push({ label: '书源文件', value: b.fileName });
  }
  if (b.bookUrl) {
    rows.push({ label: '书籍地址', value: b.bookUrl, isUrl: true });
  }
  if (b.kind) {
    rows.push({ label: '分类标签', value: b.kind });
  }
  if (b.status) {
    rows.push({ label: '状态', value: b.status });
  }
  if (b.lastChapter) {
    rows.push({ label: '最新章节', value: b.lastChapter });
  }
  if (b.wordCount) {
    rows.push({ label: '字数', value: b.wordCount });
  }
  if (b.chapterCount) {
    rows.push({ label: '章节总数', value: `${b.chapterCount} 章` });
  }
  if (b.updateTime) {
    rows.push({ label: '更新时间', value: b.updateTime });
  }
  if (b.totalChapters) {
    rows.push({ label: '目录章节数', value: `${b.totalChapters} 章` });
  }
  if (b.addedAt) {
    rows.push({ label: '加入时间', value: formatTime(b.addedAt) });
  }
  if (b.lastReadAt) {
    rows.push({ label: '最后阅读', value: formatTime(b.lastReadAt) });
  }
  return rows;
});

</script>

<template>
  <!-- 遮罩 -->
  <Transition name="reader-toc-fade">
    <div v-if="show" class="reader-toc__overlay" @click="emit('update:show', false)" />
  </Transition>

  <!-- 面板 -->
  <Transition name="reader-toc-slide">
    <div
      v-if="show"
      class="reader-toc"
      @click.stop
      @pointerdown="onTocPointerDown"
      @pointerup="onTocPointerUp"
      @pointercancel="onTocPointerCancel"
    >
      <!-- 书籍信息头部 -->
      <div v-if="bookInfo" class="reader-toc__book-header">
        <BookCoverImg
          class="reader-toc__cover"
          :src="bookInfo.coverUrl"
          :base-url="bookInfo.bookUrl"
          :alt="bookInfo.name"
        />
        <div class="reader-toc__book-meta">
          <div class="reader-toc__book-name" :title="bookInfo.name">{{ bookInfo.name }}</div>
          <div class="reader-toc__book-author">{{ bookInfo.author }}</div>
          <div v-if="bookInfo.kind" class="reader-toc__book-kind">{{ bookInfo.kind }}</div>
        </div>
      </div>

      <!-- Tab 切换 -->
      <AppTabs
        class="reader-toc__tabs-new"
        :model-value="activeTab"
        :tabs="tocTabs"
        @update:model-value="(v) => (activeTab = v as TabKey)"
      />

      <!-- 详情内容 -->
      <div
        v-if="activeTab === 'detail'"
        class="reader-toc__detail app-scrollbar app-scrollbar--thin app-scrollbar--inverse"
      >
        <!-- 简介 -->
        <div v-if="bookInfo?.intro" class="reader-toc__intro">
          <div class="reader-toc__intro-title">简介</div>
          <div class="reader-toc__intro-text">{{ bookInfo.intro }}</div>
        </div>
        <!-- 详细信息 -->
        <div class="reader-toc__info-list">
          <div v-for="row in detailRows" :key="row.label" class="reader-toc__info-row">
            <span class="reader-toc__info-label">{{ row.label }}</span>
            <a
              v-if="row.isUrl"
              class="reader-toc__info-value reader-toc__info-link"
              href="#"
              :title="row.value"
              @click.prevent="openUrl(row.value)"
              >{{ row.value }}</a
            >
            <span v-else class="reader-toc__info-value" :title="row.value">{{ row.value }}</span>
          </div>
        </div>
        <div v-if="!bookInfo && !detailRows.length" class="reader-toc__empty">暂无书籍详细信息</div>
      </div>

      <!-- 目录列表 -->
      <div v-else class="reader-toc__list-wrap">
        <div class="reader-toc__list-header">
          <span>共 {{ chapters.length }} 章</span>
          <div class="reader-toc__header-actions">
            <button
              v-if="cachedIndices && cachedIndices.size > 0"
              class="reader-toc__refresh-btn reader-toc__refresh-btn--danger"
              title="清空全书缓存"
              @click="emit('clear-all-cache')"
            >
              <Trash2 :size="12" />
              清空全书
            </button>
            <button
              class="reader-toc__refresh-btn"
              :disabled="props.refreshingToc"
              :class="{ 'reader-toc__refresh-btn--spinning': props.refreshingToc }"
              title="更新目录"
              @click="emit('refresh-toc')"
            >
              <RefreshCw :size="14" />
              {{ props.refreshingToc ? '更新中…' : '更新目录' }}
            </button>
          </div>
        </div>
        <!-- 搜索框 -->
        <div class="reader-toc__search">
          <AppInput v-model="searchQuery" placeholder="搜索章节…" />
        </div>
        <!-- 虚拟滚动章节列表 -->
        <div
          v-bind="containerProps"
          class="reader-toc__list app-scrollbar app-scrollbar--inverse"
        >
          <div v-bind="wrapperProps">
            <div
              v-for="item in virtualList"
              :key="item.data.index"
              class="reader-toc__item"
              role="button"
              tabindex="0"
              :class="{
                'reader-toc__item--active': item.data.index === currentIndex,
                'reader-toc__item--read':
                  item.data.index !== currentIndex && readIndices?.has(item.data.index),
                'reader-toc__item--cached': cachedIndices?.has(item.data.index),
                'reader-toc__item--no-cache':
                  cachedIndices &&
                  !cachedIndices.has(item.data.index) &&
                  item.data.index !== currentIndex,
              }"
              @click="onSelect(item.data.index)"
              @keydown.enter.prevent="onSelect(item.data.index)"
              @keydown.space.prevent="onSelect(item.data.index)"
            >
              <span class="reader-toc__item-name">{{ item.data.ch.name }}</span>
              <span
                v-if="cachedIndices?.has(item.data.index)"
                class="reader-toc__item-cache-icon"
                title="已缓存"
                aria-label="已缓存"
              >
                <Download :size="12" />
              </span>
              <span
                v-if="item.data.index === currentIndex"
                class="reader-toc__badge reader-toc__badge--current"
                >阅读中</span
              >
              <span
                v-else-if="readIndices?.has(item.data.index)"
                class="reader-toc__badge reader-toc__badge--read"
                >已读</span
              >
              <button
                class="reader-toc__item-clear"
                :class="{ 'reader-toc__item-clear--visible': cachedIndices?.has(item.data.index) }"
                :disabled="!cachedIndices?.has(item.data.index)"
                :aria-hidden="!cachedIndices?.has(item.data.index)"
                title="清除本章缓存"
                @click.stop="emit('clear-chapter-cache', item.data.index)"
              >
                <Trash2 :size="12" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.reader-toc__overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 29;
}

.reader-toc {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: min(340px, 82vw);
  z-index: 30;
  background: rgba(25, 25, 25, 0.96);
  backdrop-filter: blur(16px);
  color: #e0e0e0;
  display: flex;
  flex-direction: column;
  /* 无 bookInfo 头部时，tabs 直接贴顶，用 padding-top 避让状态栏 */
  padding-top: var(--safe-area-inset-top, env(safe-area-inset-top, 0px));
  padding-bottom: var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px));
  touch-action: pan-y;
}

/* ---- 书籍信息头部 ---- */
.reader-toc__book-header {
  flex-shrink: 0;
  display: flex;
  gap: 12px;
  padding: 16px 16px 12px;
}

.reader-toc__cover {
  width: 60px;
  height: 82px;
  border-radius: 4px;
  object-fit: cover;
  flex-shrink: 0;
  background: #27272a;
}

.reader-toc__book-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}

.reader-toc__book-name {
  font-size: 0.9375rem;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reader-toc__book-author {
  font-size: 0.75rem;
  opacity: 0.65;
}

.reader-toc__book-kind {
  font-size: 0.6875rem;
  opacity: 0.5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---- Tab 切换 ---- */
.reader-toc__tabs {
  flex-shrink: 0;
  display: flex;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.reader-toc__tab {
  flex: 1;
  padding: 10px 0;
  font-size: 0.8125rem;
  font-weight: 500;
  text-align: center;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: inherit;
  opacity: 0.55;
  cursor: pointer;
  transition:
    opacity 0.15s,
    border-color 0.15s;
}
.reader-toc__tab:hover {
  opacity: 0.8;
}
.reader-toc__tab--active {
  opacity: 1;
  border-bottom-color: #63e2b7;
  color: #63e2b7;
}

/* ---- 详情内容 ---- */
.reader-toc__detail {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
}

.reader-toc__intro {
  margin-bottom: 16px;
}

.reader-toc__intro-title {
  font-size: 0.8125rem;
  font-weight: 600;
  margin-bottom: 6px;
  opacity: 0.8;
}

.reader-toc__intro-text {
  font-size: 0.75rem;
  line-height: 1.7;
  opacity: 0.7;
  white-space: pre-wrap;
  word-break: break-all;
}

.reader-toc__info-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.reader-toc__info-row {
  display: flex;
  gap: 8px;
  font-size: 0.75rem;
  line-height: 1.5;
}

.reader-toc__info-label {
  flex-shrink: 0;
  width: 60px;
  opacity: 0.5;
}

.reader-toc__info-value {
  flex: 1;
  min-width: 0;
  word-break: break-all;
  opacity: 0.8;
}

.reader-toc__info-link {
  color: #63b3ed;
  text-decoration: none;
  cursor: pointer;
}
.reader-toc__info-link:hover {
  text-decoration: underline;
  opacity: 1;
}

.reader-toc__empty {
  text-align: center;
  padding: 40px 0;
  font-size: 0.8125rem;
  opacity: 0.4;
}

/* ---- 目录列表 ---- */
.reader-toc__list-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.reader-toc__list-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px 8px 20px;
  font-size: 0.75rem;
  opacity: 0.45;
}

.reader-toc__header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.reader-toc__refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.06);
  color: inherit;
  font-size: 0.6875rem;
  cursor: pointer;
  opacity: 1;
  transition:
    background 0.15s,
    opacity 0.15s;
  white-space: nowrap;
}

.reader-toc__refresh-btn:hover:not(:disabled) {
  background: rgba(99, 226, 183, 0.15);
  border-color: #63e2b7;
  color: #63e2b7;
}

.reader-toc__refresh-btn--danger:hover:not(:disabled) {
  background: rgba(248, 113, 113, 0.15);
  border-color: #f87171;
  color: #f87171;
}

.reader-toc__refresh-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.reader-toc__refresh-btn--spinning svg {
  animation: toc-spin 1s linear infinite;
}

@keyframes toc-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.reader-toc__list {
  flex: 1;
  overflow-y: auto;
  padding: 0 0 4px;
  /* 移动端较宽的滚动条，方便触摸拖动 */
  --app-scrollbar-size: 8px;
  --app-scrollbar-radius: 4px;
}

.reader-toc__item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  /* color: #fff; */
  font-size: 0.8125rem;
  padding: 10px 20px;
  cursor: pointer;
  transition: background 0.15s;
}
.reader-toc__item:hover {
  background: rgba(255, 255, 255, 0.06);
}
.reader-toc__item--active {
  color: #63e2b7;
  font-weight: 600;
  background: rgba(99, 226, 183, 0.08);
}
/* 已读章节：颜色略淡 */
.reader-toc__item--read:not(.reader-toc__item--active) {
  opacity: 0.65;
}
/* 未缓存章节：更灰暗 */
.reader-toc__item--no-cache {
  opacity: 0.38;
}
/* 未缓存 + 已读（极少见，保持已读优先级） */
.reader-toc__item--read.reader-toc__item--no-cache {
  opacity: 0.5;
}

.reader-toc__item-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reader-toc__item-cache-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  color: #63e2b7;
  opacity: 0.9;
}

/* 单章缓存清除小按钮 */
.reader-toc__item-clear {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.25);
  cursor: pointer;
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 0.15s,
    color 0.15s,
    background 0.15s;
  margin-left: 4px;
}

.reader-toc__item-clear--visible {
  visibility: visible;
}

.reader-toc__item:hover .reader-toc__item-clear--visible {
  opacity: 1;
}

.reader-toc__item-clear:disabled {
  cursor: default;
}

.reader-toc__item-clear--visible:hover {
  color: #f87171;
  background: rgba(248, 113, 113, 0.15);
}

/* 状态徽章 */
.reader-toc__badge {
  flex-shrink: 0;
  font-size: 0.625rem;
  line-height: 1;
  padding: 2px 5px;
  border-radius: 3px;
  font-weight: 500;
  white-space: nowrap;
}
.reader-toc__badge--current {
  background: rgba(99, 226, 183, 0.18);
  color: #63e2b7;
  border: 1px solid rgba(99, 226, 183, 0.35);
}
.reader-toc__badge--read {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* 动画 */
.reader-toc-fade-enter-active,
.reader-toc-fade-leave-active {
  transition: opacity 0.25s ease;
}
.reader-toc-fade-enter-from,
.reader-toc-fade-leave-to {
  opacity: 0;
}

.reader-toc-slide-enter-active,
.reader-toc-slide-leave-active {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.reader-toc-slide-enter-from,
.reader-toc-slide-leave-to {
  transform: translateX(-100%);
}

/* AppTabs 暗色适配（panel 背景为深色） */
.reader-toc__tabs-new {
  --color-border: rgba(255, 255, 255, 0.1);
  --color-text-soft: rgba(255, 255, 255, 0.55);
  --color-text: rgba(255, 255, 255, 0.9);
  --color-accent: #63e2b7;
  --control-md: 2.5rem;
  flex-shrink: 0;
  width: 100%;
}

.reader-toc__tabs-new :deep(.app-tabs) {
  width: 100%;
  overflow: hidden;
}

.reader-toc__tabs-new :deep(.app-tabs__tab) {
  flex: 1 1 50%;
  min-width: 0;
  padding-inline: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 搜索框 */
.reader-toc__search {
  flex-shrink: 0;
  padding: 8px 16px;
  --color-border: rgba(255, 255, 255, 0.15);
  --color-surface: rgba(255, 255, 255, 0.06);
  --color-text: rgba(255, 255, 255, 0.9);
  --color-text-muted: rgba(255, 255, 255, 0.4);
  --color-accent: #63e2b7;
  --color-focus: #63e2b7;
}
</style>
