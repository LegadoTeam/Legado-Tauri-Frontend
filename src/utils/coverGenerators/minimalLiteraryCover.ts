import type { ShelfBook } from '@/stores';
import { bookAuthor, bookKind, buildDataUrl, textSpans, wrapText } from './shared';
import type { BuiltinCoverGeneratorDefinition } from './types';

function generateMinimalLiteraryCover(book: ShelfBook): string {
  const title = textSpans(wrapText(book.name, 8, 4), { x: 72, lineHeight: 108 });
  return buildDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="840" viewBox="0 0 600 840">
  <rect width="600" height="840" fill="#fafafa" />
  <rect x="0" y="0" width="600" height="840" fill="#111827" opacity="0.025" />
  <rect x="72" y="100" width="12" height="420" fill="#111827" />
  <circle cx="450" cy="610" r="96" fill="#111827" opacity="0.08" />
  <circle cx="498" cy="560" r="46" fill="#b91c1c" opacity="0.84" />
  <text x="112" y="184" fill="#111827" font-size="104" font-weight="900" font-family="'Noto Serif SC','Source Han Serif SC',serif">${title}</text>
  <text x="112" y="590" fill="#52525b" font-size="46">${bookKind(book, '文学精选')}</text>
  <text x="112" y="650" fill="#111827" font-size="60" font-weight="900">${bookAuthor(book)}</text>
</svg>`);
}

export const minimalLiteraryCoverGenerator: BuiltinCoverGeneratorDefinition = {
  id: 'builtin:minimal-literary',
  name: '极简文学',
  description: '克制留白和小面积强调色，适合严肃文学、短篇、散文。',
  generate: generateMinimalLiteraryCover,
};
