<script setup lang="ts">
import { Bookmark } from 'lucide-vue-next';
import { ref } from 'vue';
import type { ChapterItem } from '@/stores';
import type {
  ReaderBookInfo,
  TemporaryChapterSourceOverride,
  WholeBookSwitchedPayload,
} from '../reader/types';
// eslint-disable-next-line typescript/consistent-type-imports -- component is used in template
import ReaderBottomBar from '../reader/ReaderBottomBar.vue';
import ReaderTocPanel from '../reader/ReaderTocPanel.vue';
import ReaderTopBar from '../reader/ReaderTopBar.vue';
import TtsControlBar from '../reader/TtsControlBar.vue';
import ReaderSourceSwitchBridge from '@/features/reader/components/ReaderSourceSwitchBridge.vue';

const props = defineProps<{
  showMenu: boolean;
  showToc: boolean;
  settingsVisible: boolean;
  showTtsBar: boolean;
  ttsProgressText: string;
  showSourceSwitchDialog: boolean;
  sourceSwitchMode: 'whole-book' | 'chapter-temp';
  chapters: ChapterItem[];
  activeChapterIndex: number;
  bookInfo?: ReaderBookInfo;
  sourceType?: string;
  hasPrev: boolean;
  hasNext: boolean;
  currentChapterName: string;
  currentChapterUrl: string;
  isVideoMode: boolean;
  isOnShelf: boolean;
  addingToShelf: boolean;
  currentChapterOverride: TemporaryChapterSourceOverride | null;
  currentShelfId: string | undefined;
  fileName: string;
  readIndices?: Set<number>;
  cachedIndices?: Set<number>;
  refreshingToc?: boolean;
  menuOpenTime: number;
}>();

const emit = defineEmits<{
  (e: 'update:show-menu', val: boolean): void;
  (e: 'update:show-toc', val: boolean): void;
  (e: 'update:settings-visible', val: boolean): void;
  (e: 'update:show-tts-bar', val: boolean): void;
  (e: 'update:show-source-switch-dialog', val: boolean): void;
  (e: 'overlay-click'): void;
  (e: 'prev'): void;
  (e: 'next'): void;
  (e: 'goto', idx: number): void;
  (e: 'open-toc'): void;
  (e: 'settings-visible', val: boolean): void;
  (e: 'dump-pagination-layout'): void;
  (e: 'tts-toggle'): void;
  (e: 'close'): void;
  (e: 'refresh-chapter'): void;
  (e: 'cache-chapters', count: number): void;
  (e: 'whole-book-switch'): void;
  (e: 'temporary-switch'): void;
  (e: 'clear-temporary-switch'): void;
  (e: 'add-to-shelf'): void;
  (e: 'select-toc', idx: number): void;
  (e: 'refresh-toc'): void;
  (e: 'clear-chapter-cache', idx: number): void;
  (e: 'clear-all-cache'): void;
  (e: 'chapter-temp-switched', payload: TemporaryChapterSourceOverride): void;
  (e: 'whole-book-switched', payload: WholeBookSwitchedPayload): void;
}>();

const bottomBarRef = ref<InstanceType<typeof ReaderBottomBar> | null>(null);

function closeSettings() {
  bottomBarRef.value?.closeSettings();
}

defineExpose({ closeSettings });
</script>

