<script setup lang="ts">
import { ref, watch } from 'vue';
import { extractLocalFilePath, isLocalFileRef, toFileSrcSync } from '@/composables/useFileSrc';
import { invokeWithTimeout } from '@/composables/useInvoke';
import {
  getCoverImageHeaders,
  getCoverImageReferer,
  getCoverImageSourceUrl,
  getCoverImageUrl,
  type CoverImageInput,
} from '@/utils/coverImage';

/**
 * 书籍封面图片组件
 *
 * Props:
 *   src     — 封面 URL，或 { url, referer, sourceUrl, headers }
 *   alt     — alt 文本
 *   baseUrl — 用于解析相对 URL 的基础 URL（通常为 bookUrl / tocUrl），
 *             同时作为本地磁盘缓存的触发条件（仅在 Tauri 环境生效）
 *
 * 缓存策略（Tauri / Web-WS）：
 *   1. 每次 src 变化时，解析封面 URL 和来源元数据
 *   2. 交给 Rust 检查缓存；未命中时 Rust 带 Referer 下载
 *   3. Rust 返回本地缓存路径后再显示图片，期间保持加载中
 *
 * 相对 URL 解析：
 *   new URL(src, baseUrl) — 标准 WHATWG URL 解析，与浏览器行为一致
 */

const props = withDefaults(
  defineProps<{
    src?: CoverImageInput;
    alt?: string;
    /** 用于解析相对路径的基础 URL（bookUrl / tocUrl 等），同时启用本地缓存 */
    baseUrl?: string;
  }>(),
  { alt: '' },
);

type CoverStatus = 'loading' | 'loaded' | 'error' | 'empty';

const status = ref<CoverStatus>('empty');
/** 最终传给 <img> 的 src（已解析 & 可能是本地 asset:// URI） */
const resolvedSrc = ref<string | undefined>(undefined);
/** 当前展示的是否来自本地缓存（避免重复触发下载） */
const isFromCache = ref(false);
/**
 * 最近一次 onLoad 成功时的 resolvedSrc 值。
 * 当 watch 触发但 resolvedSrc 未变化时，直接恢复 'loaded' 状态，
 * 避免 status 卡在 'loading'（img src 不变则 onLoad 不会重复触发）。
 */
const lastLoadedSrc = ref<string | undefined>(undefined);

/** 用序号防止异步竞态：只有最新一次 watch 触发的结果才会生效 */
let resolveSeq = 0;

async function hasCoverCacheTransport(): Promise<boolean> {
  const { isTransportAvailable } = await import('@/composables/useTransport');
  return isTransportAvailable();
}

/** 将可能为相对路径的 url 解析为绝对 URL */
function toAbsUrl(url: string, base: string | undefined): string {
  if (!base) {
    return url;
  }
  try {
    return new URL(url, base).href;
  } catch {
    return url;
  }
}

/** 应用新的 resolvedSrc，若与上次成功加载的 src 相同则直接标记为 loaded */
function applyResolvedSrc(newSrc: string, fromCache: boolean) {
  isFromCache.value = fromCache;
  resolvedSrc.value = newSrc;
  // img src 未变化时，onLoad 不会重触发，直接恢复 loaded 状态
  status.value = newSrc === lastLoadedSrc.value ? 'loaded' : 'loading';
}

watch(
  [() => props.src, () => props.baseUrl],
  async ([src, baseUrl]) => {
    const seq = ++resolveSeq;
    const rawUrl = getCoverImageUrl(src);

    if (!rawUrl) {
      resolvedSrc.value = undefined;
      isFromCache.value = false;
      status.value = 'empty';
      return;
    }

    if (isLocalFileRef(rawUrl)) {
      applyResolvedSrc(toFileSrcSync(extractLocalFilePath(rawUrl)), true);
      return;
    }

    const sourceUrl = getCoverImageSourceUrl(src);
    const absUrl = toAbsUrl(rawUrl, sourceUrl || baseUrl);
    status.value = 'loading';
    resolvedSrc.value = undefined;

    if (await hasCoverCacheTransport()) {
      try {
        const result = await invokeWithTimeout<{ localPath: string; localRef: string }>(
          'cover_resolve_cache',
          {
            request: {
              url: absUrl,
              referer: getCoverImageReferer(src),
              headers: getCoverImageHeaders(src) ?? null,
            },
          },
          20000,
        );
        if (seq !== resolveSeq) {
          return;
        }
        applyResolvedSrc(toFileSrcSync(result.localPath), true);
        return;
      } catch {
        if (seq === resolveSeq) {
          status.value = 'error';
        }
        return;
      }
    }

    if (seq !== resolveSeq) {
      return;
    }
    applyResolvedSrc(absUrl, false);
  },
  { immediate: true },
);

