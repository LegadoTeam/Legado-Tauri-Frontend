/**
 * 跨平台复制文本。
 *
 * 优先走现代 Clipboard API；失败时回退到隐藏 textarea + execCommand，
 * 兼容 Tauri/WebView 与部分受限浏览器环境。
 */
export async function copyText(text: string): Promise<void> {
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // 继续走 DOM 回退路径
    }
  }

  if (typeof document === 'undefined') {
    throw new Error('当前环境不支持复制');
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '0';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);

  if (!copied) {
    throw new Error('浏览器拒绝写入剪贴板');
  }
}
