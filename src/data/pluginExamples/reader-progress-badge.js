// ==UserScript==
// @name         阅读进度角标
// @namespace    com.legado.extensions
// @version      1.0.0
// @description  在阅读页显示当前章节和章节内进度
// @author       Legado 社区
// @category     工具
// @match        *
// @grant        none
// @run-at       document-idle
// @enabled      false
// ==/UserScript==

legado.registerPlugin({
  id: 'reader-progress-badge',
  setup: function (api) {
    var badge = null;
    var unlisten = null;

    function render(session) {
      if (!badge || !session) {
        return;
      }
      var text = '';
      if (api.settings.get('showChapterIndex', true)) {
        text += '第' + (session.chapterIndex + 1) + '章';
      }
      if (
        api.settings.get('showRatio', true) &&
        typeof session.scrollRatio === 'number' &&
        session.scrollRatio >= 0
      ) {
        if (text) {
          text += ' · ';
        }
        text += Math.round(session.scrollRatio * 100) + '%';
      }
      badge.textContent = text || session.chapterName;
      badge.style.cssText = [
        'display:inline-flex',
        'align-items:center',
        'padding:6px 10px',
        'border-radius:999px',
        'background:' + api.settings.get('backgroundColor', 'rgba(255,255,255,0.88)'),
        'color:' + api.settings.get('textColor', '#1f2937'),
        'font-size:12px',
        'font-weight:600',
        'box-shadow:0 6px 18px rgba(15,23,42,0.16)',
      ].join(';');
    }

    function mountAt(slotName) {
      return function (container) {
        if (api.settings.get('position', 'overlay-bottom-right') !== slotName) {
          return;
        }
        badge = document.createElement('div');
        container.appendChild(badge);
        render(api.reader.getSession());
        unlisten = api.reader.onSessionChange(function (session) {
          render(session);
        });
        return function () {
          if (unlisten) {
            unlisten();
            unlisten = null;
          }
          badge = null;
        };
      };
    }

    return {
      settings: {
        defaults: {
          position: 'overlay-bottom-right',
          showChapterIndex: true,
          showRatio: true,
          backgroundColor: 'rgba(255,255,255,0.88)',
          textColor: '#1f2937',
        },
        schema: [
          {
            type: 'select',
            key: 'position',
            label: '显示位置',
            options: [
              { label: '右下角', value: 'overlay-bottom-right' },
              { label: '左下角', value: 'overlay-bottom-left' },
              { label: '右上角', value: 'overlay-top-right' },
              { label: '左上角', value: 'overlay-top-left' },
            ],
          },
          { type: 'switch', key: 'showChapterIndex', label: '显示章节序号' },
          { type: 'switch', key: 'showRatio', label: '显示章节内进度' },
          { type: 'color', key: 'backgroundColor', label: '背景色' },
          { type: 'color', key: 'textColor', label: '文字色' },
        ],
      },
      slots: {
        'overlay-bottom-right': mountAt('overlay-bottom-right'),
        'overlay-bottom-left': mountAt('overlay-bottom-left'),
        'overlay-top-right': mountAt('overlay-top-right'),
        'overlay-top-left': mountAt('overlay-top-left'),
      },
    };
  },
});
