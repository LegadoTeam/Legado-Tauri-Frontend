<script setup lang="ts">
/**
 * ChapterReaderModal — 阅读器主容器（瘦编排层）
 *
 * 负责章节内容加载、离线缓存、子组件编排。
 * UI 细节委派给 ReaderTopBar / ReaderBottomBar / ReaderTocPanel。
 */
import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue'
import { useMessage } from 'naive-ui'
import type { ChapterItem } from '../../composables/useScriptBridge'
import { useScriptBridge } from '../../composables/useScriptBridge'
import { useBookshelf } from '../../composables/useBookshelf'
import { useReaderSettings } from '../reader/composables/useReaderSettings'
import ScrollMode from '../reader/modes/ScrollMode.vue'
import SlideMode from '../reader/modes/SlideMode.vue'
import CoverMode from '../reader/modes/CoverMode.vue'
import NoneMode from '../reader/modes/NoneMode.vue'
import SimulationMode from '../reader/modes/SimulationMode.vue'
import ComicMode from '../reader/modes/ComicMode.vue'
import ReaderTopBar from '../reader/ReaderTopBar.vue'
import ReaderBottomBar from '../reader/ReaderBottomBar.vue'
import ReaderTocPanel from '../reader/ReaderTocPanel.vue'
import type { ReaderBookInfo } from '../reader/types'

const props = defineProps<{
  show: boolean
  chapterUrl: string
  chapterName: string
  fileName: string
  chapters: ChapterItem[]
  currentIndex: number
  shelfBookId?: string
  bookInfo?: ReaderBookInfo
  /** 书源类型：novel（默认）或 comic */
  sourceType?: string
  /** 目录刷新中（由父组件控制） */
  refreshingToc?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:show', val: boolean): void
  (e: 'update:currentIndex', val: number): void
  (e: 'refresh-toc'): void
}>()

const message = useMessage()
const { runChapterContent } = useScriptBridge()
const { updateProgress, saveContent, getContent, getCachedIndices, getShelfBook } = useBookshelf()
const {
  settings, getContentStyle,
  activateBookSettings, deactivateBookSettings, getSettingsJson,
} = useReaderSettings()

/** 漫画模式强制白色背景，不受主题 / 夜间模式影响 */
const effectiveStyle = computed(() => {
  const base = getContentStyle()
  if (props.sourceType === 'comic') {
    base['--reader-bg-color'] = '#ffffff'
    base['--reader-bg-image'] = 'none'
    base['--reader-text-color'] = '#1a1a1a'
  }
  return base
})

const loading = ref(false)
const content = ref('')
const error = ref('')

/* ---- 阅读位置追踪 ---- */
/** 当前分页模式的页码 */
const currentPageIndex = ref(-1)
/** 当前滚动模式的滚动比例 0~1 */
const currentScrollRatio = ref(-1)
/** 上一次保存的章节 index (防止重复保存) */
let lastSavedChapterIndex = -1

/* ---- 阅读状态追踪 ---- */
/** 已读过的章节索引集合（从书架进度初始化：0 ~ readChapterIndex） */
const readIndices = ref<Set<number>>(new Set())
/** 已下载缓存的章节索引集合（从磁盘扫描获取） */
const cachedIndices = ref<Set<number>>(new Set())

/** 弹窗打开时，从书架数据初始化阅读状态 */
async function loadShelfStatus() {
  if (!props.shelfBookId) return

  // 已缓存索引：扫描磁盘
  try {
    cachedIndices.value = await getCachedIndices(props.shelfBookId)
  } catch {
    cachedIndices.value = new Set()
  }

  // 已读索引：0 ~ readChapterIndex 均视为已阅读
  // bookInfo 上携带了 readChapterIndex（通过 totalChapters 等字段传递）
  // 实际上 shelfBook 有 readChapterIndex，但这里只能从 bookInfo 间接获取
  // 用 currentIndex（打开时的初始值）作为已读上限更准确
  const readUpTo = props.currentIndex >= 0 ? props.currentIndex : -1
  const set = new Set<number>()
  for (let i = 0; i <= readUpTo; i++) set.add(i)
  readIndices.value = set
}

