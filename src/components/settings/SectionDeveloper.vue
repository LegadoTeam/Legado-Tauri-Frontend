<script setup lang="ts">
import { computed } from "vue";
import { useMessage } from "naive-ui";
import { storeToRefs } from "pinia";
import { useLogZonePref } from "@/composables/useLogZonePref";
import { isMobile, isTauri } from "@/composables/useEnv";
import { useAppConfigStore, useShellStatusStore } from "@/stores";
import { usePreferencesStore } from "@/stores/preferences";
import SettingItem from "./SettingItem.vue";
import SettingSection from "./SettingSection.vue";

const message = useMessage();
const _appCfg = useAppConfigStore();
const { config, savingKey } = storeToRefs(_appCfg);
const { setConfig } = _appCfg;
const shellStore = useShellStatusStore();
const { logZoneEnabled } = useLogZonePref();
const prefStore = usePreferencesStore();
const { devTools } = storeToRefs(prefStore);

// 追踪 vConsole 开关是否在本次会话中被修改过
const _initVConsole = devTools.value.vConsoleEnabled;
const vConsoleChanged = computed(
  () => devTools.value.vConsoleEnabled !== _initVConsole,
);

async function handleSet(key: string, value: string) {
  try {
    await setConfig(key, value);
    message.success("已保存");
  } catch (e: unknown) {
    message.error(`保存失败: ${e}`);
  }
}
</script>

<template>
  <SettingSection title="开发设置" section-id="section-developer">
    <!-- 实时日志：开关只控制 PC 底部任务栏日志区域，按钮直接打开通用日志面板 -->
    <SettingItem
      label="实时日志"
      desc="开关控制 PC 底部任务栏是否显示实时日志区域；点击「打开」直接查看脚本运行日志、HTTP 请求等"
    >
      <div style="display: flex; align-items: center; gap: 8px">
        <n-switch
          v-if="!isMobile"
          v-model:value="logZoneEnabled"
          size="small"
        />
        <n-button size="small" @click="shellStore.openLogWindow()"
          >打开</n-button
        >
      </div>
    </SettingItem>

    <!-- 书源文件监听（仅 Tauri） -->
    <SettingItem
      v-if="isTauri"
      label="书源文件监听"
      desc="开启后，书源目录中的 .js 变更会自动触发发现页/能力缓存刷新（热重载）。修改后需重启生效。"
    >
      <n-switch
        :value="config.booksource_watcher_enabled"
        size="small"
        :loading="savingKey === 'booksource_watcher_enabled'"
        @update:value="
          (v: boolean) => handleSet('booksource_watcher_enabled', String(v))
        "
      />
    </SettingItem>

    <!-- vConsole 调试面板 -->
    <SettingItem
      label="vConsole 调试面板"
      desc="启用后，页面右下角显示 vConsole 浮动按钮，可查看日志、网络请求、存储等调试信息。支持深色模式。"
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
          :value="devTools.vConsoleEnabled"
          size="small"
          @update:value="
            (v: boolean) => prefStore.patchDevTools({ vConsoleEnabled: v })
          "
        />
        <span
          v-if="vConsoleChanged"
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
  </SettingSection>
</template>
