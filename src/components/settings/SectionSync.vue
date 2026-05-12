<script setup lang="ts">
import { useDialog, useMessage } from 'naive-ui';
import { storeToRefs } from 'pinia';
import QRCode from 'qrcode';
import { computed, onMounted, ref } from 'vue';
import { useOverlayBackstack } from '@/composables/useOverlayBackstack';
import {
  useSync,
  type SyncConflict,
  type SyncStatus,
  type SyncQrPayload,
} from '@/composables/useSync';
import { useAppConfigStore } from '@/stores';
import SettingItem from './SettingItem.vue';
import SettingSection from './SettingSection.vue';

const message = useMessage();
const dialog = useDialog();
const _appCfg = useAppConfigStore();
const { config, savingKey } = storeToRefs(_appCfg);
const { setConfig, loadConfig } = _appCfg;
const sync = useSync();

const password = ref('');
const status = ref<SyncStatus | null>(null);
const conflicts = ref<SyncConflict[]>([]);
const syncing = ref(false);
const testing = ref(false);
const qrVisible = ref(false);
const qrDataUrl = ref('');
const qrRawText = ref('');
const scanVisible = ref(false);
const videoRef = ref<HTMLVideoElement | null>(null);

const providerOptions = [
  { label: 'WebDAV', value: 'webdav' },
  { label: 'FTP', value: 'ftp' },
  { label: '百度网盘', value: 'baidu_netdisk' },
];

useOverlayBackstack(() => qrVisible.value, closeQr);
useOverlayBackstack(
  () => scanVisible.value,
  () => {
    scanVisible.value = false;
  },
);

const scopeOptions = [
  { label: '系统设置', key: 'sync_scope_app_settings' },
  { label: '书源文件', key: 'sync_scope_booksources' },
  { label: '插件文件', key: 'sync_scope_extensions' },
  { label: '书架', key: 'sync_scope_bookshelf' },
  { label: '单书设置', key: 'sync_scope_reader_settings' },
  { label: '阅读位置', key: 'sync_scope_reading_progress' },
] as const;

const enabledScopeKeys = computed({
  get() {
    return scopeOptions.filter((item) => Boolean(config.value[item.key])).map((item) => item.key);
  },
  set(keys: string[]) {
    for (const item of scopeOptions) {
      void handleSet(item.key, String(keys.includes(item.key)));
    }
  },
});

function formatTime(ts: number) {
  if (!ts) {
    return '从未';
  }
  return new Date(ts).toLocaleString();
}

async function refresh() {
  try {
    status.value = await sync.getStatus();
    conflicts.value = (await sync.listConflicts()).filter((item) => !item.resolved);
  } catch {
    /* 未启用或未连接时不打断设置页 */
  }
}

async function handleSet(key: string, value: string) {
  try {
    await setConfig(key, value);
    if (key.startsWith('sync_')) {
      await refresh();
    }
  } catch (e: unknown) {
    message.error(`保存失败: ${e}`);
  }
}

async function saveCredentials() {
  await sync.setCredentials(password.value);
  message.success('同步密码已保存到本机同步配置');
}

async function clearSyncCredentials() {
  await sync.clearCredentials();
  password.value = '';
  message.success('同步密码已清除');
}

async function testConnection() {
  testing.value = true;
  try {
    if (password.value) {
      await sync.setCredentials(password.value);
    }
    const result = await sync.testConnection(password.value || undefined);
    if (result.ok) {
      message.success(result.message);
    } else {
      message.error(result.message);
    }
  } catch (e: unknown) {
    message.error(`连接测试失败: ${e}`);
  } finally {
    testing.value = false;
  }
}

async function runSync(mode: 'sync' | 'pull' | 'push', strategy?: 'local' | 'remote') {
  syncing.value = true;
  try {
    const result = await sync.syncNow(mode, strategy);
    if (result.status === 'conflict') {
      message.warning(result.message);
    } else {
      message.success(result.message);
    }
    await refresh();
  } catch (e: unknown) {
    message.error(`同步失败: ${e}`);
  } finally {
    syncing.value = false;
  }
}

async function showQr() {
  dialog.warning({
    title: '确认生成明文同步二维码',
    content:
      '二维码会包含 WebDAV 密码或 Token。任何看到二维码或截图的人都能获得同步账号。确认只在可信环境中展示。',
    positiveText: '生成',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        const payload = await sync.generateQrPayload();
        qrRawText.value = JSON.stringify(payload);
        qrDataUrl.value = await QRCode.toDataURL(qrRawText.value, {
          errorCorrectionLevel: 'M',
          margin: 1,
        });
        qrVisible.value = true;
      } catch (e: unknown) {
        message.error(`生成失败: ${e}`);
      }
    },
  });
}

function closeQr() {
  qrVisible.value = false;
  qrDataUrl.value = '';
  qrRawText.value = '';
}

