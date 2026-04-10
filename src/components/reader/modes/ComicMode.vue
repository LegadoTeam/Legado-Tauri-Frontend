<script setup lang="ts">
/**
 * ComicMode — 漫画阅读模式（纯竖向滚动，显示图片列表）
 *
 * content 格式约定：书源 chapterContent() 返回的文本为 JSON 数组字符串，
 * 例如 `["https://img1.jpg","https://img2.jpg"]`；或以换行分隔的 URL 列表。
 *
 * 支持两种图片加载模式（由 useAppConfig 的 comic_cache_enabled 控制）：
 * - 缓存模式（默认）：前端拿到全部 URL 后立即开始阅读；Rust 后端后台顺序缓存并按页通知前端切换到本地文件
 * - 直读模式：前端直接使用图片 URL，浏览器自动加载
 */
import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue'
import { comicDownloadImages } from '../../../composables/useBookSource'
import { useAppConfig } from '../../../composables/useAppConfig'
import { convertFileSrc } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { usePullToLoad } from '../composables/usePullToLoad'
import PullBubble from '../PullBubble.vue'

const props = defineProps<{
  content: string
  fileName: string
  chapterUrl: string
  hasPrev: boolean
  hasNext: boolean
}>()

const emit = defineEmits<{
  (e: 'tap', zone: 'left' | 'center' | 'right'): void
  (e: 'progress', ratio: number): void
  (e: 'prevChapter'): void
  (e: 'nextChapter'): void
}>()

interface ComicPage {
  remoteUrl: string
  src: string
  cachedSrc: string | null
  loaded: boolean
  failed: boolean
}

interface ComicPageCachedPayload {
  file_name: string
  chapter_url: string
  page_index: number
  local_path: string
}

const { comicCacheEnabled } = useAppConfig()
const containerRef = ref<HTMLDivElement | null>(null)
const pages = ref<ComicPage[]>([])
const visibleImages = ref<Set<number>>(new Set())
const loading = ref(false)
const error = ref('')
let loadVersion = 0
let unlistenComicPageCached: UnlistenFn | null = null

/** 解析 content 为图片 URL 数组 */
function parseImageUrls(raw: string): string[] {
  const trimmed = raw.trim()
  // 尝试 JSON 数组
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed)
      if (Array.isArray(arr)) return arr.filter((u: unknown) => typeof u === 'string' && u.length > 0)
    } catch { /* fallback */ }
  }
  // 换行分隔
  return trimmed.split('\n').map(s => s.trim()).filter(s => s.length > 0 && s.startsWith('http'))
}

function isDirectSrc(src: string): boolean {
  return /^(https?:)?\/\//i.test(src) || src.startsWith('data:') || src.startsWith('blob:') || src.startsWith('asset:')
}

function toRenderableSrc(src: string): string {
  return isDirectSrc(src) ? src : convertFileSrc(src)
}

function createPages(urls: string[]): ComicPage[] {
  return urls.map(url => ({
    remoteUrl: url,
    src: url,
    cachedSrc: null,
    loaded: false,
    failed: false,
  }))
}

function resetPages(urls: string[]) {
  visibleImages.value = new Set()
  pages.value = createPages(urls)
}

function applyResolvedSources(sources: string[]) {
  for (const [idx, source] of sources.entries()) {
    const page = pages.value[idx]
    if (!page) continue
    const renderable = toRenderableSrc(source)
    page.cachedSrc = renderable === page.remoteUrl ? null : renderable
    if (page.src !== renderable) {
      page.src = renderable
      page.loaded = false
      page.failed = false
    }
  }
}

function applyCachedPage(pageIndex: number, localPath: string) {
  const page = pages.value[pageIndex]
  if (!page) return

  const localSrc = toRenderableSrc(localPath)
  page.cachedSrc = localSrc

  // 仅在该页还未成功显示，或之前加载失败时切换到本地缓存，避免已显示的远程图片再次闪烁重载。
  if (!page.loaded || page.failed) {
    page.src = localSrc
    page.loaded = false
    page.failed = false
  }
}

/** 加载图片（根据缓存开关选择模式） */
async function loadImages() {
  const currentVersion = ++loadVersion
  const urls = parseImageUrls(props.content)
  error.value = ''

  if (urls.length === 0) {
    loading.value = false
    pages.value = []
    return
  }

  // 先把整章 URL 放给页面，确保只要拿到图片列表就能开始阅读。
  resetPages(urls)

  // 直读模式：不经过 Rust 后端，直接使用原始 URL
  if (!comicCacheEnabled.value) {
    loading.value = false
    return
  }

  // 缓存模式：立即返回“已缓存本地路径 + 未缓存远程 URL”的混合结果，
  // 同时由 Rust 后端继续后台顺序下载，并通过事件逐页通知前端替换。
  loading.value = true
  try {
    const resolvedSources = await comicDownloadImages(props.fileName, props.chapterUrl, urls)
    if (currentVersion !== loadVersion) return
    applyResolvedSources(resolvedSources)
  } catch (e: unknown) {
    if (currentVersion !== loadVersion) return
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    if (currentVersion === loadVersion) {
      loading.value = false
    }
  }
}