/* ---- 预取缓存 ---- */
/** key: chapterUrl → value: 正文文本（内存缓存，随弹窗生命周期清除） */
const prefetchCache = new Map<string, string>()
/** 正在预取中的 url 集合，防止重复请求 */
const prefetching = new Set<string>()
/** 预取缓存最大条数，超出时淘汰最老的条目 */
const PREFETCH_MAX = 3

/** 将条目写入预取缓存，超出上限时淘汰最早写入的条目 */
function setPrefetch(url: string, text: string) {
  if (prefetchCache.size >= PREFETCH_MAX) {
    const firstKey = prefetchCache.keys().next().value
    if (firstKey !== undefined) prefetchCache.delete(firstKey)
  }
  prefetchCache.set(url, text)
}

/* ---- UI 状态 ---- */
const showMenu = ref(false)
const showToc = ref(false)
const settingsVisible = ref(false)
const bottomBarRef = ref<InstanceType<typeof ReaderBottomBar> | null>(null)

/** showMenu 关闭时重置 settingsVisible，防止下次打开菜单时顶部栏消失 */
watch(showMenu, (v) => {
  if (!v) {
    bottomBarRef.value?.closeSettings()
    settingsVisible.value = false
  }
})

/* ---- 章节导航 ---- */
const hasPrev = computed(() => props.currentIndex > 0)
const hasNext = computed(() => props.currentIndex < props.chapters.length - 1)

/** 导航方向：切换到上一章时为 backward，用于开始阅读上一章末页 */
const navDirection = ref<'forward' | 'backward'>('forward')

const currentChapterName = computed(() => {
  if (props.currentIndex >= 0 && props.currentIndex < props.chapters.length) {
    return props.chapters[props.currentIndex].name
  }
  return props.chapterName
})

function gotoPrev() {
  if (hasPrev.value) {
    saveDetailedProgress()
    navDirection.value = 'backward'
    emit('update:currentIndex', props.currentIndex - 1)
  }
}

function gotoNext() {
  if (hasNext.value) {
    saveDetailedProgress()
    navDirection.value = 'forward'
    emit('update:currentIndex', props.currentIndex + 1)
  }
}

function gotoChapter(idx: number) {
  if (idx !== props.currentIndex) {
    saveDetailedProgress()
    navDirection.value = idx < props.currentIndex ? 'backward' : 'forward'
    emit('update:currentIndex', idx)
  }
}

function close() {
  saveDetailedProgress()
  emit('update:show', false)
}

/**
 * 根据设置决定返回行为：
 * - 'bookshelf'（默认）：关闭阅读器，留在书架页
 * - 'desktop'：最小化应用，回到手机桌面（Tauri 环境）；非 Tauri 则同 bookshelf
 */
async function closeWithBackBehavior() {
  close()
  if (settings.backBehavior === 'desktop') {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      await getCurrentWindow().minimize()
    } catch {
      // 非 Tauri 环境或获取窗口失败，保持默认行为（已 close）
    }
  }
}

/* ---- 点击区域 ---- */
/** 遮罩打开的时间戳，用于防止触摸的合成 click 事件立刻又关掉菜单 */
let menuOpenTime = 0

function onTap(zone: 'left' | 'center' | 'right') {
  if (zone === 'center') {
    if (showToc.value) {
      showToc.value = false
    } else {
      showMenu.value = !showMenu.value
      if (showMenu.value) menuOpenTime = Date.now()
    }
  } else if (zone === 'left') {
    gotoPrev()
  } else {
    gotoNext()
  }
}

function openToc() {
  showToc.value = true
  showMenu.value = false
}

/* ---- 阅读位置追踪 ---- */
/** 分页模式 progress 回调：记录页码 */
function onPageProgress(ratio: number) {
  // 从 mode 组件获取实际页码
  const mode = modeRef.value as { currentPage?: number } | null
  if (mode && typeof mode.currentPage === 'number') {
    currentPageIndex.value = mode.currentPage
  }
  currentScrollRatio.value = ratio
}

/** 滚动模式 progress 回调：记录滚动比例 */
function onScrollProgress(ratio: number) {
  currentScrollRatio.value = ratio
  currentPageIndex.value = -1
}

/**
 * 漫画模式 progress 回调：记录当前可见图片索引（0-based）。
 * 漫画恢复用 goToPage(pageIndex) 而非 scrollRatio，避免受图片高度影响。
 */
