<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useMessage } from 'naive-ui'
import BookCard from '../explore/BookCard.vue'
import BookDetailDrawer from '../explore/BookDetailDrawer.vue'
import ChapterReaderModal from '../explore/ChapterReaderModal.vue'
import type { ReaderBookInfo } from '../reader/types'
import {
  type BookSourceMeta,
} from '../../composables/useBookSource'
import {
  type BookItem,
  type BookDetail,
  type ChapterItem,
  useScriptBridge,
} from '../../composables/useScriptBridge'

const props = defineProps<{
  sources: BookSourceMeta[]
}>()

const message = useMessage()
const { runSearch, runBookInfo, runChapterList, runChapterContent, runExplore } = useScriptBridge()

// ---- 调试状态 ----
const debugSourceId     = ref<string | null>(null)
const debugCustomUrl    = ref('')
const debugKeyword      = ref('')
const debugResult       = ref('')
const debugLoading      = ref(false)
const debugResultStatus = ref<'idle' | 'ok' | 'error'>('idle')

const debugBookUrl = ref('')
const debugChapterUrl = ref('')

type DebugMode = 'idle' | 'text' | 'search' | 'bookInfo' | 'chapterList' | 'chapterContent' | 'explore'
const debugMode = ref<DebugMode>('idle')
const debugViewMode = ref<'preview' | 'raw'>('preview')

const debugSourceOptions = computed(() =>
  props.sources.map(s => ({ label: s.name, value: s.fileName }))
)

const debugSourceUrls = computed<{ label: string; value: string }[]>(() => {
  const src = props.sources.find(s => s.fileName === debugSourceId.value)
  if (!src) return []
  const list = src.urls?.length ? src.urls : (src.url ? [src.url] : [])
  return list.map(u => ({ label: u, value: u }))
})

const debugSelectedUrl = ref('')
watch(debugSourceId, () => { debugSelectedUrl.value = '' })

const debugTargetUrl = computed(() => {
  if (debugCustomUrl.value) return debugCustomUrl.value
  if (debugSelectedUrl.value) return debugSelectedUrl.value
  const src = props.sources.find(s => s.fileName === debugSourceId.value)
  return src?.url ?? ''
})

// ---- 结果数据 ----
const boaSearchResults = ref<BookItem[]>([])
const boaSearchJson = ref('')
const boaBookInfo = ref<BookDetail | null>(null)
const boaBookInfoJson = ref('')
const boaChapters = ref<ChapterItem[]>([])
const boaChaptersJson = ref('')
const boaContent = ref('')
const boaContentJson = ref('')
const boaExploreCategories = ref<string[]>([])
const boaExploreActiveCategory = ref('')
const boaExploreBooks = ref<BookItem[]>([])
const boaExploreJson = ref('')
const boaExploreCatLoading = ref(false)
const boaExploreBooksLoading = ref(false)

const debugRawJson = computed(() => {
  switch (debugMode.value) {
    case 'search': return boaSearchJson.value
    case 'bookInfo': return boaBookInfoJson.value
    case 'chapterList': return boaChaptersJson.value
    case 'chapterContent': return boaContentJson.value
    case 'explore': return boaExploreJson.value
    default: return ''
  }
})

function resetDebugResult() {
  debugResult.value = ''
  debugResultStatus.value = 'idle'
  debugMode.value = 'idle'
  debugViewMode.value = 'preview'
  boaSearchResults.value = []
  boaSearchJson.value = ''
  boaBookInfo.value = null
  boaBookInfoJson.value = ''
  boaChapters.value = []
  boaChaptersJson.value = ''
  boaContent.value = ''
  boaContentJson.value = ''
  boaExploreBooks.value = []
  boaExploreJson.value = ''
  boaExploreActiveCategory.value = ''
}

// ---- 搜索 ----
async function runBoaSearch() {
  if (!debugSourceId.value) { message.warning('请先选择已安装书源'); return }
  if (!debugKeyword.value)  { message.warning('请输入搜索关键词'); return }
  debugLoading.value = true
  resetDebugResult()
  try {
    const raw = await runSearch(debugSourceId.value, debugKeyword.value.trim())
    const items = Array.isArray(raw) ? (raw as BookItem[]) : []
    boaSearchResults.value = items
    boaSearchJson.value = JSON.stringify(raw, null, 2)
    debugResultStatus.value = 'ok'
    debugMode.value = 'search'
    debugResult.value = `✓ 搜索成功，找到 ${items.length} 条结果`
  } catch (e: unknown) {
    debugResultStatus.value = 'error'
    debugMode.value = 'text'
    debugResult.value = `✗ 搜索失败\n${e instanceof Error ? e.message : String(e)}`
  } finally {
    debugLoading.value = false
  }
}

