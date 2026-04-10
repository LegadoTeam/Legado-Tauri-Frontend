<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useMessage } from 'naive-ui'
import type { ShelfBook } from '../composables/useBookshelf'
import { useBookshelf } from '../composables/useBookshelf'
import type { ChapterItem } from '../composables/useScriptBridge'
import { useScriptBridge } from '../composables/useScriptBridge'
import { usePrivacyMode } from '../composables/usePrivacyMode'
import ShelfBookCard from '../components/bookshelf/ShelfBookCard.vue'
import ChapterReaderModal from '../components/explore/ChapterReaderModal.vue'
import MobileToolbarMenu from '../components/layout/MobileToolbarMenu.vue'
import type { ReaderBookInfo } from '../components/reader/types'

const message = useMessage()
const {
  books, loadBooks, removeFromShelf,
  getChapters, saveChapters, setBookPrivate, isPrivateShelfBook,
} = useBookshelf()
const { runChapterList } = useScriptBridge()
const { privacyModeEnabled, togglePrivacyMode, privacyExitTick, privacyExitReason } = usePrivacyMode()

const loading = ref(false)
const searchKw = ref('')

const visibleBooks = computed(() =>
  privacyModeEnabled.value ? books.value : books.value.filter((book) => !book.isPrivate)
)

const privateBookCount = computed(() => books.value.filter((book) => book.isPrivate).length)
const hiddenPrivateCount = computed(() =>
  privacyModeEnabled.value ? 0 : books.value.filter((book) => book.isPrivate).length
)

const filteredBooks = computed(() => {
  const kw = searchKw.value.trim().toLowerCase()
  if (!kw) return visibleBooks.value
  return visibleBooks.value.filter(
    b => b.name.toLowerCase().includes(kw) || b.author.toLowerCase().includes(kw),
  )
})

// ── 右键菜单 ──────────────────────────────────────────────────────────────
const showDropdown = ref(false)
const dropdownX = ref(0)
const dropdownY = ref(0)
const contextBook = ref<ShelfBook | null>(null)

const menuOptions = computed(() => {
  const book = contextBook.value
  return [
    { label: book?.isPrivate ? '取消隐私标记' : '标记为隐私', key: 'toggle-private' },
    { label: '移出书架', key: 'remove' },
  ]
})

function onContextMenu(book: ShelfBook, event: MouseEvent) {
  contextBook.value = book
  dropdownX.value = event.clientX
  dropdownY.value = event.clientY
  showDropdown.value = true
}

