import { ref } from 'vue'
import { isTauri } from './useEnv'

const privacyModeEnabled = ref(false)
const privacyExitTick = ref(0)
const privacyExitReason = ref<'manual' | 'background' | 'close'>('manual')

let guardsInstalled = false
function enterPrivacyMode() {
  privacyModeEnabled.value = true
}

function exitPrivacyMode(reason: 'manual' | 'background' | 'close' = 'manual') {
  if (!privacyModeEnabled.value) return
  privacyModeEnabled.value = false
  privacyExitReason.value = reason
  privacyExitTick.value += 1
}

function togglePrivacyMode() {
  if (privacyModeEnabled.value) {
    exitPrivacyMode('manual')
  } else {
    enterPrivacyMode()
  }
}

async function setupPrivacyModeAutoExit() {
  if (guardsInstalled || typeof window === 'undefined') return
  guardsInstalled = true

  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      exitPrivacyMode('background')
    }
  }
  const onPageHide = () => exitPrivacyMode('close')
  const onBeforeUnload = () => exitPrivacyMode('close')

  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('pagehide', onPageHide)
  window.addEventListener('beforeunload', onBeforeUnload)

  if (isTauri) {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      const appWindow = getCurrentWindow()
      await appWindow.onFocusChanged(({ payload: focused }) => {
        if (!focused) exitPrivacyMode('background')
      })
      await appWindow.onCloseRequested(() => {
        exitPrivacyMode('close')
      })
    } catch {
      // ignore
    }
  }
}

export function usePrivacyMode() {
  return {
    privacyModeEnabled,
    privacyExitTick,
    privacyExitReason,
    enterPrivacyMode,
    exitPrivacyMode,
    togglePrivacyMode,
    setupPrivacyModeAutoExit,
  }
}
