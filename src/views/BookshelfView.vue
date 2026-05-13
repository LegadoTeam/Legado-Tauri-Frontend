<script setup lang="ts">
import { useMessage } from "naive-ui";
import { storeToRefs } from "pinia";
import { computed, onMounted, ref, watch } from "vue";
import ChapterReaderModal from "@/components/explore/ChapterReaderModal.vue";
import ShelfGroupMenu from "@/components/shelf/ShelfGroupMenu.vue";
import { useOverlayBackstack } from "@/composables/useOverlayBackstack";
import { isTransportAvailable } from "@/composables/useTransport";
import {
  useViewCardDensity,
  type CardSizeKey,
} from "@/composables/useViewCardDensity";
import BookshelfContextMenu from "@/features/bookshelf/components/BookshelfContextMenu.vue";
import BookshelfDialogs from "@/features/bookshelf/components/BookshelfDialogs.vue";
import BookshelfGrid from "@/features/bookshelf/components/BookshelfGrid.vue";
import BookshelfHeader from "@/features/bookshelf/components/BookshelfHeader.vue";
import { useTocAutoUpdate } from "@/composables/useTocAutoUpdate";
import { useShelfGroups } from "@/composables/useShelfGroups";
import { useBookshelfActions } from "@/features/bookshelf/services/bookshelfActions";
import { useBookshelfReaderLauncher } from "@/features/bookshelf/services/bookshelfReaderLauncher";
import {
  useBookshelfReaderStore,
  useBookshelfStore,
  useBookshelfUiStore,
  useFrontendPluginsStore,
  useNavigationStore,
  usePrivacyModeStore,
} from "@/stores";

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
  showTxtImportDialog,
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
  readerChapterGroups,
  episodeProgressMap,
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
  set: (v: boolean) => {
    uiStore.showGroupMenu = v;
  },
});

// 搜索弹出层
const showSearch = ref(false);
const searchPopupKw = ref("");

// 书架编辑模式
const editMode = ref(false);
const selectedBookIds = ref<Set<string>>(new Set());

function toggleEditMode() {
  editMode.value = !editMode.value;
  if (!editMode.value) {
    selectedBookIds.value = new Set();
  }
}

function toggleBookSelect(bookId: string) {
  const next = new Set(selectedBookIds.value);
  if (next.has(bookId)) {
    next.delete(bookId);
  } else {
    next.add(bookId);
  }
  selectedBookIds.value = next;
}

const allSelected = computed(
  () =>
    searchedBooks.value.length > 0 &&
    searchedBooks.value.every((b) => selectedBookIds.value.has(b.id)),
);

function toggleSelectAll() {
  if (allSelected.value) {
    selectedBookIds.value = new Set();
  } else {
    selectedBookIds.value = new Set(searchedBooks.value.map((b) => b.id));
  }
}

async function deleteSelectedBooks() {
  const ids = [...selectedBookIds.value];
  if (!ids.length) return;
  for (const id of ids) {
    await bookshelfStore.removeFromShelf(id);
  }
  selectedBookIds.value = new Set();
  editMode.value = false;
  message.success(`已移出 ${ids.length} 本书`);
}

// 获取右键点击的书籍所在的分组 ID
const contextBookGroupId = computed(() => {
  const bookId = uiStore.contextBook?.id;
  if (!bookId) return undefined;
  return shelfGroupsState.bookGroupMap[bookId] ?? "all";
});

const {
  cardSizes: CARD_SIZES,
  activeSize,
  activeSizeKey,
  style: bookshelfDensityStyle,
  setSize,
} = useViewCardDensity("bookshelf");

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

// 书籍排序：最近阅读的置顶（隐私模式在此过滤）
const sortedBooks = computed(() => {
  // 按隐私模式过滤
  const privacyFiltered = privacyModeEnabled.value
    ? filteredBooks.value.filter((b) => b.isPrivate)
    : filteredBooks.value.filter((b) => !b.isPrivate);
  const booksToSort = [...privacyFiltered];
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
    (book) =>
      book.name.toLowerCase().includes(kw) ||
      book.author.toLowerCase().includes(kw),
  );
});

