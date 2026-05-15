<script setup lang="ts">
import { useMessage } from "naive-ui";
import { storeToRefs } from "pinia";
import { computed, ref, onMounted } from "vue";
import { BUILTIN_USER_AGENT } from "@/composables/useAppConfig";
import { browserProbeClearData } from "@/composables/useBrowserProbe";
import { isTransportAvailable } from "@/composables/useTransport";
import { useAppConfigStore, usePreferencesStore } from "@/stores";
import SettingItem from "./SettingItem.vue";
import SettingSection from "./SettingSection.vue";
import SettingsSubpanel from "./SettingsSubpanel.vue";
import { uaSelectOptions } from "./uaPresets";

const message = useMessage();
const _appCfg = useAppConfigStore();
const { config, savingKey } = storeToRefs(_appCfg);
const { setConfig, resetConfig, loadConfig } = _appCfg;
const prefsStore = usePreferencesStore();
const searchCfg = computed(() => prefsStore.search);

// DoH 服务器预设（分国内 / 国际分组）
const DOH_OPTIONS = [
  { label: "不使用（系统 DNS）", value: "none" },
  {
    type: "group" as const,
    label: "── 国内公共 DNS ──",
    key: "cn",
    children: [
      { label: "阿里云 DNS（223.5.5.5）", value: "alidns" },
      { label: "DNSPod 腾讯（119.29.29.29）", value: "dnspod" },
      { label: "360 安全 DNS（101.226.4.6）", value: "360dns" },
      { label: "OneDNS 点一（117.50.10.10）", value: "onedns" },
    ],
  },
  {
    type: "group" as const,
    label: "── 国际公共 DNS ──",
    key: "intl",
    children: [
      { label: "Cloudflare（1.1.1.1）", value: "cloudflare" },
      { label: "Google（8.8.8.8）", value: "google" },
    ],
  },
];

const uaInput = ref("");
const probeUaInput = ref("");
const selectedPresetUa = ref<string | null>(null);
/** 是否已连接到后端 */
const transportReady = ref(false);

async function handleSet(key: string, value: string) {
  try {
    await setConfig(key, value);
    message.success("已保存");
  } catch (e: unknown) {
    message.error(`保存失败: ${e}`);
  }
}

async function handleReset(key: string) {
  try {
    await resetConfig(key);
    if (key === "http_user_agent") {
      uaInput.value = config.value.http_user_agent;
    }
    if (key === "browser_probe_user_agent") {
      probeUaInput.value = config.value.browser_probe_user_agent;
    }
    message.success("已重置为默认值");
  } catch (e: unknown) {
    message.error(`重置失败: ${e}`);
  }
}

function applyPreset(val: string | null) {
  if (!val) {
    return;
  }
  uaInput.value = val;
  saveUa();
  selectedPresetUa.value = null;
}

function saveUa() {
  handleSet("http_user_agent", uaInput.value.trim() || BUILTIN_USER_AGENT);
}

function saveProbeUa() {
  handleSet("browser_probe_user_agent", probeUaInput.value.trim());
}

async function clearBrowserProbeData() {
  try {
    await browserProbeClearData();
    message.success("已清空浏览器探测数据");
  } catch (e: unknown) {
    message.error(`清空失败: ${e}`);
  }
}

onMounted(async () => {
  transportReady.value = await isTransportAvailable();
  if (!transportReady.value) {
    return;
  }
  try {
    await loadConfig();
    uaInput.value = config.value.http_user_agent;
    probeUaInput.value = config.value.browser_probe_user_agent;
  } catch (e) {
    console.error("加载配置失败", e);
  }
});
</script>

