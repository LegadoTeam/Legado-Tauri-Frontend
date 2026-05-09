<script setup lang="ts">
import { computed } from 'vue';
import type { BookItem } from '@/stores';
import { getBookMetaBadges, getBookMetaLine, getLatestChapterText } from '@/utils/bookMeta';
import BookCoverImg from '../BookCoverImg.vue';

const props = withDefaults(
  defineProps<{
    book: BookItem;
    showCover?: boolean;
    sourceType?: string;
  }>(),
  { showCover: true, sourceType: '' },
);

defineEmits<{ (e: 'select', book: BookItem): void }>();

const badges = computed(() => getBookMetaBadges(props.book));
const latestChapter = computed(() => getLatestChapterText(props.book));
const metaLine = computed(() => getBookMetaLine(props.book));
</script>

<template>
  <div
    class="book-card"
    role="button"
    tabindex="0"
    :aria-label="book.name || '未知书名'"
    @click="$emit('select', book)"
    @keydown.enter.prevent="$emit('select', book)"
    @keydown.space.prevent="$emit('select', book)"
  >
    <div v-if="showCover" class="book-card__cover">
      <BookCoverImg :src="book.coverUrl" :alt="book.name" :base-url="book.bookUrl" />
    </div>
    <div class="book-card__info">
      <span
        class="book-card__name"
        :class="{ 'book-card__name--placeholder': !book.name }"
        :title="book.name || '未知书名'"
        >{{ book.name || '未知书名' }}</span
      >
      <span
        class="book-card__author"
        :class="{ 'book-card__author--placeholder': !book.author }"
        :title="book.author || '佚名'"
        >{{ book.author || '佚名' }}</span
      >
      <div v-if="badges.length" class="book-card__tags">
        <n-tag
          v-for="badge in badges"
          :key="badge.key"
          size="tiny"
          :bordered="false"
          class="book-card__tag"
          :class="`book-card__tag--${badge.tone}`"
        >
          {{ badge.label }}
        </n-tag>
      </div>
      <span v-if="latestChapter" class="book-card__latest" :title="latestChapter">
        最新：{{ latestChapter }}
      </span>
      <div v-if="metaLine.length" class="book-card__meta-line" :title="metaLine.join(' · ')">
        <span v-for="item in metaLine" :key="item" class="book-card__meta-item">{{ item }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.book-card {
  display: flex;
  gap: var(--space-2);
  padding: 6px var(--space-2);
  border-radius: var(--radius-2);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  cursor: pointer;
  transition:
    border-color var(--dur-fast) var(--ease-standard),
    box-shadow var(--dur-fast) var(--ease-standard);
}
@media (hover: hover) and (pointer: fine) {
  .book-card:hover {
    border-color: var(--color-accent);
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.08);
  }
}

.book-card__cover {
  width: var(--book-card-cover-w, 42px);
  height: var(--book-card-cover-h, 56px);
  border-radius: var(--radius-1);
  flex-shrink: 0;
  overflow: hidden;
}

.book-card__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  justify-content: center;
}

.book-card__name {
  font-size: var(--fs-13);
  font-weight: var(--fw-semibold);
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}
.book-card__name--placeholder {
  color: var(--color-text-muted);
  font-style: italic;
  font-weight: var(--fw-normal);
}

.book-card__author {
  font-size: var(--fs-11);
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
}
.book-card__author--placeholder {
  opacity: 0.5;
  font-style: italic;
}

.book-card__tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  min-height: 18px;
}
.book-card__tag {
  --n-color: var(--color-hover) !important;
  --n-text-color: var(--color-text-muted) !important;
  font-size: var(--fs-10) !important;
}
.book-card__tag--source {
  --n-color: color-mix(in srgb, var(--color-accent) 12%, transparent) !important;
  --n-text-color: var(--color-accent) !important;
}
.book-card__tag--status {
  --n-color: color-mix(in srgb, var(--color-success) 12%, transparent) !important;
  --n-text-color: var(--color-success) !important;
}

.book-card__latest {
  font-size: var(--fs-10);
  color: var(--color-text-muted);
  opacity: 0.7;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
}
.book-card__meta-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 6px;
  min-width: 0;
  font-size: var(--fs-10);
  line-height: 1.25;
  color: var(--color-text-muted);
  opacity: 0.72;
}
.book-card__meta-item {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.book-card__meta-item + .book-card__meta-item::before {
  content: '·';
  margin-right: 6px;
  opacity: 0.6;
}
</style>
