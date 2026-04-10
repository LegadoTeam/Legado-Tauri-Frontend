<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { useMessage } from 'naive-ui'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { SearchOutline, ReloadOutline, ReorderFourOutline } from '@vicons/ionicons5'
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
import { navigateToSearch } from '../composables/useNavigation'
import { isExploreUserEnabled } from '../composables/useSourceCapabilities'
import { useBookshelf } from '../composables/useBookshelf'
import { usePrivacyMode } from '../composables/usePrivacyMode'
import MobileToolbarMenu from '../components/layout/MobileToolbarMenu.vue'
import SourceExploreSection from '../components/explore/SourceExploreSection.vue'
import BookDetailDrawer from '../components/explore/BookDetailDrawer.vue'
import ChapterReaderModal from '../components/explore/ChapterReaderModal.vue'
import type { ReaderBookInfo } from '../components/reader/types'

const message = useMessage()
const { runChapterList, cancelTask } = useScriptBridge()

// ── 书源列表 & 能力检测 ──────────────────────────────────────────────────
const sources = ref<BookSourceMeta[]>([])
const sourceFns = reactive<Record<string, Set<string>>>({})
const explorableSources = ref<BookSourceMeta[]>([])

/** 当前选中的书源 tab（fileName） */
const activeSourceTab = ref('')

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
    explorableSources.value = enabled.filter(s => sourceFns[s.fileName]?.has('explore'))
    // 默认选中第一个
    if (!activeSourceTab.value && explorableSources.value.length) {
      activeSourceTab.value = explorableSources.value[0].fileName
    }
  } catch (e: unknown) {
    message.error(`加载书源列表失败: ${e instanceof Error ? e.message : String(e)}`)
  }
}

// ── Tab 排序（localStorage 持久化） ─────────────────────────────────────
const LS_ORDER_KEY = 'explore-tab-order'

