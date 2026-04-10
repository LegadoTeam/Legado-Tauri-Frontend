// ── BookItem — 书籍搜索 / 详情 ─────────────────────────────────────
// interface BookItem {
//   name:           string    // 【必填】书名
//   bookUrl:        string    // 【必填】书籍主页 URL
//
//   author?:        string    // 作者
//   coverUrl?:      string    // 封面图片 URL
//   intro?:         string    // 简介
//   latestChapter?: string    // 最新章节标题
//   tocUrl?:        string    // 目录入口 URL（可与 bookUrl 相同）
// }

// ── ChapterInfo — 章节目录 ────────────────────────────────────────
// interface ChapterInfo {
//   name: string    // 【必填】章节名
//   url:  string    // 【必填】章节内容 URL
// }

// ── ExploreItem — 发现页条目 ──────────────────────────────────────
// interface ExploreItem {
//   name:     string    // 【必填】书名
//   bookUrl:  string    // 【必填】书籍 URL
//
//   author?:  string    // 作者
//   coverUrl?: string   // 封面
//   intro?:   string    // 简介
//   type?:    string    // 分类标签，如 "玄幻" / "都市" / "历史"
// }

// ── legado 全局 namespace — Boa 引擎注入 ──────────────────────────
//
// declare namespace legado {
//
//   namespace http {
//     /** 同步 HTTP GET，返回响应体字符串 */
//     function get(url: string): string
//
//     /** 同步 HTTP POST，返回响应体字符串 */
//     function post(url: string, body?: string): string
//   }
//
//   namespace config {
//     /** 读取字符串配置；键不存在返回 '' */
//     function read(scope: string, key: string): string
//     /** 写入字符串配置（持久化到磁盘） */
//     function write(scope: string, key: string, value: string): void
//     /** 读取字节数组配置；键不存在返回 [] */
//     function readBytes(scope: string, key: string): number[]
//     /** 写入字节数组配置 */
//     function writeBytes(scope: string, key: string, value: number[]): void
//   }
//
//   /** 打印日志到调试面板 */
//   function log(msg: unknown): void
//
//   namespace ui {
//     /** 向前端推送自定义事件（通过 script:ui 事件传递） */
//     function emit(event: string, data?: unknown): void
//   }
// }

// ── 书源必须实现的函数签名 ────────────────────────────────────────
//
// function search(key: string, page: number): BookItem[]
// function bookInfo(bookUrl: string): BookItem
// function toc(tocUrl: string): ChapterInfo[]
// function content(chapterUrl: string): string
//
// ── 可选函数 ──────────────────────────────────────────────────────
//
// function explore(page: number): ExploreItem[]