async function copyQrText() {
  if (!qrRawText.value) {
    return;
  }
  try {
    await navigator.clipboard.writeText(qrRawText.value);
    message.success('同步配置字符串已复制');
  } catch (e: unknown) {
    message.error(`复制失败: ${e}`);
  }
}

async function startScan() {
  scanVisible.value = true;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  if (!videoRef.value) {
    return;
  }
  try {
    const payload = await sync.scanQrFromVideo(videoRef.value);
    await importPayload(payload);
    scanVisible.value = false;
  } catch (e: unknown) {
    message.error(`扫码失败: ${e}`);
  }
}

async function importPayload(payload: SyncQrPayload) {
  await sync.importQrPayload(payload);
  await loadConfig();
  await refresh();
  message.success('已导入同步配置');
}

async function importQrText(raw: string) {
  const payload = JSON.parse(raw) as SyncQrPayload;
  await importPayload(payload);
}

function promptImportText() {
  const raw = window.prompt('粘贴同步配置二维码内容');
  if (!raw) {
    return;
  }
  importQrText(raw).catch((e) => message.error(`导入失败: ${e}`));
}

onMounted(async () => {
  await loadConfig();
  const credentials = await sync.getCredentials().catch(() => ({ password: '' }));
  password.value = credentials.password;
  await refresh();
});
</script>

