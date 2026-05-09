import type { ShelfBook } from '@/stores';
import type { BuiltinCoverGeneratorDefinition } from './types';
import { bookAuthor, bookKind, buildDataUrl, paletteFromBook, textSpans, wrapText } from './shared';

function generatePaperTextureCover(book: ShelfBook): string {
  const palette = paletteFromBook(book);
  const title = textSpans(wrapText(book.name, 7, 4), { x: 300, lineHeight: 100 });
  return buildDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="840" viewBox="0 0 600 840">
  <defs>
    <pattern id="grain" width="44" height="44" patternUnits="userSpaceOnUse">
      <circle cx="9" cy="11" r="1.4" fill="rgba(75,48,21,0.08)" />
      <circle cx="31" cy="22" r="1.1" fill="rgba(75,48,21,0.08)" />
      <circle cx="20" cy="34" r="0.9" fill="rgba(75,48,21,0.06)" />
    </pattern>
    <linearGradient id="wash" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fff7e8" />
      <stop offset="100%" stop-color="#ead7b7" />
    </linearGradient>
  </defs>
  <rect width="600" height="840" fill="url(#wash)" />
  <rect width="600" height="840" fill="url(#grain)" />
  <path d="M72 188C148 132 220 146 292 196C378 256 454 248 548 174V840H72Z" fill="#ffffff" opacity="0.28" />
  <path d="M0 690C150 604 314 722 600 608V840H0Z" fill="${palette.accent}" opacity="0.7" />
  <text x="300" y="286" text-anchor="middle" fill="${palette.deep}" font-size="104" font-weight="900" font-family="'Noto Serif SC', 'Source Han Serif SC', serif">
    ${title}
  </text>
  <text x="300" y="560" text-anchor="middle" fill="rgba(42,28,15,0.86)" font-size="56" font-weight="700">${bookAuthor(book)}</text>
  <text x="300" y="606" text-anchor="middle" fill="rgba(42,28,15,0.64)" font-size="44">${bookKind(book, '纸纹文艺')}</text>
  <rect x="190" y="650" width="220" height="10" rx="5" fill="${palette.primary}" opacity="0.76" />
</svg>`);
}

export const paperTextureCoverGenerator: BuiltinCoverGeneratorDefinition = {
  id: 'builtin:paper-texture',
  name: '纸纹文艺版',
  description: '带纸纹与浅色底卡，适合简介型或文学类封面。',
  generate: generatePaperTextureCover,
};
