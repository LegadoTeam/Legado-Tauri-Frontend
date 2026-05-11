import { invokeWithTimeout } from './useInvoke';

// ── 类型定义（与 Rust BookSourceMeta 对应）────────────────────────────────

export interface BookSourceMeta {
  sourceKey: string;
  uuid: string;
  fileName: string;
  name: string;
  /** 主 URL（第一个 @url） */
  url: string;
  /** 全部 URL（含主 URL；多镜像时有多条） */
  urls: string[];
  author?: string;
  logo?: string;
  /** 多行描述（多条 @description 以换行拼接） */
  description?: string;
  enabled: boolean;
  fileSize: number;
  modifiedAt: number;
  /** 该书源所在目录的绝对路径 */
  sourceDir: string;
  /** 书源类型："novel"（小说，默认）| "comic"（漫画）| "video"（视频）| "music"（音乐/有声书） */
  sourceType: string;
  /** 版本号（用于更新检测） */
  version: string;
  /** 自动更新 URL（可选，指向远程 .js 文件地址） */
  updateUrl?: string;
  /** 标签列表（@tags 逗号分隔，如 "笔趣阁,小说,免费小说"） */
  tags: string[];
  /** 单书源最小请求间隔（毫秒） */
  minDelayMs: number;
  /** @require 依赖 JS 的 URL 列表（按声明顺序），书源加载前会依序 eval */
  requireUrls: string[];
}

// ── API 封装 ─────────────────────────────────────────────────────────────

/** 获取书源目录绝对路径 */
export async function getBookSourceDir(): Promise<string> {
  return invokeWithTimeout<string>('booksource_get_dir', {}, 10000);
}

/** 获取所有书源目录（内置 + 外部） */
export async function getBookSourceDirs(): Promise<string[]> {
  return invokeWithTimeout<string[]>('booksource_get_dirs', {}, 10000);
}

/** 添加外部书源目录 */
export async function addBookSourceDir(dirPath: string): Promise<void> {
  return invokeWithTimeout<void>('booksource_add_dir', { dirPath }, 10000);
}

/** 移除外部书源目录 */
export async function removeBookSourceDir(dirPath: string): Promise<void> {
  return invokeWithTimeout<void>('booksource_remove_dir', { dirPath }, 10000);
}

/** 弹出系统目录选择对话框，返回选择的路径（取消返回空字符串） */
export async function pickBookSourceDir(): Promise<string> {
  return invokeWithTimeout<string>('booksource_pick_dir', {}, 60000);
}

/** 列举所有已安装书源（一次性全量返回，不建议在书源数量 > 500 时使用） */
export async function listBookSources(): Promise<BookSourceMeta[]> {
  return invokeWithTimeout<BookSourceMeta[]>('booksource_list', {}, 15000);
}

/**
 * 流式列举书源：立即返回，后台通过 `booksource:batch` 事件分批推送。
 * 调用方需在调用本函数前监听 `booksource:batch` 事件，并通过 `requestId` 过滤。
 */
export async function listBookSourcesStreaming(requestId: string): Promise<void> {
  return invokeWithTimeout<void>('booksource_list_streaming', { requestId }, 10000);
}

/** 读取单个书源 JS 内容 */
export async function readBookSource(fileName: string, sourceDir?: string): Promise<string> {
  return invokeWithTimeout<string>('booksource_read', { fileName, sourceDir: sourceDir ?? null }, 10000);
}

/** 保存书源 JS 文件（新建或覆盖），fileName 不含路径 */
export async function saveBookSource(fileName: string, content: string, sourceDir?: string): Promise<void> {
  return invokeWithTimeout<void>('booksource_save', { fileName, content, sourceDir: sourceDir ?? null }, 10000);
}

/** 删除书源文件 */
export async function deleteBookSource(fileName: string, sourceDir?: string): Promise<void> {
  return invokeWithTimeout<void>('booksource_delete', { fileName, sourceDir: sourceDir ?? null }, 10000);
}

/** 切换书源启用/禁用（修改文件头部 @enabled 标记） */
export async function toggleBookSource(fileName: string, enabled: boolean, sourceDir?: string): Promise<void> {
  return invokeWithTimeout<void>('booksource_toggle', { fileName, enabled, sourceDir: sourceDir ?? null }, 10000);
}

