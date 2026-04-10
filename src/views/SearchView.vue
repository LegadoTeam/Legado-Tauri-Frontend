<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { useMessage } from 'naive-ui'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import {
  type BookItem,
  type ChapterItem,
  useScriptBridge,
} from '../composables/useScriptBridge'
import {
  type BookSourceMeta,
  listBookSources,
  evalBookSource,
} from '../composables/useBookSource'
import { searchInitSource } from '../composables/useNavigation'
import { isSearchUserEnabled } from '../composables/useSourceCapabilities'
import MobileToolbarMenu from '../components/layout/MobileToolbarMenu.vue'
import SourceSearchGroup from '../components/explore/SourceSearchGroup.vue'
import AggregatedSearchResults, { type TaggedBookItem } from '../components/explore/AggregatedSearchResults.vue'
import BookDetailDrawer from '../components/explore/BookDetailDrawer.vue'
import ChapterReaderModal from '../components/explore/ChapterReaderModal.vue'
import { useBookshelf } from '../composables/useBookshelf'
import { usePrivacyMode } from '../composables/usePrivacyMode'
import type { ReaderBookInfo } from '../components/reader/types'

const message = useMessage()
const { runSearch, runChapterList, cancelTask } = useScriptBridge()

// ── 书源列表 & 能力检测 ──────────────────────────────────────────────────
const sources = ref<BookSourceMeta[]>([])
const sourceFns = reactive<Record<string, Set<string>>>({})
/** 参与搜索的书源：有 search 能力 + 用户未禁用（响应式 computed，自动跟随开关变化） */
const searchableSources = computed<BookSourceMeta[]>(() =>
  sources.value.filter(s => s.enabled && sourceFns[s.fileName]?.has('search') && isSearchUserEnabled(s.fileName))
)

/** 当前限制到单一书源（来自发现页跳转） */
const limitedSource = ref<BookSourceMeta | null>(null)
const limitedSourceName = computed(() => limitedSource.value?.name ?? '')

/** 实际参与搜索的书源列表 */
const activeSources = computed(() =>
  limitedSource.value ? [limitedSource.value] : searchableSources.value
)

function clearSourceLimit() {
  searchInitSource.value = null
  limitedSource.value = null
}

async function loadSources() {
  try {
    sources.value = await listBookSources()
    const enabled = sources.value.filter(s => s.enabled)
    for (const src of enabled) {
      if (sourceFns[src.fileName]) continue
      try {
        const fnsStr = await evalBookSource(src.fileName)
        const fns = new Set(fnsStr.split(',').map(s => s.trim()).filter(Boolean))
        sourceFns[src.fileName] = fns
      } catch {
        sourceFns[src.fileName] = new Set()
      }
    }
    // searchableSources 是 computed，无需手动赋值，自动基于 sources/sourceFns/用户开关更新

    // 如果有限定书源，从已知列表中查找
    if (searchInitSource.value) {
      const found = searchableSources.value.find(s => s.fileName === searchInitSource.value)
      limitedSource.value = found ?? null
      searchInitSource.value = null
    }
  } catch (e: unknown) {
    message.error(`加载书源列表失败: ${e instanceof Error ? e.message : String(e)}`)
  }
}

// 监听 searchInitSource 变化（用户从发现页切换过来时可能还未 mount）
watch(searchInitSource, (val) => {
  if (val) {
    const found = searchableSources.value.find(s => s.fileName === val)
    if (found) {
      limitedSource.value = found
      searchInitSource.value = null
    }
  }
})

// ── 搜索 ─────────────────────────────────────────────────────────────────
const searchKeyword = ref('')
const searchRunning = ref(false)
const showCovers = ref(true)

/** 搜索模式：'grouped' 按书源分组 | 'aggregated' 聚合排序 */
const searchMode = ref<'grouped' | 'aggregated'>('aggregated')

// ── 移动端三点菜单 ──────────────────────────────────────────────────────
const mobileMenuOptions = computed(() => [
  {
    label: showCovers.value ? '隐藏封面' : '显示封面',
    key: 'toggle-covers',
  },
  {
    label: '聚合模式',
    key: 'mode-aggregated',
    disabled: searchMode.value === 'aggregated',
  },
  {
    label: '分组模式',
    key: 'mode-grouped',
    disabled: searchMode.value === 'grouped',
  },
])

