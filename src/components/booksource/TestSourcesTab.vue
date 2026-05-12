<script setup lang="ts">
import { ref, nextTick, watch, computed, onMounted, onUnmounted } from 'vue';
import { useDialog } from 'naive-ui';
import { eventListen } from '../../composables/useEventBus';
import {
  type BookSourceMeta,
  type TestStepResult,
  runBookSourceTests,
  deleteBookSource,
} from '../../composables/useBookSource';

const props = defineProps<{
  sources: BookSourceMeta[];
}>();

const emits = defineEmits<{
  reload: [];
}>();

const dialog = useDialog();
const deletingSet = ref(new Set<string>());

// ---- 测试状态 ----
interface TestSourceState {
  fileName: string;
  status: 'idle' | 'running' | 'done';
  steps: TestStepResult[];
  allPassed: boolean | null;
  /** 该书源产生的日志行 */
  logs: string[];
}

const testStates = ref<Map<string, TestSourceState>>(new Map());
const testRunning = ref(false);
/** 批量测试全局日志（开始/结束横幅） */
const batchLogs = ref<string[]>([]);
/** 日志过滤：全部 / 成功 / 失败 */
const logFilter = ref<'all' | 'pass' | 'fail'>('all');
const testProgress = ref({ current: 0, total: 0 });
const testLogContainer = ref<HTMLDivElement | null>(null);

// ---- 设置 ----
/** 单书源超时（秒），传给引擎 */
const itemTimeoutSecs = ref(30);
/** 批量总超时（秒），0 表示无限制 */
const totalTimeoutSecs = ref(0);
/** 最大并发数 */
const concurrency = ref(5);

function createTestState(fileName: string): TestSourceState {
  return { fileName, status: 'idle', steps: [], allPassed: null, logs: [] };
}

// ---- 实时日志订阅 ----
/** 当前正在运行测试的 fileName 集合，用于路由实时日志 */
const runningFileNames = new Set<string>();
let unlistenLog: (() => void) | null = null;
let unlistenHttp: (() => void) | null = null;

/** 根据书源名（sourceName）找到当前正在运行的所有对应 state */
function findRunningStatesBySourceName(sourceName: string): TestSourceState[] {
  const result: TestSourceState[] = [];
  for (const src of props.sources) {
    if (src.name === sourceName && runningFileNames.has(src.fileName)) {
      const state = testStates.value.get(src.fileName);
      if (state) result.push(state);
    }
  }
  return result;
}

/** 订阅书源实时日志事件（组件生命周期内保持订阅） */
async function subscribeTestLogs() {
  unlistenLog = await eventListen<{ message: string; sourceName?: string }>(
    'script:log',
    (e) => {
      const { message, sourceName } = e.payload;
      if (!sourceName) return;
      for (const state of findRunningStatesBySourceName(sourceName)) {
        pushLog(state, `  · ${message}`);
      }
    },
  );

  unlistenHttp = await eventListen<{
    url: string;
    method: string;
    ok: boolean;
    status?: number;
    elapsed?: number;
    error?: string;
    sourceName?: string;
  }>('script:http', (e) => {
    const p = e.payload;
    if (!p.sourceName) return;
    const sc = p.status ? ` ${p.status}` : '';
    const ms = p.elapsed != null ? ` (${p.elapsed}ms)` : '';
    const errPart = p.error ? ` → ${p.error}` : '';
    const line = `  [http] ${p.ok ? '✓' : '✗'}${sc} ${p.method} ${p.url}${ms}${errPart}`;
    for (const state of findRunningStatesBySourceName(p.sourceName)) {
      pushLog(state, line);
    }
  });
}

function unsubscribeTestLogs() {
  unlistenLog?.();
  unlistenLog = null;
  unlistenHttp?.();
  unlistenHttp = null;
}

function initTestStates() {
  const map = new Map<string, TestSourceState>();
  for (const src of props.sources) {
    if (src.enabled) {
      map.set(src.fileName, createTestState(src.fileName));
      continue;
    }
    const existing = testStates.value.get(src.fileName);
    if (existing) map.set(src.fileName, existing);
  }
  testStates.value = map;
}

function ensureTestState(fileName: string): TestSourceState {
  const existing = testStates.value.get(fileName);
  if (existing) return existing;
  const state = createTestState(fileName);
  testStates.value.set(fileName, state);
  return state;
}

