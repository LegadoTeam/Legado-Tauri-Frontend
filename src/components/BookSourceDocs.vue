<script setup lang="ts">
/**
 * BookSourceDocs — 书源开发文档
 *
 * 以 Monaco Editor（只读）展示所有内置 JS API 的说明与可运行示例代码。
 * 左侧为章节导航，右侧为对应的代码示例 + 文字说明。
 */

import { ref, shallowRef, computed } from 'vue'
import { VueMonacoEditor, type MonacoEditor } from '@guolao/vue-monaco-editor'
import type * as monaco from 'monaco-editor'

// ── 文档章节定义 ──────────────────────────────────────────────────────────────

interface DocSection {
  id: string
  title: string
  badge?: string       // 标签：'必须' | '可选' | 'API' | '数据结构' 等
  badgeType?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info'
  desc: string         // 章节说明（支持换行）
  code: string         // 示例代码（JavaScript）
}

const sections: DocSection[] = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'quickstart',
    title: '快速开始',
    badge: '示例',
    badgeType: 'primary',
    desc: '一个完整的、可直接运行的最小书源示例。复制后修改 BASE_URL 即可用于真实站点。\n所有 API 均为同步调用，无需 async/await。',
    code: `// @name        示例书源
// @version     1.0.0
// @author      你的名字
// @url         https://www.example.com
// @group       默认
// @logo        default
// @enabled     true
// @description 这是一个最小可用的书源模板

const BASE_URL = 'https://www.example.com'

// ── 必须实现：搜索 ────────────────────────────────────────
function search(key, page) {
  const resp = legado.http.get(
    BASE_URL + '/api/search?q=' + encodeURIComponent(key) + '&page=' + page
  )
  const json = JSON.parse(resp)
  return json.list.map(item => ({
    name:    item.title,
    author:  item.author,
    bookUrl: BASE_URL + '/book/' + item.id,
    coverUrl: item.cover_url,
    intro:   item.summary,
  }))
}

// ── 必须实现：书籍详情 ────────────────────────────────────
function bookInfo(bookUrl) {
  const resp = legado.http.get(bookUrl)
  const json = JSON.parse(resp)
  return {
    name:    json.title,
    author:  json.author,
    bookUrl: bookUrl,
    tocUrl:  bookUrl + '/toc',
    intro:   json.summary,
    coverUrl: json.cover_url,
  }
}

// ── 必须实现：目录 ────────────────────────────────────────
function toc(tocUrl) {
  const resp = legado.http.get(tocUrl)
  const json = JSON.parse(resp)
  return json.chapters.map(ch => ({
    name: ch.title,
    url:  BASE_URL + '/chapter/' + ch.id,
  }))
}

// ── 必须实现：正文 ────────────────────────────────────────
function content(chapterUrl) {
  const resp = legado.http.get(chapterUrl)
  const json = JSON.parse(resp)
  return json.content   // 返回纯文本字符串
}`,
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'http-get',
    title: 'legado.http.get',
    badge: 'API',
    badgeType: 'info',
    desc: '发起同步 HTTP GET 请求，直接返回响应体字符串。\n网络异常时抛出 JS 异常，可用 try/catch 捕获。\n\n注意：Boa 引擎不支持 Promise，所有网络请求均为同步阻塞，无需 await。',
    code: `// ─── 基本用法 ─────────────────────────────────────────────
const html = legado.http.get('https://www.example.com/page')

// ─── 解析 JSON 响应 ───────────────────────────────────────
const resp = legado.http.get('https://api.example.com/books')
const data = JSON.parse(resp)
legado.log('共 ' + data.total + ' 本书')

// ─── URL 拼接 ─────────────────────────────────────────────
const BASE_URL = 'https://www.example.com'
const keyword  = '三体'
const page     = 1

const result = legado.http.get(
  BASE_URL + '/search?q=' + encodeURIComponent(keyword) + '&page=' + page
)

// ─── 错误处理 ─────────────────────────────────────────────
function safeGet(url) {
  try {
    return legado.http.get(url)
  } catch (e) {
    legado.log('请求失败: ' + e.message)
    return null
  }
}`,
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'http-post',
    title: 'legado.http.post',
    badge: 'API',
    badgeType: 'info',
    desc: '发起同步 HTTP POST 请求。body 为请求体字符串，可传 form 表单或 JSON 字符串。\n默认 Content-Type 为 application/x-www-form-urlencoded。',
    code: `// ─── 发送 Form 表单 ──────────────────────────────────────
const resp = legado.http.post(
  'https://www.example.com/login',
  'username=myuser&password=mypass'
)
const result = JSON.parse(resp)
const token = result.token

// ─── 发送 JSON 请求体 ─────────────────────────────────────
const body = JSON.stringify({ keyword: '三体', page: 1 })
const resp2 = legado.http.post('https://api.example.com/search', body)
const data  = JSON.parse(resp2)

// ─── Cookie / Session 登录场景 ────────────────────────────
// 先 POST 登录获取 cookie（注：Boa 引擎暂不支持自定义 headers）
// 建议将登录 token 存入配置以持久化
function login(user, pass) {
  const resp = legado.http.post(
    'https://www.example.com/api/login',
    'user=' + encodeURIComponent(user) +
    '&pass=' + encodeURIComponent(pass)
  )
  const json = JSON.parse(resp)
  if (json.code === 0) {
    legado.config.write('my_source.js', 'token', json.data.token)
    return json.data.token
  }
  throw new Error('登录失败: ' + json.message)
}`,
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'config',
    title: 'legado.config',
    badge: 'API',
    badgeType: 'info',
    desc: '持久化配置读写。以 scope（通常为书源文件名）隔离，各书源互不影响。\n字符串接口存储于 <scope>.json，字节接口存储于 <scope>.bin.json。\n数据在应用重启后仍然保留。',
    code: `// ─── 字符串读写 ───────────────────────────────────────────
const SCOPE = 'my_source.js'   // 建议用书源文件名

// 写入
legado.config.write(SCOPE, 'token', 'eyJhbGciOiJSUzI1...')
legado.config.write(SCOPE, 'lastPage', String(42))

// 读取（键不存在时返回空字符串 ''）
const token = legado.config.read(SCOPE, 'token')
const page  = Number(legado.config.read(SCOPE, 'lastPage') || '1')

// ─── 存储复杂对象 ─────────────────────────────────────────
const state = { token: 'abc', userId: 123, expire: Date.now() + 3600000 }
legado.config.write(SCOPE, 'state', JSON.stringify(state))

const raw   = legado.config.read(SCOPE, 'state')
const saved = raw ? JSON.parse(raw) : null

// ─── 字节数组读写（适合存储二进制数据） ─────────────────────
// 写入：将字符串编码为 UTF-8 字节数组
function writeText(key, text) {
  const encoded = Array.from(
    new TextEncoder().encode(text)   // Uint8Array → number[]
  )
  legado.config.writeBytes(SCOPE, key, encoded)
}

// 读取：将字节数组解码回字符串
function readText(key) {
  const bytes = legado.config.readBytes(SCOPE, key)  // number[]
  return new TextDecoder().decode(new Uint8Array(bytes))
}

writeText('cache', '<html>...</html>')
const html = readText('cache')`,
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'log',
    title: 'legado.log',
    badge: 'API',
    badgeType: 'info',
    desc: '打印日志到 stderr 并通过 script:log 事件推送到调试面板。\n支持任意类型，对象会自动序列化为字符串。',
    code: `// ─── 基本用法 ─────────────────────────────────────────────
legado.log('开始搜索: ' + keyword)
legado.log(42)
legado.log({ status: 'ok', count: 5 })

// ─── 调试请求 ─────────────────────────────────────────────
function debugGet(url) {
  legado.log('[GET] ' + url)
  const resp = legado.http.get(url)
  legado.log('[RSP] 长度=' + resp.length + ' 前100字符: ' + resp.slice(0, 100))
  return resp
}

// ─── 函数追踪 ─────────────────────────────────────────────
function search(key, page) {
  legado.log('search called: key=' + key + ' page=' + page)

  const resp = legado.http.get(
    'https://api.example.com/search?q=' + encodeURIComponent(key)
  )
  const list = JSON.parse(resp).list ?? []
  legado.log('search result count: ' + list.length)
  return list
}`,
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'ui-emit',
    title: 'legado.ui.emit',
    badge: 'API',
    badgeType: 'info',
    desc: '向前端 webview 推送自定义事件。前端通过 listen(\'script:ui\', ...) 接收。\n适合需要与 UI 深度交互的高级书源（如进度更新、自定义弹窗等）。',
    code: `// ─── 推送进度 ─────────────────────────────────────────────
function toc(tocUrl) {
  const chapters = []
  const pages    = 5   // 假设有 5 页目录

  for (let p = 1; p <= pages; p++) {
    legado.ui.emit('progress', { current: p, total: pages, hint: '加载目录...' })

    const resp = legado.http.get(tocUrl + '?page=' + p)
    const list = JSON.parse(resp).list ?? []
    list.forEach(ch => chapters.push({ name: ch.title, url: ch.url }))
  }

  legado.ui.emit('progress', { current: pages, total: pages, hint: '目录加载完成' })
  return chapters
}

// ─── 前端监听示例（Vue 组件中）────────────────────────────
// import { listen } from '@tauri-apps/api/event'
//
// const unlisten = await listen('script:ui', (event) => {
//   const { event: evtName, data } = event.payload
//   if (evtName === 'progress') {
//     console.log('进度:', data.current, '/', data.total, data.hint)
//   }
// })`,
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'search',
    title: 'function search()',
    badge: '必须',
    badgeType: 'error',
    desc: '搜索书籍，引擎在用户搜索时调用。\n返回 BookItem 数组，字段含义见下方数据结构章节。\n关键词通过参数传入，不要硬编码。',
    code: `/**
 * 搜索书籍
 * @param {string} key   搜索关键词
 * @param {number} page  页码，从 1 开始
 * @returns {BookItem[]}
 */
function search(key, page) {
  const resp = legado.http.get(
    'https://api.example.com/search' +
    '?keyword=' + encodeURIComponent(key) +
    '&page='    + page
  )
  const json = JSON.parse(resp)

  // 将站点数据映射为 BookItem 格式
  return (json.data?.list ?? []).map(book => ({
    name:          book.title,        // 书名（必填）
    bookUrl:       'https://api.example.com/book/' + book.id,  // 书籍 URL（必填）
    author:        book.author,       // 作者（可选）
    coverUrl:      book.cover,        // 封面图片 URL（可选）
    intro:         book.summary,      // 简介（可选）
    latestChapter: book.last_chapter, // 最新章节（可选）
    tocUrl:        'https://api.example.com/toc/' + book.id,   // 目录 URL（可选）
  }))
}`,
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'bookinfo',
    title: 'function bookInfo()',
    badge: '必须',
    badgeType: 'error',
    desc: '获取书籍详情页信息，用户进入书架/书籍主页时调用。\n需要返回封面、简介、目录入口 URL 等完整信息。',
    code: `/**
 * 获取书籍详情
 * @param {string} bookUrl  书籍主页 URL（来自 search 返回的 bookUrl）
 * @returns {BookItem}
 */
function bookInfo(bookUrl) {
  const resp = legado.http.get(bookUrl)
  const json = JSON.parse(resp)
  const book = json.data

  return {
    name:          book.title,
    author:        book.author,
    bookUrl:       bookUrl,
    // tocUrl 可以与 bookUrl 不同，也可以复用
    tocUrl:        bookUrl + '/chapters',
    coverUrl:      book.cover_url,
    intro:         book.intro,
    latestChapter: book.last_chapter_title,
  }
}`,
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'toc',
    title: 'function toc()',
    badge: '必须',
    badgeType: 'error',
    desc: '获取章节目录列表，用户加载书籍章节列表时调用。\n若章节跨多页，需在函数内循环请求并合并结果。',
    code: `/**
 * 获取目录列表
 * @param {string} tocUrl  目录页 URL（来自 bookInfo 返回的 tocUrl）
 * @returns {ChapterInfo[]}
 */
function toc(tocUrl) {
  const resp = legado.http.get(tocUrl)
  const json = JSON.parse(resp)

  return (json.data?.chapters ?? []).map(ch => ({
    name: ch.title,                                       // 章节名（必填）
    url:  'https://api.example.com/chapter/' + ch.id,   // 章节 URL（必填）
  }))
}

// ─── 多页目录示例 ──────────────────────────────────────────
function toc(tocUrl) {
  const all = []
  let page  = 1

  while (true) {
    const resp = legado.http.get(tocUrl + '?page=' + page)
    const json = JSON.parse(resp)
    const list = json.data?.list ?? []

    if (list.length === 0) break

    list.forEach(ch => all.push({
      name: ch.title,
      url:  'https://api.example.com/chapter/' + ch.id,
    }))

    if (!json.data?.hasMore) break
    page++
  }

  return all
}`,
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'content',
    title: 'function content()',
    badge: '必须',
    badgeType: 'error',
    desc: '获取章节正文，阅读器翻页时调用。\n返回纯文本字符串（不含 HTML 标签），段落间用 \\n 或 \\n\\n 分隔。',
    code: `/**
 * 获取章节正文
 * @param {string} chapterUrl  章节 URL（来自 toc 返回的 url）
 * @returns {string}  纯文本正文
 */
function content(chapterUrl) {
  const resp = legado.http.get(chapterUrl)
  const json = JSON.parse(resp)

  // 如果接口直接返回纯文本数组
  if (Array.isArray(json.data?.paragraphs)) {
    return json.data.paragraphs.join('\\n')
  }

  // 如果接口返回 HTML，剥离标签
  const html = json.data?.content ?? ''
  return html
    .replace(/<br\\s*\\/?>/gi, '\\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim()
}`,
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'explore',
    title: 'function explore()',
    badge: '可选',
    badgeType: 'warning',
    desc: '发现页推荐书目，书源不实现此函数则发现页跳过该书源。\n返回 ExploreItem 数组，包含书名、URL、分类标签等。',
    code: `/**
 * 发现页 — 热门/分类/推荐书目（可选）
 * @param {number} page  页码，从 1 开始
 * @returns {ExploreItem[]}
 */
function explore(page) {
  const resp = legado.http.get(
    'https://api.example.com/discover?page=' + page
  )
  const json = JSON.parse(resp)

  return (json.data?.list ?? []).map(book => ({
    name:     book.title,           // 书名（必填）
    bookUrl:  'https://api.example.com/book/' + book.id,  // 书籍 URL（必填）
    author:   book.author,          // 作者（可选）
    coverUrl: book.cover_url,       // 封面（可选）
    intro:    book.summary,         // 简介（可选）
    type:     book.category,        // 分类标签，如 "玄幻" "都市"（可选）
  }))
}`,
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'types',
    title: '数据结构',
    badge: '参考',
    badgeType: 'default',
    desc: '书源函数的参数与返回值类型定义（与 Monaco 编辑器中的 IntelliSense 完全一致）。',
    code: `// ── BookItem — 书籍搜索 / 详情 ───────────────────────────────
interface BookItem {
  name:           string    // 【必填】书名
  bookUrl:        string    // 【必填】书籍主页 URL

  author?:        string    // 作者
  coverUrl?:      string    // 封面图片 URL
  intro?:         string    // 简介
  latestChapter?: string    // 最新章节标题
  tocUrl?:        string    // 目录入口 URL（若与 bookUrl 相同可不填）
}

// ── ChapterInfo — 章节目录 ────────────────────────────────────
interface ChapterInfo {
  name: string    // 【必填】章节名
  url:  string    // 【必填】章节内容 URL
}

// ── ExploreItem — 发现页条目 ──────────────────────────────────
interface ExploreItem {
  name:     string    // 【必填】书名
  bookUrl:  string    // 【必填】书籍 URL

  author?:  string    // 作者
  coverUrl?: string   // 封面
  intro?:   string    // 简介
  type?:    string    // 分类标签，如 "玄幻" "都市" "历史"
}

// ── legado 全局 namespace（Boa 引擎注入）────────────────────────
declare namespace legado {
  namespace http {
    function get(url: string): string
    function post(url: string, body?: string): string
  }
  namespace config {
    function read(scope: string, key: string): string
    function write(scope: string, key: string, value: string): void
    function readBytes(scope: string, key: string): number[]
    function writeBytes(scope: string, key: string, value: number[]): void
  }
  function log(msg: unknown): void
  namespace ui {
    function emit(event: string, data?: unknown): void
  }
}`,
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'tips',
    title: '调试技巧',
    badge: '提示',
    badgeType: 'success',
    desc: '在"调试书源"面板中可以连接测试、搜索测试、Boa 引擎加载测试。\n以下是一些常用的调试辅助代码片段，可粘贴到编辑器末尾临时使用。',
    code: `// ─── 在编辑器中临时测试（保存后切换到"调试书源"面板运行）────

// 1. 打印所有已定义的函数
const defined = Object.keys(this).filter(k => typeof this[k] === 'function')
legado.log('已定义函数: ' + defined.join(', '))

// 2. 测试 HTTP 请求是否通畅
const BASE_URL = 'https://api.example.com'
try {
  const resp = legado.http.get(BASE_URL)
  legado.log('连接成功，响应长度: ' + resp.length)
} catch (e) {
  legado.log('连接失败: ' + e.message)
}

// 3. 格式化打印 JSON
function logJson(data) {
  legado.log(JSON.stringify(data, null, 2))
}

// 4. 安全取值（防止 undefined 访问导致崩溃）
function safeGet(obj, path, fallback) {
  return path.split('.').reduce(
    (cur, key) => (cur != null ? cur[key] : undefined),
    obj
  ) ?? fallback
}

// 5. 简单重试机制
function getWithRetry(url, retries) {
  for (let i = 0; i < retries; i++) {
    try {
      return legado.http.get(url)
    } catch (e) {
      legado.log('第 ' + (i + 1) + ' 次请求失败: ' + e.message)
    }
  }
  throw new Error('请求失败，重试 ' + retries + ' 次后放弃')
}

// 6. 书源自检（把以下代码贴到书源末尾，调试面板 eval 时会自动执行）
legado.log('=== 书源完整性检查 ===')
const required = ['search', 'bookInfo', 'toc', 'content']
required.forEach(fn => {
  const ok = typeof eval(fn) === 'function'
  legado.log((ok ? '✓' : '✗') + ' ' + fn)
})`,
  },
]

