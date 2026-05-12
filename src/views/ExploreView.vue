<script setup lang="ts">
import {
  Search,
  RefreshCw,
  AlignJustify,
  Eye,
  EyeOff,
  LayoutGrid,
  Image,
  List,
} from 'lucide-vue-next';
import { useDialog, useMessage } from 'naive-ui';
import { storeToRefs } from 'pinia';
import { ref, reactive, computed, nextTick, onMounted, onUnmounted, watch } from 'vue';
import type { BookSourceMeta, BookItem } from '@/types';
import { useBookDetailDrawerState } from '@/composables/useBookDetailDrawerState';
import { useDynamicConfig } from '@/composables/useDynamicConfig';
import { eventListen, eventEmit } from '@/composables/useEventBus';
import { dbgLog } from '@/composables/useFrontendStorage';
import { deleteBookSource } from '@/composables/useBookSource';
import { useInlineBookReader } from '@/composables/useInlineBookReader';
import { useMobileHorizontalSwipe } from '@/composables/useMobileHorizontalSwipe';
import { useOverlayBackstack } from '@/composables/useOverlayBackstack';
import { useViewCardDensity, normalizeCardSizeKey } from '@/composables/useViewCardDensity';
import { getSourceTypeLabel } from '@/utils/bookMeta';
import SourceTypeBadge from '@/components/base/SourceTypeBadge.vue';
import {
  useBookSourceStore,
  useNavigationStore,
  useBookshelfStore,
  usePrivacyModeStore,
  useScriptBridgeStore,
} from '@/stores';
import AppEmpty from '../components/base/AppEmpty.vue';
import BookDetailDrawer from '../components/explore/BookDetailDrawer.vue';
import ExploreViewSortModal from '../components/explore/ExploreViewSortModal.vue';
import ChapterReaderModal from '../components/explore/ChapterReaderModal.vue';
import SourceExploreSection from '../components/explore/SourceExploreSection.vue';
import AppPageHeader from '../components/layout/AppPageHeader.vue';
import MobileToolbarMenu from '../components/layout/MobileToolbarMenu.vue';
import {
  preloadExploreCategoryCache,
  preloadExploreBooksCache,
} from '../composables/useExploreCategoryCache';

const bookSourceStore = useBookSourceStore();
const navigationStore = useNavigationStore();
const bookshelfStore = useBookshelfStore();
const privacyModeStore = usePrivacyModeStore();
const scriptBridgeStore = useScriptBridgeStore();
const message = useMessage();
const dialog = useDialog();
const { sources: sourcesRef } = storeToRefs(bookSourceStore);
const { runChapterList, cancelTask, clearExploreCache } = scriptBridgeStore;
const {
  cardSizes: CARD_SIZES,
  activeSizeKey,
  activeSize,
  style: explorerStyle,
  setSize,
} = useViewCardDensity('explore');

// ── 书源列表 & 能力检测 ──────────────────────────────────────────────────
const explorableSources = computed(() => bookSourceStore.explorableSources);
const initializingSources = ref(true);
const sourceSystemStarting = computed(
  () =>
    initializingSources.value || bookSourceStore.loading || bookSourceStore.capabilityDetecting,
);

// ── 上次选中的书源 tab 持久化 ────────────────────────────────────────────
const activeTabStore = useDynamicConfig<{ tab: string }>({
  namespace: 'explore.activeTab',
  version: 1,
  defaults: () => ({ tab: '' }),
  migrate: () => null,
  legacyKeys: [],
});

/** 当前选中的书源 tab（fileName），持久化到本地存储 */
const activeSourceTab = computed<string>({
  get: () => activeTabStore.state.tab,
  set: (v) => activeTabStore.replace({ tab: v }),
});
// ── 免责声明弹窗 ─────────────────────────────────────────────────────────
const disclaimerStore = useDynamicConfig<{ hidden: boolean }>({
  namespace: 'explore.disclaimer',
  version: 1,
  defaults: () => ({ hidden: false }),
  migrate: () => null,
  legacyKeys: [],
});

const showDisclaimer = ref(false);
const disclaimerDontShow = ref(false);

