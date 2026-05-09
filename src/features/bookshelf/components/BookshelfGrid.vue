<script setup lang="ts">
import { BookOpen } from 'lucide-vue-next';
import type { ShelfBook } from '@/stores';
import ShelfBookCard from '@/components/bookshelf/ShelfBookCard.vue';

defineProps<{
  loading: boolean;
  books: ShelfBook[];
  filteredBooks: ShelfBook[];
  privacyModeEnabled: boolean;
  openingBookId: string | null;
}>();

const emit = defineEmits<{
  (e: 'select', book: ShelfBook): void;
  (e: 'contextmenu', book: ShelfBook, event: MouseEvent): void;
}>();
</script>

<template>
  <div class="bs-content app-scrollbar">
    <n-spin :show="loading" style="flex: 1">
      <div v-if="!loading && !books.length" class="bs-empty">
        <div class="bs-empty__icon">
          <BookOpen :size="56" :stroke-width="1" />
        </div>
        <h3 class="bs-empty__title">书架空空如也</h3>
        <p class="bs-empty__desc">去发现页搜索书籍，加入书架开始阅读吧</p>
      </div>

      <div v-else class="bs-grid">
        <ShelfBookCard
          v-for="book in filteredBooks"
          :key="book.id"
          :book="book"
          :privacy-mode-enabled="privacyModeEnabled"
          :loading="openingBookId === book.id"
          @select="emit('select', $event)"
          @contextmenu="(_, e: MouseEvent) => emit('contextmenu', book, e)"
        />
      </div>
    </n-spin>
  </div>
</template>

<style scoped>
.bs-content {
  flex: 1;
  overflow-y: auto;
  padding: 0 24px 16px;
}
.bs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--book-card-col-min, 120px), 1fr));
  gap: 12px;
  padding-top: 4px;
}
.bs-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  gap: 8px;
}
.bs-empty__icon {
  opacity: 0.25;
  color: var(--color-text-muted);
}
.bs-empty__title {
  font-size: 1rem;
  font-weight: var(--fw-semibold);
  color: var(--color-text-soft);
  margin: 0;
}
.bs-empty__desc {
  font-size: var(--fs-13);
  color: var(--color-text-muted);
  margin: 0;
}
@media (pointer: coarse), (max-width: 640px) {
  .bs-content {
    padding: 0 16px 16px;
  }
  .bs-grid {
    grid-template-columns: repeat(
      auto-fill,
      minmax(var(--book-card-col-min-mobile, var(--book-card-col-min, 100px)), 1fr)
    );
    gap: 8px;
  }
}
</style>