function onComicProgress(_ratio: number) {
  const page = comicModeRef.value?.currentPage
  if (typeof page === 'number') {
    currentPageIndex.value = page
  }
  currentScrollRatio.value = -1 // 漫画不用 scrollRatio
}

/** 保存详细阅读进度到书架 */
function saveDetailedProgress() {
  if (!props.shelfBookId) return
  const idx = props.currentIndex
  const ch = props.chapters[idx]
  if (!ch) return
  if (idx === lastSavedChapterIndex
    && currentPageIndex.value === -1
    && currentScrollRatio.value === -1) return
  lastSavedChapterIndex = idx
  updateProgress(props.shelfBookId, idx, ch.url, {
    pageIndex: currentPageIndex.value >= 0 ? currentPageIndex.value : undefined,
    scrollRatio: currentScrollRatio.value >= 0 ? currentScrollRatio.value : undefined,
    readerSettings: getSettingsJson(),
  }).catch(() => {})
}

/* ---- 切换翻页模式时保留页码 ---- */
/**
 * 监听 flipMode 变化：切换前记录当前页码，切换后恢复到同一页。
 * 仅处理分页模式之间的互切（slide/cover/simulation/none 相互切换），
 * 滚动模式和漫画模式暂不处理。
 */
watch(
  () => settings.flipMode,
  (newMode, oldMode) => {
    // 滚动模式 / 漫画模式切换：不处理
    const pagedModes = new Set(['slide', 'cover', 'simulation', 'none'])
    if (!pagedModes.has(oldMode) || !pagedModes.has(newMode)) return

    // 切换前快照当前页码
    const savedPage = modeRef.value?.currentPage ?? -1
    if (savedPage < 0) return

    // 等新模式组件挂载并排版出足够页面后恢复
    const restore = async () => {
      const MAX = 60
      for (let i = 0; i < MAX; i++) {
        await new Promise(r => requestAnimationFrame(r))
        if (!modeRef.value?.goToPage) continue
        const total = modeRef.value?.totalPages ?? 0
        if (total > savedPage) {
          modeRef.value.goToPage(savedPage)
          return
        }
        if (total > 0 && i === MAX - 1) {
          // 新模式排版后总页数更少（字体/排版参数变化），跳末页
          modeRef.value.goToPage(total - 1)
        }
      }
    }
    restore()
  },
)

/* ---- 模式组件引用 & 翻页控制 ---- */
const modeRef = ref<{
  nextPage?: () => boolean
  prevPage?: () => boolean
  goToPage?: (page: number) => void
  currentPage?: number
  totalPages?: number
} | null>(null)

/** 滚动模式引用（用于恢复滚动位置） */
const scrollModeRef = ref<{ scrollToRatio?: (ratio: number) => void } | null>(null)

/** 漫画模式引用（goToPage + 页码） */
const comicModeRef = ref<{
  goToPage?: (idx: number) => void
  scrollToRatio?: (ratio: number) => void
  currentPage?: number
  totalPages?: number
} | null>(null)

/**
 * 内容加载完后恢复阅读位置。
 * 分页模式：等待后台排版产生足够页面后再 goToPage。
 * 滚动模式：等 DOM 渲染后 scrollToRatio。
 */
async function tryRestorePosition() {
  // 等待书架数据加载完毕（解决 loadContent 与 getShelfBook 的竞态）
  if (shelfDataReady) {
    await shelfDataReady
  }

  // 仅在首次打开（而非切章）时恢复
  const pageIdx = pendingRestorePageIndex.value
  const scrollR = pendingRestoreScrollRatio.value
  pendingRestorePageIndex.value = -1
  pendingRestoreScrollRatio.value = -1

  if (pageIdx < 0 && scrollR < 0) return

  // 分页模式 / 漫画模式（按图片索引跳转）
  if (pageIdx >= 0) {
    // 漫画：直接 goToPage，轮询等待图片元素渲染（最多 ~1s）
    if (comicModeRef.value?.goToPage) {
      const MAX = 60
      for (let i = 0; i < MAX; i++) {
        await new Promise(r => requestAnimationFrame(r))
        const total = comicModeRef.value?.totalPages ?? 0
        if (total > pageIdx) {
          comicModeRef.value.goToPage(pageIdx)
          return
        }
      }
      // 内容变短则跳末页
      const total = comicModeRef.value?.totalPages ?? 0
      if (total > 0) comicModeRef.value?.goToPage(total - 1)
      return
    }
    // 普通分页模式：等后台排版产生足够页面（最多 ~60 帧 ≈ 1s）
    if (modeRef.value?.goToPage) {
      const MAX = 60
      for (let i = 0; i < MAX; i++) {
        await new Promise(r => requestAnimationFrame(r))
        const total = modeRef.value?.totalPages ?? 0
        if (total > pageIdx) {
          modeRef.value.goToPage(pageIdx)
          return
        }
      }
      const total = modeRef.value?.totalPages ?? 0
      if (total > 0) modeRef.value.goToPage(total - 1)
      return
    }
  }

  // 滚动模式：等一帧让 DOM 渲染完成
  if (scrollR >= 0 && scrollModeRef.value?.scrollToRatio) {
    await new Promise(r => requestAnimationFrame(r))
    scrollModeRef.value.scrollToRatio(scrollR)
  }
}

