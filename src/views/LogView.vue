<script setup lang="ts">
/**
 * LogView — 独立日志查看器窗口
 *
 * 监听所有 Tauri 脚本事件（script:log / script:http / script:ui / booksource:changed），
 * 以终端风格实时展示日志流。可在独立窗口中打开（?view=logs）。
 *
 * 功能：
 * - 按类型过滤（全部/脚本/HTTP/UI/系统）
 * - 按书源筛选（顶部下拉框）
 * - HTTP 请求详情展开面板（类似 Chrome DevTools Network）
 * - 文本搜索、暂停/继续、自动滚动
 */
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

// ── 类型 ──────────────────────────────────────────────────────────────────

/** HTTP 请求详细信息 */
interface HttpDetail {
  url:             string
  method:          string
  status:          number
  elapsed:         number
  requestHeaders:  Record<string, string>
  requestBody?:    string
  responseHeaders: Record<string, string>
  responseBody:    string
  error:           string
}

interface LogEntry {
  id:          number
  time:        number
  type:        'script' | 'http' | 'ui' | 'system'
  message:     string
  detail?:     string
  sourceName?: string
  httpDetail?: HttpDetail
}

// ── 状态 ──────────────────────────────────────────────────────────────────

const MAX_LOGS = 5000
let nextId = 1
const logs = ref<LogEntry[]>([])
const filterType = ref<'all' | 'script' | 'http' | 'ui' | 'system'>('all')
const filterText = ref('')
const filterSource = ref<string>('')  // '' 表示全部书源
const paused = ref(false)
const autoScroll = ref(true)
const scrollEl = ref<HTMLElement | null>(null)
const expandedIds = ref<Set<number>>(new Set())
const activeTab = ref<Record<number, 'headers' | 'response' | 'request'>>({})

const unlisteners: UnlistenFn[] = []

// ── 计算属性 ──────────────────────────────────────────────────────────────

/** 收集所有出现过的书源名称（用于下拉筛选） */
const sourceNames = computed(() => {
  const names = new Set<string>()
  for (const l of logs.value) {
    if (l.sourceName) names.add(l.sourceName)
  }
  return Array.from(names).sort()
})

const filteredLogs = computed(() => {
  let result = logs.value
  if (filterType.value !== 'all') {
    result = result.filter(l => l.type === filterType.value)
  }
  if (filterSource.value) {
    result = result.filter(l => l.sourceName === filterSource.value)
  }
  if (filterText.value) {
    const keyword = filterText.value.toLowerCase()
    result = result.filter(l =>
      l.message.toLowerCase().includes(keyword) ||
      (l.sourceName && l.sourceName.toLowerCase().includes(keyword))
    )
  }
  return result
})

const counts = computed(() => {
  const c = { all: 0, script: 0, http: 0, ui: 0, system: 0 }
  for (const l of logs.value) {
    c.all++
    c[l.type]++
  }
  return c
})

// ── 工具函数 ──────────────────────────────────────────────────────────────

