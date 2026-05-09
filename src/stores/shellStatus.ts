import { defineStore } from 'pinia';
import { computed, reactive, ref, watch } from 'vue';
import { eventListen } from '@/composables/useEventBus';
import { useNavigationStore } from './navigation';
import { usePrefetchStore } from './prefetch';

export type TaskStatus = 'idle' | 'running' | 'success' | 'error' | 'warning';

export interface ShellTaskItem {
  id: string;
  name: string;
  module: string;
  status: TaskStatus;
  done: number;
  total: number;
  startedAt: number;
  endedAt?: number;
  phase?: string;
  error?: string;
}

export type ShellLogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface ShellLogItem {
  id: number;
  time: number;
  level: ShellLogLevel;
  module: string;
  message: string;
}

const MODULE_LABELS: Record<string, string> = {
  bookshelf: '书架',
  explore: '发现',
  search: '搜索',
  booksource: '书源管理',
  extensions: '插件管理',
  settings: '设置',
};

function normalizeLevel(level?: string, message?: string): ShellLogLevel {
  const fromLevel = (level || '').toUpperCase();
  if (
    fromLevel === 'DEBUG' ||
    fromLevel === 'INFO' ||
    fromLevel === 'WARN' ||
    fromLevel === 'ERROR'
  ) {
    return fromLevel;
  }

  const text = (message || '').toLowerCase();
  if (text.includes('error') || text.includes('失败') || text.includes('异常')) {
    return 'ERROR';
  }
  if (text.includes('warn') || text.includes('警告')) {
    return 'WARN';
  }
  if (text.includes('debug')) {
    return 'DEBUG';
  }
  return 'INFO';
}

