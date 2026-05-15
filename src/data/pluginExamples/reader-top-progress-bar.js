// ==UserScript==
// @name         阅读顶部进度条
// @namespace    com.legado.plugins.reader-top-progress-bar
// @version      1.0.0
// @description  在阅读页顶部显示章节进度条
// @author       Legado
// @category     工具
// @match        *
// @grant        none
// @run-at       document-idle
// @enabled      true
// ==/UserScript==

legado.registerPlugin({
  id: 'reader-top-progress-bar',
  setup: function (api) {
    var root = null;
    var fill = null;
    var unlisten = null;

    function getTotalChapters(session) {
      if (!session) {
        return 0;
      }
      if (typeof session.totalChapters === 'number' && session.totalChapters > 0) {
        return session.totalChapters;
      }
      if (session.bookInfo && typeof session.bookInfo.totalChapters === 'number') {
        return session.bookInfo.totalChapters;
      }
      return 0;
    }

    function getRatio(session) {
      var total = getTotalChapters(session);
      var chapterIndex = typeof session.chapterIndex === 'number' ? session.chapterIndex : 0;
      if (total <= 0) {
        return 0;
      }
      if (total === 1) {
        return 1;
      }
      return Math.max(0, Math.min(chapterIndex / (total - 1), 1));
    }

    function render(session) {
      if (!root || !fill || !session) {
        return;
      }

      var total = getTotalChapters(session);
      var current = typeof session.chapterIndex === 'number' ? session.chapterIndex + 1 : 0;
      var ratio = getRatio(session);

      root.style.display = session.visible === false || total <= 0 ? 'none' : 'block';
      root.setAttribute('aria-valuemin', '1');
      root.setAttribute('aria-valuemax', String(Math.max(total, 1)));
      root.setAttribute('aria-valuenow', String(Math.max(current, 1)));
      root.setAttribute(
        'aria-label',
        total > 0 ? '第 ' + current + ' 章，共 ' + total + ' 章' : '阅读章节进度',
      );
      fill.style.width = ratio * 100 + '%';
    }

    function mount(container) {
      root = document.createElement('div');
      var track = document.createElement('div');
      fill = document.createElement('div');

      root.setAttribute('role', 'progressbar');
      root.style.cssText = [
        'position:fixed',
        'top:0',
        'left:0',
        'right:0',
        'height:3px',
        'z-index:1',
        'pointer-events:none',
      ].join(';');

      track.style.cssText = [
        'width:100%',
        'height:100%',
        'overflow:hidden',
        'background:color-mix(in srgb, var(--reader-text-color, #ffffff) 16%, transparent)',
      ].join(';');

      fill.style.cssText = [
        'height:100%',
        'width:0%',
        'background:var(--reader-selection-color, #63e2b7)',
        'border-radius:0 2px 2px 0',
        'transition:width 160ms ease',
      ].join(';');

      track.appendChild(fill);
      root.appendChild(track);
      container.appendChild(root);

      render(api.reader.getSession());
      unlisten = api.reader.onSessionChange(function (session) {
        render(session);
      });

      return function () {
        if (unlisten) {
          unlisten();
          unlisten = null;
        }
        if (root?.parentNode) {
          root.parentNode.removeChild(root);
        }
        root = null;
        fill = null;
      };
    }

    return {
      slots: {
        'overlay-top-left': mount,
      },
    };
  },
});
