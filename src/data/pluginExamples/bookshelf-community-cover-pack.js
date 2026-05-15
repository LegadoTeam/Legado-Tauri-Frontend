// ==UserScript==
// @name         社区封面模板包
// @namespace    com.legado.plugins.community-cover-pack
// @version      0.1.0
// @description  内置插件：通过 coverGenerators 提供三套可直接使用的社区封面模板。
// @author       Legado
// @category     工具
// @match        *
// @grant        none
// @run-at       document-idle
// @enabled      true
// ==/UserScript==

function hashSeed(input) {
  let hash = 0;
  for (const char of String(input ?? '')) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function paletteFromBook(book) {
  const seed = hashSeed((book.name ?? '') + '|' + (book.author ?? '') + '|' + (book.kind ?? ''));
  const hue = seed % 360;
  return {
    primary: 'hsl(' + hue + ' 72% 46%)',
    secondary: 'hsl(' + ((hue + 32) % 360) + ' 68% 58%)',
    accent: 'hsl(' + ((hue + 180) % 360) + ' 40% 92%)',
    deep: 'hsl(' + ((hue + 12) % 360) + ' 48% 16%)',
    light: 'hsl(' + ((hue + 18) % 360) + ' 65% 97%)',
  };
}

function escapeSvgText(input) {
  return String(input ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function wrapText(input, lineLength, lineLimit) {
  const chars = Array.from(String(input ?? '').trim());
  const lines = [];
  for (let index = 0; index < chars.length && lines.length < lineLimit; index += lineLength) {
    lines.push(chars.slice(index, index + lineLength).join(''));
  }
  if (!lines.length) {
    lines.push('未命名作品');
  }
  if (chars.length > lineLength * lineLimit) {
    const last = lines.length - 1;
    lines[last] = lines[last].slice(0, Math.max(0, lineLength - 1)) + '…';
  }
  return lines;
}

function buildDataUrl(svg) {
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

function renderTitleBlockCover(book) {
  const palette = paletteFromBook(book);
  const titleLines = wrapText(book.name, 7, 4);
  const title = titleLines
    .map(function (line, index) {
      return (
        '<tspan x="88" dy="' + (index === 0 ? 0 : 54) + '">' + escapeSvgText(line) + '</tspan>'
      );
    })
    .join('');
  return buildDataUrl(
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="840" viewBox="0 0 600 840">' +
      '<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="' +
      palette.primary +
      '" />' +
      '<stop offset="100%" stop-color="' +
      palette.secondary +
      '" />' +
      '</linearGradient></defs>' +
      '<rect width="600" height="840" rx="48" fill="url(#bg)" />' +
      '<circle cx="512" cy="118" r="140" fill="rgba(255,255,255,0.12)" />' +
      '<circle cx="92" cy="712" r="170" fill="rgba(255,255,255,0.08)" />' +
      '<rect x="58" y="58" width="484" height="724" rx="36" fill="rgba(10,18,28,0.18)" />' +
      '<text x="88" y="228" fill="#ffffff" font-size="56" font-weight="800" font-family="serif">' +
      title +
      '</text>' +
      '<text x="88" y="684" fill="rgba(255,255,255,0.9)" font-size="24" letter-spacing="4">' +
      escapeSvgText(book.author ?? '佚名') +
      '</text>' +
      '<text x="88" y="730" fill="rgba(255,255,255,0.72)" font-size="22">' +
      escapeSvgText(book.kind ?? '社区模板') +
      '</text>' +
      '<text x="88" y="120" fill="rgba(255,255,255,0.72)" font-size="20" letter-spacing="6">COMMUNITY COVER PACK</text>' +
      '<rect x="88" y="142" width="172" height="6" rx="3" fill="rgba(255,255,255,0.72)" />' +
      '</svg>',
  );
}

function renderAuthorBandCover(book) {
  const palette = paletteFromBook(book);
  const titleLines = wrapText(book.name, 8, 3);
  const title = titleLines
    .map(function (line, index) {
      return (
        '<tspan x="82" dy="' + (index === 0 ? 0 : 50) + '">' + escapeSvgText(line) + '</tspan>'
      );
    })
    .join('');
  return buildDataUrl(
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="840" viewBox="0 0 600 840">' +
      '<rect width="600" height="840" rx="48" fill="' +
      palette.light +
      '" />' +
      '<rect x="42" y="42" width="516" height="756" rx="36" fill="none" stroke="' +
      palette.deep +
      '" stroke-opacity="0.18" stroke-width="2" />' +
      '<rect x="56" y="78" width="488" height="220" rx="28" fill="' +
      palette.deep +
      '" />' +
      '<rect x="56" y="618" width="488" height="150" rx="28" fill="' +
      palette.primary +
      '" />' +
      '<text x="82" y="388" fill="' +
      palette.deep +
      '" font-size="58" font-weight="800" font-family="sans-serif">' +
      title +
      '</text>' +
      '<text x="82" y="678" fill="#ffffff" font-size="22" letter-spacing="4">AUTHOR</text>' +
      '<text x="82" y="726" fill="#ffffff" font-size="40" font-weight="700">' +
      escapeSvgText(book.author ?? '佚名') +
      '</text>' +
      '<text x="82" y="142" fill="rgba(255,255,255,0.82)" font-size="20">' +
      escapeSvgText(book.kind ?? '社区封面') +
      '</text>' +
      '<text x="82" y="198" fill="#ffffff" font-size="18" opacity="0.74">Built with plugin coverGenerators</text>' +
      '<path d="M82 452H518" stroke="' +
      palette.secondary +
      '" stroke-width="4" stroke-linecap="round" />' +
      '</svg>',
  );
}

function renderPaperTextureCover(book) {
  const palette = paletteFromBook(book);
  const titleLines = wrapText(book.name, 6, 4);
  const title = titleLines
    .map(function (line, index) {
      return (
        '<tspan x="300" dy="' + (index === 0 ? 0 : 44) + '">' + escapeSvgText(line) + '</tspan>'
      );
    })
    .join('');
  return buildDataUrl(
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="840" viewBox="0 0 600 840">' +
      '<defs>' +
      '<pattern id="grain" width="44" height="44" patternUnits="userSpaceOnUse">' +
      '<circle cx="9" cy="11" r="1.4" fill="rgba(75,48,21,0.08)" />' +
      '<circle cx="31" cy="22" r="1.1" fill="rgba(75,48,21,0.08)" />' +
      '<circle cx="20" cy="34" r="0.9" fill="rgba(75,48,21,0.06)" />' +
      '</pattern>' +
      '</defs>' +
      '<rect width="600" height="840" rx="48" fill="#f6eedf" />' +
      '<rect width="600" height="840" rx="48" fill="url(#grain)" />' +
      '<rect x="68" y="68" width="464" height="704" rx="36" fill="rgba(255,255,255,0.56)" stroke="rgba(95,63,31,0.12)" />' +
      '<rect x="116" y="120" width="368" height="560" rx="30" fill="' +
      palette.accent +
      '" />' +
      '<text x="300" y="286" text-anchor="middle" fill="' +
      palette.deep +
      '" font-size="48" font-weight="800" font-family="serif">' +
      title +
      '</text>' +
      '<text x="300" y="564" text-anchor="middle" fill="rgba(42,28,15,0.86)" font-size="26">' +
      escapeSvgText(book.author ?? '佚名') +
      '</text>' +
      '<text x="300" y="608" text-anchor="middle" fill="rgba(42,28,15,0.64)" font-size="22">' +
      escapeSvgText(book.kind ?? '纸纹模板') +
      '</text>' +
      '<rect x="182" y="652" width="236" height="10" rx="5" fill="' +
      palette.primary +
      '" opacity="0.72" />' +
      '</svg>',
  );
}

legado.registerPlugin({
  id: 'community-cover-pack',
  name: '社区封面模板包',
  setup() {
    return {
      coverGenerators: [
        {
          id: 'title-block',
          name: '社区·标题块封面',
          description: '插件实现的大字标题封面，适合纯文字书籍。',
          generate(context) {
            return {
              coverUrl: renderTitleBlockCover(context.book),
              message: '已应用社区标题块封面',
            };
          },
        },
        {
          id: 'author-band',
          name: '社区·作者签名版',
          description: '插件实现的作者信息版式，适合保留基础书籍信息。',
          generate(context) {
            return {
              coverUrl: renderAuthorBandCover(context.book),
              message: '已应用社区作者签名版',
            };
          },
        },
        {
          id: 'paper-texture',
          name: '社区·纸纹文艺版',
          description: '插件实现的浅色纸纹模板，适合文学和简介型封面。',
          generate(context) {
            return {
              coverUrl: renderPaperTextureCover(context.book),
              message: '已应用社区纸纹文艺版',
            };
          },
        },
      ],
    };
  },
});