async function onMenuSelect(key: string) {
  showDropdown.value = false
  if (key === 'toggle-private' && contextBook.value) {
    await handleTogglePrivate(contextBook.value)
  }
  if (key === 'remove' && contextBook.value) {
    try {
      await removeFromShelf(contextBook.value.id)
      message.success('已移出书架')
    } catch (e: unknown) {
      message.error(`移出失败: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
}

async function handleTogglePrivate(book: ShelfBook) {
  try {
    await setBookPrivate(book.id, !book.isPrivate)
    message.success(book.isPrivate ? '已取消隐私标记' : '已标记为隐私书籍')
    if (!privacyModeEnabled.value && !book.isPrivate && readerShelfId.value === book.id) {
      showReader.value = false
    }
  } catch (e: unknown) {
    message.error(`设置失败: ${e instanceof Error ? e.message : String(e)}`)
  }
}

// ── 阅读器 ────────────────────────────────────────────────────────────────
const showReader = ref(false)
const readerFileName = ref('')
const readerChapterUrl = ref('')
const readerChapterName = ref('')
const readerChapters = ref<ChapterItem[]>([])
const readerCurrentIndex = ref(0)
const readerShelfId = ref('')
const readerBookInfo = ref<ReaderBookInfo | undefined>()
const readerSourceType = ref('novel')
const refreshingToc = ref(false)

async function refreshToc() {
  if (refreshingToc.value) return
  const bookUrl = readerBookInfo.value?.bookUrl
  const fileName = readerFileName.value
  if (!bookUrl || !fileName || !readerShelfId.value) {
    message.warning('无法获取书籍地址，请先确保书籍已加入书架')
    return
  }
  refreshingToc.value = true
  try {
    const raw = await runChapterList(fileName, bookUrl)
    const fetched = (raw as Array<{ name: string; url: string }>).map((c, i) => ({
      index: i,
      name: c.name,
      url: c.url,
    }))
    const oldUrls = new Set(readerChapters.value.map(c => c.url))
    const newCount = fetched.filter(c => !oldUrls.has(c.url)).length
    // 更新内存列表
    readerChapters.value = fetched.map(c => ({ name: c.name, url: c.url }))
    // 持久化到书架
    await saveChapters(readerShelfId.value, fetched)
    if (newCount > 0) {
      message.success(`目录已更新，新增 ${newCount} 章`)
    } else {
      message.info('目录已是最新，无新章节')
    }
  } catch (e: unknown) {
    message.error(`更新目录失败：${e instanceof Error ? e.message : String(e)}`)
  } finally {
    refreshingToc.value = false
  }
}

async function openBook(book: ShelfBook) {
  if (book.isPrivate && !privacyModeEnabled.value) {
    message.warning('该书已标记为隐私，请先开启隐私模式')
    return
  }
  readerShelfId.value = book.id
  readerFileName.value = book.fileName
  readerSourceType.value = book.sourceType ?? 'novel'
  readerBookInfo.value = {
    name: book.name,
    author: book.author,
    coverUrl: book.coverUrl,
    intro: book.intro,
    kind: book.kind,
    bookUrl: book.bookUrl,
    sourceName: book.sourceName,
    fileName: book.fileName,
    lastChapter: book.lastChapter,
    totalChapters: book.totalChapters,
    addedAt: book.addedAt,
    lastReadAt: book.lastReadAt,
  }

  // 加载缓存的章节目录
  try {
    const cached = await getChapters(book.id)
    readerChapters.value = cached.map(c => ({ name: c.name, url: c.url }))
  } catch {
    readerChapters.value = []
  }

  if (!readerChapters.value.length) {
    message.warning('该书籍未缓存章节目录，请从发现页重新打开')
    return
  }

  // 续读或从头
  const idx = book.readChapterIndex >= 0 ? book.readChapterIndex : 0
  readerCurrentIndex.value = Math.min(idx, readerChapters.value.length - 1)
  const ch = readerChapters.value[readerCurrentIndex.value]
  readerChapterUrl.value = ch.url
  readerChapterName.value = ch.name

  showReader.value = true
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
  message.info(privacyExitReason.value === 'manual' ? '已退出隐私模式，隐私书籍阅读已关闭' : '隐私模式已自动退出，隐私书籍阅读已关闭')
})

const toolbarMenuOptions = computed(() => [
  {
    label: privacyModeEnabled.value ? '退出隐私模式' : '开启隐私模式',
    key: 'toggle-privacy',
  },
])

function handleToolbarMenuSelect(key: string) {
  if (key === 'toggle-privacy') {
    togglePrivacyMode()
  }
}

// ── 生命周期 ──────────────────────────────────────────────────────────────
onMounted(async () => {
  loading.value = true
  try {
    await loadBooks()
  } catch (e: unknown) {
    message.error(`加载书架失败: ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="bookshelf-view" :class="{ 'bookshelf-view--privacy': privacyModeEnabled }">
    <!-- 顶部 -->
    <div class="bs-header">
      <div class="bs-header__main">
        <h1 class="bs-header__title">书架</h1>
        <p class="bs-header__sub">
          {{ visibleBooks.length }} 本可见书籍
          <template v-if="hiddenPrivateCount"> · 已隐藏 {{ hiddenPrivateCount }} 本隐私书籍</template>
          <template v-else-if="privateBookCount"> · 含 {{ privateBookCount }} 本隐私书籍</template>
        </p>
      </div>
      <div class="bs-header__actions">
        <MobileToolbarMenu :options="toolbarMenuOptions" @select="handleToolbarMenuSelect">
          <n-tooltip trigger="hover">
            <template #trigger>
              <n-button
                size="small"
                :type="privacyModeEnabled ? 'primary' : 'default'"
                :secondary="!privacyModeEnabled"
                @click="togglePrivacyMode"
              >
                {{ privacyModeEnabled ? '退出隐私模式' : '开启隐私模式' }}
              </n-button>
            </template>
            {{ privacyModeEnabled ? '切换到普通书架视图' : '显示已标记为隐私的书籍' }}
          </n-tooltip>
        </MobileToolbarMenu>
      </div>
    </div>

    <!-- 工具栏 -->
    <div class="bs-toolbar" v-if="books.length">
      <n-input
        v-model:value="searchKw"
        placeholder="搜索书架..."
        size="small"
        clearable
        style="max-width: 280px"
      >
        <template #prefix>
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </template>
      </n-input>
      <div v-if="privacyModeEnabled" class="bs-privacy-pill">
        隐私模式已开启
      </div>
      <div v-else-if="hiddenPrivateCount" class="bs-privacy-pill bs-privacy-pill--muted">
        隐私书籍默认隐藏
      </div>
    </div>

    <!-- 内容区 -->
    <div class="bs-content">
      <n-spin :show="loading" style="flex:1">
        <!-- 空状态 -->
        <div v-if="!loading && !books.length" class="bs-empty">
          <div class="bs-empty__icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
          </div>
          <h3 class="bs-empty__title">书架空空如也</h3>
          <p class="bs-empty__desc">去发现页搜索书籍，加入书架开始阅读吧</p>
        </div>

        <!-- 书籍网格 -->
        <div v-else-if="!filteredBooks.length && visibleBooks.length" class="bs-empty bs-empty--compact">
          <h3 class="bs-empty__title">没有匹配的书籍</h3>
          <p class="bs-empty__desc">换个关键词试试</p>
        </div>

        <div v-else-if="!visibleBooks.length && hiddenPrivateCount" class="bs-empty bs-empty--compact">
          <h3 class="bs-empty__title">隐私书籍已隐藏</h3>
          <p class="bs-empty__desc">开启隐私模式后才会显示这些书籍</p>
        </div>

        <div v-else class="bs-grid">
          <ShelfBookCard
            v-for="book in filteredBooks"
            :key="book.id"
            :book="book"
            :privacy-mode-enabled="privacyModeEnabled"
            @select="openBook"
            @contextmenu="onContextMenu"
            @toggle-private="handleTogglePrivate"
          />
        </div>
      </n-spin>
    </div>

    <!-- 右键菜单 -->
    <n-dropdown
      :show="showDropdown"
      :x="dropdownX"
      :y="dropdownY"
      :options="menuOptions"
      placement="bottom-start"
      trigger="manual"
      @clickoutside="showDropdown = false"
      @select="onMenuSelect"
    />

    <!-- 阅读器 -->
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
      @refresh-toc="refreshToc"
    />
  </div>
</template>

<style scoped>
.bookshelf-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--color-surface);
}

.bs-header {
  flex-shrink: 0;
  padding: 24px 24px 8px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.bs-header__main {
  min-width: 0;
}

.bs-header__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.bs-header__title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 2px;
}
.bs-header__sub {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  margin: 0;
}

.bs-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 4px 24px 8px;
}

.bs-privacy-pill {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-accent) 16%, transparent);
  color: var(--color-accent);
  font-size: 0.75rem;
  font-weight: 700;
}

.bs-privacy-pill--muted {
  background: var(--color-surface-hover);
  color: var(--color-text-secondary);
}

.bs-content {
  flex: 1;
  overflow-y: auto;
  padding: 0 24px 16px;
}
.bs-content::-webkit-scrollbar { width: 5px; }
.bs-content::-webkit-scrollbar-track { background: transparent; }
.bs-content::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 3px;
}

.bs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
  padding-top: 4px;
}

.bs-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  gap: 8px;
}
.bs-empty__icon {
  opacity: 0.25;
  color: var(--color-text-muted);
}
.bs-empty__title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin: 0;
}
.bs-empty__desc {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  margin: 0;
}

.bs-empty--compact {
  padding: 48px 0;
}

.bookshelf-view--privacy .bs-content {
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--color-accent) 8%, transparent), transparent 120px);
}

/* ── 移动端适配 ─────────────────────────── */
@media (pointer: coarse), (max-width: 640px) {
  .bs-header {
    padding: 16px 16px 6px;
    flex-direction: column;
  }
  .bs-toolbar { padding: 4px 16px 8px; }
  .bs-content { padding: 0 16px 16px; }
  .bs-grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 8px;
  }
}
</style>
