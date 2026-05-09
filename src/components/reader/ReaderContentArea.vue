<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import type { Ref } from 'vue';
import { NSpin, NAlert, NButton, NDropdown, useMessage } from 'naive-ui';
import type { PagedModeApi, ScrollModeApi, ComicModeApi } from './composables/useReaderModeBridge';
import { useFrontendPlugins, type ReaderTextSelectionContext } from '@/composables/useFrontendPlugins';
import { useOverlayBackstack } from '@/composables/useOverlayBackstack';
import ComicMode from './modes/ComicMode.vue';
import PagedMode from './modes/PagedMode.vue';
import ScrollMode from './modes/ScrollMode.vue';

type PagedModeKind = 'slide' | 'cover' | 'simulation' | 'none';

const props = defineProps<{
  content: string;
  isComicMode: boolean;
  isPagedMode: boolean;
  pagedMode: PagedModeKind | null;
  legacyPagedMode: PagedModeKind | null;
  pages: string[];
  pagedPageIndex: number;
  prevBoundaryPage: string;
  nextBoundaryPage: string;
  hasPrev: boolean;
  hasNext: boolean;
  blockingLoading: boolean;
  blockingError: boolean;
  error: string;
  pagedLoading: boolean;
  currentChapterName: string;
  currentChapterUrl: string;
  chapterIndex: number;
  fileName: string;
  sourceType?: string;
  bookUrl: string;
  bookName: string;
  ttsScrollHighlightIdx: number;
  tapZoneLeft: number;
  tapZoneRight: number;
  tapLeftAction: string;
  tapRightAction: string;
  layoutDebugMode: boolean;
  tapZoneDebug: boolean;
  paragraphSpacing: number;
  textIndent: number;
  /** 预加载的滚动模式上一章正文 */
  prevScrollChapterContent?: string;
  /** 预加载的滚动模式上一章章节名 */
  prevScrollChapterTitle?: string;
  /** 预加载的滚动模式下一章正文 */
  nextScrollChapterContent?: string;
  /** 预加载的滚动模式下一章章节名 */
  nextScrollChapterTitle?: string;
  /** 预加载的漫画模式上一章内容 */
  prevComicChapterContent?: string;
  /** 预加载的漫画模式上一章章节名 */
  prevComicChapterTitle?: string;
  /** 预加载的漫画模式下一章内容 */
  nextComicChapterContent?: string;
  /** 预加载的漫画模式下一章章节名 */
  nextComicChapterTitle?: string;
  /** Plain object (markRaw) containing parent Ref objects to write into */
  contentRefs: {
    pagedModeRef: Ref<PagedModeApi | null>;
    scrollModeRef: Ref<ScrollModeApi | null>;
    comicModeRef: Ref<ComicModeApi | null>;
    readerBodyRef: Ref<HTMLElement | null>;
    measureHostRef: Ref<HTMLElement | null>;
    backgroundMeasureHostRef: Ref<HTMLElement | null>;
  };
}>();

const emit = defineEmits<{
  (e: 'tap', zone: 'left' | 'center' | 'right'): void;
  (e: 'retry'): void;
  (e: 'paged-page-change', page: number): void;
  (e: 'paged-progress', ratio: number): void;
  (e: 'scroll-progress', ratio: number): void;
  (e: 'comic-progress', ratio: number): void;
  (e: 'prev-chapter'): void;
  (e: 'next-chapter'): void;
  (e: 'prev-boundary'): void;
  (e: 'next-boundary'): void;
  /** 滚动模式下用户进入上一章区域 */
  (e: 'scroll-prev-chapter-entered'): void;
  /** 滚动模式下用户进入下一章区域 */
  (e: 'scroll-next-chapter-entered', sectionHeight: number): void;
  /** 漫画模式下用户进入上一章区域 */
  (e: 'comic-prev-chapter-entered'): void;
  /** 漫画模式下用户进入下一章区域 */
  (e: 'comic-next-chapter-entered', sectionHeight: number): void;
}>();

const message = useMessage();
const { getReaderContextActions, runReaderContextAction } = useFrontendPlugins();
const selectionMode = ref(false);

const contextMenu = reactive({
  show: false,
  x: 0,
  y: 0,
  context: null as ReaderTextSelectionContext | null,
});

const longPress = {
  timer: 0,
  x: 0,
  y: 0,
  pointerId: -1,
  ready: false,
};

const LONG_PRESS_MS = 760;
const LONG_PRESS_MOVE_LIMIT = 6;

const hasReaderContextMenu = computed(
  () => !!contextMenu.context,
);

const contextMenuOptions = computed(() => {
  const actions = contextMenu.context ? getReaderContextActions(contextMenu.context) : [];
  if (actions.length === 0) {
    return [
      {
        label: '无',
        key: '__empty',
        disabled: true,
      },
    ];
  }
  return actions.map((action) => ({
    label: action.name,
    key: action.id,
  }));
});

useOverlayBackstack(
  () => contextMenu.show,
  () => closeReaderContextMenu(),
);

