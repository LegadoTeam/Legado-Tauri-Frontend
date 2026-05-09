<script setup lang="ts">
import { useReaderSettingsStore } from '@/stores';
import type { PaginationEngine } from '@/components/reader/types';
import SettingItem from './SettingItem.vue';
import SettingSection from './SettingSection.vue';

const { settings, resetSettings } = useReaderSettingsStore();

const PAGINATION_ENGINE_OPTIONS: { label: string; value: PaginationEngine; desc: string }[] = [
  {
    label: 'DOM（默认）',
    value: 'dom',
    desc: '真实 DOM 渲染测量，天然支持系统字体缩放，兼容性最佳',
  },
  {
    label: 'Pretext',
    value: 'pretext',
    desc: 'Canvas + Pretext 精确排版（部分旧版 Android WebView 可能字间距异常）',
  },
];
</script>

<template>
  <SettingSection title="阅读偏好" section-id="section-reader">
    <SettingItem
      label="阅读偏好"
      desc="排版方式、返回行为、音量键翻页和移动端顶栏直接在当前页面展开。"
      :vertical="true"
    >
      <div class="reader-panel-stack">
        <SettingItem
          label="排版方式"
          desc="分页排版引擎，Pretext 在部分系统（旧版 Android WebView）可能出现字间距异常"
        >
          <n-radio-group
            :value="settings.paginationEngine"
            size="small"
            @update:value="(v: string) => (settings.paginationEngine = v as PaginationEngine)"
          >
            <n-radio-button
              v-for="opt in PAGINATION_ENGINE_OPTIONS"
              :key="opt.value"
              :value="opt.value"
              :title="opt.desc"
            >
              {{ opt.label }}
            </n-radio-button>
          </n-radio-group>
        </SettingItem>

        <SettingItem label="返回键行为" desc="阅读时（未打开菜单/设置）按返回键的行为">
          <n-radio-group
            :value="settings.backBehavior"
            size="small"
            @update:value="(v: string) => (settings.backBehavior = v as 'bookshelf' | 'desktop')"
          >
            <n-radio-button value="bookshelf">返回书架</n-radio-button>
            <n-radio-button value="desktop">回到桌面</n-radio-button>
          </n-radio-group>
        </SettingItem>

        <SettingItem label="音量键翻页" desc="阅读页菜单关闭且未听书时，音量键用于上一页 / 下一页">
          <n-switch
            :value="settings.volumeKeyPageTurnEnabled"
            @update:value="(v: boolean) => (settings.volumeKeyPageTurnEnabled = v)"
          >
            <template #checked>开启</template>
            <template #unchecked>关闭</template>
          </n-switch>
        </SettingItem>

        <SettingItem label="移动端顶栏" desc="手机布局打开阅读菜单时，可选择隐藏顶部栏">
          <n-switch
            :value="settings.hideTopBarOnMobile"
            @update:value="(v: boolean) => (settings.hideTopBarOnMobile = v)"
          >
            <template #checked>隐藏</template>
            <template #unchecked>显示</template>
          </n-switch>
        </SettingItem>

        <SettingItem label="恢复默认" desc="将所有阅读设置重置为默认值">
          <n-button size="small" quaternary @click="resetSettings">恢复默认阅读设置</n-button>
        </SettingItem>
      </div>
    </SettingItem>
  </SettingSection>
</template>

<style scoped>
.reader-panel-stack {
  display: flex;
  flex-direction: column;
}
</style>
