// ==UserScript==
// @name         自定义颜色主题
// @namespace    com.legado.extensions
// @version      1.0.0
// @description  注入一套可完全自定义的阅读颜色主题，独立控制背景、正文、选中、阴影与描边
// @author       designer_x
// @category     主题风格
// @match        *
// @grant        none
// @run-at       document-start
// @enabled      false
// ==/UserScript==

legado.registerPlugin({
  id: 'reader-custom-color-theme',
  setup: function () {
    return {
      settings: {
        defaults: {
          themeName: '我的主题',
          backgroundColor: '#f7f1e3',
          textColor: '#35281d',
          selectionColor: '#d8b98a',
          textShadow: 'none',
          textStrokeWidth: 0,
          textStrokeColor: '#000000',
        },
        schema: function (context) {
          return [
            { type: 'text', key: 'themeName', label: '主题名' },
            { type: 'color', key: 'backgroundColor', label: '背景色' },
            { type: 'color', key: 'textColor', label: '正文色' },
            { type: 'color', key: 'selectionColor', label: '选中色' },
            {
              type: 'select',
              key: 'textShadow',
              label: '文字阴影',
              options: [
                { label: '无', value: 'none' },
                { label: '柔和', value: '0 1px 3px rgba(0,0,0,0.18)' },
                {
                  label: '浮雕',
                  value: '0 1px 0 rgba(255,255,255,0.35), 0 -1px 0 rgba(0,0,0,0.12)',
                },
                { label: '发光', value: '0 0 8px rgba(255,255,255,0.35)' },
              ],
            },
            {
              type: 'slider',
              key: 'textStrokeWidth',
              label: '描边宽度',
              min: 0,
              max: 2,
              step: 0.1,
            },
            {
              type: 'color',
              key: 'textStrokeColor',
              label: '描边颜色',
              hidden: function (ctx) {
                return Number(ctx.values.textStrokeWidth ?? 0) <= 0;
              },
            },
          ];
        },
      },
      themes: [
        {
          id: 'custom-color-theme',
          name: '自定义颜色主题',
          description: '颜色完全由插件设置决定的自定义主题',
          preview: function (_, api) {
            return {
              backgroundColor: api.settings.get('backgroundColor', '#f7f1e3'),
              textColor: api.settings.get('textColor', '#35281d'),
              selectionColor: api.settings.get('selectionColor', '#d8b98a'),
            };
          },
          resolve: function (_, api) {
            var strokeWidth = Number(api.settings.get('textStrokeWidth', 0));
            var strokeColor = api.settings.get('textStrokeColor', '#000000');
            return {
              backgroundColor: api.settings.get('backgroundColor', '#f7f1e3'),
              textColor: api.settings.get('textColor', '#35281d'),
              selectionColor: api.settings.get('selectionColor', '#d8b98a'),
              styleVars: {
                '--reader-text-shadow': api.settings.get('textShadow', 'none'),
                '--reader-text-stroke-width': String(strokeWidth) + 'px',
                '--reader-text-stroke-color': strokeColor,
              },
            };
          },
        },
      ],
    };
  },
});
