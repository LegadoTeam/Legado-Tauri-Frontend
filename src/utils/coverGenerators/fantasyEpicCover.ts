import type { ShelfBook } from '@/stores';
import { bookAuthor, bookKind, buildDataUrl, textSpans, wrapText } from './shared';
import type { BuiltinCoverGeneratorDefinition } from './types';

function generateFantasyEpicCover(book: ShelfBook): string {
  const title = textSpans(wrapText(book.name, 6, 4), { x: 300, lineHeight: 116 });
  return buildDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="840" viewBox="0 0 600 840">
  <defs>
    <radialGradient id="glow" cx="50%" cy="35%" r="70%">
      <stop offset="0%" stop-color="#fef3c7" />
      <stop offset="42%" stop-color="#7c3aed" />
      <stop offset="100%" stop-color="#111827" />
    </radialGradient>
  </defs>
  <rect width="600" height="840" fill="url(#glow)" />
  <path d="M300 120L516 720H84Z" fill="#020617" opacity="0.38" />
  <path d="M300 170L426 668H174Z" fill="#f59e0b" opacity="0.42" />
  <circle cx="300" cy="342" r="108" fill="#ffffff" opacity="0.16" />
  <text x="300" y="282" text-anchor="middle" fill="#ffffff" font-size="112" font-weight="900" font-family="'Noto Serif SC','Source Han Serif SC',serif">${title}</text>
  <text x="300" y="604" text-anchor="middle" fill="#fde68a" font-size="48" font-weight="800">${bookKind(book, '史诗幻想')}</text>
  <text x="300" y="660" text-anchor="middle" fill="#ffffff" font-size="60" font-weight="900">${bookAuthor(book)}</text>
</svg>`);
}

export const fantasyEpicCoverGenerator: BuiltinCoverGeneratorDefinition = {
  id: 'builtin:fantasy-epic',
  name: '史诗幻想',
  description: '神秘光晕和金色金字塔构图，适合奇幻、神话、史诗冒险。',
  generate: generateFantasyEpicCover,
};
