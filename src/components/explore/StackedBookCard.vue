<script setup lang="ts">
import { ChevronRight } from 'lucide-vue-next';
import { ref } from 'vue';
import type { BookItem } from '@/stores';
import type { AggregatedBook, TaggedBookItem } from '@/types';
import { useOverlayBackstack } from '@/composables/useOverlayBackstack';
import { getBookMetaBadges, getBookMetaLine, getLatestChapterText } from '@/utils/bookMeta';
import defaultLogoUrl from '../../assets/booksource-default.svg';
import BookCoverImg from '../BookCoverImg.vue';

const props = defineProps<{
  group: AggregatedBook;
  showCover?: boolean;
}>();

const emit = defineEmits<{
  (e: 'select', book: BookItem, fileName: string): void;
}>();

const showSourcePicker = ref(false);

useOverlayBackstack(
  () => showSourcePicker.value,
  () => {
    showSourcePicker.value = false;
  },
);

function handleClick() {
  if (props.group.sources.length > 1) {
    showSourcePicker.value = true;
  } else {
    const item = props.group.primary;
    emit('select', item.book, item.fileName);
  }
}

function selectSource(item: TaggedBookItem) {
  showSourcePicker.value = false;
  emit('select', item.book, item.fileName);
}

function latestChapter(book: BookItem): string {
  return getLatestChapterText(book);
}

