<script setup lang="ts">
import type { WholeBookSwitchedPayload } from '@/components/reader/types';
import type { CachedChapter, ChapterItem, ShelfBook } from '@/stores';
import BookCoverGeneratorDialog from '@/components/bookshelf/BookCoverGeneratorDialog.vue';
import BookDetailEditorDialog from '@/components/bookshelf/BookDetailEditorDialog.vue';
import BookExportDialog from '@/components/bookshelf/BookExportDialog.vue';
import BookSourceSwitchDialog from '@/components/explore/BookSourceSwitchDialog.vue';
import TxtImportDialog from '@/features/local-txt/TxtImportDialog.vue';

defineProps<{
  showSourceSwitchDialog: boolean;
  switchTargetBook: ShelfBook | null;
  switchTargetChapters: ChapterItem[];
  showCoverGeneratorDialog: boolean;
  coverGeneratorBook: ShelfBook | null;
  showExportDialog: boolean;
  exportBook: ShelfBook | null;
  exportCachedChapters: CachedChapter[];
  showBookDetailDialog: boolean;
  bookDetailBook: ShelfBook | null;
  bookDetailMode: 'view' | 'edit';
  showTxtImportDialog: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:showSourceSwitchDialog', value: boolean): void;
  (e: 'update:showCoverGeneratorDialog', value: boolean): void;
  (e: 'update:showExportDialog', value: boolean): void;
  (e: 'update:showBookDetailDialog', value: boolean): void;
  (e: 'update:showTxtImportDialog', value: boolean): void;
  (e: 'whole-book-switched', payload: WholeBookSwitchedPayload): void;
  (e: 'cover-applied', bookId: string): void;
  (e: 'book-detail-saved', bookId: string): void;
  (
    e: 'txt-imported',
    payload: {
      title: string;
      author: string;
      chapters: Array<{ title: string; content: string }>;
      preface: string;
    },
  ): void;
}>();
</script>

<template>
  <BookSourceSwitchDialog
    :show="showSourceSwitchDialog"
    mode="whole-book"
    :current-book="{
      name: switchTargetBook?.name ?? '',
      author: switchTargetBook?.author ?? '',
      coverUrl: switchTargetBook?.coverUrl,
      intro: switchTargetBook?.intro,
      kind: switchTargetBook?.kind,
      lastChapter: switchTargetBook?.lastChapter,
      bookUrl: switchTargetBook?.bookUrl,
    }"
    :current-file-name="switchTargetBook?.fileName ?? ''"
    :current-source-name="switchTargetBook?.sourceName ?? ''"
    :current-source-type="switchTargetBook?.sourceType ?? 'novel'"
    :current-chapters="switchTargetChapters"
    :current-read-chapter-index="switchTargetBook?.readChapterIndex ?? -1"
    :current-read-chapter-url="switchTargetBook?.readChapterUrl"
    :shelf-book-id="switchTargetBook?.id"
    @update:show="emit('update:showSourceSwitchDialog', $event)"
    @whole-book-switched="emit('whole-book-switched', $event)"
  />

  <BookCoverGeneratorDialog
    :show="showCoverGeneratorDialog"
    :book="coverGeneratorBook"
    @update:show="emit('update:showCoverGeneratorDialog', $event)"
    @applied="emit('cover-applied', $event)"
  />

  <BookExportDialog
    v-if="exportBook"
    :show="showExportDialog"
    :book="exportBook"
    :chapters="exportCachedChapters"
    @update:show="emit('update:showExportDialog', $event)"
  />

  <BookDetailEditorDialog
    :show="showBookDetailDialog"
    :book="bookDetailBook"
    :initial-mode="bookDetailMode"
    @update:show="emit('update:showBookDetailDialog', $event)"
    @saved="emit('book-detail-saved', $event)"
  />

  <TxtImportDialog
    :show="showTxtImportDialog"
    @update:show="emit('update:showTxtImportDialog', $event)"
    @imported="emit('txt-imported', $event)"
  />
</template>