watch(
  () => props.sources.map((src) => `${src.fileName}:${src.enabled}`).join('|'),
  () => {
    const next = new Map<string, TestSourceState>();
    for (const src of props.sources) {
      if (src.enabled) {
        next.set(src.fileName, testStates.value.get(src.fileName) ?? createTestState(src.fileName));
        continue;
      }
      const existing = testStates.value.get(src.fileName);
      if (existing) next.set(src.fileName, existing);
    }
    testStates.value = next;
  },
  { immediate: true },
);

onMounted(() => {
  subscribeTestLogs();
});

onUnmounted(() => {
  unsubscribeTestLogs();
});

function scrollLogToBottom() {
  nextTick(() => {
    const el = testLogContainer.value;
    if (el) el.scrollTop = el.scrollHeight;
  });
}

/** 向某书源的日志追加一行 */
function pushLog(state: TestSourceState, msg: string) {
  const ts = new Date().toLocaleTimeString();
  state.logs.push(`[${ts}] ${msg}`);
  scrollLogToBottom();
}

/** 追加全局批量日志（开始/结束横幅） */
function pushBatchLog(msg: string) {
  const ts = new Date().toLocaleTimeString();
  batchLogs.value.push(`[${ts}] ${msg}`);
  scrollLogToBottom();
}

// ---- 计算属性 ----
const passCount = computed(
  () => [...testStates.value.values()].filter((s) => s.allPassed === true).length,
);
const failCount = computed(
  () => [...testStates.value.values()].filter((s) => s.allPassed === false).length,
);

/** 按日志过滤器生成当前应显示的日志行 */
const filteredLogs = computed(() => {
  const lines: string[] = [];
  // 批量测试起始横幅（第一行）
  if (batchLogs.value.length > 0) lines.push(batchLogs.value[0]);

  for (const state of testStates.value.values()) {
    if (state.logs.length === 0) continue;
    if (logFilter.value === 'pass' && state.allPassed !== true) continue;
    if (logFilter.value === 'fail' && state.allPassed !== false) continue;
    lines.push(...state.logs);
  }

  // 批量测试结束横幅（第二行及以后）
  if (batchLogs.value.length > 1) lines.push(...batchLogs.value.slice(1));
  return lines;
});

// ---- 测试执行 ----
async function runSingleTest(fileName: string) {
  const state = ensureTestState(fileName);
  state.status = 'running';
  state.steps = [];
  state.allPassed = null;
  state.logs = [];
  runningFileNames.add(fileName);
  pushLog(state, `▶ 开始测试: ${props.sources.find((s) => s.fileName === fileName)?.name ?? fileName}`);

  try {
    const result = await runBookSourceTests(fileName, itemTimeoutSecs.value);
    state.steps = result.steps;
    state.allPassed = result.allPassed;
    state.status = 'done';
    for (const step of result.steps) {
      const icon = step.passed ? '✓' : '✗';
      pushLog(state, `  ${icon} [${step.step}] ${step.message} (${step.durationMs}ms)`);
    }
    pushLog(state, `  ${result.allPassed ? '✅ 全部通过' : '❌ 存在失败'}`);
  } catch (e: unknown) {
    state.status = 'done';
    state.allPassed = false;
    pushLog(state, `  ✗ 测试异常: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    runningFileNames.delete(fileName);
  }
}

async function runAllTests() {
  testRunning.value = true;
  batchLogs.value = [];
  initTestStates();
  const fileNames = [...testStates.value.keys()];
  testProgress.value = { current: 0, total: fileNames.length };

  const concurrencyVal = Math.max(1, concurrency.value);
  pushBatchLog(
    `═══ 开始批量测试 (${fileNames.length} 个书源, 并发: ${concurrencyVal}${totalTimeoutSecs.value > 0 ? `, 总超时: ${totalTimeoutSecs.value}s` : ''}) ═══`,
  );

  const startTime = Date.now();
  let aborted = false;
  const cursor = { next: 0 };

  async function worker() {
    for (;;) {
      if (aborted) break;
      const idx = cursor.next++;
      if (idx >= fileNames.length) break;
      // oxlint-disable-next-line no-await-in-loop -- intentional sequential per-worker
      try {
        await runSingleTest(fileNames[idx]);
      } catch {
        // runSingleTest 内部已有 try/catch，此处只做最后兜底，防止单个异常令 Promise.all 提前 reject
      }
      testProgress.value.current++;
      if (totalTimeoutSecs.value > 0 && Date.now() - startTime > totalTimeoutSecs.value * 1000) {
        aborted = true;
        break;
      }
    }
  }

  try {
    await Promise.all(Array.from({ length: Math.min(concurrencyVal, fileNames.length) }, worker));
  } finally {
    const suffix = aborted ? ' (已超时中断)' : '';
    pushBatchLog(
      `═══ 测试完成: ${passCount.value} 通过, ${failCount.value} 失败, ${[...testStates.value.values()].filter((s) => s.allPassed === null).length} 跳过${suffix} ═══`,
    );
    testRunning.value = false;
  }
}

function clearLogs() {
  batchLogs.value = [];
  for (const state of testStates.value.values()) state.logs = [];
}

function confirmDeleteSource(src: BookSourceMeta) {
  dialog.warning({
    title: '删除书源',
    content: `确认删除「${src.name || src.fileName}」？此操作将删除磁盘文件，不可恢复。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      deletingSet.value.add(src.fileName);
      try {
        await deleteBookSource(src.fileName, src.sourceDir);
        emits('reload');
      } catch (e: unknown) {
        dialog.error({
          title: '删除失败',
          content: e instanceof Error ? e.message : String(e),
          positiveText: '确定',
        });
      } finally {
        deletingSet.value.delete(src.fileName);
      }
    },
  });
}
</script>