function addLog(type: LogEntry['type'], message: string, opts?: {
  detail?: string
  sourceName?: string
  httpDetail?: HttpDetail
}) {
  if (paused.value) return
  logs.value.push({
    id: nextId++,
    time: Date.now(),
    type,
    message,
    detail: opts?.detail,
    sourceName: opts?.sourceName,
    httpDetail: opts?.httpDetail,
  })
  if (logs.value.length > MAX_LOGS) {
    logs.value.splice(0, logs.value.length - MAX_LOGS)
  }
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('zh-CN', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0')
}

function clearLogs() {
  logs.value = []
  expandedIds.value.clear()
}

function scrollToBottom() {
  if (!autoScroll.value || !scrollEl.value) return
  scrollEl.value.scrollTop = scrollEl.value.scrollHeight
}

function onScroll() {
  if (!scrollEl.value) return
  const el = scrollEl.value
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  autoScroll.value = atBottom
}

function toggleExpand(id: number) {
  if (expandedIds.value.has(id)) {
    expandedIds.value.delete(id)
  } else {
    expandedIds.value.add(id)
    if (!activeTab.value[id]) {
      activeTab.value[id] = 'headers'
    }
  }
}

function setTab(id: number, tab: 'headers' | 'response' | 'request') {
  activeTab.value[id] = tab
}

function statusClass(status: number): string {
  if (status >= 200 && status < 300) return 'status-ok'
  if (status >= 300 && status < 400) return 'status-redirect'
  if (status >= 400) return 'status-error'
  return 'status-unknown'
}

// 自动滚动
watch(() => filteredLogs.value.length, () => {
  nextTick(scrollToBottom)
})

// ── 事件监听 ──────────────────────────────────────────────────────────────

onMounted(async () => {
  // script:log — 来自 legado.log() 和 console 输出
  unlisteners.push(await listen<{ message: string; sourceName?: string }>('script:log', (e) => {
    addLog('script', e.payload.message, {
      sourceName: e.payload.sourceName,
    })
  }))

  // script:http — HTTP 请求日志（含完整请求/响应信息）
  unlisteners.push(await listen<{
    url: string; method: string; ok: boolean
    status?: number; elapsed?: number
    requestHeaders?: Record<string, string>
    requestBody?: string
    responseHeaders?: Record<string, string>
    responseBody?: string
    error?: string
    sourceName?: string
  }>('script:http', (e) => {
    const p = e.payload
    const status = p.ok ? '✓' : '✗'
    const statusCode = p.status ? ` ${p.status}` : ''
    const elapsed = p.elapsed != null ? ` ${p.elapsed}ms` : ''
    addLog('http', `${status}${statusCode} ${p.method} ${p.url}${elapsed}`, {
      sourceName: p.sourceName,
      httpDetail: {
        url:             p.url,
        method:          p.method,
        status:          p.status ?? 0,
        elapsed:         p.elapsed ?? 0,
        requestHeaders:  p.requestHeaders ?? {},
        requestBody:     p.requestBody,
        responseHeaders: p.responseHeaders ?? {},
        responseBody:    p.responseBody ?? '',
        error:           p.error ?? '',
      },
    })
  }))

  // script:ui — 前端 UI 事件
  unlisteners.push(await listen<{ event: string; data: unknown; sourceName?: string }>('script:ui', (e) => {
    addLog('ui', `[${e.payload.event}] ${JSON.stringify(e.payload.data)}`, {
      sourceName: e.payload.sourceName,
    })
  }))

  // booksource:changed — 文件系统变化
  unlisteners.push(await listen<unknown>('booksource:changed', (e) => {
    const payload = typeof e.payload === 'string' ? e.payload : JSON.stringify(e.payload)
    addLog('system', `[文件变化] ${payload}`)
  }))

  addLog('system', '日志查看器已启动，正在监听事件…')
})

onUnmounted(() => {
  unlisteners.forEach(fn => fn())
  unlisteners.length = 0
})

// ── 样式辅助 ──────────────────────────────────────────────────────────────

function typeColor(type: LogEntry['type']): string {
  switch (type) {
    case 'script': return '#a5b4fc'  // indigo
    case 'http':   return '#86efac'  // green
    case 'ui':     return '#fbbf24'  // amber
    case 'system': return '#71717a'  // gray
    default:       return '#d4d4d8'
  }
}

function typeLabel(type: LogEntry['type']): string {
  switch (type) {
    case 'script': return 'SCRIPT'
    case 'http':   return 'HTTP'
    case 'ui':     return 'UI'
    case 'system': return 'SYS'
    default:       return type
  }
}
</script>

<template>
  <div class="log-viewer">
    <!-- 工具栏 -->
    <div class="log-toolbar">
      <div class="log-toolbar__left">
        <span class="log-toolbar__title">实时日志</span>
        <div class="log-toolbar__filters">
          <button
            v-for="t in (['all', 'script', 'http', 'ui', 'system'] as const)"
            :key="t"
            class="log-filter-btn"
            :class="{ 'log-filter-btn--active': filterType === t }"
            @click="filterType = t"
          >
            {{ t === 'all' ? '全部' : t === 'script' ? '脚本' : t === 'http' ? 'HTTP' : t === 'ui' ? 'UI' : '系统' }}
            <span class="log-filter-count">{{ counts[t] }}</span>
          </button>
        </div>
      </div>
      <div class="log-toolbar__right">
        <!-- 书源筛选下拉框 -->
        <select v-model="filterSource" class="log-source-select">
          <option value="">全部书源</option>
          <option v-for="name in sourceNames" :key="name" :value="name">{{ name }}</option>
        </select>
        <input
          v-model="filterText"
          class="log-search"
          type="text"
          placeholder="搜索日志…"
        />
        <button class="log-action-btn" :class="{ 'log-action-btn--active': paused }" @click="paused = !paused" :title="paused ? '继续' : '暂停'">
          {{ paused ? '▶' : '⏸' }}
        </button>
        <button class="log-action-btn" @click="clearLogs" title="清空">🗑</button>
        <button class="log-action-btn" :class="{ 'log-action-btn--active': autoScroll }" @click="autoScroll = !autoScroll; autoScroll && scrollToBottom()" title="自动滚动">
          ⬇
        </button>
      </div>
    </div>

    <!-- 日志列表 -->
    <div ref="scrollEl" class="log-list" @scroll="onScroll">
      <div v-if="filteredLogs.length === 0" class="log-empty">
        {{ paused ? '已暂停 — 点击 ▶ 继续接收日志' : '等待日志…' }}
      </div>
      <template v-for="entry in filteredLogs" :key="entry.id">
        <div
          class="log-entry"
          :class="{ 'log-entry--clickable': entry.type === 'http' && entry.httpDetail, 'log-entry--expanded': expandedIds.has(entry.id) }"
          @click="entry.type === 'http' && entry.httpDetail && toggleExpand(entry.id)"
        >
          <span class="log-time">{{ formatTime(entry.time) }}</span>
          <span class="log-source" v-if="entry.sourceName">{{ entry.sourceName }}</span>
          <span class="log-type" :style="{ color: typeColor(entry.type) }">
            [{{ typeLabel(entry.type) }}]
          </span>
          <span v-if="entry.type === 'http' && entry.httpDetail" class="log-message">
            <span :class="entry.httpDetail.status ? statusClass(entry.httpDetail.status) : (entry.httpDetail.error ? 'status-error' : '')">
              {{ entry.httpDetail.status ? entry.httpDetail.status : (entry.httpDetail.error ? '✗' : '✓') }}
            </span>
            {{ ' ' }}{{ entry.httpDetail.method }} {{ entry.httpDetail.url }}
            <span class="log-elapsed" v-if="entry.httpDetail.elapsed">{{ entry.httpDetail.elapsed }}ms</span>
          </span>
          <span v-else class="log-message">{{ entry.message }}</span>
          <span v-if="entry.type === 'http' && entry.httpDetail" class="log-expand-icon">
            {{ expandedIds.has(entry.id) ? '▾' : '▸' }}
          </span>
        </div>

        <!-- HTTP 详情展开面板 -->
        <div v-if="expandedIds.has(entry.id) && entry.httpDetail" class="http-detail">
          <!-- 详情标签栏 -->
          <div class="http-detail__tabs">
            <button
              class="http-detail__tab"
              :class="{ 'http-detail__tab--active': (activeTab[entry.id] || 'headers') === 'headers' }"
              @click.stop="setTab(entry.id, 'headers')"
            >Headers</button>
            <button
              class="http-detail__tab"
              :class="{ 'http-detail__tab--active': activeTab[entry.id] === 'response' }"
              @click.stop="setTab(entry.id, 'response')"
            >Response</button>
            <button
              v-if="entry.httpDetail.method === 'POST' && entry.httpDetail.requestBody"
              class="http-detail__tab"
              :class="{ 'http-detail__tab--active': activeTab[entry.id] === 'request' }"
              @click.stop="setTab(entry.id, 'request')"
            >Request Body</button>
          </div>

          <!-- Headers 面板 -->
          <div v-if="(activeTab[entry.id] || 'headers') === 'headers'" class="http-detail__content">
            <div class="http-detail__section">
              <div class="http-detail__section-title">General</div>
              <div class="http-detail__kv">
                <span class="http-detail__key">Request URL:</span>
                <span class="http-detail__value">{{ entry.httpDetail.url }}</span>
              </div>
              <div class="http-detail__kv">
                <span class="http-detail__key">Request Method:</span>
                <span class="http-detail__value">{{ entry.httpDetail.method }}</span>
              </div>
              <div class="http-detail__kv">
                <span class="http-detail__key">Status Code:</span>
                <span class="http-detail__value" :class="statusClass(entry.httpDetail.status)">
                  {{ entry.httpDetail.status || 'N/A' }}
                </span>
              </div>
              <div class="http-detail__kv">
                <span class="http-detail__key">Elapsed:</span>
                <span class="http-detail__value">{{ entry.httpDetail.elapsed }}ms</span>
              </div>
              <div v-if="entry.httpDetail.error" class="http-detail__kv">
                <span class="http-detail__key">Error:</span>
                <span class="http-detail__value status-error">{{ entry.httpDetail.error }}</span>
              </div>
            </div>
            <div v-if="Object.keys(entry.httpDetail.responseHeaders).length" class="http-detail__section">
              <div class="http-detail__section-title">Response Headers</div>
              <div v-for="(v, k) in entry.httpDetail.responseHeaders" :key="k" class="http-detail__kv">
                <span class="http-detail__key">{{ k }}:</span>
                <span class="http-detail__value">{{ v }}</span>
              </div>
            </div>
            <div v-if="Object.keys(entry.httpDetail.requestHeaders).length" class="http-detail__section">
              <div class="http-detail__section-title">Request Headers</div>
              <div v-for="(v, k) in entry.httpDetail.requestHeaders" :key="k" class="http-detail__kv">
                <span class="http-detail__key">{{ k }}:</span>
                <span class="http-detail__value">{{ v }}</span>
              </div>
            </div>
          </div>

          <!-- Response Body 面板 -->
          <div v-if="activeTab[entry.id] === 'response'" class="http-detail__content">
            <pre class="http-detail__body">{{ entry.httpDetail.responseBody || '(empty)' }}</pre>
          </div>

          <!-- Request Body 面板 (POST only) -->
          <div v-if="activeTab[entry.id] === 'request'" class="http-detail__content">
            <pre class="http-detail__body">{{ entry.httpDetail.requestBody || '(empty)' }}</pre>
          </div>
        </div>
      </template>
    </div>

    <!-- 状态栏 -->
    <div class="log-statusbar">
      <span>共 {{ counts.all }} 条</span>
      <span v-if="filterType !== 'all' || filterText || filterSource">（已过滤显示 {{ filteredLogs.length }} 条）</span>
      <span v-if="paused" class="log-statusbar__paused">⏸ 已暂停</span>
    </div>
  </div>
</template>

<style scoped>
.log-viewer {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #0e0e10;
  color: #d4d4d8;
  font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace;
  font-size: 13px;
}

/* ── 工具栏 ── */
.log-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  background: #18181b;
  border-bottom: 1px solid #27272a;
  flex-shrink: 0;
  user-select: none;
}

