import { invokeWithTimeout } from './useInvoke'

// ── 类型定义（与 Rust BookSourceMeta 对应）────────────────────────────────

export interface BookSourceMeta {
  fileName: string
  name: string
  /** 主 URL（第一个 @url） */
  url: string
  /** 全部 URL（含主 URL；多镜像时有多条） */
  urls: string[]
  author?: string
  logo?: string
  /** 多行描述（多条 @description 以换行拼接） */
  description?: string
  enabled: boolean
  fileSize: number
  modifiedAt: number
  /** 该书源所在目录的绝对路径 */
  sourceDir: string
  /** 书源类型："novel"（默认）| "comic" */
  sourceType: string
  /** 版本号（用于更新检测） */
  version: string
  /** 自动更新 URL（可选，指向远程 .js 文件地址） */
  updateUrl?: string
  /** 标签列表（@tags 逗号分隔，如 "笔趣阁,小说,免费小说"） */
  tags: string[]
}

// ── API 封装 ─────────────────────────────────────────────────────────────

/** 获取书源目录绝对路径 */
export async function getBookSourceDir(): Promise<string> {
  return invokeWithTimeout<string>('booksource_get_dir', {}, 10000)
}

/** 获取所有书源目录（内置 + 外部） */
export async function getBookSourceDirs(): Promise<string[]> {
  return invokeWithTimeout<string[]>('booksource_get_dirs', {}, 10000)
}

/** 添加外部书源目录 */
export async function addBookSourceDir(dirPath: string): Promise<void> {
  return invokeWithTimeout<void>('booksource_add_dir', { dirPath }, 10000)
}

/** 移除外部书源目录 */
export async function removeBookSourceDir(dirPath: string): Promise<void> {
  return invokeWithTimeout<void>('booksource_remove_dir', { dirPath }, 10000)
}

/** 弹出系统目录选择对话框，返回选择的路径（取消返回空字符串） */
export async function pickBookSourceDir(): Promise<string> {
  return invokeWithTimeout<string>('booksource_pick_dir', {}, 60000)
}

/** 列举所有已安装书源 */
export async function listBookSources(): Promise<BookSourceMeta[]> {
  return invokeWithTimeout<BookSourceMeta[]>('booksource_list', {}, 15000)
}

/** 读取单个书源 JS 内容 */
export async function readBookSource(fileName: string): Promise<string> {
  return invokeWithTimeout<string>('booksource_read', { fileName }, 10000)
}

/** 保存书源 JS 文件（新建或覆盖），fileName 不含路径 */
export async function saveBookSource(fileName: string, content: string): Promise<void> {
  return invokeWithTimeout<void>('booksource_save', { fileName, content }, 10000)
}

/** 删除书源文件 */
export async function deleteBookSource(fileName: string): Promise<void> {
  return invokeWithTimeout<void>('booksource_delete', { fileName }, 10000)
}

/** 切换书源启用/禁用（修改文件头部 @enabled 标记） */
export async function toggleBookSource(fileName: string, enabled: boolean): Promise<void> {
  return invokeWithTimeout<void>('booksource_toggle', { fileName, enabled }, 10000)
}

/** 用 VS Code 打开指定书源文件 */
export async function openInVscode(fileName: string): Promise<void> {
  return invokeWithTimeout<void>('booksource_open_in_vscode', { fileName }, 10000)
}

/**
 * 装载书源文件并通过 Boa JS 引擎执行 entryCode。
 * - entryCode 为空时：返回书源内定义的所有顶层函数列表。
 * - entryCode 非空时：在书源作用域内执行该代码，返回结果字符串。
 */
export async function evalBookSource(fileName: string, entryCode?: string): Promise<string> {
  return invokeWithTimeout<string>('booksource_eval', { fileName, entryCode: entryCode ?? null }, 20000)
}

/** 直接执行任意 JS 代码（Boa 引擎），返回结果字符串（调试用途） */
export async function jsEval(code: string): Promise<string> {
  return invokeWithTimeout<string>('js_eval', { code }, 15000)
}

/**
 * 调用书源的 explore 函数（发现页）
 * @param fileName 书源文件名（含 .js 后缀）
 * @param category 分类名称（"GETALL" 获取分类列表，具体分类名获取书籍）
 * @param page     页码，从 1 开始
 */
export async function exploreBookSource(fileName: string, category: string, page = 1): Promise<unknown> {
  return invokeWithTimeout('booksource_explore', { fileName, page, category }, 35000)
}

// ── 脚本配置持久化（对应 Rust script_config 命令） ────────────────────────

/**
 * 读取脚本配置值
 * @param scope  作用域标识（通常为书源/扩展文件名）
 * @param key    配置键名
 * @returns      字符串值，键不存在时返回空字符串
 */
export async function configRead(scope: string, key: string): Promise<string> {
  return invokeWithTimeout<string>('config_read', { scope, key }, 10000)
}

