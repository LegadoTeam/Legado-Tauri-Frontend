/** * SectionAbout — 设置页“关于”面板，展示应用版本、运行环境、桥接能力与 WebView 诊断信息。 */

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  hasNativeTransport,
  isHarmonyNative,
  isTauri,
  isMobile,
  envLabel,
  platform,
} from '@/composables/useEnv';
import { getCustomWsUrl, getTransportType, isTransportAvailable } from '@/composables/useTransport';
import packageJson from '../../../package.json';
import tauriConfig from '../../../src-tauri/tauri.conf.json';
import SettingSection from './SettingSection.vue';

type TransportMode = 'tauri' | 'harmony' | 'websocket' | 'none';

const transportMode = ref<TransportMode>(getTransportType());
const transportReady = ref(hasNativeTransport);

const rawUserAgent = ref('读取中');

const contributors = [
  'Mg',
  '丽拓朝夕',
  '喵公子',
  '聚.散',
  '杯呗is me',
  "I'm yours",
  '凉子',
  '目目',
];

const runtimeModeLabel = computed(() => {
  switch (transportMode.value) {
    case 'tauri':
      return 'Tauri IPC';
    case 'harmony':
      return 'Harmony 桥接';
    case 'websocket':
      return 'WebSocket';
    default:
      return '未连接';
  }
});

const runtimeModeDesc = computed(() => {
  switch (transportMode.value) {
    case 'tauri':
      return '当前工作在桌面原生壳内，前端通过 Tauri IPC 直连 Rust 命令。';
    case 'harmony':
      return '当前工作在 Harmony 原生壳内，前端通过原生桥接访问宿主能力。';
    case 'websocket':
      return '当前工作在 Web / WS 模式，前端通过 WebSocket 与后端服务通信。';
    default:
      return '当前未检测到可用宿主传输，仅能进行静态界面预览。';
  }
});

const runtimeTagType = computed(() => {
  if (!transportReady.value) {
    return 'warning';
  }
  return transportMode.value === 'websocket' ? 'info' : 'success';
});

const wsEndpoint = computed(() => {
  if (transportMode.value !== 'websocket') {
    return '未使用';
  }
  return getCustomWsUrl() || '同源 WebSocket 自动探测';
});

const detectWebViewVersion = (ua: string) => {
  const harmonyWebView = ua.match(/ArkWeb\/([^\s]+)/i);
  if (harmonyWebView) {
    return `ArkWeb ${harmonyWebView[1]}`;
  }

  const edge = ua.match(/Edg\/([^\s]+)/i);
  if (edge) {
    return `Edge WebView2 ${edge[1]}`;
  }

  const webview = ua.match(/Version\/([^\s]+).*Chrome\/([^\s]+).*Mobile Safari/i);
  if (webview) {
    return `Android WebView / Chromium ${webview[2]}`;
  }

  const chrome = ua.match(/(?:Chrome|Chromium|CriOS)\/([^\s]+)/i);
  if (chrome) {
    return `Chromium ${chrome[1]}`;
  }

  const safari = ua.match(/Version\/([^\s]+).*Safari\/([^\s]+)/i);
  if (safari) {
    return `WebKit / Safari ${safari[1]}`;
  }

  return '未能从 UA 识别';
};

const webViewVersion = computed(() => detectWebViewVersion(rawUserAgent.value));

const environmentCards = computed(() => [
  {
    label: '运行环境',
    value: envLabel,
    desc: runtimeModeDesc.value,
  },
  {
    label: '通信模式',
    value: runtimeModeLabel.value,
    desc: transportReady.value ? '当前传输层已可用。' : '当前传输层不可用。',
  },
  {
    label: '操作系统',
    value: platform.value || '未知',
    desc: isMobile.value ? '当前为移动端布局。' : '当前为桌面端布局。',
  },
  {
    label: 'WebView / 内核',
    value: webViewVersion.value,
    desc: '由当前页面原始 UA 解析，完整字段见下方诊断信息。',
  },
]);

