import type { ShelfBook } from '@/stores';
import type { BuiltinCoverGeneratorDefinition } from './types';
import { bookAuthor, bookKind, buildDataUrl, textSpans, wrapText } from './shared';

function generateModernLiteratureCover(book: ShelfBook): string {
  const title = textSpans(wrapText(book.name, 7, 4), { x: 74, lineHeight: 108 });
  return buildDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="840" viewBox="0 0 600 840">
  <rect width="600" height="840" fill="#f2efe8" />
  <rect x="0" y="0" width="600" height="840" fill="#111827" opacity="0.035" />
  <path d="M0 528C126 482 178 544 290 506C418 462 480 360 600 392V840H0Z" fill="#d45c3f" />
  <path d="M0 648C146 584 248 676 390 596C486 542 532 516 600 526V840H0Z" fill="#263a5e" opacity="0.96" />
  <text x="74" y="168" fill="#202124" font-size="116" font-weight="900" font-family="'Noto Serif SC','Source Han Serif SC',serif">${title}</text>
  <text x="74" y="470" fill="#59606b" font-size="44">${bookKind(book, '现代文学')}</text>
  <text x="74" y="718" fill="#ffffff" font-size="62" font-weight="800">${bookAuthor(book)}</text>
  <rect x="74" y="742" width="150" height="7" rx="3.5" fill="#ffffff" opacity="0.68" />
</svg>`);
}

export const modernLiteratureCoverGenerator: BuiltinCoverGeneratorDefinition = {
  id: 'builtin:modern-literature',
  name: '现代文学',
  description: '留白、抽象色块和稳重字体，适合现实、文学、散文。',
  generate: generateModernLiteratureCover,
};
