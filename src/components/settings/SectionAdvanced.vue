<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useMessage } from 'naive-ui'
import { isTauri, isMobile } from '@/composables/useEnv'
import { useAppConfig } from '@/composables/useAppConfig'
import SettingSection from './SettingSection.vue'
import SettingItem from './SettingItem.vue'

const message = useMessage()
const { config, savingKey, setConfig, resetConfig, loadConfig } = useAppConfig()
const sideloadUrlInput = ref('')

function isAllowedSideloadUrl(raw: string): boolean {
  const value = raw.trim()
  if (!value) return false

  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }

  if (url.username || url.password) return false
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false

  const host = url.hostname.toLowerCase()
  if (host === 'localhost' || host === '127.0.0.1') return true

  const ipv4Parts = host.split('.')
  if (ipv4Parts.length === 4 && ipv4Parts.every((part) => /^\d+$/.test(part))) {
    const nums = ipv4Parts.map((part) => Number(part))
    if (nums.some((n) => n < 0 || n > 255)) return false
    if (nums[0] === 10) return true
    if (nums[0] === 192 && nums[1] === 168) return true
    if (nums[0] === 172 && nums[1] >= 16 && nums[1] <= 31) return true
  }

  return false
}

async function handleSet(key: string, value: string) {
  try {
    await setConfig(key, value)
    message.success('已保存')
  } catch (e: unknown) {
    message.error(`保存失败: ${e}`)
  }
}

async function openLogWindow() {
  if (isMobile.value) return
  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    const existing = await WebviewWindow.getByLabel('log-viewer')
    if (existing) {
      await existing.setFocus()
      return
    }
    new WebviewWindow('log-viewer', {
      url: '/?view=logs',
      title: '实时日志',
      width: 900,
      height: 600,
    })
  } catch {
    // 非 Tauri 环境忽略
  }
}

async function saveSideloadUrl() {
  const value = sideloadUrlInput.value.trim()
  if (value && !isAllowedSideloadUrl(value)) {
    message.error('仅允许 localhost、127.0.0.1 或局域网 IPv4 地址，协议仅支持 http / https')
    return
  }
  await handleSet('ui_sideload_debug_url', value)
}

async function resetSideloadUrl() {
  try {
    await resetConfig('ui_sideload_debug_url')
    sideloadUrlInput.value = config.value.ui_sideload_debug_url
    message.success('已清空')
  } catch (e: unknown) {
    message.error(`重置失败: ${e}`)
  }
}

async function openSideloadWindow() {
  const url = sideloadUrlInput.value.trim()
  if (!url) {
    message.error('请先填写侧载地址')
    return
  }
  if (!isAllowedSideloadUrl(url)) {
    message.error('仅允许 localhost、127.0.0.1 或局域网 IPv4 地址，协议仅支持 http / https')
    return
  }

  try {
    if (url !== config.value.ui_sideload_debug_url) {
      await setConfig('ui_sideload_debug_url', url)
      sideloadUrlInput.value = config.value.ui_sideload_debug_url
    }

    if (isMobile.value) {
      window.location.assign(config.value.ui_sideload_debug_url)
      return
    }

    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    const existing = await WebviewWindow.getByLabel('sideload-debug')
    if (existing) {
      await existing.close()
    }

    new WebviewWindow('sideload-debug', {
      url: config.value.ui_sideload_debug_url,
      title: '侧载调试',
      devtools: true,
      ...(isMobile.value
        ? {}
        : {
          width: 1280,
          height: 860,
          minWidth: 960,
          minHeight: 640,
          center: true,
          focus: true,
        }),
    })

    message.success('已打开侧载调试窗口')
  } catch (e: unknown) {
    message.error(`打开失败: ${e instanceof Error ? e.message : String(e)}`)
  }
}

onMounted(async () => {
  if (!isTauri) return
  try {
    await loadConfig()
    sideloadUrlInput.value = config.value.ui_sideload_debug_url
  } catch (e) {
    console.error('加载高级设置失败', e)
  }
})
</script>