/** 用 VS Code 打开指定书源文件 */
export async function openInVscode(fileName: string, sourceDir?: string): Promise<void> {
  return invokeWithTimeout<void>('booksource_open_in_vscode', { fileName, sourceDir: sourceDir ?? null }, 10000);
}

/**
 * 装载书源文件并通过 Boa JS 引擎执行 entryCode。
 * - entryCode 为空时：返回书源内定义的所有顶层函数列表。
 * - entryCode 非空时：在书源作用域内执行该代码，返回结果字符串。
 */
export async function evalBookSource(fileName: string, entryCode?: string): Promise<string> {
  return invokeWithTimeout<string>('booksource_eval', { fileName, entryCode: entryCode ?? null }, 20000);
}

/** 直接执行任意 JS 代码（Boa 引擎），返回结果字符串（调试用途） */
export async function jsEval(code: string): Promise<string> {
  return invokeWithTimeout<string>('js_eval', { code }, 15000);
}

/**
 * 调用书源的 explore 函数（发现页）
 * @param fileName 书源文件名（含 .js 后缀）
 * @param category 分类名称（"GETALL" 获取分类列表，具体分类名获取书籍）
 * @param page     页码，从 1 开始
 */
export async function exploreBookSource(fileName: string, category: string, page = 1): Promise<unknown> {
  return invokeWithTimeout('booksource_explore', { fileName, page, category }, 35000);
}

// ── 脚本配置持久化（对应 Rust script_config 命令） ────────────────────────

/**
 * 读取脚本配置值
 * @param scope  作用域标识（通常为书源/扩展文件名）
 * @param key    配置键名
 * @returns      字符串值，键不存在时返回空字符串
 */
export async function configRead(scope: string, key: string): Promise<string> {
  return invokeWithTimeout<string>('config_read', { scope, key }, 10000);
}

export type ScriptConfigJsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: ScriptConfigJsonValue }
  | ScriptConfigJsonValue[];

/**
 * 写入脚本配置值。
 * - 传入字符串时沿用旧字符串接口
 * - 传入对象/数组/数值/布尔/null 时走原生 JSON 接口，避免额外 JSON 编码
 */
export async function configWrite(scope: string, key: string, value: ScriptConfigJsonValue): Promise<void> {
  if (typeof value === 'string') {
    return invokeWithTimeout<void>('config_write', { scope, key, value }, 10000);
  }
  return invokeWithTimeout<void>('config_write_json', { scope, key, value }, 10000);
}

/** 删除指定配置键 */
export async function configDeleteKey(scope: string, key: string): Promise<void> {
  return invokeWithTimeout<void>('config_delete_key', { scope, key }, 10000);
}

/** 读取某 scope 下的所有配置（返回 JSON 字符串） */
export async function configReadAll(scope: string): Promise<string> {
  return invokeWithTimeout<string>('config_read_all', { scope }, 10000);
}

/** 读取脚本配置的原生 JSON 值；键不存在时返回 null */
export async function configReadJson<T extends ScriptConfigJsonValue = ScriptConfigJsonValue>(
  scope: string,
  key: string,
): Promise<T | null> {
  return invokeWithTimeout<T | null>('config_read_json', { scope, key }, 10000);
}

/** 清除某 scope 下的所有配置 */
export async function configClear(scope: string): Promise<void> {
  return invokeWithTimeout<void>('config_clear', { scope }, 10000);
}

// ── 字节数组配置（对应 Rust config_read_bytes / config_write_bytes） ───────

/**
 * 读取字节数组配置值
 * @param scope 作用域标识
 * @param key   配置键名
 * @returns     Uint8Array，键不存在时返回空数组
 */
export async function configReadBytes(scope: string, key: string): Promise<Uint8Array> {
  const arr = await invokeWithTimeout<number[]>('config_read_bytes', { scope, key }, 10000);
  return new Uint8Array(arr);
}

/**
 * 写入字节数组配置值
 * @param scope 作用域标识
 * @param key   配置键名
 * @param value Uint8Array 数据（编码由调用方负责）
 */
