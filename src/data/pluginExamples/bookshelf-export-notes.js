// ==UserScript==
// @name         导出阅读笔记
// @namespace    com.legado.extensions
// @version      1.0.0
// @description  从书架导出书目阅读笔记，或在阅读器内快速添加笔记
// @author       Legado
// @category     工具
// @match        *
// @grant        none
// @run-at       document-idle
// @enabled      true
// ==/UserScript==

legado.registerPlugin({
  id: 'bookshelf-export-notes',
  setup: function (api) {
    function formatNotes(notes) {
      var lines = [];
      Object.keys(notes).forEach(function (url) {
        var items = notes[url];
        if (!Array.isArray(items) || items.length === 0) {
          return;
        }
        lines.push('--- ' + url + ' ---');
        items.forEach(function (note) {
          var d = new Date(note.time ?? 0).toLocaleString();
          lines.push('[' + d + '] ' + note.text);
        });
        lines.push('');
      });
      return lines.join('\n');
    }

    function totalCount(notes) {
      return Object.values(notes).reduce(function (sum, arr) {
        return sum + (Array.isArray(arr) ? arr.length : 0);
      }, 0);
    }

    async function runExport(book) {
      var notes = api.storage.readJson('notes', {});
      var count = totalCount(notes);
      var formatted = formatNotes(notes);

      var values = await api.ui.prompt({
        title: '笔记',
        message: (book ? book.name + ' ' : '') + '共有 ' + count + ' 条笔记',
        fields: [
          {
            type: 'info',
            label: '笔记内容',
            description: count > 0 ? formatted : '（暂无笔记）',
          },
          { type: 'switch', key: 'copy', label: '复制到剪贴板' },
        ],
        submitText: '确定',
        cancelText: '取消',
      });

      if (!values) {
        return;
      }
      if (values.copy && count > 0) {
        try {
          await navigator.clipboard.writeText(formatted);
          api.ui.toast('笔记已复制到剪贴板', 'success');
        } catch (e) {
          api.log('[export-notes] 复制失败', e);
          api.ui.toast('复制失败，请检查浏览器权限', 'error');
        }
      } else if (values.copy && count === 0) {
        api.ui.toast('没有笔记可复制', 'warning');
      }
    }

    return {
      bookshelfActions: [
        {
          id: 'export-notes',
          name: '导出阅读笔记',
          when: function () {
            return true;
          },
          run: async function (context) {
            await runExport(context?.book);
          },
        },
      ],
      slots: {
        'overlay-top-right': function (container) {
          var btn = document.createElement('button');
          btn.textContent = '✏';
          btn.title = '添加笔记';
          btn.style.cssText = [
            'position:absolute',
            'top:8px',
            'right:8px',
            'width:32px',
            'height:32px',
            'border:none',
            'border-radius:50%',
            'background:rgba(0,0,0,0.4)',
            'color:#fff',
            'font-size:15px',
            'cursor:pointer',
            'display:flex',
            'align-items:center',
            'justify-content:center',
            'padding:0',
          ].join(';');

          btn.addEventListener('click', async function () {
            var session = api.reader.getSession();
            var chapterUrl = session ? session.chapterUrl : '';

            var values = await api.ui.prompt({
              title: '添加笔记',
              fields: [
                {
                  type: 'textarea',
                  key: 'note',
                  label: '笔记内容',
                  rows: 4,
                },
              ],
              submitText: '保存',
            });

            if (!values?.note || !String(values.note).trim()) {
              return;
            }

            var notes = api.storage.readJson('notes', {});
            if (!Array.isArray(notes[chapterUrl])) {
              notes[chapterUrl] = [];
            }
            notes[chapterUrl].push({ text: String(values.note).trim(), time: Date.now() });
            api.storage.writeJson('notes', notes);
            api.ui.toast('笔记已保存', 'success');
          });

          container.appendChild(btn);
          return function () {
            if (btn.parentNode) {
              btn.parentNode.removeChild(btn);
            }
          };
        },
      },
    };
  },
});