/**
 * 写入脚本配置值
 * @param scope  作用域标识
 * @param key    配置键名
 * @param value  配置值（复杂结构先 JSON.stringify）
 */
export async function configWrite(scope: string, key: string, value: string): Promise<void> {
  return invokeWithTimeout<void>('config_write', { scope, key, value }, 10000)
}

/** 删除指定配置键 */
export async function configDeleteKey(scope: string, key: string): Promise<void> {
  return invokeWithTimeout<void>('config_delete_key', { scope, key }, 10000)
}

/** 读取某 scope 下的所有配置（返回 JSON 字符串） */
export async function configReadAll(scope: string): Promise<string> {
  return invokeWithTimeout<string>('config_read_all', { scope }, 10000)
}

/** 清除某 scope 下的所有配置 */
export async function configClear(scope: string): Promise<void> {
  return invokeWithTimeout<void>('config_clear', { scope }, 10000)
}

// ── 字节数组配置（对应 Rust config_read_bytes / config_write_bytes） ───────

/**
 * 读取字节数组配置值
 * @param scope 作用域标识
 * @param key   配置键名
 * @returns     Uint8Array，键不存在时返回空数组
 */
export async function configReadBytes(scope: string, key: string): Promise<Uint8Array> {
  const arr = await invokeWithTimeout<number[]>('config_read_bytes', { scope, key }, 10000)
  return new Uint8Array(arr)
}

/**
 * 写入字节数组配置值
 * @param scope 作用域标识
 * @param key   配置键名
 * @param value Uint8Array 数据（编码由调用方负责）
 */
export async function configWriteBytes(scope: string, key: string, value: Uint8Array): Promise<void> {
  return invokeWithTimeout<void>('config_write_bytes', { scope, key, value: Array.from(value) }, 10000)
}

// ── 漫画图片下载 & 缓存 ──────────────────────────────────────────────────

/**
 * 获取漫画章节的可渲染图片源列表，并在后台继续顺序缓存缺失页
 * @param fileName    书源文件名
 * @param chapterUrl  章节 URL（用于生成缓存目录）
 * @param imageUrls   图片 URL 数组
 * @returns 可直接渲染的图片源数组：
 *          已缓存页返回本地路径，未缓存页返回原始 URL
 */
export async function comicDownloadImages(
  fileName: string,
  chapterUrl: string,
  imageUrls: string[],
): Promise<string[]> {
  return invokeWithTimeout<string[]>('comic_download_images', { fileName, chapterUrl, imageUrls }, 60000)
}

/**
 * 获取已缓存的单页图片（base64 Data URL）
 * @param fileName    书源文件名
 * @param chapterUrl  章节 URL
 * @param pageIndex   页码索引（从 0 开始）
 */
export async function comicGetCachedPage(
  fileName: string,
  chapterUrl: string,
  pageIndex: number,
): Promise<string> {
  return invokeWithTimeout<string>('comic_get_cached_page', { fileName, chapterUrl, pageIndex }, 10000)
}

/**
 * 清理漫画缓存
 * @param fileName  书源文件名（为 null 时清理全部）
 * @returns 释放的字节数
 */
export async function comicCacheClear(fileName?: string): Promise<number> {
  return invokeWithTimeout<number>('comic_cache_clear', { fileName: fileName ?? null }, 30000)
}

/**
 * 获取漫画缓存总大小（字节）
 */
export async function comicCacheSize(): Promise<number> {
  return invokeWithTimeout<number>('comic_cache_size', {}, 10000)
}

// ── 书源更新检测 ─────────────────────────────────────────────────────────

export interface UpdateCheckResult {
  fileName: string
  hasUpdate: boolean
  localVersion: string
  remoteVersion: string
}

/**
 * 检测单个书源是否有更新（需要书源设置了 @updateUrl）
 */
export async function checkBookSourceUpdate(fileName: string): Promise<UpdateCheckResult> {
  return invokeWithTimeout<UpdateCheckResult>('booksource_check_update', { fileName }, 20000)
}

/**
 * 从 @updateUrl 拉取最新内容并覆盖本地文件
 */
export async function applyBookSourceUpdate(fileName: string): Promise<void> {
  return invokeWithTimeout<void>('booksource_apply_update', { fileName }, 20000)
}


/** 将任意字符串转为合法 JS 文件名 */
export function toSafeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_') + '.js'
}

