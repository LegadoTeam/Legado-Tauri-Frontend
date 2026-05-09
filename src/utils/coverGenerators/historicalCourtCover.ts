import type { ShelfBook } from '@/stores';
import { bookAuthor, bookKind, buildDataUrl, textSpans, wrapText } from './shared';
import type { BuiltinCoverGeneratorDefinition } from './types';

function generateHistoricalCourtCover(book: ShelfBook): string {
  const title = textSpans(wrapText(book.name, 6, 4), { x: 300, lineHeight: 108 });
  return buildDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="840" viewBox="0 0 600 840">
  <rect width="600" height="840" fill="#7f1d1d" />
  <circle cx="300" cy="222" r="154" fill="#fbbf24" opacity="0.78" />
  <circle cx="300" cy="222" r="116" fill="#991b1b" opacity="0.3" />
  <path d="M0 496C120 442 214 510 318 456C414 404 486 344 600 372V840H0Z" fill="#2f140f" opacity="0.64" />
  <path d="M80 676H520" stroke="#fbbf24" stroke-width="9" stroke-linecap="round" opacity="0.72" />
  <text x="300" y="284" text-anchor="middle" fill="#fff7ed" font-size="108" font-weight="900" font-family="'Noto Serif SC','Source Han Serif SC',serif">${title}</text>
  <text x="300" y="586" text-anchor="middle" fill="#fde68a" font-size="48" font-weight="800">${bookKind(book, '历史宫廷')}</text>
  <text x="300" y="636" text-anchor="middle" fill="#ffffff" font-size="60" font-weight="900">${bookAuthor(book)}</text>
</svg>`);
}

export const historicalCourtCoverGenerator: BuiltinCoverGeneratorDefinition = {
  id: 'builtin:historical-court',
  name: '历史宫廷',
  description: '朱红与鎏金，适合历史、宫廷、权谋和古代言情。',
  generate: generateHistoricalCourtCover,
};