async function confirmDisclaimer() {
  if (disclaimerDontShow.value) {
    await disclaimerStore.replace({ hidden: true });
    dbgLog('[Disclaimer] hidden=true 写入后端完成');
  }
  showDisclaimer.value = false;
}

const exploreTabOrderStore = useDynamicConfig<{ order: string[] }>({
  namespace: 'explore.tabOrder',
  version: 1,
  defaults: () => ({ order: [] }),
  migrate: ({ readLegacy }) => {
    const raw = readLegacy('explore-tab-order');
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw);
      return {
        order: Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [],
      };
    } catch {
      return null;
    }
  },
  legacyKeys: ['explore-tab-order'],
});

const tabOrder = computed(() => exploreTabOrderStore.state.order);

/** 按 tabOrder 对书源排序，同时过滤用户禁用的发现源 */
const sortedSources = computed<BookSourceMeta[]>(() => {
  const order = tabOrder.value;
  const all = explorableSources.value.filter((s) =>
    bookSourceStore.isExploreUserEnabled(s.fileName),
  );
  if (!order.length) {
    return all;
  }
  const inOrder = order
    .map((fn) => all.find((s) => s.fileName === fn))
    .filter((s): s is BookSourceMeta => !!s);
  const rest = all.filter((s) => !order.includes(s.fileName));
  return [...inOrder, ...rest];
});

// 所有书源都预加载分类列表（GETALL 轻量），切换时再按需加载具体书籍内容
const prefetchedSourceTabs = computed(() => new Set(sortedSources.value.map((s) => s.fileName)));

function saveTabOrder(order: string[]) {
  exploreTabOrderStore.replace({ order: [...order] });
}

// ── 排序弹窗 ────────────────────────────────────────────────────────────
const showSortModal = ref(false);

useOverlayBackstack(
  () => showDisclaimer.value,
  () => {
    showDisclaimer.value = false;
  },
);

function openSortModal() {
  showSortModal.value = true;
}

// ── 当前书源元信息 ───────────────────────────────────────────────────────
const currentSource = computed<BookSourceMeta | undefined>(() =>
  explorableSources.value.find((s) => s.fileName === activeSourceTab.value),
);

const activeSourceCanSearch = computed(() => {
  const fileName = activeSourceTab.value;
  if (!fileName) return false;
  const caps = bookSourceStore.getCachedCapabilities(fileName);
  return !!(caps?.has('search') && bookSourceStore.isSearchUserEnabled(fileName));
});
// ── 刷新（触发当前书源 Section 刷新） ───────────────────────────────────
const refreshing = ref(false);
const reloadingAll = ref(false);
const sourceRefreshVersion = reactive<Record<string, number>>({});

function bumpSourceRefreshVersion(fileName: string) {
  sourceRefreshVersion[fileName] = (sourceRefreshVersion[fileName] ?? 0) + 1;
}

function bumpAllSourceRefreshVersions() {
  for (const src of bookSourceStore.sources) {
    bumpSourceRefreshVersion(src.fileName);
  }
}

async function handleRefresh() {
  refreshing.value = true;
  try {
    if (activeSourceTab.value) {
      bumpSourceRefreshVersion(activeSourceTab.value);
    }
  } finally {
    // refreshing 由 SourceExploreSection 回调重置
    setTimeout(() => {
      refreshing.value = false;
    }, 600);
  }
}

function onSectionRefreshing(val: boolean) {
  refreshing.value = val;
}

async function handleForceReload() {
  if (reloadingAll.value) {
    return;
  }
  reloadingAll.value = true;
  try {
    await refreshAllSources();
  } finally {
    reloadingAll.value = false;
  }
}

// 封面显示开关
const showCovers = ref(true);

// 显示模式：card=卡片网格，cover=封面书架，list=列表单列
type ExploreDisplayMode = 'card' | 'cover' | 'list';
const displayModeStore = useDynamicConfig<{ mode: ExploreDisplayMode }>({
  namespace: 'explore.displayMode',
  version: 1,
  defaults: () => ({ mode: 'card' }),
  migrate: () => null,
  legacyKeys: [],
});
const displayMode = computed<ExploreDisplayMode>({
  get: () => displayModeStore.state.mode,
  set: (v) => displayModeStore.replace({ mode: v }),
});

