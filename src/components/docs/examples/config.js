const SCOPE = 'my_source.js'   // 建议用书源文件名，各书源互不影响

// ─── 字符串读写 ──────────────────────────────────────────────────
legado.config.write(SCOPE, 'token', 'eyJhbGciOiJSUzI1...')
legado.config.write(SCOPE, 'lastPage', String(42))

// 读取：键不存在时返回 ''
const token = legado.config.read(SCOPE, 'token')
const page  = Number(legado.config.read(SCOPE, 'lastPage') || '1')

// ─── 存储复杂对象（先 JSON.stringify）────────────────────────────
const state = { token: 'abc', userId: 123, expire: Date.now() + 3600000 }
legado.config.write(SCOPE, 'state', JSON.stringify(state))

const raw   = legado.config.read(SCOPE, 'state')
const saved = raw ? JSON.parse(raw) : null

// ─── 字节数组读写（适合二进制 / 大体积数据）─────────────────────
// 写入：将字符串编码为 UTF-8 字节数组
function cacheHtml(key, text) {
  const bytes = Array.from(new TextEncoder().encode(text))
  legado.config.writeBytes(SCOPE, key, bytes)
}

// 读取：字节数组解码回字符串
function loadHtml(key) {
  const bytes = legado.config.readBytes(SCOPE, key)  // number[]
  if (bytes.length === 0) return null
  return new TextDecoder().decode(new Uint8Array(bytes))
}

cacheHtml('chapter_1', '<html>...</html>')
const html = loadHtml('chapter_1')
legado.log('缓存大小: ' + (html ? html.length : 0) + ' 字符')
