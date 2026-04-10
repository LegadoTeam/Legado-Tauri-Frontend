<script setup lang="ts">
import type { BookSourceMeta } from '../../composables/useBookSource'
import type { BookItem } from '../../composables/useScriptBridge'
import { openUrl } from '@tauri-apps/plugin-opener'
import BookCard from './BookCard.vue'
import defaultLogoUrl from '../../assets/booksource-default.svg'

defineProps<{
  source: BookSourceMeta
  results: BookItem[]
  loading: boolean
  error: string
  showCovers?: boolean
}>()

const emit = defineEmits<{
  (e: 'select', book: BookItem, fileName: string): void
}>()
</script>

<template>
  <div class="ssg">
    <!-- 书源头 -->
    <div class="ssg__header">
      <img
        v-if="source.logo && source.logo.toLowerCase() !== 'default'"
        :src="source.logo"
        class="ssg__logo"
        :alt="source.name"
        @error="($event.target as HTMLImageElement).src = defaultLogoUrl"
      />
      <img v-else :src="defaultLogoUrl" class="ssg__logo" :alt="source.name" />
      <a v-if="source.url" class="ssg__name ssg__name--link" href="#" @click.prevent="openUrl(source.url)">{{ source.name }}</a>
      <span v-else class="ssg__name">{{ source.name }}</span>
      <n-tag v-if="source.tags[0]" size="tiny" :bordered="false" class="ssg__tag">{{ source.tags[0] }}</n-tag>
      <span v-if="loading" class="ssg__status ssg__status--loading">搜索中…</span>
      <n-tag v-else-if="error" size="tiny" type="error" :bordered="false">失败</n-tag>
      <span v-else-if="results.length" class="ssg__status">{{ results.length }} 条结果</span>
      <span v-else class="ssg__status ssg__status--empty">无结果</span>
    </div>

    <!-- 错误 -->
    <div v-if="error" class="ssg__error">{{ error }}</div>

    <!-- 加载中骨架 -->
    <div v-else-if="loading" class="ssg__loading">
      <n-spin size="small" />
    </div>
    <!-- 结果网格 -->
    <div v-else-if="results.length" class="ssg__grid">
      <BookCard
        v-for="book in results"
        :key="book.bookUrl"
        :book="book"
        :show-cover="showCovers ?? true"
        @select="emit('select', book, source.fileName)"
      />
    </div>
  </div>
</template>

<style scoped>
.ssg {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-raised);
  overflow: hidden;
  min-height: 80px;
  flex-shrink: 0;
}

.ssg__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}
.ssg__logo {
  width: 22px;
  height: 22px;
  border-radius: var(--radius-xs);
  object-fit: contain;
  flex-shrink: 0;
}
.ssg__name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-primary);
}
.ssg__name--link {
  text-decoration: none;
  cursor: pointer;
  transition: color var(--transition-fast);
}
.ssg__name--link:hover {
  color: var(--color-accent);
}
.ssg__tag {
  --n-color: var(--color-surface-hover) !important;
  --n-text-color: var(--color-text-muted) !important;
  font-size: 0.6875rem !important;
}
.ssg__status {
  margin-left: auto;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}
.ssg__status--loading {
  color: var(--color-accent);
}
.ssg__status--empty {
  opacity: 0.5;
}

.ssg__error {
  padding: 10px 14px;
  font-size: 0.8125rem;
  color: var(--color-danger);
}

.ssg__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.ssg__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 6px;
  padding: 8px;
  max-height: 500px;
  overflow-y: auto;
}
.ssg__grid::-webkit-scrollbar { width: 5px; }
.ssg__grid::-webkit-scrollbar-track { background: transparent; }
.ssg__grid::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 3px;
}
</style>
