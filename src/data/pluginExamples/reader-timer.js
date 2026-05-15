// ==UserScript==
// @name         阅读计时器
// @namespace    com.legado.extensions
// @version      1.3.0
// @description  在阅读页浮层中显示本次与累计阅读时长
// @author       q3499
// @category     统计
// @match        *
// @grant        none
// @run-at       document-idle
// @enabled      true
// ==/UserScript==

function buildBadgeStyle(api) {
  return [
    'display:inline-flex',
    'align-items:center',
    'padding:' + (api.settings.get('compact', false) ? '5px 9px' : '6px 11px'),
    'border-radius:999px',
    'background:' + api.settings.get('backgroundColor', 'rgba(0,0,0,0.55)'),
    'color:' + api.settings.get('textColor', '#ffffff'),
    'font-size:' + (api.settings.get('compact', false) ? '11px' : '12px'),
    'font-weight:600',
    'letter-spacing:0.02em',
    'box-shadow:0 8px 20px rgba(0,0,0,0.18)',
  ].join(';');
}

legado.registerPlugin({
  id: 'reader-timer',
  setup: function (api) {
    var sessionStart = 0;
    var stats = api.storage.readJson('stats', { totalSeconds: 0 });
    var timerId = 0;
    var labelEl = null;

    function totalSeconds() {
      var extra = sessionStart ? Math.max(0, Math.floor((Date.now() - sessionStart) / 1000)) : 0;
      return (stats.totalSeconds ?? 0) + extra;
    }

    function render() {
      if (!labelEl) {
        return;
      }
      var secs = totalSeconds();
      var minutes = Math.floor(secs / 60);
      var seconds = secs % 60;
      var prefix = api.settings.get('prefix', '阅读');
      labelEl.textContent = prefix + ' ' + minutes + '分' + String(seconds).padStart(2, '0') + '秒';
      labelEl.style.cssText = buildBadgeStyle(api);
    }

    function start() {
      if (!sessionStart) {
        sessionStart = Date.now();
      }
      if (!timerId) {
        timerId = window.setInterval(render, 1000);
      }
      render();
    }

    function stop() {
      if (sessionStart) {
        stats.totalSeconds = totalSeconds();
        sessionStart = 0;
        api.storage.writeJson('stats', stats);
      }
      if (timerId) {
        window.clearInterval(timerId);
        timerId = 0;
      }
      render();
    }

    function mountAt(slotName) {
      return function (container) {
        if (api.settings.get('position', 'overlay-top-right') !== slotName) {
          return;
        }
        labelEl = document.createElement('div');
        container.appendChild(labelEl);
        render();
        return function () {
          labelEl = null;
        };
      };
    }

    api.registerCleanup(function () {
      stop();
    });

    return {
      settings: {
        defaults: {
          prefix: '阅读',
          position: 'overlay-top-right',
          compact: false,
          backgroundColor: 'rgba(0,0,0,0.55)',
          textColor: '#ffffff',
        },
        schema: function () {
          return [
            {
              type: 'text',
              key: 'prefix',
              label: '前缀文字',
              description: '会显示在计时内容前，例如：阅读、专注、学习',
            },
            {
              type: 'select',
              key: 'position',
              label: '显示位置',
              options: [
                { label: '右上角', value: 'overlay-top-right' },
                { label: '左上角', value: 'overlay-top-left' },
                { label: '右下角', value: 'overlay-bottom-right' },
                { label: '左下角', value: 'overlay-bottom-left' },
              ],
            },
            {
              type: 'switch',
              key: 'compact',
              label: '紧凑样式',
            },
            {
              type: 'color',
              key: 'backgroundColor',
              label: '背景色',
            },
            {
              type: 'color',
              key: 'textColor',
              label: '文字色',
            },
            {
              type: 'info',
              label: '累计时长会保存在插件本地存储中',
              description: '切换章节或关闭阅读器后不会丢失累计数据。',
            },
          ];
        },
      },
      hooks: {
        'reader.session.enter': function () {
          start();
        },
        'reader.session.resume': function () {
          start();
        },
        'reader.session.pause': function () {
          stop();
        },
        'reader.session.exit': function () {
          stop();
        },
      },
      slots: {
        'overlay-top-right': mountAt('overlay-top-right'),
        'overlay-top-left': mountAt('overlay-top-left'),
        'overlay-bottom-right': mountAt('overlay-bottom-right'),
        'overlay-bottom-left': mountAt('overlay-bottom-left'),
      },
    };
  },
});
