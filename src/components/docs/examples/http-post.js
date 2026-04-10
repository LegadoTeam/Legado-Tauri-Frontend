// ─── 发送 Form 表单 ──────────────────────────────────────────────
const resp = legado.http.post(
  'https://www.example.com/login',
  'username=myuser&password=mypass'
)
const result = JSON.parse(resp)
const token  = result.token

// ─── 发送 JSON 请求体 ────────────────────────────────────────────
const body  = JSON.stringify({ keyword: '三体', page: 1 })
const resp2 = legado.http.post('https://api.example.com/search', body)
const data  = JSON.parse(resp2)

// ─── 登录并持久化 token ──────────────────────────────────────────
function login(user, pass) {
  const resp = legado.http.post(
    'https://www.example.com/api/login',
    'user=' + encodeURIComponent(user) +
    '&pass=' + encodeURIComponent(pass)
  )
  const json = JSON.parse(resp)
  if (json.code === 0) {
    // 将 token 保存到持久化配置，下次无需重新登录
    legado.config.write('my_source.js', 'token', json.data.token)
    return json.data.token
  }
  throw new Error('登录失败: ' + json.message)
}

// ─── 使用已保存的 token 请求 ─────────────────────────────────────
function authGet(path) {
  const token = legado.config.read('my_source.js', 'token')
  if (!token) {
    login('myuser', 'mypass')
  }
  // 注：当前 Boa 引擎暂不支持自定义请求头，需 token 通过 URL 参数传递
  return legado.http.get('https://api.example.com' + path + '?token=' + token)
}