const uaRows = computed(() => [
  {
    label: '系统原始 UA',
    value: rawUserAgent.value,
    desc: '本软件当前运行环境上报的原始 User-Agent，可用于查看系统 WebView 或浏览器内核版本。',
  },
]);

function collectUserAgentInfo() {
  if (typeof navigator === 'undefined') {
    rawUserAgent.value = '当前环境没有 navigator';
    return;
  }

  rawUserAgent.value = navigator.userAgent || '空';
}

onMounted(async () => {
  collectUserAgentInfo();
  transportReady.value = await isTransportAvailable();
  transportMode.value = getTransportType();
});
</script>

<template>
  <SettingSection title="关于" section-id="section-about">
    <div class="about-hero">
      <div class="about-hero__copy">
        <div class="about-hero__eyebrow">Legado Tauri</div>
        <h3 class="about-hero__title">跨端阅读应用运行概览</h3>
        <p class="about-hero__desc">
          当前页聚合应用版本、运行模式、桥接能力和软件贡献者，便于快速确认当前环境到底跑在
          Tauri、Harmony 还是 Web / WS 模式。
        </p>
      </div>
      <div class="about-hero__chips">
        <n-tag size="small" :bordered="false">前端 {{ packageJson.version }}</n-tag>
        <n-tag size="small" :bordered="false" type="info">桌面壳 {{ tauriConfig.version }}</n-tag>
        <n-tag size="small" :bordered="false" :type="runtimeTagType as any">
          {{ runtimeModeLabel }}
        </n-tag>
      </div>
    </div>

    <div class="about-runtime-grid">
      <div v-for="item in environmentCards" :key="item.label" class="about-card">
        <span class="about-label">{{ item.label }}</span>
        <strong class="about-card__value">{{ item.value }}</strong>
        <p class="about-card__desc">{{ item.desc }}</p>
      </div>
    </div>

    <div class="about-panel about-panel--ua">
      <div class="about-panel__head">
        <h4 class="about-panel__title">系统原始 UA</h4>
        <span class="about-panel__hint">当前软件运行环境</span>
      </div>
      <div class="about-ua-list">
        <div v-for="item in uaRows" :key="item.label" class="about-ua-row">
          <div class="about-ua-row__meta">
            <span class="about-badge-row__label">{{ item.label }}</span>
            <p>{{ item.desc }}</p>
          </div>
          <pre class="about-ua-row__value">{{ item.value }}</pre>
        </div>
      </div>
    </div>

    <div class="about-panels">
      <div class="about-panel">
        <div class="about-panel__head">
          <h4 class="about-panel__title">桥接能力</h4>
          <span class="about-panel__hint">当前宿主能力检测</span>
        </div>
        <div class="about-badges">
          <div class="about-badge-row">
            <span class="about-badge-row__label">Tauri 原生壳</span>
            <n-tag size="small" :type="isTauri ? 'success' : 'default'" :bordered="false">
              {{ isTauri ? '可用' : '未启用' }}
            </n-tag>
          </div>
          <div class="about-badge-row">
            <span class="about-badge-row__label">Harmony 原生桥接</span>
            <n-tag size="small" :type="isHarmonyNative ? 'success' : 'default'" :bordered="false">
              {{ isHarmonyNative ? '可用' : '未启用' }}
            </n-tag>
          </div>
          <div class="about-badge-row">
            <span class="about-badge-row__label">原生传输</span>
            <n-tag
              size="small"
              :type="hasNativeTransport ? 'success' : 'default'"
              :bordered="false"
            >
              {{ hasNativeTransport ? '直连宿主' : '浏览器环境' }}
            </n-tag>
          </div>
          <div class="about-badge-row">
            <span class="about-badge-row__label">WebSocket 入口</span>
            <n-tag
              size="small"
              :type="transportMode === 'websocket' ? 'info' : 'default'"
              :bordered="false"
            >
              {{ wsEndpoint }}
            </n-tag>
          </div>
        </div>
      </div>

      <div class="about-panel">
        <div class="about-panel__head">
          <h4 class="about-panel__title">软件贡献者</h4>
          <span class="about-panel__hint">排名不分先后</span>
        </div>
        <div class="about-contributors">
          <span v-for="name in contributors" :key="name" class="about-contributor">
            {{ name }}
          </span>
        </div>
      </div>
    </div>
  </SettingSection>
