import type { ShelfBook } from '@/stores';

export function hashSeed(input: string): number {
  let hash = 0;
  for (const char of input) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

export function paletteFromBook(book: ShelfBook) {
  const seed = hashSeed(`${book.name}|${book.author}|${book.kind ?? ''}`);
  const hue = seed % 360;
  return {
    primary: `hsl(${hue} 72% 46%)`,
    secondary: `hsl(${(hue + 32) % 360} 68% 58%)`,
    accent: `hsl(${(hue + 180) % 360} 40% 92%)`,
    deep: `hsl(${(hue + 12) % 360} 48% 16%)`,
    light: `hsl(${(hue + 18) % 360} 65% 97%)`,
  };
}

export function bookAuthor(book: ShelfBook): string {
  return escapeSvgText(book.author || '佚名');
}

export function bookKind(book: ShelfBook, fallback = 'Legado Cover'): string {
  return escapeSvgText(book.kind ?? fallback);
}

export function escapeSvgText(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function wrapText(input: string, lineLength: number, lineLimit: number): string[] {
  const chars = Array.from(input.trim());
  const effectiveLineLength = Math.max(3, Math.ceil(lineLength / 2));
  const lines: string[] = [];
  for (
    let index = 0;
    index < chars.length && lines.length < lineLimit;
    index += effectiveLineLength
  ) {
    lines.push(chars.slice(index, index + effectiveLineLength).join(''));
  }
  if (!lines.length) {
    lines.push('未命名作品');
  }
  if (chars.length > effectiveLineLength * lineLimit) {
    const last = lines.length - 1;
    lines[last] = `${lines[last].slice(0, Math.max(0, effectiveLineLength - 1))}…`;
  }
  return lines;
}

export function textSpans(
  lines: string[],
  options: { x: number | string; lineHeight: number; firstDy?: number | string },
): string {
  const lineHeight = '10em';
  return lines
    .map(
      (line, index) =>
        `<tspan x="${options.x}" dy="${index === 0 ? (options.firstDy ?? 0) : lineHeight}">${escapeSvgText(line)}</tspan>`,
    )
    .join('');
}

export function verticalTextSpans(
  lines: string[],
  options: { x: number; y: number; columnGap: number; charGap: number },
): string {
  const columnGap = Math.max(options.columnGap, 150);
  const charGap = Math.max(options.charGap, 126);
  return lines
    .map((line, lineIndex) => {
      const x = options.x - lineIndex * columnGap;
      return Array.from(line)
        .map(
          (char, charIndex) =>
            `<tspan x="${x}" y="${options.y + charIndex * charGap}">${escapeSvgText(char)}</tspan>`,
        )
        .join('');
    })
    .join('');
}

export function buildDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
