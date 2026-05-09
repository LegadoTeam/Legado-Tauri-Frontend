import type { DropdownOption } from 'naive-ui';
import { defineStore } from 'pinia';
import { computed, nextTick, ref } from 'vue';
import type { CachedChapter, ChapterItem, ShelfBook } from '@/stores';
import { isTauri } from '@/composables/useEnv';
import { useBookshelfStore, useFrontendPluginsStore, usePrivacyModeStore } from '@/stores';

export const useBookshelfUiStore = defineStore('bookshelfUi', () => {
  const bookshelfStore = useBookshelfStore();
  const privacyModeStore = usePrivacyModeStore();
  const frontendPluginsStore = useFrontendPluginsStore();

  const searchKw = ref('');
  const openingBookId = ref<string | null>(null);

  const showDropdown = ref(false);
  const dropdownX = ref(0);
  const dropdownY = ref(0);
  const contextBook = ref<ShelfBook | null>(null);

  const showCoverGeneratorDialog = ref(false);
  const coverGeneratorBook = ref<ShelfBook | null>(null);
  const showSourceSwitchDialog = ref(false);
  const switchTargetBook = ref<ShelfBook | null>(null);
  const switchTargetChapters = ref<ChapterItem[]>([]);
  const showExportDialog = ref(false);
  const exportBook = ref<ShelfBook | null>(null);
  const exportCachedChapters = ref<CachedChapter[]>([]);
  const showBookDetailDialog = ref(false);
  const bookDetailBook = ref<ShelfBook | null>(null);
  const bookDetailMode = ref<'view' | 'edit'>('view');

  const filteredBooks = computed(() => {
    const kw = searchKw.value.trim().toLowerCase();
    const list = privacyModeStore.privacyModeEnabled
      ? bookshelfStore.books.filter((book) => book.isPrivate)
      : bookshelfStore.books.filter((book) => !book.isPrivate);
    if (!kw) {
      return list;
    }
    return list.filter(
      (book) => book.name.toLowerCase().includes(kw) || book.author.toLowerCase().includes(kw),
    );
  });

  const menuOptions = computed<DropdownOption[]>(() => {
    const book = contextBook.value;
    const isPrivate = book?.isPrivate ?? false;
    const pluginCoverGenerators = book ? frontendPluginsStore.getCoverGeneratorsForBook(book) : [];
    const pluginActions =
      book?.id !== undefined
        ? frontendPluginsStore.getBookshelfActionsForBook(book).map(
            (action) =>
              ({
                label: action.name,
                key: `plugin-action:${action.id}`,
              }) satisfies DropdownOption,
          )
        : [];
    const items: DropdownOption[] = [
      { label: '查看详情', key: 'open-detail' },
      { label: '编辑详情', key: 'edit-detail' },
      { type: 'divider', key: 'detail-div' },
      { label: isPrivate ? '取消隐私' : '设为隐私', key: 'toggle-private' },
      { label: '切换书源', key: 'switch-source' },
      { label: '撤销上次换源', key: 'restore-switch' },
    ];
    if (book) {
      items.push({ label: '生成封面', key: 'open-cover-generator' });
    }
    if (pluginCoverGenerators.length) {
      items.push({
        label: '插件生成封面',
        key: 'generate-plugin-cover',
        children: pluginCoverGenerators.map(
          (generator) =>
            ({
              label: generator.name,
              key: `plugin-cover:${generator.id}`,
            }) satisfies DropdownOption,
        ),
      });
    }
    if (pluginActions.length) {
      items.push(...pluginActions);
    }
    items.push({ type: 'divider', key: 'div' });
    if (isTauri) {
      items.push({ label: '打开本地目录', key: 'reveal-dir' });
    }
    if ((book?.sourceType ?? 'novel') === 'novel') {
      items.push({ label: '导出书籍', key: 'export' });
    }
    items.push({ label: '移出书架', key: 'remove' });
    return items;
  });

  async function openContextMenu(book: ShelfBook, event: MouseEvent) {
    contextBook.value = book;
    showDropdown.value = false;
    dropdownX.value = event.clientX;
    dropdownY.value = event.clientY;
    await nextTick();
    showDropdown.value = true;
  }

  function closeContextMenu() {
    showDropdown.value = false;
  }

  function resetDialogs() {
    showCoverGeneratorDialog.value = false;
    coverGeneratorBook.value = null;
    showSourceSwitchDialog.value = false;
    switchTargetBook.value = null;
    switchTargetChapters.value = [];
    showExportDialog.value = false;
    exportBook.value = null;
    exportCachedChapters.value = [];
    showBookDetailDialog.value = false;
    bookDetailBook.value = null;
    bookDetailMode.value = 'view';
  }

  return {
    searchKw,
    openingBookId,
    showDropdown,
    dropdownX,
    dropdownY,
    contextBook,
    showCoverGeneratorDialog,
    coverGeneratorBook,
    showSourceSwitchDialog,
    switchTargetBook,
    switchTargetChapters,
    showExportDialog,
    exportBook,
    exportCachedChapters,
    showBookDetailDialog,
    bookDetailBook,
    bookDetailMode,
    filteredBooks,
    menuOptions,
    openContextMenu,
    closeContextMenu,
    resetDialogs,
  };
});