/** 生成新书源 JS 文件的模板内容 */
export function newBookSourceTemplate(name = '新书源', url = 'https://') {
  return `// @name        ${name}
// @version     1.0.0
// @author      作者名
// @url         ${url}
// @logo        default
// @enabled     true
// @tags        免费,小说
// @description 书源简介

// ─────────────────────────────────────────────────────────────
//  常量：将书源根地址统一在这里维护，方便镜像切换
//  使用说明：
//    legado.http.get(url)            — 同步 HTTP GET，返回响应体字符串
//    legado.http.post(url, body)     — 同步 HTTP POST，返回响应体字符串
//    legado.config.read(scope, key)  — 读取持久化配置（字符串）
//    legado.config.write(scope, key, value) — 写入持久化配置
//    legado.log(msg)                 — 打印日志到调试控制台
//  提示：所有 http 请求均为同步，无需 await
// ─────────────────────────────────────────────────────────────
const BASE_URL = '${url}'
const SCOPE    = '${name}'   // 配置存储隔离标识，建议用书源名

/**
 * 搜索书籍
 * 引擎调用时机：用户主动搜索时
 *
 * @param {string} key   搜索关键词
 * @param {number} page  页码（从 1 开始）
 * @returns {BookItem[]}
 */
function search(key, page) {
  const resp = legado.http.get(
    \`\${BASE_URL}/api/search?keyword=\${encodeURIComponent(key)}&page=\${page}\`
  )
  const json = JSON.parse(resp)
  return (json.data?.list ?? []).map(book => ({
    name:          book.name,
    author:        book.author,
    coverUrl:      book.cover,
    intro:         book.intro,
    bookUrl:       \`\${BASE_URL}/book/\${book.id}\`,
    latestChapter: book.lastChapter,
  }))
}

/**
 * 书籍详情（封面、简介、目录入口等）
 * 引擎调用时机：用户点击书籍进入详情页时
 *
 * @param {string} bookUrl
 * @returns {BookItem}
 */
function bookInfo(bookUrl) {
  const resp = legado.http.get(bookUrl)
  const json = JSON.parse(resp)
  return {
    name:          json.data.name,
    author:        json.data.author,
    coverUrl:      json.data.cover,
    intro:         json.data.intro,
    bookUrl,
    latestChapter: json.data.lastChapter,
    tocUrl:        bookUrl,   // 若目录与详情同页，可直接复用
  }
}

/**
 * 目录列表
 * 引擎调用时机：用户加载书籍目录时
 *
 * @param {string} tocUrl  目录页 URL（通常与 bookUrl 相同）
 * @returns {ChapterInfo[]}
 */
function toc(tocUrl) {
  const resp = legado.http.get(\`\${tocUrl}/chapters\`)
  const json = JSON.parse(resp)
  return (json.data?.chapters ?? []).map(ch => ({
    name: ch.title,
    url:  \`\${BASE_URL}/chapter/\${ch.id}\`,
  }))
}

/**
 * 章节正文
 * 引擎调用时机：用户翻开某章节时
 *
 * @param {string} chapterUrl
 * @returns {string}  纯文本正文
 */
function content(chapterUrl) {
  const resp = legado.http.get(chapterUrl)
  const json = JSON.parse(resp)
  return json.data?.content ?? ''
}

/**
 * 发现页（可选）
 * 若实现此函数，发现页将展示该书源的热门/分类推荐书目
 *
 * @param {number} page  页码（从 1 开始）
 * @returns {ExploreItem[]}
 */
function explore(page) {
  const resp = legado.http.get(\`\${BASE_URL}/api/discover?page=\${page}\`)
  const json = JSON.parse(resp)
  return (json.data?.list ?? []).map(book => ({
    name:    book.name,
    author:  book.author,
    bookUrl: \`\${BASE_URL}/book/\${book.id}\`,
    coverUrl: book.cover,
    intro:   book.intro,
    type:    book.category,
  }))
}
`
}

// ── 书源仓库 ─────────────────────────────────────────────────────────────

/** 仓库中单个书源的元数据（对应 Rust RepoSourceInfo） */
export interface RepoSourceInfo {
  name: string
  version: string
  author: string
  url: string
  logo: string
  description: string
  tags: string[]
  enabled: boolean
  fileName: string
  downloadUrl: string
  fileSize: number
  updatedAt: string
}

/** 仓库顶层清单（对应 Rust RepoManifest） */
export interface RepoManifest {
  name: string
  version: string
  updatedAt: string
  sources: RepoSourceInfo[]
}

/** 拉取远程仓库 JSON */
export async function fetchRepository(url: string): Promise<RepoManifest> {
  return invokeWithTimeout<RepoManifest>('repository_fetch', { url }, 35000)
}

/** 从仓库下载书源 .js 文件并安装到本地 */
export async function installFromRepository(downloadUrl: string, fileName: string): Promise<void> {
  return invokeWithTimeout<void>('repository_install', { downloadUrl, fileName }, 35000)
}

// ── 书源内置测试 ─────────────────────────────────────────────────────────

/** 单个测试步骤的结果 */
export interface TestStepResult {
  step: string
  passed: boolean
  message: string
  durationMs: number
}

/** 全量测试结果 */
export interface TestRunResult {
  fileName: string
  steps: TestStepResult[]
  allPassed: boolean
}

/** 执行书源内置测试（依次运行 search / bookInfo / chapterList / chapterContent / explore） */
export async function runBookSourceTests(fileName: string): Promise<TestRunResult> {
  // 测试超时给 4 倍引擎超时 + 余量
  return invokeWithTimeout<TestRunResult>('booksource_run_tests', { fileName }, 150000)
}
