<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useMessage } from 'naive-ui'
import type { BookSourceMeta } from '../../composables/useBookSource'
import type { BookItem } from '../../composables/useScriptBridge'
import { useScriptBridge } from '../../composables/useScriptBridge'
import { isHtmlExploreResult } from '../../composables/useExploreBridge'
import BookCard from './BookCard.vue'
import ExploreHtmlRenderer from './ExploreHtmlRenderer.vue'

const props = defineProps<{
  source: BookSourceMeta
  showCovers?: boolean
  /** 递增触发刷新 */
  refreshTrigger?: number
}>()

const emit = defineEmits<{
  (e: 'select', book: BookItem, fileName: string): void
  (e: 'open-book', bookUrl: string): void
  (e: 'search', keyword: string): void
  (e: 'refreshing', val: boolean): void
}>()

const message = useMessage()
const { runExplore, clearExploreCache } = useScriptBridge()

/** 最小 loading 展示时长（ms），防止 loading 一闪而过 */
// MIN_LOADING_MS: 已注释掉的 loading 最小展示时长（保留供将来启用）

// ── 分类 ──────────────────────────────────────────────────────────────────
const categories = ref<string[]>([])
const catLoading = ref(true)
const catError = ref('')

// ── 当前选中分类的书籍 ──────────────────────────────────────────────────
const activeCategory = ref('')
const books = ref<BookItem[]>([])
const booksLoading = ref(false)
const booksError = ref('')
/** HTML 交互页内容（当 explore 返回 {type:'html'} 时使用） */
const htmlContent = ref<string | null>(null)

async function loadCategories(restoreCategory?: string) {
  catLoading.value = true
  catError.value = ''
  try {
    const raw = await runExplore(props.source.fileName, 'GETALL')
    if (Array.isArray(raw)) {
      categories.value = raw.filter((v): v is string => typeof v === 'string')
      if (categories.value.length) {
        const target = restoreCategory && categories.value.includes(restoreCategory)
          ? restoreCategory
          : categories.value[0]
        await loadBooks(target)
      }
    }
  } catch (e: unknown) {
    catError.value = e instanceof Error ? e.message : String(e)
  } finally {
    catLoading.value = false
  }
}

async function loadBooks(category: string) {
  activeCategory.value = category
  booksError.value = ''
  booksLoading.value = true
  htmlContent.value = null

  try {
    const raw = await runExplore(props.source.fileName, category)
    if (isHtmlExploreResult(raw)) {
      // HTML 交互页模式
      htmlContent.value = raw.html
      books.value = []
    } else {
      // 标准书籍列表模式
      books.value = Array.isArray(raw) ? (raw as BookItem[]) : []
    }
  } catch (e: unknown) {
    booksError.value = e instanceof Error ? e.message : String(e)
    message.error(`加载 ${category} 失败: ${booksError.value}`)
  } finally {
    booksLoading.value = false
  }
}

onMounted(() => loadCategories())

const refreshing = ref(false)

/** 刷新：清空缓存，重新加载分类并尽量恢复原选中分类 */
async function handleRefresh() {
  refreshing.value = true
  emit('refreshing', true)
  const previousCategory = activeCategory.value
  try {
    await clearExploreCache(props.source.fileName)
    await loadCategories(previousCategory)
    message.success('刷新成功')
  } catch (e: unknown) {
    message.error(`刷新失败: ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    refreshing.value = false
    emit('refreshing', false)
  }
}

// 外部 refreshTrigger 递增时触发刷新
watch(() => props.refreshTrigger, (val, old) => {
  if (val !== undefined && old !== undefined && val !== old) {
    handleRefresh()
  }
})
</script>

<template>
  <div class="ses">
    <!-- 加载分类中 -->
    <div v-if="catLoading" class="ses__cat-loading">
      <n-spin size="small" />
      <span>加载分类中…</span>
    </div>

    <!-- 分类加载失败 -->
    <div v-else-if="catError" class="ses__error">
      加载失败: {{ catError }}
    </div>

    <!-- 分类标签行 -->
    <template v-else-if="categories.length">
      <div class="ses__cats">
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
      <div class="ses__books-wrap">
        <!-- loading 遮罩层 -->
        <Transition name="ses-fade">
          <div v-if="booksLoading" class="ses__loading-overlay">
            <n-spin size="small" />
          </div>
        </Transition>

        <div v-if="booksError" class="ses__error">{{ booksError }}</div>

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
        <div v-else-if="books.length" class="ses__grid">
          <BookCard
            v-for="book in books"
            :key="book.bookUrl"
            :book="book"
            :show-cover="showCovers ?? true"
            @select="emit('select', book, source.fileName)"
          />
        </div>
        <div v-else-if="!booksLoading" class="ses__empty">暂无数据</div>
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

.ses__cat-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 0;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.ses__error {
  padding: 12px 0;
  font-size: 0.8125rem;
  color: var(--color-danger);
}

.ses__cats {
  display: flex;
  gap: 4px;
  padding: 6px 0;
  flex-wrap: wrap;
}
.ses__cat-btn {
  padding: 4px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}
.ses__cat-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
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

.ses__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--explore-col-min, 210px), 1fr));
  gap: 6px;
  padding: 8px 0;
}

.ses__empty {
  padding: 24px 0;
  text-align: center;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}
</style>
