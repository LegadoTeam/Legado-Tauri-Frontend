import type { ShelfBook } from '@/stores';
import type { BuiltinCoverGeneratorDefinition } from './types';
import { bookAuthor, bookKind, buildDataUrl, paletteFromBook, textSpans, wrapText } from './shared';

function generateAuthorBandCover(book: ShelfBook): string {
  const palette = paletteFromBook(book);
  const title = textSpans(wrapText(book.name, 8, 3), { x: 70, lineHeight: 108 });
  return buildDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="840" viewBox="0 0 600 840">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${palette.light}" />
      <stop offset="100%" stop-color="#ffffff" />
    </linearGradient>
  </defs>
  <rect width="600" height="840" fill="url(#bg)" />
  <rect x="0" y="0" width="600" height="240" fill="${palette.deep}" />
  <path d="M0 232C118 282 220 284 344 236C452 194 534 194 600 226V0H0Z" fill="${palette.primary}" opacity="0.9" />
  <circle cx="90" cy="692" r="260" fill="${palette.secondary}" opacity="0.16" />
  <text x="70" y="366" fill="${palette.deep}" font-size="120" font-weight="900" font-family="'Noto Sans SC', 'Source Han Sans SC', sans-serif">
    ${title}
  </text>
  <rect x="70" y="560" width="340" height="96" rx="22" fill="${palette.primary}" />
  <text x="94" y="604" fill="#ffffff" font-size="36" font-weight="800" letter-spacing="4">AUTHOR</text>
  <text x="94" y="638" fill="#ffffff" font-size="64" font-weight="900">${bookAuthor(book)}</text>
  <text x="70" y="148" fill="#ffffff" font-size="48" opacity="0.86">${bookKind(book, '作者签名')}</text>
  <path d="M70 452H356" stroke="${palette.secondary}" stroke-width="7" stroke-linecap="round" />
</svg>`);
}

export const authorBandCoverGenerator: BuiltinCoverGeneratorDefinition = {
  id: 'builtin:author-band',
  name: '作者签名版',
  description: '突出书名与作者信息，适合补封面时保留基本元信息。',
  generate: generateAuthorBandCover,
};