export const useShellStatusStore = defineStore('shellStatus', () => {
  const navigationStore = useNavigationStore();
  const prefetchStore = usePrefetchStore();

  const state = reactive({
    showTaskCenter: false,
    showLogWindow: false,
    runningTasks: [] as ShellTaskItem[],
    queuedTasks: [] as ShellTaskItem[],
    completedTasks: [] as ShellTaskItem[],
    failedTasks: [] as ShellTaskItem[],
    logs: [] as ShellLogItem[],
    unreadErrorCount: 0,
  });

  const initialized = ref(false);
  const unlisteners: Array<() => void> = [];
  const activeTasks = new Map<string, ShellTaskItem>();
  let logId = 1;

  const currentModuleLabel = computed(
    () => MODULE_LABELS[navigationStore.activeView] || navigationStore.activeView,
  );

  const latestLog = computed(() => state.logs[state.logs.length - 1] ?? null);
  const latestLogLevel = computed<ShellLogLevel>(() => latestLog.value?.level ?? 'INFO');

  const summary = computed(() => ({
    running: state.runningTasks.length,
    queued: state.queuedTasks.length,
    failed: state.failedTasks.length,
    completed: state.completedTasks.length,
  }));

  const mainTask = computed<ShellTaskItem | null>(() => state.runningTasks[0] ?? null);

  function syncRunningTasks() {
    state.runningTasks = Array.from(activeTasks.values()).filter((t) => t.status === 'running');
  }

  function pushLog(level: ShellLogLevel, module: string, message: string) {
    state.logs.push({ id: logId++, time: Date.now(), level, module, message });
    if (state.logs.length > 1200) {
      state.logs.splice(0, state.logs.length - 1200);
    }
    if (!state.showLogWindow && level === 'ERROR') {
      state.unreadErrorCount += 1;
    }
  }

  function normalizeTaskName(): string {
    if (prefetchStore.manualBookName) {
      return `缓存《${prefetchStore.manualBookName}》`;
    }
    return '后台任务';
  }

  function upsertManualTask() {
    const taskId = prefetchStore.manualTaskId || '';
    if (!taskId) {
      return;
    }

    let task = activeTasks.get(taskId);
    if (!task) {
      task = {
        id: taskId,
        name: normalizeTaskName(),
        module: currentModuleLabel.value,
        status: 'running',
        done: 0,
        total: 0,
        startedAt: Date.now(),
        phase: '执行中',
      };
      activeTasks.set(taskId, task);
    }

    task.name = normalizeTaskName();
    task.done = prefetchStore.manualProgress.done;
    task.total = prefetchStore.manualProgress.total;
    task.phase = task.total > 0 ? `已完成 ${task.done}/${task.total}` : '执行中';
    task.status = 'running';
    syncRunningTasks();
  }

  function finishTask(taskId: string, status: TaskStatus, error?: string) {
    const task = activeTasks.get(taskId);
    if (!task) {
      return;
    }

    task.status = status;
    task.error = error;
    task.endedAt = Date.now();
    activeTasks.delete(taskId);
    syncRunningTasks();

    if (status === 'error') {
      state.failedTasks.unshift(task);
      state.failedTasks = state.failedTasks.slice(0, 20);
      return;
    }

    state.completedTasks.unshift(task);
    state.completedTasks = state.completedTasks.slice(0, 20);
  }

  function openTaskCenter() {
    state.showTaskCenter = true;
  }

  function closeTaskCenter() {
    state.showTaskCenter = false;
  }

  function toggleTaskCenter() {
    state.showTaskCenter = !state.showTaskCenter;
  }

  function openLogWindow() {
    state.showLogWindow = true;
    state.unreadErrorCount = 0;
  }

  function closeLogWindow() {
    state.showLogWindow = false;
  }

  function toggleLogWindow() {
    if (state.showLogWindow) {
      closeLogWindow();
    } else {
      openLogWindow();
    }
  }

  function clearLogs() {
    state.logs = [];
    state.unreadErrorCount = 0;
  }

  async function install() {
    if (initialized.value) {
      return;
    }
    initialized.value = true;

    watch(
      () => [
        prefetchStore.manualTaskId,
        prefetchStore.manualRunning,
        prefetchStore.manualProgress.done,
        prefetchStore.manualProgress.total,
        prefetchStore.manualBookName,
      ],
      () => {
        if (prefetchStore.manualRunning && prefetchStore.manualTaskId) {
          upsertManualTask();
          return;
        }
        if (!prefetchStore.manualRunning && prefetchStore.manualTaskId) {
          const done = prefetchStore.manualProgress.done;
          const total = prefetchStore.manualProgress.total;
          const status: TaskStatus = total > 0 && done >= total ? 'success' : 'warning';
          finishTask(prefetchStore.manualTaskId, status);
        }
      },
      { immediate: true },
    );

    unlisteners.push(
      await eventListen<{ taskId: string; error?: string }>('shelf:prefetch-done', (e) => {
        const error = e.payload.error?.trim();
        if (error) {
          finishTask(e.payload.taskId, 'error', error);
          pushLog('ERROR', 'prefetch', error);
          return;
        }
        finishTask(e.payload.taskId, 'success');
      }),
    );

    unlisteners.push(
      await eventListen<{ taskId: string; error?: string }>('shelf:prefetch-progress', (e) => {
        const error = e.payload.error?.trim();
        if (!error) {
          return;
        }
        finishTask(e.payload.taskId, 'error', error);
        pushLog('ERROR', 'prefetch', error);
      }),
    );

    unlisteners.push(
      await eventListen<{ message: string; level?: string }>('app:log', (e) => {
        pushLog(normalizeLevel(e.payload.level, e.payload.message), 'app', e.payload.message);
      }),
    );

    unlisteners.push(
      await eventListen<{ message: string }>('rust:log', (e) => {
        pushLog(normalizeLevel(undefined, e.payload.message), 'rust', e.payload.message);
      }),
    );

    unlisteners.push(
      await eventListen<{ message: string }>('script:log', (e) => {
        pushLog(normalizeLevel(undefined, e.payload.message), 'script', e.payload.message);
      }),
    );
  }

  function uninstall() {
    for (const unlisten of unlisteners.splice(0, unlisteners.length)) {
      unlisten();
    }
    initialized.value = false;
  }

  return {
    state,
    summary,
    mainTask,
    latestLog,
    latestLogLevel,
    currentModuleLabel,
    install,
    uninstall,
    openTaskCenter,
    closeTaskCenter,
    toggleTaskCenter,
    openLogWindow,
    closeLogWindow,
    toggleLogWindow,
    clearLogs,
  };
});
