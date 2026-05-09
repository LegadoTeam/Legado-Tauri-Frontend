<script setup lang="ts">
import { computed } from 'vue';
import type { ShellTaskItem } from '@/stores';
import { useOverlayBackstack } from '@/composables/useOverlayBackstack';

const props = withDefaults(
  defineProps<{
    show?: boolean;
    runningTasks?: ShellTaskItem[];
    queuedTasks?: ShellTaskItem[];
    completedTasks?: ShellTaskItem[];
    failedTasks?: ShellTaskItem[];
  }>(),
  {
    show: false,
    runningTasks: () => [],
    queuedTasks: () => [],
    completedTasks: () => [],
    failedTasks: () => [],
  },
);

const emit = defineEmits<{
  'update:show': [value: boolean];
  close: [];
  'open-log': [];
}>();

const hasAnyTask = computed(
  () =>
    props.runningTasks.length > 0 ||
    props.queuedTasks.length > 0 ||
    props.completedTasks.length > 0 ||
    props.failedTasks.length > 0,
);

function close() {
  emit('update:show', false);
  emit('close');
}

useOverlayBackstack(() => props.show, close);

function formatDuration(task: ShellTaskItem): string {
  const end = task.endedAt ?? Date.now();
  const ms = Math.max(0, end - task.startedAt);
  const sec = Math.floor(ms / 1000);
  if (sec < 60) {
    return `${sec}s`;
  }
  const min = Math.floor(sec / 60);
  const remain = sec % 60;
  return `${min}m ${remain}s`;
}

function taskPercent(task: ShellTaskItem): number {
  if (task.total <= 0) {
    return 0;
  }
  return Math.min(100, Math.floor((task.done / task.total) * 100));
}
</script>

<template>
  <Teleport to="body">
    <Transition name="tc-fade">
      <div v-if="show" class="tc-backdrop" @click.self="close" />
    </Transition>
    <Transition name="tc-slide">
      <div v-if="show" class="tc-panel" role="dialog" aria-label="任务中心" aria-modal="true">
        <header class="tc-header">
          <h3 class="tc-title">任务中心</h3>
          <button class="tc-close focusable" aria-label="关闭任务中心" @click="close">✕</button>
        </header>

        <div v-if="!hasAnyTask" class="tc-empty">
          <span class="tc-empty__icon">📋</span>
          <p class="tc-empty__text">当前没有任务记录</p>
        </div>

        <div v-else class="tc-content app-scrollbar">
          <section v-if="runningTasks.length > 0" class="tc-block" aria-label="运行中任务">
            <h4 class="tc-block__title"><span class="tc-dot tc-dot--running" />运行中</h4>
            <article v-for="task in runningTasks" :key="task.id" class="tc-item tc-item--running">
              <div class="tc-item__row">
                <strong class="tc-item__name">{{ task.name }}</strong>
                <span class="tc-item__meta">{{ task.module }}</span>
              </div>
              <div class="tc-item__row tc-item__row--sub">
                <span>{{ task.phase || '执行中' }}</span>
                <span>{{ formatDuration(task) }}</span>
              </div>
              <div class="tc-item__progress" role="progressbar" :aria-valuenow="taskPercent(task)">
                <i :style="{ width: `${taskPercent(task)}%` }" />
              </div>
            </article>
          </section>

          <section v-if="queuedTasks.length > 0" class="tc-block" aria-label="排队任务">
            <h4 class="tc-block__title"><span class="tc-dot tc-dot--queued" />队列中</h4>
            <article v-for="task in queuedTasks" :key="task.id" class="tc-item">
              <div class="tc-item__row">
                <strong class="tc-item__name">{{ task.name }}</strong>
                <span class="tc-item__meta">{{ task.module }}</span>
              </div>
            </article>
          </section>

          <section v-if="failedTasks.length > 0" class="tc-block" aria-label="失败任务">
            <h4 class="tc-block__title"><span class="tc-dot tc-dot--error" />失败任务</h4>
            <article v-for="task in failedTasks" :key="task.id" class="tc-item tc-item--error">
              <div class="tc-item__row">
                <strong class="tc-item__name">{{ task.name }}</strong>
                <span class="tc-item__meta">{{ task.module }}</span>
              </div>
              <p class="tc-item__error">{{ task.error || '任务执行失败' }}</p>
              <div class="tc-item__actions">
                <button class="focusable" @click="emit('open-log')">查看日志</button>
              </div>
            </article>
          </section>

          <section v-if="completedTasks.length > 0" class="tc-block" aria-label="最近完成任务">
            <h4 class="tc-block__title"><span class="tc-dot tc-dot--done" />最近完成</h4>
            <article v-for="task in completedTasks" :key="task.id" class="tc-item tc-item--done">
              <div class="tc-item__row">
                <strong class="tc-item__name">{{ task.name }}</strong>
                <span class="tc-item__meta">{{ formatDuration(task) }}</span>
              </div>
              <div class="tc-item__row tc-item__row--sub">
                <span>{{ task.module }}</span>
                <span>{{ task.endedAt ? new Date(task.endedAt).toLocaleTimeString() : '' }}</span>
              </div>
            </article>
          </section>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ── backdrop ── */
