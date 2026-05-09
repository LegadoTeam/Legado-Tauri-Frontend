<script setup lang="ts">
import type { ShellLogLevel } from '@/stores';

withDefaults(
  defineProps<{
    latestLogLevel?: ShellLogLevel;
    latestLogMessage?: string;
    /** Vue 前端版本号 */
    vueVersion?: string;
    /** Tauri 壳版本号（非 Tauri 环境传空字符串） */
    tauriVersion?: string;
    platformLabel?: string;
    /** 是否显示实时日志区域（由设置开关控制） */
    showLogZone?: boolean;
  }>(),
  {
    latestLogLevel: 'INFO',
    latestLogMessage: '',
    vueVersion: '0.0.0',
    tauriVersion: '',
    platformLabel: '-',
    showLogZone: false,
  },
);

const emit = defineEmits<{
  'toggle-log-window': [];
  'open-about': [];
}>();
</script>

<template>
  <footer class="task-bar" role="toolbar" aria-label="任务状态栏">
    <!-- Zone 1: 版本 + 平台 -->
    <button
      class="task-bar__meta-zone focusable"
      title="关于"
      aria-label="打开关于窗口"
      @click="emit('open-about')"
    >
      <!-- 前端（Vue）版本 -->
      <span class="task-bar__version">前端 v{{ vueVersion }}</span>
      <!-- Tauri 壳版本：仅 Tauri 环境显示；鸿蒙版本暂未对接，预留注释 -->
      <!-- TODO: 鸿蒙环境在此处显示鸿蒙版本号，待后续对接 HarmonyOS 版本 API -->
      <span v-if="tauriVersion" class="task-bar__version task-bar__version--tauri">壳 v{{ tauriVersion }}</span>
      <span class="task-bar__platform">{{ platformLabel }}</span>
    </button>

    <!-- Zone 2: 最新日志（仅设置中启用后显示，默认隐藏） -->
    <button
      v-if="showLogZone"
      class="task-bar__log-zone focusable"
      title="切换日志窗口"
      aria-label="切换日志窗口，查看最新日志"
      @click="emit('toggle-log-window')"
    >
      <span
        class="task-bar__log-level"
        :class="`task-bar__log-level--${latestLogLevel.toLowerCase()}`"
        >{{ latestLogLevel }}</span
      >
      <span class="task-bar__log-msg">{{ latestLogMessage || '暂无日志' }}</span>
    </button>

  </footer>
</template>

<style scoped>
.task-bar {
  grid-area: taskbar;
  height: var(--bottom-bar-height);
  padding: 0 var(--space-2);
  background: transparent;
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
  /* border-top: 1px solid var(--color-border); */
}

/* ── 通用按钮区域 ── */
.task-bar__meta-zone,
.task-bar__log-zone {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  height: 26px;
  padding: 0 var(--space-2);
  border: none;
  background: transparent;
  color: var(--color-text-soft);
  border-radius: var(--radius-1);
  cursor: pointer;
  transition: background 100ms ease;
  white-space: nowrap;
  overflow: hidden;
  min-width: 0;
  flex-shrink: 0;
}

.task-bar__meta-zone:hover,
.task-bar__log-zone:hover {
  background: var(--color-hover);
}

.task-bar__meta-zone:focus-visible,
.task-bar__log-zone:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 1px;
}

/* ── Zone 1: 版本 + 平台 ── */
.task-bar__meta-zone {
  flex-shrink: 0;
  gap: 6px;
}
.task-bar__version {
  font-size: var(--fs-11);
  font-weight: var(--fw-semibold);
  color: var(--color-text-soft);
  font-family: var(--font-mono, monospace);
}
.task-bar__version--tauri {
  color: var(--color-text-muted);
}
.task-bar__platform {
  font-size: var(--fs-11);
  color: var(--color-text-muted);
}

/* ── Zone 3: 最新日志 ── */
.task-bar__log-zone {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}
.task-bar__log-level {
  font-size: 10px;
  font-weight: 600;
  padding: 0 5px;
  border-radius: 999px;
  border: 1px solid currentColor;
  flex-shrink: 0;
  line-height: 16px;
}
.task-bar__log-level--debug {
  color: #8b8fa3;
}
.task-bar__log-level--info {
  color: #2563eb;
}
.task-bar__log-level--warn {
  color: #d97706;
}
.task-bar__log-level--error {
  color: #dc2626;
}
.task-bar__log-msg {
  font-size: var(--fs-12);
  color: var(--color-text-soft);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

/* ── 响应式隐藏 ── */
@media (max-width: 700px) {
  .task-bar__meta-zone .task-bar__platform {
    display: none;
  }
}
@media (max-width: 500px) {
  .task-bar__meta-zone {
    display: none;
  }
}
</style>
