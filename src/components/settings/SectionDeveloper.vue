<script setup lang="ts">
import { useMessage } from 'naive-ui';
import { storeToRefs } from 'pinia';
import { useLogZonePref } from '@/composables/useLogZonePref';
import { isMobile, isTauri, isHarmonyNative } from '@/composables/useEnv';
import { useAppConfigStore, useShellStatusStore } from '@/stores';
import { transportInvoke } from '@/composables/useTransport';
import SettingItem from './SettingItem.vue';
import SettingSection from './SettingSection.vue';

const message = useMessage();
const _appCfg = useAppConfigStore();
const { config, savingKey } = storeToRefs(_appCfg);
const { setConfig } = _appCfg;
const shellStore = useShellStatusStore();
const { logZoneEnabled } = useLogZonePref();

async function handleSet(key: string, value: string) {
  try {
    await setConfig(key, value);
    message.success('已保存');
  } catch (e: unknown) {
    message.error(`保存失败: ${e}`);
  }
}

async function handleErudaToggle(v: boolean) {
  try {
    await setConfig('ui_enable_eruda', String(v));
    if (v) {
      const eruda = await import('eruda');
      eruda.default.init();
      message.success('Eruda 调试控制台已开启');
    } else {
      message.info('已关闭，重启后完全生效');
    }
  } catch (e: unknown) {
    message.error(`保存失败: ${e}`);
  }
}

async function openHarmonyDebugPanel() {
  try {
    const native = (window as Record<string, unknown>).__legadoNative;

    // 方案1：直接调用 __legadoNative.openDebugTool()（如果可用）
    if (native && typeof native.openDebugTool === 'function') {
      native.openDebugTool();
      message.success('已打开鸿蒙调试面板');
      return;
    }

    // 方案2：通过 __legadoNative.invoke 调用命令
    if (native && typeof native.invoke === 'function') {
      try {
        const result = native.invoke('harmony_' + Date.now(), 'open_debug_panel', '{}');
        // invoke 是同步方法，如果没报错就认为成功
        message.success('已打开鸿蒙调试面板');
        return;
      } catch (e) {
        console.warn('[Debug] invoke 失败:', e);
      }
    }

    // 方案3：通过 transportInvoke 调用（异步）
    if (isHarmonyNative) {
      try {
        await transportInvoke('open_debug_panel');
        message.success('已打开鸿蒙调试面板');
        return;
      } catch (e) {
        console.warn('[Debug] transportInvoke 失败:', e);
      }
    }

    // 调试信息
    console.warn('[Debug] __legadoNative:', native);
    console.warn('[Debug] isHarmonyNative:', isHarmonyNative);
    console.warn('[Debug] openDebugTool 类型:', typeof native?.openDebugTool);
    console.warn('[Debug] invoke 类型:', typeof native?.invoke);

    message.warning('当前环境不支持打开调试面板');
  } catch (e: unknown) {
    message.error(`打开调试面板失败: ${e}`);
  }
}

async function closeHarmonyDebugPanel() {
  try {
    const native = (window as Record<string, unknown>).__legadoNative;

    // 方案1：直接调用 __legadoNative.closeDebugPanel()（如果可用）
    if (native && typeof native.closeDebugPanel === 'function') {
      native.closeDebugPanel();
      message.success('已关闭鸿蒙调试面板');
      return;
    }

    // 方案2：通过 __legadoNative.invoke 调用命令
    if (native && typeof native.invoke === 'function') {
      try {
        native.invoke('harmony_' + Date.now(), 'close_debug_panel', '{}');
        message.success('已关闭鸿蒙调试面板');
        return;
      } catch (e) {
        console.warn('[Debug] invoke 失败:', e);
      }
    }

    // 方案3：通过 transportInvoke 调用（异步）
    if (isHarmonyNative) {
      try {
        await transportInvoke('close_debug_panel');
        message.success('已关闭鸿蒙调试面板');
        return;
      } catch (e) {
        console.warn('[Debug] transportInvoke 失败:', e);
      }
    }

    message.warning('当前环境不支持关闭调试面板');
  } catch (e: unknown) {
    message.error(`关闭调试面板失败: ${e}`);
  }
}
</script>

<template>
  <SettingSection title="开发设置" section-id="section-developer">
    <!-- 鸿蒙调试面板（仅 Harmony 原生环境显示） -->
    <SettingItem
      v-if="isHarmonyNative"
      label="鸿蒙调试面板"
      desc="打开或关闭鸿蒙端内置的调试工具面板，用于查看日志、调试书源等。关闭后会隐藏调试按钮。"
    >
      <div style="display: flex; align-items: center; gap: 8px">
        <n-button size="small" type="primary" @click="openHarmonyDebugPanel">打开</n-button>
        <n-button size="small" @click="closeHarmonyDebugPanel">关闭</n-button>
      </div>
    </SettingItem>

    <SettingItem
      v-if="isMobile"
      label="Eruda 调试控制台"
      desc="开启后在 App 内显示小拖拽按钮，可查看请求、控制台等。开启立即生效；关闭重启生效。"
    >
      <n-switch
        :value="config.ui_enable_eruda"
        size="small"
        :loading="savingKey === 'ui_enable_eruda'"
        @update:value="handleErudaToggle"
      />
    </SettingItem>

    <!-- 实时日志：开关只控制 PC 底部任务栏日志区域，按钮直接打开通用日志面板 -->
    <SettingItem
      label="实时日志"
      desc="开关控制 PC 底部任务栏是否显示实时日志区域；点击「打开」直接查看脚本运行日志、HTTP 请求等"
    >
      <div style="display: flex; align-items: center; gap: 8px">
        <n-switch v-if="!isMobile" v-model:value="logZoneEnabled" size="small" />
        <n-button size="small" @click="shellStore.openLogWindow()">打开</n-button>
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
        @update:value="(v: boolean) => handleSet('booksource_watcher_enabled', String(v))"
      />
    </SettingItem>
  </SettingSection>

</template>