// ── 状态 ──────────────────────────────────────────────────────────────────

const activeSectionId = ref(sections[0].id)

const activeSection = computed(
  () => sections.find(s => s.id === activeSectionId.value) ?? sections[0]
)

/** Monaco Editor 实例 */
const editorRef = shallowRef<monaco.editor.IStandaloneCodeEditor | null>(null)

const monacoTheme = 'legado-dark'

// ── Monaco 配置 ───────────────────────────────────────────────────────────

function handleBeforeMount(monacoInstance: MonacoEditor) {
  // 与书源编辑器保持一致的自定义深色主题（复用定义，重复定义无副作用）
  monacoInstance.editor.defineTheme('legado-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment',           foreground: '6b7280', fontStyle: 'italic' },
      { token: 'comment.line',      foreground: '6b7280', fontStyle: 'italic' },
      { token: 'comment.block',     foreground: '6b7280', fontStyle: 'italic' },
      { token: 'keyword',           foreground: 'c084fc', fontStyle: 'bold' },
      { token: 'string',            foreground: '86efac' },
      { token: 'number',            foreground: 'fb923c' },
      { token: 'entity.name.function', foreground: '60a5fa' },
      { token: 'variable',          foreground: 'e4e4e7' },
      { token: 'variable.parameter',foreground: 'fbbf24' },
      { token: 'delimiter',         foreground: '94a3b8' },
      { token: 'operator',          foreground: '818cf8' },
    ],
    colors: {
      'editor.background':               '#18181b',
      'editor.foreground':               '#d4d4d8',
      'editor.lineHighlightBackground':  '#27272a',
      'editor.lineHighlightBorder':      '#3f3f46',
      'editor.selectionBackground':      '#4f46e580',
      'editorCursor.foreground':         '#818cf8',
      'editorLineNumber.foreground':     '#52525b',
      'editorLineNumber.activeForeground': '#a1a1aa',
      'editorIndentGuide.background':    '#3f3f46',
      'editorIndentGuide.activeBackground': '#6366f1',
      'minimap.background':              '#18181b',
      'scrollbarSlider.background':      '#3f3f4660',
      'scrollbarSlider.hoverBackground': '#52525b80',
      'editorWidget.background':         '#1e1e21',
      'editorWidget.border':             '#3f3f46',
    },
  })
}