/** 统一翻页：先尝试页内翻，失败则跨章节 */
function flipNext() {
  if (settings.flipMode === 'scroll') {
    // 滚动模式由滚动到底触发章节切换，快捷键直接切章
    if (!hasNext.value) {
      message.warning('已经到最后一页了')
      return
    }
    gotoNext()
    return
  }
  const ok = modeRef.value?.nextPage?.()
  if (!ok) {
    if (!hasNext.value) {
      message.warning('已经到最后一页了')
      return
    }
    gotoNext()
  }
}

function flipPrev() {
  if (settings.flipMode === 'scroll') {
    if (!hasPrev.value) {
      message.warning('已经到最前了')
      return
    }
    gotoPrev()
    return
  }
  const ok = modeRef.value?.prevPage?.()
  if (!ok) {
    if (!hasPrev.value) {
      message.warning('已经到最前了')
      return
    }
    gotoPrev()
  }
}

/* ---- 快捷键 ---- */
function onKeyDown(e: KeyboardEvent) {
  if (!props.show) return

  // Escape / 安卓返回键（BrowserBack）：按优先级逐层关闭
  if (e.key === 'Escape' || e.key === 'BrowserBack') {
    e.preventDefault()
    if (settingsVisible.value) {
      // 1. 优先关闭设置面板
      bottomBarRef.value?.closeSettings()
    } else if (showToc.value) {
      // 2. 关闭目录
      showToc.value = false
    } else if (showMenu.value) {
      // 3. 关闭菜单栏
      showMenu.value = false
    } else {
      // 4. 退出阅读器（行为由设置决定）
      closeWithBackBehavior()
    }
    return
  }

  // 空格/回车：切换菜单（任何时候可用）
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault()
    if (showToc.value) {
      showToc.value = false
    } else {
      showMenu.value = !showMenu.value
    }
    return
  }

  // 菜单/目录打开时不处理翻页快捷键
  if (showMenu.value || showToc.value) return

  switch (e.key) {
    case 'ArrowRight':
    case 'd':
    case 'D':
    case 'AudioVolumeDown':
      e.preventDefault()
      flipNext()
      break
    case 'ArrowLeft':
    case 'a':
    case 'A':
    case 'AudioVolumeUp':
      e.preventDefault()
      flipPrev()
      break
  }
}

/* ---- Android 返回键拦截（popstate） ---- */
/**
 * 当阅读器弹窗打开时，推入一条浏览器历史记录。
 * Android 返回键（或 WebView 后退手势）会触发 popstate 而不是 keydown BrowserBack。
 * 每次"消费"一次 popstate 后需要再次推入，保持守卫状态。
 */
function pushHistoryGuard() {
  history.pushState({ legadoReader: true }, '')
}

function onPopState() {
  if (!props.show) return
  if (settingsVisible.value) {
    bottomBarRef.value?.closeSettings()
    pushHistoryGuard()
  } else if (showToc.value) {
    showToc.value = false
    pushHistoryGuard()
  } else if (showMenu.value) {
    showMenu.value = false
    pushHistoryGuard()
  } else {
    closeWithBackBehavior()
  }
}

onMounted(() => window.addEventListener('keydown', onKeyDown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('popstate', onPopState)
})

