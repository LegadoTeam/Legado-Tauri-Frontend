import type { ShelfBook } from '@/stores';
import type { BuiltinCoverGeneratorDefinition } from './types';
import { bookAuthor, bookKind, buildDataUrl, verticalTextSpans, wrapText } from './shared';

function generateWuxiaCover(book: ShelfBook): string {
  const title = verticalTextSpans(wrapText(book.name, 4, 3), {
    x: 430,
    y: 168,
    columnGap: 152,
    charGap: 120,
  });
  return buildDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="840" viewBox="0 0 600 840">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#111827" />
      <stop offset="100%" stop-color="#6b1d1d" />
    </linearGradient>
  </defs>
  <rect width="600" height="840" fill="url(#bg)" />
  <circle cx="112" cy="130" r="86" fill="#fef3c7" opacity="0.86" />
  <path d="M-40 680C106 548 190 638 310 528C420 428 502 358 640 392V840H-40Z" fill="#020617" opacity="0.5" />
  <path d="M98 620L528 268" stroke="#fef3c7" stroke-width="10" stroke-linecap="round" opacity="0.76" />
  <path d="M120 648L550 296" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.54" />
  <text fill="#fff7ed" font-size="112" font-weight="900" font-family="'Noto Serif SC','Source Han Serif SC',serif">${title}</text>
  <text x="74" y="674" fill="#fed7aa" font-size="48" font-weight="800">${bookKind(book, '武侠江湖')}</text>
  <text x="74" y="724" fill="#ffffff" font-size="60" font-weight="900">${bookAuthor(book)}</text>
</svg>`);
}

export const wuxiaCoverGenerator: BuiltinCoverGeneratorDefinition = {
  id: 'builtin:wuxia',
  name: '武侠江湖',
  description: '月色、山影与刀光，适合武侠、仙侠、江湖题材。',
  generate: generateWuxiaCover,
};
