<script setup lang="ts">
import { ref, nextTick, watch, computed } from 'vue'
import { openUrl } from '@tauri-apps/plugin-opener'
import type { ChapterItem } from '../../composables/useScriptBridge'
import type { ReaderBookInfo } from './types'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  show: boolean
  chapters: ChapterItem[]
  currentIndex: number
  bookInfo?: ReaderBookInfo
  /** 已阅读过的章节索引集合（0 ~ 当前章节） */
  readIndices?: Set<number>
  /** 已下载缓存的章节索引集合 */
  cachedIndices?: Set<number>
  /** 目录刷新中（父组件控制加载状态） */
  refreshingToc?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:show', val: boolean): void
  (e: 'select', idx: number): void
  (e: 'refresh-toc'): void
}>()

type TabKey = 'toc' | 'detail'
const activeTab = ref<TabKey>('toc')

const listRef = ref<HTMLElement | null>(null)

watch(
  () => props.show,
  (val) => {
    if (val) {
      nextTick(() => {
        if (activeTab.value === 'toc') {
          const active = listRef.value?.querySelector('.reader-toc__item--active')
          active?.scrollIntoView({ block: 'center' })
        }
      })
    }
  },
)

function onSelect(idx: number) {
  emit('select', idx)
  emit('update:show', false)
}