<template>
  <div class="bv-pane bv-pane--fill">
    <!-- 顶部工具栏 -->
    <div class="bv-test__toolbar">
      <n-button
        type="primary"
        size="small"
        :loading="testRunning"
        :disabled="testRunning"
        @click="runAllTests"
      >
        {{ testRunning ? '测试中...' : '全部测试' }}
      </n-button>
      <span v-if="testRunning" class="bv-test__progress">
        {{ testProgress.current }} / {{ testProgress.total }}
      </span>
      <span v-else-if="testStates.size > 0" class="bv-test__progress">
        ✅ {{ passCount }} ❌ {{ failCount }}
      </span>

      <!-- 设置区 -->
      <div class="bv-test__settings">
        <span class="bv-test__settings-label">并发</span>
        <n-input-number
          v-model:value="concurrency"
          :min="1"
          :max="20"
          size="small"
          class="bv-test__settings-input"
          :disabled="testRunning"
        />
        <span class="bv-test__settings-label">单项超时</span>
        <n-input-number
          v-model:value="itemTimeoutSecs"
          :min="5"
          :max="600"
          size="small"
          class="bv-test__settings-input"
          :disabled="testRunning"
        />
        <span class="bv-test__settings-label">s</span>
        <span class="bv-test__settings-label" style="margin-left: 4px">总超时</span>
        <n-input-number
          v-model:value="totalTimeoutSecs"
          :min="0"
          :max="3600"
          size="small"
          class="bv-test__settings-input"
          :disabled="testRunning"
          placeholder="0=无限"
        />
        <span class="bv-test__settings-label">s</span>
      </div>
    </div>

    <!-- 双栏布局：书源列表 + 日志 -->
    <div class="bv-test__body">
      <!-- 左侧：书源列表 -->
      <div class="bv-test__list app-scrollbar">
        <div
          v-for="src in sources"
          :key="'test-' + src.fileName"
          class="bv-test__item"
          :class="{
            'bv-test__item--running': testStates.get(src.fileName)?.status === 'running',
            'bv-test__item--pass': testStates.get(src.fileName)?.allPassed === true,
            'bv-test__item--fail': testStates.get(src.fileName)?.allPassed === false,
          }"
        >
          <div class="bv-test__item-header">
            <span class="bv-test__item-name">{{ src.name || src.fileName }}</span>
            <div class="bv-test__item-actions">
              <n-button
                size="tiny"
                quaternary
                type="error"
                :loading="deletingSet.has(src.fileName)"
                :disabled="testRunning"
                @click="confirmDeleteSource(src)"
              >
                删除
              </n-button>
              <n-button
                size="tiny"
                quaternary
                :disabled="testRunning"
                @click="runSingleTest(src.fileName)"
              >
                测试
              </n-button>
            </div>
          </div>
          <!-- 步骤进度指示 -->
          <div v-if="testStates.has(src.fileName)" class="bv-test__steps">
            <span
              v-for="step in testStates.get(src.fileName)?.steps ?? []"
              :key="step.step"
              class="bv-test__step"
              :class="step.passed ? 'bv-test__step--pass' : 'bv-test__step--fail'"
              :title="step.message"
            >
              {{ step.passed ? '✓' : '✗' }}
              {{
                {
                  search: '搜索',
                  bookInfo: '详情',
                  chapterList: '目录',
                  chapterContent: '正文',
                  explore: '发现',
                }[step.step] || step.step
              }}
            </span>
            <n-spin
              v-if="testStates.get(src.fileName)?.status === 'running'"
              :size="12"
              style="margin-left: 4px"
            />
          </div>
        </div>
      </div>

      <!-- 右侧：日志面板 -->
      <div class="bv-test__log">
        <div class="bv-test__log-header">
          <!-- 过滤标签 -->
          <n-radio-group v-model:value="logFilter" size="small">
            <n-radio-button value="all">全部</n-radio-button>
            <n-radio-button value="pass">成功 ({{ passCount }})</n-radio-button>
            <n-radio-button value="fail">失败 ({{ failCount }})</n-radio-button>
          </n-radio-group>
          <n-button size="tiny" quaternary @click="clearLogs">清空</n-button>
        </div>
        <div ref="testLogContainer" class="bv-test__log-body app-scrollbar">
          <div v-if="filteredLogs.length === 0" class="bv-test__log-empty">
            暂无日志，点击"全部测试"开始
          </div>
          <div
            v-for="(log, i) in filteredLogs"
            :key="i"
            class="bv-test__log-line"
            :class="{
              'bv-test__log-line--pass': log.includes('✅') || (log.includes('✓') && !log.startsWith('  [http]')),
              'bv-test__log-line--fail': log.includes('❌') || (log.includes('✗') && !log.startsWith('  [http]')),
              'bv-test__log-line--banner': log.includes('═══'),
              'bv-test__log-line--http-ok': log.startsWith('  [http] ✓'),
              'bv-test__log-line--http-err': log.startsWith('  [http] ✗'),
              'bv-test__log-line--detail': log.startsWith('  ·') || log.startsWith('  [http]'),
            }"
          >{{ log }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bv-pane {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
  padding-top: 12px;
}
.bv-pane--fill {
  flex: 1;
}

.bv-test__toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-shrink: 0;
  flex-wrap: wrap;
}
.bv-test__progress {
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
}
.bv-test__settings {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  flex-wrap: wrap;
}
.bv-test__settings-label {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  white-space: nowrap;
}
.bv-test__settings-input {
  width: 88px;
}

