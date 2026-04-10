/**
 * 获取章节正文
 * 阅读器翻页时调用，返回纯文本字符串
 *
 * @param {string} chapterUrl  章节 URL（来自 toc 返回的 url）
 * @returns {string}
 */
function content(chapterUrl) {
  const resp = legado.http.get(chapterUrl)
  const json = JSON.parse(resp)

  // 接口直接返回段落数组
  if (Array.isArray(json.data?.paragraphs)) {
    return json.data.paragraphs.join('\n')
  }

  // 接口返回 HTML，手动剥离标签
  const html = json.data?.content ?? ''
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')   // 合并多余空行
    .trim()
}
