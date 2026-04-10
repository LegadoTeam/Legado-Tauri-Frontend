/**
 * useScriptBridge — 全局单例，打通 Boa JS 引擎 ↔ Rust ↔ Vue 的双向调用桥梁
 *
 * 架构：
 *   Boa 脚本调用 legado.ui.emit(event, data)
 *     → Rust 通过 Tauri 事件 `script:ui` 广播到前端
 *     → Vue 订阅事件后更新响应式状态，驱动组件渲染
 *
 *   Vue 用户交互完成后 invoke script_dialog_result(id, value)
 *     → Rust 通过 `script:dialog:result` 事件广播
 *     → 其他 Vue 组件或 Boa REPL 窗口订阅后响应
 *
 * 使用方式：在任意组件中 `const bridge = useScriptBridge()` 即可。
 * 全局只创建一次监听，组件卸载不会解绑（单例模式）。
 */

import { reactive, readonly } from 'vue'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { invokeWithTimeout } from './useInvoke'

// ── 类型定义 ──────────────────────────────────────────────────────────────

export interface ScriptLog {
  time:    number
  message: string
}

export interface ScriptUiEvent {
  event: string
  data:  unknown
}

export interface DialogRequest {
  id:      string
  title:   string
  content: unknown
  /** 'info' | 'input' | 'repl' */
  kind:    string
}

/** 书源搜索/发现返回的书籍条目 */
export interface BookItem {
  name:         string
  author:       string
  bookUrl:      string
  coverUrl?:    string
  lastChapter?: string
  kind?:        string
  intro?:       string
}

/** 书源详情返回的完整书籍信息 */
export interface BookDetail {
  name:         string
  author:       string
  coverUrl?:    string
  intro?:       string
  kind?:        string
  lastChapter?: string
  tocUrl?:      string
}

/** 章节列表条目 */
export interface ChapterItem {
  name: string
  url:  string
}

// ── 全局响应式状态（单例） ─────────────────────────────────────────────────

const state = reactive({
  /** 最近 200 条脚本日志 */
  logs:        [] as ScriptLog[],
  /** 待弹出的弹窗队列（FIFO） */
  dialogs:     [] as DialogRequest[],
  /** 最近收到的 legado.ui.emit 事件 */
  lastUiEvent: null as ScriptUiEvent | null,
  /** 是否已初始化监听 */
  initialized: false,
})

// ── 初始化（只执行一次） ──────────────────────────────────────────────────

const unlisteners: UnlistenFn[] = []

async function init() {
  if (state.initialized) return
  state.initialized = true

  // 脚本日志
  unlisteners.push(await listen<{ message: string }>('script:log', (e) => {
    state.logs.push({ time: Date.now(), message: e.payload.message })
    if (state.logs.length > 200) state.logs.shift()
  }))

  // legado.ui.emit 事件
  unlisteners.push(await listen<ScriptUiEvent>('script:ui', (e) => {
    state.lastUiEvent = e.payload
    // 如果是 dialog:open，推入弹窗队列
    if (e.payload.event === 'dialog:open') {
      const req = e.payload.data as DialogRequest
      state.dialogs.push(req)
    }
  }))

  // Rust script_dialog_open 命令直接发出的弹窗事件
  unlisteners.push(await listen<DialogRequest>('script:dialog:open', (e) => {
    state.dialogs.push(e.payload)
  }))
}

// ── 公共 API ──────────────────────────────────────────────────────────────

/** 关闭队列最前面的弹窗，并将结果发回 Rust */
async function resolveDialog(id: string, value: unknown) {
  const idx = state.dialogs.findIndex(d => d.id === id)
  if (idx !== -1) state.dialogs.splice(idx, 1)
  await invokeWithTimeout('script_dialog_result', { id, value }, 10000)
}

/** 手动打开一个弹窗（供 Vue 代码主动调用） */
function openDialog(req: Omit<DialogRequest, 'id'>): string {
  const id = crypto.randomUUID()
  state.dialogs.push({ id, ...req })
  return id
}

/** 书源标准调用：搜索 */
async function runSearch(fileName: string, keyword: string, page = 1) {
  return invokeWithTimeout<unknown>('booksource_search', { fileName, keyword, page }, 35000)
}

/** 书源标准调用：书籍详情 */
async function runBookInfo(fileName: string, bookUrl: string) {
  return invokeWithTimeout<unknown>('booksource_book_info', { fileName, bookUrl }, 35000)
}

/** 书源标准调用：章节列表（多页目录可能耗时较长，给 125s）
 *
 * @param taskId 可选任务 ID，传入后可通过 `cancelTask(taskId)` 提前中止
 */
async function runChapterList(fileName: string, bookUrl: string, taskId?: string) {
  return invokeWithTimeout<unknown>('booksource_chapter_list', { fileName, bookUrl, taskId: taskId ?? null }, 125000)
}

/** 取消指定任务（通常在关闭章节列表加载弹窗时调用） */
async function cancelTask(taskId: string) {
  try {
    await invokeWithTimeout<void>('booksource_cancel', { taskId }, 3000)
  } catch {
    // 取消信号发送失败不影响 UI 状态
  }
}

/** 书源标准调用：章节正文 */
async function runChapterContent(fileName: string, chapterUrl: string) {
  return invokeWithTimeout<unknown>('booksource_chapter_content', { fileName, chapterUrl }, 35000)
}

/** 书源标准调用：发现页 */
async function runExplore(fileName: string, category: string, page = 1, noCache = false) {
  return invokeWithTimeout<unknown>('booksource_explore', { fileName, page, category, noCache: noCache || null }, 35000)
}

/** 清空发现页缓存。传入 fileName 仅清该书源，不传清空全部 */
async function clearExploreCache(fileName?: string) {
  return invokeWithTimeout<void>('explore_clear_cache', { fileName: fileName ?? null }, 5000)
}

/** REPL：在 Boa 中执行任意 JS，可选择加载某书源作为上下文 */
async function replEval(code: string, contextFile?: string): Promise<string> {
  return invokeWithTimeout<string>('script_repl_eval', { code, contextFile: contextFile ?? null }, 20000)
}

/** 调用指定书源中的任意导出函数（用于 HTML Bridge 回调等场景） */
async function callSourceFn(fileName: string, fnName: string, args: unknown[] = []) {
  return invokeWithTimeout<unknown>('booksource_call_fn', { fileName, fnName, args }, 35000)
}

// ── 导出 composable ───────────────────────────────────────────────────────

export function useScriptBridge() {
  // 延迟初始化：第一次被任意组件使用时才注册监听
  if (!state.initialized) {
    init().catch(e => console.error('[ScriptBridge] 初始化失败:', e))
  }

  return {
    // 只读状态（防止外部直接修改）
    state:         readonly(state) as typeof state,
    // 操作方法
    resolveDialog,
    openDialog,
    runSearch,
    runBookInfo,
    runChapterList,
    cancelTask,
    runChapterContent,
    runExplore,
    clearExploreCache,
    callSourceFn,
    replEval,
  }
}