.bv-test__body {
  flex: 1;
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 12px;
  overflow: hidden;
  min-height: 0;
}
.bv-test__list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
  padding-right: 4px;
}
.bv-test__item {
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  transition: border-color var(--transition-fast);
}
.bv-test__item--running {
  border-color: var(--color-accent);
}
.bv-test__item--pass {
  border-left: 3px solid #22c55e;
}
.bv-test__item--fail {
  border-left: 3px solid var(--color-danger);
}
.bv-test__item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.bv-test__item-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.bv-test__item-name {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.bv-test__steps {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  margin-top: 4px;
  align-items: center;
}
.bv-test__step {
  font-size: 0.6875rem;
  color: var(--color-text-muted);
  white-space: nowrap;
}
.bv-test__step--pass {
  color: #22c55e;
}
.bv-test__step--fail {
  color: var(--color-danger);
}
.bv-test__log {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  min-height: 0;
}
.bv-test__log-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: var(--color-surface-raised);
  border-bottom: 1px solid var(--color-border);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  flex-shrink: 0;
  gap: 8px;
}
.bv-test__log-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 10px;
  font-family: 'Cascadia Code', 'Consolas', monospace;
  font-size: 0.75rem;
  line-height: 1.6;
  color: var(--color-text-secondary);
  background: var(--color-surface);
}
.bv-test__log-empty {
  color: var(--color-text-muted);
  font-style: italic;
  padding: 24px 0;
  text-align: center;
  font-family: inherit;
}
.bv-test__log-line {
  white-space: pre-wrap;
  word-break: break-all;
}
.bv-test__log-line--pass {
  color: #22c55e;
}
.bv-test__log-line--fail {
  color: var(--color-danger);
}
.bv-test__log-line--banner {
  color: var(--color-text-secondary);
  font-weight: 500;
  opacity: 0.85;
}
.bv-test__log-line--detail {
  opacity: 0.65;
  font-size: 0.7rem;
}
.bv-test__log-line--http-ok {
  color: #22c55e;
  opacity: 0.65;
}
.bv-test__log-line--http-err {
  color: var(--color-danger);
  opacity: 0.65;
}

@media (pointer: coarse), (max-width: 640px) {
  .bv-test__body {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }
  .bv-test__list {
    max-height: 35vh;
  }
  .bv-test__settings {
    margin-left: 0;
  }
}
</style>