.log-toolbar__left,
.log-toolbar__right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.log-toolbar__title {
  font-weight: 600;
  font-size: 14px;
  color: #fafafa;
  margin-right: 8px;
  white-space: nowrap;
}

.log-toolbar__filters {
  display: flex;
  gap: 4px;
}

.log-filter-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  font-size: 12px;
  border: 1px solid #3f3f46;
  border-radius: 4px;
  background: transparent;
  color: #a1a1aa;
  cursor: pointer;
  transition: all 120ms ease;
  font-family: inherit;
}
.log-filter-btn:hover {
  background: #27272a;
  color: #d4d4d8;
}
.log-filter-btn--active {
  background: #27272a;
  border-color: #6366f1;
  color: #a5b4fc;
}

.log-filter-count {
  font-size: 10px;
  opacity: 0.6;
}

/* ── 书源筛选下拉框 ── */
.log-source-select {
  padding: 4px 8px;
  font-size: 12px;
  border: 1px solid #3f3f46;
  border-radius: 4px;
  background: #09090b;
  color: #d4d4d8;
  outline: none;
  font-family: inherit;
  max-width: 180px;
  cursor: pointer;
}
.log-source-select:focus {
  border-color: #6366f1;
}
.log-source-select option {
  background: #18181b;
  color: #d4d4d8;
}

