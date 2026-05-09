import type { ShelfBook } from '@/stores';
import { bookAuthor, bookKind, buildDataUrl, textSpans, wrapText } from './shared';
import type { BuiltinCoverGeneratorDefinition } from './types';

function generateChildrenStoryCover(book: ShelfBook): string {
  const title = textSpans(wrapText(book.name, 6, 4), { x: 300, lineHeight: 108 });
  return buildDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="840" viewBox="0 0 600 840">
  <rect width="600" height="840" fill="#93c5fd" />
  <circle cx="112" cy="112" r="78" fill="#fde047" />
  <path d="M0 646C120 590 206 642 308 604C418 562 486 504 600 548V840H0Z" fill="#86efac" />
  <path d="M0 712C150 658 270 736 414 672C498 636 552 626 600 644V840H0Z" fill="#22c55e" opacity="0.82" />
  <circle cx="448" cy="248" r="90" fill="#fef3c7" />
  <circle cx="422" cy="226" r="14" fill="#1f2937" />
  <circle cx="476" cy="226" r="14" fill="#1f2937" />
  <path d="M420 276C448 304 486 300 504 274" stroke="#1f2937" stroke-width="9" stroke-linecap="round" fill="none" />
  <text x="300" y="328" text-anchor="middle" fill="#1f2937" font-size="104" font-weight="900" font-family="'Noto Sans SC','Source Han Sans SC',sans-serif">${title}</text>
  <text x="300" y="562" text-anchor="middle" fill="#14532d" font-size="48" font-weight="800">${bookKind(book, '儿童故事')}</text>
  <text x="300" y="612" text-anchor="middle" fill="#1f2937" font-size="56" font-weight="900">${bookAuthor(book)}</text>
</svg>`);
}

export const childrenStoryCoverGenerator: BuiltinCoverGeneratorDefinition = {
  id: 'builtin:children-story',
  name: '儿童童趣',
  description: '明亮色块和童趣图形，适合儿童读物、童话、启蒙故事。',
  generate: generateChildrenStoryCover,
};
