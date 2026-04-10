<script setup lang="ts">
/**
 * ExploreHtmlRenderer — 沙箱 iframe HTML 渲染器
 *
 * 将书源 explore() 返回的 HTML 内容在 sandboxed iframe 中渲染，
 * 并充当 iframe ↔ Tauri 的通信代理层。
 *
 * 通信流程：
 *   iframe 内 JS 调用 window.legado.xxx()
 *     → postMessage({type:'legado-request', id, method, args})
 *     → 本组件监听 message 事件
 *     → 路由到对应 Tauri invoke
 *     → postMessage({type:'legado-response', id, result, error}) 回 iframe
 */
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useMessage } from 'naive-ui'
import { invokeWithTimeout } from '../../composables/useInvoke'
import { buildSrcdoc, MSG_REQUEST, MSG_RESPONSE, type BridgeMethod } from '../../composables/useExploreBridge'

const props = defineProps<{
  /** 书源文件名（用于 callSource / config scope） */
  fileName: string
  /** 书源返回的原始 HTML 内容 */
  html: string
}>()

const emit = defineEmits<{
  /** 请求打开书籍详情 */
  (e: 'open-book', bookUrl: string): void
  /** 请求触发搜索 */
  (e: 'search', keyword: string): void
  /** 请求导航到另一个分类 */
  (e: 'explore', category: string, page: number): void
}>()

const message = useMessage()
const iframeRef = ref<HTMLIFrameElement | null>(null)

/** 构建注入 bridge 的完整 srcdoc */
const srcdoc = computed(() => buildSrcdoc(props.html))

// ── postMessage 消息处理 ──────────────────────────────────────────────────

function handleMessage(event: MessageEvent) {
  const data = event.data
  if (!data || typeof data !== 'object' || data.type !== MSG_REQUEST) return

  // 确保消息来自我们的 iframe
  const iframe = iframeRef.value
  if (!iframe?.contentWindow || event.source !== iframe.contentWindow) return

  const { id, method, args } = data as { id: string; method: BridgeMethod; args: unknown[] }
  handleBridgeRequest(id, method, args ?? [])
}

async function handleBridgeRequest(id: string, method: BridgeMethod, args: unknown[]) {
  try {
    const result = await routeMethod(method, args)
    sendResponse(id, result, null)
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    sendResponse(id, null, errMsg)
  }
}

function sendResponse(id: string, result: unknown, error: string | null) {
  const iframe = iframeRef.value
  if (!iframe?.contentWindow) return
  iframe.contentWindow.postMessage({
    type: MSG_RESPONSE,
    id,
    result,
    error,
  }, '*')
}

// ── 方法路由：将 bridge 方法映射到 Tauri invoke ──────────────────────────

async function routeMethod(method: BridgeMethod, args: unknown[]): Promise<unknown> {
  switch (method) {
    case 'http.get': {
      const [url, headers] = args as [string, Record<string, string> | null]
      return invokeWithTimeout<string>('booksource_http_proxy', {
        url,
        method: 'GET',
        body: null,
        headers: headers ?? null,
      }, 35000)
    }

    case 'http.post': {
      const [url, body, headers] = args as [string, string, Record<string, string> | null]
      return invokeWithTimeout<string>('booksource_http_proxy', {
        url,
        method: 'POST',
        body: body ?? null,
        headers: headers ?? null,
      }, 35000)
    }

    case 'config.read': {
      const [key, scope] = args as [string, string | null]
      return invokeWithTimeout<string>('config_read', {
        scope: scope ?? props.fileName,
        key,
      }, 10000)
    }

    case 'config.write': {
      const [key, value, scope] = args as [string, string, string | null]
      await invokeWithTimeout<void>('config_write', {
        scope: scope ?? props.fileName,
        key,
        value,
      }, 10000)
      return null
    }

    case 'callSource': {
      const [fnName, ...fnArgs] = args
      return invokeWithTimeout<unknown>('booksource_call_fn', {
        fileName: props.fileName,
        fnName: String(fnName),
        args: fnArgs,
      }, 35000)
    }

    case 'explore': {
      const [category, page] = args as [string, number?]
      emit('explore', category, page ?? 1)
      return null
    }

    case 'toast': {
      const [msg, type] = args as [string, string?]
      switch (type) {
        case 'success': message.success(msg); break
        case 'error': message.error(msg); break
        case 'warning': message.warning(msg); break
        default: message.info(msg)
      }
      return null
    }

    case 'openBook': {
      const [bookUrl] = args as [string]
      emit('open-book', bookUrl)
      return null
    }

    case 'search': {
      const [keyword] = args as [string]
      emit('search', keyword)
      return null
    }

    case 'log': {
      const [msg] = args as [string]
      console.log(`[${props.fileName}]`, msg)
      return null
    }

    default:
      throw new Error(`未知的 bridge 方法: ${method}`)
  }
}

// ── 生命周期 ──────────────────────────────────────────────────────────────

onMounted(() => {
  window.addEventListener('message', handleMessage)
})

onBeforeUnmount(() => {
  window.removeEventListener('message', handleMessage)
})

// HTML 变化时，如果 iframe 同一引用，手动更新 srcdoc 可能不触发重载
watch(srcdoc, () => {
  const iframe = iframeRef.value
  if (iframe) {
    iframe.srcdoc = srcdoc.value
  }
})
</script>

<template>
  <div class="ehr">
    <iframe
      ref="iframeRef"
      class="ehr__frame"
      sandbox="allow-scripts"
      :srcdoc="srcdoc"
      frameborder="0"
    />
  </div>
</template>

<style scoped>
.ehr {
  width: 100%;
  min-height: 300px;
  border-radius: var(--radius-md, 8px);
  overflow: hidden;
}

.ehr__frame {
  width: 100%;
  min-height: 400px;
  height: 100%;
  border: none;
  background: transparent;
}
</style>
