<script setup lang="ts">
import { useAppConfig } from '@/composables/useAppConfig'
import SettingSection from './SettingSection.vue'
import SettingItem from './SettingItem.vue'

const { config, setConfig } = useAppConfig()

async function handleSet(key: string, value: string) {
  try {
    await setConfig(key, value)
  } catch (e: unknown) {
    console.error(`保存失败: ${e}`)
  }
}
</script>

<template>
  <SettingSection title="通用" section-id="section-general">
    <SettingItem label="主题" desc="选择应用外观主题；自动模式跟随系统">
      <n-radio-group
        :value="config.ui_theme"
        size="small"
        @update:value="(v: string) => handleSet('ui_theme', v)"
      >
        <n-radio-button value="auto">跟随系统</n-radio-button>
        <n-radio-button value="light">亮色</n-radio-button>
        <n-radio-button value="dark">暗色</n-radio-button>
      </n-radio-group>
    </SettingItem>

    <SettingItem label="布局模式" desc="切换手机 / 电脑界面；自动模式根据设备自动判断">
      <n-radio-group
        :value="config.ui_layout_mode"
        size="small"
        @update:value="(v: string) => handleSet('ui_layout_mode', v)"
      >
        <n-radio-button value="auto">自动</n-radio-button>
        <n-radio-button value="mobile">手机</n-radio-button>
        <n-radio-button value="desktop">电脑</n-radio-button>
      </n-radio-group>
    </SettingItem>
  </SettingSection>
</template>
