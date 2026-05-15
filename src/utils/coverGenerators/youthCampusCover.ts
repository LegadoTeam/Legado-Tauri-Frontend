import type { ShelfBook } from '@/stores';
import type { BuiltinCoverGeneratorDefinition } from './types';
import { bookAuthor, bookKind, buildDataUrl, textSpans, wrapText } from './shared';

function generateYouthCampusCover(book: ShelfBook): string {
  const title = textSpans(wrapText(book.name, 7, 4), { x: 72, lineHeight: 104 });
  return buildDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="840" viewBox="0 0 600 840">
  <rect width="600" height="840" fill="#dbeafe" />
  <circle cx="490" cy="130" r="96" fill="#fef3c7" />
  <path d="M0 584C130 530 220 590 336 534C448 480 512 450 600 486V840H0Z" fill="#bfdbfe" />
  <path d="M0 674C146 604 262 704 408 622C500 570 550 558 600 574V840H0Z" fill="#60a5fa" />
  <path d="M82 172H332" stroke="#2563eb" stroke-width="8" stroke-linecap="round" />
  <text x="72" y="256" fill="#1e3a8a" font-size="108" font-weight="900" font-family="'Noto Sans SC','Source Han Sans SC',sans-serif">${title}</text>
  <text x="72" y="542" fill="#1d4ed8" font-size="48" font-weight="800">${bookKind(book, '青春校园')}</text>
  <text x="72" y="698" fill="#ffffff" font-size="60" font-weight="900">${bookAuthor(book)}</text>
</svg>`);
}

export const youthCampusCoverGenerator: BuiltinCoverGeneratorDefinition = {
  id: 'builtin:youth-campus',
  name: '青春校园',
  description: '清爽蓝白和阳光曲线，适合校园、青春、成长题材。',
  generate: generateYouthCampusCover,
};
