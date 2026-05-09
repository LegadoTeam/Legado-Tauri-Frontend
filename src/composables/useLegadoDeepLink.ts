import { eventListen } from './useEventBus';
import { isTauri, isHarmonyNative } from './useEnv';

const LEGADO_SCHEME = 'legado:';

export function parseLegadoBookSourceUrl(rawUrl: string): string {
  const input = rawUrl.trim();
  if (!input) {
    throw new Error('链接为空');
  }

  let payload = '';
  if (/^https?:\/\//i.test(input)) {
    payload = input;
  } else if (input.toLowerCase().startsWith(`${LEGADO_SCHEME}//`)) {
    try {
      const url = new URL(input);
      payload = url.searchParams.get('url') ?? '';
    } catch {
      payload = '';
    }
    if (!payload) {
      payload = input.slice(`${LEGADO_SCHEME}//`.length);
    }
  } else if (input.toLowerCase().startsWith(LEGADO_SCHEME)) {
    payload = input.slice(LEGADO_SCHEME.length).replace(/^\/+/, '');
  } else {
    throw new Error('不是 legado 书源链接');
  }

  for (let i = 0; i < 2; i += 1) {
    if (!/%[0-9a-f]{2}/i.test(payload)) {
      break;
    }
    try {
      const decoded = decodeURIComponent(payload);
      if (decoded === payload) {
        break;
      }
      payload = decoded;
    } catch {
      break;
    }
  }

  if (/^\/\//.test(payload)) {
    payload = `http:${payload}`;
  } else if (!/^https?:\/\//i.test(payload)) {
    payload = `http://${payload.replace(/^\/+/, '')}`;
  }

  const url = new URL(payload);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('仅支持 http 或 https 书源地址');
  }
  return url.href;
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
