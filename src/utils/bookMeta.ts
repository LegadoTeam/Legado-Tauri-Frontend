export interface BookMetaLike {
  kind?: string;
  lastChapter?: string;
  latestChapter?: string;
  latestChapterUrl?: string;
  wordCount?: string;
  chapterCount?: number;
  updateTime?: string;
  status?: string;
}

export interface BookMetaBadge {
  key: string;
  label: string;
  tone: 'source' | 'kind' | 'status';
}

const TYPE_LABELS: Record<string, string> = {
  novel: '小说',
  comic: '漫画',
  video: '视频',
  music: '音乐',
};

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function getLatestChapterText(book?: BookMetaLike | null): string {
  if (!book) return '';
  return cleanText(book.latestChapter) || cleanText(book.lastChapter);
}

export function getLatestChapterUrl(book?: BookMetaLike | null): string {
  return book ? cleanText(book.latestChapterUrl) : '';
}

export function getSourceTypeLabel(sourceType?: string | null): string {
  return TYPE_LABELS[cleanText(sourceType) || 'novel'] ?? '';
}

export function getChapterCountText(book?: BookMetaLike | null): string {
  if (!book || typeof book.chapterCount !== 'number' || !Number.isFinite(book.chapterCount)) {
    return '';
  }
  const count = Math.max(0, Math.floor(book.chapterCount));
  return count > 0 ? `共 ${count} 章` : '';
}

export function getBookMetaLine(book?: BookMetaLike | null): string[] {
  if (!book) return [];
  return [cleanText(book.wordCount), getChapterCountText(book), cleanText(book.updateTime)].filter(
    Boolean,
  );
}

export function getBookMetaBadges(book?: BookMetaLike | null, sourceType = ''): BookMetaBadge[] {
  const badges: BookMetaBadge[] = [];
  const sourceTypeKey = cleanText(sourceType);
  const typeLabel = sourceTypeKey ? getSourceTypeLabel(sourceTypeKey) : '';
  if (typeLabel) {
    badges.push({ key: `source:${sourceType}`, label: typeLabel, tone: 'source' });
  }
  const kind = cleanText(book?.kind);
  if (kind) {
    badges.push({ key: `kind:${kind}`, label: kind, tone: 'kind' });
  }
  const status = cleanText(book?.status);
  if (status) {
    badges.push({ key: `status:${status}`, label: status, tone: 'status' });
  }
  return badges;
}

export function getNormalizedLastChapter(book?: BookMetaLike | null): string | undefined {
  return getLatestChapterText(book) || undefined;
}