function handleMobileMenuSelect(key: string) {
  switch (key) {
    case 'toggle-covers':
      showCovers.value = !showCovers.value
      break
    case 'mode-aggregated':
      searchMode.value = 'aggregated'
      break
    case 'mode-grouped':
      searchMode.value = 'grouped'
      break
  }
}

interface SourceSearchState {
  loading: boolean
  results: BookItem[]
  error: string
}
const searchStates = reactive<Record<string, SourceSearchState>>({})

/** 聚合模式下的扁平结果列表（带书源标记） */
const aggregatedTaggedResults = computed<TaggedBookItem[]>(() => {
  const items: TaggedBookItem[] = []
  for (const src of activeSources.value) {
    const state = searchStates[src.fileName]
    if (!state) continue
    for (const book of state.results) {
      items.push({
        book,
        fileName: src.fileName,
        sourceName: src.name,
        sourceLogo: src.logo,
      })
    }
  }
  return items
})

/** 聚合模式下是否仍有书源在搜索中 */
const aggregatedLoading = computed(() =>
  activeSources.value.some(s => searchStates[s.fileName]?.loading)
)

/** 是否已触发过搜索 */
const hasSearched = computed(() => Object.keys(searchStates).length > 0)

/** 已完成（不再 loading）的书源数 */
const completedSourceCount = computed(() =>
  activeSources.value.filter(s => searchStates[s.fileName] && !searchStates[s.fileName].loading).length
)

/** 目前累计原始结果条数（搜索中实时更新） */
const totalRawResultCount = computed(() =>
  activeSources.value.reduce((sum, s) => sum + (searchStates[s.fileName]?.results.length ?? 0), 0)
)

/** 有搜索结果的书源数 */
const sourcesWithResultCount = computed(() =>
  activeSources.value.filter(s => (searchStates[s.fileName]?.results.length ?? 0) > 0).length
)

async function doSearch() {
  const kw = searchKeyword.value.trim()
  if (!kw) { message.warning('请输入搜索关键词'); return }
  if (!activeSources.value.length) { message.warning('没有可用的搜索书源'); return }

  searchRunning.value = true

  for (const src of activeSources.value) {
    searchStates[src.fileName] = { loading: true, results: [], error: '' }
  }

  for (const src of activeSources.value) {
    try {
      const raw = await runSearch(src.fileName, kw)
      searchStates[src.fileName].results = Array.isArray(raw) ? (raw as BookItem[]) : []
    } catch (e: unknown) {
      searchStates[src.fileName].error = e instanceof Error ? e.message : String(e)
    } finally {
      searchStates[src.fileName].loading = false
    }
  }

  searchRunning.value = false
}

// ── 书籍详情 ─────────────────────────────────────────────────────────────
const showDrawer = ref(false)
const drawerBookUrl = ref('')
const drawerFileName = ref('')

function openDetail(book: BookItem, fileName: string) {
  drawerBookUrl.value = book.bookUrl
  drawerFileName.value = fileName
  showDrawer.value = true
}

const drawerSourceName = computed(() => {
  const src = sources.value.find(s => s.fileName === drawerFileName.value)
  return src?.name ?? drawerFileName.value
})

const drawerSourceType = computed(() => {
  const src = sources.value.find(s => s.fileName === drawerFileName.value)
  return src?.sourceType ?? 'novel'
})

// ── 章节阅读 ─────────────────────────────────────────────────────────────
const showReader = ref(false)
const readerChapterUrl = ref('')
const readerChapterName = ref('')
const readerFileName = ref('')
const readerChapters = ref<ChapterItem[]>([])
const readerCurrentIndex = ref(0)
const readerBookInfo = ref<ReaderBookInfo | undefined>()
const readerSourceType = ref('novel')
const readerShelfId = ref('')
const chapterListTaskId = ref<string | null>(null)
const { getShelfId, ensureLoaded: ensureShelfLoaded, isPrivateShelfBook } = useBookshelf()
const { privacyExitTick } = usePrivacyMode()

