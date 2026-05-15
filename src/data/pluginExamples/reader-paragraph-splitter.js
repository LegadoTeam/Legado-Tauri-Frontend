// ==UserScript==
// @name         长段自动分段
// @namespace    com.legado.extensions
// @version      1.0.0
// @description  将过长段落按句号、问号、感叹号自动拆分，提升移动端阅读舒适度
// @author       q3499
// @category     内容处理
// @match        *
// @grant        none
// @run-at       content-ready
// @enabled      false
// ==/UserScript==

function splitLongParagraphs(content, minLength) {
  return String(content ?? '')
    .split('\n')
    .map(function (line) {
      var trimmed = line.trim();
      if (trimmed.length < minLength) {
        return line;
      }
      return trimmed.replace(/([。！？!?；;])/g, '$1\n').replace(/\n{2,}/g, '\n');
    })
    .join('\n');
}

legado.registerPlugin({
  id: 'reader-paragraph-splitter',
  setup: function () {
    return {
      settings: {
        defaults: {
          minLength: 90,
        },
        schema: [
          {
            type: 'slider',
            key: 'minLength',
            label: '最短分段阈值',
            description: '只有超过该长度的段落才会自动按标点换行',
            min: 40,
            max: 220,
            step: 10,
          },
        ],
      },
      hooks: {
        'reader.content.beforePaginate': function (payload, api) {
          return splitLongParagraphs(payload.content, api.settings.get('minLength', 90));
        },
      },
    };
  },
});
