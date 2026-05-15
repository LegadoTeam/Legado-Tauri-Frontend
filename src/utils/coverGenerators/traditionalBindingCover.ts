import type { ShelfBook } from '@/stores';
import type { BuiltinCoverGeneratorDefinition } from './types';
import { bookAuthor, bookKind, buildDataUrl, verticalTextSpans, wrapText } from './shared';

function generateTraditionalBindingCover(book: ShelfBook): string {
  const title = verticalTextSpans(wrapText(book.name, 4, 3), {
    x: 390,
    y: 210,
    columnGap: 136,
    charGap: 108,
  });
  return buildDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="840" viewBox="0 0 600 840">
  <defs>
    <pattern id="thread" width="36" height="36" patternUnits="userSpaceOnUse">
      <path d="M0 18H36M18 0V36" stroke="#8b1e1e" stroke-opacity="0.08" />
    </pattern>
  </defs>
  <rect width="600" height="840" fill="#efe3c4" />
  <rect width="600" height="840" fill="url(#thread)" />
  <rect x="0" y="0" width="88" height="840" fill="#254b3f" />
  <circle cx="44" cy="150" r="10" fill="#e7d8b0" />
  <circle cx="44" cy="256" r="10" fill="#e7d8b0" />
  <circle cx="44" cy="362" r="10" fill="#e7d8b0" />
  <path d="M88 0V840" stroke="#1d372f" stroke-width="12" />
  <text fill="#25190e" font-size="96" font-weight="900" font-family="'Noto Serif SC','Source Han Serif SC',serif">${title}</text>
  <text x="300" y="642" text-anchor="middle" fill="#7f2b1d" font-size="56" font-weight="800">${bookAuthor(book)}</text>
  <text x="300" y="692" text-anchor="middle" fill="#765f42" font-size="44">${bookKind(book, '线装古籍')}</text>
</svg>`);
}

export const traditionalBindingCoverGenerator: BuiltinCoverGeneratorDefinition = {
  id: 'builtin:traditional-binding',
  name: '线装古籍',
  description: '仿线装书视觉，适合传统文化、历史典籍和古籍风格。',
  generate: generateTraditionalBindingCover,
};