function closeReaderContextMenu() {
  contextMenu.show = false;
  contextMenu.context = null;
  updateSelectionModeFromSelection();
}

function getSelectedReaderText(): string {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) {
    return '';
  }
  const root = props.contentRefs.readerBodyRef.value;
  if (!root) {
    return '';
  }
  const anchor = selection.anchorNode;
  const focus = selection.focusNode;
  if (
    (anchor && !root.contains(anchor)) ||
    (focus && !root.contains(focus))
  ) {
    return '';
  }
  return selection.toString().replace(/\s+/g, ' ').trim();
}

function hasReaderSelection(): boolean {
  return !!getSelectedReaderText();
}

function updateSelectionModeFromSelection() {
  if (hasReaderSelection()) {
    selectionMode.value = true;
    return;
  }
  if (!contextMenu.show) {
    selectionMode.value = false;
  }
}

function buildSelectionContext(text: string): ReaderTextSelectionContext {
  return {
    text,
    sourceType: props.sourceType ?? 'novel',
    fileName: props.fileName,
    chapterIndex: props.chapterIndex,
    chapterName: props.currentChapterName,
    chapterUrl: props.currentChapterUrl,
    bookName: props.bookName || undefined,
    bookUrl: props.bookUrl || undefined,
  };
}

function openReaderContextMenu(x: number, y: number): boolean {
  if (props.sourceType && props.sourceType !== 'novel') {
    return false;
  }
  const text = getSelectedReaderText();
  if (!text) {
    return false;
  }
  const context = buildSelectionContext(text);
  contextMenu.context = context;
  contextMenu.x = x;
  contextMenu.y = y;
  contextMenu.show = true;
  return true;
}

function onReaderContextMenu(event: MouseEvent) {
  if (openReaderContextMenu(event.clientX, event.clientY)) {
    event.preventDefault();
    event.stopPropagation();
  } else {
    closeReaderContextMenu();
  }
}

function clearLongPressTimer() {
  if (longPress.timer) {
    window.clearTimeout(longPress.timer);
    longPress.timer = 0;
  }
  longPress.ready = false;
}

function enterSelectionMode() {
  selectionMode.value = true;
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(12);
  }
}

function onReaderPointerDown(event: PointerEvent) {
  if (event.pointerType === 'mouse' || event.button !== 0) {
    return;
  }
  clearLongPressTimer();
  longPress.x = event.clientX;
  longPress.y = event.clientY;
  longPress.pointerId = event.pointerId;
  longPress.ready = false;
  longPress.timer = window.setTimeout(() => {
    longPress.timer = 0;
    longPress.ready = true;
    enterSelectionMode();
  }, LONG_PRESS_MS);
}

function onReaderPointerMove(event: PointerEvent) {
  if (!longPress.timer || event.pointerId !== longPress.pointerId) {
    return;
  }
  const dx = event.clientX - longPress.x;
  const dy = event.clientY - longPress.y;
  if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_LIMIT) {
    clearLongPressTimer();
  }
}

function onReaderPointerUp(event: PointerEvent) {
  if (event.pointerId !== longPress.pointerId) {
    return;
  }
  if (longPress.ready) {
    void nextTick(() => {
      requestAnimationFrame(() => {
        const opened = openReaderContextMenu(longPress.x, longPress.y);
        if (!opened) {
          updateSelectionModeFromSelection();
        }
      });
    });
    event.preventDefault();
    event.stopPropagation();
  }
  clearLongPressTimer();
}

async function onReaderContextSelect(key: string) {
  if (key === '__empty') {
    return;
  }
  const context = contextMenu.context;
  closeReaderContextMenu();
  if (!context) {
    return;
  }
  try {
    await runReaderContextAction(key, context);
  } catch (error) {
    message.error(error instanceof Error ? error.message : String(error));
  }
}

watch(
  () => props.content,
  () => {
    window.getSelection()?.removeAllRanges();
    selectionMode.value = false;
    closeReaderContextMenu();
  },
);

onMounted(() => {
  document.addEventListener('selectionchange', updateSelectionModeFromSelection);
});

onBeforeUnmount(() => {
  document.removeEventListener('selectionchange', updateSelectionModeFromSelection);
  clearLongPressTimer();
});
</script>