function metaLine(book: BookItem): string[] {
  return getBookMetaLine(book);
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
        <BookCoverImg
          :src="group.primary.book.coverUrl"
          :alt="group.primary.book.name"
          :base-url="group.primary.book.bookUrl"
        />
      </div>
      <div class="stacked-card__info">
        <span
          class="stacked-card__name"
          :class="{ 'stacked-card__name--placeholder': !group.primary.book.name }"
          :title="group.primary.book.name || '未知书名'"
        >
          {{ group.primary.book.name || '未知书名' }}
        </span>
        <span
          class="stacked-card__author"
          :class="{ 'stacked-card__author--placeholder': !group.primary.book.author }"
          :title="group.primary.book.author || '佚名'"
        >
          {{ group.primary.book.author || '佚名' }}
        </span>
        <div
          v-if="getBookMetaBadges(group.primary.book).length"
          class="stacked-card__tags"
        >
          <n-tag
            v-for="badge in getBookMetaBadges(group.primary.book)"
            :key="badge.key"
            size="tiny"
            :bordered="false"
            class="stacked-card__tag"
            :class="`stacked-card__tag--${badge.tone}`"
          >
            {{ badge.label }}
          </n-tag>
        </div>
        <span
          v-if="latestChapter(group.primary.book)"
          class="stacked-card__latest"
          :title="latestChapter(group.primary.book)"
        >
          最新：{{ latestChapter(group.primary.book) }}
        </span>
        <div
          v-if="metaLine(group.primary.book).length"
          class="stacked-card__meta-line"
          :title="metaLine(group.primary.book).join(' · ')"
        >
          <span
            v-for="item in metaLine(group.primary.book)"
            :key="item"
            class="stacked-card__meta-item"
          >
            {{ item }}
          </span>
        </div>
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
          <BookCoverImg
            :src="item.book.coverUrl"
            :alt="item.book.name"
            :base-url="item.book.bookUrl"
          />
        </div>

        <!-- 右侧信息区 -->
        <div class="source-picker__body">
          <!-- 书源标题行 -->
          <div class="source-picker__source-row">
            <img
              class="source-picker__logo"
              :src="
                item.sourceLogo && item.sourceLogo.toLowerCase() !== 'default'
                  ? item.sourceLogo
                  : defaultLogoUrl
              "
              :alt="item.sourceName"
              @error="($event.target as HTMLImageElement).src = defaultLogoUrl"
            />
            <span class="source-picker__source-name">{{ item.sourceName }}</span>
            <ChevronRight class="source-picker__arrow" :size="13" />
          </div>

          <!-- 作者 -->
          <div v-if="item.book.author" class="source-picker__author">
            <span class="source-picker__label">作者</span>{{ item.book.author }}
          </div>

          <!-- 分类标签 -->
          <div v-if="getBookMetaBadges(item.book).length" class="source-picker__tags">
            <n-tag
              v-for="badge in getBookMetaBadges(item.book)"
              :key="badge.key"
              size="tiny"
              :bordered="false"
              class="source-picker__tag"
              :class="`source-picker__tag--${badge.tone}`"
              >{{ badge.label }}</n-tag
            >
          </div>

          <!-- 最新章节 -->
          <div v-if="latestChapter(item.book)" class="source-picker__last-chapter">
            <span class="source-picker__label">最新</span>
            <span class="source-picker__chapter-text">{{ latestChapter(item.book) }}</span>
          </div>
          <div v-if="metaLine(item.book).length" class="source-picker__meta-line">
            <span v-for="meta in metaLine(item.book)" :key="meta" class="source-picker__meta-item">
              {{ meta }}
            </span>
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
  border-radius: var(--radius-2);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
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
  gap: var(--space-2);
  padding: var(--space-2) 10px;
  border-radius: var(--radius-2);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  transition:
    border-color var(--dur-fast) var(--ease-standard),
    box-shadow var(--dur-fast) var(--ease-standard);
}
@media (hover: hover) and (pointer: fine) {
  .stacked-card:hover .stacked-card__main {
    border-color: var(--color-accent);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
}

.stacked-card__cover {
  width: var(--book-card-cover-w, 48px);
  height: var(--book-card-cover-h, 64px);
  border-radius: var(--radius-1);
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
  font-size: var(--fs-13);
  font-weight: var(--fw-semibold);
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}
.stacked-card__name--placeholder {
  color: var(--color-text-muted);
  font-style: italic;
  font-weight: var(--fw-normal);
}

.stacked-card__author {
  font-size: var(--fs-11);
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
}
.stacked-card__author--placeholder {
  opacity: 0.5;
  font-style: italic;
}

.stacked-card__tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.stacked-card__tag {
  --n-color: var(--color-hover) !important;
  --n-text-color: var(--color-text-muted) !important;
  font-size: var(--fs-10) !important;
}
.stacked-card__tag--status {
  --n-color: color-mix(in srgb, var(--color-success) 12%, transparent) !important;
  --n-text-color: var(--color-success) !important;
}

.stacked-card__latest {
  font-size: var(--fs-10);
  color: var(--color-text-muted);
  opacity: 0.7;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
}
.stacked-card__meta-line {
  display: flex;
  flex-wrap: wrap;
  gap: 0 6px;
  min-width: 0;
  font-size: var(--fs-10);
  color: var(--color-text-muted);
  opacity: 0.72;
}
.stacked-card__meta-item {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.stacked-card__meta-item + .stacked-card__meta-item::before {
  content: '·';
  margin-right: 6px;
  opacity: 0.6;
}

/* ── 来源角标 ── */
.stacked-card__badge {
  position: absolute;
  top: 4px;
  right: 6px;
  padding: 1px 6px;
  border-radius: var(--radius-pill);
  font-size: var(--fs-10);
  font-weight: var(--fw-semibold);
  color: #fff;
  background: var(--color-accent);
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
  gap: var(--space-3);
  padding: 14px 4px;
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease-standard);
  border-radius: var(--radius-2);
}
@media (hover: hover) and (pointer: fine) {
  .source-picker__card:hover {
    background: var(--color-hover);
  }
}

/* 封面 */
.source-picker__cover {
  width: 72px;
  height: 96px;
  border-radius: var(--radius-1);
  flex-shrink: 0;
  overflow: hidden;
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
  border-radius: var(--radius-1);
  object-fit: contain;
  flex-shrink: 0;
}

.source-picker__source-name {
  flex: 1;
  font-size: var(--fs-14);
  font-weight: var(--fw-bold);
  color: var(--color-accent);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-picker__arrow {
  flex-shrink: 0;
  color: var(--color-text-muted);
  opacity: 0.5;
  transition:
    opacity var(--dur-fast) var(--ease-standard),
    transform var(--dur-fast) var(--ease-standard);
}
@media (hover: hover) and (pointer: fine) {
  .source-picker__card:hover .source-picker__arrow {
    opacity: 1;
    transform: translateX(2px);
  }
}

/* 字段标签 */
.source-picker__label {
  display: inline-block;
  font-size: var(--fs-11);
  color: var(--color-text-muted);
  background: var(--color-hover);
  border-radius: 3px;
  padding: 0 4px;
  margin-right: 5px;
  line-height: 1.6;
  flex-shrink: 0;
}

/* 作者 */
.source-picker__author {
  font-size: var(--fs-13);
  color: var(--color-text-soft);
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
  --n-color: var(--color-hover) !important;
  --n-text-color: var(--color-text-muted) !important;
  font-size: var(--fs-10) !important;
}
.source-picker__tag--status {
  --n-color: color-mix(in srgb, var(--color-success) 12%, transparent) !important;
  --n-text-color: var(--color-success) !important;
}

/* 最新章节 */
.source-picker__last-chapter {
  display: flex;
  align-items: center;
  overflow: hidden;
}
.source-picker__chapter-text {
  font-size: var(--fs-13);
  color: var(--color-text-soft);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.source-picker__meta-line {
  display: flex;
  flex-wrap: wrap;
  gap: 0 8px;
  font-size: var(--fs-12);
  color: var(--color-text-muted);
}
.source-picker__meta-item + .source-picker__meta-item::before {
  content: '·';
  margin-right: 8px;
  opacity: 0.65;
}

/* 简介 */
.source-picker__intro {
  font-size: var(--fs-12);
  color: var(--color-text-muted);
  line-height: var(--lh-body);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
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
