<script setup lang="ts">
import { useMessage } from 'naive-ui';
import { ref, computed, onMounted, watch } from 'vue';
import type { BookItem } from '@/stores';
import { useScriptBridgeStore } from '@/stores';
import type { BookSourceMeta } from '../../composables/useBookSource';
import {
  isHtmlExploreResult,
  isUrlExploreResult,
  getUrlFromExploreResult,
} from '../../composables/useExploreBridge';
import {
  getCachedExploreCategories,
  setCachedExploreCategories,
  getCachedExploreBooks,
  setCachedExploreBooks,
} from '../../composables/useExploreCategoryCache';
import AppSkeleton from '../base/AppSkeleton.vue';
import BookCard from './BookCard.vue';
import ExploreHtmlRenderer from './ExploreHtmlRenderer.vue';
import ExploreUrlRenderer from './ExploreUrlRenderer.vue';

const props = defineProps<{
  source: BookSourceMeta;
  active?: boolean;
  prefetch?: boolean;
  showCovers?: boolean;
  /** 显示模式：card=卡片网格，cover=封面书架，list=列表单列 */
  displayMode?: 'card' | 'cover' | 'list';
  /** 仅当版本变化时才触发重载 */
  reloadVersion?: number;
}>();

const emit = defineEmits<{
  (e: 'select', book: BookItem, fileName: string): void;
  (e: 'open-book', bookUrl: string): void;
  (e: 'search', keyword: string): void;
  (e: 'refreshing', val: boolean): void;
}>();

const message = useMessage();
const { runExplore, clearExploreCache } = useScriptBridgeStore();

/** 最小 loading 展示时长（ms），防止 loading 一闪而过 */
// MIN_LOADING_MS: 已注释掉的 loading 最小展示时长（保留供将来启用）

// ── 分类 ──────────────────────────────────────────────────────────────────
const categories = ref<string[]>([]);
const catLoading = ref(false); // 有缓存时不显示骨架屏
const catError = ref('');

/** 比较两个字符串数组是否内容相同（顺序敏感） */
function stringArraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** 比较两个书籍列表是否相同（用 bookUrl 作为稳定标识符） */
function bookListsEqual(a: BookItem[], b: BookItem[]): boolean {
  return a.length === b.length && a.every((item, i) => item.bookUrl === b[i].bookUrl);
}

/** 手动刷新时置 true，loadBooks 消费后重置，强制跳过持久化缓存 */
let forceRefreshBooksFlag = false;

// ── 当前选中分类的书籍 ──────────────────────────────────────────────────
const activeCategory = ref('');
const books = ref<BookItem[]>([]);
const booksLoading = ref(false);
const booksError = ref('');
/** HTML 交互页内容（当 explore 返回 {type:'html'} 时使用） */
const htmlContent = ref<string | null>(null);
/** URL 网页内容（当 explore 返回 URL 字符串或 {type:'url'} 时使用，适用于网页发现源） */
const urlContent = ref<string | null>(null);
const hasAttemptedInitialLoad = ref(false);
const pendingActivationRefresh = ref(false);
/** 是否已完成过至少一次书籍内容加载 */
const booksEverLoaded = ref(false);
/** 非激活状态下触发了刷新，激活时需要补加载书籍 */
const pendingBooksLoad = ref(false);
let categoryRequestToken = 0;
let booksRequestToken = 0;

// ── 翻页 ─────────────────────────────────────────────────────────────────
const currentPage = ref(1);

const paginationPages = computed(() => {
  const start = Math.max(1, currentPage.value - 3);
  const end = currentPage.value + 3;
  const pages: number[] = [];
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  return pages;
});

function goToPage(page: number) {
  if (page < 1 || booksLoading.value) {
    return;
  }
  void loadBooks(activeCategory.value, page);
}

