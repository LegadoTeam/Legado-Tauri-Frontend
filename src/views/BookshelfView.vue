<script setup lang="ts">
import { useMessage } from 'naive-ui';
import { storeToRefs } from 'pinia';
import { computed, onMounted, watch } from 'vue';
import ChapterReaderModal from '@/components/explore/ChapterReaderModal.vue';
import { useOverlayBackstack } from '@/composables/useOverlayBackstack';
import { isTransportAvailable } from '@/composables/useTransport';
import { useViewCardDensity, type CardSizeKey } from '@/composables/useViewCardDensity';
import BookshelfContextMenu from '@/features/bookshelf/components/BookshelfContextMenu.vue';
import BookshelfDialogs from '@/features/bookshelf/components/BookshelfDialogs.vue';
import BookshelfGrid from '@/features/bookshelf/components/BookshelfGrid.vue';
import BookshelfHeader from '@/features/bookshelf/components/BookshelfHeader.vue';
import BookshelfToolbar from '@/features/bookshelf/components/BookshelfToolbar.vue';
import { useTocAutoUpdate } from '@/composables/useTocAutoUpdate';
import { useBookshelfActions } from '@/features/bookshelf/services/bookshelfActions';
import { useBookshelfReaderLauncher } from '@/features/bookshelf/services/bookshelfReaderLauncher';
import {
  useBookshelfReaderStore,
  useBookshelfStore,
  useBookshelfUiStore,
  useFrontendPluginsStore,
  useNavigationStore,
  usePrivacyModeStore,
} from '@/stores';

const message = useMessage();
const bookshelfStore = useBookshelfStore();
const uiStore = useBookshelfUiStore();
const readerStore = useBookshelfReaderStore();
const frontendPluginsStore = useFrontendPluginsStore();
const privacyModeStore = usePrivacyModeStore();

const { books, loading } = storeToRefs(bookshelfStore);
const {
  searchKw,
  openingBookId,
  showDropdown,
  dropdownX,
  dropdownY,
  showCoverGeneratorDialog,
  coverGeneratorBook,
  showSourceSwitchDialog,
  switchTargetBook,
  showExportDialog,
  exportBook,
  exportCachedChapters,
  showBookDetailDialog,
  bookDetailBook,
  bookDetailMode,
} = storeToRefs(uiStore);
const { filteredBooks, menuOptions } = storeToRefs(uiStore);
const {
  showReader,
  readerFileName,
  readerChapterUrl,
  readerChapterName,
  readerChapters,
  readerCurrentIndex,
  readerShelfId,
  readerBookInfo,
  readerSourceType,
  refreshingToc,
} = storeToRefs(readerStore);
const { privacyModeEnabled, privacyExitTick } = storeToRefs(privacyModeStore);
const { togglePrivacyMode } = privacyModeStore;

const {
  cardSizes: CARD_SIZES,
  activeSize,
  activeSizeKey,
  style: bookshelfDensityStyle,
  setSize,
} = useViewCardDensity('bookshelf');

const navigationStore = useNavigationStore();
const { activeView } = storeToRefs(navigationStore);

const readerLauncher = useBookshelfReaderLauncher(message);
const bookshelfActions = useBookshelfActions(message);
const tocAutoUpdate = useTocAutoUpdate();

useOverlayBackstack(
  () => showDropdown.value,
  () => {
    showDropdown.value = false;
  },
);

const visibleBookCount = computed(() => books.value.filter((book) => !book.isPrivate).length);
const switchTargetChapters = computed(() =>
  bookshelfActions.currentChaptersForSwitch(switchTargetBook.value),
);

// 切换回书架视图时触发自动更新（跳过首次，首次由 onMounted/refreshAllOnAppStart 处理）
let _shelfViewWatchInitialized = false;
watch(activeView, (newView) => {
  if (!_shelfViewWatchInitialized) {
    _shelfViewWatchInitialized = true;
    return;
  }
  if (newView === 'bookshelf') {
    tocAutoUpdate.refreshAllOnShelfView();
  }
});

watch(privacyExitTick, () => {
  if (!showReader.value || !readerShelfId.value) {
    return;
  }
  if (bookshelfStore.isPrivateShelfBook(readerShelfId.value)) {
    showReader.value = false;
  }
});

onMounted(async () => {
  privacyModeStore.setupAutoExit();
  if (!(await isTransportAvailable())) {
    return;
  }
  loading.value = true;
  try {
    await Promise.all([bookshelfStore.loadBooks(), frontendPluginsStore.ensureInitialized()]);
  } catch (error: unknown) {
    message.error(`加载书架失败: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    loading.value = false;
  }
  // 启动时后台检测目录更新（不阻塞渲染）
  tocAutoUpdate.refreshAllOnAppStart();
});
</script>

<template>
  <div class="bookshelf-view app-page" :style="bookshelfDensityStyle">
    <BookshelfHeader
      :book-count="visibleBookCount"
      :privacy-mode-enabled="privacyModeEnabled"
      :card-sizes="CARD_SIZES"
      :active-size-key="activeSizeKey"
      :active-size-label="activeSize.label"
      @set-size="(key: CardSizeKey) => setSize(key)"
      @toggle-privacy="togglePrivacyMode"
    />

    <BookshelfToolbar v-model:search-kw="searchKw" :show="!!books.length" />

    <BookshelfGrid
      :loading="loading"
      :books="books"
      :filtered-books="filteredBooks"
      :privacy-mode-enabled="privacyModeEnabled"
      :opening-book-id="openingBookId"
      @select="readerLauncher.openBook"
      @contextmenu="uiStore.openContextMenu"
    />

    <BookshelfContextMenu
      v-model:show="showDropdown"
      :x="dropdownX"
      :y="dropdownY"
      :options="menuOptions"
      @select="bookshelfActions.handleMenuSelect"
    />

    <ChapterReaderModal
      v-model:show="showReader"
      v-model:current-index="readerCurrentIndex"
      :chapter-url="readerChapterUrl"
      :chapter-name="readerChapterName"
      :file-name="readerFileName"
      :chapters="readerChapters"
      :shelf-book-id="readerShelfId"
      :book-info="readerBookInfo"
      :source-type="readerSourceType"
      :refreshing-toc="refreshingToc"
      @refresh-toc="readerLauncher.refreshToc"
      @source-switched="bookshelfActions.handleReaderSourceSwitched"
    />

    <BookshelfDialogs
      v-model:show-source-switch-dialog="showSourceSwitchDialog"
      v-model:show-cover-generator-dialog="showCoverGeneratorDialog"
      v-model:show-export-dialog="showExportDialog"
      v-model:show-book-detail-dialog="showBookDetailDialog"
      :switch-target-book="switchTargetBook"
      :switch-target-chapters="switchTargetChapters"
      :cover-generator-book="coverGeneratorBook"
      :export-book="exportBook"
      :export-cached-chapters="exportCachedChapters"
      :book-detail-book="bookDetailBook"
      :book-detail-mode="bookDetailMode"
      @whole-book-switched="bookshelfActions.handleWholeBookSwitched"
      @cover-applied="readerLauncher.syncOpenReaderBookInfo"
      @book-detail-saved="readerLauncher.syncOpenReaderBookInfo"
    />
  </div>
</template>

<style scoped>
.bookshelf-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}
</style>