// ---- 书籍详情 ----
async function runBoaBookInfo() {
  if (!debugSourceId.value) { message.warning('请先选择已安装书源'); return }
  if (!debugBookUrl.value.trim()) { message.warning('请输入书籍 URL'); return }
  debugLoading.value = true
  resetDebugResult()
  try {
    const raw = await runBookInfo(debugSourceId.value, debugBookUrl.value.trim())
    boaBookInfo.value = raw as BookDetail
    boaBookInfoJson.value = JSON.stringify(raw, null, 2)
    debugResultStatus.value = 'ok'
    debugMode.value = 'bookInfo'
    debugResult.value = `✓ 书籍详情获取成功`
  } catch (e: unknown) {
    debugResultStatus.value = 'error'
    debugMode.value = 'text'
    debugResult.value = `✗ 书籍详情获取失败\n${e instanceof Error ? e.message : String(e)}`
  } finally {
    debugLoading.value = false
  }
}

// ---- 章节列表 ----
async function runBoaChapterListTest() {
  if (!debugSourceId.value) { message.warning('请先选择已安装书源'); return }
  if (!debugBookUrl.value.trim()) { message.warning('请输入书籍 URL'); return }
  debugLoading.value = true
  resetDebugResult()
  try {
    const raw = await runChapterList(debugSourceId.value, debugBookUrl.value.trim())
    const items = Array.isArray(raw) ? (raw as ChapterItem[]) : []
    boaChapters.value = items
    boaChaptersJson.value = JSON.stringify(raw, null, 2)
    debugResultStatus.value = 'ok'
    debugMode.value = 'chapterList'
    debugResult.value = `✓ 章节列表获取成功，共 ${items.length} 章`
  } catch (e: unknown) {
    debugResultStatus.value = 'error'
    debugMode.value = 'text'
    debugResult.value = `✗ 章节列表获取失败\n${e instanceof Error ? e.message : String(e)}`
  } finally {
    debugLoading.value = false
  }
}

// ---- 章节正文 ----
async function runBoaChapterContentTest() {
  if (!debugSourceId.value) { message.warning('请先选择已安装书源'); return }
  if (!debugChapterUrl.value.trim()) { message.warning('请输入章节 URL'); return }
  debugLoading.value = true
  resetDebugResult()
  try {
    const raw = await runChapterContent(debugSourceId.value, debugChapterUrl.value.trim())
    const text = typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2)
    boaContent.value = text
    boaContentJson.value = JSON.stringify(raw, null, 2)
    debugResultStatus.value = 'ok'
    debugMode.value = 'chapterContent'
    debugResult.value = `✓ 章节正文获取成功（${text.length} 字符）`
  } catch (e: unknown) {
    debugResultStatus.value = 'error'
    debugMode.value = 'text'
    debugResult.value = `✗ 章节正文获取失败\n${e instanceof Error ? e.message : String(e)}`
  } finally {
    debugLoading.value = false
  }
}

// ---- 发现 ----
async function runBoaExploreGetAll() {
  if (!debugSourceId.value) { message.warning('请先选择已安装书源'); return }
  boaExploreCatLoading.value = true
  resetDebugResult()
  debugMode.value = 'explore'
  try {
    const raw = await runExplore(debugSourceId.value, 'GETALL', 1, true)
    if (Array.isArray(raw)) {
      boaExploreCategories.value = raw.filter((v): v is string => typeof v === 'string')
    }
    boaExploreJson.value = JSON.stringify(raw, null, 2)
    debugResultStatus.value = 'ok'
    debugResult.value = `✓ 获取到 ${boaExploreCategories.value.length} 个发现分类`
  } catch (e: unknown) {
    debugResultStatus.value = 'error'
    debugResult.value = `✗ 获取分类失败\n${e instanceof Error ? e.message : String(e)}`
  } finally {
    boaExploreCatLoading.value = false
  }
}

