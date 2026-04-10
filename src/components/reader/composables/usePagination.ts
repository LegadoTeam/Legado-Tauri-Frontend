/**
 * usePagination — 文本分页引擎
 *
 * 快速首屏策略：
 *  1. 测量单字行高 → 估算每页可容纳段落数（estLinesPerPage）
 *  2. 立即排版前 estLinesPerPage 段 → 首页瞬间可见，isPaginating 提前置 false
 *  3. 后台按批次排版剩余段落，每批完成后 yield 主线程保持 UI 流畅
 *  4. 每批结果追加到 pages，totalPages 实时更新
 *
 * 取消机制（cancelToken）：
 *   每次调用 paginate 递增 cancelToken；
 *   后台任务在每个 await 点检查令牌，不一致则安全退出。
 */
import { ref, nextTick } from 'vue'
import type { ReaderTypography } from '../types'

export interface PaginationResult {
  pages: string[]
  currentPage: number
}

export function usePagination() {
  const pages = ref<string[]>([])
  const currentPage = ref(0)
  const totalPages = ref(0)
  const isPaginating = ref(false)

  /** 每次 paginate 调用递增，旧后台任务据此终止 */
  let cancelToken = 0

  async function paginate(
    content: string,
    container: HTMLElement,
    typography: ReaderTypography,
    padding: number,
    initialPage: 'first' | 'last' = 'first',
    prefixHtml = '',
  ) {
    const myToken = ++cancelToken
    isPaginating.value = true

    await nextTick()

    // 用 clientWidth/clientHeight 而非 getBoundingClientRect()：
    // 前者是 CSS 布局尺寸，不受父元素 scale 动画影响；
    // getBoundingClientRect 在 n-modal 入场缩放时会返回视觉缩小的错误值。
    const cW = container.clientWidth
    const cH = container.clientHeight
    if (cW <= 0 || cH <= 0) {
      isPaginating.value = false
      return
    }

    const isVertical = typography.writingMode.startsWith('vertical')
    const availW = cW - padding * 2
    const availH = cH - padding * 2

    // 创建隐藏测量容器
    const measurer = document.createElement('div')
    measurer.style.cssText = buildMeasurerStyle(typography, availW, availH, isVertical)
    container.appendChild(measurer)

    // ── 1. 测量单字行高，估算每页能容纳的段落数 ─────────────────────
    measurer.innerHTML = '<p style="margin:0;padding:0;text-indent:0;">单</p>'
    const rawSize = isVertical ? measurer.scrollWidth : measurer.scrollHeight
    const singleLineSize = rawSize || Math.ceil(typography.fontSize * 1.5)
    const pageMainSize = isVertical ? availW : availH
    const estLinesPerPage = Math.max(3, Math.floor(pageMainSize / singleLineSize))

    // ── 2. 按换行符拆分段落 ──────────────────────────────────────────
    const paragraphs = content.split(/\n+/).filter(p => p.trim())

    if (paragraphs.length === 0) {
      pages.value = ['<p></p>']
      totalPages.value = 1
      currentPage.value = 0
      isPaginating.value = false
      container.removeChild(measurer)
      return
    }

    // ── 3. 立即排版首批（≈ 1~2 页），确保首屏快速呈现 ────────────────
    const firstSize = Math.min(paragraphs.length, estLinesPerPage)
    const { completedPages: firstPages, leftover: firstLeft } = paginateChunk(
      paragraphs.slice(0, firstSize),
      measurer, typography, isVertical, availW, availH, prefixHtml,
    )

    if (myToken !== cancelToken) { container.removeChild(measurer); return }

    const visible: string[] = [...firstPages]
    let carryOver = firstLeft
    const allDone = paragraphs.length <= firstSize

    if (allDone) {
      // 全文已排完
      if (carryOver) visible.push(carryOver)
      carryOver = ''
    } else if (visible.length === 0 && carryOver) {
      // 首批段落都很短，未产生完整页 → 把 leftover 先作为第 1 页显示
      visible.push(carryOver)
      carryOver = ''
    }

    pages.value = visible.length > 0 ? visible : ['<p></p>']
    totalPages.value = pages.value.length
    // initialPage === 'last' 且尚未排完全文：
    //   不立即展示首批页面（否则用户会短暂看到第一页），
    //   而是在后台全量排版完成后一次性赋值 + 跳末页。
    //   将已排好的首批暂存到 pendingPages，后续批次追加其中。
    const deferForLast = initialPage === 'last' && !allDone
    let pendingPages: string[] | null = null
    if (deferForLast) {
      pendingPages = [...pages.value]
      pages.value = []          // 清空，模式组件显示空白而非错误的第一页
      totalPages.value = 0
      currentPage.value = 0
      // isPaginating 保持 true，外部可据此显示 loading
    } else {
      currentPage.value = (allDone && initialPage === 'last')
        ? Math.max(0, totalPages.value - 1)
        : 0
      isPaginating.value = false // ✓ 首屏 ready
    }

    if (allDone) { container.removeChild(measurer); return }

    // ── 4. 后台分批排版剩余段落 ──────────────────────────────────────
    const BATCH_SIZE = estLinesPerPage * 4   // 每批约 4 页，平衡吞吐与响应
    let offset = firstSize

    while (offset < paragraphs.length) {
      if (myToken !== cancelToken) { container.removeChild(measurer); return }

      // 让出主线程，允许浏览器绘制
      await yieldToMain()

      if (myToken !== cancelToken) { container.removeChild(measurer); return }

      const end = Math.min(offset + BATCH_SIZE, paragraphs.length)
      const isLast = end >= paragraphs.length

      const { completedPages: batch, leftover: bLeft } = paginateChunk(
        paragraphs.slice(offset, end),
        measurer, typography, isVertical, availW, availH, carryOver,
      )

      carryOver = bLeft

      // 最后一批：把剩余内容作为最终页
      if (isLast && carryOver) {
        batch.push(carryOver)
        carryOver = ''
      }

      if (batch.length > 0) {
        if (pendingPages) {
          // 延迟模式：暂存到临时数组，不触发 UI 更新
          pendingPages.push(...batch)
        } else {
          // 正常模式：实时追加，用户边看边排
          pages.value.push(...batch)
          totalPages.value = pages.value.length
        }
      }

      offset = end
    }

    // 全量分页完成
    if (pendingPages) {
      // 延迟模式（initialPage === 'last'）：一次性赋值 + 跳末页
      pages.value = pendingPages
      totalPages.value = pendingPages.length
      currentPage.value = Math.max(0, totalPages.value - 1)
      isPaginating.value = false
    } else if (initialPage === 'last') {
      currentPage.value = Math.max(0, totalPages.value - 1)
      isPaginating.value = false
    }

    container.removeChild(measurer)
  }

  function goToPage(page: number) {
    if (page >= 0 && page < totalPages.value) currentPage.value = page
  }

  function nextPage(): boolean {
    if (currentPage.value < totalPages.value - 1) { currentPage.value++; return true }
    return false
  }

  function prevPage(): boolean {
    if (currentPage.value > 0) { currentPage.value--; return true }
    return false
  }

  function goToStart() { currentPage.value = 0 }
  function goToEnd() { currentPage.value = Math.max(0, totalPages.value - 1) }

  return {
    pages, currentPage, totalPages, isPaginating,
    paginate, goToPage, nextPage, prevPage, goToStart, goToEnd,
  }
}

