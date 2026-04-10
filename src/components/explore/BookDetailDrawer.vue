<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useMessage } from 'naive-ui'
import { openUrl } from '@tauri-apps/plugin-opener'
import { isMobile } from '../../composables/useEnv'
import {
  type BookDetail,
  type ChapterItem,
  useScriptBridge,
} from '../../composables/useScriptBridge'
import {
  type CachedChapter,
  useBookshelf,
} from '../../composables/useBookshelf'
import type { ReaderBookInfo } from '../reader/types'

const props = defineProps<{
  show: boolean
  bookUrl: string
  fileName: string
  sourceName: string
  /** 书源类型：novel（默认）或 comic 或 video */
  sourceType?: string
  /** 顶层还有其它弹层时，暂停返回键/Escape 处理，避免一次关闭多层 */
  suspendCloseShortcuts?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:show', val: boolean): void
  (e: 'read-chapter', payload: { chapterUrl: string; chapterName: string; index: number; bookInfo: ReaderBookInfo; sourceType: string }): void
}>()

const message = useMessage()
const { runBookInfo, runChapterList } = useScriptBridge()
const { addToShelf, saveChapters, isOnShelf, ensureLoaded } = useBookshelf()

const loading = ref(false)
const error = ref('')
const detail = ref<BookDetail | null>(null)
const chapters = ref<ChapterItem[]>([])
const addingToShelf = ref(false)
const onShelf = ref(false)

/** 移动端全宽，桌面端固定宽度 */
const drawerWidth = computed(() => isMobile.value ? '100vw' : 480)
const drawerTitle = computed(() => isMobile.value ? '' : (detail.value?.name ?? '书籍详情'))
const drawerHeaderStyle = computed(() =>
  isMobile.value
    ? { display: 'none' }
    : undefined
)
const drawerBodyContentStyle = computed(() =>
  isMobile.value
    ? { display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '0', height: '100%' }
    : { display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '14px' }
)
const mobileHeaderTitle = computed(() => detail.value?.name?.trim() || '书籍详情')
const mobileHeaderSubtitle = computed(() => `来自 ${props.sourceName}`)

function closeDrawer() {
  emit('update:show', false)
}

/* ---- Escape / 安卓返回键关闭抽屉 ---- */
function onKeyDown(e: KeyboardEvent) {
  if (!props.show || props.suspendCloseShortcuts) return
  if (e.key === 'Escape' || e.key === 'BrowserBack') {
    e.preventDefault()
    closeDrawer()
  }
}
onMounted(() => window.addEventListener('keydown', onKeyDown))

/* ---- Android 返回键拦截（popstate） ---- */
let historyGuardActive = false

function pushHistoryGuard() {
  history.pushState({ legadoBookDetail: true }, '')
}

function activateHistoryGuard() {
  if (historyGuardActive) return
  pushHistoryGuard()
  window.addEventListener('popstate', onPopState)
  historyGuardActive = true
}

function deactivateHistoryGuard() {
  if (!historyGuardActive) return
  window.removeEventListener('popstate', onPopState)
  historyGuardActive = false
}

function onPopState() {
  if (!props.show || props.suspendCloseShortcuts) return
  closeDrawer()
}

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  deactivateHistoryGuard()
})