.log-search {
  width: 180px;
  padding: 4px 8px;
  font-size: 12px;
  border: 1px solid #3f3f46;
  border-radius: 4px;
  background: #09090b;
  color: #d4d4d8;
  outline: none;
  font-family: inherit;
}
.log-search:focus {
  border-color: #6366f1;
}
.log-search::placeholder {
  color: #52525b;
}

.log-action-btn {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #3f3f46;
  border-radius: 4px;
  background: transparent;
  color: #a1a1aa;
  cursor: pointer;
  font-size: 14px;
  transition: all 120ms ease;
}
.log-action-btn:hover {
  background: #27272a;
  color: #fafafa;
}
.log-action-btn--active {
  border-color: #6366f1;
  color: #a5b4fc;
}

/* ── 日志列表 ── */
.log-list {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px 0;
}

.log-list::-webkit-scrollbar {
  width: 6px;
}
.log-list::-webkit-scrollbar-track {
  background: transparent;
}
.log-list::-webkit-scrollbar-thumb {
  background: #3f3f46;
  border-radius: 3px;
}
.log-list::-webkit-scrollbar-thumb:hover {
  background: #52525b;
}

.log-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #52525b;
  font-size: 14px;
}

.log-entry {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 2px 12px;
  line-height: 1.6;
  word-break: break-all;
}
.log-entry:hover {
  background: rgba(255, 255, 255, 0.03);
}
.log-entry--clickable {
  cursor: pointer;
}
.log-entry--clickable:hover {
  background: rgba(255, 255, 255, 0.06);
}
.log-entry--expanded {
  background: rgba(99, 102, 241, 0.08);
}

