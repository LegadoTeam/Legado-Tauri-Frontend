<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { NSpin, NAlert, NButton, NDropdown, useMessage } from 'naive-ui';
import { useReaderActionsStore, useReaderSessionStore, useReaderSettingsStore, useReaderViewStore } from '@/stores';
import { useFrontendPlugins, type ReaderTextSelectionContext } from '@/composables/useFrontendPlugins';
import { useOverlayBackstack } from '@/composables/useOverlayBackstack';
import ComicMode from './modes/ComicMode.vue';
import PagedMode from './modes/PagedMode.vue';
import ScrollMode from './modes/ScrollMode.vue';

const message = useMessage();
const readerActionsStore = useReaderActionsStore();
const readerSessionStore = useReaderSessionStore();
const readerViewStore = useReaderViewStore();
const { settings, tapZoneDebugPreviewVisible } = useReaderSettingsStore();
const { activeChapterIndex, content, error, pagedLoading, pagedPageIndex } = storeToRefs(readerSessionStore);
const {
  activePagedPages,
  blockingError,
  blockingLoading,
  bookName,
  bookUrl,
  contentRefs,
  currentChapterName,
  currentChapterUrl,
  currentScrollChapterLoading,
  fileName,
  hasNext,
  hasPrev,
  isComicMode,
  isPagedMode,
  legacyPagedMode,
  nextBoundaryPage,
  nextComicChapterContent,
  nextComicChapterTitle,
  nextScrollChapterLoading,
  nextScrollChapterContent,
  nextScrollChapterTitle,
  prevBoundaryPage,
  prevComicChapterContent,
  prevComicChapterTitle,
  prevScrollChapterLoading,
  prevScrollChapterContent,
  prevScrollChapterTitle,
  sourceType,
  ttsScrollHighlightIdx,
} = storeToRefs(readerViewStore);
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
  const root = contentRefs.value.readerBodyRef.value;
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
    sourceType: sourceType.value,
    fileName: fileName.value,
    chapterIndex: activeChapterIndex.value,
    chapterName: currentChapterName.value,
    chapterUrl: currentChapterUrl.value,
    bookName: bookName.value || undefined,
    bookUrl: bookUrl.value || undefined,
  };
}

function openReaderContextMenu(x: number, y: number): boolean {
  if (sourceType.value !== 'novel') {
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
  content,
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
    :ref="(el) => (contentRefs.readerBodyRef.value = el as HTMLElement | null)"
    class="reader-modal__body"
    @contextmenu="onReaderContextMenu"
    @pointerdown.capture="onReaderPointerDown"
    @pointermove.capture="onReaderPointerMove"
    @pointerup.capture="onReaderPointerUp"
    @pointercancel.capture="clearLongPressTimer"
  >
    <n-spin v-if="blockingLoading" :show="true" class="reader-modal__spin" />
    <n-alert v-else-if="blockingError" type="error" :title="error" style="margin: 24px">
      <n-button
        type="error"
        size="small"
        style="margin-top: 8px"
        @click="readerActionsStore.retryCurrentChapter"
      >
        重试
      </n-button>
    </n-alert>

    <ComicMode
      v-else-if="isComicMode"
      :ref="(el: any) => (contentRefs.comicModeRef.value = el)"
      :content="content"
      :file-name="fileName"
      :chapter-url="currentChapterUrl"
      :book-url="bookUrl"
      :book-name="bookName"
      :chapter-index="activeChapterIndex"
      :has-prev="hasPrev"
      :has-next="hasNext"
      :prev-chapter-content="prevComicChapterContent"
      :prev-chapter-title="prevComicChapterTitle"
      :next-chapter-content="nextComicChapterContent"
      :next-chapter-title="nextComicChapterTitle"
      @tap="readerActionsStore.onTap"
      @progress="readerActionsStore.onComicProgress"
      @prev-chapter="readerActionsStore.gotoPrevChapter"
      @next-chapter="readerActionsStore.gotoNextChapter"
      @prev-chapter-entered="readerActionsStore.onComicPrevChapterEntered"
      @next-chapter-entered="readerActionsStore.onComicNextChapterEntered"
    />

    <PagedMode
      v-else-if="isPagedMode && legacyPagedMode"
      :ref="(el: any) => (contentRefs.pagedModeRef.value = el)"
      :mode="legacyPagedMode"
      :pages="activePagedPages"
      :current-page="pagedPageIndex"
      :prev-boundary-page="prevBoundaryPage"
      :next-boundary-page="nextBoundaryPage"
      :has-prev-chapter="hasPrev"
      :has-next-chapter="hasNext"
      :tap-zone-left="settings.tapZoneLeft"
      :tap-zone-right="settings.tapZoneRight"
      :tap-left-action="settings.tapLeftAction"
      :tap-right-action="settings.tapRightAction"
      :selection-mode="selectionMode"
      :busy="pagedLoading"
      :layout-debug="settings.layoutDebugMode"
      :tap-zone-debug="tapZoneDebugPreviewVisible"
      @tap="readerActionsStore.onTap"
      @update:current-page="readerActionsStore.onPagedPageChange"
      @request-prev-chapter="readerActionsStore.gotoPrevBoundary"
      @request-next-chapter="readerActionsStore.gotoNextBoundary"
      @progress="readerActionsStore.onPagedProgress"
    />

    <ScrollMode
      v-else
      :ref="(el: any) => (contentRefs.scrollModeRef.value = el)"
      :content="content"
      :chapter-title="currentChapterName"
      :paragraph-spacing="settings.typography.paragraphSpacing"
      :text-indent="settings.typography.textIndent"
      :has-prev="hasPrev"
      :has-next="hasNext"
      :prev-chapter-content="prevScrollChapterContent"
      :prev-chapter-title="prevScrollChapterTitle"
      :prev-chapter-loading="prevScrollChapterLoading"
      :next-chapter-content="nextScrollChapterContent"
      :next-chapter-title="nextScrollChapterTitle"
      :next-chapter-loading="nextScrollChapterLoading"
      :current-chapter-loading="currentScrollChapterLoading"
      :tap-zone-left="settings.tapZoneLeft"
      :tap-zone-right="settings.tapZoneRight"
      :layout-debug="settings.layoutDebugMode"
      :tap-zone-debug="tapZoneDebugPreviewVisible"
      :tts-highlight-index="ttsScrollHighlightIdx"
      @tap="readerActionsStore.onTap"
      @progress="readerActionsStore.onScrollProgress"
      @prev-chapter-entered="readerActionsStore.onScrollPrevChapterEntered"
      @next-chapter-entered="readerActionsStore.onScrollNextChapterEntered"
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
    :ref="(el) => (contentRefs.measureHostRef.value = el as HTMLElement | null)"
    class="reader-modal__measure-host"
    aria-hidden="true"
  />
  <div
    :ref="(el) => (contentRefs.backgroundMeasureHostRef.value = el as HTMLElement | null)"
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
