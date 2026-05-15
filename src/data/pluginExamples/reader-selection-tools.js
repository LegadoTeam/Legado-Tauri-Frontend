// ==UserScript==
// @name         阅读器选中文本工具
// @namespace    legado.reader.selection.tools
// @version      1.0.0
// @description  在小说阅读页选中文字后，通过右键/长按菜单提供字典和替换示例。
// @author       Legado
// @category     阅读器
// @match        *
// @grant        none
// @run-at       document-idle
// @enabled      true
// ==/UserScript==

legado.registerPlugin({
  id: 'reader-selection-tools',
  name: '阅读器选中文本工具',
  setup: function (api) {
    return {
      readerContextActions: [
        {
          id: 'dictionary',
          name: '字典',
          when: function (context) {
            return context.sourceType === 'novel' && !!context.text;
          },
          run: async function (context) {
            await api.ui.prompt({
              title: '字典',
              message: context.text,
              fields: [
                {
                  type: 'info',
                  label: '选中文字',
                  description: context.text,
                },
              ],
              submitText: '关闭',
              cancelText: '取消',
            });
          },
        },
        {
          id: 'replace',
          name: '替换',
          when: function (context) {
            return context.sourceType === 'novel' && !!context.text;
          },
          run: async function (context) {
            var values = await api.ui.prompt({
              title: '替换',
              message: '为当前选中文字保存一个替换规则示例。',
              initialValues: {
                from: context.text,
                to: '',
              },
              fields: [
                { type: 'text', key: 'from', label: '原文' },
                { type: 'text', key: 'to', label: '替换为' },
              ],
              submitText: '保存',
              cancelText: '取消',
            });
            if (!values) {
              return;
            }
            var rules = api.storage.readJson('selectionReplaceRules', []);
            rules.push({
              from: String(values.from ?? ''),
              to: String(values.to ?? ''),
              time: Date.now(),
            });
            api.storage.writeJson('selectionReplaceRules', rules);
            await api.ui.toast('替换规则已保存到插件存储', 'success');
          },
        },
      ],
    };
  },
});