async function runBoaExploreCategory(category: string) {
  if (!debugSourceId.value) return
  boaExploreActiveCategory.value = category
  boaExploreBooksLoading.value = true
  boaExploreBooks.value = []
  boaExploreJson.value = ''
  try {
    const raw = await runExplore(debugSourceId.value, category, 1, true)
    const items = Array.isArray(raw) ? (raw as BookItem[]) : []
    boaExploreBooks.value = items
    boaExploreJson.value = JSON.stringify(raw, null, 2)
    debugResult.value = `✓ 分类「${category}」加载成功，共 ${items.length} 本`
    debugResultStatus.value = 'ok'
  } catch (e: unknown) {
    debugResult.value = `✗ 分类「${category}」加载失败\n${e instanceof Error ? e.message : String(e)}`
    debugResultStatus.value = 'error'
  } finally {
    boaExploreBooksLoading.value = false
  }
}

function debugFillChapterUrl(ch: ChapterItem) {
  debugChapterUrl.value = ch.url
  message.info(`已填充 Chapter URL`, { duration: 1500 })
}

// ---- 书籍详情弹窗 + 阅读器 ----
const debugShowDrawer = ref(false)
const debugDrawerBookUrl = ref('')
const debugDrawerFileName = ref('')

const debugShowReader = ref(false)
const debugReaderChapterUrl = ref('')
const debugReaderChapterName = ref('')
const debugReaderFileName = ref('')
const debugReaderChapters = ref<ChapterItem[]>([])
const debugReaderCurrentIndex = ref(0)
const debugReaderBookInfo = ref<ReaderBookInfo | undefined>()

function debugOpenDetail(book: BookItem) {
  if (!debugSourceId.value) return
  debugBookUrl.value = book.bookUrl
  debugDrawerBookUrl.value = book.bookUrl
  debugDrawerFileName.value = debugSourceId.value
  debugShowDrawer.value = true
}

async function debugReadChapter(payload: { chapterUrl: string; chapterName: string; index: number; bookInfo: ReaderBookInfo }) {
  debugReaderChapterUrl.value = payload.chapterUrl
  debugReaderChapterName.value = payload.chapterName
  debugReaderFileName.value = debugDrawerFileName.value
  debugReaderCurrentIndex.value = payload.index
  debugReaderBookInfo.value = payload.bookInfo

  if (!debugReaderChapters.value.length) {
    try {
      const raw = await runChapterList(debugDrawerFileName.value, debugDrawerBookUrl.value)
      debugReaderChapters.value = Array.isArray(raw) ? (raw as ChapterItem[]) : []
    } catch { /* ignore */ }
  }

  debugShowReader.value = true
}

watch(debugReaderCurrentIndex, (idx) => {
  if (idx >= 0 && idx < debugReaderChapters.value.length) {
    const ch = debugReaderChapters.value[idx]
    debugReaderChapterUrl.value = ch.url
    debugReaderChapterName.value = ch.name
  }
})

/** 外部设置调试书源 */
function setDebugSource(fileName: string) {
  debugSourceId.value = fileName
}

defineExpose({ setDebugSource })
</script>