<template>
  <!-- 内容主体 -->
  <div
    :ref="(el) => (props.contentRefs.readerBodyRef.value = el as HTMLElement | null)"
    class="reader-modal__body"
    @contextmenu="onReaderContextMenu"
    @pointerdown.capture="onReaderPointerDown"
    @pointermove.capture="onReaderPointerMove"
    @pointerup.capture="onReaderPointerUp"
    @pointercancel.capture="clearLongPressTimer"
  >
    <n-spin v-if="blockingLoading" :show="true" class="reader-modal__spin" />
    <n-alert v-else-if="blockingError" type="error" :title="error" style="margin: 24px">
      <n-button type="error" size="small" style="margin-top: 8px" @click="emit('retry')">
        重试
      </n-button>
    </n-alert>

    <ComicMode
      v-else-if="isComicMode"
      :ref="(el: any) => (props.contentRefs.comicModeRef.value = el)"
      :content="content"
      :file-name="fileName"
      :chapter-url="currentChapterUrl"
      :book-url="bookUrl"
      :book-name="bookName"
      :chapter-index="chapterIndex"
      :has-prev="hasPrev"
      :has-next="hasNext"
      :prev-chapter-content="prevComicChapterContent"
      :prev-chapter-title="prevComicChapterTitle"
      :next-chapter-content="nextComicChapterContent"
      :next-chapter-title="nextComicChapterTitle"
      @tap="emit('tap', $event)"
      @progress="emit('comic-progress', $event)"
      @prev-chapter="emit('prev-chapter')"
      @next-chapter="emit('next-chapter')"
      @prev-chapter-entered="emit('comic-prev-chapter-entered')"
      @next-chapter-entered="emit('comic-next-chapter-entered', $event)"
    />

    <PagedMode
      v-else-if="isPagedMode && legacyPagedMode"
      :ref="(el: any) => (props.contentRefs.pagedModeRef.value = el)"
      :mode="legacyPagedMode"
      :pages="pages"
      :current-page="pagedPageIndex"
      :prev-boundary-page="prevBoundaryPage"
      :next-boundary-page="nextBoundaryPage"
      :has-prev-chapter="hasPrev"
      :has-next-chapter="hasNext"
      :tap-zone-left="tapZoneLeft"
      :tap-zone-right="tapZoneRight"
      :tap-left-action="tapLeftAction"
      :tap-right-action="tapRightAction"
      :selection-mode="selectionMode"
      :busy="pagedLoading"
      :layout-debug="layoutDebugMode"
      :tap-zone-debug="tapZoneDebug"
      @tap="emit('tap', $event)"
      @update:current-page="emit('paged-page-change', $event)"
      @request-prev-chapter="emit('prev-boundary')"
      @request-next-chapter="emit('next-boundary')"
      @progress="emit('paged-progress', $event)"
    />

    <ScrollMode
      v-else
      :ref="(el: any) => (props.contentRefs.scrollModeRef.value = el)"
      :content="content"
      :chapter-title="currentChapterName"
      :paragraph-spacing="paragraphSpacing"
      :text-indent="textIndent"
      :has-prev="hasPrev"
      :has-next="hasNext"
      :prev-chapter-content="prevScrollChapterContent"
      :prev-chapter-title="prevScrollChapterTitle"
      :next-chapter-content="nextScrollChapterContent"
      :next-chapter-title="nextScrollChapterTitle"
      :tap-zone-left="tapZoneLeft"
      :tap-zone-right="tapZoneRight"
      :layout-debug="layoutDebugMode"
      :tap-zone-debug="tapZoneDebug"
      :tts-highlight-index="ttsScrollHighlightIdx"
      @tap="emit('tap', $event)"
      @progress="emit('scroll-progress', $event)"
      @prev-chapter-entered="emit('scroll-prev-chapter-entered')"
      @next-chapter-entered="emit('scroll-next-chapter-entered', $event)"
    />

    <n-dropdown
      :show="contextMenu.show && hasReaderContextMenu"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :options="contextMenuOptions"
      placement="bottom-start"
      trigger="manual"
      @clickoutside="closeReaderContextMenu"
      @select="onReaderContextSelect"
    />
  </div>

  <!-- 测量宿主（分页排版用） -->
  <div
    :ref="(el) => (props.contentRefs.measureHostRef.value = el as HTMLElement | null)"
    class="reader-modal__measure-host"
    aria-hidden="true"
  />
  <div
    :ref="(el) => (props.contentRefs.backgroundMeasureHostRef.value = el as HTMLElement | null)"
    class="reader-modal__measure-host"
    aria-hidden="true"
  />
</template>

<style scoped>
.reader-modal__body {
  position: absolute;
  top: var(--reader-body-top);
  right: var(--reader-body-right);
  bottom: var(--reader-body-bottom);
  left: var(--reader-body-left);
  z-index: 1;
  width: auto;
  height: auto;
  max-width: var(--reader-body-max-width);
  margin: var(--reader-body-margin);
  overflow: hidden;
  background: var(--reader-body-surface);
  border: var(--reader-body-border);
  border-radius: var(--reader-body-radius);
  box-shadow: var(--reader-body-shadow);
  backdrop-filter: var(--reader-body-backdrop-filter);
  -webkit-text-size-adjust: none;
  text-size-adjust: none;
}

.reader-modal__spin {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.reader-modal__measure-host {
  position: absolute;
  top: var(--reader-body-top);
  right: var(--reader-body-right);
  bottom: var(--reader-body-bottom);
  left: var(--reader-body-left);
  max-width: var(--reader-body-max-width);
  margin: var(--reader-body-margin);
  border-radius: var(--reader-body-radius);
  visibility: hidden;
  pointer-events: none;
  z-index: -1;
}
</style>
