<script setup lang="ts">
import { useMessage } from 'naive-ui';
import { storeToRefs } from 'pinia';
import { ref, onMounted } from 'vue';
import { hasNativeTransport, isMobile, isTauri } from '@/composables/useEnv';
import { invokeWithTimeout } from '@/composables/useInvoke';
import {
  isTransportAvailable,
  getCustomWsUrl,
  setCustomWsUrl,
  clearCustomWsUrl,
  resetWsProbe,
} from '@/composables/useTransport';
import { useAppConfigStore } from '@/stores';
import SettingItem from './SettingItem.vue';
import SettingSection from './SettingSection.vue';

const message = useMessage();
const _appCfg = useAppConfigStore();
const { config, savingKey } = storeToRefs(_appCfg);
const { setConfig, loadConfig } = _appCfg;

const webServerPortInput = ref<number | null>(null);
const localIps = ref<string[]>([]);
const transportReady = ref(hasNativeTransport);
const customWsUrl = ref(getCustomWsUrl());
const wsUrlInput = ref('');
const wsConnecting = ref(false);
const webServerDistRestarting = ref(false);

onMounted(async () => {
  transportReady.value = await isTransportAvailable();
  wsUrlInput.value = customWsUrl.value || `ws://${window.location.hostname || 'localhost'}:7688/ws`;

  if (!transportReady.value) {
    return;
  }

  try {
    await loadConfig();
    webServerPortInput.value = config.value.web_server_port;

    try {
      const status = await invokeWithTimeout<{ running: boolean; port: number }>(
        'web_server_status',
        undefined,
        3_000,
      );
      if (status.running !== config.value.web_server_enabled) {
        await loadConfig();
      }
    } catch {
      // 查询失败不影响其他功能
    }

    try {
      localIps.value = await invokeWithTimeout<string[]>('get_local_ips', undefined, 5_000);
      if (localIps.value.length === 0 || !localIps.value[0].startsWith('127.')) {
        localIps.value.unshift('127.0.0.1');
      }
    } catch {
      // IP 获取失败不影响其他功能
    }
  } catch (e) {
    console.error('加载服务模式设置失败', e);
  }
});

async function saveWsUrl() {
  const url = wsUrlInput.value.trim();
  if (!url) {
    message.error('地址不能为空');
    return;
  }
  wsConnecting.value = true;
  try {
    setCustomWsUrl(url);
    customWsUrl.value = url;
    const ok = await isTransportAvailable();
    if (ok) {
      message.success('连接成功，正在刷新…');
      setTimeout(() => window.location.reload(), 600);
    } else {
      resetWsProbe();
      message.error('连接失败，请检查地址后重试');
    }
  } finally {
    wsConnecting.value = false;
  }
}

function handleClearWsUrl() {
  clearCustomWsUrl();
  customWsUrl.value = '';
  wsUrlInput.value = `ws://${window.location.hostname || 'localhost'}:7688/ws`;
  message.success('已清除，将使用自动探测地址');
}

async function handleWebServerToggle(enabled: boolean) {
  try {
    await setConfig('web_server_enabled', String(enabled));
    if (enabled) {
      const port = await invokeWithTimeout<number>('web_server_start', undefined, 5_000);
      message.success(`Web 服务器已启动，端口: ${port}`);
    } else {
      await invokeWithTimeout('web_server_stop', undefined, 3_000);
      message.success('Web 服务器已停止');
    }
  } catch (e: unknown) {
    message.error(`操作失败: ${e}`);
    await loadConfig();
  }
}

async function pickDistDir() {
  const wasEnabled = config.value.web_server_enabled;
  webServerDistRestarting.value = true;
  try {
    const selected = await invokeWithTimeout<string>('web_server_pick_dist_dir', undefined, 30_000);
    if (!selected) {
      return;
    }
    await setConfig('web_server_dist_path', selected);
    if (wasEnabled) {
      const port = await restartWebServer();
      message.success(`前端目录已保存并重启，端口: ${port}`);
    } else {
      message.success('前端目录已保存');
    }
  } catch (e: unknown) {
    message.error(`选择目录失败: ${e}`);
  } finally {
    webServerDistRestarting.value = false;
  }
}

