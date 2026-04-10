import { parseUserScriptMeta, type ExtensionMeta } from '../composables/useExtension'

// ── 类型 ──────────────────────────────────────────────────────────────────

export interface ExampleScript {
  id:     string
  source: string
  meta:   Partial<ExtensionMeta>
}

// ── 示例脚本源码 ──────────────────────────────────────────────────────────

const SRC_FILTER = `\
// ==UserScript==
// @name         文本净化器
// @namespace    com.legado.extensions
// @version      1.0.0
// @description  自动过滤正文中的广告词、防盗版水印和无关提示文字，还原干净阅读体验
// @author       Legado 社区
// @category     内容处理
// @match        *
// @grant        legado_content_filter
// @run-at       content-ready
// @enabled      true
// ==/UserScript==

/**
 * 过滤规则（支持正则表达式或字符串）
 * 匹配成功的行将被完整移除
 */
const FILTER_RULES = [
  /本章未完[，,]点击下一页继续阅读/,
  /最新章节请访问.{0,30}阅读/,
  /\\(本章完\\)/,
  /天才一秒记住.{0,20}网址/,
  /(?:笔趣阁|笔趣看|顶点小说)\\s*[\\|｜].*/,
  '请记住本书首发域名',
]

/**
 * 主处理函数 — 由 Legado 引擎在章节渲染前调用
 * @param {string} content 原始章节文本
 * @returns {string} 净化后的文本
 */
function filterContent(content) {
  let result = content
  for (const rule of FILTER_RULES) {
    if (typeof rule === 'string') {
      result = result.split('\\n').filter(line => !line.includes(rule)).join('\\n')
    } else {
      result = result.split('\\n').filter(line => !rule.test(line)).join('\\n')
    }
  }
  // 合并连续空行（最多保留一个空行）
  return result.replace(/\\n{3,}/g, '\\n\\n').trim()
}
`

const SRC_TIMER = `\
// ==UserScript==
// @name         阅读计时器
// @namespace    com.legado.extensions
// @version      1.2.0
// @description  统计每日阅读时长与字数，会话结束后弹出今日阅读报告
// @author       q3499
// @category     统计
// @match        *
// @grant        legado_storage_read
// @grant        legado_storage_write
// @grant        legado_ui_toast
// @run-at       document-idle
// @enabled      true
// ==/UserScript==

const STORAGE_KEY = 'ext.reading_stats'

async function loadStats() {
  const raw = await legado.storage.read(STORAGE_KEY)
  return raw ? JSON.parse(raw) : { totalSeconds: 0, totalChars: 0, sessions: [] }
}

async function saveStats(stats) {
  await legado.storage.write(STORAGE_KEY, JSON.stringify(stats))
}

/** 阅读会话开始时调用 */
async function onSessionStart() {
  const stats = await loadStats()
  stats._sessionStart = Date.now()
  await saveStats(stats)
}

/** 章节加载完成后统计字数，透传内容不做修改 */
async function onChapterLoaded(content) {
  const stats = await loadStats()
  stats.totalChars = (stats.totalChars || 0) + content.replace(/\\s/g, '').length
  await saveStats(stats)
  return content
}

/** 会话结束后累计时长并弹出今日统计 */
async function onSessionEnd() {
  const stats = await loadStats()
  if (stats._sessionStart) {
    const secs = Math.floor((Date.now() - stats._sessionStart) / 1000)
    stats.totalSeconds = (stats.totalSeconds || 0) + secs
    stats.sessions.push({
      date:  new Date().toISOString().slice(0, 10),
      secs,
      chars: stats.totalChars,
    })
    delete stats._sessionStart
    await saveStats(stats)
    await legado.ui.toast(
      \`今日阅读 \${Math.floor(secs / 60)} 分钟，累计约 \${stats.totalChars.toLocaleString()} 字\`
    )
  }
}
`

const SRC_THEME = `\
// ==UserScript==
// @name         护眼色主题
// @namespace    com.legado.extensions
// @version      2.0.0
// @description  将阅读背景切换为柔和护眼绿，字体改为霞鹜文楷，适合长时间阅读
// @author       designer_x
// @category     主题
// @match        *
// @grant        legado_ui_theme
// @run-at       document-start
// @enabled      true
// ==/UserScript==

/** 主题配置（与 Legado 主题 Schema 兼容） */
const THEME = {
  id:                 'eye-care',
  label:              '护眼色',
  readBackground:     '#c7edcc',
  readForeground:     '#2c2c2c',
  readFontFamily:     '"霞鹜文楷", "LXGW WenKai", "FangSong", serif',
  readFontSize:       17,
  readLineHeight:     1.9,
  readParagraphGap:   '0.8em',
  readPaddingX:       '5%',
  titlebarBackground: '#b5deba',
}

/**
 * Legado 引擎调用此函数获取主题配置
 * @returns {object} 主题对象
 */
function getTheme() {
  return THEME
}

/**
 * 响应用户主题开关操作
 * @param {boolean} enabled
 * @returns {object|null}
 */
function toggle(enabled) {
  return enabled ? THEME : null
}
`

const SRC_TRANSLATE = `\
// ==UserScript==
// @name         章节翻译助手
// @namespace    com.legado.extensions
// @version      0.8.1
// @description  为日文轻小说章节提供机器翻译预览，支持段落级对照阅读（默认禁用，需配置 API）
// @author       translator_kun
// @category     工具
// @match        *
// @grant        legado_network_request
// @grant        legado_ui_panel
// @run-at       content-ready
// @enabled      false
// ==/UserScript==

/** 翻译服务端点 — 替换为你自己的 API 地址 */
const API_URL     = 'https://api.example-translate.com/v1/translate'
const TARGET_LANG = 'zh-CN'

/**
 * 按段落分批翻译，网络失败时回退保留原文
 * @param {string} content 原始日文文本
 * @returns {Promise<string>}
 */
async function translateContent(content) {
  const paragraphs  = content.split('\\n')
  const translated  = await Promise.all(
    paragraphs.map(async para => {
      if (!para.trim()) return para
      try {
        const res = await legado.network.request({
          method:  'POST',
          url:     API_URL,
          headers: { 'Content-Type': 'application/json' },
          data:    JSON.stringify({ text: para, target: TARGET_LANG }),
          timeout: 5000,
        })
        return JSON.parse(res.responseText).result || para
      } catch {
        return para // 降级：保留原文
      }
    })
  )
  return translated.join('\\n')
}

/**
 * 在右侧浮动面板中显示当前章节的中文翻译
 * @param {string} content 当前章节原文
 */
async function showTranslationPanel(content) {
  const translation = await translateContent(content)
  await legado.ui.panel({
    title:    '翻译预览（中文）',
    content:  translation,
    position: 'right',
    width:    '40%',
  })
}
`

// ── 组装导出 ──────────────────────────────────────────────────────────────

function make(id: string, src: string): ExampleScript {
  return { id, source: src, meta: parseUserScriptMeta(src) }
}

export const EXAMPLE_SCRIPTS: ExampleScript[] = [
  make('filter',    SRC_FILTER),
  make('timer',     SRC_TIMER),
  make('theme',     SRC_THEME),
  make('translate', SRC_TRANSLATE),
]
