export interface ReaderRuntimeTextCache {
  rawChapterTextCache: Map<number, string>;
  rawChapterTextRequests: Map<number, Promise<string>>;
  processedChapterTextCache: Map<string, string>;
  processedChapterTextRequests: Map<string, Promise<string>>;
}

export function createReaderRuntimeTextCache(): ReaderRuntimeTextCache {
  return {
    rawChapterTextCache: new Map(),
    rawChapterTextRequests: new Map(),
    processedChapterTextCache: new Map(),
    processedChapterTextRequests: new Map(),
  };
}

export function clearChapterRuntimeTextCache(cache: ReaderRuntimeTextCache, index: number) {
  cache.rawChapterTextCache.delete(index);
  cache.rawChapterTextRequests.delete(index);
  cache.processedChapterTextCache.delete(`${index}:reader.content.beforePaginate`);
  cache.processedChapterTextCache.delete(`${index}:reader.content.beforeRender`);
  cache.processedChapterTextRequests.delete(`${index}:reader.content.beforePaginate`);
  cache.processedChapterTextRequests.delete(`${index}:reader.content.beforeRender`);
}

export function clearAllRuntimeTextCache(cache: ReaderRuntimeTextCache) {
  cache.rawChapterTextCache.clear();
  cache.rawChapterTextRequests.clear();
  cache.processedChapterTextCache.clear();
  cache.processedChapterTextRequests.clear();
}

export function clearProcessedRuntimeTextCache(cache: ReaderRuntimeTextCache) {
  cache.processedChapterTextCache.clear();
  cache.processedChapterTextRequests.clear();
}
