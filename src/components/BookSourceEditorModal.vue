<script setup lang="ts">
/**
 * BookSourceEditorModal — 内嵌 Monaco Editor 的书源代码编辑弹窗
 *
 * 特性：
 *  - Monaco Editor（VS Code 同款引擎，离线可用）
 *  - JavaScript / TypeScript 语言支持（语法高亮、IntelliSense、类型检查）
 *  - JSON 语言支持
 *  - 自动补全、括号匹配、代码折叠、Minimap
 *  - 内置格式化（Shift+Alt+F）
 *  - Ctrl/Cmd+S 快捷键保存
 *  - 自动跟随应用明暗主题
 *  - 自定义书源 API 类型提示（BookSourceContext）
 */

import { ref, computed, watch, shallowRef } from 'vue'
import { VueMonacoEditor, type MonacoEditor } from '@guolao/vue-monaco-editor'
import type * as monaco from 'monaco-editor'

// ── Props & Emits ────────────────────────────────────────────────────────────

const props = defineProps<{
  show: boolean
  title: string
  content: string
  fileName: string
  saving: boolean
  reloaded: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  'update:content': [value: string]
  save: []
  'open-vscode': []
}>()

// ── 内部状态 ─────────────────────────────────────────────────────────────────

/** Monaco Editor 实例（shallowRef 避免深度响应式） */
const editorRef = shallowRef<monaco.editor.IStandaloneCodeEditor | null>(null)

/** 根据文件名推断语言 */
const language = computed(() => {
  const n = props.fileName
  if (n.endsWith('.ts')) return 'typescript'
  if (n.endsWith('.json')) return 'json'
  return 'javascript' // 默认：书源 JS 脚本
})

/** 固定使用与应用侧边栏风格一致的自定义深色主题 */
const monacoTheme = 'legado-dark'

/** 本地缓存内容，避免 v-model 与 Monaco 内部绑定冲突 */
const localContent = ref(props.content)

watch(
  () => props.content,
  (v) => {
    if (v !== localContent.value) localContent.value = v
  },
)

function handleContentChange(v: string | undefined) {
  localContent.value = v ?? ''
  emit('update:content', localContent.value)
}

// ── Monaco 全局选项配置 ───────────────────────────────────────────────────────

/**
 * 在 Monaco 实例就绪后配置 TypeScript/JavaScript 语言服务
 * 包含书源脚本常用的类型定义，提供 IntelliSense 补全
 */