export async function configWriteBytes(scope: string, key: string, value: Uint8Array): Promise<void> {
  return invokeWithTimeout<void>('config_write_bytes', { scope, key, value: Array.from(value) }, 10000);
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
  bookUrl: string,
  bookName: string,
  chapterUrl: string,
  chapterIndex: number,
  imageUrls: string[],
): Promise<string[]> {
  return invokeWithTimeout<string[]>(
    'comic_download_images',
    { fileName, bookUrl, bookName, chapterUrl, chapterIndex, imageUrls },
    60000,
  );
}

/**
 * 获取章节已缓存的所有图片原始像素尺寸。
 * 返回数组长度 = 已记录页数，元素为 [width, height] 或 null（该页未缓存/未记录）。
 * 前端可据此精确计算 scrollTop，无需等待图片在视口内加载。
 */
export async function comicGetPageSizes(
  fileName: string,
  bookUrl: string,
  bookName: string,
  chapterIndex: number,
): Promise<Array<[number, number] | null>> {
  return invokeWithTimeout<Array<[number, number] | null>>(
    'comic_get_page_sizes',
    { fileName, bookUrl, bookName, chapterIndex },
    5000,
  );
}

/**
 * 获取已缓存的单页图片（base64 Data URL）
 * @param fileName    书源文件名
 * @param chapterUrl  章节 URL
 * @param pageIndex   页码索引（从 0 开始）
 */
export async function comicGetCachedPage(
  fileName: string,
  bookUrl: string,
  bookName: string,
  chapterIndex: number,
  pageIndex: number,
): Promise<string> {
  return invokeWithTimeout<string>(
    'comic_get_cached_page',
    { fileName, bookUrl, bookName, chapterIndex, pageIndex },
    10000,
  );
}

/**
 * 清理单章漫画图片缓存（按 fileName + chapterUrl 定位）
 * @returns 释放的字节数
 */
export async function comicCacheClearChapter(
  fileName: string,
  bookUrl: string,
  bookName: string,
  chapterIndex: number,
): Promise<number> {
  return invokeWithTimeout<number>('comic_cache_clear_chapter', { fileName, bookUrl, bookName, chapterIndex }, 15000);
}

/**
 * 清理漫画缓存
 * @param fileName  书源文件名（为 null 时清理全部）
 * @returns 释放的字节数
 */
export async function comicCacheClear(fileName?: string): Promise<number> {
  return invokeWithTimeout<number>('comic_cache_clear', { fileName: fileName ?? null }, 30000);
}

/**
 * 获取漫画缓存总大小（字节）
 */
export async function comicCacheSize(): Promise<number> {
  return invokeWithTimeout<number>('comic_cache_size', {}, 10000);
}

// ── 书源更新检测 ─────────────────────────────────────────────────────────

export interface UpdateCheckResult {
  fileName: string;
  uuid: string;
  hasUpdate: boolean;
  localVersion: string;
  remoteVersion: string;
}

/**
 * 检测单个书源是否有更新（需要书源设置了 @updateUrl）
 */
export async function checkBookSourceUpdate(fileName: string): Promise<UpdateCheckResult> {
  return invokeWithTimeout<UpdateCheckResult>('booksource_check_update', { fileName }, 20000);
}

/**
 * 从 @updateUrl 拉取最新内容并覆盖本地文件
 */
export async function applyBookSourceUpdate(fileName: string): Promise<void> {
  return invokeWithTimeout<void>('booksource_apply_update', { fileName }, 20000);
}

/** 将任意字符串转为合法 JS 文件名 */
export function toSafeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_') + '.js';
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

const BASE_URL = '${url}'