// ── 分块排版结果 ──────────────────────────────────────────────────────
interface ChunkResult {
  /** 本批已完整填满的页面 HTML 列表 */
  completedPages: string[]
  /** 尚未溢出的当前半页内容，传给下一批作为 initialContent 继续填充 */
  leftover: string
}

/**
 * 同步排版一批段落。
 *
 * @param paragraphs     - 本批段落文本
 * @param measurer       - 已挂载的隐藏测量 DOM 元素
 * @param initialContent - 上一批结转的半页 HTML（直接从上次 leftover 继续）
 */
function paginateChunk(
  paragraphs: string[],
  measurer: HTMLElement,
  typography: ReaderTypography,
  isVertical: boolean,
  availW: number,
  availH: number,
  initialContent: string,
): ChunkResult {
  const result: string[] = []
  let cur = initialContent
  const { textIndent, paragraphSpacing } = typography

  const pageFits = (el: HTMLElement) =>
    isVertical ? el.scrollWidth <= availW : el.scrollHeight <= availH

  for (const para of paragraphs) {
    const paraHTML = makePara(para, textIndent, paragraphSpacing)
    measurer.innerHTML = cur + paraHTML

    if (pageFits(measurer)) {
      cur = cur + paraHTML
    } else {
      // 整段放不下：逐字/词填充，先尽量填满当前页剩余空间，再开新页继续
      // 不提前 push(cur)，而是把 cur 作为基底继续追加，直到溢出才翻页
      const tokens = splitText(para)
      let buf = ''
      // paraStarted：段落是否已跨页（续行不缩进，视觉上属于同一段落的延续）
      let paraStarted = false

      for (const token of tokens) {
        const testBuf = buf + token
        // 仅段落第一行（还未提交过任何内容）才缩进
        const indent = paraStarted ? 0 : textIndent
        measurer.innerHTML = cur + makePara(testBuf, indent, paragraphSpacing)

        if (pageFits(measurer)) {
          buf = testBuf
        } else {
          if (buf) {
            // buf 已积累了若干字符且放得下，提交整页并翻到新页
            result.push(cur + makePara(buf, paraStarted ? 0 : textIndent, paragraphSpacing))
            cur = ''
            paraStarted = true  // 段落已有内容提交，续行不再缩进
            buf = token         // 下溢的 token 作为新页起点，继续循环
          } else if (cur) {
            // buf 为空：段落第一个 token 就超出已有内容所在页
            // → cur 本身已满，先提交 cur（不含此 token），再以 token 开新页
            result.push(cur)
            cur = ''
            paraStarted = true
            buf = token         // token 在新页上重新尝试
          } else {
            // buf 为空且 cur 为空：单个 token 本身高度超过整页（极端情况）
            // 强制放入避免死循环
            result.push(makePara(token, paraStarted ? 0 : textIndent, paragraphSpacing))
            cur = ''
            paraStarted = true
            buf = ''
          }
        }
      }

      // 段落末尾剩余内容追加到当前页（不立即提交，等下一段继续填充）
      if (buf) {
        cur = cur + makePara(buf, paraStarted ? 0 : textIndent, paragraphSpacing)
      }
    }
  }

  return { completedPages: result, leftover: cur }
}