<template>
  <SettingSection
    title="网络"
    section-id="section-network"
    v-if="transportReady"
  >
    <!-- User-Agent -->
    <SettingItem
      label="User-Agent"
      desc="书源脚本未显式设置 UA 时使用此值"
      :vertical="true"
    >
      <SettingsSubpanel
        title="User-Agent 配置"
        description="预设选择、自定义 UA 和当前生效值收纳到二级面板，避免主设置页被超长字符串撑开。"
        action-label="编辑 UA"
      >
        <template #summary>
          <div class="panel-summary">
            <div class="panel-summary__label">当前生效</div>
            <div class="ua-current" :title="config.http_user_agent">
              {{ config.http_user_agent }}
            </div>
          </div>
        </template>

        <div class="ua-panel">
          <div class="ua-panel__label">预设方案</div>
          <n-select
            v-model:value="selectedPresetUa"
            :options="uaSelectOptions"
            placeholder="从预设快速选择..."
            size="small"
            class="ua-select"
            clearable
            @update:value="applyPreset"
          />
          <div class="ua-panel__label">自定义 UA</div>
          <n-input
            v-model:value="uaInput"
            size="small"
            placeholder="自定义 User-Agent，留空使用内置默认"
            class="ua-input"
            @keydown.enter="saveUa"
          />
          <div class="ua-actions">
            <n-button
              size="small"
              type="primary"
              :loading="savingKey === 'http_user_agent'"
              @click="saveUa"
              >保存</n-button
            >
            <n-button
              size="small"
              :loading="savingKey === 'http_user_agent'"
              @click="handleReset('http_user_agent')"
              >重置</n-button
            >
          </div>
        </div>
        <div class="ua-current-card">
          <div class="ua-current-card__label">当前生效</div>
          <div class="ua-current" :title="config.http_user_agent">
            {{ config.http_user_agent }}
          </div>
        </div>
      </SettingsSubpanel>
    </SettingItem>

    <SettingItem
      label="浏览器探测"
      desc="用于动态网站、登录验证和 JS 渲染页面。探测 WebView 使用独立 profile，与主界面隔离。"
      :vertical="true"
    >
      <SettingsSubpanel
        title="浏览器探测配置"
        description="窗口显示、调试强制可见、独立 profile、探测专用 UA 和超时统一收纳到二级面板。"
        action-label="打开探测配置"
      >
        <template #summary>
          <div class="panel-summary">
            <div>启用：{{ config.browser_probe_enabled ? "是" : "否" }}</div>
            <div>
              探测 UA：{{ config.browser_probe_user_agent || "跟随 HTTP UA" }}
            </div>
            <div>默认超时：{{ config.browser_probe_timeout_secs || 0 }} 秒</div>
          </div>
        </template>

        <div class="probe-panel">
          <div class="probe-row">
            <span>启用浏览器探测</span>
            <n-switch
              :value="config.browser_probe_enabled"
              :loading="savingKey === 'browser_probe_enabled'"
              @update:value="
                (v: boolean) => handleSet('browser_probe_enabled', String(v))
              "
            />
          </div>
          <div class="probe-row">
            <span>默认显示窗口</span>
            <n-switch
              :value="config.browser_probe_visible_by_default"
              :loading="savingKey === 'browser_probe_visible_by_default'"
              @update:value="
                (v: boolean) =>
                  handleSet('browser_probe_visible_by_default', String(v))
              "
            />
          </div>
          <div class="probe-row">
            <span>调试：强制显示隐藏窗口</span>
            <n-switch
              :value="config.browser_probe_force_visible"
              :loading="savingKey === 'browser_probe_force_visible'"
              @update:value="
                (v: boolean) =>
                  handleSet('browser_probe_force_visible', String(v))
              "
            />
          </div>
          <div class="probe-hint">
            开启后，书源脚本传入 visible:false
            的探测会话也会弹出窗口；用于观察跳转、验证码和页面脚本执行过程。
          </div>
          <div class="probe-row">
            <span>持久化独立 profile</span>
            <n-switch
              :value="config.browser_probe_persist_profile"
              :loading="savingKey === 'browser_probe_persist_profile'"
              @update:value="
                (v: boolean) =>
                  handleSet('browser_probe_persist_profile', String(v))
              "
            />
          </div>
          <div class="probe-field">
            <div class="ua-panel__label">探测 UA（留空跟随 HTTP UA）</div>
            <n-input
              v-model:value="probeUaInput"
              size="small"
              placeholder="留空则使用上方 HTTP User-Agent"
              class="ua-input"
              @keydown.enter="saveProbeUa"
            />
            <div class="ua-actions">
              <n-button
                size="small"
                type="primary"
                :loading="savingKey === 'browser_probe_user_agent'"
                @click="saveProbeUa"
                >保存</n-button
              >
              <n-button
                size="small"
                :loading="savingKey === 'browser_probe_user_agent'"
                @click="handleReset('browser_probe_user_agent')"
                >重置</n-button
              >
            </div>
          </div>
          <div class="probe-row">
            <span>默认超时（0 = 跟随引擎超时）</span>
            <div style="display: flex; gap: 6px; align-items: center">
              <n-input-number
                :value="config.browser_probe_timeout_secs"
                size="small"
                :min="0"
                :max="600"
                style="width: 90px"
                @update:value="
                  (v: number | null) =>
                    v != null &&
                    handleSet('browser_probe_timeout_secs', String(v))
                "
              />
              <span class="unit-label">秒</span>
            </div>
          </div>
          <n-button
            size="small"
            type="warning"
            ghost
            @click="clearBrowserProbeData"
          >
            清空探测浏览器数据
          </n-button>
        </div>
      </SettingsSubpanel>
    </SettingItem>

    <!-- 连接超时 -->
    <SettingItem label="连接超时" desc="HTTP 连接超时时间（秒）">
      <div style="display: flex; gap: 6px; align-items: center">
        <n-input-number
          :value="config.http_connect_timeout_secs"
          size="small"
          :min="1"
          :max="300"
          style="width: 90px"
          @update:value="
            (v: number | null) =>
              v != null && handleSet('http_connect_timeout_secs', String(v))
          "
        />
        <span class="unit-label">秒</span>
      </div>
    </SettingItem>

    <!-- 全局最小请求延迟 -->
    <SettingItem
      label="全局最小请求延迟"
      desc="两次书源请求之间的最小间隔时间（毫秒）。书源 @minDelay 与此值取最大值生效，防止高频访问被拉黑。0 = 不限制。"
    >
      <div style="display: flex; gap: 6px; align-items: center">
        <n-input-number
          :value="config.request_min_delay_ms"
          size="small"
          :min="0"
          :max="60000"
          :step="100"
          style="width: 100px"
          @update:value="
            (v: number | null) =>
              v != null && handleSet('request_min_delay_ms', String(v))
          "
        />
        <span class="unit-label">毫秒</span>
      </div>
    </SettingItem>

    <!-- 引擎执行超时 -->
    <SettingItem label="引擎超时" desc="书源脚本引擎执行总超时时间（秒）">
      <div style="display: flex; gap: 6px; align-items: center">
        <n-input-number
          :value="config.engine_timeout_secs"
          size="small"
          :min="5"
          :max="600"
          style="width: 90px"
          @update:value="
            (v: number | null) =>
              v != null && handleSet('engine_timeout_secs', String(v))
          "
        />
        <span class="unit-label">秒</span>
      </div>
    </SettingItem>

    <!-- 搜索超时 -->
    <SettingItem
      label="搜索超时"
      desc="单个书源搜索请求的最长等待时间，超时后该书源标记为失败（秒），默认 35"
    >
      <div style="display: flex; gap: 6px; align-items: center">
        <n-input-number
          :value="searchCfg.searchTimeoutSecs ?? 35"
          size="small"
          :min="5"
          :max="300"
          style="width: 90px"
          @update:value="
            (v: number | null) =>
              prefsStore.patchSearch({
                searchTimeoutSecs: Math.max(5, v ?? 35),
              })
          "
        />
        <span class="unit-label">秒</span>
      </div>
    </SettingItem>

    <!-- 发现页超时 -->
    <SettingItem
      label="发现页超时"
      desc="书源发现页（Explore）加载的最长等待时间（秒），默认 35"
    >
      <div style="display: flex; gap: 6px; align-items: center">
        <n-input-number
          :value="searchCfg.exploreTimeoutSecs ?? 35"
          size="small"
          :min="5"
          :max="300"
          style="width: 90px"
          @update:value="
            (v: number | null) =>
              prefsStore.patchSearch({
                exploreTimeoutSecs: Math.max(5, v ?? 35),
              })
          "
        />
        <span class="unit-label">秒</span>
      </div>
    </SettingItem>

    <!-- 目录更新超时 -->
    <SettingItem
      label="目录更新超时"
      desc="获取书籍章节列表的最长等待时间，长篇小说可能需要更长时间（秒），默认 125"
    >
      <div style="display: flex; gap: 6px; align-items: center">
        <n-input-number
          :value="searchCfg.chapterListTimeoutSecs ?? 125"
          size="small"
          :min="10"
          :max="600"
          style="width: 90px"
          @update:value="
            (v: number | null) =>
              prefsStore.patchSearch({
                chapterListTimeoutSecs: Math.max(10, v ?? 125),
              })
          "
        />
        <span class="unit-label">秒</span>
      </div>
    </SettingItem>

    <!-- 章节正文超时 -->
    <SettingItem
      label="章节正文超时"
      desc="获取单章节正文内容的最长等待时间（秒），默认 35"
    >
      <div style="display: flex; gap: 6px; align-items: center">
        <n-input-number
          :value="searchCfg.chapterContentTimeoutSecs ?? 35"
          size="small"
          :min="5"
          :max="300"
          style="width: 90px"
          @update:value="
            (v: number | null) =>
              prefsStore.patchSearch({
                chapterContentTimeoutSecs: Math.max(5, v ?? 35),
              })
          "
        />
        <span class="unit-label">秒</span>
      </div>
    </SettingItem>

    <!-- 忽略 TLS 证书错误 -->
    <SettingItem
      label="忽略 TLS 证书错误"
      desc="规避 Android 对部分有效证书误判为 Revoked 的兼容问题。降低安全性，修改后需重启生效。"
    >
      <div
        style="
          display: flex;
          flex-direction: column;
          gap: 6px;
          align-items: flex-start;
        "
      >
        <n-switch
          :value="config.http_ignore_tls_errors"
          :loading="savingKey === 'http_ignore_tls_errors'"
          @update:value="
            (v: boolean) => handleSet('http_ignore_tls_errors', String(v))
          "
        />
        <n-alert
          v-if="config.http_ignore_tls_errors"
          type="warning"
          :show-icon="true"
          style="font-size: 0.75rem; padding: 4px 8px"
        >
          已跳过证书验证，连接安全性降低，仅在必要时开启
        </n-alert>
        <span
          style="
            font-size: 0.72rem;
            color: var(--color-text-muted);
            display: flex;
            align-items: center;
            gap: 3px;
          "
          >↺ 重启后生效</span
        >
      </div>
    </SettingItem>

    <!-- DNS-over-HTTPS -->
    <SettingItem
      label="DNS-over-HTTPS"
      desc="使用加密 DNS 查询，绕过系统 DNS 劫持或污染。修改后需重启生效。"
    >
      <div
        style="
          display: flex;
          flex-direction: column;
          gap: 6px;
          align-items: flex-start;
        "
      >
        <n-select
          :value="config.http_doh_server"
          :options="DOH_OPTIONS"
          size="small"
          style="width: 220px"
          :loading="savingKey === 'http_doh_server'"
          @update:value="(v: string) => handleSet('http_doh_server', v)"
        />
        <div style="display: flex; align-items: center; gap: 8px">
          <span style="font-size: 0.72rem; color: var(--color-text-muted)"
            >↺ 重启后生效</span
          >
        </div>
      </div>
    </SettingItem>

    <!-- 代理设置 -->
    <SettingItem
      label="代理设置"
      desc="HTTP/SOCKS5 代理，影响书源请求与漫画下载。修改后需重启生效。"
      :vertical="true"
    >
      <SettingsSubpanel
        title="代理配置"
        description="代理设置影响所有书源 HTTP 请求和漫画下载。修改后需重启应用生效。"
        action-label="编辑代理"
      >
        <template #summary>
          <div class="panel-summary">
            <div>
              模式：{{
                config.proxy_mode === "system"
                  ? "系统代理"
                  : config.proxy_mode === "none"
                    ? "无代理"
                    : `自定义（${config.proxy_type.toUpperCase()}）`
              }}
            </div>
            <div v-if="config.proxy_mode === 'custom'">
              地址：{{ config.proxy_host || "未设置" }}:{{
                config.proxy_port || "-"
              }}
            </div>
          </div>
        </template>

        <div class="proxy-panel">
          <!-- 模式选择 -->
          <div class="proxy-panel__label">代理模式</div>
          <n-radio-group
            :value="config.proxy_mode"
            @update:value="(v: string) => handleSet('proxy_mode', v)"
          >
            <n-space>
              <n-radio value="system">系统代理</n-radio>
              <n-radio value="none">无代理</n-radio>
              <n-radio value="custom">自定义</n-radio>
            </n-space>
          </n-radio-group>

          <!-- 自定义代理详细配置 -->
          <template v-if="config.proxy_mode === 'custom'">
            <div class="proxy-panel__label" style="margin-top: 12px">
              代理类型
            </div>
            <n-radio-group
              :value="config.proxy_type"
              @update:value="(v: string) => handleSet('proxy_type', v)"
            >
              <n-space>
                <n-radio value="http">HTTP</n-radio>
                <n-radio value="socks5">SOCKS5</n-radio>
              </n-space>
            </n-radio-group>

            <div class="proxy-panel__label" style="margin-top: 12px">
              代理地址
            </div>
            <div class="proxy-host-row">
              <n-input
                :value="config.proxy_host"
                size="small"
                placeholder="主机名或 IP，如 127.0.0.1"
                class="proxy-host-input"
                @update:value="(v: string) => handleSet('proxy_host', v)"
              />
              <span class="proxy-colon">:</span>
              <n-input-number
                :value="config.proxy_port"
                size="small"
                :min="1"
                :max="65535"
                placeholder="端口"
                style="width: 90px"
                @update:value="
                  (v: number | null) =>
                    v != null && handleSet('proxy_port', String(v))
                "
              />
            </div>

            <div class="proxy-panel__label" style="margin-top: 12px">
              认证（可选）
            </div>
            <div class="proxy-auth-row">
              <n-input
                :value="config.proxy_username"
                size="small"
                placeholder="用户名（可留空）"
                style="flex: 1"
                @update:value="(v: string) => handleSet('proxy_username', v)"
              />
              <n-input
                :value="config.proxy_password"
                size="small"
                type="password"
                show-password-on="click"
                placeholder="密码（可留空）"
                style="flex: 1"
                @update:value="(v: string) => handleSet('proxy_password', v)"
              />
            </div>
          </template>

          <n-alert
            type="info"
            :show-icon="false"
            style="margin-top: 12px; font-size: 0.75rem"
          >
            修改代理设置后需重启应用生效，效果与忽略 TLS 证书设置相同。
          </n-alert>
        </div>
      </SettingsSubpanel>
    </SettingItem>
  </SettingSection>