/* ---- 内容加载 ---- */
async function loadContent(url: string, index: number) {
  error.value = ''

  // 快速路径：预取缓存（内存）命中时直接切换内容，跳过 loading 状态
  // 确保翻页切章时体验与章内翻页一样流畅（无闪烁、无 loading 转圈）
  const prefetched = prefetchCache.get(url)
  if (prefetched) {
    prefetchCache.delete(url)
    content.value = prefetched
    loading.value = false
    // 重置本章位置追踪
    currentPageIndex.value = -1
    currentScrollRatio.value = -1
    if (props.shelfBookId) {
      updateProgress(props.shelfBookId, index, url).catch(() => {})
      saveContent(props.shelfBookId, index, prefetched).catch(() => {})
    }
    readIndices.value.add(index)
    cachedIndices.value.add(index)
    prefetchNext(index)
    tryRestorePosition()
    return
  }

  // 慢路径：书架缓存或网络请求，需显示 loading
  loading.value = true
  content.value = ''
  try {
    let text: string | null = null

    // 1. 检查书架离线缓存
    if (props.shelfBookId) {
      try {
        text = await getContent(props.shelfBookId, index)
      } catch { /* fallback 到网络 */ }
    }

    // 2. 网络拉取
    if (!text) {
      const raw = await runChapterContent(props.fileName, url)
      text = typeof raw === 'string' ? raw : String(raw ?? '')
      if (props.shelfBookId && text) {
        saveContent(props.shelfBookId, index, text).catch(() => {})
      }
    }

    content.value = text ?? ''

    // 重置本章位置追踪
    currentPageIndex.value = -1
    currentScrollRatio.value = -1

    if (props.shelfBookId) {
      updateProgress(props.shelfBookId, index, url).catch(() => {})
    }

    // 标记当前章节已阅读、已下载
    readIndices.value.add(index)
    cachedIndices.value.add(index)

    // 3. 加载成功后触发下一章预取
    prefetchNext(index)
    tryRestorePosition()
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : String(e)
    message.error(`加载正文失败: ${error.value}`)
  } finally {
    loading.value = false
  }
}

/**
 * 后台预取下一章正文。
 * - 优先检查书架离线缓存，已有则跳过（无需预取）
 * - 已在预取中或已在内存缓存中则跳过（避免重复）
 */
async function prefetchNext(currentIndex: number) {
  const nextIdx = currentIndex + 1
  if (nextIdx >= props.chapters.length) return

  const nextChapter = props.chapters[nextIdx]
  if (!nextChapter) return

  const url = nextChapter.url
  if (prefetchCache.has(url) || prefetching.has(url)) return

  // 若书架缓存已有，跳过预取
  if (props.shelfBookId) {
    try {
      const cached = await getContent(props.shelfBookId, nextIdx)
      if (cached) return
    } catch { /* 忽略，继续预取 */ }
  }

  prefetching.add(url)
  try {
    const raw = await runChapterContent(props.fileName, url)
    const text = typeof raw === 'string' ? raw : String(raw ?? '')
    if (text) {
      setPrefetch(url, text)
      // 同时写入书架缓存并标记为已下载
      if (props.shelfBookId) {
        saveContent(props.shelfBookId, nextIdx, text).catch(() => {})
      }
      cachedIndices.value.add(nextIdx)
    }
  } catch {
    // 预取失败静默处理，不影响当前章节阅读
  } finally {
    prefetching.delete(url)
  }
}

/**
 * 核心 watcher：监听 currentIndex 变化，自动从 chapters 中
 * 取 URL 并加载。这使组件自洽，不再依赖父组件同步 chapterUrl。
 */
watch(
  () => [props.show, props.currentIndex] as const,
  ([visible, idx]) => {
    if (!visible) return
    const ch = props.chapters[idx]
    if (ch) {
      loadContent(ch.url, idx)
    }
  },
  { immediate: true },
)

/* 打开时重置 UI 状态并加载书架状态 + 激活书籍独立设置；关闭时保存进度并清理 */
/** 首次打开时需要恢复的页码 / 滚动比例 */
const pendingRestorePageIndex = ref(-1)
const pendingRestoreScrollRatio = ref(-1)
/** 书架数据加载 Promise，供 tryRestorePosition 等待以避免竞态 */
let shelfDataReady: Promise<void> | null = null