function handleEditorMount(editor: monaco.editor.IStandaloneCodeEditor) {
  editorRef.value = editor
}

// ── 复制代码 ──────────────────────────────────────────────────────────────

const copied = ref(false)

async function copyCode() {
  await navigator.clipboard.writeText(activeSection.value.code)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}
</script>

<template>
  <div class="bsd-root">
    <!-- 左侧章节导航 -->
    <nav class="bsd-nav">
      <div
        v-for="sec in sections"
        :key="sec.id"
        class="bsd-nav__item"
        :class="{ 'bsd-nav__item--active': sec.id === activeSectionId }"
        @click="activeSectionId = sec.id"
      >
        <span class="bsd-nav__title">{{ sec.title }}</span>
        <n-tag
          v-if="sec.badge"
          :type="sec.badgeType ?? 'default'"
          size="tiny"
          :bordered="false"
          class="bsd-nav__badge"
        >{{ sec.badge }}</n-tag>
      </div>
    </nav>

    <!-- 右侧内容区 -->
    <div class="bsd-content">
      <!-- 章节标题 -->
      <div class="bsd-content__header">
        <div class="bsd-content__title-row">
          <code class="bsd-content__title">{{ activeSection.title }}</code>
          <n-tag
            v-if="activeSection.badge"
            :type="activeSection.badgeType ?? 'default'"
            size="small"
            :bordered="false"
          >{{ activeSection.badge }}</n-tag>
        </div>
        <!-- 说明文字 -->
        <p
          v-for="(line, i) in activeSection.desc.split('\n')"
          :key="i"
          class="bsd-content__desc"
        >{{ line }}</p>
      </div>

      <!-- 代码块 + 复制按钮 -->
      <div class="bsd-editor-wrap">
        <n-button
          size="tiny"
          class="bsd-copy-btn"
          :type="copied ? 'success' : 'default'"
          @click="copyCode"
        >
          {{ copied ? '已复制！' : '复制代码' }}
        </n-button>
        <VueMonacoEditor
          :value="activeSection.code"
          language="javascript"
          :theme="monacoTheme"
          :options="{
            readOnly: true,
            fontSize: 13,
            lineHeight: 20,
            fontFamily: '\'Cascadia Code\', \'JetBrains Mono\', Consolas, monospace',
            fontLigatures: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            renderLineHighlight: 'none',
            lineNumbers: 'on',
            folding: true,
            wordWrap: 'off',
            scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
            contextmenu: false,
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            padding: { top: 12, bottom: 12 },
          }"
          class="bsd-editor"
          @before-mount="handleBeforeMount"
          @mount="handleEditorMount"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.bsd-root {
  display: flex;
  height: 100%;
  overflow: hidden;
  gap: 0;
}

