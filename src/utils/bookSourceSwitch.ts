import type { BookDetail, BookItem, ChapterItem, ShelfBook } from '@/stores';
import type { ReaderBookInfo } from '../components/reader/types';
import { getNormalizedLastChapter } from './bookMeta';
import { getCoverImageUrl, type CoverImageInput } from './coverImage';

export type MetadataFieldKey =
  | 'author'
  | 'coverUrl'
  | 'intro'
  | 'kind'
  | 'status'
  | 'wordCount'
  | 'chapterCount'
  | 'updateTime'
  | 'lastChapter';

export interface DiffSegment {
  text: string;
  kind: 'same' | 'removed' | 'added';
}

export interface DiffPair {
  current: DiffSegment[];
  candidate: DiffSegment[];
  changed: boolean;
}

export interface SwitchableBookMeta {
  name: string;
  author: string;
  coverUrl?: CoverImageInput;
  intro?: string;
  kind?: string;
  status?: string;
  wordCount?: string;
  chapterCount?: number;
  updateTime?: string;
  lastChapter?: string;
  bookUrl?: string;
}

export interface SourceCandidate {
  key: string;
  fileName: string;
  sourceName: string;
  sourceLogo?: string;
  book: BookItem;
  score: number;
  reasons: string[];
}

export interface ChapterMatchCandidate {
  index: number;
  name: string;
  url: string;
  score: number;
  reasons: string[];
}

export const SWITCHABLE_METADATA_FIELDS: Array<{
  key: MetadataFieldKey;
  label: string;
}> = [
  { key: 'author', label: '作者' },
  { key: 'coverUrl', label: '封面' },
  { key: 'intro', label: '简介' },
  { key: 'kind', label: '分类' },
  { key: 'lastChapter', label: '最新章节' },
];

