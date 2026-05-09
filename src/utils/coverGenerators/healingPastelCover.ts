import type { ShelfBook } from '@/stores';
import { bookAuthor, bookKind, buildDataUrl, textSpans, wrapText } from './shared';
import type { BuiltinCoverGeneratorDefinition } from './types';

function generateHealingPastelCover(book: ShelfBook): string {
  const title = textSpans(wrapText(book.name, 7, 4), { x: 300, lineHeight: 104 });
  return buildDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="840" viewBox="0 0 600 840">
  <rect width="600" height="840" fill="#ecfccb" />
  <circle cx="150" cy="190" r="146" fill="#bfdbfe" opacity="0.78" />
  <circle cx="462" cy="238" r="120" fill="#fecdd3" opacity="0.72" />
  <circle cx="320" cy="612" r="220" fill="#fde68a" opacity="0.58" />
  <path d="M82 584C170 520 252 632 342 560C416 502 476 498 538 546" stroke="#65a30d" stroke-width="8" stroke-linecap="round" fill="none" opacity="0.58" />
  <text x="300" y="312" text-anchor="middle" fill="#365314" font-size="104" font-weight="900" font-family="'Noto Serif SC','Source Han Serif SC',serif">${title}</text>
  <text x="300" y="566" text-anchor="middle" fill="#4d7c0f" font-size="48" font-weight="800">${bookKind(book, '治愈日常')}</text>
  <text x="300" y="624" text-anchor="middle" fill="#365314" font-size="60" font-weight="900">${bookAuthor(book)}</text>
</svg>`);
}

export const healingPastelCoverGenerator: BuiltinCoverGeneratorDefinition = {
  id: 'builtin:healing-pastel',
  name: '治愈日常',
  description: '柔和彩色圆形与自然线条，适合治愈、日常、轻文学。',
  generate: generateHealingPastelCover,
};
