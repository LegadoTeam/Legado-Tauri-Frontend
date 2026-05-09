<script setup lang="ts">
import { useMessage, type MessageApi, type MessageOptions, type MessageReactive } from 'naive-ui';
import { isHarmonyNative } from '@/composables/useEnv';
import { invokeWithTimeout } from '@/composables/useInvoke';
import { useScriptBridgeStore } from '@/stores';

type MessageLevel = 'success' | 'error' | 'warning' | 'info';

type MirrorPatchedApi = MessageApi & {
  __legadoMirrorInstalled__?: boolean;
};

function normalizeContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (content instanceof Error) {
    return content.stack || content.message;
  }
  if (typeof content === 'number' || typeof content === 'boolean') {
    return String(content);
  }
  if (content && typeof content === 'object') {
    const maybeContent = (content as Record<string, unknown>).content;
    if (typeof maybeContent === 'string') {
      return maybeContent;
    }
    try {
      return JSON.stringify(content);
    } catch {
      return String(content);
    }
  }
  return String(content ?? '');
}

function mirrorPrompt(level: MessageLevel, content: unknown): void {
  const text = normalizeContent(content).trim();
  if (!text) {
    return;
  }

  invokeWithTimeout('frontend_log', { level, message: text }, 3000).catch((error) => {
    const fallbackLevel = level === 'error' ? 'ERROR' : level === 'warning' ? 'WARN' : 'INFO';
    useScriptBridgeStore().appendDebugLog(
      `[UI][${fallbackLevel}][mirror-fallback][${level}] ${text}`,
      'app',
    );
    console.warn('[GlobalFeedbackMirror] 后端日志转发失败，已回退本地日志:', error);
  });

  if (isHarmonyNative) {
    const line = `[PromptMirror][${level}] ${text}`;
    switch (level) {
      case 'error':
        console.error(line);
        break;
      case 'warning':
        console.warn(line);
        break;
      default:
        console.info(line);
        break;
    }
  }
}

function patchMethod(message: MirrorPatchedApi, method: MessageLevel): void {
  const original = message[method];
  if (typeof original !== 'function') {
    return;
  }

  const wrapped = ((content: unknown, options?: MessageOptions): MessageReactive => {
    mirrorPrompt(method, content);
    return original.call(message, content as never, options);
  }) as typeof original;

  Object.assign(wrapped, original);
  message[method] = wrapped;
}

const message = useMessage() as MirrorPatchedApi;
if (!message.__legadoMirrorInstalled__) {
  message.__legadoMirrorInstalled__ = true;

  patchMethod(message, 'success');
  patchMethod(message, 'error');
  patchMethod(message, 'warning');
  patchMethod(message, 'info');
}
</script>

<template></template>
