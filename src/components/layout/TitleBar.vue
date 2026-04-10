<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { isTauri, isMobile, platform } from '@/composables/useEnv'

/** Windows 桌面端即使切换手机布局，也保留完整标题栏（拖拽 + 窗口控制） */
const forceDesktopBar = computed(() => isTauri && platform === 'Windows')

withDefaults(defineProps<{
  title?: string
}>(), {
  title: 'Legado'
})

const isMaximized = ref(false)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let appWindow: any = null
let unlisten: (() => void) | undefined

async function refreshMaximized() {
  if (!appWindow) return
  isMaximized.value = await appWindow.isMaximized()
}

async function minimize() {
  await appWindow?.minimize()
}

async function toggleMaximize() {
  await appWindow?.toggleMaximize()
}

async function closeWindow() {
  await appWindow?.close()
}

onMounted(async () => {
  if (!isTauri) return
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    appWindow = getCurrentWindow()
    await refreshMaximized()
    unlisten = await appWindow.onResized(() => refreshMaximized())
  } catch {
    // 非 Tauri 环境静默处理，不影响页面加载
  }
})

onUnmounted(() => {
  unlisten?.()
})
</script>

<template>
  <!-- 移动端：纯状态栏颜色遮罩，高度由 grid row（env safe-area-inset-top）决定，无文字 -->
  <header v-if="isMobile && !forceDesktopBar" class="title-bar title-bar--mobile" aria-hidden="true" />
  <!-- 桌面端：完整标题栏 + 窗口控制 -->
  <header v-else class="title-bar" data-tauri-drag-region>
    <span class="title-bar__title">{{ title }}</span>
    <div class="title-bar__spacer" data-tauri-drag-region />
    <!-- 仅 Tauri 桌面环境显示窗口控制按钮 -->
    <div v-if="isTauri" class="title-bar__controls">
      <button class="ctrl-btn ctrl-btn--minimize" aria-label="最小化" @click="minimize">
        <svg width="10" height="1" viewBox="0 0 10 1"><line x1="0" y1="0.5" x2="10" y2="0.5" stroke="currentColor" stroke-width="1.2"/></svg>
      </button>
      <button class="ctrl-btn ctrl-btn--maximize" :aria-label="isMaximized ? '还原' : '最大化'" @click="toggleMaximize">
        <svg v-if="!isMaximized" width="10" height="10" viewBox="0 0 10 10"><rect x="0.6" y="0.6" width="8.8" height="8.8" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
        <svg v-else width="10" height="10" viewBox="0 0 10 10">
          <rect x="2.5" y="0.5" width="7" height="7" fill="none" stroke="currentColor" stroke-width="1.2"/>
          <polyline points="0.5,2.5 0.5,9.5 7.5,9.5" fill="none" stroke="currentColor" stroke-width="1.2"/>
        </svg>
      </button>
      <button class="ctrl-btn ctrl-btn--close" aria-label="关闭" @click="closeWindow">
        <svg width="10" height="10" viewBox="0 0 10 10"><line x1="0.5" y1="0.5" x2="9.5" y2="9.5" stroke="currentColor" stroke-width="1.2"/><line x1="9.5" y1="0.5" x2="0.5" y2="9.5" stroke="currentColor" stroke-width="1.2"/></svg>
      </button>
    </div>
  </header>
</template>

<style scoped>
.title-bar {
  grid-area: title;
  display: flex;
  align-items: center;
  height: var(--titlebar-h);
  padding-left: var(--space-md);
  background: var(--color-surface-raised);
  border-bottom: 1px solid var(--color-border);
  user-select: none;
  /* 整个标题栏可拖拽 */
  -webkit-app-region: drag;
}

.title-bar__title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-primary);
  letter-spacing: 0.02em;
  flex-shrink: 0;
  /* 文字不触发拖拽事件 */
  -webkit-app-region: no-drag;
}

.title-bar__spacer {
  flex: 1;
  height: 100%;
  -webkit-app-region: drag;
}

/* 窗口控制按钮区 */
.title-bar__controls {
  display: flex;
  align-items: stretch;
  height: 100%;
  -webkit-app-region: no-drag;
}

.ctrl-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 100%;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
  -webkit-app-region: no-drag;
}

.ctrl-btn:hover {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
}

.ctrl-btn--close:hover {
  background: #e81123;
  color: #fff;
}

.ctrl-btn svg {
  pointer-events: none;
}

/* ── 移动端顶栏：仅作状态栏背景遮盖，高度 = grid row (env safe-area-inset-top) ── */
.title-bar--mobile {
  background: var(--color-surface-raised);
  border-bottom: none;
  -webkit-app-region: none;
}
</style>