const fallbackCover = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="220" viewBox="0 0 160 220">' +
  '<rect width="160" height="220" rx="6" fill="%233a3a45"/>' +
  '<rect x="18" y="22" width="8" height="176" rx="2" fill="%23555568"/>' +
  '<rect x="26" y="22" width="116" height="176" rx="3" fill="%23464658" stroke="%23555568" stroke-width="0.5"/>' +
  '<rect x="132" y="28" width="5" height="164" rx="1.5" fill="%234e4e62"/>' +
  '<path d="M62 72 C62 72 72 68 84 72 L84 108 C72 104 62 108 62 108 Z" fill="%23606078"/>' +
  '<path d="M106 72 C106 72 96 68 84 72 L84 108 C96 104 106 108 106 108 Z" fill="%23555570"/>' +
  '<line x1="84" y1="72" x2="84" y2="108" stroke="%237a7a92" stroke-width="1"/>' +
  '<text x="84" y="140" text-anchor="middle" fill="%237a7a92" font-size="13" font-family="sans-serif">暂无封面</text>' +
  '</svg>'
)}`

watch(
  () => props.show,
  async (visible) => {
    if (!visible) return
    loading.value = true
    error.value = ''
    detail.value = null
    chapters.value = []
    onShelf.value = false
    try {
      await ensureLoaded()
      onShelf.value = isOnShelf(props.bookUrl, props.fileName)

      // 先获取书籍详情，拿到 tocUrl（目录专属 URL），再用它加载章节列表
      // bookInfo 返回的 tocUrl 可能与 bookUrl 不同（如番茄小说使用独立目录接口）
      const infoRaw = await runBookInfo(props.fileName, props.bookUrl)
      detail.value = infoRaw as BookDetail
      const tocUrl = detail.value.tocUrl ?? props.bookUrl
      const listRaw = await runChapterList(props.fileName, tocUrl)
      chapters.value = Array.isArray(listRaw) ? (listRaw as ChapterItem[]) : []
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e)
      message.error(`加载书籍详情失败: ${error.value}`)
    } finally {
      loading.value = false
    }
  },
)

watch(
  () => [props.show, props.suspendCloseShortcuts] as const,
  ([visible, suspended]) => {
    if (visible && !suspended) {
      activateHistoryGuard()
    } else {
      deactivateHistoryGuard()
    }
  },
  { immediate: true },
)

function onClickChapter(ch: ChapterItem, index: number) {
  const d = detail.value
  const bookInfo: ReaderBookInfo = {
    name: d?.name ?? '',
    author: d?.author ?? '',
    coverUrl: d?.coverUrl,
    intro: d?.intro,
    kind: d?.kind,
    bookUrl: props.bookUrl,
    sourceName: props.sourceName,
    fileName: props.fileName,
    lastChapter: d?.lastChapter,
    totalChapters: chapters.value.length,
  }
  emit('read-chapter', { chapterUrl: ch.url, chapterName: ch.name, index, bookInfo, sourceType: props.sourceType ?? 'novel' })
}

async function handleAddToShelf() {
  if (!detail.value || onShelf.value) return
  addingToShelf.value = true
  try {
    const d = detail.value
    const result = await addToShelf(
      {
        name: d.name,
        author: d.author,
        coverUrl: d.coverUrl,
        intro: d.intro,
        kind: d.kind,
        bookUrl: props.bookUrl,
        lastChapter: d.lastChapter,
        sourceType: props.sourceType ?? 'novel',
      },
      props.fileName,
      props.sourceName,
    )
    // 同时缓存章节目录
    if (chapters.value.length) {
      const cached: CachedChapter[] = chapters.value.map((ch, i) => ({
        index: i,
        name: ch.name,
        url: ch.url,
      }))
      await saveChapters(result.id, cached)
    }
    onShelf.value = true
    message.success('已加入书架')
  } catch (e: unknown) {
    message.error(`加入书架失败: ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    addingToShelf.value = false
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
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M15 18l-6-6 6-6" />
              </svg>
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
              <img
                class="bd-header__cover bd-header__cover--mobile"
                :src="detail.coverUrl || fallbackCover"
                :alt="detail.name"
                @error="($event.target as HTMLImageElement).src = fallbackCover"
              />
              <div class="bd-header__meta bd-header__meta--mobile">
                <h2 class="bd-header__name">{{ detail.name }}</h2>
                <span class="bd-header__author">{{ detail.author }}</span>
                <div class="bd-header__tags">
                  <n-tag v-if="detail.kind" size="tiny" :bordered="false">{{ detail.kind }}</n-tag>
                  <n-tag v-if="detail.lastChapter" size="tiny" type="info" :bordered="false">
                    {{ detail.lastChapter }}
                  </n-tag>
                </div>
              </div>
              <p v-if="detail.intro" class="bd-header__intro bd-header__intro--mobile">{{ detail.intro }}</p>
              <a
                class="bd-header__url bd-header__url--mobile"
                :title="bookUrl"
                @click.prevent="openUrl(bookUrl)"
              >{{ bookUrl }}</a>
            </div>

            <div v-else-if="detail" class="bd-header">
              <img
                class="bd-header__cover"
                :src="detail.coverUrl || fallbackCover"
                :alt="detail.name"
                @error="($event.target as HTMLImageElement).src = fallbackCover"
              />
              <div class="bd-header__meta">
                <h2 class="bd-header__name">{{ detail.name }}</h2>
                <span class="bd-header__author">{{ detail.author }}</span>
                <div class="bd-header__tags">
                  <n-tag v-if="detail.kind" size="tiny" :bordered="false">{{ detail.kind }}</n-tag>
                  <n-tag v-if="detail.lastChapter" size="tiny" type="info" :bordered="false">
                    {{ detail.lastChapter }}
                  </n-tag>
                </div>
                <p v-if="detail.intro" class="bd-header__intro">{{ detail.intro }}</p>
                <a
                  class="bd-header__url"
                  :title="bookUrl"
                  @click.prevent="openUrl(bookUrl)"
                >{{ bookUrl }}</a>
              </div>
            </div>

            <!-- 操作按钮 -->
            <div v-if="detail" class="bd-actions">
              <div class="bd-actions__btn">
                <n-button
                  type="primary"
                  size="large"
                  style="width: 100%"
                  :disabled="!chapters.length"
                  @click="chapters.length && onClickChapter(chapters[0], 0)"
                >
                  开始阅读
                </n-button>
              </div>
              <div class="bd-actions__btn">
                <n-button
                  size="large"
                  style="width: 100%"
                  :loading="addingToShelf"
                  :disabled="onShelf"
                  :type="onShelf ? 'default' : 'tertiary'"
                  @click="handleAddToShelf"
                >
                  {{ onShelf ? '已在书架' : '加入书架' }}
                </n-button>
              </div>
            </div>

            <!-- 章节列表 -->
            <div v-if="chapters.length" class="bd-chapters">
              <div class="bd-chapters__title">
                章节列表 ({{ chapters.length }})
              </div>
              <div class="bd-chapters__list">
                <div
                  v-for="(ch, i) in chapters"
                  :key="ch.url"
                  class="bd-chapter-item"
                  @click="onClickChapter(ch, i)"
                >
                  <span class="bd-chapter-item__index">{{ i + 1 }}</span>
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
  padding: max(env(safe-area-inset-top, 0px), 16px) 14px 8px 8px;
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
.bd-header__intro {
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
  line-height: 1.5;
  margin: 4px 0 0;
  max-height: 80px;
  overflow-y: auto;
  white-space: pre-wrap;
}
.bd-header__intro::-webkit-scrollbar { width: 4px; }
.bd-header__intro::-webkit-scrollbar-track { background: transparent; }
.bd-header__intro::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 2px;
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
.bd-chapters__title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-primary);
  padding: 8px 0;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}
.bd-chapters__list {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}
.bd-chapters__list::-webkit-scrollbar { width: 4px; }
.bd-chapters__list::-webkit-scrollbar-track { background: transparent; }
.bd-chapters__list::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 2px;
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
