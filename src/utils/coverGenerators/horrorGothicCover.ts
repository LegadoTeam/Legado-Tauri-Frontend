import type { ShelfBook } from '@/stores';
import { bookAuthor, bookKind, buildDataUrl, textSpans, wrapText } from './shared';
import type { BuiltinCoverGeneratorDefinition } from './types';

function generateHorrorGothicCover(book: ShelfBook): string {
  const title = textSpans(wrapText(book.name, 6, 4), { x: 300, lineHeight: 112 });
  return buildDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="840" viewBox="0 0 600 840">
  <defs>
    <radialGradient id="fog" cx="50%" cy="24%" r="74%">
      <stop offset="0%" stop-color="#6b7280" />
      <stop offset="48%" stop-color="#18181b" />
      <stop offset="100%" stop-color="#030712" />
    </radialGradient>
  </defs>
  <rect width="600" height="840" fill="url(#fog)" />
  <path d="M0 690C120 596 206 720 322 610C418 520 506 456 600 504V840H0Z" fill="#000000" opacity="0.62" />
  <path d="M300 130C260 230 248 330 300 430C352 330 340 230 300 130Z" fill="#991b1b" opacity="0.72" />
  <text x="300" y="304" text-anchor="middle" fill="#f9fafb" font-size="108" font-weight="900" font-family="'Noto Serif SC','Source Han Serif SC',serif">${title}</text>
  <text x="300" y="586" text-anchor="middle" fill="#fca5a5" font-size="48" font-weight="800">${bookKind(book, '暗黑惊悚')}</text>
  <text x="300" y="642" text-anchor="middle" fill="#ffffff" font-size="60" font-weight="900">${bookAuthor(book)}</text>
</svg>`);
}

export const horrorGothicCoverGenerator: BuiltinCoverGeneratorDefinition = {
  id: 'builtin:horror-gothic',
  name: '暗黑惊悚',
  description: '暗色雾面和红色中心视觉，适合恐怖、灵异、黑暗幻想。',
  generate: generateHorrorGothicCover,
};
