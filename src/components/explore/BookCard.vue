<script setup lang="ts">
import type { BookItem } from '../../composables/useScriptBridge'
import BookCoverImg from '../BookCoverImg.vue'

withDefaults(defineProps<{
  book: BookItem
  showCover?: boolean
}>(), { showCover: true })
defineEmits<{ (e: 'select', book: BookItem): void }>()

</script>

<template>
  <div class="book-card" @click="$emit('select', book)">
    <div v-if="showCover" class="book-card__cover">
      <BookCoverImg :src="book.coverUrl" :alt="book.name" :base-url="book.bookUrl" />
    </div>
    <div class="book-card__info">
      <span class="book-card__name" :title="book.name">{{ book.name }}</span>
      <span class="book-card__author" :title="book.author">{{ book.author }}</span>
      <div class="book-card__tags">
        <n-tag v-if="book.kind" size="tiny" :bordered="false" class="book-card__tag">
          {{ book.kind }}
        </n-tag>
      </div>
      <span v-if="book.lastChapter" class="book-card__latest" :title="book.lastChapter">
        {{ book.lastChapter }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.book-card {
  display: flex;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-surface-raised);
  cursor: pointer;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.book-card:hover {
  border-color: var(--color-accent);
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.08);
}

.book-card__cover {
  width: var(--explore-cover-w, 42px);
  height: var(--explore-cover-h, 56px);
  border-radius: var(--radius-xs);
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
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}

.book-card__author {
  font-size: 0.6875rem;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
}

.book-card__tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.book-card__tag {
  --n-color: var(--color-surface-hover) !important;
  --n-text-color: var(--color-text-muted) !important;
  font-size: 0.625rem !important;
}

.book-card__latest {
  font-size: 0.625rem;
  color: var(--color-text-muted);
  opacity: 0.7;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
}
</style>
