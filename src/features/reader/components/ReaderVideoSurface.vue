<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { ref } from 'vue';
import type { ChapterGroup } from '@/stores';
import VideoPlayerPage from '@/components/reader/modes/VideoPlayerPage.vue';
import { useReaderActionsStore, useReaderSessionStore, useReaderViewStore } from '@/stores';

defineProps<{
  chapterGroups?: ChapterGroup[];
  initialGroupIndex?: number;
  inlineGroupTabs?: boolean;
  episodeProgress?: Record<string, { time: number; duration: number; lastPlayedAt: number }>;
}>();

const readerActionsStore = useReaderActionsStore();
const readerSessionStore = useReaderSessionStore();
const readerViewStore = useReaderViewStore();

const playerRef = ref<{
  getCurrentTime?: () => number;
  getDuration?: () => number;
} | null>(null);

const { activeChapterIndex, content, error, pendingResumePlaybackTime } =
  storeToRefs(readerSessionStore);
const { blockingLoading, bookInfo, chapters, fileName, hasNext, hasPrev } =
  storeToRefs(readerViewStore);

function getCurrentTime() {
  return playerRef.value?.getCurrentTime?.() ?? 0;
}

function getDuration() {
  return playerRef.value?.getDuration?.() ?? 0;
}

defineExpose({ getCurrentTime, getDuration });
</script>

<template>
  <VideoPlayerPage
    ref="playerRef"
    :content="content"
    :chapters="chapters"
    :active-chapter-index="activeChapterIndex"
    :book-info="bookInfo"
    :loading="blockingLoading"
    :error="error"
    :has-prev="hasPrev"
    :has-next="hasNext"
    :file-name="fileName"
    :resume-time="pendingResumePlaybackTime"
    :chapter-groups="chapterGroups"
    :initial-group-index="initialGroupIndex"
    :inline-group-tabs="inlineGroupTabs"
    :episode-progress="episodeProgress"
    @close="readerActionsStore.close"
    @goto-chapter="readerActionsStore.gotoChapter"
    @prev-chapter="readerActionsStore.gotoPrevChapter"
    @next-chapter="readerActionsStore.gotoNextChapter"
    @progress="readerActionsStore.onVideoProgress"
    @ended="readerActionsStore.onVideoEnded"
    @retry="readerActionsStore.retryCurrentChapter"
  />
</template>
