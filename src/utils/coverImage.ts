export interface CoverImageRef {
  url: string;
  referer?: string;
  referrer?: string;
  sourceUrl?: string;
  headers?: Record<string, string>;
}

export type CoverImageInput = string | CoverImageRef | null | undefined;

export function isCoverImageRef(value: CoverImageInput): value is CoverImageRef {
  return typeof value === 'object' && value !== null && typeof value.url === 'string';
}

export function getCoverImageUrl(value: CoverImageInput): string | undefined {
  if (!value) {
    return undefined;
  }
  if (typeof value === 'string') {
    return value || undefined;
  }
  return value.url || undefined;
}

export function getCoverImageReferer(
  value: CoverImageInput,
  fallback?: string,
): string | undefined {
  if (!isCoverImageRef(value)) {
    return fallback || undefined;
  }
  return value.referer || value.referrer || fallback || undefined;
}

export function getCoverImageSourceUrl(value: CoverImageInput): string | undefined {
  return isCoverImageRef(value) ? value.sourceUrl || undefined : undefined;
}

export function getCoverImageHeaders(
  value: CoverImageInput,
): Record<string, string> | undefined {
  return isCoverImageRef(value) ? value.headers : undefined;
}