// 切换回书架视图时触发自动更新（跳过首次，首次由 onMounted/refreshAllOnAppStart 处理）
let _shelfViewWatchInitialized = false;
watch(activeView, (newView) => {
  if (!_shelfViewWatchInitialized) {
    _shelfViewWatchInitialized = true;
    return;
  }
  if (newView === "bookshelf") {
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
  message.success("分组已创建");
}

function handleRemoveGroup(groupId: string) {
  removeGroup(groupId);
  message.success("分组已删除");
}

async function handleRenameGroup(groupId: string, name: string) {
  await renameGroup(groupId, name);
  message.success("分组已重命名");
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
    message.info("已是最新，没有新章节");
  } else if (result.failed > 0) {
    message.warning(`刷新完成，${result.failed} 本书刷新失败`);
  } else {
    message.info("没有需要刷新的书籍");
  }
}

onMounted(async () => {
  privacyModeStore.setupAutoExit();
  if (!(await isTransportAvailable())) {
    return;
  }
  loading.value = true;
  try {
    await Promise.all([
      bookshelfStore.loadBooks(),
      frontendPluginsStore.ensureInitialized(),
    ]);
  } catch (error: unknown) {
    message.error(
      `加载书架失败: ${error instanceof Error ? error.message : String(error)}`,
    );
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
      :loading="loading"
      @set-size="(key: CardSizeKey) => setSize(key)"
      @toggle-privacy="togglePrivacyMode"
      @toggle-group-menu="showGroupMenu = !showGroupMenu"
      @select-group="(id: string) => selectGroup(id)"
      @import-txt="uiStore.showTxtImportDialog = true"
      @refresh="handleRefresh"
      @toggle-search="showSearch = !showSearch"
      @toggle-edit="toggleEditMode"
    />

    <BookshelfGrid
      :loading="loading"
      :books="books"
      :filtered-books="searchedBooks"
      :privacy-mode-enabled="privacyModeEnabled"
      :opening-book-id="editMode ? null : openingBookId"
      :edit-mode="editMode"
      :selected-book-ids="selectedBookIds"
      @select="
        editMode ? toggleBookSelect($event.id) : readerLauncher.openBook($event)
      "
      @contextmenu="(book, e) => !editMode && uiStore.openContextMenu(book, e)"
      @refresh="handleRefresh"
    />

    <!-- 编辑模式底部操作栏 -->
    <Transition name="bs-edit-bar">
      <div v-if="editMode" class="bs-edit-bar">
        <span class="bs-edit-bar__count"
          >已选 {{ selectedBookIds.size }} 本</span
        >
        <div class="bs-edit-bar__actions">
          <button class="bs-edit-bar__btn" @click="toggleSelectAll">
            {{ allSelected ? "取消全选" : "全选" }}
          </button>
          <button class="bs-edit-bar__btn" @click="toggleEditMode">取消</button>
          <button
            class="bs-edit-bar__btn bs-edit-bar__btn--danger"
            :disabled="!selectedBookIds.size"
            @click="deleteSelectedBooks"
          >
            移出书架
          </button>
        </div>
      </div>
    </Transition>

    <!-- 搜索弹出层 -->
    <n-modal
      v-model:show="showSearch"
      preset="card"
      title="搜索书架"
      :style="{ width: '380px', maxWidth: '92vw' }"
      :segmented="{ content: true }"
      @after-leave="searchPopupKw = ''"
    >
      <n-input
        v-model:value="searchPopupKw"
        placeholder="搜索书名或作者..."
        clearable
        autofocus
      />
      <div class="bs-search-results">
        <template v-if="searchPopupKw.trim()">
          <div
            v-for="book in sortedBooks
              .filter(
                (b) =>
                  b.name
                    .toLowerCase()
                    .includes(searchPopupKw.trim().toLowerCase()) ||
                  b.author
                    .toLowerCase()
                    .includes(searchPopupKw.trim().toLowerCase()),
              )
              .slice(0, 30)"
            :key="book.id"
            class="bs-search-item"
            role="button"
            tabindex="0"
            @click="
              readerLauncher.openBook(book);
              showSearch = false;
            "
            @keydown.enter.prevent="
              readerLauncher.openBook(book);
              showSearch = false;
            "
          >
            <span class="bs-search-item__name">{{
              book.name || "未知书名"
            }}</span>
            <span class="bs-search-item__author">{{
              book.author || "佚名"
            }}</span>
          </div>
          <div
            v-if="
              !sortedBooks.filter(
                (b) =>
                  b.name
                    .toLowerCase()
                    .includes(searchPopupKw.trim().toLowerCase()) ||
                  b.author
                    .toLowerCase()
                    .includes(searchPopupKw.trim().toLowerCase()),
              ).length
            "
            class="bs-search-empty"
          >
            没有找到匹配的书籍
          </div>
        </template>
        <div v-else class="bs-search-empty">输入关键词以搜索</div>
      </div>
    </n-modal>

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
      :chapter-groups="readerChapterGroups"
      :inline-group-tabs="true"
      :episode-progress="episodeProgressMap"
      :save-episode-progress="
        (sid, url, t, d) => readerStore.setEpisodeProgress(url, t, d)
      "
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
      v-model:show-txt-import-dialog="showTxtImportDialog"
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
      @txt-imported="bookshelfActions.handleTxtImported"
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

/* 编辑模式底部操作栏 */
.bs-edit-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
  gap: 8px;
}

.bs-edit-bar__count {
  font-size: var(--fs-14);
  color: var(--color-text-muted);
}

.bs-edit-bar__actions {
  display: flex;
  gap: 8px;
}

.bs-edit-bar__btn {
  padding: 6px 16px;
  border-radius: var(--radius-1);
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text);
  font-size: var(--fs-14);
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease-standard);
}

.bs-edit-bar__btn--danger {
  color: var(--color-error, #e53935);
  border-color: var(--color-error, #e53935);
}

.bs-edit-bar__btn--danger:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.bs-edit-bar-enter-active,
.bs-edit-bar-leave-active {
  transition:
    transform 0.22s var(--ease-standard),
    opacity 0.22s;
}

.bs-edit-bar-enter-from,
.bs-edit-bar-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

/* 搜索弹出层内容 */
.bs-search-results {
  margin-top: 12px;
  max-height: 55vh;
  overflow-y: auto;
}

.bs-search-item {
  display: flex;
  flex-direction: column;
  padding: 10px 4px;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  border-radius: var(--radius-1);
  transition: background var(--dur-fast) var(--ease-standard);
}

@media (hover: hover) and (pointer: fine) {
  .bs-search-item:hover {
    background: var(--color-fill-secondary);
  }
}

.bs-search-item__name {
  font-size: var(--fs-14);
  font-weight: var(--fw-medium);
  color: var(--color-text);
}

.bs-search-item__author {
  font-size: var(--fs-12);
  color: var(--color-text-muted);
  margin-top: 2px;
}

.bs-search-empty {
  text-align: center;
  padding: 24px 0;
  font-size: var(--fs-14);
  color: var(--color-text-muted);
}
</style>
