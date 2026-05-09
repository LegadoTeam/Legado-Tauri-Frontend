<script setup lang="ts">
import { openUrl } from '@tauri-apps/plugin-opener';
import { ChevronLeft, ArrowUp } from 'lucide-vue-next';
import { useMessage } from 'naive-ui';
import { ref, computed, watch, onMounted, onBeforeUnmount, type CSSProperties } from 'vue';
import type { CachedChapter, BookDetail, ChapterItem, ChapterGroup } from '@/types';
import { useBookshelfStore, useScriptBridgeStore, useBackStackStore, groupChapters } from '@/stores';
import type { ReaderBookInfo } from '../reader/types';
import { isMobile } from '../../composables/useEnv';
import {
  getBookMetaBadges,
  getBookMetaLine,
  getLatestChapterText,
  getNormalizedLastChapter,
} from '../../utils/bookMeta';
import { getCoverImageUrl } from '../../utils/coverImage';
import {
  ensureFrontendNamespaceLoaded,
  getFrontendStorageItem,
  legacyLocalStorageEntries,
  legacyLocalStorageRemove,
  setFrontendStorageItem,
} from '../../composables/useFrontendStorage';
import AppButton from '../base/AppButton.vue';
import BookCoverImg from '../BookCoverImg.vue';

const props = defineProps<{
  show: boolean;
  bookUrl: string;
  fileName: string;
  sourceName: string;
  /** 书源类型：novel（默认）或 comic 或 video */
  sourceType?: string;
  /** 顶层还有其它弹层时，暂停返回键/Escape 处理，避免一次关闭多层 */
  suspendCloseShortcuts?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:show', val: boolean): void;
  (
    e: 'read-chapter',
    payload: {
      chapterUrl: string;
      chapterName: string;
      index: number;
      bookInfo: ReaderBookInfo;
      sourceType: string;
      /** 目录专属 URL（部分书源与 bookUrl 不同） */
      tocUrl?: string;
      /** 视频多线路分组数据（可选） */
      chapterGroups?: ChapterGroup[];
      /** 当前选中的线路索引 */
      activeGroupIndex?: number;
    },
  ): void;
}>();

const message = useMessage();
const { runBookInfo, runChapterList, runChapterContent } = useScriptBridgeStore();
const { addToShelf, saveChapters, saveContent, isOnShelf, ensureLoaded } = useBookshelfStore();

const loading = ref(false);
const error = ref('');
const detail = ref<BookDetail | null>(null);
const chapters = ref<ChapterItem[]>([]);
const addingToShelf = ref(false);
const onShelf = ref(false);

/** 视频多线路分组（无分组时为空数组） */
const chapterGroups = ref<ChapterGroup[]>([]);
/** 当前选中的线路标签索引 */
const activeGroupIndex = ref(0);
/** 列表排序：asc 正序，desc 倒序 */
const sortOrder = ref<'asc' | 'desc'>('asc');

/** 是否需要显示分组标签页 */
const hasGroups = computed(() => chapterGroups.value.length > 1);
/** 当前标签页下的章节列表（含排序） */
const displayChapters = computed(() => {
  let list: ChapterItem[];
  if (hasGroups.value) {
    const group = chapterGroups.value[activeGroupIndex.value];
    list = group ? group.chapters : [];
  } else {
    list = chapters.value;
  }
  if (sortOrder.value === 'desc') {
    return [...list].toReversed();
  }
  return list;
});

/** 根据 bookUrl 生成前端存储 key */
function storageKey(suffix: string) {
  return `bd-video-${props.bookUrl}-${suffix}`;
}

const STORAGE_NAMESPACE = 'explore.book-detail';

/** 保存标签和排序状态 */
function saveTabState() {
  setFrontendStorageItem(STORAGE_NAMESPACE, storageKey('group'), String(activeGroupIndex.value));
  setFrontendStorageItem(STORAGE_NAMESPACE, storageKey('sort'), sortOrder.value);
}

