// @name        示例书源
// @version     1.0.0
// @author      你的名字
// @url         https://www.example.com
// @group       默认
// @logo        default
// @enabled     true
// @description 这是一个最小可用的书源模板

const BASE_URL = 'https://www.example.com'

// ── 必须实现：搜索 ──────────────────────────────────────────────
function search(key, page) {
  const resp = legado.http.get(
    BASE_URL + '/api/search?q=' + encodeURIComponent(key) + '&page=' + page
  )
  const json = JSON.parse(resp)
  return json.list.map(item => ({
    name:    item.title,
    author:  item.author,
    bookUrl: BASE_URL + '/book/' + item.id,
    coverUrl: item.cover_url,
    intro:   item.summary,
  }))
}

// ── 必须实现：书籍详情 ──────────────────────────────────────────
function bookInfo(bookUrl) {
  const resp = legado.http.get(bookUrl)
  const json = JSON.parse(resp)
  return {
    name:    json.title,
    author:  json.author,
    bookUrl: bookUrl,
    tocUrl:  bookUrl + '/toc',
    intro:   json.summary,
    coverUrl: json.cover_url,
  }
}

// ── 必须实现：目录 ──────────────────────────────────────────────
function toc(tocUrl) {
  const resp = legado.http.get(tocUrl)
  const json = JSON.parse(resp)
  return json.chapters.map(ch => ({
    name: ch.title,
    url:  BASE_URL + '/chapter/' + ch.id,
  }))
}

// ── 必须实现：正文 ──────────────────────────────────────────────
function content(chapterUrl) {
  const resp = legado.http.get(chapterUrl)
  const json = JSON.parse(resp)
  return json.content   // 返回纯文本字符串
}