async function onReadChapter(payload: { chapterUrl: string; chapterName: string; index: number; bookInfo: ReaderBookInfo; sourceType: string }) {
  readerChapterUrl.value = payload.chapterUrl
  readerChapterName.value = payload.chapterName
  readerFileName.value = drawerFileName.value
  readerCurrentIndex.value = payload.index
  readerBookInfo.value = payload.bookInfo
  readerSourceType.value = payload.sourceType

  // 查找书架 ID，用于保存阅读进度
  try {
    await ensureShelfLoaded()
    readerShelfId.value = getShelfId(drawerBookUrl.value, drawerFileName.value) ?? ''
  } catch {
    readerShelfId.value = ''
  }

  if (!readerChapters.value.length) {
    const taskId = crypto.randomUUID()
    chapterListTaskId.value = taskId
    try {
      const raw = await runChapterList(drawerFileName.value, drawerBookUrl.value, taskId)
      readerChapters.value = Array.isArray(raw) ? (raw as ChapterItem[]) : []
    } catch {
      // 加载失败不阻塞阅读
    } finally {
      chapterListTaskId.value = null
    }
  }

  showReader.value = true
}

function onReaderClose() {
  if (chapterListTaskId.value) {
    cancelTask(chapterListTaskId.value)
    chapterListTaskId.value = null
  }
}

watch(readerCurrentIndex, (idx) => {
  if (idx >= 0 && idx < readerChapters.value.length) {
    const ch = readerChapters.value[idx]
    readerChapterUrl.value = ch.url
    readerChapterName.value = ch.name
  }
})

watch(privacyExitTick, () => {
  if (!showReader.value || !readerShelfId.value) return
  if (!isPrivateShelfBook(readerShelfId.value)) return
  showReader.value = false
})

watch(showReader, (visible) => { if (!visible) onReaderClose() })
watch(showDrawer, (visible) => { if (!visible) onReaderClose() })

// ── 生命周期 ─────────────────────────────────────────────────────────────
const unlisteners: UnlistenFn[] = []

onMounted(async () => {
  await loadSources()
  unlisteners.push(await listen<{ fileName: string }>('booksource:changed', (event) => {
    const changed = event.payload?.fileName
    if (changed) delete sourceFns[changed]
    loadSources()
  }))
  unlisteners.push(await listen<{ scope: string; fileName?: string }>('app:booksource-reload', (event) => {
    if (event.payload.scope === 'all') {
      Object.keys(sourceFns).forEach(k => delete sourceFns[k])
    } else if (event.payload.scope === 'single' && event.payload.fileName) {
      delete sourceFns[event.payload.fileName]
    }
    loadSources()
  }))
})

onUnmounted(() => {
  unlisteners.forEach(fn => fn())
})
</script>

