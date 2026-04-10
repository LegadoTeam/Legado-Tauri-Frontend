import { invoke } from '@tauri-apps/api/core'

// ── 类型定义 ──────────────────────────────────────────────────────────────

export interface ExtensionMeta {
  fileName:      string
  name:          string
  namespace:     string
  version:       string
  description:   string
  author:        string
  /** @match / @include 条目 */
  matchPatterns: string[]
  /** @grant 条目 */
  grants:        string[]
  /** @run-at 值 */
  runAt:         string
  /** @category 自定义字段 */
  category:      string
  enabled:       boolean
  fileSize:      number
  modifiedAt:    number
}

// ── API 封装 ──────────────────────────────────────────────────────────────

export async function getExtensionDir(): Promise<string> {
  return invoke<string>('extension_get_dir')
}

export async function listExtensions(): Promise<ExtensionMeta[]> {
  return invoke<ExtensionMeta[]>('extension_list')
}

export async function readExtension(fileName: string): Promise<string> {
  return invoke<string>('extension_read', { fileName })
}

export async function saveExtension(fileName: string, content: string): Promise<void> {
  return invoke<void>('extension_save', { fileName, content })
}

export async function deleteExtension(fileName: string): Promise<void> {
  return invoke<void>('extension_delete', { fileName })
}

export async function toggleExtension(fileName: string, enabled: boolean): Promise<void> {
  return invoke<void>('extension_toggle', { fileName, enabled })
}

export async function openExtensionInVscode(fileName: string): Promise<void> {
  return invoke<void>('extension_open_in_vscode', { fileName })
}

// ── 工具函数 ──────────────────────────────────────────────────────────────

/** 将任意字符串转为合法 JS 文件名 */
export function toExtSafeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_') + '.js'
}

/**
 * 在前端解析 UserScript 头部元数据。
 * 用于示例脚本展示，不通过 Rust 命令。
 */
export function parseUserScriptMeta(source: string): Partial<ExtensionMeta> {
  const meta: Partial<ExtensionMeta> = { matchPatterns: [], grants: [] }
  let inHeader = false

  for (const line of source.split('\n').slice(0, 100)) {
    const t = line.trim()
    if (t === '// ==UserScript==')  { inHeader = true;  continue }
    if (t === '// ==/UserScript==') { break }
    if (!inHeader) continue

    const m = t.match(/^\/\/ @(\S+)\s*(.*)$/)
    if (!m) continue
    const [, key, rawVal] = m
    const val = rawVal.trim()

    switch (key) {
      case 'name':         meta.name        = val; break
      case 'namespace':    meta.namespace   = val; break
      case 'version':      meta.version     = val; break
      case 'description':  meta.description = val; break
      case 'author':       meta.author      = val; break
      case 'match':
      case 'include':      meta.matchPatterns!.push(val); break
      case 'grant':        if (val && val !== 'none') meta.grants!.push(val); break
      case 'run-at':       meta.runAt    = val; break
      case 'category':     meta.category = val; break
      case 'enabled':      meta.enabled  = val !== 'false'; break
    }
  }
  return meta
}

/** 生成新扩展的 UserScript 模板内容 */
export function newExtensionTemplate(name = '新扩展', category = '其他'): string {
  return `// ==UserScript==
// @name         ${name}
// @namespace    com.legado.extensions
// @version      0.1.0
// @description  在此填写扩展描述
// @author       
// @category     ${category}
// @match        *
// @grant        none
// @run-at       document-idle
// @enabled      true
// ==/UserScript==

/**
 * 扩展主逻辑
 * Legado 引擎根据 @run-at 时机调用此文件中导出的函数。
 */

// TODO: 在此编写扩展逻辑
`
}