function handleBeforeMount(monacoInstance: MonacoEditor) {
  // ─ 自定义深色主题（与应用侧边栏 #1c1c1f 风格一致） ──────────────────────────
  monacoInstance.editor.defineTheme('legado-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      // 注释
      { token: 'comment',           foreground: '6b7280', fontStyle: 'italic' },
      { token: 'comment.line',      foreground: '6b7280', fontStyle: 'italic' },
      { token: 'comment.block',     foreground: '6b7280', fontStyle: 'italic' },
      // 关键字
      { token: 'keyword',           foreground: 'c084fc', fontStyle: 'bold' },
      { token: 'keyword.control',   foreground: 'c084fc' },
      // 字符串
      { token: 'string',            foreground: '86efac' },
      { token: 'string.escape',     foreground: '6ee7b7' },
      // 数字
      { token: 'number',            foreground: 'fb923c' },
      // 函数 / 方法
      { token: 'entity.name.function', foreground: '60a5fa' },
      { token: 'support.function',     foreground: '60a5fa' },
      // 类型
      { token: 'entity.name.type',  foreground: '34d399' },
      { token: 'support.type',      foreground: '34d399' },
      // 变量 / 参数
      { token: 'variable',          foreground: 'e4e4e7' },
      { token: 'variable.parameter',foreground: 'fbbf24' },
      // 运算符 / 标点
      { token: 'delimiter',         foreground: '94a3b8' },
      { token: 'operator',          foreground: '818cf8' },
      // 标签 / 注解
      { token: 'tag',               foreground: 'f87171' },
      { token: 'metatag',           foreground: 'f472b6' },
    ],
    colors: {
      // 编辑器背景与前景
      'editor.background':               '#18181b',
      'editor.foreground':               '#d4d4d8',
      // 当前行高亮
      'editor.lineHighlightBackground':  '#27272a',
      'editor.lineHighlightBorder':      '#3f3f46',
      // 选区
      'editor.selectionBackground':      '#4f46e580',
      'editor.inactiveSelectionBackground': '#3f3f5550',
      // 光标
      'editorCursor.foreground':         '#818cf8',
      // 行号
      'editorLineNumber.foreground':     '#52525b',
      'editorLineNumber.activeForeground': '#a1a1aa',
      // 缩进参考线
      'editorIndentGuide.background':    '#3f3f46',
      'editorIndentGuide.activeBackground': '#6366f1',
      // 括号对高亮
      'editorBracketMatch.background':   '#4f46e540',
      'editorBracketMatch.border':       '#818cf8',
      // Minimap
      'minimap.background':              '#18181b',
      'minimapSlider.background':        '#3f3f4680',
      'minimapSlider.hoverBackground':   '#52525b80',
      // 滚动条
      'scrollbarSlider.background':      '#3f3f4660',
      'scrollbarSlider.hoverBackground': '#52525b80',
      'scrollbarSlider.activeBackground':'#6366f180',
      // 建议弹窗
      'editorSuggestWidget.background':  '#1e1e21',
      'editorSuggestWidget.border':      '#3f3f46',
      'editorSuggestWidget.selectedBackground': '#4f46e540',
      'editorSuggestWidget.highlightForeground': '#818cf8',
      // 悬浮提示
      'editorHoverWidget.background':    '#1e1e21',
      'editorHoverWidget.border':        '#3f3f46',
      // 搜索高亮
      'editor.findMatchBackground':      '#4f46e580',
      'editor.findMatchHighlightBackground': '#4f46e530',
      // 空白字符
      'editorWhitespace.foreground':     '#3f3f46',
      // 折叠控件
      'editorGutter.foldingControlForeground': '#71717a',
      // 弹窗面板边框
      'editorWidget.background':         '#1e1e21',
      'editorWidget.border':             '#3f3f46',
    },
  })

  // ─ TypeScript / JavaScript 编译器选项 ─────────────────────────────────────
  const tsDefaults = monacoInstance.languages.typescript
  const compilerOpts = {
    target: tsDefaults.ScriptTarget.ES2020,
    module: tsDefaults.ModuleKind.ESNext,
    allowJs: true,
    checkJs: true,
    strict: false,
    allowNonTsExtensions: true,
    noEmit: true,
    lib: ['es2020', 'dom'],
  }

  tsDefaults.javascriptDefaults.setCompilerOptions(compilerOpts as never)
  tsDefaults.typescriptDefaults.setCompilerOptions(compilerOpts as never)

  // 开启即时诊断（语法 + 语义）
  tsDefaults.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: false,
  })
  tsDefaults.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: false,
  })

  // ─ 书源脚本 API 类型声明（反映 Boa 引擎实际注入的 legado 全局对象） ──────────
  const bookSourceApiDts = `
// ─────────────────────────────────────────────────────────────────────────────
// legado_tauri 书源脚本运行时 API
// 通过 \`legado\` 全局对象访问，书源脚本在 Boa JS 引擎中执行
// ─────────────────────────────────────────────────────────────────────────────

declare namespace legado {
  /**
   * HTTP 网络请求
   * 所有请求均为同步阻塞（Boa 引擎不支持 Promise / async-await）
   */
  namespace http {
    /**
     * 发起 HTTP GET 请求，返回响应体字符串
     * @param url 请求 URL
     * @returns 响应体字符串（网络错误时抛出异常）
     * @example
     * const html = legado.http.get('https://example.com/search?q=keyword')
     */
    function get(url: string): string

    /**
     * 发起 HTTP POST 请求，返回响应体字符串
     * @param url 请求 URL
     * @param body 请求体（form 表单字符串、JSON 字符串等）
     * @returns 响应体字符串（网络错误时抛出异常）
     * @example
     * const resp = legado.http.post(url, 'username=foo&password=bar')
     * // POST JSON body：
     * const resp2 = legado.http.post(url, JSON.stringify({ key: 'value' }))
     */
    function post(url: string, body?: string): string
  }

  /**
   * 配置持久化
   * 每个书源/扩展以自身文件名为 scope 独立存储，互不干扰
   */
  namespace config {
    /**
     * 读取配置值
     * @param scope  书源/扩展的标识符（通常为文件名，如 "my_source.js"）
     * @param key    配置键名
     * @returns      配置字符串，键不存在时返回空字符串
     * @example
     * const token = legado.config.read('my_source.js', 'token')
     */
    function read(scope: string, key: string): string

    /**
     * 写入配置值（持久化到磁盘）
     * @param scope  书源/扩展的标识符
     * @param key    配置键名
     * @param value  配置值（复杂结构请先 JSON.stringify）
     * @example
     * legado.config.write('my_source.js', 'token', 'abc123')
     * // 存储对象：
     * legado.config.write('my_source.js', 'state', JSON.stringify({ page: 1 }))
     */
    function write(scope: string, key: string, value: string): void

    /**
     * 读取字节数组配置值，返回 number 数组（每个元素 0-255）
     * JS 侧自行解码（new Uint8Array(arr) / TextDecoder 等）
     * 键不存在时返回空数组 []
     * @example
     * const bytes = legado.config.readBytes('my_source.js', 'avatar')
     * const img = new Uint8Array(bytes)
     */
    function readBytes(scope: string, key: string): number[]

    /**
     * 写入字节数组配置值，接受 number 数组（每个元素 0-255）
     * JS 侧自行编码（Array.from(uint8arr) 等）
     * @example
     * legado.config.writeBytes('my_source.js', 'avatar', Array.from(imgBytes))
     */
    function writeBytes(scope: string, key: string, value: number[]): void
  }

  /**
   * 日志输出（打印到调试控制台 & 前端 script:log 事件）
   * @param msg 日志内容
   */
  function log(msg: unknown): void

  /** UI 事件推送（向前端 webview 推送自定义事件） */
  namespace ui {
    /**
     * 向前端推送事件
     * @param event 事件名称（前端通过 listen('script:ui', ...) 接收）
     * @param data  事件数据（任意可序列化对象）
     */
    function emit(event: string, data?: unknown): void
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 书源脚本约定导出函数（书源引擎按需调用）
// ─────────────────────────────────────────────────────────────────────────────

/** 书籍搜索结果 */
interface BookItem {
  name: string
  author?: string
  coverUrl?: string
  intro?: string
  bookUrl: string
  latestChapter?: string
  tocUrl?: string
}

/** 章节信息 */
interface ChapterInfo {
  name: string
  url: string
}

/** 发现页条目（用于书源首页/热门/分类数据） */
interface ExploreItem {
  name: string
  bookUrl: string
  coverUrl?: string
  intro?: string
  author?: string
  type?: string   // 分类标签，如 "都市" "玄幻" 等
}

/**
 * 【必须实现】搜索书籍
 * @param key  搜索关键词
 * @param page 页码（从 1 开始）
 */
declare function search(key: string, page: number): BookItem[]

/**
 * 【必须实现】获取书籍详情（封面、简介、目录入口等）
 * @param bookUrl 书籍主页 URL
 */
declare function bookInfo(bookUrl: string): BookItem

/**
 * 【必须实现】获取目录列表
 * @param tocUrl 目录页 URL（通常与 bookUrl 相同）
 */
declare function toc(tocUrl: string): ChapterInfo[]

/**
 * 【必须实现】获取章节正文
 * @param chapterUrl 章节 URL
 * @returns 纯文本正文
 */
declare function content(chapterUrl: string): string

/**
 * 【可选】发现页 — 返回网站首页/热门/分类推荐书目，供用户发现新书使用
 * 若书源不实现此函数，发现页将跳过该书源
 * @param page 页码（从 1 开始）
 */
declare function explore(page: number): ExploreItem[]
`

  // 注册为全局库，对所有 JS / TS 文件生效
  tsDefaults.javascriptDefaults.addExtraLib(bookSourceApiDts, 'ts:booksource-api.d.ts')
  tsDefaults.typescriptDefaults.addExtraLib(bookSourceApiDts, 'ts:booksource-api.d.ts')
}