async function loadCategories(restoreCategory?: string, skipBooks = false) {
  const requestToken = ++categoryRequestToken;
  catError.value = '';

  // ── stale-while-revalidate ───────────────────────────────────
  // 1. 立刻用缓存（无骨架屏）；2. 后台异步刷新；3. 仅有变化才重渲染
  const cached = getCachedExploreCategories(props.source.fileName);
  // cached 不为 null（即曾经加载过，哪怕是空数组）才走 SWR 路径
  if (cached !== null && cached !== undefined) {
    // 直接应用缓存，不显示骨架屏
    categories.value = cached;
    catLoading.value = false;
    const isCachedSinglePage = cached.length === 0;
    if (!skipBooks && !booksEverLoaded.value) {
      if (isCachedSinglePage) {
        void loadBooks('');
      } else {
        const target =
          restoreCategory && cached.includes(restoreCategory) ? restoreCategory : cached[0];
        void loadBooks(target);
      }
    }
    // 后台刷新（静默，失败不报错）
    void (async () => {
      try {
        const raw = await runExplore(props.source.fileName, 'GETALL');
        if (requestToken !== categoryRequestToken) return;
        if (!Array.isArray(raw)) return;
        const fresh = raw.filter((v): v is string => typeof v === 'string');
        // 仅有变化才更新缓存 + 重渲染，内容与缓存一致时无需任何操作
        if (!stringArraysEqual(categories.value, fresh)) {
          categories.value = fresh;
          setCachedExploreCategories(props.source.fileName, fresh);
          // 当前分类不在新列表中，切换到首个分类
          if (fresh.length && !fresh.includes(activeCategory.value)) {
            void loadBooks(fresh[0]);
          }
        }
      } catch {
        // 后台刷新失败不影响 UI
      }
    })();
    return;
  }

  // 无缓存：正常显示骨架屏加载
  catLoading.value = true;
  try {
    const raw = await runExplore(props.source.fileName, 'GETALL');
    if (requestToken !== categoryRequestToken) {
      return;
    }
    if (Array.isArray(raw)) {
      const cats = raw.filter((v): v is string => typeof v === 'string');
      // [] 或 [''] 表示单页源，隐藏分类标签栏，直接加载内容
      const isSinglePage = cats.length === 0 || (cats.length === 1 && cats[0] === '');
      categories.value = isSinglePage ? [] : cats;
      // 首次获取到分类后立即缓存（单页源缓存空数组以便下次跳过骨架屏）
      setCachedExploreCategories(props.source.fileName, categories.value);
      if (!skipBooks) {
        if (isSinglePage) {
          await loadBooks('');
        } else if (cats.length) {
          const target =
            restoreCategory && cats.includes(restoreCategory) ? restoreCategory : cats[0];
          await loadBooks(target);
        }
      }
    } else if (isUrlExploreResult(raw) || isHtmlExploreResult(raw)) {
      // 网页发现源：GETALL 直接返回内容，使用单一"发现"分类
      categories.value = ['发现'];
      setCachedExploreCategories(props.source.fileName, ['发现']);
      if (!skipBooks) {
        activeCategory.value = '发现';
        booksEverLoaded.value = true;
        if (isUrlExploreResult(raw)) {
          urlContent.value = getUrlFromExploreResult(raw);
          htmlContent.value = null;
        } else if (isHtmlExploreResult(raw)) {
          htmlContent.value = raw.html;
          urlContent.value = null;
        }
        books.value = [];
      }
    }
  } catch (e: unknown) {
    if (requestToken === categoryRequestToken) {
      catError.value = e instanceof Error ? e.message : String(e);
    }
  } finally {
    if (requestToken === categoryRequestToken) {
      catLoading.value = false;
    }
  }
}

