// ==UserScript==
// @name         阅读器简繁转换
// @namespace    com.legado.plugins.reader
// @version      0.1.0
// @description  基于内置 OpenCC 能力在阅读器正文管线中做简繁转换。
// @author       Codex
// @category     内容处理
// @match        *
// @grant        none
// @run-at       document-idle
// @enabled      true
// ==/UserScript==

const MODE_OPTIONS = [
  {
    label: '繁体 → 简体',
    value: 't2s',
    description: '适合台版/港版正文统一转为简体阅读',
  },
  {
    label: '简体 → 繁体',
    value: 's2t',
    description: '把简体正文转为通用繁体',
  },
  {
    label: '简体 → 台湾繁体',
    value: 's2tw',
    description: '适合偏台湾用词场景',
  },
  {
    label: '简体 → 香港繁体',
    value: 's2hk',
    description: '适合偏港版用词场景',
  },
];

legado.registerPlugin({
  id: 'reader-chinese-converter',
  setup(api) {
    return {
      settings: {
        defaults: {
          enabled: true,
          mode: 't2s',
        },
        schema() {
          return [
            {
              type: 'switch',
              key: 'enabled',
              label: '启用简繁转换',
            },
            {
              type: 'radio',
              key: 'mode',
              label: '转换方向',
              options: MODE_OPTIONS,
            },
            {
              type: 'info',
              label: '缓存说明',
              description:
                '插件挂在 reader.content.beforePaginate，转换结果会跟随阅读器章节处理缓存复用；重载插件或切换模式后会自动重新计算。',
            },
          ];
        },
      },
      hooks: {
        'reader.content.beforePaginate': (payload) => {
          if (!api.settings.get('enabled', true)) {
            return payload.content;
          }
          const mode = api.settings.get('mode', 't2s');
          return api.text.convertChinese(payload.content, mode);
        },
      },
    };
  },
});
