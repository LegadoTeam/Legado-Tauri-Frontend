import type { PatchShelfBookPayload, ShelfBook } from '@/composables/useBookshelf';
import { invokeWithTimeout } from '@/composables/useInvoke';
import type { FrontendPluginHttpRequest, FrontendPluginHttpResponse } from './pluginTypes';

export function normalizeHttpHeaders(headers?: Record<string, string>): Array<[string, string]> {
  if (!headers) {
    return [];
  }
  return Object.entries(headers)
    .map(([key, value]) => [key.trim(), value] as [string, string])
    .filter(([key, value]) => key && typeof value === 'string');
}

export async function requestPluginHttp(
  request: FrontendPluginHttpRequest,
): Promise<FrontendPluginHttpResponse> {
  return invokeWithTimeout<FrontendPluginHttpResponse>(
    'frontend_plugin_http_request',
    {
      request: {
        url: request.url,
        method: request.method ?? 'GET',
        headers: normalizeHttpHeaders(request.headers),
        body: request.body ?? null,
        timeoutSecs: request.timeoutSecs ?? null,
      },
    },
    (request.timeoutSecs ?? 35) * 1000 + 5_000,
  );
}

export async function getShelfBookById(id: string): Promise<ShelfBook> {
  return invokeWithTimeout<ShelfBook>('bookshelf_get', { id }, 10_000);
}

export async function patchShelfBook(id: string, patch: PatchShelfBookPayload): Promise<ShelfBook> {
  const current = await getShelfBookById(id);
  const payload = {
    id,
    name: patch.name ?? current.name,
    author: patch.author ?? current.author,
    coverUrl: patch.coverUrl ?? current.coverUrl,
    intro: patch.intro ?? current.intro,
    kind: patch.kind ?? current.kind,
    bookUrl: patch.bookUrl ?? current.bookUrl,
    fileName: patch.fileName ?? current.fileName,
    sourceName: patch.sourceName ?? current.sourceName,
    lastChapter: patch.lastChapter ?? current.lastChapter,
    totalChapters: patch.totalChapters ?? current.totalChapters,
    readChapterIndex: patch.readChapterIndex ?? current.readChapterIndex,
    readChapterUrl: patch.readChapterUrl ?? current.readChapterUrl,
    sourceType: patch.sourceType ?? current.sourceType,
    createSourceSwitchBackup: patch.createSourceSwitchBackup,
    clearContentCache: patch.clearContentCache,
  };
  return invokeWithTimeout<ShelfBook>(
    'bookshelf_update_book',
    {
      book: payload,
      chapters: null,
    },
    10_000,
  );
}