/** 恢复标签和排序状态 */
function restoreTabState() {
  try {
    const savedGroup = getFrontendStorageItem(STORAGE_NAMESPACE, storageKey('group'));
    if (savedGroup !== null) {
      const idx = Number(savedGroup);
      if (idx >= 0 && idx < chapterGroups.value.length) {
        activeGroupIndex.value = idx;
      }
    }
    const savedSort = getFrontendStorageItem(STORAGE_NAMESPACE, storageKey('sort'));
    if (savedSort === 'desc') {
      sortOrder.value = 'desc';
    }
  } catch {
    /* ignore */
  }
}

onMounted(() => {
  void ensureFrontendNamespaceLoaded(STORAGE_NAMESPACE, () => {
    const migrated: Record<string, string> = {};
    const legacy = legacyLocalStorageEntries(`bd-video-${props.bookUrl}-`);
    for (const [key, value] of Object.entries(legacy)) {
      migrated[key] = value;
      legacyLocalStorageRemove(key);
    }
    return Object.keys(migrated).length ? migrated : null;
  }).then(() => {
    restoreTabState();
  });
});

function onGroupChange(index: number) {
  activeGroupIndex.value = index;
  saveTabState();
}

function toggleSortOrder() {
  sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  saveTabState();
}

/** 移动端全宽，桌面端固定宽度 */
const drawerWidth = computed(() => (isMobile.value ? '100vw' : 480));
const drawerTitle = computed(() => (isMobile.value ? '' : (detail.value?.name ?? '书籍详情')));
const drawerHeaderStyle = computed(() => (isMobile.value ? { display: 'none' } : undefined));
const drawerBodyContentStyle = computed((): CSSProperties | undefined =>
  isMobile.value
    ? { display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '0', height: '100%' }
    : { display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '14px' },
);
const mobileHeaderTitle = computed(() => detail.value?.name?.trim() || '书籍详情');
const mobileHeaderSubtitle = computed(() => `来自 ${props.sourceName}`);
const detailBadges = computed(() => getBookMetaBadges(detail.value, props.sourceType));
const detailLatestChapter = computed(() => getLatestChapterText(detail.value));
const detailMetaRows = computed(() => {
  const d = detail.value;
  if (!d) return [];
  const rows: { label: string; value: string }[] = [];
  if (detailLatestChapter.value) {
    rows.push({ label: '最新章节', value: detailLatestChapter.value });
  }
  if (d.wordCount?.trim()) {
    rows.push({ label: '字数', value: d.wordCount.trim() });
  }
  if (typeof d.chapterCount === 'number' && Number.isFinite(d.chapterCount) && d.chapterCount > 0) {
    rows.push({ label: '章节总数', value: `${Math.floor(d.chapterCount)} 章` });
  }
  if (d.updateTime?.trim()) {
    rows.push({ label: '更新时间', value: d.updateTime.trim() });
  }
  return rows;
});

function closeDrawer() {
  emit('update:show', false);
}

/* ---- Android 返回键 / Escape ---- */
const _backStack = useBackStackStore();
let _backHandler: (() => void) | null = null;

function activateHistoryGuard() {
  if (_backHandler) return;
  _backHandler = () => {
    _backHandler = null; // 自注销，避免 show watcher 重复消耗
    if (props.suspendCloseShortcuts) return;
    closeDrawer();
  };
  _backStack.push(_backHandler);
}

function deactivateHistoryGuard() {
  if (!_backHandler) return;
  const h = _backHandler;
  _backHandler = null;
  _backStack.remove(h);
}

onBeforeUnmount(() => {
  if (_backHandler) {
    _backStack.detach(_backHandler);
    _backHandler = null;
  }
});