// ── 移动端三点菜单 ──────────────────────────────────────────────────────
const exploreMobileMenuOptions = computed(() => [
  {
    label: '卡片模式',
    key: 'mode-card',
    disabled: displayMode.value === 'card',
  },
  {
    label: '封面模式',
    key: 'mode-cover',
    disabled: displayMode.value === 'cover',
  },
  {
    label: '列表模式',
    key: 'mode-list',
    disabled: displayMode.value === 'list',
  },
  ...(displayMode.value !== 'cover'
    ? [{ label: showCovers.value ? '隐藏封面' : '显示封面', key: 'toggle-covers' }]
    : []),
  ...CARD_SIZES.map((s) => ({
    label: `卡片大小：${s.label}`,
    key: `size-${s.key}`,
    disabled: activeSizeKey.value === s.key,
  })),
  {
    label: '书源排序',
    key: 'sort',
  },
  {
    label: '刷新当前书源',
    key: 'refresh',
  },
  {
    label: '全部重载',
    key: 'reload-all',
  },
]);

function handleExploreMobileMenuSelect(key: string) {
  if (key === 'mode-card') {
    displayMode.value = 'card';
  } else if (key === 'mode-cover') {
    displayMode.value = 'cover';
  } else if (key === 'mode-list') {
    displayMode.value = 'list';
  } else if (key === 'toggle-covers') {
    showCovers.value = !showCovers.value;
  } else if (key.startsWith('size-')) {
    setSize(normalizeCardSizeKey(key.slice(5), activeSizeKey.value));
  } else if (key === 'sort') {
    openSortModal();
  } else if (key === 'refresh') {
    handleRefresh();
  } else if (key === 'reload-all') {
    handleForceReload();
  }
}

// ── 书籍详情 ─────────────────────────────────────────────────────────────
const {
  showDrawer,
  drawerBookUrl,
  drawerFileName,
  drawerSourceName,
  drawerSourceType,
  openDetail,
  openDetailByUrl,
} = useBookDetailDrawerState({
  sources: sourcesRef,
  onOpenDetail: ({ bookUrl, fileName, book }) => {
    if (book) {
      return;
    }
  },
});

function navigateToActiveSourceSearch() {
  if (!activeSourceTab.value) {
    return;
  }
  navigationStore.navigateToSearch(activeSourceTab.value);
}

function handleOpenBookByUrl(bookUrl: string, fileName: string) {
  openDetailByUrl(bookUrl, fileName);
}

// ── Tab 右键 / 长按菜单 ──────────────────────────────────────────────────
const tabMenu = reactive({
  visible: false,
  x: 0,
  y: 0,
  source: null as BookSourceMeta | null,
});

const tabMenuOptions = computed(() => {
  const src = tabMenu.source;
  if (!src) return [];
  const caps = bookSourceStore.getCachedCapabilities(src.fileName);
  const hasSearch = caps?.has('search') && bookSourceStore.isSearchUserEnabled(src.fileName);
  const opts: { label: string; key: string; type?: string }[] = [];
  if (hasSearch) {
    opts.push({ label: '使用此书源搜索', key: 'search' });
  }
  opts.push(
    { label: '禁用书源', key: 'disable' },
    { type: 'divider', key: 'd1', label: '' },
    { label: '删除书源', key: 'delete' },
  );
  return opts;
});

function openTabMenu(e: MouseEvent, src: BookSourceMeta) {
  e.preventDefault();
  tabMenu.source = src;
  tabMenu.x = e.clientX;
  tabMenu.y = e.clientY;
  tabMenu.visible = true;
}

// 长按检测（移动端）
let longPressTimer: ReturnType<typeof setTimeout> | null = null;
let longPressOriginX = 0;
let longPressOriginY = 0;
let longPressSrc: BookSourceMeta | null = null;

function onTabPointerDown(e: PointerEvent, src: BookSourceMeta) {
  longPressSrc = src;
  longPressOriginX = e.clientX;
  longPressOriginY = e.clientY;
  longPressTimer = setTimeout(() => {
    longPressTimer = null;
    tabMenu.source = longPressSrc;
    // 在 touch 设备上用触点位置
    tabMenu.x = longPressOriginX;
    tabMenu.y = longPressOriginY;
    tabMenu.visible = true;
  }, 600);
}