<template>
  <div class="search-view">
    <!-- 顶部 -->
    <div class="sv-header">
      <h1 class="sv-header__title">搜索</h1>
      <span class="sv-header__sub">
        <template v-if="!hasSearched">
          {{ activeSources.length }} 个搜索源{{ limitedSource ? `（仅限：${limitedSourceName}）` : '' }}
        </template>
        <template v-else-if="aggregatedLoading">
          搜索中…&nbsp;已获得
          <span class="sv-header__count">{{ totalRawResultCount }}</span>
          条结果（{{ completedSourceCount }}/{{ activeSources.length }} 书源完成）
        </template>
        <template v-else-if="totalRawResultCount === 0">
          未找到结果 · {{ activeSources.length }} 个书源已搜索
        </template>
        <template v-else>
          找到
          <span class="sv-header__count">{{ totalRawResultCount }}</span>
          条结果 · {{ sourcesWithResultCount }} / {{ activeSources.length }} 个书源有结果
        </template>
      </span>
      <div class="sv-header__actions">
        <MobileToolbarMenu :options="mobileMenuOptions" @select="handleMobileMenuSelect">
          <n-tooltip trigger="hover">
            <template #trigger>
              <n-button size="small" quaternary @click="showCovers = !showCovers">
                <template #icon>
                  <svg v-if="showCovers" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="1" y1="1" x2="23" y2="23" />
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  </svg>
                </template>
              </n-button>
            </template>
            {{ showCovers ? '隐藏封面图片' : '显示封面图片' }}
          </n-tooltip>

          <!-- 视图模式切换 -->
          <n-button-group size="small" class="sv-header__mode">
            <n-tooltip trigger="hover">
              <template #trigger>
                <n-button :type="searchMode === 'aggregated' ? 'primary' : 'default'"
                  @click="searchMode = 'aggregated'">
                  <template #icon>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" />
                    </svg>
                  </template>
                </n-button>
              </template>
              聚合模式：按相似度排序，同名书堆叠显示
            </n-tooltip>
            <n-tooltip trigger="hover">
              <template #trigger>
                <n-button :type="searchMode === 'grouped' ? 'primary' : 'default'" @click="searchMode = 'grouped'">
                  <template #icon>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="8" y1="6" x2="21" y2="6" />
                      <line x1="8" y1="12" x2="21" y2="12" />
                      <line x1="8" y1="18" x2="21" y2="18" />
                      <line x1="3" y1="6" x2="3.01" y2="6" />
                      <line x1="3" y1="12" x2="3.01" y2="12" />
                      <line x1="3" y1="18" x2="3.01" y2="18" />
                    </svg>
                  </template>
                </n-button>
              </template>
              分组模式：按书源分组展示
            </n-tooltip>
          </n-button-group>


        </MobileToolbarMenu>
      </div>
    </div>

    <div class="sv-toolbar">
      <n-input v-model:value="searchKeyword" placeholder="输入书名或作者..." size="small" clearable class="sv-toolbar__input"
        @keydown.enter="doSearch">
        <template #prefix>
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </template>
      </n-input>
      <n-button type="primary" size="small" :loading="searchRunning" @click="doSearch">
        搜索
      </n-button>

      <!-- 单书源限制标签 -->
      <n-tag v-if="limitedSource" closable size="small" type="info" class="sv-toolbar__limit-tag"
        @close="clearSourceLimit">
        {{ limitedSourceName }}
      </n-tag>
    </div>

    <!-- 搜索结果 -->
    <div class="sv-content">
      <div class="sv-scroll">
        <!-- 聚合模式 -->
        <template v-if="searchMode === 'aggregated'">
          <AggregatedSearchResults v-if="Object.keys(searchStates).length" :keyword="searchKeyword"
            :results="aggregatedTaggedResults" :show-covers="showCovers" :loading="aggregatedLoading"
            @select="openDetail" />
          <n-empty v-else description="输入关键词后点击搜索，将聚合所有书源结果" style="padding: 64px 0" />
        </template>
        <!-- 分组模式 -->
        <template v-else>
          <template v-if="Object.keys(searchStates).length">
            <SourceSearchGroup v-for="src in activeSources" :key="src.fileName" :source="src"
              :results="searchStates[src.fileName]?.results ?? []"
              :loading="searchStates[src.fileName]?.loading ?? false" :error="searchStates[src.fileName]?.error ?? ''"
              :show-covers="showCovers" @select="openDetail" />
          </template>
          <n-empty v-else description="输入关键词后点击搜索，将聚合所有书源结果" style="padding: 64px 0" />
        </template>
      </div>
    </div>

    <!-- 书籍详情抽屉 -->
    <BookDetailDrawer v-model:show="showDrawer" :book-url="drawerBookUrl" :file-name="drawerFileName"
      :source-name="drawerSourceName" :source-type="drawerSourceType" :suspend-close-shortcuts="showReader"
      @read-chapter="onReadChapter" />

    <!-- 章节阅读器 -->
    <ChapterReaderModal v-model:show="showReader" v-model:current-index="readerCurrentIndex"
      :chapter-url="readerChapterUrl" :chapter-name="readerChapterName" :file-name="readerFileName"
      :chapters="readerChapters" :shelf-book-id="readerShelfId" :book-info="readerBookInfo"
      :source-type="readerSourceType" />
  </div>
</template>

<style scoped>
.search-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--color-surface);
}

.sv-header {
  flex-shrink: 0;
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 24px 24px 12px;
  flex-wrap: wrap;
}

.sv-header__title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
}

.sv-header__sub {
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
}

.sv-header__count {
  font-weight: 700;
  color: var(--color-accent);
}

.sv-header__actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
}

.sv-header__mode {
  flex-shrink: 0;
}

.sv-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 24px 8px;
  flex-wrap: wrap;
}

.sv-toolbar__input {
  flex: 1;
  max-width: 400px;
}

.sv-toolbar__limit-tag {
  flex-shrink: 0;
}

.sv-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0 24px;
}

.sv-scroll {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-right: 4px;
  padding-bottom: 16px;
}

.sv-scroll::-webkit-scrollbar {
  width: 5px;
}

.sv-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.sv-scroll::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 3px;
}

/* ── 移动端适配 ─────────────────────────── */
@media (pointer: coarse),
(max-width: 640px) {
  .sv-header {
    padding: 16px 16px 8px;
  }

  .sv-toolbar {
    padding: 0 16px 8px;
  }

  .sv-toolbar__input {
    max-width: 100%;
  }

  .sv-content {
    padding: 0 16px;
  }
}
</style>
