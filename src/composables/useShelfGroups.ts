/**
 * 书架分组状态管理
 *
 * 管理分组列表、当前选中的分组、分组的增删改查
 */

import { computed, ref } from 'vue';
import { useDynamicConfig } from './useDynamicConfig';
import { useBookshelfStore } from '@/stores/bookshelf';
import type { ShelfGroup } from '@/types/shelfGroup';

export interface ShelfGroupsState {
  /** 分组列表 */
  groups: ShelfGroup[];
  /** 当前选中的分组 ID */
  activeGroupId: string;
  /** 最近阅读书籍 ID */
  lastReadBookId: string | null;
  /** "全部书籍"分组是否启用（显示在标签栏） */
  allGroupEnabled: boolean;
  /** 书籍到分组的映射关系 { bookId: groupId } */
  bookGroupMap: Record<string, string>;
}

const DEFAULT_STATE: ShelfGroupsState = {
  groups: [],
  activeGroupId: 'all',
  lastReadBookId: null,
  allGroupEnabled: true,
  bookGroupMap: {},
};

function generateId(): string {
  return `group_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export function useShelfGroups() {
  const bookshelfStore = useBookshelfStore();

  const store = useDynamicConfig<ShelfGroupsState>({
    namespace: 'ui.shelfGroups',
    version: 1,
    defaults: () => ({ ...DEFAULT_STATE }),
    migrate: () => null,
  });

  /** 生成分组列表（含全部书籍） */
  const groupsWithAll = computed<ShelfGroup[]>(() => {
    const allGroupEnabled = store.state.allGroupEnabled ?? true;
    const allGroup: ShelfGroup = {
      id: 'all',
      name: '全部书籍',
      createdAt: 0,
      enabled: allGroupEnabled,
      order: -1,
    };
    return [allGroup, ...store.state.groups];
  });

  /** 用于显示的启用的分组列表（排除禁用的） */
  const visibleGroups = computed(() => {
    return groupsWithAll.value.filter(g => g.enabled);
  });

  /** 当前选中的分组 */
  const activeGroup = computed(() => {
    return groupsWithAll.value.find((g) => g.id === store.state.activeGroupId) ?? groupsWithAll.value[0];
  });

  /** 启用的分组列表（用于显示） */
  const enabledGroups = computed(() => {
    return groupsWithAll.value.filter((g) => g.enabled || g.id === 'all');
  });

  /** 根据当前分组过滤的书籍 */
  const filteredBooks = computed(() => {
    const activeId = store.state.activeGroupId;
    let books = [...bookshelfStore.books];

    // 非隐私模式过滤
    books = books.filter((b) => !b.isPrivate);

    if (activeId === 'all') {
      // 全部书籍：按 lastReadAt 降序排列，最近阅读的在前
      return sortByLastRead(books);
    }

    // 按分组过滤：分组内也按最近阅读排序
    // 使用 bookGroupMap 获取书籍的分组
    return sortByLastRead(
      books.filter((b) => store.state.bookGroupMap[b.id] === activeId),
    );
  });

  /** 最近阅读的书籍（总是置顶） */
  const lastReadBook = computed(() => {
    if (!store.state.lastReadBookId) return null;
    return bookshelfStore.books.find((b) => b.id === store.state.lastReadBookId) ?? null;
  });

  function sortByLastRead(books: typeof bookshelfStore.books.value) {
    return [...books].sort((a, b) => {
      // 有 lastReadAt 的排前面
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
  }

  /** 选择分组 */
  function selectGroup(groupId: string) {
    store.state.activeGroupId = groupId;
    void store.replace(store.state);
  }

  /** 添加分组 */
  async function addGroup(name: string): Promise<ShelfGroup> {
    const newGroup: ShelfGroup = {
      id: generateId(),
      name: name.trim(),
      createdAt: Date.now(),
      enabled: true,
      order: store.state.groups.length,
    };
    store.state.groups = [...store.state.groups, newGroup];
    await store.replace(store.state);
    return newGroup;
  }

  /** 删除分组 */
  async function removeGroup(groupId: string) {
    if (groupId === 'all') return;
    store.state.groups = store.state.groups.filter((g) => g.id !== groupId);
    if (store.state.activeGroupId === groupId) {
      store.state.activeGroupId = 'all';
    }
    await store.replace(store.state);
  }

  /** 更新分组名称 */
  async function renameGroup(groupId: string, name: string) {
    const group = store.state.groups.find((g) => g.id === groupId);
    if (group) {
      group.name = name.trim();
      await store.replace(store.state);
    }
  }

  /** 切换分组启用状态 */
  async function toggleGroupEnabled(groupId: string) {
    const group = store.state.groups.find((g) => g.id === groupId);
    if (group) {
      group.enabled = !group.enabled;
      await store.replace(store.state);
    }
  }

  /** 设置分组启用状态 */
  async function setGroupEnabled(groupId: string, enabled: boolean) {
    const group = store.state.groups.find((g) => g.id === groupId);
    if (group) {
      group.enabled = enabled;
      await store.replace(store.state);
    }
  }

  /** 设置全部书籍分组启用状态 */
  async function setAllGroupEnabled(enabled: boolean) {
    store.state.allGroupEnabled = enabled;

    // 如果禁用了"全部书籍"，且当前选中的是"全部"，自动切换到第一个可见分组
    if (!enabled && store.state.activeGroupId === 'all') {
      const firstVisible = visibleGroups.value[0];
      if (firstVisible && firstVisible.id !== 'all') {
        store.state.activeGroupId = firstVisible.id;
      }
    }

    await store.replace(store.state);
  }

  /** 切换全部书籍分组启用状态 */
  async function toggleAllGroupEnabled() {
    await setAllGroupEnabled(!store.state.allGroupEnabled);
  }

  /** 将书籍添加到分组 */
  async function addBookToGroup(bookId: string, groupId: string) {
    store.state.bookGroupMap = {
      ...store.state.bookGroupMap,
      [bookId]: groupId,
    };
    await store.replace(store.state);
  }

  /** 将书籍从分组移除（移动到全部书籍） */
  async function removeBookFromGroup(bookId: string) {
    const newMap = { ...store.state.bookGroupMap };
    delete newMap[bookId];
    store.state.bookGroupMap = newMap;
    await store.replace(store.state);
  }

  /** 更新最近阅读书籍 */
  function updateLastReadBook(bookId: string) {
    store.state.lastReadBookId = bookId;
    void store.replace(store.state);
  }

  /** 获取书籍所属分组 ID */
  function getBookGroupId(bookId: string): string | null {
    const book = bookshelfStore.books.find((b) => b.id === bookId);
    return book?.groupId ?? null;
  }

  return {
    state: store.state,
    groups: computed(() => store.state.groups),
    groupsWithAll,
    visibleGroups,
    activeGroup,
    enabledGroups,
    filteredBooks,
    lastReadBook,
    selectGroup,
    addGroup,
    removeGroup,
    renameGroup,
    toggleGroupEnabled,
    setGroupEnabled,
    setAllGroupEnabled,
    toggleAllGroupEnabled,
    addBookToGroup,
    removeBookFromGroup,
    updateLastReadBook,
    getBookGroupId,
  };
}