// ── Editor 实例挂载 ──────────────────────────────────────────────────────────

function handleEditorMount(editor: monaco.editor.IStandaloneCodeEditor, monacoInstance: MonacoEditor) {
  editorRef.value = editor

  // Ctrl/Cmd + S 快捷保存
  editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
    emit('save')
  })

  // 格式化后光标位置保持不变
  editor.onDidChangeModelContent(() => {
    // 此处可接入自定义 linting 逻辑
  })
}

// ── 工具方法 ─────────────────────────────────────────────────────────────────

function formatDocument() {
  editorRef.value?.getAction('editor.action.formatDocument')?.run()
}

function foldAll() {
  editorRef.value?.getAction('editor.foldAll')?.run()
}

function unfoldAll() {
  editorRef.value?.getAction('editor.unfoldAll')?.run()
}

/** Monaco Editor editorOptions */
const editorOptions = computed<monaco.editor.IStandaloneEditorConstructionOptions>(() => ({
  // 基础
  fontSize: 13,
  lineHeight: 20,
  fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace",
  fontLigatures: true,
  tabSize: 2,
  insertSpaces: true,
  wordWrap: 'off',
  // 外观
  minimap: { enabled: true, scale: 1 },
  scrollBeyondLastLine: false,
  renderLineHighlight: 'all',
  smoothScrolling: true,
  cursorBlinking: 'smooth',
  cursorSmoothCaretAnimation: 'on',
  // 编辑体验
  automaticLayout: true,
  formatOnPaste: true,
  formatOnType: true,
  autoClosingBrackets: 'always',
  autoClosingQuotes: 'always',
  autoIndent: 'full',
  codeLens: true,
  // 提示
  suggestOnTriggerCharacters: true,
  quickSuggestions: { other: true, comments: false, strings: true },
  parameterHints: { enabled: true },
  inlayHints: { enabled: 'on' },
  // 折叠
  folding: true,
  foldingStrategy: 'indentation',
  showFoldingControls: 'mouseover',
  // 其他
  bracketPairColorization: { enabled: true },
  guides: { bracketPairs: true, indentation: true },
  renderWhitespace: 'selection',
  padding: { top: 8, bottom: 8 },
  scrollbar: {
    useShadows: false,
    verticalScrollbarSize: 6,
    horizontalScrollbarSize: 6,
  },
}))
</script>

