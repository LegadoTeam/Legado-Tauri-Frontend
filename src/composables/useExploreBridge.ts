/**
 * useExploreBridge — HTML 发现页 iframe ↔ Vue 双向通信桥梁
 *
 * 核心职责：
 *   1. 生成注入 iframe 的 bridge 脚本（`window.legado` 对象）
 *   2. 将用户 HTML 包装为安全的 srcdoc（注入 bridge + 基础样式）
 *   3. 定义 postMessage 协议常量
 *
 * 通信流程：
 *   iframe 内 JS 调用 `legado.http.get(url)` 等方法
 *     → postMessage({type:'legado-request', id, method, args})
 *     → Vue ExploreHtmlRenderer 监听 message 事件
 *     → 路由到对应 Tauri invoke（http/config/callSource 等）
 *     → postMessage({type:'legado-response', id, result, error}) 回 iframe
 *     → iframe 内 Promise resolve/reject
 */

// ── postMessage 协议常量 ──────────────────────────────────────────────────

/** iframe → parent 的请求消息类型 */
export const MSG_REQUEST  = 'legado-request'
/** parent → iframe 的响应消息类型 */
export const MSG_RESPONSE = 'legado-response'
/** parent → iframe 的事件推送消息类型 */
export const MSG_EVENT    = 'legado-event'

// ── Bridge 可调用的方法白名单 ──────────────────────────────────────────────

export const BRIDGE_METHODS = [
  'http.get',
  'http.post',
  'config.read',
  'config.write',
  'callSource',
  'explore',
  'toast',
  'openBook',
  'search',
  'log',
] as const

export type BridgeMethod = typeof BRIDGE_METHODS[number]

// ── 注入 iframe 的 bridge 脚本 ────────────────────────────────────────────

/**
 * 生成注入 iframe `<head>` 的 bridge JavaScript 代码。
 *
 * 该脚本在 iframe 内定义 `window.legado` 对象，每个方法通过 postMessage
 * 与父页面通信，返回 Promise 等待 Vue 层代理结果。
 */
function generateBridgeScript(): string {
  return `
<script>
(function() {
  'use strict';

  // 挂起中的请求: id → { resolve, reject }
  var pending = {};

  // 生成唯一 ID（兼容无 crypto 环境的 fallback）
  function uuid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  // 向父页面发送请求并返回 Promise
  function request(method, args) {
    return new Promise(function(resolve, reject) {
      var id = uuid();
      pending[id] = { resolve: resolve, reject: reject };
      window.parent.postMessage({
        type: '${MSG_REQUEST}',
        id: id,
        method: method,
        args: args
      }, '*');
      // 超时保护（60s）
      setTimeout(function() {
        if (pending[id]) {
          pending[id].reject(new Error('Bridge request timeout: ' + method));
          delete pending[id];
        }
      }, 60000);
    });
  }

  // 监听父页面的响应
  window.addEventListener('message', function(e) {
    var d = e.data;
    if (!d || typeof d !== 'object') return;

    if (d.type === '${MSG_RESPONSE}' && d.id && pending[d.id]) {
      if (d.error) {
        pending[d.id].reject(new Error(d.error));
      } else {
        pending[d.id].resolve(d.result);
      }
      delete pending[d.id];
    }

    // 父页面推送的事件
    if (d.type === '${MSG_EVENT}' && typeof window._legadoEventHandler === 'function') {
      window._legadoEventHandler(d.event, d.data);
    }
  });

  // ── 定义 window.legado 对象 ───────────────────────────────────────────

  window.legado = {
    http: {
      get: function(url, headers) {
        return request('http.get', [url, headers || null]);
      },
      post: function(url, body, headers) {
        return request('http.post', [url, body || '', headers || null]);
      }
    },

    config: {
      read: function(key, scope) {
        return request('config.read', [key, scope || null]);
      },
      write: function(key, value, scope) {
        return request('config.write', [key, String(value), scope || null]);
      }
    },

    // 调用当前书源的任意导出函数
    callSource: function(fnName) {
      var args = Array.prototype.slice.call(arguments, 1);
      return request('callSource', [fnName].concat(args));
    },

    // 导航到另一个发现分类（会替换当前 iframe 内容）
    explore: function(category, page) {
      return request('explore', [category, page || 1]);
    },

    // 显示 toast 通知
    toast: function(msg, type) {
      request('toast', [String(msg), type || 'info']);
    },

    // 打开书籍详情抽屉
    openBook: function(bookUrl) {
      request('openBook', [String(bookUrl)]);
    },

    // 触发全局搜索
    search: function(keyword) {
      request('search', [String(keyword)]);
    },

    // 控制台日志
    log: function(msg) {
      request('log', [String(msg)]);
    }
  };
})();
</script>`
}

