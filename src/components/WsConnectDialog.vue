<script setup lang="ts">
import { useMessage } from 'naive-ui';
/**
 * WsConnectDialog — 非 Tauri 环境下后端连接失败时弹出的地址输入框
 *
 * 逻辑：
 * 1. onMounted 时探测 WS 连接是否可用
 * 2. 不可用则弹出 Modal，要求用户输入后端 WebSocket 地址
 * 3. 写入当前 URL 的 `ws` 参数，重新探测，成功后刷新页面使所有组件重新初始化
 * 4. 允许跳过（仅本次，不保存），Dialog 关闭后用户可在设置页修改
 */
import { ref, onMounted } from 'vue';
import { hasNativeTransport } from '@/composables/useEnv';
import { useOverlayBackstack } from '@/composables/useOverlayBackstack';
import {
  isTransportAvailable,
  getCustomWsUrl,
  setCustomWsUrl,
  resetWsProbe,
} from '@/composables/useTransport';

const message = useMessage();

const show = ref(false);
const wsUrlInput = ref('');
const connecting = ref(false);
let connectRequestId = 0;

useOverlayBackstack(() => show.value, handleSkip);

onMounted(async () => {
  if (hasNativeTransport) {
    return;
  }

  // 预填当前已保存的地址，或构造默认猜测地址
  const saved = getCustomWsUrl();
  wsUrlInput.value = saved || `ws://${window.location.hostname || 'localhost'}:7688/ws`;

  const ok = await isTransportAvailable();
  if (!ok) {
    show.value = true;
  }
});

async function handleConnect() {
  const url = wsUrlInput.value.trim();
  if (!url) {
    message.error('请输入后端 WebSocket 地址');
    return;
  }

  const requestId = ++connectRequestId;
  connecting.value = true;
  try {
    setCustomWsUrl(url);
    const ok = await isTransportAvailable();
    if (requestId !== connectRequestId || !show.value) {
      return;
    }

    if (ok) {
      show.value = false;
      message.success('连接成功，正在刷新…');
      // 刷新页面让所有组件用新连接重新初始化
      setTimeout(() => window.location.reload(), 600);
    } else {
      // 连接失败：重置，让用户继续修改地址
      resetWsProbe();
      message.error('连接失败，请检查地址后重试');
    }
  } finally {
    if (requestId === connectRequestId) {
      connecting.value = false;
    }
  }
}

function handleSkip() {
  connectRequestId += 1;
  connecting.value = false;
  show.value = false;
}
</script>

<template>
  <n-modal
    v-model:show="show"
    :mask-closable="false"
    :close-on-esc="false"
    preset="card"
    title="连接到后端"
    style="width: 400px; max-width: 92vw"
    :bordered="false"
    size="medium"
  >
    <div class="ws-connect-body">
      <p class="ws-connect-desc">
        未检测到后端服务，请输入后端 WebSocket 地址后连接。<br />
        地址将保存在本地，下次自动使用。
      </p>
      <n-input
        v-model:value="wsUrlInput"
        placeholder="ws://127.0.0.1:7688/ws"
        class="ws-connect-input"
        :disabled="connecting"
        @keydown.enter.prevent="handleConnect"
      />
      <div class="ws-connect-hint">示例：<code>ws://192.168.1.100:7688/ws</code></div>
    </div>

    <template #footer>
      <div class="ws-connect-footer">
        <n-button text size="small" @click="handleSkip"> 跳过（仅本次） </n-button>
        <n-button type="primary" size="small" :loading="connecting" @click="handleConnect">
          连接
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
.ws-connect-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ws-connect-desc {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--color-text-secondary);
}

.ws-connect-input {
  font-family: var(--font-mono, monospace);
  font-size: 0.875rem;
}

.ws-connect-hint {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.ws-connect-hint code {
  font-family: var(--font-mono, monospace);
  background: var(--color-surface-hover);
  padding: 1px 4px;
  border-radius: 3px;
}

.ws-connect-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
}
</style>
