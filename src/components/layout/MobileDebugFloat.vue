<script setup lang="ts">
import { ref, computed } from 'vue'
import { useScriptBridge } from '../../composables/useScriptBridge'

const { state } = useScriptBridge()

const visible = ref(false)
const minimized = ref(true)

/** 最近的日志（倒序，最新在前） */
const recentLogs = computed(() => [...state.logs].reverse().slice(0, 50))

function toggle() {
  if (!visible.value) {
    visible.value = true
    minimized.value = false
  } else if (!minimized.value) {
    minimized.value = true
  } else {
    visible.value = false
  }
}

/** 从日志消息中推断等级 */
function guessLevel(msg: string): string {
  if (msg.includes('[ERROR]') || msg.includes('[error]')) return 'error'
  if (msg.includes('[WARN]') || msg.includes('[warn]')) return 'warn'
  if (msg.includes('[INFO]') || msg.includes('[info]')) return 'info'
  return 'log'
}

function levelColor(level: string): string {
  switch (level) {
    case 'error': return 'var(--color-danger)'
    case 'warn': return 'var(--color-warning)'
    case 'info': return 'var(--color-accent)'
    default: return 'var(--color-text-muted)'
  }
}

defineExpose({ toggle, visible })
</script>

<template>
  <!-- 浮动按钮 -->
  <button class="debug-fab" @click="toggle" title="调试日志">
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      <line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="14" y2="11"/>
    </svg>
    <span v-if="state.logs.length" class="debug-fab__badge">{{ state.logs.length }}</span>
  </button>

  <!-- 日志面板 -->
  <Transition name="debug-panel">
    <div v-if="visible" class="debug-panel" :class="{ 'debug-panel--minimized': minimized }">
      <div class="debug-panel__header" @click="minimized = !minimized">
        <span>调试日志 ({{ state.logs.length }})</span>
        <button class="debug-panel__close" @click.stop="visible = false">✕</button>
      </div>
      <div v-if="!minimized" class="debug-panel__body">
        <div v-if="!recentLogs.length" class="debug-panel__empty">暂无日志</div>
        <div
          v-for="(log, i) in recentLogs"
          :key="i"
          class="debug-panel__line"
          :style="{ color: levelColor(guessLevel(log.message)) }"
        >
          <span class="debug-panel__msg">{{ log.message }}</span>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.debug-fab {
  position: fixed;
  bottom: calc(var(--bottomnav-h) + 12px);
  right: 12px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: var(--color-sidebar-bg);
  color: var(--color-sidebar-text);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  z-index: 1000;
  -webkit-tap-highlight-color: transparent;
}
.debug-fab:active { opacity: 0.7; }
.debug-fab__badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  background: var(--color-danger);
  color: #fff;
  font-size: 0.625rem;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}

.debug-panel {
  position: fixed;
  bottom: calc(var(--bottomnav-h) + 56px);
  right: 12px;
  left: 12px;
  max-height: 40vh;
  background: var(--color-sidebar-bg);
  border: 1px solid var(--color-sidebar-border);
  border-radius: var(--radius-md);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
}
.debug-panel--minimized { max-height: 36px; }

.debug-panel__header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-sidebar-text);
  cursor: pointer;
  user-select: none;
}
.debug-panel__close {
  border: none;
  background: none;
  color: var(--color-sidebar-text-muted);
  cursor: pointer;
  font-size: 0.75rem;
  padding: 2px 4px;
}

.debug-panel__body {
  flex: 1;
  overflow-y: auto;
  padding: 4px 12px 8px;
  font-family: 'Cascadia Code', 'Consolas', monospace;
  font-size: 0.6875rem;
  line-height: 1.5;
}
.debug-panel__empty {
  color: var(--color-sidebar-text-muted);
  text-align: center;
  padding: 12px;
}
.debug-panel__line {
  display: flex;
  gap: 6px;
  word-break: break-all;
}
.debug-panel__level {
  flex-shrink: 0;
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.625rem;
}
.debug-panel__msg {
  min-width: 0;
}

/* 动画 */
.debug-panel-enter-active,
.debug-panel-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.debug-panel-enter-from,
.debug-panel-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