</template>

<style scoped>
.about-hero {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-1) 0 var(--space-2);
}

.about-hero__copy {
  max-width: 540px;
}

.about-hero__eyebrow {
  font-size: var(--fs-12);
  font-weight: var(--fw-bold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-accent);
}

.about-hero__title {
  margin-top: 4px;
  font-size: 1.05rem;
  color: var(--color-text);
}

.about-hero__desc {
  margin-top: 6px;
  font-size: var(--fs-13);
  line-height: 1.7;
  color: var(--color-text-soft);
}

.about-hero__chips {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  justify-content: flex-end;
  gap: var(--space-2);
  min-width: 180px;
}

.about-runtime-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-3);
  margin-top: var(--space-2);
}

.about-card,
.about-panel {
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: var(--color-surface);
}

.about-card {
  padding: 14px;
}

.about-card__value {
  display: block;
  margin-top: var(--space-2);
  font-size: 1rem;
  color: var(--color-text);
}

.about-card__desc {
  margin-top: var(--space-2);
  font-size: var(--fs-12);
  line-height: 1.65;
  color: var(--color-text-soft);
}

.about-panels {
  display: grid;
  grid-template-columns: 1.35fr 1fr;
  gap: var(--space-3);
  margin-top: var(--space-3);
}

.about-panel {
  padding: 14px;
}

.about-panel--ua {
  margin-top: var(--space-3);
}

.about-panel__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
}

.about-panel__title {
  font-size: 0.9rem;
  color: var(--color-text);
}

.about-panel__hint {
  font-size: var(--fs-12);
  color: var(--color-text-muted);
}

.about-badges {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 14px;
}

.about-badge-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding-bottom: 10px;
  border-bottom: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
}

.about-badge-row:last-child {
  padding-bottom: 0;
  border-bottom: none;
}

.about-badge-row__label {
  font-size: var(--fs-13);
  color: var(--color-text-soft);
}

.about-ua-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 14px;
}

.about-ua-row {
  display: grid;
  grid-template-columns: minmax(140px, 0.28fr) minmax(0, 1fr);
  gap: var(--space-3);
  padding-bottom: 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
}

.about-ua-row:last-child {
  padding-bottom: 0;
  border-bottom: none;
}

.about-ua-row__meta p {
  margin-top: 4px;
  font-size: var(--fs-12);
  line-height: 1.55;
  color: var(--color-text-muted);
}

.about-ua-row__value {
  min-width: 0;
  margin: 0;
  padding: 9px 10px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--color-border) 22%, transparent);
  color: var(--color-text);
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
    monospace;
  font-size: var(--fs-12);
  line-height: 1.55;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.about-contributors {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: 14px;
}

.about-contributor {
  padding: 6px 10px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--color-accent) 10%, var(--color-surface));
  color: var(--color-text);
  font-size: var(--fs-13);
  font-weight: var(--fw-medium);
}

.about-label {
  font-size: var(--fs-12);
  color: var(--color-text-muted);
}

@media (max-width: 720px) {
  .about-hero,
  .about-panels {
    grid-template-columns: 1fr;
    display: grid;
  }

  .about-hero__chips {
    justify-content: flex-start;
    min-width: 0;
  }

  .about-runtime-grid {
    grid-template-columns: 1fr;
  }

  .about-ua-row {
    grid-template-columns: 1fr;
  }

  .about-panel__head,
  .about-badge-row {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
