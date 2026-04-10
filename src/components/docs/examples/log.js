// ─── 基本用法：任意类型均可传入 ─────────────────────────────────
legado.log('开始搜索: ' + keyword)
legado.log(42)
legado.log(true)
legado.log({ status: 'ok', count: 5 })   // 对象会序列化为字符串
legado.log(null)

// ─── 调试 HTTP 请求 ──────────────────────────────────────────────
function debugGet(url) {
  legado.log('[GET] ' + url)
  const resp = legado.http.get(url)
  legado.log('[RSP] 长度=' + resp.length + ' 前100字符: ' + resp.slice(0, 100))
  return resp
}

// ─── 函数执行追踪 ────────────────────────────────────────────────
function search(key, page) {
  legado.log('search() key=' + key + ' page=' + page)

  const resp = legado.http.get(
    'https://api.example.com/search?q=' + encodeURIComponent(key)
  )
  const list = JSON.parse(resp).list ?? []

  legado.log('search() 返回 ' + list.length + ' 条结果')
  return list
}

// ─── 日志分组（用缩进模拟层级）──────────────────────────────────
legado.log('=== toc 开始 ===')
legado.log('  请求: ' + tocUrl)
legado.log('  章节数: ' + chapters.length)
legado.log('=== toc 完成 ===')

// 注：日志同时输出到 stderr 和"调试书源"面板（通过 script:log 事件传递）
