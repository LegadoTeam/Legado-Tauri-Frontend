<script setup lang="ts">
import { envLabel, platform } from '@/composables/useEnv'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'

withDefaults(defineProps<{
  statusText?: string
}>(), {
  statusText: '就绪'
})

async function openLogWindow() {
  const existing = await WebviewWindow.getByLabel('log-viewer')
  if (existing) {
    await existing.setFocus()
    return
  }
  new WebviewWindow('log-viewer', {
    url: '/?view=logs',
    title: '实时日志',
    width: 900,
    height: 600,
  })
}
</script>

<template>
  <footer class="task-bar">
    <div class="task-bar__left">
      <slot name="left" />
    </div>
    <div class="task-bar__center">
      <slot />
    </div>
    <div class="task-bar__right">
      <button class="task-bar__log-btn" title="打开实时日志窗口" @click="openLogWindow">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          <line x1="8" y1="7" x2="16" y2="7" /><line x1="8" y1="11" x2="14" y2="11" /><line x1="8" y1="15" x2="12" y2="15" />
        </svg>
      </button>
      <span class="task-bar__status">{{ statusText }}</span>
      <span class="task-bar__env-badge" :class="`task-bar__env-badge--${envLabel}`">
        {{ envLabel }}<template v-if="platform"> · {{ platform }}</template>
      </span>
      <slot name="right" />
    </div>
  </footer>
</template>

<style scoped>
.task-bar {
  grid-area: taskbar;
  display: flex;
  align-items: center;
  height: var(--taskbar-h);
  padding: 0 var(--space-md);
  background: var(--color-surface-raised);
  border-top: 1px solid var(--color-border);
  user-select: none;
}

.task-bar__left,
.task-bar__right {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex: 0 0 auto;
}

.task-bar__center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
}

.task-bar__right {
  margin-left: auto;
}

.task-bar__status {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  gap: 6px;
}
.task-bar__status::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-success, #22c55e);
  flex-shrink: 0;
}

.task-bar__env-badge {
  font-size: 0.6875rem;
  padding: 1px 6px;
  border-radius: var(--radius-xs, 4px);
  border: 1px solid currentColor;
  opacity: 0.75;
  white-space: nowrap;
}

.task-bar__env-badge--Tauri {
  color: #4caf73;
}

.task-bar__env-badge--浏览器 {
  color: #5b9bd5;
}

.task-bar__env-badge--移动端浏览器 {
  color: #f0a030;
}

.task-bar__log-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: var(--radius-xs, 4px);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.task-bar__log-btn:hover {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
}
</style>
