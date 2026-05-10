<!-- ReaderContentArea — 阅读正文区域，负责阅读模式承载、文字选择菜单与选区插件动作。 -->
<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { NSpin, NAlert, NButton, NDropdown, useMessage } from 'naive-ui';
import { useReaderActionsStore, useReaderSessionStore, useReaderSettingsStore, useReaderViewStore } from '@/stores';
import { useFrontendPlugins, type ReaderTextSelectionContext } from '@/composables/useFrontendPlugins';
import { useOverlayBackstack } from '@/composables/useOverlayBackstack';
import { useReaderBookmarksStore } from '@/features/reader/stores/readerBookmarks';
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
const bookmarksStore = useReaderBookmarksStore();
const selectionMode = ref(false);

/** 当前章节中所有书签文本列表，用于高亮渲染 */
const chapterBookmarkTexts = computed(() =>
  bookmarksStore
    .getChapterBookmarks(bookUrl.value ?? '', fileName.value, activeChapterIndex.value)
    .map((b) => b.text),
);

/** 将书签文本插入 HTML 字符串中（用于分页模式预生成页面） */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function applyBookmarkHighlights(html: string, texts: string[]): string {
  let result = html;
  for (const text of texts) {
    if (!text.trim()) continue;
    const escaped = escapeHtml(text);
    result = result.split(escaped).join(
      `<mark class="reader-bookmark">${escaped}</mark>`,
    );
  }
  return result;
}

const pagedPagesHighlighted = computed(() => {
  const texts = chapterBookmarkTexts.value;
  if (texts.length === 0) return activePagedPages.value;
  return activePagedPages.value.map((page) => applyBookmarkHighlights(page, texts));
});

const prevBoundaryPageHighlighted = computed(() => {
  const texts = chapterBookmarkTexts.value;
  if (texts.length === 0) return prevBoundaryPage.value;
  return applyBookmarkHighlights(prevBoundaryPage.value, texts);
});

const nextBoundaryPageHighlighted = computed(() => {
  const texts = chapterBookmarkTexts.value;
  if (texts.length === 0) return nextBoundaryPage.value;
  return applyBookmarkHighlights(nextBoundaryPage.value, texts);
});

const contextMenu = reactive({
  show: false,
  x: 0,
  y: 0,
  context: null as ReaderTextSelectionContext | null,
});
let activeSelectionContext: ReaderTextSelectionContext | null = null;

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
  const items: { label: string; key: string; disabled?: boolean; type?: string }[] = [];

  if (contextMenu.context) {
    const ctx = contextMenu.context;
    const existing = bookmarksStore.findBookmark(
      ctx.bookUrl ?? '',
      ctx.fileName,
      ctx.chapterIndex,
      ctx.text,
    );
    items.push({ label: existing ? '取消书签' : '设置为书签', key: '__bookmark' });
  }

  if (items.length > 0 && actions.length > 0) {
    items.push({ type: 'divider', key: '__divider' } as { label: string; key: string; type: string });
  }

  for (const action of actions) {
    items.push({ label: action.name, key: action.id });
  }

  if (items.length === 0) {
    return [{ label: '无', key: '__empty', disabled: true }];
  }

  return items;
});

useOverlayBackstack(
  () => contextMenu.show,
  () => closeReaderContextMenu(),
);

