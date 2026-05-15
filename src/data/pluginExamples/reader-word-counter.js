// ==UserScript==
// @name         字数统计
// @namespace    com.legado.extensions
// @version      1.0.0
// @description  在阅读页右下角显示当前章节字数与预计阅读时长
// @author       Legado
// @category     工具
// @match        *
// @grant        none
// @run-at       document-idle
// @enabled      true
// ==/UserScript==

legado.registerPlugin({
  id: 'reader-word-counter',
  setup: function (api) {
    var el = null;
    var unlisten = null;

    function countChars(text) {
      if (!text) {
        return 0;
      }
      var m = text.match(/\S/g);
      return m ? m.length : 0;
    }

    function render(session) {
      if (!el) {
        return;
      }
      var parts = [];
      if (session?.visible) {
        var chars = countChars(session.content);
        var wpm = Number(api.settings.get('wpm', 400)) || 400;
        if (api.settings.get('show_chars', true)) {
          parts.push(chars + ' 字');
        }
        if (api.settings.get('show_time', true)) {
          var mins = Math.ceil(chars / wpm);
          parts.push('约 ' + mins + ' 分钟');
        }
      }
      el.textContent = parts.join(' · ');
      el.style.display = parts.length ? 'inline-block' : 'none';
    }

    return {
      settings: {
        defaults: {
          wpm: 400,
          show_chars: true,
          show_time: true,
        },
        schema: [
          {
            type: 'number',
            key: 'wpm',
            label: '每分钟阅读字数（WPM）',
            min: 50,
            max: 2000,
          },
          { type: 'switch', key: 'show_chars', label: '显示字数' },
          { type: 'switch', key: 'show_time', label: '显示预计阅读时长' },
        ],
      },
      slots: {
        'overlay-bottom-right': function (container) {
          el = document.createElement('div');
          el.style.cssText = [
            'display:inline-block',
            'padding:4px 8px',
            'border-radius:4px',
            'background:rgba(0,0,0,0.4)',
            'color:var(--color-text-muted,#888)',
            'font-size:12px',
            'pointer-events:none',
          ].join(';');
          container.appendChild(el);
          render(api.reader.getSession());
          unlisten = api.reader.onSessionChange(function (session) {
            render(session);
          });
          return function () {
            if (unlisten) {
              unlisten();
              unlisten = null;
            }
            if (el?.parentNode) {
              el.parentNode.removeChild(el);
            }
            el = null;
          };
        },
      },
    };
  },
});
