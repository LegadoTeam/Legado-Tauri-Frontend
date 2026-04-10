/**
 * 搜索书籍
 * 引擎在用户搜索时调用
 *
 * @param {string} key   搜索关键词
 * @param {number} page  页码（从 1 开始）
 * @returns {BookItem[]}
 */
function search(key, page) {
  const resp = legado.http.get(
    'https://api.example.com/search' +
    '?keyword=' + encodeURIComponent(key) +
    '&page='    + page
  )
  const json = JSON.parse(resp)

  return (json.data?.list ?? []).map(book => ({
    name:          book.title,        // 书名（必填）
    bookUrl:       'https://api.example.com/book/' + book.id,  // URL（必填）
    author:        book.author,       // 作者（可选）
    coverUrl:      book.cover,        // 封面图片 URL（可选）
    intro:         book.summary,      // 简介（可选）
    latestChapter: book.last_chapter, // 最新章节（可选）
    tocUrl:        'https://api.example.com/toc/' + book.id,   // 目录 URL（可选）
  }))
}