<template>
  <SettingSection title="跨设备同步" section-id="section-sync">
    <SettingItem label="启用同步" desc="使用 WebDAV / FTP / 百度网盘同步小文件数据">
      <n-switch
        :value="config.sync_enabled"
        :loading="savingKey === 'sync_enabled'"
        @update:value="(v: boolean) => handleSet('sync_enabled', String(v))"
      />
    </SettingItem>

    <SettingItem
      label="驱动与同步范围"
      desc="同步协议采用小文件模型；书源和插件只同步文件，不同步各自设置。"
      :vertical="true"
    >
      <div class="sync-panel-stack">
        <SettingItem label="同步驱动">
          <n-select
            :value="config.sync_provider"
            size="small"
            :options="providerOptions"
            @update:value="(v: string) => handleSet('sync_provider', v)"
          />
        </SettingItem>

        <SettingItem
          label="WebDAV 地址"
          desc="例如 https://dav.example.com/remote.php/dav/files/user"
          v-if="config.sync_provider === 'webdav'"
        >
          <n-input
            :value="config.sync_webdav_url"
            size="small"
            placeholder="https://..."
            @update:value="(v: string) => handleSet('sync_webdav_url', v.trim())"
          />
        </SettingItem>

        <SettingItem label="账号" v-if="config.sync_provider === 'webdav'">
          <n-input
            :value="config.sync_webdav_username"
            size="small"
            placeholder="用户名"
            @update:value="(v: string) => handleSet('sync_webdav_username', v.trim())"
          />
        </SettingItem>

        <SettingItem
          label="密码 / Token"
          desc="当前实现存储在本机同步目录；生成二维码时会明文包含此值"
        >
          <n-input
            v-model:value="password"
            size="small"
            type="password"
            show-password-on="click"
            placeholder="WebDAV 密码或应用 Token"
          />
          <n-button size="small" @click="saveCredentials">保存</n-button>
          <n-button size="small" type="warning" @click="clearSyncCredentials">清除</n-button>
        </SettingItem>

        <SettingItem
          label="远端目录"
          desc="当前 WebDAV 可用；FTP / 百度网盘驱动入口已预留，真实连接实现继续接入中"
        >
          <n-input
            :value="config.sync_webdav_root_dir"
            size="small"
            @update:value="
              (v: string) => handleSet('sync_webdav_root_dir', v.trim() || 'legado-sync')
            "
          />
          <n-switch
            :value="config.sync_webdav_allow_http"
            :loading="savingKey === 'sync_webdav_allow_http'"
            @update:value="(v: boolean) => handleSet('sync_webdav_allow_http', String(v))"
          />
          <span class="sync-inline-hint">允许 HTTP</span>
        </SettingItem>

        <SettingItem label="同步范围" :vertical="true">
          <n-checkbox-group v-model:value="enabledScopeKeys">
            <n-space>
              <n-checkbox v-for="item in scopeOptions" :key="item.key" :value="item.key">
                {{ item.label }}
              </n-checkbox>
            </n-space>
          </n-checkbox-group>
        </SettingItem>

        <SettingItem label="自动触发" desc="移动端默认只建议启动和回前台同步">
          <n-switch
            :value="config.sync_trigger_on_startup"
            @update:value="(v: boolean) => handleSet('sync_trigger_on_startup', String(v))"
          />
          <span class="sync-inline-hint">启动</span>
          <n-switch
            :value="config.sync_trigger_on_resume"
            @update:value="(v: boolean) => handleSet('sync_trigger_on_resume', String(v))"
          />
          <span class="sync-inline-hint">回前台</span>
          <n-switch
            :value="config.sync_mobile_wifi_only"
            @update:value="(v: boolean) => handleSet('sync_mobile_wifi_only', String(v))"
          />
          <span class="sync-inline-hint">Wi-Fi 优先</span>
        </SettingItem>
      </div>
    </SettingItem>

    <SettingItem
      label="当前状态"
      :desc="`上次成功：${formatTime(status?.lastSuccessAt ?? 0)}；冲突：${status?.conflictCount ?? 0}`"
    >
      <n-button size="small" :loading="testing" @click="testConnection">测试连接</n-button>
      <n-button size="small" type="primary" :loading="syncing" @click="runSync('sync')">
        立即同步
      </n-button>
      <n-button size="small" :loading="syncing" @click="runSync('pull')">仅拉取</n-button>
      <n-button size="small" :loading="syncing" @click="runSync('push')">仅推送</n-button>
    </SettingItem>

    <SettingItem
      label="首次冲突处理"
      desc="如果首次同步检测到冲突，可选择服务器或本地作为冲突项来源"
    >
      <n-button
        size="small"
        type="warning"
        :disabled="!conflicts.length"
        @click="runSync('sync', 'remote')"
      >
        保留服务器
      </n-button>
      <n-button
        size="small"
        type="warning"
        :disabled="!conflicts.length"
        @click="runSync('sync', 'local')"
      >
        保留本地
      </n-button>
      <n-button size="small" @click="refresh">刷新冲突</n-button>
    </SettingItem>

    <SettingItem label="二维码配置" desc="扫码可复制完整同步配置，包括明文密码或 Token">
      <n-button size="small" @click="showQr">生成二维码</n-button>
      <n-button size="small" @click="startScan">扫码导入</n-button>
      <n-button size="small" quaternary @click="promptImportText">粘贴导入</n-button>
    </SettingItem>

    <div v-if="conflicts.length" class="sync-conflicts">
      <div v-for="item in conflicts" :key="item.id" class="sync-conflict-item">
        <span>{{ item.domain }} / {{ item.key }}</span>
        <span>{{ item.message }}</span>
      </div>
    </div>

    <n-modal v-model:show="qrVisible" preset="card" title="同步配置二维码" class="sync-modal">
      <p class="sync-risk">此二维码包含明文 WebDAV 密码或 Token。不要截图发送给不可信的人。</p>
      <img v-if="qrDataUrl" :src="qrDataUrl" alt="同步配置二维码" class="sync-qr" />
      <div v-if="qrRawText" class="sync-qr-raw">
        <div class="sync-qr-raw__head">
          <span class="sync-qr-raw__title">同步配置字符串</span>
          <n-button size="tiny" quaternary @click="copyQrText">复制字符串</n-button>
        </div>
        <n-input
          :value="qrRawText"
          type="textarea"
          readonly
          :autosize="{ minRows: 4, maxRows: 8 }"
          class="sync-qr-raw__input app-scrollbar"
        />
      </div>
      <template #footer>
        <n-button @click="closeQr">关闭并清空</n-button>
      </template>
    </n-modal>

    <n-modal v-model:show="scanVisible" preset="card" title="扫码导入同步配置" class="sync-modal">
      <video ref="videoRef" class="sync-video" muted playsinline />
    </n-modal>
  </SettingSection>
</template>

<style scoped>
.sync-inline-hint {
  font-size: var(--fs-12);
  color: var(--color-text-muted);
}

.sync-panel-stack {
  display: flex;
  flex-direction: column;
}

.sync-conflicts {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 0;
}

.sync-conflict-item {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-1);
  font-size: var(--fs-12);
  color: var(--color-text-soft);
}

.sync-modal {
  width: min(560px, calc(100vw - 48px));
}

.sync-modal :deep(.n-card) {
  width: 100%;
  max-width: none;
}

.sync-risk {
  margin: 0 0 var(--space-3);
  color: var(--color-text-soft);
  font-size: var(--fs-13);
  line-height: var(--lh-base);
}

.sync-qr {
  display: block;
  width: min(320px, 100%);
  margin: 0 auto;
}

.sync-qr-raw {
  margin-top: 16px;
}

.sync-qr-raw__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-2);
}

.sync-qr-raw__title {
  font-size: var(--fs-13);
  font-weight: var(--fw-semibold);
  color: var(--color-text);
}

.sync-qr-raw__input {
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
}

.sync-video {
  width: 100%;
  min-height: 260px;
  background: #000;
  border-radius: var(--radius-1);
}

@media (max-width: 640px) {
  .sync-modal {
    width: calc(100vw - 24px);
  }

  .sync-qr-raw__head {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
