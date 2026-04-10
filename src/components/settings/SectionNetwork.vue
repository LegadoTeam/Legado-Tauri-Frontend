<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useMessage } from 'naive-ui'
import { isTauri } from '@/composables/useEnv'
import { useAppConfig, BUILTIN_USER_AGENT } from '@/composables/useAppConfig'
import { uaSelectOptions } from './uaPresets'
import SettingSection from './SettingSection.vue'
import SettingItem from './SettingItem.vue'

const message = useMessage()
const { config, savingKey, setConfig, resetConfig, loadConfig } = useAppConfig()

const uaInput = ref('')
const selectedPresetUa = ref<string | null>(null)

async function handleSet(key: string, value: string) {
  try {
    await setConfig(key, value)
    message.success('已保存')
  } catch (e: unknown) {
    message.error(`保存失败: ${e}`)
  }
}

async function handleReset(key: string) {
  try {
    await resetConfig(key)
    uaInput.value = config.value.http_user_agent
    message.success('已重置为默认值')
  } catch (e: unknown) {
    message.error(`重置失败: ${e}`)
  }
}

function applyPreset(val: string | null) {
  if (!val) return
  uaInput.value = val
  saveUa()
  selectedPresetUa.value = null
}

function saveUa() {
  handleSet('http_user_agent', uaInput.value.trim() || BUILTIN_USER_AGENT)
}

onMounted(async () => {
  if (!isTauri) return
  try {
    await loadConfig()
    uaInput.value = config.value.http_user_agent
  } catch (e) {
    console.error('加载配置失败', e)
  }
})
</script>

<template>
  <SettingSection title="网络" section-id="section-network" v-if="isTauri">
    <!-- User-Agent -->
    <SettingItem label="User-Agent" desc="书源脚本未显式设置 UA 时使用此值" :vertical="true">
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
          <n-button size="small" type="primary" :loading="savingKey === 'http_user_agent'" @click="saveUa">保存</n-button>
          <n-button size="small" :loading="savingKey === 'http_user_agent'" @click="handleReset('http_user_agent')">重置</n-button>
        </div>
      </div>
      <div class="ua-current-card">
        <div class="ua-current-card__label">当前生效</div>
        <div class="ua-current" :title="config.http_user_agent">
          {{ config.http_user_agent }}
        </div>
      </div>
    </SettingItem>

    <!-- 连接超时 -->
    <SettingItem label="连接超时" desc="HTTP 连接超时时间（秒）">
      <div style="display: flex; gap: 6px; align-items: center;">
        <n-input-number
          :value="config.http_connect_timeout_secs"
          size="small"
          :min="1" :max="300"
          style="width: 90px"
          @update:value="(v: number | null) => v != null && handleSet('http_connect_timeout_secs', String(v))"
        />
        <span class="unit-label">秒</span>
      </div>
    </SettingItem>

    <!-- 引擎执行超时 -->
    <SettingItem label="引擎超时" desc="书源脚本引擎执行总超时时间（秒）">
      <div style="display: flex; gap: 6px; align-items: center;">
        <n-input-number
          :value="config.engine_timeout_secs"
          size="small"
          :min="5" :max="600"
          style="width: 90px"
          @update:value="(v: number | null) => v != null && handleSet('engine_timeout_secs', String(v))"
        />
        <span class="unit-label">秒</span>
      </div>
    </SettingItem>
  </SettingSection>
</template>

<style scoped>
.ua-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-hover);
}

.ua-panel__label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.ua-select,
.ua-input {
  width: 100%;
}

.ua-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.ua-input {
  font-family: var(--font-mono, monospace);
  font-size: 0.75rem;
}

.ua-current-card {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.ua-current-card__label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: 6px;
}

.ua-current {
  display: block;
  font-size: 0.75rem;
  color: var(--color-text-primary);
  font-family: var(--font-mono, monospace);
  line-height: 1.6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0.96;
}

.unit-label {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}
</style>