async function loadBooks(category: string, page = 1) {
  const requestToken = ++booksRequestToken;
  activeCategory.value = category;
  currentPage.value = page;
  booksError.value = '';
  booksEverLoaded.value = true;

  // ── 第 1 页：stale-while-revalidate 持久化缓存 ──────────────────────────
  const forceRefresh = forceRefreshBooksFlag;
  forceRefreshBooksFlag = false;

  if (page === 1 && !forceRefresh) {
    const cached = getCachedExploreBooks(props.source.fileName, category);
    if (cached) {
      // 立即展示缓存数据，不显示 loading 遮罩
      htmlContent.value = null;
      urlContent.value = null;
      books.value = cached;
      booksLoading.value = false;

      // 后台静默刷新
      void (async () => {
        try {
          const raw = await runExplore(props.source.fileName, category, 1);
          if (requestToken !== booksRequestToken) return;
          if (isUrlExploreResult(raw)) {
            urlContent.value = getUrlFromExploreResult(raw);
            htmlContent.value = null;
            books.value = [];
            return;
          }
          if (isHtmlExploreResult(raw)) {
            // HTML 交互页不缓存，直接切换
            htmlContent.value = raw.html;
            urlContent.value = null;
            books.value = [];
            return;
          }
          const fresh = Array.isArray(raw) ? (raw as BookItem[]) : [];
          // 更新缓存（无论是否有变化都刷新时间戳）
          setCachedExploreBooks(props.source.fileName, category, fresh);
          // 仅当内容有变化时才更新视图
          if (!bookListsEqual(books.value, fresh)) {
            books.value = fresh;
          }
        } catch {
          // 后台刷新失败不影响 UI
        }
      })();
      return;
    }
  }

  // ── 无缓存 / 翻页 / 强制刷新：正常 loading 流程 ─────────────────────────
  booksLoading.value = true;
  try {
    const raw = await runExplore(props.source.fileName, category, page);
    if (requestToken !== booksRequestToken) {
      return;
    }
    if (isUrlExploreResult(raw)) {
      // URL 网页模式（不缓存）
      urlContent.value = getUrlFromExploreResult(raw);
      htmlContent.value = null;
      books.value = [];
    } else if (isHtmlExploreResult(raw)) {
      // HTML 交互页模式（不缓存）
      htmlContent.value = raw.html;
      urlContent.value = null;
      books.value = [];
    } else {
      // 标准书籍列表模式
      htmlContent.value = null;
      urlContent.value = null;
      const freshBooks = Array.isArray(raw) ? (raw as BookItem[]) : [];
      books.value = freshBooks;
      // 第 1 页结果写入持久化缓存
      if (page === 1) {
        setCachedExploreBooks(props.source.fileName, category, freshBooks);
      }
    }
  } catch (e: unknown) {
    if (requestToken === booksRequestToken) {
      booksError.value = e instanceof Error ? e.message : String(e);
      message.error(`加载 ${category} 失败: ${booksError.value}`);
    }
  } finally {
    if (requestToken === booksRequestToken) {
      booksLoading.value = false;
    }
  }
}

async function ensureLoadedWhenEligible() {
  if (!props.active && !props.prefetch) {
    return;
  }
  if (booksLoading.value) {
    return;
  }
  if (catLoading.value && hasAttemptedInitialLoad.value && !pendingActivationRefresh.value) {
    return;
  }
  if (!hasAttemptedInitialLoad.value || pendingActivationRefresh.value) {
    const restoreCategory = pendingActivationRefresh.value ? activeCategory.value : undefined;
    hasAttemptedInitialLoad.value = true;
    pendingActivationRefresh.value = false;
    // 非激活状态只预加载分类列表，切换过来时再按需加载书籍
    const skipBooks = !props.active;
    if (skipBooks) {
      pendingBooksLoad.value = true;
    }
    await loadCategories(restoreCategory, skipBooks);
  } else if (
    props.active &&
    categories.value.length > 0 &&
    (!booksEverLoaded.value || pendingBooksLoad.value)
  ) {
    // 分类已预加载完毕，刚切换到此 tab，补加载书籍内容
    pendingBooksLoad.value = false;
    await loadBooks(activeCategory.value || categories.value[0]);
  }
}

const refreshing = ref(false);

