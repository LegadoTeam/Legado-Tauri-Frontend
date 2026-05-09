// ==UserScript==
// @name         书架封面工作室
// @namespace    com.legado.plugins.bookshelf
// @version      0.1.0
// @description  示例：向“生成封面”菜单注册一个插件封面生成器。
// @author       Codex
// @category     工具
// @match        *
// @grant        none
// @run-at       document-idle
// @enabled      true
// ==/UserScript==

function escapeXml(input) {
  return String(input || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function wrapTitle(input) {
  const chars = Array.from(String(input || '').trim() || '未命名作品');
  const lines = [];
  for (let index = 0; index < chars.length && lines.length < 4; index += 6) {
    lines.push(chars.slice(index, index + 6).join(''));
  }
  if (chars.length > 24 && lines.length) {
    const last = lines.length - 1;
    lines[last] = lines[last].slice(0, 5) + '…';
  }
  return lines;
}

function buildCover(book, values) {
  const title = wrapTitle(book.name)
    .map(
      (line, index) =>
        '<tspan x="88" dy="' + (index === 0 ? 0 : 54) + '">' + escapeXml(line) + '</tspan>',
    )
    .join('');
  const subtitle =
    typeof values.subtitle === 'string' && values.subtitle.trim()
      ? values.subtitle.trim()
      : book.author || 'Legado';
  const badge =
    typeof values.badge === 'string' && values.badge.trim() ? values.badge.trim() : 'PLUGIN';
  const color =
    typeof values.primaryColor === 'string' && values.primaryColor.trim()
      ? values.primaryColor.trim()
      : '#1755ff';
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="840" viewBox="0 0 600 840">' +
    '<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0%" stop-color="' +
    color +
    '"/><stop offset="100%" stop-color="#0f172a"/></linearGradient></defs>' +
    '<rect width="600" height="840" rx="48" fill="url(#bg)"/>' +
    '<rect x="66" y="72" width="468" height="696" rx="34" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.18)"/>' +
    '<text x="88" y="248" fill="#ffffff" font-size="56" font-weight="800" font-family="serif">' +
    title +
    '</text>' +
    '<text x="88" y="646" fill="rgba(255,255,255,0.92)" font-size="26">' +
    escapeXml(subtitle) +
    '</text>' +
    '<rect x="88" y="112" width="136" height="42" rx="21" fill="rgba(255,255,255,0.16)"/>' +
    '<text x="156" y="140" text-anchor="middle" fill="#ffffff" font-size="18">' +
    escapeXml(badge) +
    '</text>' +
    '</svg>';
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

legado.registerPlugin({
  id: 'bookshelf-cover-studio',
  setup(api) {
    return {
      coverGenerators: [
        {
          id: 'studio-gradient',
          name: '插件海报封面',
          description: '示例插件封面生成器，演示生成前二次配置。',
          async generate(context) {
            const values = await api.ui.prompt({
              title: '插件海报封面',
              message: '这个封面项来自插件注册的 coverGenerators。',
              submitText: '生成并写回',
              initialValues: {
                subtitle: context.book.author || '',
                badge: context.book.kind || 'PLUGIN',
                primaryColor: '#1755ff',
              },
              fields: [
                {
                  type: 'text',
                  key: 'subtitle',
                  label: '副标题',
                  placeholder: '作者 / 系列名 / 宣传语',
                },
                {
                  type: 'text',
                  key: 'badge',
                  label: '顶部徽标',
                  placeholder: '短标签',
                },
                {
                  type: 'color',
                  key: 'primaryColor',
                  label: '主色',
                },
              ],
            });
            if (!values) {
              return null;
            }
            return {
              coverUrl: buildCover(context.book, values),
              message: '插件封面已生成',
            };
          },
        },
      ],
    };
  },
});
