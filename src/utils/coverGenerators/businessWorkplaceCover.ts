import type { ShelfBook } from '@/stores';
import type { BuiltinCoverGeneratorDefinition } from './types';
import { bookAuthor, bookKind, buildDataUrl, textSpans, wrapText } from './shared';

function generateBusinessWorkplaceCover(book: ShelfBook): string {
  const title = textSpans(wrapText(book.name, 8, 4), { x: 64, lineHeight: 108 });
  return buildDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="840" viewBox="0 0 600 840">
  <rect width="600" height="840" fill="#f8fafc" />
  <rect x="0" y="0" width="600" height="300" fill="#0f172a" />
  <path d="M0 300L600 188V420L0 520Z" fill="#2563eb" />
  <path d="M0 536L600 408V840H0Z" fill="#e2e8f0" />
  <text x="64" y="160" fill="#ffffff" font-size="108" font-weight="900" font-family="'Noto Sans SC','Source Han Sans SC',sans-serif">${title}</text>
  <text x="64" y="604" fill="#1e3a8a" font-size="48" font-weight="800">${bookKind(book, '职场商业')}</text>
  <text x="64" y="662" fill="#0f172a" font-size="62" font-weight="900">${bookAuthor(book)}</text>
  <rect x="64" y="696" width="280" height="10" rx="5" fill="#2563eb" />
</svg>`);
}

export const businessWorkplaceCoverGenerator: BuiltinCoverGeneratorDefinition = {
  id: 'builtin:business-workplace',
  name: '职场商业',
  description: '理性几何和商务蓝，适合职场、商业、管理、现实都市。',
  generate: generateBusinessWorkplaceCover,
};