function loadTabOrder(): string[] {
  try {
    const raw = localStorage.getItem(LS_ORDER_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

const tabOrder = ref<string[]>(loadTabOrder())

/** 按 tabOrder 对书源排序，同时过滤用户禁用的发现源 */
const sortedSources = computed<BookSourceMeta[]>(() => {
  const order = tabOrder.value
  const all = explorableSources.value.filter(s => isExploreUserEnabled(s.fileName))
  if (!order.length) return all
  const inOrder = order
    .map(fn => all.find(s => s.fileName === fn))
    .filter((s): s is BookSourceMeta => !!s)
  const rest = all.filter(s => !order.includes(s.fileName))
  return [...inOrder, ...rest]
})

function saveTabOrder(order: string[]) {
  tabOrder.value = order
  localStorage.setItem(LS_ORDER_KEY, JSON.stringify(order))
}

// ── 排序弹窗 ────────────────────────────────────────────────────────────
const showSortModal = ref(false)
const sortList = ref<BookSourceMeta[]>([])

function openSortModal() {
  sortList.value = [...sortedSources.value]
  showSortModal.value = true
}

function confirmSort() {
  saveTabOrder(sortList.value.map(s => s.fileName))
  showSortModal.value = false
}

// ── 排序列表拖拽（Pointer Events，避免 Tauri/WebView2 DnD 问题） ─────────
const sortListEl = ref<HTMLElement | null>(null)
const ptrFrom = ref(-1)
const ptrOver = ref(-1)

function startSortDrag(e: PointerEvent, idx: number) {
  e.preventDefault()
  ptrFrom.value = idx
  ptrOver.value = idx

  function onMove(ev: PointerEvent) {
    if (!sortListEl.value) return
    const items = sortListEl.value.querySelectorAll<HTMLElement>('[data-sidx]')
    for (const item of items) {
      const r = item.getBoundingClientRect()
      if (ev.clientY >= r.top && ev.clientY <= r.bottom) {
        ptrOver.value = Number(item.dataset.sidx)
        break
      }
    }
  }

  function onUp() {
    window.removeEventListener('pointermove', onMove)
    const from = ptrFrom.value
    const to = ptrOver.value
    ptrFrom.value = -1
    ptrOver.value = -1
    if (from >= 0 && to >= 0 && from !== to) {
      const arr = [...sortList.value]
      const [moved] = arr.splice(from, 1)
      arr.splice(to, 0, moved)
      sortList.value = arr
    }
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp, { once: true })
}

// ── 当前书源元信息 ───────────────────────────────────────────────────────
const currentSource = computed<BookSourceMeta | undefined>(() =>
  explorableSources.value.find(s => s.fileName === activeSourceTab.value)
)

// ── 刷新（触发当前书源 Section 刷新） ───────────────────────────────────
const refreshTrigger = ref(0)
const refreshing = ref(false)

async function handleRefresh() {
  refreshing.value = true
  try {
    // 通过递增 trigger 通知 SourceExploreSection 执行刷新
    refreshTrigger.value++
  } finally {
    // refreshing 由 SourceExploreSection 回调重置
    setTimeout(() => { refreshing.value = false }, 600)
  }
}

function onSectionRefreshing(val: boolean) {
  refreshing.value = val
}

// ── 卡片尺寸配置（localStorage 持久化） ─────────────────────────────────
interface CardSizeConfig {
  key: string
  label: string
  colMin: string
  coverW: string
  coverH: string
}

const CARD_SIZES: CardSizeConfig[] = [
  { key: 'xs',  label: '极小', colMin: '130px', coverW: '32px', coverH: '44px' },
  { key: 's',   label: '小',   colMin: '170px', coverW: '36px', coverH: '48px' },
  { key: 'm',   label: '中',   colMin: '210px', coverW: '42px', coverH: '56px' },
  { key: 'l',   label: '大',   colMin: '270px', coverW: '52px', coverH: '70px' },
  { key: 'xl',  label: '特大', colMin: '340px', coverW: '64px', coverH: '86px' },
  { key: 'xxl', label: '超大', colMin: '440px', coverW: '80px', coverH: '108px' },
]
const LS_SIZE_KEY = 'explore-card-size'
const savedSizeKey = localStorage.getItem(LS_SIZE_KEY) ?? 'm'
const activeSizeKey = ref(savedSizeKey)
const activeSize = computed(() => CARD_SIZES.find(s => s.key === activeSizeKey.value) ?? CARD_SIZES[2])

function setSize(key: string) {
  activeSizeKey.value = key
  localStorage.setItem(LS_SIZE_KEY, key)
}

// 探索视图CSS变量
const explorerStyle = computed(() => ({
  '--explore-col-min': activeSize.value.colMin,
  '--explore-cover-w': activeSize.value.coverW,
  '--explore-cover-h': activeSize.value.coverH,
}))

// 封面显示开关
const showCovers = ref(true)

// ── 移动端三点菜单 ──────────────────────────────────────────────────────
const exploreMobileMenuOptions = computed(() => [
  {
    label: showCovers.value ? '隐藏封面' : '显示封面',
    key: 'toggle-covers',
  },
  ...CARD_SIZES.map(s => ({
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
])

function handleExploreMobileMenuSelect(key: string) {
  if (key === 'toggle-covers') {
    showCovers.value = !showCovers.value
  } else if (key.startsWith('size-')) {
    setSize(key.slice(5))
  } else if (key === 'sort') {
    openSortModal()
  } else if (key === 'refresh') {
    handleRefresh()
  }
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

function openDetailByUrl(bookUrl: string, fileName: string) {
  drawerBookUrl.value = bookUrl
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
watch(showReader, (v) => { if (!v) onReaderClose() })
watch(showDrawer, (v) => { if (!v) onReaderClose() })

// ── 生命周期 ─────────────────────────────────────────────────────────────
const unlisteners: UnlistenFn[] = []

onMounted(async () => {
  await loadSources()
  if (evTabsRef.value) {
    cleanupWheelScroll = setupTabsWheelScroll(evTabsRef.value)
  }
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
  cleanupWheelScroll?.()
  unlisteners.forEach(fn => fn())
})

// ── 滑动手势切换书源 Tab ─────────────────────────────────────────────────

let _swStartX = 0
let _swStartY = 0

function onSwipeStart(e: PointerEvent) {
  _swStartX = e.clientX
  _swStartY = e.clientY
}

function onSwipeEnd(e: PointerEvent) {
  const dx = e.clientX - _swStartX
  const dy = e.clientY - _swStartY
  if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return
  const list = sortedSources.value
  if (list.length < 2) return
  const idx = list.findIndex(s => s.fileName === activeSourceTab.value)
  if (idx < 0) return
  if (dx < 0 && idx < list.length - 1) {
    activeSourceTab.value = list[idx + 1].fileName
  } else if (dx > 0 && idx > 0) {
    activeSourceTab.value = list[idx - 1].fileName
  }
}

// ── 鼠标滚轮横向滚动 tabs 导航栏（PC）──────────────────────────────────
const evTabsRef = ref<HTMLElement | null>(null)

function setupTabsWheelScroll(el: HTMLElement): (() => void) | undefined {
  // Naive UI 渲染时机不确定，用 MutationObserver 等待目标元素出现
  let cleanup: (() => void) | undefined
  let found = false

  function attach(wrapper: HTMLElement) {
    function onWheel(e: WheelEvent) {
      // 有水平滚动量时直接滚动，否则把垂直量映射到水平
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      if (delta === 0) return
      e.preventDefault()
      wrapper.scrollLeft += delta
    }
    wrapper.addEventListener('wheel', onWheel, { passive: false })
    cleanup = () => wrapper.removeEventListener('wheel', onWheel)
  }

  const candidate = el.querySelector<HTMLElement>('.n-tabs-nav-scroll-wrapper')
  if (candidate) {
    found = true
    attach(candidate)
  } else {
    const observer = new MutationObserver(() => {
      const w = el.querySelector<HTMLElement>('.n-tabs-nav-scroll-wrapper')
      if (w) {
        found = true
        observer.disconnect()
        attach(w)
      }
    })
    observer.observe(el, { childList: true, subtree: true })
    // 安全兜底：5s 后断开
    setTimeout(() => { if (!found) observer.disconnect() }, 5000)
    return () => { observer.disconnect(); cleanup?.() }
  }

  return () => cleanup?.()
}

let cleanupWheelScroll: (() => void) | undefined
</script>

<template>
  <div class="explore-view" :style="explorerStyle">
    <!-- 顶部 -->
    <div class="ev-header">
      <h1 class="ev-header__title">发现</h1>
      <span class="ev-header__sub">{{ explorableSources.length }} 个发现源</span>
      <div class="ev-header__actions">
        <MobileToolbarMenu :options="exploreMobileMenuOptions" @select="handleExploreMobileMenuSelect">
          <!-- 封面开关 -->
          <n-tooltip trigger="hover">
            <template #trigger>
              <n-button
                size="small"
                quaternary
                @click="showCovers = !showCovers"
              >
                <template #icon>
                  <svg v-if="showCovers" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
                </template>
              </n-button>
            </template>
            {{ showCovers ? '隐藏封面' : '显示封面' }}
          </n-tooltip>

          <!-- 卡片尺寸选择 -->
          <n-dropdown
            trigger="click"
            :options="CARD_SIZES.map(s => ({ label: s.label, key: s.key }))"
            :value="activeSizeKey"
            @select="setSize"
          >
            <n-tooltip trigger="hover">
              <template #trigger>
                <n-button size="small" quaternary>
                  <template #icon>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 3H3v7h18V3z"/><path d="M21 14H3v7h18v-7z"/><path d="M12 3v18"/></svg>
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
                  <n-icon><ReorderFourOutline /></n-icon>
                </template>
              </n-button>
            </template>
            书源排序
          </n-tooltip>

          <!-- 刷新按钮 -->
          <n-tooltip trigger="hover">
            <template #trigger>
              <n-button
                size="small"
                quaternary
                :loading="refreshing"
                @click="handleRefresh"
              >
                <template #icon>
                  <n-icon><ReloadOutline /></n-icon>
                </template>
              </n-button>
            </template>
            刷新当前书源
          </n-tooltip>
        </MobileToolbarMenu>
      </div>
    </div>

    <!-- 书源排序弹窗 -->
    <n-modal
      v-model:show="showSortModal"
      preset="card"
      title="书源排序"
      class="ev-sort-modal"
      :style="{ width: '340px', maxWidth: '95vw' }"
      :mask-closable="true"
    >
      <div ref="sortListEl" class="ev-sort-list">
        <div
          v-for="(src, idx) in sortList"
          :key="src.fileName"
          :data-sidx="idx"
          class="ev-sort-item"
          :class="{
            'ev-sort-item--dragging': ptrFrom === idx,
            'ev-sort-item--drag-over': ptrOver === idx && ptrFrom !== idx,
          }"
        >
          <span
            class="ev-sort-item__handle"
            @pointerdown="startSortDrag($event, idx)"
          >
            <n-icon size="16"><ReorderFourOutline /></n-icon>
          </span>
          <span class="ev-sort-item__name">{{ src.name }}</span>
        </div>
      </div>
      <template #footer>
        <div style="display:flex; justify-content:flex-end; gap:8px">
          <n-button size="small" @click="showSortModal = false">取消</n-button>
          <n-button size="small" type="primary" @click="confirmSort">确定</n-button>
        </div>
      </template>
    </n-modal>

    <!-- 按书源分 Tab -->
    <template v-if="sortedSources.length">
      <div ref="evTabsRef" class="ev-tabs-wrap">
      <n-tabs
        v-model:value="activeSourceTab"
        type="line"
        animated
        class="ev-tabs"
      >
        <n-tab-pane
          v-for="src in sortedSources"
          :key="src.fileName"
          :name="src.fileName"
          :tab="src.name"
        >
          <!-- 副标题行 -->
          <div v-if="currentSource?.description" class="ev-subtitle">
            <span class="ev-subtitle__text">{{ currentSource.description }}</span>
            <n-button
              text
              size="tiny"
              class="ev-subtitle__search-btn"
              @click="navigateToSearch(activeSourceTab)"
            >
              <template #icon><n-icon><SearchOutline /></n-icon></template>
              使用此书源搜索
            </n-button>
          </div>
          <div v-else class="ev-subtitle ev-subtitle--empty">
            <n-button
              text
              size="tiny"
              class="ev-subtitle__search-btn"
              @click="navigateToSearch(activeSourceTab)"
            >
              <template #icon><n-icon><SearchOutline /></n-icon></template>
              使用此书源搜索
            </n-button>
          </div>

          <!-- 内容区直接渲染，无额外容器 -->
          <div
            class="ev-content"
            @pointerdown="onSwipeStart"
            @pointerup="onSwipeEnd"
          >
            <SourceExploreSection
              :source="src"
              :show-covers="showCovers"
              :refresh-trigger="refreshTrigger"
              @select="openDetail"
              @open-book="(url: string) => openDetailByUrl(url, src.fileName)"
              @refreshing="onSectionRefreshing"
            />
          </div>
        </n-tab-pane>
      </n-tabs>
      </div>
    </template>
    <n-empty
      v-else-if="!explorableSources.length"
      description="暂无可用的发现书源"
      style="padding: 64px 0"
    />

    <!-- 书籍详情抽屉 -->
    <BookDetailDrawer
      v-model:show="showDrawer"
      :book-url="drawerBookUrl"
      :file-name="drawerFileName"
      :source-name="drawerSourceName"
      :source-type="drawerSourceType"
      :suspend-close-shortcuts="showReader"
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
    />
  </div>
</template>

<style scoped>
.explore-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--color-surface);
}

.ev-header {
  flex-shrink: 0;
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 24px 24px 12px;
  flex-wrap: wrap;
}
.ev-header__title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
}
.ev-header__sub {
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
}
.ev-header__actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
}
.ev-header__stat {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  white-space: nowrap;
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
  padding: 0 24px;
}
:deep(.n-tabs-nav) {
  flex-shrink: 0;
}
:deep(.n-tabs-nav-scroll-wrapper) {
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
:deep(.n-tabs-nav-scroll-wrapper)::-webkit-scrollbar {
  display: none;
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
  font-size: 0.75rem;
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
  font-size: 0.75rem !important;
  color: var(--color-accent) !important;
}

/* 内容区：直接滚动，无额外容器包裹 */
.ev-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-bottom: 16px;
}
.ev-content::-webkit-scrollbar { width: 5px; }
.ev-content::-webkit-scrollbar-track { background: transparent; }
.ev-content::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 3px;
}

/* ── 移动端适配 ─────────────────────────── */
@media (pointer: coarse), (max-width: 640px) {
  .ev-header { padding: 16px 16px 8px; }
  .ev-tabs { padding: 0 16px; }
  :deep(.n-tabs-tab) {
    padding: 6px 2px !important;
    font-size: 0.8125rem !important;
  }
}

/* ── 排序弹窗 ──────────────────────────── */
.ev-sort-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  user-select: none;
}

.ev-sort-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-raised);
  transition: background var(--transition-fast), box-shadow var(--transition-fast), border-color var(--transition-fast);
}

.ev-sort-item--dragging {
  opacity: 0.35;
  border-style: dashed;
}

.ev-sort-item--drag-over {
  border-color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 10%, transparent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 30%, transparent);
}

.ev-sort-item__handle {
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  flex-shrink: 0;
  cursor: grab;
  touch-action: none;
  padding: 2px 4px;
  border-radius: var(--radius-xs);
  transition: color var(--transition-fast), background var(--transition-fast);
}
.ev-sort-item__handle:hover {
  color: var(--color-accent);
  background: var(--color-surface-hover);
}
.ev-sort-item__handle:active {
  cursor: grabbing;
}

.ev-sort-item__name {
  flex: 1;
  font-size: 0.875rem;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