function onTabPointerMoveCheck(e: PointerEvent) {
  if (longPressTimer === null) return;
  const dx = e.clientX - longPressOriginX;
  const dy = e.clientY - longPressOriginY;
  if (Math.sqrt(dx * dx + dy * dy) > 8) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}

function cancelLongPress() {
  if (longPressTimer !== null) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}

async function handleTabMenuSelect(key: string) {
  tabMenu.visible = false;
  const src = tabMenu.source;
  if (!src) return;

  if (key === 'search') {
    navigationStore.navigateToSearch(src.fileName);
  } else if (key === 'disable') {
    try {
      await bookSourceStore.toggleSource(src.fileName, false, src.sourceDir);
      message.success(`已禁用「${src.name}」`);
    } catch (e: unknown) {
      message.error(`禁用失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else if (key === 'delete') {
    dialog.warning({
      title: '删除书源',
      content: `确认删除「${src.name}」？此操作将删除磁盘文件，不可恢复。`,
      positiveText: '删除',
      negativeText: '取消',
      onPositiveClick: async () => {
        try {
          await deleteBookSource(src.fileName, src.sourceDir);
          await eventEmit('app:booksource-reload', { scope: 'single', fileName: src.fileName });
          message.success('已删除');
        } catch (e: unknown) {
          message.error(`删除失败: ${e instanceof Error ? e.message : String(e)}`);
        }
      },
    });
  }
}


// ── 章节阅读 ─────────────────────────────────────────────────────────────
const { getShelfId, ensureLoaded: ensureShelfLoaded, isPrivateShelfBook } = bookshelfStore;
const { privacyExitTick } = storeToRefs(privacyModeStore);
const {
  showReader,
  readerChapterUrl,
  readerChapterName,
  readerFileName,
  readerChapters,
  readerCurrentIndex,
  readerBookInfo,
  readerSourceType,
  readerShelfId,
  readerChapterGroups,
  readerActiveGroupIndex,
  applySourceSwitchToReader,
  onReadChapter,
} = useInlineBookReader({
  showDrawer,
  drawerBookUrl,
  drawerFileName,
  privacyExitTick,
  runChapterList,
  cancelTask,
  ensureShelfLoaded,
  getShelfId,
  isPrivateShelfBook,
  onTrackReaderOpen: (payload) => {
  },
});

watch(activeSourceTab, (next, prev) => {
  if (!next || !prev || next === prev) {
    return;
  }
});

// ── 生命周期 ─────────────────────────────────────────────────────────────
const unlisteners: (() => void)[] = [];

/**
 * 针对单个书源的精准刷新：
 * - 删除该书源的函数缓存，清理发现缓存
 * - 重载书源列表
 * - 仅当该书源在刷新前后都可供发现时才 bump 版本（内容变化场景）；
 *   enable/disable 切换时 SourceExploreSection 会由 v-for 重新挂载/卸载，无需手动 bump。
 */
async function refreshSingleSource(fileName: string) {
  const wasExplorable = bookSourceStore.explorableSources.some((s) => s.fileName === fileName);
  bookSourceStore.invalidateCapability(fileName);
  await clearExploreCache(fileName);
  await bookSourceStore.loadSources();
  // 只有"内容变更但仍可发现"时才 bump（新挂载的 Section 会在 onMounted 中自动加载）
  const isStillExplorable = bookSourceStore.explorableSources.some((s) => s.fileName === fileName);
  if (wasExplorable && isStillExplorable) {
    bumpSourceRefreshVersion(fileName);
  }
}

/** 全量重置（用于"重载全部"或无法确定具体文件的场景） */
async function refreshAllSources() {
  bookSourceStore.invalidateAllCapabilities();
  bumpAllSourceRefreshVersions();
  await clearExploreCache();
  await bookSourceStore.loadSources();
}

onMounted(async () => {
  try {
    // 必须先等后端存储加载完毕，再读 hidden 状态；
    // 否则 hydrateState 同步读到空缓存会回落到 defaults({ hidden: false })，导致每次都弹窗
    // 同时预热能力缓存和分类缓存命名空间，避免首次打开重复扫描
    await Promise.all([
      disclaimerStore.ready,
      activeTabStore.ready,
      bookSourceStore.ensureCapsLoaded(),
      preloadExploreCategoryCache(),
      preloadExploreBooksCache(),
    ]);
    if (!disclaimerStore.state.hidden) {
      showDisclaimer.value = true;
    }
    await bookSourceStore.loadSources();
    // 等待能力检测完成后 explorableSources 才有数据，再恢复上次选中的书源
    await bookSourceStore.detectAllCapabilities();
    if (!bookSourceStore.explorableSources.some((s) => s.fileName === activeSourceTab.value)) {
      await activeTabStore.replace({ tab: bookSourceStore.explorableSources[0]?.fileName ?? '' });
    }
    if (evTabsRef.value) {
      cleanupWheelScroll = setupTabsWheelScroll(evTabsRef.value);
    }
    await nextTick();
    requestAnimationFrame(() => {
      scrollActiveSourceTabIntoView();
    });
    unlisteners.push(
      await eventListen<{ fileName?: string; reason?: string }>('booksource:changed', async (event) => {
        const { fileName: changedFileName, reason } = event.payload ?? {};
        if (changedFileName) {
          // toggle 操作只切换 enabled，不影响发现内容，跳过重载
          if (reason === 'toggle') return;
          await refreshSingleSource(changedFileName);
        } else {
          await refreshAllSources();
        }
      }),
    );
    unlisteners.push(
      await eventListen<{ scope?: string; fileName?: string }>(
        'app:booksource-reload',
        async (event) => {
          const { scope, fileName } = event.payload ?? {};
          if (scope === 'single' && fileName) {
            await refreshSingleSource(fileName);
          } else {
            await refreshAllSources();
          }
        },
      ),
    );
    unlisteners.push(
      await eventListen<{ view?: string }>('app:view-reload', async (event) => {
        if (event.payload?.view === 'explore') {
          await handleForceReload();
        }
      }),
    );
  } finally {
    initializingSources.value = false;
  }
});

onUnmounted(() => {
  cleanupWheelScroll?.();
  unlisteners.forEach((fn) => fn());
});

// ── 移动端滑动手势切换书源 Tab ────────────────────────────────────────────
function switchActiveSourceTab(direction: 'prev' | 'next') {
  const list = sortedSources.value;
  if (list.length < 2) {
    return;
  }
  const idx = list.findIndex((s) => s.fileName === activeSourceTab.value);
  if (idx < 0) {
    return;
  }
  if (direction === 'next' && idx < list.length - 1) {
    activeSourceTab.value = list[idx + 1].fileName;
  } else if (direction === 'prev' && idx > 0) {
    activeSourceTab.value = list[idx - 1].fileName;
  }
}

const {
  onSwipePointerDown,
  onSwipePointerMove,
  onSwipePointerUp,
  onSwipePointerCancel,
  onSwipeClickCapture,
} = useMobileHorizontalSwipe({
  onSwipeLeft: () => switchActiveSourceTab('next'),
  onSwipeRight: () => switchActiveSourceTab('prev'),
});

// ── 鼠标滚轮横向滚动 tabs 导航栏（PC）──────────────────────────────────
const evTabsRef = ref<HTMLElement | null>(null);

function scrollActiveSourceTabIntoView() {
  if (!evTabsRef.value) {
    return;
  }
  const activeTabEl = evTabsRef.value.querySelector<HTMLElement>('.n-tabs-tab--active');
  activeTabEl?.scrollIntoView({
    block: 'nearest',
    inline: 'center',
    behavior: 'smooth',
  });
}

function setupTabsWheelScroll(el: HTMLElement): (() => void) | undefined {
  // Naive UI 渲染时机不确定，用 MutationObserver 等待目标元素出现
  let cleanup: (() => void) | undefined;
  let found = false;

  function attach(wrapper: HTMLElement) {
    function onWheel(e: WheelEvent) {
      // 有水平滚动量时直接滚动，否则把垂直量映射到水平
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (delta === 0) {
        return;
      }
      e.preventDefault();
      wrapper.scrollLeft += delta;
    }
    wrapper.addEventListener('wheel', onWheel, { passive: false });
    cleanup = () => wrapper.removeEventListener('wheel', onWheel);
  }

  const candidate = el.querySelector<HTMLElement>('.n-tabs-nav-scroll-wrapper');
  if (candidate) {
    found = true;
    attach(candidate);
  } else {
    const observer = new MutationObserver(() => {
      const w = el.querySelector<HTMLElement>('.n-tabs-nav-scroll-wrapper');
      if (w) {
        found = true;
        observer.disconnect();
        attach(w);
      }
    });
    observer.observe(el, { childList: true, subtree: true });
    // 安全兜底：5s 后断开
    setTimeout(() => {
      if (!found) {
        observer.disconnect();
      }
    }, 5000);
    return () => {
      observer.disconnect();
      cleanup?.();
    };
  }

  return () => cleanup?.();
}

function sourceTypeLabel(source: BookSourceMeta): string {
  return getSourceTypeLabel(source.sourceType);
}

let cleanupWheelScroll: (() => void) | undefined;

watch(
  () => [activeSourceTab.value, sortedSources.value.map((src) => src.fileName).join('|')] as const,
  async () => {
    await nextTick();
    requestAnimationFrame(() => {
      scrollActiveSourceTabIntoView();
    });
  },
);
</script>

<template>
  <div class="explore-view" :style="explorerStyle">
    <AppPageHeader title="发现">
      <template #title-extra>
        <span class="ev-header__sub">{{ explorableSources.length }} 个发现源</span>
      </template>
      <template #actions>
        <MobileToolbarMenu
          :options="exploreMobileMenuOptions"
          @select="handleExploreMobileMenuSelect"
        >
          <!-- 显示模式切换 -->
          <n-tooltip trigger="hover">
            <template #trigger>
              <n-button
                size="small"
                quaternary
                class="ev-mode-btn"
                :class="{ 'ev-mode-btn--active': displayMode === 'card' }"
                @click="displayMode = 'card'"
              >
                <template #icon><LayoutGrid :size="14" /></template>
              </n-button>
            </template>
            卡片模式
          </n-tooltip>
          <n-tooltip trigger="hover">
            <template #trigger>
              <n-button
                size="small"
                quaternary
                class="ev-mode-btn"
                :class="{ 'ev-mode-btn--active': displayMode === 'cover' }"
                @click="displayMode = 'cover'"
              >
                <template #icon><Image :size="14" /></template>
              </n-button>
            </template>
            封面模式
          </n-tooltip>
          <n-tooltip trigger="hover">
            <template #trigger>
              <n-button
                size="small"
                quaternary
                class="ev-mode-btn"
                :class="{ 'ev-mode-btn--active': displayMode === 'list' }"
                @click="displayMode = 'list'"
              >
                <template #icon><List :size="14" /></template>
              </n-button>
            </template>
            列表模式
          </n-tooltip>

          <!-- 封面开关（仅卡片/列表模式） -->
          <n-tooltip v-if="displayMode !== 'cover'" trigger="hover">
            <template #trigger>
              <n-button size="small" quaternary @click="showCovers = !showCovers">
                <template #icon>
                  <Eye v-if="showCovers" :size="14" />
                  <EyeOff v-else :size="14" />
                </template>
              </n-button>
            </template>
            {{ showCovers ? '隐藏封面' : '显示封面' }}
          </n-tooltip>

          <!-- 卡片尺寸选择 -->
          <n-dropdown
            trigger="click"
            :options="CARD_SIZES.map((s) => ({ label: s.label, key: s.key }))"
            :value="activeSizeKey"
            @select="setSize"
          >
            <n-tooltip trigger="hover">
              <template #trigger>
                <n-button size="small" quaternary>
                  <template #icon>
                    <LayoutGrid :size="14" />
                  </template>
                </n-button>
              </template>
              卡片大小（{{ activeSize.label }}）
            </n-tooltip>
          </n-dropdown>

          <!-- 排序按钮 -->
          <n-tooltip trigger="hover">
            <template #trigger>
              <n-button size="small" quaternary @click="openSortModal">
                <template #icon>
                  <AlignJustify :size="16" />
                </template>
              </n-button>
            </template>
            书源排序
          </n-tooltip>

          <!-- 刷新按钮 -->
          <n-tooltip trigger="hover">
            <template #trigger>
              <n-button size="small" quaternary :loading="reloadingAll" @click="handleForceReload">
                全部重载
              </n-button>
            </template>
            全量重载发现页书源与缓存
          </n-tooltip>

          <n-tooltip trigger="hover">
            <template #trigger>
              <n-button size="small" quaternary :loading="refreshing" @click="handleRefresh">
                <template #icon>
                  <RefreshCw :size="16" />
                </template>
              </n-button>
            </template>
            刷新当前书源
          </n-tooltip>
        </MobileToolbarMenu>
      </template>
    </AppPageHeader>

    <!-- 书源排序弹窗 -->
    <ExploreViewSortModal
      v-model:show="showSortModal"
      :sources="sortedSources"
      @confirm="saveTabOrder"
    />

    <!-- 按书源分 Tab -->
    <template v-if="sortedSources.length">
      <div
        ref="evTabsRef"
        class="ev-tabs-wrap"
        @pointerdown="onSwipePointerDown"
        @pointermove="onSwipePointerMove"
        @pointerup="onSwipePointerUp"
        @pointercancel="onSwipePointerCancel"
        @click.capture="onSwipeClickCapture"
      >
        <n-tabs
          v-model:value="activeSourceTab"
          type="line"
          animated
          class="ev-tabs app-scrollbar-proxy--hidden"
        >
          <n-tab-pane
            v-for="src in sortedSources"
            :key="src.fileName"
            :name="src.fileName"
            display-directive="show"
          >
            <template #tab>
              <span
                class="ev-source-tab"
                @contextmenu.prevent.stop="openTabMenu($event, src)"
                @pointerdown="onTabPointerDown($event, src)"
                @pointermove="onTabPointerMoveCheck($event)"
                @pointerup="cancelLongPress"
                @pointercancel="cancelLongPress"
              >
                <span class="ev-source-tab__name">{{ src.name }}</span>
                <SourceTypeBadge
                  v-if="src.sourceType && src.sourceType !== 'novel'"
                  :source-type="src.sourceType"
                  :opaque="true"
                  :size="10"
                  class="ev-source-tab__type-icon"
                />
              </span>
            </template>
            <!-- 副标题行 -->
            <div v-if="currentSource?.description" class="ev-subtitle">
              <span class="ev-subtitle__text">{{ currentSource.description }}</span>
              <n-button
                v-if="activeSourceCanSearch"
                text
                size="tiny"
                class="ev-subtitle__search-btn"
                @click="navigateToActiveSourceSearch"
              >
                <template #icon><Search :size="14" /></template>
                使用此书源搜索
              </n-button>
            </div>
            <div v-else-if="activeSourceCanSearch" class="ev-subtitle ev-subtitle--empty">
              <n-button
                text
                size="tiny"
                class="ev-subtitle__search-btn"
                @click="navigateToActiveSourceSearch"
              >
                <template #icon><Search :size="14" /></template>
                使用此书源搜索
              </n-button>
            </div>

            <!-- 内容区直接渲染，无额外容器 -->
            <div class="ev-content app-scrollbar">
              <SourceExploreSection
                :source="src"
                :active="activeSourceTab === src.fileName"
                :prefetch="prefetchedSourceTabs.has(src.fileName)"
                :show-covers="showCovers"
                :display-mode="displayMode"
                :reload-version="sourceRefreshVersion[src.fileName] ?? 0"
                @select="openDetail"
                @open-book="(url: string) => handleOpenBookByUrl(url, src.fileName)"
                @refreshing="onSectionRefreshing"
              />
            </div>
          </n-tab-pane>
        </n-tabs>
      </div>
    </template>
    <AppEmpty
      v-else-if="sourceSystemStarting"
      title="书源系统启动中"
      desc="正在加载书源并检测发现能力"
    />
    <AppEmpty
      v-else
      title="暂无可用的发现书源"
      desc="请先在书源管理中添加支持「发现」的书源"
    />

    <!-- 书籍详情抽屉 -->
    <BookDetailDrawer
      v-model:show="showDrawer"
      :book-url="drawerBookUrl"
      :file-name="drawerFileName"
      :source-name="drawerSourceName"
      :source-type="drawerSourceType"
      @read-chapter="onReadChapter"
    />

    <!-- 章节阅读器 -->
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
      :chapter-groups="readerChapterGroups"
      :initial-group-index="readerActiveGroupIndex"
      @added-to-shelf="readerShelfId = $event"
      @source-switched="applySourceSwitchToReader"
    />

    <!-- 免责声明弹窗 -->
    <n-modal
      v-model:show="showDisclaimer"
      :mask-closable="false"
      :close-on-esc="false"
      preset="card"
      title="使用须知"
      :style="{ maxWidth: '480px', width: '92vw' }"
      :bordered="false"
    >
      <div class="disclaimer-body">
        <p>本软件所有书源均来源于社区用户共享，软件本身不提供、不存储任何内容。</p>
        <p>
          书源内容由第三方网站提供，版权归原作者及原网站所有。若您发现任何书源涉及侵权内容，请立即停止使用该书源，并通知相关内容提供方。
        </p>
        <p>使用书源所产生的一切法律责任由使用者本人承担，与本软件开发者无关。</p>
      </div>
      <n-checkbox v-model:checked="disclaimerDontShow" class="disclaimer-check">
        不再显示
      </n-checkbox>
      <template #footer>
        <div style="display: flex; justify-content: flex-end">
          <n-button type="primary" @click="confirmDisclaimer">我已了解</n-button>
        </div>
      </template>
    </n-modal>

    <!-- Tab 右键 / 长按上下文菜单 -->
    <n-dropdown
      trigger="manual"
      :show="tabMenu.visible"
      :x="tabMenu.x"
      :y="tabMenu.y"
      :options="tabMenuOptions"
      @select="handleTabMenuSelect"
      @clickoutside="tabMenu.visible = false"
    />
  </div>
</template>

<style scoped>
.explore-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  /* background: var(--color-bg-page); */
}

.ev-header__sub {
  font-size: var(--fs-13);
  color: var(--color-text-soft);
}
.ev-header__stat {
  font-size: var(--fs-12);
  color: var(--color-text-muted);
  white-space: nowrap;
}

/* 模式切换按钮激活态 */
.ev-mode-btn--active {
  color: var(--color-accent) !important;
}
.ev-source-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.ev-source-tab__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ev-source-tab__type-icon {
  flex-shrink: 0;
  color: var(--color-text-muted);
  background-color: transparent;
}

.ev-tabs-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ev-tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0 var(--space-6);
}
:deep(.n-tabs-nav) {
  flex-shrink: 0;
}
:deep(.n-tabs-nav-scroll-wrapper) {
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
}
:deep(.n-tabs-nav-scroll-content) {
  overflow: visible !important;
}
:deep(.n-tabs-pane-wrapper) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
:deep(.n-tab-pane) {
  height: 100%;
  padding: 0;
  display: flex;
  flex-direction: column;
}

/* 副标题行 */
.ev-subtitle {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0 4px;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 8px;
}
.ev-subtitle__text {
  flex: 1;
  min-width: 0;
  font-size: var(--fs-12);
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ev-subtitle--empty {
  justify-content: flex-end;
}
.ev-subtitle__search-btn {
  flex-shrink: 0;
  font-size: var(--fs-12) !important;
  color: var(--color-accent) !important;
}

/* 内容区：直接滚动，无额外容器包裹 */
.ev-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-bottom: 16px;
  display: flex;
  flex-direction: column;
}
/* ── 移动端适配 ─────────────────────────── */
@media (pointer: coarse), (max-width: 640px) {
  .ev-tabs {
    padding: 0 var(--space-4);
  }
  .ev-tabs-wrap,
  .ev-content {
    touch-action: pan-y;
  }
  :deep(.n-tabs-tab) {
    padding: 6px 2px !important;
    font-size: var(--fs-13) !important;
  }
}

.disclaimer-body {
  font-size: var(--fs-14);
  line-height: var(--lh-body);
  color: var(--color-text-soft);
}

.disclaimer-body p {
  margin: 0 0 10px;
}

.disclaimer-body p:last-child {
  margin-bottom: 0;
}

.disclaimer-check {
  margin-top: 14px;
  font-size: var(--fs-13);
  color: var(--color-text-muted);
}
</style>
