// ==UserScript==
// @name         OpenLibrary 书架补全
// @namespace    com.legado.plugins.bookshelf
// @version      0.1.0
// @description  在书架右键菜单里搜索 OpenLibrary，并按需回写封面与简介。
// @author       Codex
// @category     工具
// @match        *
// @grant        none
// @run-at       document-idle
// @enabled      true
// ==/UserScript==

function buildSearchUrl(book) {
  const params = new URLSearchParams();
  params.set('limit', '5');
  params.set('title', book.name || '');
  if (book.author) {
    params.set('author', book.author);
  }
  return 'https://openlibrary.org/search.json?' + params.toString();
}

function normalizeDescription(doc) {
  if (Array.isArray(doc.first_sentence) && doc.first_sentence.length) {
    return String(doc.first_sentence[0]);
  }
  if (typeof doc.first_sentence === 'string') {
    return doc.first_sentence;
  }
  if (Array.isArray(doc.subject) && doc.subject.length) {
    return '主题：' + doc.subject.slice(0, 6).join(' / ');
  }
  return '';
}

function buildCoverUrl(doc) {
  if (!doc.cover_i) {
    return '';
  }
  return 'https://covers.openlibrary.org/b/id/' + doc.cover_i + '-L.jpg';
}

legado.registerPlugin({
  id: 'bookshelf-openlibrary-enricher',
  setup(api) {
    return {
      bookshelfActions: [
        {
          id: 'enrich-openlibrary',
          name: 'OpenLibrary 补全信息',
          description: '搜索公开图书库并按需替换封面或简介。',
          async run(context) {
            const raw = await api.http.get(buildSearchUrl(context.book), undefined, {
              timeoutSecs: 20,
            });
            const data = JSON.parse(raw);
            const docs = Array.isArray(data.docs) ? data.docs : [];
            const candidate =
              docs.find((item) => buildCoverUrl(item) || normalizeDescription(item)) || docs[0];

            if (!candidate) {
              await api.ui.toast('OpenLibrary 未找到可用结果', 'warning');
              return;
            }

            const nextCoverUrl = buildCoverUrl(candidate);
            const nextIntro = normalizeDescription(candidate);
            const values = await api.ui.prompt({
              title: 'OpenLibrary 补全信息',
              message:
                '这个弹窗由插件注入。插件先通过后端 HTTP 请求跨域搜索，再让你决定哪些字段写回当前书架书籍。',
              submitText: '写回书架',
              initialValues: {
                replaceCover: !!nextCoverUrl,
                replaceIntro: !!nextIntro,
                coverUrl: nextCoverUrl,
                intro: nextIntro,
              },
              fields: [
                {
                  type: 'info',
                  label: '匹配结果',
                  description:
                    '标题：' +
                    (candidate.title || context.book.name) +
                    '\n作者：' +
                    ((candidate.author_name || []).join(' / ') || context.book.author || '未知'),
                },
                {
                  type: 'switch',
                  key: 'replaceCover',
                  label: '替换封面',
                },
                {
                  type: 'text',
                  key: 'coverUrl',
                  label: '封面地址',
                  placeholder: '插件搜索到的封面 URL',
                },
                {
                  type: 'switch',
                  key: 'replaceIntro',
                  label: '替换简介',
                },
                {
                  type: 'textarea',
                  key: 'intro',
                  label: '简介',
                  rows: 6,
                  placeholder: '插件搜索到的简介',
                },
              ],
            });

            if (!values) {
              return;
            }

            const patch = {};
            if (
              values.replaceCover &&
              typeof values.coverUrl === 'string' &&
              values.coverUrl.trim()
            ) {
              patch.coverUrl = values.coverUrl.trim();
            }
            if (values.replaceIntro && typeof values.intro === 'string' && values.intro.trim()) {
              patch.intro = values.intro.trim();
            }

            if (!Object.keys(patch).length) {
              await api.ui.toast('没有可写回的字段', 'info');
              return;
            }

            await api.bookshelf.patchBook(context.book.id, patch);
            await api.ui.toast('已写回书架', 'success');
          },
        },
      ],
    };
  },
});
