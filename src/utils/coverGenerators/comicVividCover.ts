import type { ShelfBook } from '@/stores';
import type { BuiltinCoverGeneratorDefinition } from './types';
import { bookAuthor, bookKind, buildDataUrl, textSpans, wrapText } from './shared';

function generateComicVividCover(book: ShelfBook): string {
  const title = textSpans(wrapText(book.name, 5, 4), { x: 66, lineHeight: 124 });
  return buildDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="840" viewBox="0 0 600 840">
  <rect width="600" height="840" fill="#fde047" />
  <path d="M0 0H600V260H0Z" fill="#ef4444" />
  <path d="M0 260L600 112V358L0 512Z" fill="#2563eb" />
  <circle cx="456" cy="572" r="150" fill="#22c55e" />
  <path d="M424 458L530 570L404 684L298 552Z" fill="#ffffff" opacity="0.9" />
  <text x="66" y="196" fill="#ffffff" font-size="120" font-weight="900" font-family="'Noto Sans SC','Source Han Sans SC',sans-serif">${title}</text>
  <text x="66" y="628" fill="#111827" font-size="48" font-weight="900">${bookKind(book, '漫画轻快')}</text>
  <text x="66" y="690" fill="#111827" font-size="62" font-weight="900">${bookAuthor(book)}</text>
</svg>`);
}

export const comicVividCoverGenerator: BuiltinCoverGeneratorDefinition = {
  id: 'builtin:comic-vivid',
  name: '漫画活力',
  description: '强烈原色与漫画动势，适合轻小说、漫画风、幽默故事。',
  generate: generateComicVividCover,
};
