// ==UserScript==
// @name         自定义注入
// @namespace    com.legado.extensions
// @version      1.0.0
// @description  向阅读器注入自定义 CSS 样式和 JavaScript 代码
// @author       Legado
// @category     高级
// @match        *
// @grant        none
// @run-at       document-idle
// @enabled      false
// ==/UserScript==

legado.registerPlugin({
  id: 'reader-custom-inject',
  setup: function (api) {
    var styleEl = null;

    function removeStyle() {
      if (styleEl?.parentNode) {
        styleEl.parentNode.removeChild(styleEl);
      }
      styleEl = null;
    }

    function injectStyle() {
      removeStyle();
      var css = api.settings.get('custom_css', '');
      if (!css || !String(css).trim()) {
        return;
      }
      styleEl = document.createElement('style');
      styleEl.setAttribute('data-legado-inject', 'reader-custom-inject');
      styleEl.textContent = String(css);
      document.head.appendChild(styleEl);
    }

    function executeJs() {
      var js = api.settings.get('custom_js', '');
      if (!js || !String(js).trim()) {
        return;
      }
      try {
        // eslint-disable-next-line no-new-func
        new Function(String(js))();
      } catch (e) {
        api.log('[custom-inject] JS 执行错误', e);
        api.ui.toast('自定义 JS 执行错误：' + (e?.message ? e.message : String(e)), 'error');
      }
    }

    return {
      settings: {
        defaults: {
          enabled: true,
          custom_css: '',
          custom_js: '',
        },
        schema: [
          {
            type: 'info',
            label: '安全警告',
            description: '自定义 JS 功能仅供调试，请勿输入不可信代码。',
          },
          { type: 'switch', key: 'enabled', label: '启用注入' },
          {
            type: 'textarea',
            key: 'custom_css',
            label: '自定义 CSS',
            rows: 6,
            placeholder: '/* 在此输入 CSS 代码 */',
          },
          {
            type: 'textarea',
            key: 'custom_js',
            label: '自定义 JS（每次进入章节执行）',
            rows: 6,
            placeholder: '// 在此输入 JavaScript 代码',
          },
        ],
        onChange: function () {
          if (typeof api.reader.remountSlots === 'function') {
            api.reader.remountSlots();
          } else {
            injectStyle();
          }
        },
      },
      hooks: {
        'reader.session.enter': function () {
          if (!api.settings.get('enabled', true)) {
            return;
          }
          executeJs();
        },
      },
      slots: {
        'overlay-top-left': function (container) {
          if (!api.settings.get('enabled', true)) {
            return;
          }
          injectStyle();
          // container 占位，不渲染可见元素
          return function () {
            removeStyle();
          };
        },
      },
    };
  },
});
