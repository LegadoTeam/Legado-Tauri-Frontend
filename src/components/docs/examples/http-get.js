// ─── 基本用法 ────────────────────────────────────────────────────
const html = legado.http.get('https://www.example.com/page')

// ─── 解析 JSON 响应 ──────────────────────────────────────────────
const resp = legado.http.get('https://api.example.com/books')
const data = JSON.parse(resp)
legado.log('共 ' + data.total + ' 本书')

// ─── 带参数的 URL 拼接 ───────────────────────────────────────────
const BASE_URL = 'https://www.example.com'
const keyword  = '三体'
const page     = 1

const result = legado.http.get(
  BASE_URL + '/search?q=' + encodeURIComponent(keyword) + '&page=' + page
)

// ─── 错误处理 ────────────────────────────────────────────────────
function safeGet(url) {
  try {
    return legado.http.get(url)
  } catch (e) {
    legado.log('请求失败: ' + e.message)
    return null
  }
}

// ─── 注意：所有请求均为同步阻塞 ─────────────────────────────────
// Boa 引擎不支持 async/await / Promise，无需 await
// ✓  const body = legado.http.get(url)
// ✗  const body = await legado.http.get(url)  // 错误写法