function onLoad() {
  lastLoadedSrc.value = resolvedSrc.value;
  status.value = 'loaded';
}

function onError() {
  // 若本地缓存文件异常（如被手动删除），尝试回退到原始网络 URL
  const rawUrl = getCoverImageUrl(props.src);
  if (isFromCache.value && rawUrl && props.baseUrl && !isLocalFileRef(rawUrl)) {
    const absUrl = toAbsUrl(rawUrl, getCoverImageSourceUrl(props.src) || props.baseUrl);
    if (resolvedSrc.value !== absUrl) {
      applyResolvedSrc(absUrl, false);
      return;
    }
  }
  status.value = 'error';
}
</script>

<template>
  <div class="book-cover-img" :class="`book-cover-img--${status}`">
    <!-- 图片本体：有 src 时始终在 DOM 便于浏览器加载，加载完成前通过 v-show 隐藏。
         注意：不使用 loading="lazy"，因为 display:none 元素在部分浏览器下懒加载
         永远不会触发，导致 onLoad 永远不执行，status 卡在 loading。 -->
    <img
      v-if="resolvedSrc"
      v-show="status === 'loaded'"
      class="book-cover-img__img"
      :src="resolvedSrc"
      :alt="alt"
      @load="onLoad"
      @error="onError"
    />

    <!-- 加载中：shimmer 动画 -->
    <div v-if="status === 'loading'" class="book-cover-img__overlay book-cover-img__shimmer" />

    <!-- 暂无封面 / 加载失败 -->
    <div
      v-else-if="status === 'empty' || status === 'error'"
      class="book-cover-img__overlay book-cover-img__placeholder"
    >
      <svg
        class="book-cover-img__icon"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect x="4" y="2" width="12" height="18" rx="2" stroke="currentColor" stroke-width="1.5" />
        <path
          d="M4 7h12M7 11h6M7 14h4"
          stroke="currentColor"
          stroke-width="1.2"
          stroke-linecap="round"
        />
        <path
          d="M16 5v14l2.5-1.5 2.5 1.5V5"
          stroke="currentColor"
          stroke-width="1.2"
          stroke-linecap="round"
          stroke-linejoin="round"
          opacity="0.5"
        />
      </svg>
      <span class="book-cover-img__label">
        {{ status === 'error' ? '加载失败' : '暂无封面' }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.book-cover-img {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: inherit;
  background: var(--color-surface);
}

.book-cover-img__img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.book-cover-img__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

/* ── 加载中：扫光 shimmer 动画 ── */
.book-cover-img__shimmer {
  background: linear-gradient(
    105deg,
    var(--color-surface) 0%,
    var(--color-surface-hover, #464658) 45%,
    var(--color-surface) 90%
  );
  background-size: 300% 100%;
  animation: cover-shimmer 1.6s ease-in-out infinite;
}

@keyframes cover-shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}

/* ── 占位状态 ── */
.book-cover-img__placeholder {
  background: var(--color-surface);
}

.book-cover-img__icon {
  width: 40%;
  max-width: 22px;
  height: auto;
  color: var(--color-text-muted);
  opacity: 0.35;
  flex-shrink: 0;
}

.book-cover-img__label {
  font-size: 0.5rem;
  color: var(--color-text-muted);
  opacity: 0.5;
  text-align: center;
  white-space: nowrap;
  line-height: 1.2;
  letter-spacing: 0.02em;
}
</style>
