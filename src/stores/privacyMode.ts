import { defineStore } from 'pinia';
import { ref } from 'vue';
import { isTauri } from '@/composables/useEnv';

export const usePrivacyModeStore = defineStore('privacyMode', () => {
  const privacyModeEnabled = ref(false);
  const privacyExitTick = ref(0);
  const privacyExitReason = ref<'manual' | 'background' | 'close'>('manual');

  let guardsInstalled = false;

  function enterPrivacyMode() {
    privacyModeEnabled.value = true;
  }

  function exitPrivacyMode(reason: 'manual' | 'background' | 'close' = 'manual') {
    if (!privacyModeEnabled.value) {
      return;
    }
    privacyModeEnabled.value = false;
    privacyExitReason.value = reason;
    privacyExitTick.value += 1;
  }

  function togglePrivacyMode() {
    if (privacyModeEnabled.value) {
      exitPrivacyMode('manual');
    } else {
      enterPrivacyMode();
    }
  }

  async function setupAutoExit() {
    if (guardsInstalled || typeof window === 'undefined') {
      return;
    }
    guardsInstalled = true;

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        exitPrivacyMode('background');
      }
    };
    const onPageHide = () => exitPrivacyMode('close');
    const onBeforeUnload = () => exitPrivacyMode('close');
    // Android WebView 中 visibilitychange:hidden 会在恢复时才触发，时机偏晚。
    // MainActivity.kt 在 onWindowFocusChanged(false) 时直接向 WebView 派发此事件，
    // 确保切换到后台时立即退出隐私模式。
    const onAppPaused = () => exitPrivacyMode('background');

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('legado:app-paused', onAppPaused);

    if (isTauri) {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const appWindow = getCurrentWindow();
        await appWindow.onFocusChanged(({ payload: focused }) => {
          if (!focused) {
            exitPrivacyMode('background');
          }
        });
        await appWindow.onCloseRequested(() => {
          exitPrivacyMode('close');
        });
      } catch {
        // 非 Tauri 环境忽略
      }
    }
  }

  return {
    privacyModeEnabled,
    privacyExitTick,
    privacyExitReason,
    enterPrivacyMode,
    exitPrivacyMode,
    togglePrivacyMode,
    setupAutoExit,
  };
});
