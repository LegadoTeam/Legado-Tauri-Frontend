<script setup lang="ts">
import { useMessage } from 'naive-ui';
import { storeToRefs } from 'pinia';
import { computed, onMounted, watch } from 'vue';
import ChapterReaderModal from '@/components/explore/ChapterReaderModal.vue';
import ShelfGroupMenu from '@/components/shelf/ShelfGroupMenu.vue';
import { useOverlayBackstack } from '@/composables/useOverlayBackstack';
import { isTransportAvailable } from '@/composables/useTransport';
import { useViewCardDensity, type CardSizeKey } from '@/composables/useViewCardDensity';
import BookshelfContextMenu from '@/features/bookshelf/components/BookshelfContextMenu.vue';
import BookshelfDialogs from '@/features/bookshelf/components/BookshelfDialogs.vue';
import BookshelfGrid from '@/features/bookshelf/components/BookshelfGrid.vue';
import BookshelfHeader from '@/features/bookshelf/components/BookshelfHeader.vue';
import BookshelfToolbar from '@/features/bookshelf/components/BookshelfToolbar.vue';
import { useTocAutoUpdate } from '@/composables/useTocAutoUpdate';
import { useShelfGroups } from '@/composables/useShelfGroups';
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
const { filteredBooks: uiFilteredBooks, menuOptions } = storeToRefs(uiStore);
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

// 分组功能
const shelfGroups = useShelfGroups();
const {
  state: shelfGroupsState,
  groupsWithAll,
  visibleGroups,
  activeGroupId,
  filteredBooks,
  lastReadBook,
  selectGroup,
  addGroup,
  removeGroup,
  renameGroup,
  setGroupEnabled,
  toggleAllGroupEnabled,
  updateLastReadBook,
} = shelfGroups;

const showGroupMenu = computed({
  get: () => uiStore.showGroupMenu ?? false,
  set: (v: boolean) => { uiStore.showGroupMenu = v; },
});

// 获取右键点击的书籍所在的分组 ID
const contextBookGroupId = computed(() => {
  const bookId = uiStore.contextBook?.id;
  if (!bookId) return undefined;
  return shelfGroupsState.bookGroupMap[bookId] ?? 'all';
});

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

// 计算可见书籍数量
const visibleBookCount = computed(() => {
  if (privacyModeStore.privacyModeEnabled) {
    return filteredBooks.value.filter((book) => book.isPrivate).length;
  }
  return filteredBooks.value.filter((book) => !book.isPrivate).length;
});

const switchTargetChapters = computed(() =>
  bookshelfActions.currentChaptersForSwitch(switchTargetBook.value),
);

// 书籍排序：最近阅读的置顶
const sortedBooks = computed(() => {
  const booksToSort = [...filteredBooks.value];
  const lastRead = lastReadBook.value;

  return booksToSort.sort((a, b) => {
    // 最近阅读的书籍置顶
    if (lastRead) {
      if (a.id === lastRead.id) return -1;
      if (b.id === lastRead.id) return 1;
    }

    // 按 lastReadAt 降序排列
    const aHasRead = a.lastReadAt > 0;
    const bHasRead = b.lastReadAt > 0;
    if (aHasRead && !bHasRead) return -1;
    if (!aHasRead && bHasRead) return 1;
    if (aHasRead && bHasRead) {
      return b.lastReadAt - a.lastReadAt;
    }

    // 都没有阅读记录，按加入时间排序
    return b.addedAt - a.addedAt;
  });
});

// 搜索过滤（基于分组过滤后的结果）
const searchedBooks = computed(() => {
  const kw = searchKw.value.trim().toLowerCase();
  if (!kw) return sortedBooks.value;
  return sortedBooks.value.filter(
    (book) => book.name.toLowerCase().includes(kw) || book.author.toLowerCase().includes(kw),
  );
});

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

// 分组菜单操作
async function handleAddGroup(name: string) {
  await addGroup(name);
  message.success('分组已创建');
}

function handleRemoveGroup(groupId: string) {
  removeGroup(groupId);
  message.success('分组已删除');
}

async function handleRenameGroup(groupId: string, name: string) {
  await renameGroup(groupId, name);
  message.success('分组已重命名');
}

function handleToggleGroup(groupId: string, enabled: boolean) {
  setGroupEnabled(groupId, enabled);
}

function handleToggleAllGroup() {
  toggleAllGroupEnabled();
}

// 下拉刷新处理
async function handleRefresh() {
  const result = await tocAutoUpdate.refreshAllOnShelfView();

  if (result.updated > 0) {
    message.success(`发现 ${result.updated} 个新章节`);
  } else if (result.success > 0) {
    message.info('已是最新，没有新章节');
  } else if (result.failed > 0) {
    message.warning(`刷新完成，${result.failed} 本书刷新失败`);
  } else {
    message.info('没有需要刷新的书籍');
  }
}

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
      :groups="groupsWithAll"
      :active-group-id="activeGroupId"
      :show-group-menu="showGroupMenu"
      @set-size="(key: CardSizeKey) => setSize(key)"
      @toggle-privacy="togglePrivacyMode"
      @toggle-group-menu="showGroupMenu = !showGroupMenu"
      @select-group="(id: string) => selectGroup(id)"
    />

    <BookshelfToolbar v-model:search-kw="searchKw" :show="!!books.length" />

    <BookshelfGrid
      :loading="loading"
      :books="books"
      :filtered-books="searchedBooks"
      :privacy-mode-enabled="privacyModeEnabled"
      :opening-book-id="openingBookId"
      @select="readerLauncher.openBook"
      @contextmenu="uiStore.openContextMenu"
      @refresh="handleRefresh"
    />

    <ShelfGroupMenu
      v-model:show="showGroupMenu"
      :groups="groupsWithAll"
      :active-group-id="activeGroupId"
      :all-group-enabled="shelfGroups.state.allGroupEnabled"
      @select="(id: string) => selectGroup(id)"
      @add="handleAddGroup"
      @remove="handleRemoveGroup"
      @rename="handleRenameGroup"
      @toggle="handleToggleGroup"
      @toggle-all="handleToggleAllGroup"
    />

    <BookshelfContextMenu
      v-model:show="showDropdown"
      :x="dropdownX"
      :y="dropdownY"
      :options="menuOptions"
      :groups="groupsWithAll"
      :context-book-id="uiStore.contextBook?.id"
      :context-book-group-id="contextBookGroupId"
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
