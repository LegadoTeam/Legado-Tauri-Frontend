<script setup lang="ts">
import { ref } from 'vue'
import type { BookItem } from '../../composables/useScriptBridge'
import type { AggregatedBook, TaggedBookItem } from './AggregatedSearchResults.vue'
import defaultLogoUrl from '../../assets/booksource-default.svg'
import BookCoverImg from '../BookCoverImg.vue'

const props = defineProps<{
  group: AggregatedBook
  showCover?: boolean
}>()

const emit = defineEmits<{
  (e: 'select', book: BookItem, fileName: string): void
}>()

const showSourcePicker = ref(false)

function handleClick() {
  if (props.group.sources.length > 1) {
    showSourcePicker.value = true
  } else {
    const item = props.group.primary
    emit('select', item.book, item.fileName)
  }
}

function selectSource(item: TaggedBookItem) {
  showSourcePicker.value = false
  emit('select', item.book, item.fileName)
}
</script>

<template>
  <div
    class="stacked-card"
    :class="{ 'stacked-card--multi': group.sources.length > 1 }"
    @click="handleClick"
  >
    <!-- 堆叠层（仅多来源时显示底牌） -->
    <div v-if="group.sources.length > 2" class="stacked-card__layer stacked-card__layer--3" />
    <div v-if="group.sources.length > 1" class="stacked-card__layer stacked-card__layer--2" />

    <!-- 主卡片 -->
    <div class="stacked-card__main">
      <div v-if="showCover" class="stacked-card__cover">
        <BookCoverImg :src="group.primary.book.coverUrl" :alt="group.primary.book.name" :base-url="group.primary.book.bookUrl" />
      </div>
      <div class="stacked-card__info">
        <span class="stacked-card__name" :title="group.primary.book.name">
          {{ group.primary.book.name }}
        </span>
        <span class="stacked-card__author" :title="group.primary.book.author">
          {{ group.primary.book.author }}
        </span>
        <div class="stacked-card__tags">
          <n-tag v-if="group.primary.book.kind" size="tiny" :bordered="false" class="stacked-card__tag">
            {{ group.primary.book.kind }}
          </n-tag>
        </div>
        <span v-if="group.primary.book.lastChapter" class="stacked-card__latest" :title="group.primary.book.lastChapter">
          {{ group.primary.book.lastChapter }}
        </span>
      </div>
      <!-- 多来源角标 -->
      <span v-if="group.sources.length > 1" class="stacked-card__badge">
        {{ group.sources.length }} 源
      </span>
    </div>
  </div>

  <!-- 来源选择弹窗 -->
  <n-modal
    v-model:show="showSourcePicker"
    preset="card"
    :title="`${group.primary.book.name} — 共 ${group.sources.length} 个来源`"
    :style="{ maxWidth: '560px', width: '92vw' }"
    size="small"
    :bordered="false"
    :segmented="{ content: true }"
  >
    <div class="source-picker">
      <div
        v-for="(item, idx) in group.sources"
        :key="item.fileName"
        class="source-picker__card"
        @click="selectSource(item)"
      >
        <!-- 封面 -->
        <div class="source-picker__cover">
          <BookCoverImg :src="item.book.coverUrl" :alt="item.book.name" :base-url="item.book.bookUrl" />
        </div>

        <!-- 右侧信息区 -->
        <div class="source-picker__body">
          <!-- 书源标题行 -->
          <div class="source-picker__source-row">
            <img
              class="source-picker__logo"
              :src="(item.sourceLogo && item.sourceLogo.toLowerCase() !== 'default') ? item.sourceLogo : defaultLogoUrl"
              :alt="item.sourceName"
              @error="($event.target as HTMLImageElement).src = defaultLogoUrl"
            />
            <span class="source-picker__source-name">{{ item.sourceName }}</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="source-picker__arrow"><polyline points="9 18 15 12 9 6"/></svg>
          </div>

          <!-- 作者 -->
          <div v-if="item.book.author" class="source-picker__author">
            <span class="source-picker__label">作者</span>{{ item.book.author }}
          </div>

          <!-- 分类标签 -->
          <div v-if="item.book.kind" class="source-picker__tags">
            <n-tag
              v-for="tag in item.book.kind.split(/[,，|\/]/).map(t => t.trim()).filter(Boolean)"
              :key="tag"
              size="tiny"
              :bordered="false"
              class="source-picker__tag"
            >{{ tag }}</n-tag>
          </div>

          <!-- 最新章节 -->
          <div v-if="item.book.lastChapter" class="source-picker__last-chapter">
            <span class="source-picker__label">最新</span>
            <span class="source-picker__chapter-text">{{ item.book.lastChapter }}</span>
          </div>

          <!-- 简介 -->
          <p v-if="item.book.intro" class="source-picker__intro">{{ item.book.intro }}</p>
        </div>

        <!-- 分割线 -->
        <div v-if="idx < group.sources.length - 1" class="source-picker__divider" />
      </div>
    </div>
  </n-modal>