watch(
  () => props.show,
  async (visible) => {
    if (!visible) {
      return;
    }
    loading.value = true;
    error.value = '';
    detail.value = null;
    chapters.value = [];
    chapterGroups.value = [];
    activeGroupIndex.value = 0;
    sortOrder.value = 'asc';
    onShelf.value = false;
    try {
      await ensureLoaded();
      onShelf.value = isOnShelf(props.bookUrl, props.fileName);

      // 先获取书籍详情，拿到 tocUrl（目录专属 URL），再用它加载章节列表
      // bookInfo 返回的 tocUrl 可能与 bookUrl 不同（如番茄小说使用独立目录接口）
      const infoRaw = await runBookInfo(props.fileName, props.bookUrl);
      detail.value = infoRaw as BookDetail;
      const tocUrl = detail.value.tocUrl ?? props.bookUrl;
      const listRaw = await runChapterList(props.fileName, tocUrl);
      chapters.value = Array.isArray(listRaw) ? (listRaw as ChapterItem[]) : [];

      // 视频多线路分组
      chapterGroups.value = groupChapters(chapters.value);
      if (hasGroups.value) {
        restoreTabState();
      }
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e);
      message.error(`加载书籍详情失败: ${error.value}`);
    } finally {
      loading.value = false;
    }
  },
);

watch(
  () => [props.show, props.suspendCloseShortcuts] as const,
  ([visible, suspended]) => {
    if (visible && !suspended) {
      activateHistoryGuard();
    } else {
      deactivateHistoryGuard();
    }
  },
  { immediate: true },
);

function onClickChapter(ch: ChapterItem, indexInDisplay: number) {
  const d = detail.value;
  // 当显示倒序时，将 displayChapters 中的索引转换回原始列表中的索引
  const currentList = hasGroups.value
    ? (chapterGroups.value[activeGroupIndex.value]?.chapters ?? [])
    : chapters.value;
  const realIndex =
    sortOrder.value === 'desc' ? currentList.length - 1 - indexInDisplay : indexInDisplay;
  const bookInfo: ReaderBookInfo = {
    name: d?.name ?? '',
    author: d?.author ?? '',
    coverUrl: d?.coverUrl,
    intro: d?.intro,
    kind: d?.kind,
    bookUrl: props.bookUrl,
    sourceName: props.sourceName,
    fileName: props.fileName,
    lastChapter: getNormalizedLastChapter(d),
    latestChapter: d?.latestChapter,
    latestChapterUrl: d?.latestChapterUrl,
    wordCount: d?.wordCount,
    chapterCount: d?.chapterCount,
    updateTime: d?.updateTime,
    status: d?.status,
    totalChapters: currentList.length,
  };
  emit('read-chapter', {
    chapterUrl: ch.url,
    chapterName: ch.name,
    index: realIndex,
    bookInfo,
    sourceType: props.sourceType ?? 'novel',
    tocUrl: detail.value?.tocUrl ?? props.bookUrl,
    chapterGroups: hasGroups.value ? chapterGroups.value : undefined,
    activeGroupIndex: hasGroups.value ? activeGroupIndex.value : undefined,
  });
}