const fallbackCover = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="110" viewBox="0 0 80 110">' +
  '<rect width="80" height="110" rx="4" fill="%233a3a45"/>' +
  '<rect x="10" y="12" width="5" height="86" rx="1.5" fill="%23555568"/>' +
  '<rect x="15" y="12" width="55" height="86" rx="2" fill="%23464658" stroke="%23555568" stroke-width="0.5"/>' +
  '<rect x="64" y="15" width="3" height="80" rx="1" fill="%234e4e62"/>' +
  '<path d="M30 36 C30 36 35 34 40 36 L40 52 C35 50 30 52 30 52 Z" fill="%23606078"/>' +
  '<path d="M50 36 C50 36 45 34 40 36 L40 52 C45 50 50 52 50 52 Z" fill="%23555570"/>' +
  '<line x1="40" y1="36" x2="40" y2="52" stroke="%237a7a92" stroke-width="0.6"/>' +
  '<text x="40" y="74" text-anchor="middle" fill="%237a7a92" font-size="8" font-family="sans-serif">暂无封面</text>' +
  '</svg>'
)}`

function formatTime(ts?: number) {
  if (!ts) return '—'
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const detailRows = computed(() => {
  const b = props.bookInfo
  if (!b) return []
  const rows: { label: string; value: string; isUrl?: boolean }[] = []
  if (b.sourceName) rows.push({ label: '来源扩展', value: b.sourceName })
  if (b.fileName) rows.push({ label: '书源文件', value: b.fileName })
  if (b.bookUrl) rows.push({ label: '书籍地址', value: b.bookUrl, isUrl: true })
  if (b.kind) rows.push({ label: '分类标签', value: b.kind })
  if (b.lastChapter) rows.push({ label: '最新章节', value: b.lastChapter })
  if (b.totalChapters) rows.push({ label: '总章节数', value: `${b.totalChapters} 章` })
  if (b.addedAt) rows.push({ label: '加入时间', value: formatTime(b.addedAt) })
  if (b.lastReadAt) rows.push({ label: '最后阅读', value: formatTime(b.lastReadAt) })
  return rows
})
</script>

<template>
  <!-- 遮罩 -->
  <Transition name="reader-toc-fade">
    <div v-if="show" class="reader-toc__overlay" @click="emit('update:show', false)" />
  </Transition>

  <!-- 面板 -->
  <Transition name="reader-toc-slide">
    <div v-if="show" class="reader-toc" @click.stop>
      <!-- 书籍信息头部 -->
      <div v-if="bookInfo" class="reader-toc__book-header">
        <img
          class="reader-toc__cover"
          :src="bookInfo.coverUrl || fallbackCover"
          :alt="bookInfo.name"
          @error="(e: Event) => (e.target as HTMLImageElement).src = fallbackCover"
        />
        <div class="reader-toc__book-meta">
          <div class="reader-toc__book-name" :title="bookInfo.name">{{ bookInfo.name }}</div>
          <div class="reader-toc__book-author">{{ bookInfo.author }}</div>
          <div v-if="bookInfo.kind" class="reader-toc__book-kind">{{ bookInfo.kind }}</div>
        </div>
      </div>

      <!-- Tab 切换 -->
      <div class="reader-toc__tabs">
        <button
          class="reader-toc__tab"
          :class="{ 'reader-toc__tab--active': activeTab === 'detail' }"
          @click="activeTab = 'detail'"
        >
          详情
        </button>
        <button
          class="reader-toc__tab"
          :class="{ 'reader-toc__tab--active': activeTab === 'toc' }"
          @click="activeTab = 'toc'"
        >
          目录
        </button>
      </div>

      <!-- 详情内容 -->
      <div v-if="activeTab === 'detail'" class="reader-toc__detail">
        <!-- 简介 -->
        <div v-if="bookInfo?.intro" class="reader-toc__intro">
          <div class="reader-toc__intro-title">简介</div>
          <div class="reader-toc__intro-text">{{ bookInfo.intro }}</div>
        </div>
        <!-- 详细信息 -->
        <div class="reader-toc__info-list">
          <div v-for="row in detailRows" :key="row.label" class="reader-toc__info-row">
            <span class="reader-toc__info-label">{{ row.label }}</span>
            <a v-if="row.isUrl" class="reader-toc__info-value reader-toc__info-link" href="#" :title="row.value" @click.prevent="openUrl(row.value)">{{ row.value }}</a>
            <span v-else class="reader-toc__info-value" :title="row.value">{{ row.value }}</span>
          </div>
        </div>
        <div v-if="!bookInfo && !detailRows.length" class="reader-toc__empty">暂无书籍详细信息</div>
      </div>

      <!-- 目录列表 -->
      <div v-else class="reader-toc__list-wrap">
        <div class="reader-toc__list-header">
          <span>共 {{ chapters.length }} 章</span>
          <button
            class="reader-toc__refresh-btn"
            :disabled="props.refreshingToc"
            :class="{ 'reader-toc__refresh-btn--spinning': props.refreshingToc }"
            title="更新目录"
            @click="emit('refresh-toc')"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 4 23 10 17 10"/>
              <polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            {{ props.refreshingToc ? '更新中…' : '更新目录' }}
          </button>
        </div>
        <div ref="listRef" class="reader-toc__list">
          <button
            v-for="(ch, idx) in chapters"
            :key="idx"
            class="reader-toc__item"
            :class="{
              'reader-toc__item--active':  idx === currentIndex,
              'reader-toc__item--read':    idx !== currentIndex && readIndices?.has(idx),
              'reader-toc__item--cached':  cachedIndices?.has(idx),
              'reader-toc__item--no-cache': cachedIndices && !cachedIndices.has(idx),
            }"
            @click="onSelect(idx)"
          >
            <span class="reader-toc__item-name">{{ ch.name }}</span>
            <span v-if="idx === currentIndex" class="reader-toc__badge reader-toc__badge--current">阅读中</span>
            <span v-else-if="readIndices?.has(idx)" class="reader-toc__badge reader-toc__badge--read">已读</span>
          </button>
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
  transition: opacity 0.15s, border-color 0.15s;
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
  transition: background 0.15s, opacity 0.15s;
  white-space: nowrap;
}

.reader-toc__refresh-btn:hover:not(:disabled) {
  background: rgba(99, 226, 183, 0.15);
  border-color: #63e2b7;
  color: #63e2b7;
}

.reader-toc__refresh-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.reader-toc__refresh-btn--spinning svg {
  animation: toc-spin 1s linear infinite;
}

@keyframes toc-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.reader-toc__list {
  flex: 1;
  overflow-y: auto;
  padding: 0 0 4px;
}

.reader-toc__item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  color: inherit;
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

/* 滚动条 */
.reader-toc__list::-webkit-scrollbar,
.reader-toc__detail::-webkit-scrollbar { width: 4px; }
.reader-toc__list::-webkit-scrollbar-track,
.reader-toc__detail::-webkit-scrollbar-track { background: transparent; }
.reader-toc__list::-webkit-scrollbar-thumb,
.reader-toc__detail::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 2px; }

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
</style>
