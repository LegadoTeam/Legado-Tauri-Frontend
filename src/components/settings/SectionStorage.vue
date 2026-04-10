<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useMessage } from 'naive-ui'
import { isTauri } from '@/composables/useEnv'
import { useAppConfig } from '@/composables/useAppConfig'
import { comicCacheClear, comicCacheSize } from '@/composables/useBookSource'
import SettingSection from './SettingSection.vue'
import SettingItem from './SettingItem.vue'

const message = useMessage()
const { config, savingKey, setConfig } = useAppConfig()

const comicCacheSizeBytes = ref(0)
const comicCacheClearing = ref(false)

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

async function handleSet(key: string, value: string) {
  try {
    await setConfig(key, value)
    message.success('已保存')
  } catch (e: unknown) {
    message.error(`保存失败: ${e}`)
  }
}

async function refreshCacheSize() {
  if (!isTauri) return
  try {
    comicCacheSizeBytes.value = await comicCacheSize()
  } catch { /* ignore */ }
}

async function handleClearCache() {
  if (!isTauri) return
  comicCacheClearing.value = true
  try {
    const freed = await comicCacheClear()
    comicCacheSizeBytes.value = 0
    message.success(`已清理 ${formatBytes(freed)}`)
  } catch (e: unknown) {
    message.error(`清理失败: ${e}`)
  } finally {
    comicCacheClearing.value = false
  }
}

onMounted(refreshCacheSize)
</script>

<template>
  <SettingSection title="存储" section-id="section-storage" v-if="isTauri">
    <SettingItem label="漫画图片缓存" desc="启用后漫画图片经 Rust 后端下载缓存到本地，支持离线查看和预加载；关闭则由浏览器直接加载">
      <n-switch
        :value="config.comic_cache_enabled"
        size="small"
        :loading="savingKey === 'comic_cache_enabled'"
        @update:value="(v: boolean) => handleSet('comic_cache_enabled', String(v))"
      />
    </SettingItem>

    <SettingItem label="缓存占用" :desc="`当前漫画图片缓存大小：${formatBytes(comicCacheSizeBytes)}`">
      <n-button
        size="small"
        type="warning"
        :loading="comicCacheClearing"
        :disabled="comicCacheSizeBytes === 0"
        @click="handleClearCache"
      >清理缓存</n-button>
    </SettingItem>
  </SettingSection>
</template>