watch(
  () => props.show,
  async (v) => {
    if (v) {
      showMenu.value = false
      showToc.value = false
      lastSavedChapterIndex = -1
      currentPageIndex.value = -1
      currentScrollRatio.value = -1
      pendingRestorePageIndex.value = -1
      pendingRestoreScrollRatio.value = -1

      // 激活每本书独立设置 + 恢复阅读位置（异步，与 loadContent 并发）
      if (props.shelfBookId) {
        shelfDataReady = (async () => {
          try {
            const book = await getShelfBook(props.shelfBookId!)
            // 激活此书的独立设置
            activateBookSettings(props.shelfBookId!, book.readerSettings)
            // 记录待恢复的位置（仅当打开的章节与上次相同时才恢复页内位置）
            if (book.readChapterIndex === props.currentIndex) {
              pendingRestorePageIndex.value = book.readPageIndex ?? -1
              pendingRestoreScrollRatio.value = book.readScrollRatio ?? -1
            }
          } catch {
            // 获取失败则沿用全局设置
          }
        })()
      } else {
        shelfDataReady = null
      }

      loadShelfStatus()
      // 推入历史守卫，使 Android 返回键可被 popstate 拦截
      pushHistoryGuard()
      window.addEventListener('popstate', onPopState)
    } else {
      // 关闭前保存进度
      saveDetailedProgress()
      // 停用书籍独立设置，恢复全局
      deactivateBookSettings()
      prefetchCache.clear()
      prefetching.clear()
      readIndices.value = new Set()
      cachedIndices.value = new Set()
      window.removeEventListener('popstate', onPopState)
    }
  },
)
</script>

