<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next';
import type { ShelfBook } from '@/stores';
import SourceTypeBadge from '../base/SourceTypeBadge.vue';
import BookCoverImg from '../BookCoverImg.vue';

defineProps<{
  book: ShelfBook;
  privacyModeEnabled?: boolean;
  loading?: boolean;
}>();
defineEmits<{
  (e: 'select', book: ShelfBook): void;
  (e: 'contextmenu', book: ShelfBook, event: MouseEvent): void;
  (e: 'toggle-private', book: ShelfBook): void;
}>();

function progressWidth(book: ShelfBook): string {
  if (book.totalChapters <= 0 || book.readChapterIndex < 0) {
    return '0%';
  }
  return `${Math.min(100, ((book.readChapterIndex + 1) / book.totalChapters) * 100).toFixed(2)}%`;
}

function unreadCount(book: ShelfBook): number {
  if (book.totalChapters <= 0) return 0;
  if (book.readChapterIndex < 0) return book.totalChapters;
  return Math.max(0, book.totalChapters - book.readChapterIndex - 1);
}

function statusLabel(book: ShelfBook): string {
  if (book.readChapterIndex < 0) return '未开始';
  if (book.totalChapters <= 0) return '阅读中';
  return '已读完';
}
</script>

<template>
  <div
    class="shelf-card"
    role="button"
    tabindex="0"
    :aria-label="book.name || '未知书名'"
    :class="{
      'shelf-card--private': book.isPrivate,
      'shelf-card--privacy-active': privacyModeEnabled && book.isPrivate,
      'shelf-card--loading': loading,
    }"
    @click="$emit('select', book)"
    @keydown.enter.prevent="$emit('select', book)"
    @keydown.space.prevent="$emit('select', book)"
    @contextmenu.prevent="$emit('contextmenu', book, $event)"
  >
    <div class="shelf-card__cover-wrap">
      <BookCoverImg
        :src="book.coverReferer && book.coverUrl ? { url: book.coverUrl, referer: book.coverReferer } : book.coverUrl"
        :alt="book.name"
        :base-url="book.bookUrl"
      />
      <!-- 加载中遮罩 -->
      <div v-if="loading" class="shelf-card__loading-overlay">
        <Loader2 class="shelf-card__spinner" :size="24" />
      </div>
      <!-- 未读气泡 -->
      <span
        v-if="!loading && unreadCount(book) > 0"
        class="shelf-card__unread-bubble"
      >{{ unreadCount(book) > 99 ? '99+' : unreadCount(book) }}</span>
      <!-- 状态标签（已读完 / 阅读中 / 未开始） -->
      <span
        v-else-if="!loading"
        class="shelf-card__badge"
      >{{ statusLabel(book) }}</span>
      <!-- 类型图标 -->
      <SourceTypeBadge
        v-if="book.sourceType"
        :source-type="book.sourceType"
        class="shelf-card__type-icon"
      />
    </div>
    <div class="shelf-card__info">
      <span
        class="shelf-card__name"
        :class="{ 'shelf-card__name--placeholder': !book.name }"
        :title="book.name || '未知书名'"
      >
        {{ book.name || '未知书名' }}
      </span>
      <span
        class="shelf-card__author"
        :class="{ 'shelf-card__author--placeholder': !book.author }"
        :title="book.author || '佚名'"
      >
        {{ book.author || '佚名' }}
      </span>
    </div>
    <!-- 进度条 -->
    <div v-if="book.readChapterIndex >= 0 && book.totalChapters > 0" class="shelf-card__progress">
      <div
        class="shelf-card__progress-bar"
        :style="{ '--shelf-progress-width': progressWidth(book) }"
      />
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
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  transition:
    border-color var(--dur-fast) var(--ease-standard),
    box-shadow var(--dur-fast) var(--ease-standard),
    transform var(--dur-fast) var(--ease-standard);
}

@media (hover: hover) and (pointer: fine) {
  .shelf-card:hover {
    border-color: var(--color-accent);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    transform: translateY(-2px);
  }
}

.shelf-card--privacy-active {
  border-color: color-mix(in srgb, var(--color-accent) 55%, var(--color-border));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-accent) 30%, transparent);
}

.shelf-card--loading {
  pointer-events: none;
  opacity: 0.85;
}

.shelf-card__loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(2px);
  color: #fff;
  z-index: 2;
}

.shelf-card__spinner {
  width: 32px;
  height: 32px;
  animation: shelf-spin 0.9s linear infinite;
}

@keyframes shelf-spin {
  to {
    transform: rotate(360deg);
  }
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
  border-radius: var(--radius-pill);
  padding: 3px 7px;
  font-size: var(--fs-10);
  font-weight: var(--fw-bold);
  line-height: 1.2;
  color: rgba(255, 255, 255, 0.92);
  background: rgba(0, 0, 0, 0.45);
  cursor: pointer;
  backdrop-filter: blur(6px);
  transition:
    background var(--dur-fast) var(--ease-standard),
    color var(--dur-fast) var(--ease-standard),
    transform var(--dur-fast) var(--ease-standard);
}

@media (hover: hover) and (pointer: fine) {
  .shelf-card__privacy-toggle:hover {
    background: rgba(0, 0, 0, 0.62);
    transform: translateY(-1px);
  }
}

.shelf-card__privacy-toggle--active {
  background: color-mix(in srgb, var(--color-accent) 78%, rgba(15, 23, 42, 0.7));
}

.shelf-card__badge {
  position: absolute;
  top: 6px;
  right: 6px;
  padding: 2px 6px;
  font-size: var(--fs-10);
  font-weight: var(--fw-semibold);
  border-radius: var(--radius-1);
  background: rgba(0, 0, 0, 0.5);
  color: var(--color-text-muted);
  backdrop-filter: blur(4px);
  line-height: 1.4;
}

.shelf-card__unread-bubble {
  position: absolute;
  top: 5px;
  right: 5px;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  font-size: 11px;
  font-weight: 700;
  border-radius: 10px;
  background: #e5282a;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
  white-space: nowrap;
  z-index: 3;
  letter-spacing: -0.3px;
}

.shelf-card__type-icon {
  position: absolute;
  top: 6px;
  left: 6px;
  z-index: 1;
}

.shelf-card__info {
  padding: 6px 8px 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.shelf-card__name {
  font-size: var(--fs-13);
  font-weight: var(--fw-semibold);
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}
.shelf-card__name--placeholder {
  color: var(--color-text-muted);
  font-style: italic;
  font-weight: var(--fw-normal);
}

.shelf-card__author {
  font-size: var(--fs-11);
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
}
.shelf-card__author--placeholder {
  opacity: 0.5;
  font-style: italic;
}

.shelf-card__progress {
  height: 4px;
  background: color-mix(in srgb, var(--color-accent) 12%, var(--color-border));
}

.shelf-card__progress-bar {
  height: 100%;
  width: max(var(--shelf-progress-width, 0%), 3px);
  background: var(--color-accent);
  border-radius: 0 2px 2px 0;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-accent) 16%, transparent) inset;
  transition: width 0.3s ease;
}
</style>