<template>
  <n-modal
    :show="show"
    @update:show="$emit('update:show', $event)"
    preset="card"
    :title="title"
    style="width: 90vw; max-width: 1200px; height: 85vh; display: flex; flex-direction: column; background: #18181b; border: 1px solid #3f3f46"
    header-style="background: #18181b; border-bottom: 1px solid #3f3f46; color: #fafafa; padding: 12px 16px"
    content-style="flex:1;display:flex;flex-direction:column;overflow:hidden;padding:0;background:#18181b"
    footer-style="background: #18181b; border-top: 1px solid #3f3f46; padding: 10px 16px"
    :mask-closable="false"
  >
    <!-- 外部修改重载提示 -->
    <n-alert
      v-if="reloaded"
      type="info"
      :show-icon="true"
      style="flex-shrink:0; margin: 8px 16px 0; font-size: 12px"
    >
      文件已被外部修改，内容已自动重载
    </n-alert>

    <!-- 工具栏 -->
    <div class="bse-toolbar">
      <n-tag size="tiny" :bordered="false" style="opacity: 0.7">
        {{ language.toUpperCase() }}
      </n-tag>
      <n-divider vertical />
      <n-button size="tiny" quaternary title="格式化 (Shift+Alt+F)" @click="formatDocument">
        <template #icon>
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round">
            <line x1="21" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/>
            <line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="9" y2="18"/>
          </svg>
        </template>
        格式化
      </n-button>
      <n-button size="tiny" quaternary title="折叠全部" @click="foldAll">
        <template #icon>
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round">
            <polyline points="5 15 12 8 19 15"/>
          </svg>
        </template>
        折叠
      </n-button>
      <n-button size="tiny" quaternary title="展开全部" @click="unfoldAll">
        <template #icon>
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round">
            <polyline points="5 9 12 16 19 9"/>
          </svg>
        </template>
        展开
      </n-button>
      <div style="flex: 1" />
      <span class="bse-hint">
        <kbd>Ctrl+S</kbd> 保存 &nbsp;
        <kbd>Shift+Alt+F</kbd> 格式化 &nbsp;
        <kbd>Ctrl+Z</kbd> 撤销
      </span>
    </div>

    <!-- Monaco 编辑区 -->
    <div class="bse-editor-wrap">
      <VueMonacoEditor
        :value="localContent"
        :language="language"
        :theme="monacoTheme"
        :options="editorOptions"
        style="width: 100%; height: 100%"
        @before-mount="handleBeforeMount"
        @mount="handleEditorMount"
        @change="handleContentChange"
      />
    </div>

    <!-- 底部操作栏 -->
    <template #footer>
      <div class="bse-footer">
        <n-button
          v-if="fileName"
          size="small"
          quaternary
          :loading="false"
          title="在 VS Code 中打开此文件，保存后将自动重载"
          @click="$emit('open-vscode')"
        >
          <template #icon>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
              stroke-linejoin="round">
              <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
            </svg>
          </template>
          在 VS Code 中打开
        </n-button>
        <div style="flex: 1" />
        <n-button @click="$emit('update:show', false)">取消</n-button>
        <n-button type="primary" :loading="saving" @click="$emit('save')">
          保存到磁盘
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
.bse-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-bottom: 1px solid #3f3f46;
  background: #111113;
}