async function handleAddToShelf() {
  if (!detail.value || onShelf.value) {
    return;
  }
  addingToShelf.value = true;
  try {
    const d = detail.value;
    const result = await addToShelf(
      {
        name: d.name,
        author: d.author,
        coverUrl: getCoverImageUrl(d.coverUrl),
        intro: d.intro,
        kind: d.kind,
        bookUrl: props.bookUrl,
        lastChapter: getNormalizedLastChapter(d),
        sourceType: props.sourceType ?? 'novel',
      },
      props.fileName,
      props.sourceName,
    );
    // 同时缓存章节目录
    if (chapters.value.length) {
      const cached: CachedChapter[] = chapters.value.map((ch, i) => ({
        index: i,
        name: ch.name,
        url: ch.url,
      }));
      await saveChapters(result.id, cached);
    }
    onShelf.value = true;
    message.success('已加入书架'); // 后台预缓存第一章正文（非阻塞，忽略错误）
    if (chapters.value.length > 0 && props.sourceType !== 'comic') {
      const firstCh = chapters.value[0];
      const shelfId = result.id;
      (async () => {
        try {
          const content = await runChapterContent(props.fileName, firstCh.url);
          await saveContent(
            shelfId,
            0,
            typeof content === 'string' ? content : JSON.stringify(content),
          );
        } catch {
          // 预缓存失败不影响主流程
        }
      })();
    }
  } catch (e: unknown) {
    message.error(`加入书架失败: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    addingToShelf.value = false;
  }
}
</script>

<template>
  <n-drawer
    :show="show"
    :width="drawerWidth"
    placement="right"
    to="body"
    @update:show="emit('update:show', $event)"
    :auto-focus="false"
  >
    <n-drawer-content
      :title="drawerTitle"
      :closable="!isMobile"
      :header-style="drawerHeaderStyle"
      :body-content-style="drawerBodyContentStyle"
    >
      <div class="bd-shell">
        <div v-if="isMobile" class="bd-mobile-header">
          <n-button
            quaternary
            circle
            size="large"
            class="bd-mobile-back"
            aria-label="返回"
            @click="closeDrawer"
          >
            <template #icon>
              <ChevronLeft :size="24" :stroke-width="2.4" aria-hidden="true" />
            </template>
          </n-button>
          <div class="bd-mobile-header__meta">
            <div class="bd-mobile-header__title">{{ mobileHeaderTitle }}</div>
            <div class="bd-mobile-header__subtitle">{{ mobileHeaderSubtitle }}</div>
          </div>
        </div>

        <n-spin :show="loading" class="bd-spin-wrap">
          <div class="bd-scroll" :class="{ 'bd-scroll--mobile': isMobile }">
            <!-- 错误 -->
            <n-alert v-if="error" type="error" :title="error" style="margin-bottom: 16px" />

            <!-- 详情头部 -->
            <div v-if="detail && isMobile" class="bd-header bd-header--mobile">
              <BookCoverImg
                class="bd-header__cover bd-header__cover--mobile"
                :src="detail.coverUrl"
                :base-url="bookUrl"
                :alt="detail.name"
              />
              <div class="bd-header__meta bd-header__meta--mobile">
                <h2 class="bd-header__name">{{ detail.name }}</h2>
                <span class="bd-header__author">{{ detail.author }}</span>
                <div v-if="detailBadges.length" class="bd-header__tags">
                  <n-tag
                    v-for="badge in detailBadges"
                    :key="badge.key"
                    size="tiny"
                    :bordered="false"
                  >
                    {{ badge.label }}
                  </n-tag>
                </div>
                <div v-if="detailMetaRows.length" class="bd-header__meta-grid">
                  <div v-for="row in detailMetaRows" :key="row.label" class="bd-header__meta-cell">
                    <span class="bd-header__meta-label">{{ row.label }}</span>
                    <span class="bd-header__meta-value" :title="row.value">{{ row.value }}</span>
                  </div>
                </div>
                <a class="bd-header__url" :title="bookUrl" @click.prevent="openUrl(bookUrl)">{{
                  bookUrl
                }}</a>
              </div>
              <p
                v-if="detail.intro"
                class="bd-header__intro bd-header__intro--mobile app-scrollbar"
              >
                {{ detail.intro }}
              </p>
            </div>

            <div v-else-if="detail" class="bd-header">
              <BookCoverImg
                class="bd-header__cover"
                :src="detail.coverUrl"
                :base-url="bookUrl"
                :alt="detail.name"
              />
              <div class="bd-header__meta">
                <h2 class="bd-header__name">{{ detail.name }}</h2>
                <span class="bd-header__author">{{ detail.author }}</span>
                <div v-if="detailBadges.length" class="bd-header__tags">
                  <n-tag
                    v-for="badge in detailBadges"
                    :key="badge.key"
                    size="tiny"
                    :bordered="false"
                  >
                    {{ badge.label }}
                  </n-tag>
                </div>
                <div v-if="detailMetaRows.length" class="bd-header__meta-grid">
                  <div v-for="row in detailMetaRows" :key="row.label" class="bd-header__meta-cell">
                    <span class="bd-header__meta-label">{{ row.label }}</span>
                    <span class="bd-header__meta-value" :title="row.value">{{ row.value }}</span>
                  </div>
                </div>
                <p v-if="detail.intro" class="bd-header__intro app-scrollbar">{{ detail.intro }}</p>
                <a class="bd-header__url" :title="bookUrl" @click.prevent="openUrl(bookUrl)">{{
                  bookUrl
                }}</a>
              </div>
            </div>

            <!-- 操作按钮 -->
            <div v-if="detail" class="bd-actions">
              <div class="bd-actions__btn">
                <AppButton
                  variant="primary"
                  size="lg"
                  block
                  :disabled="!displayChapters.length"
                  @click="displayChapters.length && onClickChapter(displayChapters[0], 0)"
                >
                  开始阅读
                </AppButton>
              </div>
              <div class="bd-actions__btn">
                <AppButton
                  size="lg"
                  block
                  :loading="addingToShelf"
                  :disabled="onShelf"
                  @click="handleAddToShelf"
                >
                  {{ onShelf ? '已在书架' : '加入书架' }}
                </AppButton>
              </div>
            </div>

            <!-- 章节列表 -->
            <div v-if="chapters.length" class="bd-chapters">
              <!-- 标题行：章节列表 + 排序按钮 -->
              <div class="bd-chapters__header">
                <div class="bd-chapters__title">
                  {{ hasGroups ? '选集' : '章节列表' }}
                  ({{ displayChapters.length }})
                </div>
                <n-button text size="tiny" class="bd-chapters__sort-btn" @click="toggleSortOrder">
                  {{ sortOrder === 'asc' ? '正序' : '倒序' }}
                  <ArrowUp
                    :size="12"
                    :style="{
                      transform: sortOrder === 'desc' ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.2s',
                    }"
                  />
                </n-button>
              </div>

              <!-- 视频多线路标签页 -->
              <div v-if="hasGroups" class="bd-chapters__tabs app-scrollbar--hidden">
                <button
                  v-for="(g, gi) in chapterGroups"
                  :key="g.name"
                  class="bd-tab-btn"
                  :class="{ 'bd-tab-btn--active': gi === activeGroupIndex }"
                  @click="onGroupChange(gi)"
                >
                  {{ g.name }}
                  <span class="bd-tab-btn__count">{{ g.chapters.length }}</span>
                </button>
              </div>

              <div class="bd-chapters__list app-scrollbar">
                <div
                  v-for="(ch, i) in displayChapters"
                  :key="`${ch.group || ''}-${ch.url}`"
                  class="bd-chapter-item"
                  @click="onClickChapter(ch, i)"
                >
                  <span class="bd-chapter-item__index">{{
                    sortOrder === 'asc' ? i + 1 : displayChapters.length - i
                  }}</span>
                  <span class="bd-chapter-item__name">{{ ch.name }}</span>
                </div>
              </div>
            </div>

            <n-empty
              v-if="!loading && !error && !detail"
              description="暂无数据"
              style="padding: 48px 0"
            />
          </div>
        </n-spin>
      </div>
    </n-drawer-content>
  </n-drawer>
</template>

<style scoped>
.bd-shell {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.bd-spin-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 200px;
}
:deep(.n-spin-container) {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* 让 n-spin 内部容器也是 flex 列布局 */
:deep(.n-spin-content) {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex: 1;
  min-height: 0;
}

.bd-scroll {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.bd-mobile-header {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 60px;
  padding: max(var(--safe-area-inset-top, env(safe-area-inset-top, 0px)), 16px) 14px 8px 8px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-raised);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
}

.bd-mobile-back {
  flex-shrink: 0;
  width: 42px;
  height: 42px;
}

.bd-mobile-header__meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding-top: 1px;
}

.bd-mobile-header__title {
  font-size: 0.9375rem;
  font-weight: 700;
  line-height: 1.2;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bd-mobile-header__subtitle {
  font-size: 0.8125rem;
  line-height: 1.2;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bd-header {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
  flex-shrink: 0;
}
.bd-header--mobile {
  flex-wrap: wrap;
}
.bd-header__intro--mobile {
  width: 100%;
  flex-shrink: 0;
}
.bd-header__cover {
  width: 100px;
  height: 140px;
  object-fit: cover;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
  background: var(--color-surface);
}
.bd-header__meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.bd-header__name {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
  line-height: 1.3;
}
.bd-header__author {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}
.bd-header__tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.bd-header__meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 10px;
}
.bd-header__meta-cell {
  min-width: 0;
  padding: 6px 8px;
  border-radius: var(--radius-2);
  background: var(--color-hover);
}
.bd-header__meta-label {
  display: block;
  font-size: var(--fs-10);
  line-height: 1.2;
  color: var(--color-text-muted);
}
.bd-header__meta-value {
  display: block;
  margin-top: 2px;
  font-size: var(--fs-12);
  line-height: 1.25;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bd-header__intro {
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
  line-height: 1.5;
  margin: 4px 0 0;
  max-height: 80px;
  overflow-y: auto;
  white-space: pre-wrap;
}
.bd-header__url {
  font-size: 0.75rem;
  color: var(--color-primary, #63a4ff);
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-decoration: none;
}
.bd-header__url:hover {
  text-decoration: underline;
}

.bd-actions {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
  margin-bottom: 12px;
}
.bd-actions__btn {
  flex: 1;
  min-width: 0;
}

.bd-chapters {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}
.bd-chapters__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}
.bd-chapters__title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-primary);
}
.bd-chapters__sort-btn {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  cursor: pointer;
}
.bd-chapters__tabs {
  display: flex;
  gap: 6px;
  padding: 8px 0;
  flex-shrink: 0;
  overflow-x: auto;
}
.bd-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  padding: 4px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-raised);
  color: var(--color-text-primary);
  font-size: 0.8125rem;
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast);
}
.bd-tab-btn:hover {
  border-color: var(--color-accent);
}
.bd-tab-btn--active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: #fff;
  font-weight: 600;
}
.bd-tab-btn__count {
  font-size: 0.6875rem;
  opacity: 0.7;
}
.bd-chapters__list {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.bd-chapter-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 4px;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  transition: background var(--transition-fast);
}
.bd-chapter-item:hover {
  background: var(--color-surface-hover);
}
.bd-chapter-item__index {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  min-width: 28px;
  text-align: center;
  flex-shrink: 0;
}
.bd-chapter-item__name {
  font-size: 0.8125rem;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (pointer: coarse), (max-width: 640px) {
  .bd-scroll--mobile {
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 16px;
    gap: 16px;
  }

  .bd-scroll--mobile .bd-header {
    margin-bottom: 0;
  }

  .bd-scroll--mobile .bd-header__cover {
    width: 92px;
    height: 128px;
  }

  .bd-scroll--mobile .bd-header--mobile {
    display: flow-root;
  }

  .bd-scroll--mobile .bd-header__cover--mobile {
    float: left;
    margin: 0 14px 10px 0;
  }

  .bd-scroll--mobile .bd-header__meta--mobile {
    display: block;
    min-width: 0;
    overflow: hidden;
    padding-top: 2px;
  }

  .bd-scroll--mobile .bd-header__name {
    font-size: 1rem;
    line-height: 1.25;
  }

  .bd-scroll--mobile .bd-header__author {
    font-size: 0.8125rem;
  }

  .bd-scroll--mobile .bd-header__tags {
    gap: 5px;
  }

  .bd-scroll--mobile .bd-header__intro {
    font-size: 0.875rem;
    line-height: 1.6;
    max-height: none;
    overflow: visible;
  }

  .bd-scroll--mobile .bd-header__intro--mobile {
    display: block;
    margin-top: 10px;
  }

  .bd-scroll--mobile .bd-header__url--mobile {
    display: block;
    clear: both;
    margin-top: 14px;
  }

  .bd-scroll--mobile .bd-actions {
    margin-bottom: 0;
  }

  .bd-scroll--mobile .bd-chapters {
    flex: none;
    min-height: auto;
    overflow: visible;
  }

  .bd-scroll--mobile .bd-chapters__list {
    overflow: visible;
  }

  .bd-scroll--mobile .bd-chapter-item {
    padding: 10px 4px;
  }
}
</style>
