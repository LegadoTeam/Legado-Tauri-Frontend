// ==UserScript==
// @name         文本替换器
// @namespace    com.legado.extensions
// @version      1.0.0
// @description  通过自定义替换规则批量修正文案、错别字和来源噪声
// @author       q3499
// @category     内容处理
// @match        *
// @grant        none
// @run-at       content-ready
// @enabled      true
// ==/UserScript==

function applyRules(content, rules) {
  var result = String(content || '');
  for (var i = 0; i < rules.length; i += 1) {
    var line = String(rules[i] || '').trim();
    if (!line) continue;
    var parts = line.split('=>');
    if (parts.length < 2) {
      parts = line.split('->');
    }
    if (parts.length < 2) continue;
    var from = parts.shift().trim();
    var to = parts.join('=>').trim();
    if (!from) continue;
    result = result.split(from).join(to);
  }
  return result;
}

legado.registerPlugin({
  id: 'reader-text-replacer',
  setup: function (api) {
    return {
      settings: {
        defaults: {
          rules: ['最新网址=>', '请收藏本站=>'],
        },
        schema: function (context) {
          var count = (context.values.rules || []).filter(Boolean).length;
          return [
            {
              type: 'info',
              label: '使用 old=>new 语法',
              description: '例如：張三=>张三。插件挂在 reader.content.beforePaginate，修改后会重新处理当前章节，翻页和上下滚动模式均生效。',
            },
            {
              type: 'string-list',
              key: 'rules',
              label: '替换规则（' + count + ' 条）',
            },
          ];
        },
      },
      hooks: {
        'reader.content.beforePaginate': function (payload, api) {
          return applyRules(payload.content, api.settings.get('rules', []));
        },
      },
      readerContextActions: [
        {
          id: 'add-replace-rule',
          name: '替换',
          when: function (context) {
            return context.sourceType === 'novel' && !!context.text;
          },
          run: async function (context) {
            var values = await api.ui.prompt({
              title: '替换',
              message: '添加一条文本替换规则，重新加载章节后生效。',
              initialValues: {
                from: context.text,
                to: '',
              },
              fields: [
                { type: 'text', key: 'from', label: '被替换文字' },
                { type: 'text', key: 'to', label: '替换为' },
              ],
              submitText: '保存',
              cancelText: '取消',
            });
            if (!values) return;
            var from = String(values.from || '').trim();
            if (!from) {
              await api.ui.toast('被替换文字不能为空', 'warning');
              return;
            }
            var to = String(values.to || '').trim();
            var rules = api.settings.get('rules', []);
            await api.settings.set('rules', rules.concat([from + '=>' + to]));
            await api.ui.toast('替换规则已添加', 'success');
          },
        },
      ],
    };
  },
});