<template>
  <SettingSection title="高级" section-id="section-advanced">
    <SettingItem v-if="isMobile" label="调试浮窗" desc="在 App 内显示浮动调试日志按钮">
      <n-switch :value="config.ui_show_debug_float" size="small" :loading="savingKey === 'ui_show_debug_float'"
        @update:value="(v: boolean) => handleSet('ui_show_debug_float', String(v))" />
    </SettingItem>

    <SettingItem v-if="isTauri && !isMobile" label="实时日志窗口" desc="打开独立窗口查看脚本运行日志">
      <n-button size="small" @click="openLogWindow">打开</n-button>
    </SettingItem>

    <SettingItem v-if="isTauri" label="侧载调试"
      desc="把当前正式版当作调试基座，打开本机或局域网前端页面。仅允许 localhost、127.0.0.1、10.x、192.168.x.x、172.16-31.x.x。" :vertical="true">
      <div class="sideload-shell">
        <div class="sideload-panel">
          <div class="sideload-panel__label">调试地址</div>
          <n-input v-model:value="sideloadUrlInput" size="small" placeholder="例如：http://127.0.0.1:1420"
            class="sideload-input" @keydown.enter.prevent="openSideloadWindow" />
        </div>
        <div class="sideload-actions">
          <n-button size="small" type="primary" :loading="savingKey === 'ui_sideload_debug_url'"
            @click="saveSideloadUrl">
            保存
          </n-button>
          <n-button size="small" type="primary" secondary @click="openSideloadWindow">
            打开调试窗口
          </n-button>
          <n-button size="small" :loading="savingKey === 'ui_sideload_debug_url'" @click="resetSideloadUrl">
            清空
          </n-button>
        </div>
        <div class="sideload-info">
          <div class="sideload-info__row">
            <div class="sideload-info__label">当前地址</div>
            <div class="sideload-info__value sideload-info__value--mono">
              {{ config.ui_sideload_debug_url || '未设置' }}
            </div>
          </div>
          <div class="sideload-info__row">
            <div class="sideload-info__label">允许范围</div>
            <div class="sideload-info__value">
              localhost、127.0.0.1、10.x.x.x、192.168.x.x、172.16-31.x.x
            </div>
          </div>
        </div>

        <div class="sideload-note">
          桌面端会打开独立调试窗口；移动端会直接在当前页面跳转到侧载地址。
        </div>
      </div>
    </SettingItem>
  </SettingSection>
</template>

<style scoped>
.sideload-shell {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  /* padding: 12px; */
  /* border: 1px solid var(--color-border); */
  /* border-radius: var(--radius-md); */
  /* background: var(--color-surface-hover); */
}

.sideload-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sideload-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.sideload-panel__label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.sideload-input {
  width: 100%;
  font-family: var(--font-mono, monospace);
}

.sideload-info {
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
}

.sideload-info__row {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
  padding: 10px 12px;
}

.sideload-info__row+.sideload-info__row {
  border-top: 1px solid var(--color-border);
}

.sideload-info__label {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  font-weight: 600;
  white-space: nowrap;
}

.sideload-info__value {
  font-size: 0.8125rem;
  color: var(--color-text-primary);
  line-height: 1.5;
  word-break: break-all;
}

.sideload-info__value--mono {
  font-family: var(--font-mono, monospace);
}

.sideload-note {
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--color-accent) 8%, transparent);
  font-size: 0.75rem;
  color: var(--color-text-muted);
  line-height: 1.5;
}

.sideload-note::before {
  content: '说明';
  display: block;
  margin-bottom: 6px;
  color: var(--color-text-secondary);
  font-weight: 600;
}

:deep(.setting-item--vertical .setting-item__control) .sideload-panel,
:deep(.setting-item--vertical .setting-item__control) .sideload-shell,
:deep(.setting-item--vertical .setting-item__control) .sideload-info,
:deep(.setting-item--vertical .setting-item__control) .sideload-note {
  width: 100%;
}

@media (max-width: 900px) {
  .sideload-shell {
    padding: 10px;
  }

  .sideload-info__row {
    grid-template-columns: 1fr;
    gap: 6px;
  }
}
</style>