.tc-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9000;
  background: rgba(0, 0, 0, 0.45);
}

/* ── panel ── */
.tc-panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 9001;
  width: min(100vw, 380px);
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border-left: 1px solid var(--color-border);
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.3);
}

/* ── header ── */
.tc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.tc-title {
  margin: 0;
  font-size: var(--fs-15);
  font-weight: 600;
}

.tc-close {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  background: transparent;
  border-radius: var(--radius-1);
  font-size: var(--fs-13);
  cursor: pointer;
  color: var(--color-text-muted);
  line-height: 1;
}

.tc-close:hover {
  background: var(--color-border);
  color: var(--color-text);
}

/* ── empty state ── */
.tc-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  color: var(--color-text-muted);
}

.tc-empty__icon {
  font-size: 2.5rem;
  line-height: 1;
}

.tc-empty__text {
  margin: 0;
  font-size: var(--fs-14);
}

/* ── content ── */
.tc-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* ── block ── */
.tc-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.tc-block__title {
  margin: 0;
  font-size: var(--fs-12);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

/* ── status dots ── */
.tc-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tc-dot--running {
  background: var(--color-accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 30%, transparent);
}

.tc-dot--queued {
  background: var(--color-text-muted);
}

.tc-dot--error {
  background: var(--color-danger);
}

.tc-dot--done {
  background: var(--color-success, #4ade80);
}

/* ── item ── */
.tc-item {
  border-radius: var(--radius-2);
  border: 1px solid var(--color-border);
  padding: var(--space-2) var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.tc-item__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  min-width: 0;
}

.tc-item__row--sub {
  color: var(--color-text-muted);
  font-size: var(--fs-12);
}

.tc-item__name {
  font-size: var(--fs-13);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tc-item__meta {
  color: var(--color-text-muted);
  font-size: var(--fs-12);
  white-space: nowrap;
  flex-shrink: 0;
}

.tc-item__progress {
  height: 4px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-border) 80%, transparent);
  overflow: hidden;
  margin-top: var(--space-1);
}

.tc-item__progress i {
  display: block;
  height: 100%;
  background: var(--color-accent);
  transition: width 0.3s ease;
}

.tc-item__error {
  margin: 0;
  color: var(--color-danger);
  font-size: var(--fs-12);
  line-height: 1.4;
}

.tc-item__actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-1);
}

.tc-item__actions button {
  border: 1px solid var(--color-border);
  background: transparent;
  border-radius: var(--radius-1);
  height: 1.75rem;
  padding: 0 var(--space-2);
  font-size: var(--fs-12);
  cursor: pointer;
  color: var(--color-text);
}

.tc-item__actions button:hover {
  background: var(--color-border);
}

.tc-item--error {
  border-color: color-mix(in srgb, var(--color-danger) 40%, var(--color-border));
}

.tc-item--done {
  border-color: color-mix(in srgb, var(--color-success, #4ade80) 30%, var(--color-border));
  opacity: 0.8;
}

/* ── animations ── */
.tc-fade-enter-active,
.tc-fade-leave-active {
  transition: opacity 0.2s ease;
}

.tc-fade-enter-from,
.tc-fade-leave-to {
  opacity: 0;
}

.tc-slide-enter-active,
.tc-slide-leave-active {
  transition: transform 0.25s ease;
}

.tc-slide-enter-from,
.tc-slide-leave-to {
  transform: translateX(100%);
}
</style>
