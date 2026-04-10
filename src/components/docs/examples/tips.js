// ─── 1. 检查书源完整性（贴到书源末尾，Boa 加载时会自动执行）────
const required = ['search', 'bookInfo', 'toc', 'content']
required.forEach(fn => {
  const ok = typeof eval(fn) === 'function'   // eslint-disable-line no-eval
  legado.log((ok ? '✓' : '✗') + ' ' + fn)
})

// ─── 2. 打印格式化 JSON ──────────────────────────────────────────
function logJson(label, data) {
  legado.log(label + ': ' + JSON.stringify(data, null, 2))
}

// ─── 3. 安全取值（防止 undefined 访问导致崩溃）──────────────────
function get(obj, path, fallback) {
  return path.split('.').reduce(
    (cur, key) => (cur != null ? cur[key] : undefined),
    obj
  ) ?? fallback
}

// 用法示例
const title = get(json, 'data.book.title', '未知书名')

// ─── 4. 带重试的 GET ─────────────────────────────────────────────
function getWithRetry(url, retries) {
  for (let i = 0; i < retries; i++) {
    try {
      return legado.http.get(url)
    } catch (e) {
      legado.log('第 ' + (i + 1) + '/' + retries + ' 次失败: ' + e.message)
    }
  }
  throw new Error('请求失败：已重试 ' + retries + ' 次')
}

// ─── 5. 简单的 HTML 文本提取 ────────────────────────────────────
function extractText(html, startTag, endTag) {
  const s = html.indexOf(startTag)
  const e = html.indexOf(endTag, s)
  if (s === -1 || e === -1) return ''
  return html.slice(s + startTag.length, e).replace(/<[^>]+>/g, '').trim()
}

// 用法示例
const title2 = extractText(html, '<h1 class="title">', '</h1>')

// ─── 6. 测量请求耗时 ─────────────────────────────────────────────
function timedGet(url) {
  const start = Date.now()
  const resp  = legado.http.get(url)
  legado.log('耗时: ' + (Date.now() - start) + 'ms，响应大小: ' + resp.length + ' 字节')
  return resp
}