// ── 搜索 ─────────────────────────────────────────────────────
// 返回 BookItem[]
async function search(key, page) {
  const resp = await legado.http.get(
    \`\${BASE_URL}/api/search?keyword=\${encodeURIComponent(key)}&page=\${page}\`
  )
  const json = JSON.parse(resp)
  return (json.data?.list ?? []).map(book => ({
    name:    book.name,
    author:  book.author,
    coverUrl: book.cover,
    intro:   book.intro,
    bookUrl: \`\${BASE_URL}/book/\${book.id}\`,
  }))
}

// ── 书籍详情 ──────────────────────────────────────────────────
// 返回 BookItem（含 tocUrl）
async function bookInfo(bookUrl) {
  const resp = await legado.http.get(bookUrl)
  const json = JSON.parse(resp)
  return {
    name:    json.data.name,
    author:  json.data.author,
    coverUrl: json.data.cover,
    intro:   json.data.intro,
    bookUrl,
    tocUrl:  bookUrl,
  }
}

// ── 章节目录 ──────────────────────────────────────────────────
// 返回 ChapterInfo[]
async function toc(tocUrl) {
  const resp = await legado.http.get(tocUrl)
  const json = JSON.parse(resp)
  return (json.data?.chapters ?? []).map(ch => ({
    name: ch.title,
    url:  \`\${BASE_URL}/chapter/\${ch.id}\`,
  }))
}

// ── 章节正文 ──────────────────────────────────────────────────
// 返回纯文本字符串
async function content(chapterUrl) {
  const resp = await legado.http.get(chapterUrl)
  const json = JSON.parse(resp)
  return json.data?.content ?? ''
}

// ── 发现页（可选） ────────────────────────────────────────────
// 返回 ExploreItem[]，不需要时可删除此函数
// async function explore(page) { ... }
`;
}

export function newVideoSourceTemplate(name = '新视频源', url = 'https://') {
  return `// @name        ${name}
// @version     1.0.0
// @author      作者名
// @type        video
// @url         ${url}
// @logo        default
// @enabled     true
// @tags        免费,视频
// @description 视频源简介

// ─────────────────────────────────────────────────────────────
//  视频书源 — content() 返回视频播放地址
//  支持格式：mp4 直链 / m3u8 (HLS) / JSON 对象
//
//  content() 返回值说明：
//    1. 简单 URL 字符串:  "https://example.com/video.mp4"
//    2. JSON 字符串:
//       {
//         "url":       "https://example.com/index.m3u8",
//         "type":      "hls",              // 可选: "hls" | "mp4"
//         "headers":   { "Referer": "..." },// 可选
//         "qualities": [                    // 可选: 多清晰度
//           { "label": "1080P", "url": "https://..." },
//           { "label": "720P",  "url": "https://..." }
//         ],
//         "subtitles": [                    // 可选: 字幕
//           { "label": "中文", "url": "https://.../zh.vtt", "lang": "zh" }
//         ]
//       }
// ─────────────────────────────────────────────────────────────
const BASE_URL = '${url}'
const SCOPE    = '${name}'

/**
 * 搜索影视
 * @param {string} key   搜索关键词
 * @param {number} page  页码（从 1 开始）
 * @returns {BookItem[]}
 */
async function search(key, page) {
  const resp = await legado.http.get(
    \`\${BASE_URL}/api/search?keyword=\${encodeURIComponent(key)}&page=\${page}\`
  )
  const json = JSON.parse(resp)
  return (json.data?.list ?? []).map(item => ({
    name:     item.name,
    author:   item.director ?? item.author ?? '',
    coverUrl: item.cover,
    intro:    item.intro,
    bookUrl:  \`\${BASE_URL}/video/\${item.id}\`,
    kind:     item.category,
  }))
}

/**
 * 影视详情
 * @param {string} bookUrl
 * @returns {BookItem}
 */
async function bookInfo(bookUrl) {
  const resp = await legado.http.get(bookUrl)
  const json = JSON.parse(resp)
  return {
    name:     json.data.name,
    author:   json.data.director ?? '',
    coverUrl: json.data.cover,
    intro:    json.data.intro,
    bookUrl,
    tocUrl:   bookUrl,
  }
}

/**
 * 剧集 / 选集列表
 * 电影返回单集即可，电视剧返回多集
 * @param {string} tocUrl
 * @returns {ChapterInfo[]}
 */
async function toc(tocUrl) {
  const resp = await legado.http.get(\`\${tocUrl}/episodes\`)
  const json = JSON.parse(resp)
  return (json.data?.episodes ?? []).map(ep => ({
    name: ep.title,
    url:  \`\${BASE_URL}/play/\${ep.id}\`,
  }))
}

/**
 * 获取播放地址
 * 返回视频 URL 字符串，或包含 url/type/headers/qualities 的 JSON 字符串
 * @param {string} chapterUrl
 * @returns {string}
 */
async function content(chapterUrl) {
  const resp = await legado.http.get(chapterUrl)
  const json = JSON.parse(resp)
  // 直接返回播放地址
  return json.data?.playUrl ?? ''
}

/**
 * 发现页（可选）
 * @param {number} page  页码（从 1 开始）
 * @returns {ExploreItem[]}
 */
async function explore(page) {
  const resp = await legado.http.get(\`\${BASE_URL}/api/discover?page=\${page}\`)
  const json = JSON.parse(resp)
  return (json.data?.list ?? []).map(item => ({
    name:     item.name,
    author:   item.director ?? '',
    bookUrl:  \`\${BASE_URL}/video/\${item.id}\`,
    coverUrl: item.cover,
    intro:    item.intro,
    type:     item.category,
  }))
}
`;
}

// ── 书源仓库 ─────────────────────────────────────────────────────────────

/** 仓库中单个书源的元数据（对应 Rust RepoSourceInfo） */
export interface RepoSourceInfo {
  uuid?: string;
  name: string;
  version: string;
  author: string;
  url: string;
  logo: string;
  description: string;
  tags: string[];
  enabled: boolean;
  fileName: string;
  downloadUrl: string;
  fileSize: number;
  updatedAt: string;
}

/** 仓库顶层清单（对应 Rust RepoManifest） */
export interface RepoManifest {
  name: string;
  version: string;
  updatedAt: string;
  sources: RepoSourceInfo[];
}

export function getBookSourceIdentity(source: { uuid?: string | null; name: string }): string {
  return source.uuid?.trim() || source.name.trim();
}

export function hasExplicitBookSourceUuid(source: { uuid?: string | null }): boolean {
  return !!source.uuid?.trim();
}

export interface RepoSourceSyncResult {
  fileName: string;
  uuid: string;
  isConsistent: boolean;
  localVersion: string;
  remoteVersion: string;
}

export interface RemoteBookSourcePreview {
  downloadUrl: string;
  meta: BookSourceMeta;
  hasExplicitUuid: boolean;
}

/** 拉取远程仓库 JSON */
export async function fetchRepository(url: string): Promise<RepoManifest> {
  return invokeWithTimeout<RepoManifest>('repository_fetch', { url }, 35000);
}

/** 从仓库下载书源 .js 文件并安装到本地 */
export async function installFromRepository(
  downloadUrl: string,
  fileName: string,
  expectedUuid?: string,
): Promise<void> {
  return invokeWithTimeout<void>(
    'repository_install',
    { downloadUrl, fileName, expectedUuid: expectedUuid ?? null },
    35000,
  );
}

/** 下载远程书源并解析元数据，用于安装前确认 */
export async function previewRemoteBookSource(
  downloadUrl: string,
  expectedUuid?: string,
): Promise<RemoteBookSourcePreview> {
  return invokeWithTimeout<RemoteBookSourcePreview>(
    'repository_preview_source',
    { downloadUrl, expectedUuid: expectedUuid ?? null },
    35000,
  );
}

/** 比较在线仓库书源与本地同 UUID 书源是否一致（忽略 @enabled / @uuid 行） */
export async function checkRepositorySourceSync(
  fileName: string,
  downloadUrl: string,
  expectedUuid?: string,
): Promise<RepoSourceSyncResult> {
  return invokeWithTimeout<RepoSourceSyncResult>(
    'repository_check_source_sync',
    { fileName, downloadUrl, expectedUuid: expectedUuid ?? null },
    35000,
  );
}

// ── 书源内置测试 ─────────────────────────────────────────────────────────

/** 单个测试步骤的结果 */
export interface TestStepResult {
  step: string;
  passed: boolean;
  message: string;
  durationMs: number;
}

/** 全量测试结果 */
export interface TestRunResult {
  fileName: string;
  steps: TestStepResult[];
  allPassed: boolean;
}

/** 执行书源内置测试（依次运行 search / bookInfo / chapterList / chapterContent / explore）
 *
 * @param timeoutSecs 单书源超时秒数，默认 150 秒。同时传给 Rust 侧控制引擎超时。
 */
export async function runBookSourceTests(fileName: string, timeoutSecs = 150): Promise<TestRunResult> {
  return invokeWithTimeout<TestRunResult>(
    'booksource_run_tests',
    { fileName, timeoutSecs },
    timeoutSecs * 1000 + 5000, // JS 层多留 5s 缓冲
  );
}