/* Naive UI 按钮在深色背景下的文字颜色覆写 */
.bse-toolbar :deep(.n-button) {
  color: #a1a1aa;
}
.bse-toolbar :deep(.n-button:hover) {
  color: #e4e4e7;
  background: #27272a !important;
}
.bse-toolbar :deep(.n-tag) {
  background: #27272a;
  color: #818cf8;
  font-family: 'JetBrains Mono', 'Cascadia Code', monospace;
  font-size: 10px;
  letter-spacing: 0.05em;
}
.bse-toolbar :deep(.n-divider--vertical) {
  border-color: #3f3f46;
  height: 14px;
}

.bse-hint {
  font-size: 11px;
  color: #52525b;
  white-space: nowrap;
}

.bse-hint kbd {
  display: inline-block;
  padding: 1px 5px;
  font-size: 10px;
  font-family: 'JetBrains Mono', 'Cascadia Code', monospace;
  border: 1px solid #3f3f46;
  border-radius: 3px;
  background: #27272a;
  color: #a1a1aa;
}

.bse-editor-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.bse-footer {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 底栏按钮颜色适配深色背景 */
.bse-footer :deep(.n-button:not(.n-button--primary-type)) {
  color: #a1a1aa;
  border-color: #3f3f46;
  background: transparent;
}
.bse-footer :deep(.n-button:not(.n-button--primary-type):hover) {
  color: #e4e4e7;
  background: #27272a !important;
}
</style>