/** 刷新：清空缓存，重新加载分类并尽量恢复原选中分类 */
async function handleRefresh() {
  refreshing.value = true;
  emit('refreshing', true);
  const previousCategory = activeCategory.value;
  try {
    await clearExploreCache(props.source.fileName);
    // 标记跳过持久化书籍缓存，确保本次加载强制走网络
    forceRefreshBooksFlag = true;
    await loadCategories(previousCategory);
    message.success('刷新成功');
  } catch (e: unknown) {
    forceRefreshBooksFlag = false; // 异常时重置
    message.error(`刷新失败: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    refreshing.value = false;
    emit('refreshing', false);
  }
}

onMounted(() => {
  void ensureLoadedWhenEligible();
});

watch(
  () => [props.active, props.prefetch] as const,
  ([active, prefetch]) => {
    if (active || prefetch) {
      void ensureLoadedWhenEligible();
    }
  },
  { immediate: true },
);

// 仅当当前书源的 reloadVersion 变化时才重载；未激活页签只标记待刷新
watch(
  () => props.reloadVersion,
  (val, old) => {
    if (val !== undefined && old !== undefined && val !== old) {
      if (props.active) {
        void handleRefresh();
      } else {
        pendingActivationRefresh.value = true;
        void ensureLoadedWhenEligible();
      }
    }
  },
);
</script>

<template>
  <div class="ses" :class="{ 'ses--fullheight': urlContent !== null || htmlContent !== null }">
    <!-- 加载分类中 -->
    <div v-if="catLoading" class="ses__skeleton">
      <div class="ses__skeleton-cats">
        <AppSkeleton
          v-for="idx in 4"
          :key="`cat-${idx}`"
          variant="rect"
          width="72px"
          height="28px"
        />
      </div>
      <div class="ses__skeleton-grid">
        <AppSkeleton v-for="idx in 6" :key="`card-${idx}`" variant="rect" height="112px" />
      </div>
    </div>

    <!-- 分类加载失败 -->
    <div v-else-if="catError" class="ses__error">加载失败: {{ catError }}</div>

    <!-- 分类标签行（单页源 categories=[] 时隐藏） -->
    <template v-else-if="categories.length > 0 || urlContent !== null || htmlContent !== null || booksEverLoaded">
      <div v-if="categories.length > 0" class="ses__cats">
        <button
          v-for="cat in categories"
          :key="cat"
          class="ses__cat-btn"
          :class="{ 'ses__cat-btn--active': cat === activeCategory }"
          @click="loadBooks(cat)"
        >
          {{ cat }}
        </button>
      </div>

      <!-- 书籍区域：overlay loading，不改变高度 -->
      <div class="ses__books-wrap" :class="{ 'ses__books-wrap--fullheight': urlContent !== null || htmlContent !== null }">
        <!-- loading 遮罩层 -->
        <Transition name="ses-fade">
          <div v-if="booksLoading" class="ses__loading-overlay">
            <n-spin size="small" />
          </div>
        </Transition>

        <div v-if="booksError" class="ses__error">{{ booksError }}</div>

        <!-- URL 网页模式（网页发现源） -->
        <ExploreUrlRenderer
          v-else-if="urlContent"
          :url="urlContent"
        />

        <!-- HTML 交互页模式 -->
        <ExploreHtmlRenderer
          v-else-if="htmlContent"
          :html="htmlContent"
          :file-name="source.fileName"
          @open-book="(url: string) => emit('open-book', url)"
          @search="(kw: string) => emit('search', kw)"
          @explore="loadBooks"
        />

        <!-- 标准书籍列表模式 -->
        <div
          v-else-if="books.length"
          class="ses__grid"
          :class="{
            'ses__grid--cover': displayMode === 'cover',
            'ses__grid--list': displayMode === 'list',
          }"
        >
          <BookCard
            v-for="book in books"
            :key="book.bookUrl"
            :book="book"
            :show-cover="displayMode === 'cover' ? true : (showCovers ?? true)"
            :source-type="source.sourceType"
            :display-mode="displayMode ?? 'card'"
            @select="emit('select', book, source.fileName)"
          />
        </div>
        <div v-else-if="!booksLoading" class="ses__empty">暂无数据</div>
      </div>

      <!-- 翻页栏（标准书单模式，非 URL/HTML 渲染时显示） -->
      <div v-if="!htmlContent && !urlContent && (books.length > 0 || currentPage > 1)" class="ses__pagination">
        <button
          class="ses__page-btn"
          :disabled="currentPage === 1 || booksLoading"
          @click="goToPage(currentPage - 1)"
        >
          上一页
        </button>
        <button
          v-for="p in paginationPages"
          :key="p"
          class="ses__page-btn"
          :class="{ 'ses__page-btn--active': p === currentPage }"
          :disabled="booksLoading"
          @click="goToPage(p)"
        >
          {{ p }}
        </button>
        <button class="ses__page-btn" :disabled="booksLoading" @click="goToPage(currentPage + 1)">
          下一页
        </button>
      </div>
    </template>

    <!-- 无分类 -->
    <div v-else class="ses__empty">该书源没有发现分类</div>
  </div>
</template>

<style scoped>
.ses {
  display: flex;
  flex-direction: column;
}
.ses--fullheight {
  flex: 1;
  min-height: 0;
}

.ses__skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: 10px 0 var(--space-4);
}

.ses__skeleton-cats {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.ses__skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--book-card-col-min, 210px), 1fr));
  gap: var(--space-2);
}

.ses__error {
  padding: var(--space-3) 0;
  font-size: var(--fs-13);
  color: var(--color-danger);
}

.ses__cats {
  display: flex;
  gap: 4px;
  padding: 6px 0;
  flex-wrap: wrap;
}
.ses__cat-btn {
  padding: 4px var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-1);
  background: var(--color-surface);
  color: var(--color-text-soft);
  font-size: var(--fs-13);
  cursor: pointer;
  transition:
    border-color var(--dur-fast) var(--ease-standard),
    color var(--dur-fast) var(--ease-standard),
    background var(--dur-fast) var(--ease-standard);
  white-space: nowrap;
}
@media (hover: hover) and (pointer: fine) {
  .ses__cat-btn:hover {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }
}
.ses__cat-btn--active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: #fff;
}

.ses__books-wrap {
  position: relative;
  min-height: 40px;
}
.ses__books-wrap--fullheight {
  flex: 1;
  min-height: 0;
}

.ses__loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.25);
  z-index: 1;
}

.ses-fade-enter-active,
.ses-fade-leave-active {
  transition: opacity 0.2s ease;
}
.ses-fade-enter-from,
.ses-fade-leave-to {
  opacity: 0;
}

@keyframes ses-skeleton-shimmer {
  100% {
    transform: translateX(100%);
  }
}

.ses__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--book-card-col-min, 210px), 1fr));
  gap: 6px;
  padding: 8px 0;
}

.ses__grid--cover {
  grid-template-columns: repeat(auto-fill, minmax(var(--book-card-cover-col-min, 110px), 1fr));
  gap: 8px;
}

.ses__grid--list {
  grid-template-columns: 1fr;
  gap: 4px;
}

.ses__empty {
  padding: var(--space-6) 0;
  text-align: center;
  font-size: var(--fs-13);
  color: var(--color-text-muted);
}

.ses__pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 12px 0 8px;
  flex-wrap: wrap;
}

.ses__page-btn {
  padding: 4px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-1);
  background: var(--color-surface);
  color: var(--color-text-soft);
  font-size: var(--fs-13);
  cursor: pointer;
  transition:
    border-color var(--dur-fast) var(--ease-standard),
    color var(--dur-fast) var(--ease-standard),
    background var(--dur-fast) var(--ease-standard);
  white-space: nowrap;
  min-width: 36px;
}
@media (hover: hover) and (pointer: fine) {
  .ses__page-btn:hover:not(:disabled) {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }
}
.ses__page-btn--active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: #fff;
  font-weight: var(--fw-semibold);
}
.ses__page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
