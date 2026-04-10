// 章节元数据列表 — 代码内容通过 Vite ?raw glob 从 examples/*.js 动态加载

export interface DocSection {
  id: string
  title: string
  badge?: string
  badgeType?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info'
  /** 多行说明，每行用 \n 分隔 */
  desc: string
  /** 对应 examples/ 下的文件名 */
  codeFile: string
}

export const sections: DocSection[] = [
  {
    id: 'quickstart',
    title: '快速开始',
    badge: '示例',
    badgeType: 'primary',
    desc: '一个完整的最小书源示例。复制后修改 BASE_URL 即可适配真实站点。\n所有 HTTP 请求均为同步调用，无需 async / await。',
    codeFile: 'quickstart.js',
  },
  {
    id: 'http-get',
    title: 'legado.http.get',
    badge: 'API',
    badgeType: 'info',
    desc: '同步 HTTP GET 请求，直接返回响应体字符串。\n网络异常时抛出 JS 异常，可用 try/catch 捕获。',
    codeFile: 'http-get.js',
  },
  {
    id: 'http-post',
    title: 'legado.http.post',
    badge: 'API',
    badgeType: 'info',
    desc: '同步 HTTP POST 请求。body 为请求体字符串（form 表单 或 JSON 字符串均可）。\n默认 Content-Type 为 application/x-www-form-urlencoded。',
    codeFile: 'http-post.js',
  },
  {
    id: 'config',
    title: 'legado.config',
    badge: 'API',
    badgeType: 'info',
    desc: '持久化配置读写，以 scope（书源文件名）隔离各书源数据。\n提供字符串和字节数组两套接口，数据在应用重启后保留。',
    codeFile: 'config.js',
  },
  {
    id: 'log',
    title: 'legado.log',
    badge: 'API',
    badgeType: 'info',
    desc: '打印日志到 stderr，同时通过 script:log 事件推送到调试面板。\n支持任意类型，对象会自动序列化。',
    codeFile: 'log.js',
  },
  {
    id: 'ui-emit',
    title: 'legado.ui.emit',
    badge: 'API',
    badgeType: 'info',
    desc: '向前端 webview 推送自定义事件，前端通过 listen(\'script:ui\') 接收。\n适合需要与 UI 深度交互的高级场景（进度更新、登录提示等）。',
    codeFile: 'ui-emit.js',
  },
  {
    id: 'search',
    title: 'function search()',
    badge: '必须',
    badgeType: 'error',
    desc: '搜索书籍，引擎在用户搜索时调用。\n返回 BookItem[]，字段含义见"数据结构"章节。',
    codeFile: 'search.js',
  },
  {
    id: 'bookinfo',
    title: 'function bookInfo()',
    badge: '必须',
    badgeType: 'error',
    desc: '获取书籍详情（封面、简介、目录入口 URL 等），用户进入书籍主页时调用。',
    codeFile: 'bookinfo.js',
  },
  {
    id: 'toc',
    title: 'function toc()',
    badge: '必须',
    badgeType: 'error',
    desc: '获取章节目录列表，用户加载目录时调用。\n若目录跨多页，需在函数内循环请求并合并结果。',
    codeFile: 'toc.js',
  },
  {
    id: 'content',
    title: 'function content()',
    badge: '必须',
    badgeType: 'error',
    desc: '获取章节正文，阅读器翻页时调用。\n返回纯文本字符串（不含 HTML 标签），段落间用 \\n 分隔。',
    codeFile: 'content.js',
  },
  {
    id: 'explore',
    title: 'function explore()',
    badge: '可选',
    badgeType: 'warning',
    desc: '发现页推荐书目。书源不实现此函数则发现页自动跳过。\n返回 ExploreItem[]，包含书名、URL、分类标签等。',
    codeFile: 'explore.js',
  },
  {
    id: 'types',
    title: '数据结构',
    badge: '参考',
    badgeType: 'default',
    desc: '书源函数的参数与返回值类型定义，与 Monaco 编辑器 IntelliSense 保持一致。',
    codeFile: 'types.js',
  },
  {
    id: 'tips',
    title: '调试技巧',
    badge: '提示',
    badgeType: 'success',
    desc: '常用的调试辅助代码片段，可临时粘贴到书源末尾，配合"调试书源"面板使用。',
    codeFile: 'tips.js',
  },
]