<template>
  <div class="bv-pane">
    <div class="bv-debug">
      <!-- 左侧配置区 -->
      <div class="bv-debug__config">
        <div class="bv-debug__base">
          <div class="bv-debug__base-label">选择书源</div>
          <n-select v-model:value="debugSourceId" :options="debugSourceOptions" placeholder="从已安装列表选择..." clearable size="small" />
          <n-select v-if="debugSourceUrls.length > 1" v-model:value="debugSelectedUrl" :options="debugSourceUrls" placeholder="切换镜像 URL..." clearable size="small" />
          <n-input v-model:value="debugCustomUrl" placeholder="或直接输入书源 URL..." clearable size="small" />
          <div v-if="debugTargetUrl" class="bv-debug__target">
            <span class="bv-debug__target-label">当前 URL</span>
            <span class="bv-debug__target-url">{{ debugTargetUrl }}</span>
          </div>
        </div>

        <!-- 搜索 -->
        <div class="bv-debug__block">
          <div class="bv-debug__block-title">搜索</div>
          <n-input v-model:value="debugKeyword" placeholder="输入书名或作者..." clearable size="small" @keyup.enter="runBoaSearch" />
          <n-button type="primary" size="small" block :loading="debugLoading" :disabled="!debugSourceId || !debugKeyword" @click="runBoaSearch">搜索</n-button>
        </div>

        <!-- 书籍详情 & 章节列表 -->
        <div class="bv-debug__block">
          <div class="bv-debug__block-title">书籍详情 / 章节列表</div>
          <n-input v-model:value="debugBookUrl" placeholder="书籍 URL（点搜索结果自动填充）" clearable size="small" />
          <div class="bv-debug__block-actions">
            <n-button size="small" style="flex:1" :loading="debugLoading" :disabled="!debugSourceId || !debugBookUrl" @click="runBoaBookInfo">书籍详情</n-button>
            <n-button size="small" style="flex:1" :loading="debugLoading" :disabled="!debugSourceId || !debugBookUrl" @click="runBoaChapterListTest">章节列表</n-button>
          </div>
        </div>

        <!-- 章节正文 -->
        <div class="bv-debug__block">
          <div class="bv-debug__block-title">章节正文</div>
          <n-input v-model:value="debugChapterUrl" placeholder="章节 URL（点章节列表自动填充）" clearable size="small" />
          <n-button size="small" block :loading="debugLoading" :disabled="!debugSourceId || !debugChapterUrl" @click="runBoaChapterContentTest">获取正文</n-button>
        </div>

        <!-- 发现 -->
        <div class="bv-debug__block">
          <div class="bv-debug__block-title">发现</div>
          <n-button size="small" block :loading="boaExploreCatLoading" :disabled="!debugSourceId" @click="runBoaExploreGetAll">获取分类</n-button>
          <div v-if="boaExploreCategories.length" class="bv-debug__cat-tags">
            <n-tag v-for="cat in boaExploreCategories" :key="cat" size="small" :type="cat === boaExploreActiveCategory ? 'info' : 'default'" :bordered="cat !== boaExploreActiveCategory" class="bv-debug__cat-tag" @click="runBoaExploreCategory(cat)">{{ cat }}</n-tag>
          </div>
        </div>
      </div>

      <!-- 右侧结果区 -->
      <div class="bv-debug__result">
        <div class="bv-debug__result-header">
          <span>响应结果</span>
          <n-tag v-if="debugResultStatus === 'ok'" type="success" size="tiny">成功</n-tag>
          <n-tag v-else-if="debugResultStatus === 'error'" type="error" size="tiny">失败</n-tag>
          <n-tag v-if="debugMode !== 'idle' && debugMode !== 'text'" size="tiny" :bordered="false">
            {{ { search: '搜索', bookInfo: '书籍详情', chapterList: '章节列表', chapterContent: '章节正文', explore: '发现' }[debugMode] }}
          </n-tag>
          <div style="margin-left:auto;display:flex;align-items:center;gap:6px">
            <n-button-group v-if="debugMode !== 'idle' && debugMode !== 'text'" size="tiny">
              <n-button :type="debugViewMode === 'preview' ? 'primary' : 'default'" :ghost="debugViewMode === 'preview'" @click="debugViewMode = 'preview'">预览</n-button>
              <n-button :type="debugViewMode === 'raw' ? 'primary' : 'default'" :ghost="debugViewMode === 'raw'" @click="debugViewMode = 'raw'">原始数据</n-button>
            </n-button-group>
            <n-button v-if="debugResult" size="tiny" quaternary @click="resetDebugResult()">清空</n-button>
          </div>
        </div>
        <n-spin :show="debugLoading || boaExploreBooksLoading" style="height:100%;overflow:auto">
          <div v-if="debugMode === 'idle' && !debugLoading" class="bv-debug__placeholder">运行测试后，结果将显示在这里</div>
          <template v-else>
            <pre class="bv-debug__pre" :class="{ 'bv-debug__pre--short': debugMode !== 'text' && debugMode !== 'idle' }">{{ debugResult }}</pre>

            <template v-if="debugViewMode === 'raw' && debugMode !== 'text' && debugRawJson">
              <pre class="bv-debug__pre" style="flex:1">{{ debugRawJson }}</pre>
            </template>

            <template v-else-if="debugViewMode === 'preview'">
              <template v-if="debugMode === 'search' && boaSearchResults.length">
                <div class="bv-debug__cards">
                  <div class="bv-debug__cards-hint">点击卡片查看详情并自动填充 Book URL</div>
                  <div class="bv-debug__cards-grid">
                    <BookCard v-for="book in boaSearchResults" :key="book.bookUrl" :book="book" @select="debugOpenDetail" />
                  </div>
                </div>
              </template>

              <template v-if="debugMode === 'bookInfo' && boaBookInfo">
                <div class="bv-debug__book-detail">
                  <div class="bv-debug__book-detail-header">
                    <img v-if="boaBookInfo.coverUrl" :src="boaBookInfo.coverUrl" class="bv-debug__book-cover" @error="($event.target as HTMLImageElement).style.display = 'none'" />
                    <div class="bv-debug__book-meta">
                      <div class="bv-debug__book-title">{{ boaBookInfo.name }}</div>
                      <div class="bv-debug__book-author">{{ boaBookInfo.author }}</div>
                      <n-tag v-if="boaBookInfo.kind" size="tiny" :bordered="false">{{ boaBookInfo.kind }}</n-tag>
                      <div v-if="boaBookInfo.lastChapter" class="bv-debug__book-last">最新: {{ boaBookInfo.lastChapter }}</div>
                    </div>
                  </div>
                  <div v-if="boaBookInfo.intro" class="bv-debug__book-intro">{{ boaBookInfo.intro }}</div>
                </div>
              </template>

              <template v-if="debugMode === 'chapterList' && boaChapters.length">
                <div class="bv-debug__chapters">
                  <div class="bv-debug__cards-hint">点击章节自动填充 Chapter URL</div>
                  <div class="bv-debug__chapter-list">
                    <div v-for="(ch, i) in boaChapters" :key="ch.url" class="bv-debug__chapter-item" :class="{ 'bv-debug__chapter-item--active': ch.url === debugChapterUrl }" @click="debugFillChapterUrl(ch)">
                      <span class="bv-debug__chapter-idx">{{ i + 1 }}</span>
                      <span class="bv-debug__chapter-name">{{ ch.name }}</span>
                    </div>
                  </div>
                </div>
              </template>

              <template v-if="debugMode === 'chapterContent' && boaContent">
                <div class="bv-debug__content-preview">
                  <div class="bv-debug__content-text">{{ boaContent }}</div>
                </div>
              </template>

              <template v-if="debugMode === 'explore'">
                <div v-if="boaExploreBooks.length" class="bv-debug__cards">
                  <div class="bv-debug__cards-hint">点击卡片查看详情并自动填充 Book URL</div>
                  <div class="bv-debug__cards-grid">
                    <BookCard v-for="book in boaExploreBooks" :key="book.bookUrl" :book="book" @select="debugOpenDetail" />
                  </div>
                </div>
                <div v-else-if="boaExploreActiveCategory && !boaExploreBooksLoading" class="bv-debug__placeholder" style="padding:24px">该分类暂无数据</div>
              </template>
            </template>
          </template>
        </n-spin>
      </div>
    </div>
  </div>

  <!-- 书籍详情+阅读器 -->
  <BookDetailDrawer
    v-model:show="debugShowDrawer"
    :book-url="debugDrawerBookUrl"
    :file-name="debugDrawerFileName"
    :source-name="sources.find(s => s.fileName === debugDrawerFileName)?.name ?? debugDrawerFileName"
    :suspend-close-shortcuts="debugShowReader"
    @read-chapter="debugReadChapter"
  />
  <ChapterReaderModal
    v-model:show="debugShowReader"
    v-model:current-index="debugReaderCurrentIndex"
    :chapter-url="debugReaderChapterUrl"
    :chapter-name="debugReaderChapterName"
    :file-name="debugReaderFileName"
    :chapters="debugReaderChapters"
    :book-info="debugReaderBookInfo"
  />
