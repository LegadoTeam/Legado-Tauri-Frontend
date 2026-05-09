import type { ShelfBook } from '@/stores';
import { bookAuthor, bookKind, buildDataUrl, textSpans, wrapText } from './shared';
import type { BuiltinCoverGeneratorDefinition } from './types';

function generateSciFiCover(book: ShelfBook): string {
  const title = textSpans(wrapText(book.name, 7, 4), { x: 64, lineHeight: 112 });
  return buildDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="840" viewBox="0 0 600 840">
  <defs>
    <radialGradient id="star" cx="72%" cy="20%" r="64%">
      <stop offset="0%" stop-color="#67e8f9" />
      <stop offset="42%" stop-color="#1e3a8a" />
      <stop offset="100%" stop-color="#020617" />
    </radialGradient>
  </defs>
  <rect width="600" height="840" fill="url(#star)" />
  <circle cx="438" cy="180" r="92" fill="#e0f2fe" opacity="0.92" />
  <circle cx="438" cy="180" r="126" fill="none" stroke="#67e8f9" stroke-width="3" opacity="0.5" />
  <path d="M-20 702L620 372V840H-20Z" fill="#020617" opacity="0.72" />
  <path d="M64 620H536M112 560H488M168 500H432" stroke="#22d3ee" stroke-width="2" opacity="0.45" />
  <text x="64" y="258" fill="#f8fafc" font-size="112" font-weight="900" font-family="'Noto Sans SC','Source Han Sans SC',sans-serif">${title}</text>
  <text x="64" y="596" fill="#67e8f9" font-size="48" font-weight="800">${bookKind(book, '科幻未来')}</text>
  <text x="64" y="656" fill="#ffffff" font-size="60" font-weight="900">${bookAuthor(book)}</text>
</svg>`);
}

export const sciFiCoverGenerator: BuiltinCoverGeneratorDefinition = {
  id: 'builtin:sci-fi',
  name: '科幻星环',
  description: '深空、星环与冷色霓光，适合科幻、末世、未来题材。',
  generate: generateSciFiCover,
};
