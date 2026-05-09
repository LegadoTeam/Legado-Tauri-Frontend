<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useAppConfigStore, usePreferencesStore } from '@/stores';
import SettingItem from './SettingItem.vue';
import SettingSection from './SettingSection.vue';

const _appCfg = useAppConfigStore();
const { config, savingKey } = storeToRefs(_appCfg);
const { setConfig } = _appCfg;

const prefsStore = usePreferencesStore();
const tocCfg = computed(() => prefsStore.tocAutoUpdate);
const searchCfg = computed(() => prefsStore.search);

async function handleSet(key: string, value: string) {
  try {
    await setConfig(key, value);
  } catch (e: unknown) {
    console.error(`保存失败: ${e}`);
  }
}

const INTERVAL_OPTIONS = [
  { label: '2 小时', value: 7200 },
  { label: '4 小时', value: 14400 },
  { label: '8 小时', value: 28800 },
  { label: '24 小时', value: 86400 },
];
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

  <SettingSection title="书架" section-id="section-bookshelf">
    <SettingItem label="自动更新目录" desc="定期在后台静默检测书籍是否有新章节，不影响阅读">
      <n-switch
        :value="tocCfg.enabled"
        @update:value="(v: boolean) => prefsStore.patchTocAutoUpdate({ enabled: v })"
      >
        <template #checked>开启</template>
        <template #unchecked>关闭</template>
      </n-switch>
    </SettingItem>

    <template v-if="tocCfg.enabled">
      <SettingItem label="最小检测间隔" desc="两次自动检测同一本书之间的最短等待时间">
        <n-radio-group
          :value="tocCfg.minIntervalSecs"
          size="small"
          @update:value="(v: number) => prefsStore.patchTocAutoUpdate({ minIntervalSecs: v })"
        >
          <n-radio-button
            v-for="opt in INTERVAL_OPTIONS"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </n-radio-button>
        </n-radio-group>
      </SettingItem>

      <SettingItem label="打开图书时检测" desc="每次打开书籍时，若距离上次检测超过最小间隔则自动更新目录">
        <n-switch
          :value="tocCfg.onBookOpen"
          @update:value="(v: boolean) => prefsStore.patchTocAutoUpdate({ onBookOpen: v })"
        >
          <template #checked>开启</template>
          <template #unchecked>关闭</template>
        </n-switch>
      </SettingItem>

      <SettingItem label="启动 App 时检测" desc="每次启动应用时，后台逐本检测所有书籍的目录更新">
        <n-switch
          :value="tocCfg.onAppStart"
          @update:value="(v: boolean) => prefsStore.patchTocAutoUpdate({ onAppStart: v })"
        >
          <template #checked>开启</template>
          <template #unchecked>关闭</template>
        </n-switch>
      </SettingItem>

      <SettingItem label="切换到书架时检测" desc="每次从其他页面切换回书架时，后台逐本检测所有书籍的目录更新">
        <n-switch
          :value="tocCfg.onShelfView"
          @update:value="(v: boolean) => prefsStore.patchTocAutoUpdate({ onShelfView: v })"
        >
          <template #checked>开启</template>
          <template #unchecked>关闭</template>
        </n-switch>
      </SettingItem>
    </template>
  </SettingSection>

  <SettingSection title="搜索与换源" section-id="section-search">
    <SettingItem label="搜索并发数" desc="同时向多少个书源发起搜索请求，越大速度越快但对网络压力越高，默认 5">
      <div style="display: flex; gap: 6px; align-items: center">
        <n-input-number
          :value="searchCfg.searchConcurrency ?? 5"
          size="small"
          :min="1"
          :max="20"
          style="width: 80px"
          @update:value="(v: number | null) => prefsStore.patchSearch({ searchConcurrency: Math.max(1, v ?? 5) })"
        />
        <span>个</span>
      </div>
    </SettingItem>

    <SettingItem label="换源并发数" desc="换源搜索时同时查询的书源数量，默认 5">
      <div style="display: flex; gap: 6px; align-items: center">
        <n-input-number
          :value="searchCfg.switchSourceConcurrency ?? 5"
          size="small"
          :min="1"
          :max="20"
          style="width: 80px"
          @update:value="(v: number | null) => prefsStore.patchSearch({ switchSourceConcurrency: Math.max(1, v ?? 5) })"
        />
        <span>个</span>
      </div>
    </SettingItem>
  </SettingSection>
</template>