</template>

<style scoped>
.bv-pane {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
  padding-top: 12px;
}
.bv-pane :deep(.n-spin-container) { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.bv-pane :deep(.n-spin-content) { flex: 1; min-height: 0; display: flex; flex-direction: column; }

.bv-debug {
  flex: 1;
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 16px;
  overflow: hidden;
}
.bv-debug__config { display: flex; flex-direction: column; gap: 8px; overflow-y: auto; padding-right: 4px; }
.bv-debug__config::-webkit-scrollbar { width: 4px; }
.bv-debug__config::-webkit-scrollbar-track { background: transparent; }
.bv-debug__config::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 2px; }

.bv-debug__base { display: flex; flex-direction: column; gap: 6px; padding-bottom: 12px; border-bottom: 1px solid var(--color-border); margin-bottom: 4px; }
.bv-debug__base-label { font-size: 0.6875rem; font-weight: 600; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
.bv-debug__block { display: flex; flex-direction: column; gap: 8px; padding: 12px; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface-raised); }
.bv-debug__block-title { font-size: 0.8125rem; font-weight: 600; color: var(--color-text-primary); }
.bv-debug__block-actions { display: flex; gap: 6px; }
.bv-debug__cat-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 12px; }
.bv-debug__cat-tag { cursor: pointer; transition: transform var(--transition-fast); }
.bv-debug__cat-tag:hover { transform: scale(1.05); }
.bv-debug__target { padding: 6px 10px; border-radius: var(--radius-sm); background: var(--color-surface); border: 1px solid var(--color-border); font-size: 0.75rem; }
.bv-debug__target-label { color: var(--color-text-muted); display: block; margin-bottom: 3px; }
.bv-debug__target-url { color: var(--color-accent); word-break: break-all; }