// ── 基础样式注入（暗色/亮色适配） ─────────────────────────────────────────

/**
 * 生成注入 iframe 的基础 CSS 样式。
 *
 * 提供与主应用视觉风格一致的基础 CSS 变量和 reset 样式，
 * 书源可直接使用这些变量构建 UI。
 */
function generateBaseStyles(): string {
  return `
<style>
  :root {
    --bg: #1e1e2e;
    --bg-card: #2a2a3c;
    --bg-hover: #33334a;
    --text: #e0e0e0;
    --text-secondary: #a0a0b0;
    --primary: #64b5f6;
    --primary-hover: #90caf9;
    --border: #3a3a4c;
    --radius: 8px;
    --radius-sm: 4px;
    --shadow: 0 2px 8px rgba(0,0,0,0.3);
    --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  @media (prefers-color-scheme: light) {
    :root {
      --bg: #f5f5f5;
      --bg-card: #ffffff;
      --bg-hover: #f0f0f0;
      --text: #333333;
      --text-secondary: #666666;
      --primary: #1976d2;
      --primary-hover: #1565c0;
      --border: #e0e0e0;
      --shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: var(--font);
    background: var(--bg);
    color: var(--text);
    font-size: 14px;
    line-height: 1.5;
    padding: 12px;
    overflow-x: hidden;
  }
  a { color: var(--primary); text-decoration: none; }
  a:hover { color: var(--primary-hover); }
  button, .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px 14px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
    color: var(--text);
    cursor: pointer;
    font-size: 13px;
    transition: background 0.15s, border-color 0.15s;
  }
  button:hover, .btn:hover {
    background: var(--bg-hover);
    border-color: var(--primary);
  }
  button.primary, .btn-primary {
    background: var(--primary);
    border-color: var(--primary);
    color: #fff;
  }
  button.primary:hover, .btn-primary:hover {
    background: var(--primary-hover);
  }
  input, select, textarea {
    padding: 6px 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
    color: var(--text);
    font-size: 13px;
    outline: none;
    transition: border-color 0.15s;
  }
  input:focus, select:focus, textarea:focus {
    border-color: var(--primary);
  }
  .card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 12px;
    box-shadow: var(--shadow);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 10px;
  }
  .flex { display: flex; }
  .flex-wrap { flex-wrap: wrap; }
  .gap-sm { gap: 6px; }
  .gap-md { gap: 10px; }
  .mt-sm { margin-top: 8px; }
  .mt-md { margin-top: 16px; }
  .mb-sm { margin-bottom: 8px; }
  .text-sm { font-size: 12px; }
  .text-secondary { color: var(--text-secondary); }
  .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>`
}

// ── 公共 API ──────────────────────────────────────────────────────────────

/**
 * 将书源返回的 HTML 内容包装为完整的 iframe srcdoc。
 *
 * 注入内容（按顺序）：
 * 1. `<meta charset="utf-8">` + viewport
 * 2. 基础 CSS 样式（暗色/亮色适配）
 * 3. Bridge 脚本（`window.legado` 对象）
 * 4. 书源返回的原始 HTML
 *
 * @param html 书源 explore() 返回的 HTML 字符串
 * @returns 完整的 srcdoc HTML
 */
export function buildSrcdoc(html: string): string {
  const bridgeScript = generateBridgeScript()
  const baseStyles = generateBaseStyles()

  // 如果 HTML 已包含 <html> 或 <head>，在 <head> 末尾注入
  if (/<head[\s>]/i.test(html)) {
    return html.replace(
      /<\/head>/i,
      `${baseStyles}\n${bridgeScript}\n</head>`
    )
  }

  // 如果 HTML 已有 <html> 但没有 <head>
  if (/<html[\s>]/i.test(html)) {
    return html.replace(
      /<html([^>]*)>/i,
      `<html$1><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${baseStyles}
${bridgeScript}
</head>`
    )
  }

  // 纯 body 内容，包装完整文档
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${baseStyles}
${bridgeScript}
</head>
<body>
${html}
</body>
</html>`
}

/**
 * 检测 explore() 返回值是否为 HTML 交互页类型。
 *
 * 约定格式：`{ type: 'html', html: string, title?: string }`
 */
export function isHtmlExploreResult(value: unknown): value is { type: 'html'; html: string; title?: string } {
  if (!value || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>
  return obj.type === 'html' && typeof obj.html === 'string'
}