async function clearDistDir() {
  const wasEnabled = config.value.web_server_enabled;
  webServerDistRestarting.value = true;
  try {
    await setConfig('web_server_dist_path', '');
    if (wasEnabled) {
      const port = await restartWebServer();
      message.success(`前端目录已清除并切回内置资源，端口: ${port}`);
    } else {
      message.success('前端目录已清除');
    }
  } catch (e: unknown) {
    message.error(`清除失败: ${e}`);
  } finally {
    webServerDistRestarting.value = false;
  }
}

async function restartWebServer() {
  return await invokeWithTimeout<number>('web_server_start', undefined, 5_000);
}

async function openInBrowser() {
  const url = `http://localhost:${config.value.web_server_port}`;
  await openUrl(url);
}

async function openUrl(url: string) {
  try {
    const { openUrl: tauriOpenUrl } = await import('@tauri-apps/plugin-opener');
    await tauriOpenUrl(url);
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    message.success('已复制');
  } catch {
    message.error('复制失败');
  }
}

async function saveWebServerPort() {
  const port = webServerPortInput.value;
  if (port === null || !Number.isInteger(port) || port < 1 || port > 65535) {
    message.error('端口号必须为 1 ~ 65535 的整数');
    return;
  }
  try {
    await setConfig('web_server_port', String(port));
    if (config.value.web_server_enabled) {
      await invokeWithTimeout('web_server_stop', undefined, 3_000);
      await new Promise((resolve) => setTimeout(resolve, 400));
      const newPort = await invokeWithTimeout<number>('web_server_start', undefined, 5_000);
      message.success(`端口已更新并重启，新端口: ${newPort}`);
    } else {
      message.success('端口已保存');
    }
  } catch (e: unknown) {
    message.error(`保存失败: ${e}`);
  }
}
</script>