/* ── 左侧导航 ── */
.bsd-nav {
  width: 168px;
  flex-shrink: 0;
  overflow-y: auto;
  padding: 8px 6px;
  border-right: 1px solid var(--color-border, #3f3f46);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.bsd-nav__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  padding: 5px 8px;
  border-radius: 5px;
  cursor: pointer;
  transition: background var(--transition-fast, 0.15s), color var(--transition-fast, 0.15s);
  color: var(--color-text-muted, #a1a1aa);
}

.bsd-nav__item:hover {
  background: var(--color-surface-raised, #27272a);
  color: var(--color-text-primary, #e4e4e7);
}

.bsd-nav__item--active {
  background: var(--color-accent-dim, rgba(99,102,241,0.15));
  color: var(--color-accent, #818cf8);
}

.bsd-nav__title {
  font-size: 0.8rem;
  font-family: 'Cascadia Code', Consolas, monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.bsd-nav__badge {
  flex-shrink: 0;
}

/* ── 右侧内容 ── */
.bsd-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.bsd-content__header {
  padding: 14px 18px 10px;
  border-bottom: 1px solid var(--color-border, #3f3f46);
  flex-shrink: 0;
}

.bsd-content__title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.bsd-content__title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-accent, #818cf8);
  font-family: 'Cascadia Code', Consolas, monospace;
  background: var(--color-surface-raised, #27272a);
  padding: 2px 8px;
  border-radius: 4px;
}

.bsd-content__desc {
  font-size: 0.82rem;
  color: var(--color-text-secondary, #a1a1aa);
  line-height: 1.6;
  margin: 0;
}

.bsd-content__desc:empty::after {
  content: '\00a0';
}

/* ── 编辑器区 ── */
.bsd-editor-wrap {
  flex: 1;
  min-height: 0;
  position: relative;
}

.bsd-editor {
  width: 100%;
  height: 100%;
}

.bsd-copy-btn {
  position: absolute;
  top: 10px;
  right: 18px;
  z-index: 10;
  opacity: 0.7;
  transition: opacity 0.15s;
}

.bsd-copy-btn:hover {
  opacity: 1;
}
</style>