watch(() => [props.content, props.fileName, props.chapterUrl, comicCacheEnabled.value], loadImages, { immediate: true })

/* ── 滚动状态 ── */
const atBottom = ref(false)

function onScroll() {
  const el = containerRef.value
  if (!el) return
  const { scrollTop, scrollHeight, clientHeight } = el
  atBottom.value = scrollHeight - scrollTop - clientHeight < 2
  // 发射滚动进度
  const ratio = scrollHeight <= clientHeight ? 1 : scrollTop / (scrollHeight - clientHeight)
  emit('progress', Math.min(1, Math.max(0, ratio)))
}

// ── 上拉/下拉加载（共用 usePullToLoad composable） ──────────────────
const {
  bubbleBottomPx,
  isReady,
  dismissing,
  boundaryMsg,
  isDragging,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onMouseDown,
  onWheel,
  isMouseDragMoved,
  resetOnContentChange,
  cleanup,
} = usePullToLoad({
  containerRef,
  atBottom,
  hasNext: () => props.hasNext,
  emitNext: () => emit('nextChapter'),
})

/* ── 触控区域 ── */
function onTapContainer(e: MouseEvent | TouchEvent) {
  // 鼠标拖拽超过 5px 后不算点击
  if (!('touches' in e) && isMouseDragMoved()) return
  // 漫画滚动模式不支持左右点击翻章，任意区域均切换菜单
  emit('tap', 'center')
}

/** 鼠标拖拽时光标样式 */
const containerStyle = computed(() => isDragging.value ? { cursor: 'grabbing', userSelect: 'none' as const } : {})

// 内容变化时重置上拉状态
watch(() => props.content, () => resetOnContentChange())

onBeforeUnmount(() => cleanup())

/* ── 图片懒加载观察器 ── */
let observer: IntersectionObserver | null = null

function setupObserver() {
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const idx = Number((entry.target as HTMLElement).dataset.idx)
        if (entry.isIntersecting) visibleImages.value.add(idx)
      }
    },
    { root: containerRef.value, rootMargin: '200px 0px' },
  )
}

const shouldShow = (idx: number) => visibleImages.value.has(idx)

function onImageLoad(idx: number) {
  const page = pages.value[idx]
  if (!page) return
  page.loaded = true
  page.failed = false
}

function onImageError(idx: number) {
  const page = pages.value[idx]
  if (!page) return

  if (page.cachedSrc && page.src !== page.cachedSrc) {
    page.src = page.cachedSrc
    page.loaded = false
    page.failed = false
    return
  }

  page.failed = true
  page.loaded = false
}

onMounted(async () => {
  setupObserver()
  unlistenComicPageCached = await listen<ComicPageCachedPayload>('comic:page-cached', (event) => {
    const { payload } = event
    if (payload.file_name !== props.fileName || payload.chapter_url !== props.chapterUrl) {
      return
    }
    applyCachedPage(payload.page_index, payload.local_path)
  })
})
onBeforeUnmount(() => {
  observer?.disconnect()
  unlistenComicPageCached?.()
})

/** 注册图片元素到观察器 */
function observeImg(el: Element | null, idx: number) {
  if (el && observer) {
    (el as HTMLElement).dataset.idx = String(idx)
    observer.observe(el)
  }
}

/* ── 页码显示（0-based，与其他翻页模式保持一致） ── */
const currentPage = computed(() => {
  const sorted = [...visibleImages.value].sort((a, b) => a - b)
  return sorted.length > 0 ? sorted[0] : 0
})
const totalPages = computed(() => pages.value.length)

/**
 * 跳到指定图片页（0-based），通过 offsetTop 瞬间定位，
 * 不依赖 scrollHeight（受未加载图片高度影响），更加稳定。
 */
function goToPage(idx: number) {
  const container = containerRef.value
  if (!container) return
  const pageEls = container.querySelectorAll<HTMLElement>('.comic-mode__page')
  const target = pageEls[idx]
  if (target) container.scrollTop = target.offsetTop
}

defineExpose({ goToPage, get currentPage() { return currentPage.value }, get totalPages() { return totalPages.value } })
</script>