function closeReaderContextMenu() {
  contextMenu.show = false;
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

function updateSelectionModeFromSelection() {
  const text = getSelectedReaderText();
  if (text) {
    if (!selectionMode.value && !contextMenu.show) {
      window.getSelection()?.removeAllRanges();
      return;
    }
    selectionMode.value = true;
    activeSelectionContext = buildSelectionContext(text);
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
  activeSelectionContext = context;
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

function getCaretRangeFromPoint(x: number, y: number): Range | null {
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  if (typeof doc.caretRangeFromPoint === 'function') {
    return doc.caretRangeFromPoint(x, y);
  }
  if (typeof doc.caretPositionFromPoint === 'function') {
    const position = doc.caretPositionFromPoint(x, y);
    if (!position) {
      return null;
    }
    const range = document.createRange();
    range.setStart(position.offsetNode, position.offset);
    range.collapse(true);
    return range;
  }
  return null;
}

function getCharacterGroup(char: string): 'ascii-word' | 'cjk' | 'other' | 'space' {
  if (/\s/.test(char)) {
    return 'space';
  }
  if (/[A-Za-z0-9_]/.test(char)) {
    return 'ascii-word';
  }
  if (/[\u3400-\u9fff\uf900-\ufaff]/.test(char)) {
    return 'cjk';
  }
  return 'other';
}

function findSelectableOffset(text: string, offset: number): number {
  const initial = Math.min(Math.max(offset, 0), Math.max(text.length - 1, 0));
  for (let radius = 0; radius <= 8; radius += 1) {
    const left = initial - radius;
    if (left >= 0 && getCharacterGroup(text.charAt(left)) !== 'space') {
      return left;
    }
    const right = initial + radius;
    if (right < text.length && getCharacterGroup(text.charAt(right)) !== 'space') {
      return right;
    }
  }
  return -1;
}

function selectReaderTextAtPoint(x: number, y: number): boolean {
  const root = contentRefs.value.readerBodyRef.value;
  const caretRange = getCaretRangeFromPoint(x, y);
  if (!root || !caretRange || !root.contains(caretRange.startContainer)) {
    return false;
  }
  const textNode = caretRange.startContainer;
  if (textNode.nodeType !== Node.TEXT_NODE) {
    return false;
  }
  const text = textNode.textContent ?? '';
  if (!text) {
    return false;
  }

  const selectableOffset = findSelectableOffset(text, caretRange.startOffset);
  if (selectableOffset < 0) {
    return false;
  }
  const group = getCharacterGroup(text.charAt(selectableOffset));
  if (group === 'space') {
    return false;
  }

  let start = selectableOffset;
  let end = selectableOffset + 1;
  if (group === 'ascii-word') {
    while (start > 0 && getCharacterGroup(text.charAt(start - 1)) === group) {
      start -= 1;
    }
    while (end < text.length && getCharacterGroup(text.charAt(end)) === group) {
      end += 1;
    }
  }

  const range = document.createRange();
  range.setStart(textNode, start);
  range.setEnd(textNode, end);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  updateSelectionModeFromSelection();
  return true;
}

function enterSelectionMode() {
  selectionMode.value = true;
  void nextTick(() => {
    if (!selectReaderTextAtPoint(longPress.x, longPress.y)) {
      updateSelectionModeFromSelection();
    }
  });
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(12);
  }
}

function onReaderPointerDown(event: PointerEvent) {
  if (
    sourceType.value !== 'novel' ||
    selectionMode.value ||
    event.pointerType === 'mouse' ||
    event.button !== 0
  ) {
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
    // 分页拖动会经过正文节点，移动超过阈值时必须撤销长按候选，避免拖页误触文本选择。
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

  if (key === '__bookmark') {
    const context = contextMenu.context ?? activeSelectionContext;
    closeReaderContextMenu();
    if (!context) return;
    const existing = bookmarksStore.findBookmark(
      context.bookUrl ?? '',
      context.fileName,
      context.chapterIndex,
      context.text,
    );
    if (existing) {
      await bookmarksStore.removeBookmark(existing.id);
      message.info('书签已取消');
    } else {
      await bookmarksStore.addBookmark({
        bookUrl: context.bookUrl ?? '',
        fileName: context.fileName,
        chapterIndex: context.chapterIndex,
        chapterName: context.chapterName,
        text: context.text,
      });
      message.success('书签已设置');
    }
    return;
  }

  const context = contextMenu.context ?? activeSelectionContext;
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
    activeSelectionContext = null;
    contextMenu.context = null;
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
    :class="{ 'reader-modal__body--selection-mode': selectionMode }"
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
      :pages="pagedPagesHighlighted"
      :current-page="pagedPageIndex"
      :prev-boundary-page="prevBoundaryPageHighlighted"
      :next-boundary-page="nextBoundaryPageHighlighted"
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
      :bookmark-texts="chapterBookmarkTexts"
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
  -webkit-user-select: none;
  user-select: none;
}

.reader-modal__body :deep(*) {
  -webkit-user-select: none !important;
  user-select: none !important;
}

.reader-modal__body--selection-mode,
.reader-modal__body--selection-mode :deep(*) {
  -webkit-user-select: text !important;
  user-select: text !important;
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
