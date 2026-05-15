import type { ShelfBook } from '@/stores';
import type { BuiltinCoverGeneratorDefinition } from './types';
import { bookAuthor, bookKind, buildDataUrl, textSpans, wrapText } from './shared';

function generateFemaleRomanceCover(book: ShelfBook): string {
  const title = textSpans(wrapText(book.name, 7, 4), { x: 300, lineHeight: 104 });
  return buildDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="840" viewBox="0 0 600 840">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fff1f7" />
      <stop offset="100%" stop-color="#f9a8d4" />
    </linearGradient>
  </defs>
  <rect width="600" height="840" fill="url(#bg)" />
  <circle cx="110" cy="158" r="132" fill="#ffffff" opacity="0.56" />
  <circle cx="482" cy="628" r="240" fill="#be185d" opacity="0.14" />
  <path d="M0 628C122 552 222 642 344 548C456 462 514 448 600 492V840H0Z" fill="#ffffff" opacity="0.48" />
  <text x="300" y="274" text-anchor="middle" fill="#831843" font-size="108" font-weight="900" font-family="'Noto Serif SC','Source Han Serif SC',serif">${title}</text>
  <text x="300" y="548" text-anchor="middle" fill="#9d174d" font-size="48" font-weight="800">${bookKind(book, '女性文学')}</text>
  <text x="300" y="608" text-anchor="middle" fill="#831843" font-size="60" font-weight="900">${bookAuthor(book)}</text>
  <path d="M236 650C268 676 330 676 364 650" stroke="#be185d" stroke-width="7" stroke-linecap="round" fill="none" opacity="0.6" />
</svg>`);
}

export const femaleRomanceCoverGenerator: BuiltinCoverGeneratorDefinition = {
  id: 'builtin:female-romance',
  name: '女频柔光',
  description: '粉白渐变、柔和曲线，适合言情、成长、女性向作品。',
  generate: generateFemaleRomanceCover,
};
