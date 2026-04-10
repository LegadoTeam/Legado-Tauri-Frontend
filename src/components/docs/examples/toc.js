/**
 * 获取章节目录列表
 * 用户加载书籍目录时调用
 *
 * @param {string} tocUrl  目录页 URL（来自 bookInfo 返回的 tocUrl）
 * @returns {ChapterInfo[]}
 */
function toc(tocUrl) {
  const resp = legado.http.get(tocUrl)
  const json = JSON.parse(resp)

  return (json.data?.chapters ?? []).map(ch => ({
    name: ch.title,                                       // 章节名（必填）
    url:  'https://api.example.com/chapter/' + ch.id,   // 章节 URL（必填）
  }))
}

// ─── 多页目录（循环拉取直到没有更多）────────────────────────────
function toc(tocUrl) {
  const all  = []
  let   page = 1

  while (true) {
    const resp = legado.http.get(tocUrl + '?page=' + page)
    const json = JSON.parse(resp)
    const list = json.data?.list ?? []

    if (list.length === 0) break

    list.forEach(ch => all.push({
      name: ch.title,
      url:  'https://api.example.com/chapter/' + ch.id,
    }))

    if (!json.data?.hasMore) break
    page++
  }

  legado.log('目录共 ' + all.length + ' 章（' + page + ' 页）')
  return all
}