</template>

<style scoped>
.ua-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-hover);
}

.ua-panel__label {
  font-size: var(--fs-12);
  font-weight: var(--fw-semibold);
  color: var(--color-text-soft);
}

.ua-select,
.ua-input {
  width: 100%;
}

.ua-actions {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.ua-input {
  font-family: var(--font-mono, monospace);
  font-size: var(--fs-12);
}

.ua-current-card {
  width: 100%;
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.ua-current-card__label {
  font-size: var(--fs-12);
  font-weight: var(--fw-semibold);
  color: var(--color-text-soft);
  margin-bottom: 6px;
}

.panel-summary {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.panel-summary__label {
  font-size: var(--fs-12);
  font-weight: var(--fw-semibold);
  color: var(--color-text-soft);
}

.ua-current {
  display: block;
  font-size: var(--fs-12);
  color: var(--color-text);
  font-family: var(--font-mono, monospace);
  line-height: 1.6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0.96;
}

.probe-panel {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.probe-row {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  align-items: center;
  font-size: 0.82rem;
  color: var(--color-text);
}

.probe-hint {
  margin-top: -6px;
  font-size: 0.74rem;
  line-height: var(--lh-base);
  color: var(--color-text-muted);
}

.probe-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.unit-label {
  font-size: var(--fs-12);
  color: var(--color-text-muted);
}

.ws-url-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.ws-url-display {
  font-family: var(--font-mono, monospace);
  font-size: var(--fs-13);
  color: var(--color-text-soft);
  word-break: break-all;
}

.ws-url-edit-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  width: 100%;
}

.ws-url-input {
  flex: 1;
  min-width: 180px;
  font-family: var(--font-mono, monospace);
  font-size: var(--fs-13);
}

.proxy-panel {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.proxy-panel__label {
  font-size: var(--fs-12);
  font-weight: var(--fw-semibold);
  color: var(--color-text-soft);
}

.proxy-host-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.proxy-host-input {
  flex: 1;
  font-family: var(--font-mono, monospace);
  font-size: var(--fs-13);
}

.proxy-colon {
  font-size: 0.9rem;
  color: var(--color-text-muted);
}

.proxy-auth-row {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}
</style>