const CHINESE_NUM_MAP: Record<string, number> = {
  零: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

function stripNoise(value: string): string {
  return value
    .toLowerCase()
    .replace(/\[[^\]]*]/g, '')
    .replace(/（[^）]*）/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/【[^】]*】/g, '')
    .replace(/广告|求收藏|求订阅|最新网址|手机版|手机用户请到|ps[:：].*/g, '')
    .replace(/[\s`~!@#$%^&*()_\-+=|\\:;"'<>,.?/，。！？、：；（）【】《》“”‘’]/g, '');
}

function toBigramSet(value: string): Set<string> {
  const normalized = stripNoise(value);
  if (!normalized) {
    return new Set();
  }
  if (normalized.length === 1) {
    return new Set([normalized]);
  }
  const result = new Set<string>();
  for (let index = 0; index < normalized.length - 1; index += 1) {
    result.add(normalized.slice(index, index + 2));
  }
  return result;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) {
    return 0;
  }
  let intersect = 0;
  for (const value of a) {
    if (b.has(value)) {
      intersect += 1;
    }
  }
  return intersect / (a.size + b.size - intersect);
}

function parseChineseNumber(raw: string): number | null {
  if (!raw) {
    return null;
  }
  if (/^\d+$/.test(raw)) {
    return Number(raw);
  }

  let total = 0;
  let current = 0;
  for (const char of raw) {
    if (char === '十') {
      current = current || 1;
      total += current * 10;
      current = 0;
      continue;
    }
    if (char === '百') {
      current = current || 1;
      total += current * 100;
      current = 0;
      continue;
    }
    if (char === '千') {
      current = current || 1;
      total += current * 1000;
      current = 0;
      continue;
    }
    const mapped = CHINESE_NUM_MAP[char];
    if (mapped === undefined) {
      return null;
    }
    current = mapped;
  }
  return total + current;
}

function extractChapterNumber(name: string): number | null {
  const direct = name.match(/第\s*([0-9零一二两三四五六七八九十百千]+)\s*[章节话卷集]/i);
  if (direct) {
    return parseChineseNumber(direct[1]);
  }
  const trailing = name.match(/([0-9]+)(?:\D*$)/);
  if (trailing) {
    return Number(trailing[1]);
  }
  return null;
}

function basenameSignature(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.split('/').filter(Boolean).pop() ?? '';
    return path.replace(/\.[a-z0-9]+$/i, '').toLowerCase();
  } catch {
    const parts = url.split('/').filter(Boolean);
    return (parts[parts.length - 1] ?? '').replace(/\?.*$/, '').toLowerCase();
  }
}

export function buildCurrentBookMeta(book: ShelfBook | ReaderBookInfo): SwitchableBookMeta {
  return {
    name: book.name,
    author: book.author,
    coverUrl: book.coverUrl,
    intro: book.intro,
    kind: book.kind,
    status: 'status' in book ? book.status : undefined,
    wordCount: 'wordCount' in book ? book.wordCount : undefined,
    chapterCount: 'chapterCount' in book ? book.chapterCount : undefined,
    updateTime: 'updateTime' in book ? book.updateTime : undefined,
    lastChapter: getNormalizedLastChapter(book),
    bookUrl: book.bookUrl,
  };
}

export function buildCandidateBookMeta(
  book: BookItem,
  detail?: BookDetail | null,
): SwitchableBookMeta {
  return {
    name: detail?.name?.trim() ?? book.name,
    author: detail?.author?.trim() ?? book.author,
    coverUrl: detail?.coverUrl ?? book.coverUrl,
    intro: detail?.intro ?? book.intro,
    kind: detail?.kind ?? book.kind,
    status: detail?.status ?? book.status,
    wordCount: detail?.wordCount ?? book.wordCount,
    chapterCount: detail?.chapterCount ?? book.chapterCount,
    updateTime: detail?.updateTime ?? book.updateTime,
    lastChapter: getNormalizedLastChapter(detail) ?? getNormalizedLastChapter(book),
    bookUrl: book.bookUrl,
  };
}

export function getMetadataValue(book: SwitchableBookMeta, key: MetadataFieldKey): string {
  if (key === 'coverUrl') {
    return getCoverImageUrl(book.coverUrl) ?? '';
  }
  const value = book[key] as unknown;
  if (typeof value === 'number') {
    return String(value);
  }
  return typeof value === 'string' ? value.trim() : '';
}

function buildSingleSegment(text: string, kind: DiffSegment['kind']): DiffSegment[] {
  return text ? [{ text, kind }] : [];
}

export function buildDiffPair(currentValue: string, candidateValue: string): DiffPair {
  if (currentValue === candidateValue) {
    return {
      current: buildSingleSegment(currentValue, 'same'),
      candidate: buildSingleSegment(candidateValue, 'same'),
      changed: false,
    };
  }

  const currentChars = [...currentValue];
  const candidateChars = [...candidateValue];
  let prefix = 0;
  while (
    prefix < currentChars.length &&
    prefix < candidateChars.length &&
    currentChars[prefix] === candidateChars[prefix]
  ) {
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < currentChars.length - prefix &&
    suffix < candidateChars.length - prefix &&
    currentChars[currentChars.length - 1 - suffix] ===
      candidateChars[candidateChars.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const currentPrefix = currentChars.slice(0, prefix).join('');
  const currentMiddle = currentChars.slice(prefix, currentChars.length - suffix).join('');
  const currentSuffix = currentChars.slice(currentChars.length - suffix).join('');
  const candidatePrefix = candidateChars.slice(0, prefix).join('');
  const candidateMiddle = candidateChars.slice(prefix, candidateChars.length - suffix).join('');
  const candidateSuffix = candidateChars.slice(candidateChars.length - suffix).join('');

  return {
    current: [
      ...buildSingleSegment(currentPrefix, 'same'),
      ...buildSingleSegment(currentMiddle, 'removed'),
      ...buildSingleSegment(currentSuffix, 'same'),
    ],
    candidate: [
      ...buildSingleSegment(candidatePrefix, 'same'),
      ...buildSingleSegment(candidateMiddle, 'added'),
      ...buildSingleSegment(candidateSuffix, 'same'),
    ],
    changed: true,
  };
}

export function diffMetadataFields(
  current: SwitchableBookMeta,
  candidate: SwitchableBookMeta,
): MetadataFieldKey[] {
  return SWITCHABLE_METADATA_FIELDS.filter(({ key }) => {
    const currentValue = getMetadataValue(current, key);
    const candidateValue = getMetadataValue(candidate, key);
    return !!candidateValue && currentValue !== candidateValue;
  }).map(({ key }) => key);
}

export function applyMetadataSelection(
  current: SwitchableBookMeta,
  candidate: SwitchableBookMeta,
  fields: MetadataFieldKey[],
): SwitchableBookMeta {
  const selected = new Set(fields);
  const next: SwitchableBookMeta = { ...current };
  for (const { key } of SWITCHABLE_METADATA_FIELDS) {
    if (!selected.has(key)) {
      continue;
    }
    const candidateValue = candidate[key];
    if (typeof candidateValue === 'string') {
      const trimmed = candidateValue.trim();
      if (trimmed) {
        (next as unknown as Record<string, unknown>)[key] = trimmed;
      }
    } else if (candidateValue) {
      (next as unknown as Record<string, unknown>)[key] = candidateValue;
    }
  }
  return next;
}

export function scoreBookCandidate(
  base: SwitchableBookMeta,
  book: BookItem,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  const baseTitle = stripNoise(base.name);
  const candidateTitle = stripNoise(book.name);
  const titleSimilarity = jaccard(toBigramSet(base.name), toBigramSet(book.name));
  if (baseTitle && candidateTitle && baseTitle === candidateTitle) {
    score += 60;
    reasons.push('书名完全一致');
  } else if (titleSimilarity >= 0.72) {
    score += Math.round(titleSimilarity * 60);
    reasons.push(`书名相似度 ${(titleSimilarity * 100).toFixed(0)}%`);
  }

  const baseAuthor = stripNoise(base.author || '');
  const candidateAuthor = stripNoise(book.author || '');
  if (baseAuthor && candidateAuthor && baseAuthor === candidateAuthor) {
    score += 28;
    reasons.push('作者一致');
  } else if (baseAuthor && candidateAuthor) {
    const authorSimilarity = jaccard(
      toBigramSet(base.author || ''),
      toBigramSet(book.author || ''),
    );
    if (authorSimilarity >= 0.7) {
      score += Math.round(authorSimilarity * 18);
      reasons.push('作者接近');
    }
  }

  if (base.coverUrl && book.coverUrl) {
    score += 4;
    reasons.push('存在封面信息');
  }
  if (base.intro && book.intro) {
    score += 4;
    reasons.push('存在简介信息');
  }

  return { score, reasons };
}

export function rankBookCandidates(
  base: SwitchableBookMeta,
  sourceName: string,
  fileName: string,
  book: BookItem,
  sourceLogo?: string,
): SourceCandidate | null {
  const { score, reasons } = scoreBookCandidate(base, book);
  if (score < 28) {
    return null;
  }
  return {
    key: `${fileName}|${book.bookUrl}`,
    fileName,
    sourceName,
    sourceLogo,
    book,
    score,
    reasons,
  };
}

export function rankChapterMatches(
  currentChapters: ChapterItem[],
  currentIndex: number,
  candidateChapters: ChapterItem[],
): ChapterMatchCandidate[] {
  const current = currentChapters[currentIndex];
  if (!current) {
    return [];
  }

  const currentName = stripNoise(current.name);
  const currentPrev = stripNoise(currentChapters[currentIndex - 1]?.name || '');
  const currentNext = stripNoise(currentChapters[currentIndex + 1]?.name || '');
  const currentNumber = extractChapterNumber(current.name);
  const currentSig = basenameSignature(current.url);

  return candidateChapters
    .map((chapter, index) => {
      const reasons: string[] = [];
      let score = 0;
      const chapterName = stripNoise(chapter.name);
      const titleSimilarity = jaccard(toBigramSet(current.name), toBigramSet(chapter.name));

      if (currentName && chapterName && currentName === chapterName) {
        score += 70;
        reasons.push('章节名完全一致');
      } else if (titleSimilarity >= 0.65) {
        score += Math.round(titleSimilarity * 55);
        reasons.push(`章节名相似度 ${(titleSimilarity * 100).toFixed(0)}%`);
      }

      const chapterNumber = extractChapterNumber(chapter.name);
      if (currentNumber !== null && chapterNumber !== null && currentNumber === chapterNumber) {
        score += 30;
        reasons.push(`章节序号一致（${chapterNumber}）`);
      }

      const distance = Math.abs(index - currentIndex);
      score += Math.max(0, 18 - Math.min(distance, 18));
      if (distance <= 2) {
        reasons.push('目录索引接近');
      }

      const chapterPrev = stripNoise(candidateChapters[index - 1]?.name || '');
      const chapterNext = stripNoise(candidateChapters[index + 1]?.name || '');
      if (currentPrev && chapterPrev && currentPrev === chapterPrev) {
        score += 12;
        reasons.push('上一章上下文吻合');
      }
      if (currentNext && chapterNext && currentNext === chapterNext) {
        score += 12;
        reasons.push('下一章上下文吻合');
      }

      const candidateSig = basenameSignature(chapter.url);
      if (currentSig && candidateSig && currentSig === candidateSig) {
        score += 8;
        reasons.push('URL 特征一致');
      }

      return {
        index,
        name: chapter.name,
        url: chapter.url,
        score,
        reasons,
      };
    })
    .filter((candidate) => candidate.score >= 18)
    .toSorted((left, right) => right.score - left.score)
    .slice(0, 6);
}
