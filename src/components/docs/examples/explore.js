/**
 * 发现页 — 热门 / 分类 / 推荐书目（可选函数）
 * 若书源不实现此函数，发现页将自动跳过该书源
 *
 * @param {number} page  页码（从 1 开始）
 * @returns {ExploreItem[]}
 */
function explore(page) {
  const resp = legado.http.get(
    'https://api.example.com/discover?page=' + page
  )
  const json = JSON.parse(resp)

  return (json.data?.list ?? []).map(book => ({
    name:     book.title,           // 书名（必填）
    bookUrl:  'https://api.example.com/book/' + book.id,  // URL（必填）
    author:   book.author,          // 作者（可选）
    coverUrl: book.cover_url,       // 封面（可选）
    intro:    book.summary,         // 简介（可选）
    type:     book.category,        // 分类标签，如 "玄幻" / "都市"（可选）
  }))
}