<template>
  <n-modal
    :show="show"
    @update:show="emit('update:show', $event)"
    :mask-closable="false"
    :auto-focus="false"
    :trap-focus="false"
    transform-origin="center"
  >
    <div class="reader-modal" :style="effectiveStyle">
      <!-- 正文区（全屏） -->
      <div class="reader-modal__body">
        <n-spin v-if="loading" :show="true" class="reader-modal__spin" />
        <n-alert v-else-if="error" type="error" :title="error" style="margin:24px" />

        <!-- 漫画模式 -->
        <ComicMode
          v-else-if="sourceType === 'comic'"
          ref="comicModeRef"
          :content="content"
          :file-name="fileName"
          :chapter-url="chapters[currentIndex]?.url ?? chapterUrl"
          :has-prev="hasPrev"
          :has-next="hasNext"
          @tap="onTap"
          @progress="onComicProgress"
          @prev-chapter="gotoPrev"
          @next-chapter="gotoNext"
        />

        <!-- 覆盖模式 -->
        <CoverMode
          v-else-if="settings.flipMode === 'cover'"
          ref="modeRef"
          :content="content"
          :chapter-title="currentChapterName"
          :typography="settings.typography"
          :padding="settings.padding"
          :start-from-end="navDirection === 'backward'"
          :has-prev="hasPrev"
          :has-next="hasNext"
          :tap-zone-left="settings.tapZoneLeft"
          :tap-zone-right="settings.tapZoneRight"
          @tap="onTap"
          @progress="onPageProgress"
          @prev-chapter="gotoPrev"
          @next-chapter="gotoNext"
        />

        <!-- 仿真翻页模式 -->
        <SimulationMode
          v-else-if="settings.flipMode === 'simulation'"
          ref="modeRef"
          :content="content"
          :chapter-title="currentChapterName"
          :typography="settings.typography"
          :padding="settings.padding"
          :start-from-end="navDirection === 'backward'"
          :has-prev="hasPrev"
          :has-next="hasNext"
          :tap-zone-left="settings.tapZoneLeft"
          :tap-zone-right="settings.tapZoneRight"
          @tap="onTap"
          @progress="onPageProgress"
          @prev-chapter="gotoPrev"
          @next-chapter="gotoNext"
        />

        <!-- 无动画模式（电子墨水屏） -->
        <NoneMode
          v-else-if="settings.flipMode === 'none'"
          ref="modeRef"
          :content="content"
          :chapter-title="currentChapterName"
          :typography="settings.typography"
          :padding="settings.padding"
          :start-from-end="navDirection === 'backward'"
          :has-prev="hasPrev"
          :has-next="hasNext"
          :tap-zone-left="settings.tapZoneLeft"
          :tap-zone-right="settings.tapZoneRight"
          @tap="onTap"
          @progress="onPageProgress"
          @prev-chapter="gotoPrev"
          @next-chapter="gotoNext"
        />

        <!-- 平移模式 -->
        <SlideMode
          v-else-if="settings.flipMode === 'slide'"
          ref="modeRef"
          :content="content"
          :chapter-title="currentChapterName"
          :typography="settings.typography"
          :padding="settings.padding"
          :start-from-end="navDirection === 'backward'"
          :has-prev="hasPrev"
          :has-next="hasNext"
          :tap-zone-left="settings.tapZoneLeft"
          :tap-zone-right="settings.tapZoneRight"
          @tap="onTap"
          @progress="onPageProgress"
          @prev-chapter="gotoPrev"
          @next-chapter="gotoNext"
        />

        <!-- 滚动模式（默认） -->
        <ScrollMode
          v-else
          ref="scrollModeRef"
          :content="content"
          :chapter-title="currentChapterName"
          :paragraph-spacing="settings.typography.paragraphSpacing"
          :text-indent="settings.typography.textIndent"
          :has-prev="hasPrev"
          :has-next="hasNext"
          @tap="onTap"
          @progress="onScrollProgress"
          @prev-chapter="gotoPrev"
          @next-chapter="gotoNext"
        />
      </div>

      <!-- 遮罩 -->
      <Transition name="reader-fade">
        <div v-if="showMenu" class="reader-modal__overlay" @click="Date.now() - menuOpenTime > 200 && (showMenu = false)" />
      </Transition>

      <!-- 顶部栏（设置面板展开时隐藏） -->
      <Transition name="reader-slide-top">
        <ReaderTopBar
          v-if="showMenu && !settingsVisible"
          :chapter-name="currentChapterName"
          :current-index="currentIndex"
          :total-chapters="chapters.length"
          :chapter-url="chapters[currentIndex]?.url"
          @close="close"
        />
      </Transition>

      <!-- 底部栏 -->
      <Transition name="reader-slide-bottom">
        <ReaderBottomBar
          v-if="showMenu"
          ref="bottomBarRef"
          :chapters="chapters"
          :current-index="currentIndex"
          :has-prev="hasPrev"
          :has-next="hasNext"
          :source-type="sourceType"
          @prev="gotoPrev"
          @next="gotoNext"
          @goto="gotoChapter"
          @open-toc="openToc"
          @settings-visible="settingsVisible = $event"
        />
      </Transition>

      <!-- 目录面板 -->
      <ReaderTocPanel
        v-model:show="showToc"
        :chapters="chapters"
        :current-index="currentIndex"
        :book-info="bookInfo"
        :read-indices="readIndices"
        :cached-indices="cachedIndices"
        :refreshing-toc="props.refreshingToc"
        @select="gotoChapter"
        @refresh-toc="emit('refresh-toc')"
      />
    </div>
  </n-modal>
</template>

<style scoped>
.reader-modal {
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
  background: var(--reader-bg-image, none), var(--reader-bg-color, var(--color-surface));
  color: var(--reader-text-color, var(--color-text-primary));
  /* 整体字体渲染优化：覆盖 :root 的 font-synthesis:none，允许合成粗/斜体 */
  font-synthesis: weight style;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  /* 禁用双击缩放，确保安卓上单击稳定触发 */
  touch-action: manipulation;
  /* 安卓状态栏安全区 */
  padding-top: env(safe-area-inset-top, 0px);
}

.reader-modal__body {
  width: 100%;
  height: 100%;
}

.reader-modal__spin {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.reader-modal__overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 10;
}

/* 过渡动画 */
.reader-fade-enter-active,
.reader-fade-leave-active {
  transition: opacity 0.25s ease;
}
.reader-fade-enter-from,
.reader-fade-leave-to {
  opacity: 0;
}

.reader-slide-top-enter-active,
.reader-slide-top-leave-active {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.reader-slide-top-enter-from,
.reader-slide-top-leave-to {
  transform: translateY(-100%);
}

.reader-slide-bottom-enter-active,
.reader-slide-bottom-leave-active {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.reader-slide-bottom-enter-from,
.reader-slide-bottom-leave-to {
  transform: translateY(100%);
}
</style>