</template>

<style scoped>
.stacked-card {
  position: relative;
  cursor: pointer;
  /* 为堆叠层留空间 */
  padding-top: 0;
  margin-top: 0;
}
.stacked-card--multi {
  padding-top: 0;
  margin-bottom: 6px;
}

/* ── 堆叠底牌 ── */
.stacked-card__layer {
  position: absolute;
  left: 0;
  right: 0;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-surface-raised);
  pointer-events: none;
}
.stacked-card__layer--2 {
  top: -4px;
  bottom: 4px;
  left: 4px;
  right: -4px;
  opacity: 0.6;
  z-index: 0;
}
.stacked-card__layer--3 {
  top: -8px;
  bottom: 8px;
  left: 8px;
  right: -8px;
  opacity: 0.35;
  z-index: -1;
}

/* ── 主卡片 ── */
.stacked-card__main {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-surface-raised);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.stacked-card:hover .stacked-card__main {
  border-color: var(--color-accent);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.stacked-card__cover {
  width: 48px;
  height: 64px;
  border-radius: var(--radius-xs);
  flex-shrink: 0;
  overflow: hidden;
}

.stacked-card__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  justify-content: center;
}

.stacked-card__name {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}

.stacked-card__author {
  font-size: 0.6875rem;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
}

.stacked-card__tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.stacked-card__tag {
  --n-color: var(--color-surface-hover) !important;
  --n-text-color: var(--color-text-muted) !important;
  font-size: 0.625rem !important;
}

.stacked-card__latest {
  font-size: 0.625rem;
  color: var(--color-text-muted);
  opacity: 0.7;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
}

/* ── 来源角标 ── */
.stacked-card__badge {
  position: absolute;
  top: 4px;
  right: 6px;
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 0.625rem;
  font-weight: 600;
  color: #fff;
  background: var(--color-accent, #6366f1);
  line-height: 1.4;
  z-index: 2;
}

/* ── 来源选择弹窗 ── */
.source-picker {
  display: flex;
  flex-direction: column;
  max-height: 70vh;
  overflow-y: auto;
}

.source-picker__card {
  position: relative;
  display: flex;
  gap: 12px;
  padding: 14px 4px;
  cursor: pointer;
  transition: background var(--transition-fast);
  border-radius: var(--radius-sm);
}
.source-picker__card:hover {
  background: var(--color-surface-hover);
}

/* 封面 */
.source-picker__cover {
  width: 72px;
  height: 96px;
  border-radius: var(--radius-xs);
  flex-shrink: 0;
  overflow: hidden;
  flex-shrink: 0;
}

/* 右侧内容区 */
.source-picker__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

/* 书源标题行 */
.source-picker__source-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.source-picker__logo {
  width: 20px;
  height: 20px;
  border-radius: var(--radius-xs);
  object-fit: contain;
  flex-shrink: 0;
}

.source-picker__source-name {
  flex: 1;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--color-accent);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-picker__arrow {
  flex-shrink: 0;
  color: var(--color-text-muted);
  opacity: 0.5;
  transition: opacity var(--transition-fast), transform var(--transition-fast);
}
.source-picker__card:hover .source-picker__arrow {
  opacity: 1;
  transform: translateX(2px);
}

/* 字段标签 */
.source-picker__label {
  display: inline-block;
  font-size: 0.6875rem;
  color: var(--color-text-muted);
  background: var(--color-surface-hover);
  border-radius: 3px;
  padding: 0 4px;
  margin-right: 5px;
  line-height: 1.6;
  flex-shrink: 0;
}

/* 作者 */
.source-picker__author {
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  overflow: hidden;
}

/* 分类标签 */
.source-picker__tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.source-picker__tag {
  --n-color: var(--color-surface-hover) !important;
  --n-text-color: var(--color-text-muted) !important;
  font-size: 0.625rem !important;
}

/* 最新章节 */
.source-picker__last-chapter {
  display: flex;
  align-items: center;
  overflow: hidden;
}
.source-picker__chapter-text {
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 简介 */
.source-picker__intro {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  line-height: 1.5;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 分割线 */
.source-picker__divider {
  position: absolute;
  bottom: 0;
  left: 84px;
  right: 0;
  height: 1px;
  background: var(--color-border);
  opacity: 0.5;
}
</style>
