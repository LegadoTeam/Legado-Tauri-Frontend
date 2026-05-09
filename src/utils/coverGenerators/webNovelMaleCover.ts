import type { ShelfBook } from '@/stores';
import { bookAuthor, bookKind, buildDataUrl, textSpans, wrapText } from './shared';
import type { BuiltinCoverGeneratorDefinition } from './types';

function generateWebNovelMaleCover(book: ShelfBook): string {
  const title = textSpans(wrapText(book.name, 6, 4), { x: 60, lineHeight: 120 });
  return buildDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="840" viewBox="0 0 600 840">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#06111f" />
      <stop offset="50%" stop-color="#123d63" />
      <stop offset="100%" stop-color="#f97316" />
    </linearGradient>
  </defs>
  <rect width="600" height="840" fill="url(#bg)" />
  <path d="M-40 640L224 120L338 524L474 252L650 840H-40Z" fill="#020617" opacity="0.45" />
  <path d="M50 602L560 388" stroke="#facc15" stroke-width="16" stroke-linecap="round" opacity="0.86" />
  <path d="M82 640L504 462" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity="0.62" />
  <text x="60" y="250" fill="#ffffff" font-size="116" font-weight="900" font-family="'Noto Sans SC','Source Han Sans SC',sans-serif">${title}</text>
  <text x="60" y="640" fill="#fde68a" font-size="48" font-weight="800">${bookKind(book, '热血网文')}</text>
  <text x="60" y="694" fill="#ffffff" font-size="60" font-weight="900">${bookAuthor(book)}</text>
</svg>`);
}

export const webNovelMaleCoverGenerator: BuiltinCoverGeneratorDefinition = {
  id: 'builtin:webnovel-male',
  name: '男频热血',
  description: '高对比、强动势、金色光线，适合玄幻、都市、升级流。',
  generate: generateWebNovelMaleCover,
};
