import type { ShelfBook } from '@/stores';
import type { BuiltinCoverGeneratorDefinition } from './types';
import { bookAuthor, bookKind, buildDataUrl, textSpans, wrapText } from './shared';

function generateClassicInkCover(book: ShelfBook): string {
  const title = textSpans(wrapText(book.name, 6, 4), { x: 300, lineHeight: 96 });
  return buildDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="840" viewBox="0 0 600 840">
  <defs>
    <radialGradient id="paper" cx="50%" cy="28%" r="78%">
      <stop offset="0%" stop-color="#fbf6e9" />
      <stop offset="100%" stop-color="#d9c5a4" />
    </radialGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="22" /></filter>
  </defs>
  <rect width="600" height="840" fill="url(#paper)" />
  <path d="M-80 526C120 404 202 540 342 444C438 378 492 250 680 238V840H-80Z" fill="#20231f" opacity="0.14" filter="url(#blur)" />
  <path d="M0 620C130 542 220 610 334 538C432 476 514 366 600 388V840H0Z" fill="#1d211c" opacity="0.28" />
  <circle cx="455" cy="160" r="76" fill="#b94235" opacity="0.88" />
  <text x="300" y="278" text-anchor="middle" fill="#241b13" font-size="100" font-weight="900" font-family="'Noto Serif SC','Source Han Serif SC',serif">${title}</text>
  <text x="300" y="560" text-anchor="middle" fill="#5e4933" font-size="52" font-weight="700">${bookAuthor(book)}</text>
  <text x="300" y="604" text-anchor="middle" fill="#7b6144" font-size="42">${bookKind(book, '古典文学')}</text>
  <path d="M234 644H366" stroke="#b94235" stroke-width="7" stroke-linecap="round" />
</svg>`);
}

export const classicInkCoverGenerator: BuiltinCoverGeneratorDefinition = {
  id: 'builtin:classic-ink',
  name: '古典水墨',
  description: '宣纸、远山与朱印，适合古典文学、诗词、传统题材。',
  generate: generateClassicInkCover,
};