<template>
  <SettingSection title="服务模式" section-id="section-service-mode">
    <SettingItem
      v-if="!hasNativeTransport"
      label="后端 WebSocket 地址"
      desc="浏览器模式下连接 Rust 后端的 WS 地址，保存在本地。留空时自动探测同域 :7688/ws。"
      :vertical="true"
    >
      <div class="service-stack">
        <n-input
          v-model:value="wsUrlInput"
          size="small"
          placeholder="ws://127.0.0.1:7688/ws"
          class="service-input service-input--mono"
          :disabled="wsConnecting"
          @keydown.enter.prevent="saveWsUrl"
        />
        <div class="service-actions">
          <n-button size="small" type="primary" :loading="wsConnecting" @click="saveWsUrl">
            连接
          </n-button>
          <n-button
            v-if="customWsUrl"
            size="small"
            quaternary
            type="warning"
            @click="handleClearWsUrl"
          >
            清除
          </n-button>
        </div>
        <div class="service-hint">当前：{{ customWsUrl || '自动探测（未配置）' }}</div>
      </div>
    </SettingItem>
  </SettingSection>

  <SettingSection
    v-if="transportReady"
    title="Web 服务器（B/S 模式）"
    section-id="section-web-server"
  >
    <SettingItem
      label="启用 Web 服务器"
      desc="开启后可通过浏览器访问全部功能（WebSocket 双向通信）。立即生效，无需重启。默认关闭；服务器环境请使用 CLI `serve` 命令代替。"
    >
      <n-switch
        :value="config.web_server_enabled"
        size="small"
        :loading="savingKey === 'web_server_enabled'"
        @update:value="handleWebServerToggle"
      />
    </SettingItem>

    <SettingItem
      label="监听端口"
      desc="Web 服务器监听端口（1 ~ 65535）。修改并保存后若服务器已启动，会自动重启以使用新端口。"
    >
      <div class="ws-port-row">
        <n-input-number
          v-model:value="webServerPortInput"
          size="small"
          :min="1"
          :max="65535"
          :show-button="false"
          placeholder="7688"
          class="ws-port-input"
          @keydown.enter.prevent="saveWebServerPort"
        />
        <n-button
          size="small"
          :loading="savingKey === 'web_server_port'"
          @click="saveWebServerPort"
        >
          保存
        </n-button>
      </div>
    </SettingItem>

    <SettingItem label="WebSocket 地址" desc="前端通过此地址连接后端（WS 模式）">
      <div class="ws-addr-row">
        <span class="ws-addr">ws://localhost:{{ config.web_server_port }}/ws</span>
        <n-button v-if="config.web_server_enabled" size="small" quaternary @click="openInBrowser">
          在浏览器中打开
        </n-button>
      </div>
    </SettingItem>

    <SettingItem
      label="局域网访问地址"
      desc="同一局域网内其他设备可使用以下地址访问（需开启 Web 服务器）"
      :vertical="true"
    >
      <div class="ws-ip-list">
        <template v-if="localIps.length">
          <div v-for="ip in localIps" :key="ip" class="ws-ip-item">
            <span class="ws-ip-url">http://{{ ip }}:{{ config.web_server_port }}</span>
            <n-button
              v-if="config.web_server_enabled"
              size="tiny"
              quaternary
              @click="openUrl(`http://${ip}:${config.web_server_port}`)"
            >
              打开
            </n-button>
            <n-button
              size="tiny"
              quaternary
              @click="copyToClipboard(`http://${ip}:${config.web_server_port}`)"
            >
              复制
            </n-button>
          </div>
        </template>
        <span v-else class="ws-ip-empty">暂无可用地址</span>
      </div>
    </SettingItem>

    <SettingItem
      v-if="isTauri && !isMobile"
      label="前端文件目录"
      desc="可选指定 Vue 构建产物所在目录。留空时使用当前应用内置前端资源。"
    >
      <div class="ws-dist-row">
        <n-input
          :value="config.web_server_dist_path || ''"
          size="small"
          readonly
          placeholder="未设置，使用内置前端资源"
          class="service-input"
          :title="config.web_server_dist_path || ''"
        />
        <n-button size="small" :loading="webServerDistRestarting" @click="pickDistDir">
          选择
        </n-button>
        <n-button
          v-if="config.web_server_dist_path"
          size="small"
          quaternary
          :disabled="webServerDistRestarting"
          @click="clearDistDir"
        >
          清除
        </n-button>
      </div>
    </SettingItem>
  </SettingSection>
</template>

<style scoped>
.service-stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: min(100%, 520px);
}

.service-input {
  width: min(100%, 420px);
}

.service-input--mono {
  font-family: var(--font-mono, monospace);
}

.service-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.service-hint {
  font-size: var(--fs-12);
  color: var(--color-text-muted);
  word-break: break-all;
}

.ws-port-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.ws-port-input {
  width: 100px;
  font-family: var(--font-mono, monospace);
}

.ws-addr {
  font-family: var(--font-mono, monospace);
  font-size: var(--fs-13);
  color: var(--color-text-soft);
  word-break: break-all;
}

.ws-addr-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.ws-dist-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  max-width: 520px;
  flex-wrap: wrap;
}

.ws-ip-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.ws-ip-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.ws-ip-url {
  font-family: var(--font-mono, monospace);
  font-size: var(--fs-13);
  color: var(--color-text-soft);
  word-break: break-all;
  flex: 1;
  min-width: 0;
}

.ws-ip-empty {
  font-size: var(--fs-13);
  color: var(--color-text-muted);
}

@media (max-width: 640px) {
  .service-stack,
  .service-input,
  .ws-dist-row {
    width: 100%;
    max-width: none;
  }
}
</style>
