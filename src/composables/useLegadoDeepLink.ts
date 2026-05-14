import { eventListen } from './useEventBus';
import { isTauri, isHarmonyNative } from './useEnv';

const LEGADO_SCHEME = 'legado:';

// ── 深链接类型定义 ────────────────────────────────────────────────────────────
export type LegadoDeepLinkPayload =
  | { type: 'booksource'; url: string }
  | { type: 'repo'; url: string; name?: string }
  | { type: 'plugin'; url: string };

/** 将原始 payload 字符串规范化为 https?:// URL，至多解码两次 */
function normalizeHttpUrl(payload: string): string {
  let p = payload;
  for (let i = 0; i < 2; i += 1) {
    if (!/%[0-9a-f]{2}/i.test(p)) break;
    try {
      const decoded = decodeURIComponent(p);
      if (decoded === p) break;
      p = decoded;
    } catch {
      break;
    }
  }
  if (/^\/\//.test(p)) p = `http:${p}`;
  else if (!/^https?:\/\//i.test(p)) p = `http://${p.replace(/^\/+/, '')}`;
  const url = new URL(p);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('仅支持 http 或 https 地址');
  }
  return url.href;
}

/**
 * 解析深链接，返回类型化的 payload。
 *
 * 支持格式：
 *  - 书源（向下兼容）：`https://...`  /  `legado://?url=...`
 *  - 仓库：`legado://repo?url=...&name=<默认名称>`
 *  - 插件：`legado://plugin?url=...`
 */
export function parseLegadoDeepLink(rawUrl: string): LegadoDeepLinkPayload {
  const input = rawUrl.trim();
  if (!input) throw new Error('链接为空');

  // 纯 https?:// → 默认当书源处理（向下兼容）
  if (/^https?:\/\//i.test(input)) {
    return { type: 'booksource', url: normalizeHttpUrl(input) };
  }

  if (!input.toLowerCase().startsWith(LEGADO_SCHEME)) {
    throw new Error('不是 legado 深链接');
  }

  // 解析为标准 URL（legado://host?params 或 legado://?params）
  let parsed: URL | null = null;
  try {
    parsed = new URL(input);
  } catch {
    // fallback handled below
  }

  const host = parsed?.hostname ?? '';           // e.g. "repo" / "plugin" / ""
  const params = parsed?.searchParams;

  // ── 仓库 ────────────────────────────────────────────────────────────────────
  if (host === 'repo') {
    const rawRepoUrl = params?.get('url') ?? '';
    if (!rawRepoUrl) throw new Error('仓库链接缺少 url 参数');
    const name = params?.get('name')?.trim() || undefined;
    return { type: 'repo', url: normalizeHttpUrl(rawRepoUrl), name };
  }

  // ── 插件 ────────────────────────────────────────────────────────────────────
  if (host === 'plugin') {
    const rawPluginUrl = params?.get('url') ?? '';
    if (!rawPluginUrl) throw new Error('插件链接缺少 url 参数');
    return { type: 'plugin', url: normalizeHttpUrl(rawPluginUrl) };
  }

  // ── 书源（legado://?url=... 或 legado://...）─────────────────────────────
  let payload = params?.get('url') ?? '';
  if (!payload) {
    // 兼容 legado://https://... 形式
    payload = input.slice(`${LEGADO_SCHEME}//`.length);
  }
  if (!payload) throw new Error('书源链接缺少 url 参数');
  return { type: 'booksource', url: normalizeHttpUrl(payload) };
}

/** @deprecated 使用 parseLegadoDeepLink 代替 */
export function parseLegadoBookSourceUrl(rawUrl: string): string {
  const result = parseLegadoDeepLink(rawUrl);
  if (result.type !== 'booksource') throw new Error('不是 legado 书源链接');
  return result.url;
}

type DeepLinkHandler = (urls: string[]) => void;

interface HarmonyDeepLinkPayload {
  urls?: string[];
  url?: string;
}

export async function installLegadoDeepLinkListener(handler: DeepLinkHandler): Promise<() => void> {
  const unlisteners: Array<() => void> = [];

  if (isTauri) {
    try {
      const { getCurrent, onOpenUrl } = await import('@tauri-apps/plugin-deep-link');
      const current = await getCurrent();
      if (current?.length) {
        handler(current);
      }
      const unlisten = await onOpenUrl((urls) => handler(urls));
      unlisteners.push(unlisten);
    } catch (e) {
      console.warn('[LegadoDeepLink] Tauri deep-link 初始化失败:', e);
    }
  }

  if (isHarmonyNative) {
    const unlisten = await eventListen<HarmonyDeepLinkPayload>('deep-link://new-url', (event) => {
      const payload = event.payload;
      if (Array.isArray(payload?.urls)) {
        handler(payload.urls);
      } else if (payload?.url) {
        handler([payload.url]);
      }
    });
    unlisteners.push(unlisten);
  }

  if (!isTauri && !isHarmonyNative && typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    const fromQuery = url.searchParams.get('legado') ?? url.searchParams.get('url');
    const fromHash = url.hash.startsWith('#legado=')
      ? url.hash.slice('#legado='.length)
      : '';
    const current = fromQuery || fromHash;
    if (current) {
      handler([current]);
    }
  }

  return () => {
    for (const unlisten of unlisteners) {
      unlisten();
    }
  };
}
