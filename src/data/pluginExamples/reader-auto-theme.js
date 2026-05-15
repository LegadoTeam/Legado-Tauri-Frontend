// ==UserScript==
// @name         自动亮暗模式
// @namespace    com.legado.extensions
// @version      1.0.0
// @description  根据系统时间自动切换阅读器亮色/暗色模式
// @author       Legado
// @category     主题
// @match        *
// @grant        none
// @run-at       document-idle
// @enabled      true
// ==/UserScript==

legado.registerPlugin({
  id: 'reader-auto-theme',
  setup: function (api) {
    function applyTheme() {
      if (!api.settings.get('enabled', true)) {
        return;
      }
      var hour = new Date().getHours();
      var dayStart = Number(api.settings.get('day_start', 7));
      var nightStart = Number(api.settings.get('night_start', 20));
      var target = hour >= dayStart && hour < nightStart ? 'light' : 'dark';
      var current = api.ui.getAppTheme();
      if (current === target) {
        return;
      }
      api.log('[auto-theme] 切换主题:', current, '->', target, '(当前时间', hour + '时)');
      api.ui.setAppTheme(target);
    }

    return {
      settings: {
        defaults: {
          enabled: true,
          day_start: 7,
          night_start: 20,
        },
        schema: [
          {
            type: 'info',
            label: '说明',
            description: '本插件根据系统时间自动切换亮/暗模式，退出阅读器后不会还原。',
          },
          { type: 'switch', key: 'enabled', label: '启用自动切换' },
          {
            type: 'number',
            key: 'day_start',
            label: '白天开始（小时，0-23）',
            min: 0,
            max: 23,
          },
          {
            type: 'number',
            key: 'night_start',
            label: '夜晚开始（小时，0-23）',
            min: 0,
            max: 23,
          },
        ],
      },
      hooks: {
        'reader.session.enter': function () {
          applyTheme();
        },
        'reader.chapter.change': function () {
          applyTheme();
        },
      },
    };
  },
});
