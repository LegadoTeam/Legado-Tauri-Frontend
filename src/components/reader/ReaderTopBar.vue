<script setup lang="ts">
import { openUrl } from '@tauri-apps/plugin-opener'

defineProps<{
  chapterName: string
  currentIndex: number
  totalChapters: number
  chapterUrl?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()
</script>

<template>
  <div class="reader-top-bar">
    <!-- <div style=" border: 1px solid rgba(255, 255, 255, 0.2); width: 100%; height: 1px;"></div> -->
    <button class="reader-top-bar__back" @click="emit('close')" title="返回">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
    <div class="reader-top-bar__center">
      <span class="reader-top-bar__title" :title="chapterName">{{ chapterName }}</span>
      <a v-if="chapterUrl" class="reader-top-bar__url" href="#" :title="chapterUrl"
        @click.prevent="openUrl(chapterUrl)">{{ chapterUrl }}</a>
    </div>
    <span class="reader-top-bar__progress">{{ currentIndex + 1 }}/{{ totalChapters }}</span>

  </div>
</template>

<style scoped>
.reader-top-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 11;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  /* 状态栏高度 + 内容区内边距（8px），确保文字不与状态栏重叠 */
  padding-top: calc(var(--safe-area-inset-top, env(safe-area-inset-top, 0px)) + 8px);
  /* border: 1px solid rgba(255, 255, 255, 0.2); */

  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(12px);
  color: #e0e0e0;
}

.reader-top-bar__back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background 0.15s;
}

.reader-top-bar__back:hover {
  background: rgba(255, 255, 255, 0.1);
}

.reader-top-bar__center {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.reader-top-bar__title {
  font-size: 0.875rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reader-top-bar__url {
  font-size: 0.6875rem;
  color: #63b3ed;
  opacity: 0.7;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-decoration: none;
  cursor: pointer;
}

.reader-top-bar__url:hover {
  opacity: 1;
  text-decoration: underline;
}

.reader-top-bar__progress {
  flex-shrink: 0;
  font-size: 0.75rem;
  opacity: 0.7;
}
</style>
