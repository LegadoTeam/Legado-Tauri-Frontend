import type { ShelfBook } from '@/stores';
import type { BuiltinCoverGeneratorDefinition } from './types';
import { bookAuthor, bookKind, buildDataUrl, paletteFromBook, textSpans, wrapText } from './shared';

function generateTitleBlockCover(book: ShelfBook): string {
  const palette = paletteFromBook(book);
  const title = textSpans(wrapText(book.name, 7, 4), { x: 72, lineHeight: 116 });
  return buildDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="840" viewBox="0 0 600 840">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${palette.deep}" />
      <stop offset="58%" stop-color="${palette.primary}" />
      <stop offset="100%" stop-color="${palette.secondary}" />
    </linearGradient>
    <linearGradient id="shine" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.32" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
    </linearGradient>
  </defs>
  <rect width="600" height="840" fill="url(#bg)" />
  <path d="M-80 166C116 86 210 122 360 30C492-50 596-16 704-70V292C532 350 422 294 282 358C150 420 34 468-80 430Z" fill="url(#shine)" />
  <circle cx="492" cy="638" r="220" fill="#000000" opacity="0.12" />
  <circle cx="536" cy="122" r="118" fill="#ffffff" opacity="0.12" />
  <text x="72" y="98" fill="#ffffff" opacity="0.66" font-size="38" font-weight="700" letter-spacing="5">LEGADO ORIGINAL</text>
  <text x="72" y="276" fill="#ffffff" font-size="116" font-weight="900" font-family="'Noto Sans SC', 'Source Han Sans SC', sans-serif">
    ${title}
  </text>
  <rect x="72" y="628" width="168" height="8" rx="4" fill="#ffffff" opacity="0.72" />
  <text x="72" y="690" fill="#ffffff" font-size="56" font-weight="800">${bookAuthor(book)}</text>
  <text x="72" y="734" fill="#ffffff" opacity="0.72" font-size="44">${bookKind(book, '现代封面')}</text>
</svg>`);
}

export const titleBlockCoverGenerator: BuiltinCoverGeneratorDefinition = {
  id: 'builtin:title-block',
  name: '标题块封面',
  description: '大字标题 + 渐变主题色，适合没有封面的纯文字书籍。',
  generate: generateTitleBlockCover,
};