.bv-debug__result { display: flex; flex-direction: column; border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden; background: var(--color-surface-raised); }
.bv-debug__result-header { flex-shrink: 0; display: flex; align-items: center; gap: 8px; padding: 8px 14px; border-bottom: 1px solid var(--color-border); font-size: 0.8125rem; font-weight: 600; color: var(--color-text-secondary); }
.bv-debug__placeholder { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--color-text-muted); font-size: 0.8125rem; height: 100%; padding: 40px; }
.bv-debug__pre { flex: 1; overflow: auto; padding: 12px 14px; margin: 0; font-family: 'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace; font-size: 0.75rem; line-height: 1.6; color: var(--color-text-primary); white-space: pre-wrap; word-break: break-all; }
.bv-debug__pre--short { flex: none; max-height: 60px; border-bottom: 1px solid var(--color-border); }

.bv-debug__cards { padding: 8px 12px; overflow-y: auto; flex: 1; }
.bv-debug__cards-hint { font-size: 0.6875rem; color: var(--color-text-muted); margin-bottom: 8px; padding: 4px 8px; background: var(--color-surface); border-radius: var(--radius-xs); border-left: 2px solid var(--color-accent); }
.bv-debug__cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 8px; }

.bv-debug__book-detail { padding: 12px 14px; overflow-y: auto; flex: 1; }
.bv-debug__book-detail-header { display: flex; gap: 12px; margin-bottom: 12px; }
.bv-debug__book-cover { width: 80px; height: 110px; object-fit: cover; border-radius: var(--radius-sm); flex-shrink: 0; border: 1px solid var(--color-border); }
.bv-debug__book-meta { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.bv-debug__book-title { font-size: 1rem; font-weight: 700; color: var(--color-text-primary); }
.bv-debug__book-author { font-size: 0.8125rem; color: var(--color-text-secondary); }
.bv-debug__book-last { font-size: 0.75rem; color: var(--color-text-muted); margin-top: 4px; }
.bv-debug__book-intro { font-size: 0.8125rem; color: var(--color-text-secondary); line-height: 1.6; white-space: pre-wrap; max-height: 200px; overflow-y: auto; padding: 8px 10px; background: var(--color-surface); border-radius: var(--radius-sm); border: 1px solid var(--color-border); }

.bv-debug__chapters { padding: 8px 12px; overflow-y: auto; flex: 1; }
.bv-debug__chapter-list { max-height: 400px; overflow-y: auto; display: flex; flex-direction: column; gap: 1px; }
.bv-debug__chapter-item { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: var(--radius-xs); cursor: pointer; font-size: 0.8125rem; color: var(--color-text-secondary); transition: background var(--transition-fast), color var(--transition-fast); }
.bv-debug__chapter-item:hover { background: var(--color-surface-hover); color: var(--color-text-primary); }
.bv-debug__chapter-item--active { background: var(--color-accent-subtle); color: var(--color-accent); }
.bv-debug__chapter-idx { font-size: 0.6875rem; color: var(--color-text-muted); min-width: 28px; text-align: right; font-family: 'Cascadia Code', 'Consolas', monospace; }
.bv-debug__chapter-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.bv-debug__content-preview { padding: 12px 14px; overflow-y: auto; flex: 1; }
.bv-debug__content-text { font-size: 0.875rem; line-height: 1.8; color: var(--color-text-primary); white-space: pre-wrap; max-height: 500px; overflow-y: auto; padding: 12px 16px; background: var(--color-surface); border-radius: var(--radius-sm); border: 1px solid var(--color-border); }

@media (pointer: coarse), (max-width: 640px) {
  .bv-debug { flex-direction: column !important; }
  .bv-debug__config { flex: none !important; width: 100% !important; max-width: none !important; border-right: none !important; border-bottom: 1px solid var(--color-border); padding-bottom: 12px; max-height: 40vh; overflow-y: auto; }
  .bv-debug__result { flex: 1; min-height: 200px; }
}
</style>