.log-time {
  flex-shrink: 0;
  color: #52525b;
  font-size: 12px;
}

.log-source {
  flex-shrink: 0;
  font-size: 11px;
  color: #818cf8;
  background: rgba(99, 102, 241, 0.12);
  padding: 0 5px;
  border-radius: 3px;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.log-type {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  min-width: 65px;
}

.log-message {
  color: #d4d4d8;
  white-space: pre-wrap;
  flex: 1;
  min-width: 0;
}

.log-elapsed {
  color: #71717a;
  font-size: 11px;
  margin-left: 6px;
}

.log-expand-icon {
  flex-shrink: 0;
  color: #71717a;
  font-size: 12px;
  width: 16px;
  text-align: center;
}

/* ── HTTP 状态码颜色 ── */
.status-ok {
  color: #4ade80;
}
.status-redirect {
  color: #fbbf24;
}
.status-error {
  color: #f87171;
}
.status-unknown {
  color: #71717a;
}

/* ── HTTP 详情展开面板 ── */
.http-detail {
  margin: 0 12px 4px 12px;
  border: 1px solid #27272a;
  border-radius: 6px;
  background: #131316;
  overflow: hidden;
}

.http-detail__tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid #27272a;
  background: #18181b;
}

.http-detail__tab {
  padding: 6px 16px;
  font-size: 12px;
  font-family: inherit;
  color: #a1a1aa;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: all 120ms ease;
}
.http-detail__tab:hover {
  color: #d4d4d8;
  background: rgba(255, 255, 255, 0.03);
}
.http-detail__tab--active {
  color: #a5b4fc;
  border-bottom-color: #6366f1;
}

.http-detail__content {
  padding: 8px 12px;
  max-height: 400px;
  overflow-y: auto;
}

.http-detail__content::-webkit-scrollbar {
  width: 4px;
}
.http-detail__content::-webkit-scrollbar-thumb {
  background: #3f3f46;
  border-radius: 2px;
}

.http-detail__section {
  margin-bottom: 12px;
}
.http-detail__section:last-child {
  margin-bottom: 0;
}

.http-detail__section-title {
  font-size: 11px;
  font-weight: 600;
  color: #818cf8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
  padding-bottom: 3px;
  border-bottom: 1px solid #1e1e22;
}

.http-detail__kv {
  display: flex;
  gap: 8px;
  padding: 1px 0;
  line-height: 1.5;
  font-size: 12px;
}

.http-detail__key {
  flex-shrink: 0;
  color: #a1a1aa;
  font-weight: 500;
}

.http-detail__value {
  color: #d4d4d8;
  word-break: break-all;
}

.http-detail__body {
  margin: 0;
  padding: 8px;
  background: #0e0e10;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.5;
  color: #d4d4d8;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 350px;
  overflow-y: auto;
}

/* ── 状态栏 ── */
.log-statusbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  font-size: 11px;
  color: #71717a;
  background: #18181b;
  border-top: 1px solid #27272a;
  flex-shrink: 0;
}

.log-statusbar__paused {
  color: #f59e0b;
  font-weight: 600;
}
</style>
