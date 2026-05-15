import type { ShelfBook } from '@/stores';
import type { BuiltinCoverGeneratorDefinition } from './types';
import { bookAuthor, bookKind, buildDataUrl, textSpans, wrapText } from './shared';

function generateSuspenseNoirCover(book: ShelfBook): string {
  const title = textSpans(wrapText(book.name, 6, 4), { x: 64, lineHeight: 116 });
  return buildDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="840" viewBox="0 0 600 840">
  <rect width="600" height="840" fill="#09090b" />
  <path d="M0 0H600V840H0Z" fill="#1f2937" opacity="0.34" />
  <path d="M360 0L600 0L430 840H190Z" fill="#f8fafc" opacity="0.08" />
  <path d="M72 622C144 586 224 610 298 570C392 520 452 438 560 462" stroke="#dc2626" stroke-width="8" stroke-linecap="round" fill="none" />
  <text x="64" y="268" fill="#f8fafc" font-size="116" font-weight="900" font-family="'Noto Serif SC','Source Han Serif SC',serif">${title}</text>
  <text x="64" y="560" fill="#fca5a5" font-size="48" font-weight="800">${bookKind(book, '悬疑推理')}</text>
  <text x="64" y="704" fill="#ffffff" font-size="60" font-weight="900">${bookAuthor(book)}</text>
  <rect x="64" y="724" width="160" height="5" fill="#dc2626" />
</svg>`);
}

export const suspenseNoirCoverGenerator: BuiltinCoverGeneratorDefinition = {
  id: 'builtin:suspense-noir',
  name: '悬疑黑幕',
  description: '黑白红高反差，适合悬疑、推理、惊悚、犯罪题材。',
  generate: generateSuspenseNoirCover,
};
