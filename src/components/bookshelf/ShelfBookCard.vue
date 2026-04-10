<script setup lang="ts">
import type { ShelfBook } from '../../composables/useBookshelf'
import BookCoverImg from '../BookCoverImg.vue'

defineProps<{
  book: ShelfBook
  privacyModeEnabled?: boolean
}>()
defineEmits<{
  (e: 'select', book: ShelfBook): void
  (e: 'contextmenu', book: ShelfBook, event: MouseEvent): void
  (e: 'toggle-private', book: ShelfBook): void
}>()

function progressPercent(book: ShelfBook): number {
  if (book.totalChapters <= 0 || book.readChapterIndex < 0) return 0
  return Math.min(100, Math.round(((book.readChapterIndex + 1) / book.totalChapters) * 100))
}

function progressLabel(book: ShelfBook): string {
  if (book.readChapterIndex < 0) return '未开始'
  if (book.totalChapters <= 0) return '阅读中'
  const pct = progressPercent(book)
  if (pct >= 100) return '已读完'
  return `${pct}%`
}
</script>

<template>
  <div class="shelf-card" :class="{
    'shelf-card--private': book.isPrivate,
    'shelf-card--privacy-active': privacyModeEnabled && book.isPrivate,
  }" @click="$emit('select', book)" @contextmenu.prevent="$emit('contextmenu', book, $event)">
    <div class="shelf-card__cover-wrap">
      <BookCoverImg :src="book.coverUrl" :alt="book.name" :base-url="book.bookUrl" />
      <!-- 进度标签 -->
      <span class="shelf-card__badge" :class="{ 'shelf-card__badge--unread': book.readChapterIndex < 0 }">
        {{ progressLabel(book) }}
      </span>
    </div>
    <div class="shelf-card__info">
      <span class="shelf-card__name" :title="book.name">{{ book.name }}</span>
      <span class="shelf-card__author" :title="book.author">{{ book.author }}</span>
    </div>
    <!-- 进度条 -->
    <div v-if="book.readChapterIndex >= 0 && book.totalChapters > 0" class="shelf-card__progress">
      <div class="shelf-card__progress-bar" :style="{ width: `${progressPercent(book)}%` }" />
    </div>
  </div>
</template>

<style scoped>
.shelf-card {
  display: flex;
  flex-direction: column;
  cursor: pointer;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast), transform var(--transition-fast);
}

.shelf-card:hover {
  border-color: var(--color-accent);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}

.shelf-card--privacy-active {
  border-color: color-mix(in srgb, var(--color-accent) 55%, var(--color-border));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-accent) 30%, transparent);
}

.shelf-card__cover-wrap {
  position: relative;
  aspect-ratio: 3 / 4;
  overflow: hidden;
  background: var(--color-surface);
}


.shelf-card__privacy-toggle {
  position: absolute;
  top: 6px;
  left: 6px;
  z-index: 1;
  border: none;
  border-radius: 999px;
  padding: 3px 7px;
  font-size: 0.625rem;
  font-weight: 700;
  line-height: 1.2;
  color: rgba(255, 255, 255, 0.92);
  background: rgba(0, 0, 0, 0.45);
  cursor: pointer;
  backdrop-filter: blur(6px);
  transition: background var(--transition-fast), color var(--transition-fast), transform var(--transition-fast);
}

.shelf-card__privacy-toggle:hover {
  background: rgba(0, 0, 0, 0.62);
  transform: translateY(-1px);
}

.shelf-card__privacy-toggle--active {
  background: color-mix(in srgb, var(--color-accent) 78%, rgba(15, 23, 42, 0.7));
}

.shelf-card__badge {
  position: absolute;
  top: 6px;
  right: 6px;
  padding: 2px 6px;
  font-size: 0.625rem;
  font-weight: 600;
  border-radius: var(--radius-xs);
  background: rgba(0, 0, 0, 0.6);
  color: var(--color-accent);
  backdrop-filter: blur(4px);
  line-height: 1.4;
}

.shelf-card__badge--unread {
  color: var(--color-text-muted);
}

.shelf-card__info {
  padding: 6px 8px 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.shelf-card__name {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}

.shelf-card__author {
  font-size: 0.6875rem;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
}

.shelf-card__progress {
  height: 3px;
  background: var(--color-border);
}

.shelf-card__progress-bar {
  height: 100%;
  background: var(--color-accent);
  border-radius: 0 2px 2px 0;
  transition: width 0.3s ease;
}
</style>
