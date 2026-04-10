/**
 * 获取书籍详情（封面、简介、目录入口 URL 等）
 * 用户进入书架 / 书籍主页时调用
 *
 * @param {string} bookUrl  书籍主页 URL（来自 search 返回的 bookUrl）
 * @returns {BookItem}
 */
function bookInfo(bookUrl) {
  const resp = legado.http.get(bookUrl)
  const json = JSON.parse(resp)
  const book = json.data

  return {
    name:          book.title,
    author:        book.author,
    bookUrl:       bookUrl,
    // tocUrl 可以与 bookUrl 不同，也可以复用同一个 URL
    tocUrl:        bookUrl + '/chapters',
    coverUrl:      book.cover_url,
    intro:         book.intro,
    latestChapter: book.last_chapter_title,
  }
}