// ── 工具函数 ──────────────────────────────────────────────────────────

function makePara(text: string, indent: number, spacing: number): string {
  return `<p style="text-indent:${indent}em;margin-bottom:${spacing}px;">${escapeHtml(text)}</p>`
}

function buildMeasurerStyle(
  t: ReaderTypography,
  availW: number,
  availH: number,
  isVertical: boolean,
): string {
  return [
    'position:absolute', 'visibility:hidden',
    `width:${isVertical ? 'auto' : availW + 'px'}`,
    `height:${isVertical ? availH + 'px' : 'auto'}`,
    `font-family:${t.fontFamily}`,
    `font-size:${t.fontSize}px`,
    `line-height:${t.lineHeight}`,
    `letter-spacing:${t.letterSpacing}px`,
    `word-spacing:${t.wordSpacing}px`,
    `font-weight:${t.fontWeight}`,
    `font-style:${t.fontStyle}`,
    `text-align:${t.textAlign}`,
    `writing-mode:${t.writingMode}`,
    // 与渲染层保持一致：允许合成粗体，确保测量宽高准确
    'font-synthesis:weight style',
    'overflow:hidden',
    'word-break:break-all',
    'overflow-wrap:break-word',
  ].join(';')
}

/** 让出主线程，允许浏览器绘制一帧 */
function yieldToMain(): Promise<void> {
  return new Promise(r => setTimeout(r, 0))
}

/** 汉字逐字拆分，非 CJK（英文/数字/标点）合并为词组 */
function splitText(text: string): string[] {
  const out: string[] = []
  let buf = ''
  for (const c of text) {
    if (/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(c)) {
      if (buf) { out.push(buf); buf = '' }
      out.push(c)
    } else {
      buf += c
    }
  }
  if (buf) out.push(buf)
  return out
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
