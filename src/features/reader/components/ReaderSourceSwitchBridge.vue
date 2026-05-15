<script setup lang="ts">
import type {
  ReaderBookInfo,
  TemporaryChapterSourceOverride,
  WholeBookSwitchedPayload,
} from '@/components/reader/types';
import type { ChapterItem } from '@/stores';
import BookSourceSwitchDialog from '@/components/explore/BookSourceSwitchDialog.vue';

defineProps<{
  show: boolean;
  mode: 'whole-book' | 'chapter-temp';
  bookInfo?: ReaderBookInfo;
  fileName: string;
  sourceType?: string;
  chapters: ChapterItem[];
  activeChapterIndex: number;
  currentChapterUrl: string;
  currentShelfId: string | undefined;
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'chapter-temp-switched', payload: TemporaryChapterSourceOverride): void;
  (e: 'whole-book-switched', payload: WholeBookSwitchedPayload): void;
}>();
</script>

<template>
  <BookSourceSwitchDialog
    :show="show"
    :mode="mode"
    :current-book="{
      name: bookInfo?.name ?? '',
      author: bookInfo?.author ?? '',
      coverUrl: bookInfo?.coverUrl,
      intro: bookInfo?.intro,
      kind: bookInfo?.kind,
      lastChapter: bookInfo?.lastChapter,
      bookUrl: bookInfo?.bookUrl,
    }"
    :current-file-name="fileName"
    :current-source-name="bookInfo?.sourceName ?? ''"
    :current-source-type="sourceType"
    :current-chapters="chapters"
    :current-read-chapter-index="activeChapterIndex"
    :current-read-chapter-url="currentChapterUrl"
    :shelf-book-id="currentShelfId"
    @update:show="emit('update:show', $event)"
    @chapter-temp-switched="emit('chapter-temp-switched', $event)"
    @whole-book-switched="emit('whole-book-switched', $event)"
  />
</template>