<template>
  <!-- 菜单遮罩 -->
  <Transition name="reader-fade">
    <div
      v-if="showMenu"
      class="reader-modal__overlay"
      @click="Date.now() - menuOpenTime > 200 && emit('overlay-click')"
    />
  </Transition>

  <!-- 顶部工具栏 -->
  <Transition name="reader-slide-top">
    <ReaderTopBar
      v-if="showMenu && !settingsVisible"
      :chapter-name="currentChapterName"
      :current-index="activeChapterIndex"
      :total-chapters="chapters.length"
      :chapter-url="currentChapterUrl"
      :source-type="sourceType"
      :can-whole-book-switch="!!currentShelfId && !isVideoMode"
      :can-temporary-switch="!isVideoMode"
      :has-temporary-override="!!currentChapterOverride"
      @close="emit('close')"
      @refresh-chapter="emit('refresh-chapter')"
      @cache-chapters="emit('cache-chapters', $event)"
      @whole-book-switch="emit('whole-book-switch')"
      @temporary-switch="emit('temporary-switch')"
      @clear-temporary-switch="emit('clear-temporary-switch')"
    />
  </Transition>

  <!-- 临时书源芯片 -->
  <Transition name="reader-fade">
    <div
      v-if="showMenu && !settingsVisible && currentChapterOverride"
      class="reader-modal__temp-source-chip"
    >
      本章临时源：{{ currentChapterOverride.sourceName }}
    </div>
  </Transition>

  <!-- 加入书架按钮 -->
  <Transition name="reader-fade">
    <button
      v-if="showMenu && !settingsVisible && !isOnShelf && bookInfo"
      class="reader-modal__shelf-btn"
      :disabled="addingToShelf"
      @click="emit('add-to-shelf')"
    >
      <Bookmark :size="16" aria-hidden="true" />
      {{ addingToShelf ? '加入中…' : '加入书架' }}
    </button>
  </Transition>

  <!-- 底部工具栏 -->
  <Transition name="reader-slide-bottom">
    <ReaderBottomBar
      v-if="showMenu"
      ref="bottomBarRef"
      :chapters="chapters"
      :current-index="activeChapterIndex"
      :has-prev="hasPrev"
      :has-next="hasNext"
      :source-type="sourceType"
      @prev="emit('prev')"
      @next="emit('next')"
      @goto="emit('goto', $event)"
      @open-toc="emit('open-toc')"
      @settings-visible="emit('settings-visible', $event)"
      @dump-pagination-layout="emit('dump-pagination-layout')"
      @tts-toggle="emit('tts-toggle')"
    />
  </Transition>

  <!-- TTS 浮动控制条 -->
  <TtsControlBar
    :visible="showTtsBar"
    :progress-text="ttsProgressText"
    @close="emit('update:show-tts-bar', false)"
  />

  <!-- 目录面板 -->
  <ReaderTocPanel
    :show="showToc"
    :chapters="chapters"
    :current-index="activeChapterIndex"
    :book-info="bookInfo"
    :read-indices="readIndices"
    :cached-indices="cachedIndices"
    :refreshing-toc="refreshingToc"
    :source-type="sourceType"
    @update:show="emit('update:show-toc', $event)"
    @select="emit('select-toc', $event)"
    @refresh-toc="emit('refresh-toc')"
    @clear-chapter-cache="emit('clear-chapter-cache', $event)"
    @clear-all-cache="emit('clear-all-cache')"
  />

  <ReaderSourceSwitchBridge
    :show="showSourceSwitchDialog"
    :mode="sourceSwitchMode"
    :book-info="bookInfo"
    :file-name="fileName"
    :source-type="sourceType"
    :chapters="chapters"
    :active-chapter-index="activeChapterIndex"
    :current-chapter-url="currentChapterUrl"
    :current-shelf-id="currentShelfId"
    @update:show="emit('update:show-source-switch-dialog', $event)"
    @chapter-temp-switched="emit('chapter-temp-switched', $event)"
    @whole-book-switched="emit('whole-book-switched', $event)"
  />
</template>

<style scoped>
.reader-modal__overlay {
  position: absolute;
  inset: 0;
  background: var(--reader-menu-overlay-bg);
  z-index: 10;
}

.reader-fade-enter-active,
.reader-fade-leave-active {
  transition: opacity 0.25s ease;
}

.reader-fade-enter-from,
.reader-fade-leave-to {
  opacity: 0;
}

.reader-slide-top-enter-active,
.reader-slide-top-leave-active {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.reader-slide-top-enter-from,
.reader-slide-top-leave-to {
  transform: translateY(-100%);
}

.reader-slide-bottom-enter-active,
.reader-slide-bottom-leave-active {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.reader-slide-bottom-enter-from,
.reader-slide-bottom-leave-to {
  transform: translateY(100%);
}

.reader-modal__shelf-btn {
  position: absolute;
  top: calc(var(--safe-area-inset-top, env(safe-area-inset-top, 0px)) + 58px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 12;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  border: none;
  border-radius: 20px;
  background: var(--color-accent);
  color: #fff;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  backdrop-filter: blur(8px);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
  white-space: nowrap;
  transition:
    opacity 0.2s,
    transform 0.2s;
}

.reader-modal__shelf-btn:disabled {
  opacity: 0.65;
  cursor: default;
}

.reader-modal__shelf-btn:not(:disabled):hover {
  opacity: 0.88;
  transform: translateX(-50%) scale(1.03);
}

.reader-modal__temp-source-chip {
  position: absolute;
  top: calc(var(--safe-area-inset-top, env(safe-area-inset-top, 0px)) + 60px);
  right: 16px;
  z-index: 12;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(12, 83, 65, 0.9);
  color: #f4fffb;
  font-size: 12px;
  font-weight: 600;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.26);
  backdrop-filter: blur(10px);
}
</style>