<template>
  <div
    ref="containerRef"
    class="comic-mode"
    :style="containerStyle"
    @click="onTapContainer"
    @scroll.passive="onScroll"
    @wheel="onWheel"
    @mousedown="onMouseDown"
    @touchstart.passive="onTouchStart"
    @touchmove.passive="onTouchMove"
    @touchend.passive="onTouchEnd"
    @touchcancel.passive="onTouchEnd"
  >
    <div v-if="loading && totalPages === 0" class="comic-mode__loading">
      <n-spin size="large" />
      <span>加载图片中...</span>
    </div>

    <div v-else-if="error && totalPages === 0" class="comic-mode__error">
      <n-alert type="warning" :title="error" />
    </div>

    <template v-else>
      <div v-if="error" class="comic-mode__error comic-mode__error--inline">
        <n-alert type="warning" :title="error" />
      </div>

      <div
        v-for="(page, idx) in pages"
        :key="idx"
        :ref="(el) => observeImg(el as Element, idx)"
        class="comic-mode__page"
      >
        <template v-if="shouldShow(idx)">
          <img
            :src="page.src"
            :alt="`第 ${idx + 1} 页`"
            :class="['comic-mode__img', { 'comic-mode__img--ready': page.loaded }]"
            loading="lazy"
            @load="onImageLoad(idx)"
            @error="onImageError(idx)"
          />
          <div v-if="!page.loaded" class="comic-mode__placeholder comic-mode__placeholder--overlay">
            <n-spin v-if="!page.failed" size="small" />
            <span>{{ page.failed ? '图片加载失败' : `第 ${idx + 1} 页加载中...` }}</span>
          </div>
        </template>
        <div v-else class="comic-mode__placeholder">
          {{ idx + 1 }}
        </div>
      </div>

      <!-- 底部提示 -->
      <div class="comic-mode__footer">
        <span v-if="!hasNext">已是最后一章</span>
        <span v-else class="comic-mode__footer-hint">继续滚动加载下一章</span>
      </div>
    </template>

    <!-- 上拉气泡 + 边界提示（共享组件） -->
    <PullBubble
      :visible="atBottom"
      :bubble-bottom-px="bubbleBottomPx"
      :is-ready="isReady"
      :dismissing="dismissing"
      :has-next="hasNext"
      :boundary-msg="boundaryMsg"
    />

    <!-- 页码指示器 -->
    <div v-if="totalPages > 0" class="comic-mode__indicator">
      {{ currentPage }} / {{ totalPages }}
    </div>
  </div>
</template>

<style scoped>
.comic-mode {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  background: #111;
  -webkit-overflow-scrolling: touch;
  /* 启用滚动锚定：图片加载后浏览器自动补偿滚动位置，防止内容被顶走 */
  overflow-anchor: auto;
}

.comic-mode__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  color: var(--color-text-muted);
}

.comic-mode__error {
  padding: 24px;
}

.comic-mode__page {
  position: relative;
  width: 100%;
  /* 预留 3:4 宽高比空间，图片加载前就占位，避免加载后布局抖动 */
  min-height: 200px;
  aspect-ratio: 3 / 4;
  display: flex;
  align-items: center;
  justify-content: center;
  /* 配合 overflow-anchor：每个页面块参与锚定计算 */
  overflow-anchor: auto;
}

/* 图片加载完毕后撑开为实际高度，取消固定宽高比 */
.comic-mode__page:has(.comic-mode__img--ready) {
  aspect-ratio: auto;
  min-height: 0;
}

.comic-mode__img {
  width: 100%;
  height: auto;
  display: block;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
  opacity: 0;
  transition: opacity 0.16s ease;
}

.comic-mode__img--ready {
  opacity: 1;
}

.comic-mode__placeholder {
  width: 100%;
  height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  font-size: 1.5rem;
  opacity: 0.3;
}

.comic-mode__placeholder--overlay {
  position: absolute;
  inset: 0;
  height: auto;
  gap: 10px;
  flex-direction: column;
  background: linear-gradient(180deg, rgba(17, 17, 17, 0.58), rgba(17, 17, 17, 0.72));
  font-size: 0.95rem;
  opacity: 1;
}

.comic-mode__error--inline {
  padding: 16px 16px 0;
}

.comic-mode__footer {
  padding: 16px 24px 28px;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.comic-mode__footer-hint {
  opacity: 0.45;
  font-size: 0.78rem;
}

.comic-mode__indicator {
  position: fixed;
  bottom: 16px;
  right: 16px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.75rem;
  pointer-events: none;
  z-index: 20;
}
</style>
