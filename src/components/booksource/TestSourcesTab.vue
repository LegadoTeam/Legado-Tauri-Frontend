<script setup lang="ts">
import { ref, nextTick } from 'vue'
import {
  type BookSourceMeta,
  type TestStepResult,
  runBookSourceTests,
} from '../../composables/useBookSource'

const props = defineProps<{
  sources: BookSourceMeta[]
}>()

// ---- 测试状态 ----
interface TestSourceState {
  fileName: string
  status: 'idle' | 'running' | 'done'
  steps: TestStepResult[]
  allPassed: boolean | null
}

const testStates = ref<Map<string, TestSourceState>>(new Map())
const testRunning = ref(false)
const testLogs = ref<string[]>([])
const testProgress = ref({ current: 0, total: 0 })
const testLogContainer = ref<HTMLDivElement | null>(null)

/** 为每个已启用书源初始化测试状态 */
function initTestStates() {
  const map = new Map<string, TestSourceState>()
  for (const src of props.sources) {
    if (src.enabled) {
      map.set(src.fileName, {
        fileName: src.fileName,
        status: 'idle',
        steps: [],
        allPassed: null,
      })
    }
  }
  testStates.value = map
}

function pushTestLog(msg: string) {
  const ts = new Date().toLocaleTimeString()
  testLogs.value.push(`[${ts}] ${msg}`)
  nextTick(() => {
    const el = testLogContainer.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

async function runSingleTest(fileName: string) {
  const state = testStates.value.get(fileName)
  if (!state) return
  state.status = 'running'
  state.steps = []
  state.allPassed = null
  pushTestLog(`▶ 开始测试: ${props.sources.find(s => s.fileName === fileName)?.name ?? fileName}`)

  try {
    const result = await runBookSourceTests(fileName)
    state.steps = result.steps
    state.allPassed = result.allPassed
    state.status = 'done'
    for (const step of result.steps) {
      const icon = step.passed ? '✓' : '✗'
      pushTestLog(`  ${icon} [${step.step}] ${step.message} (${step.durationMs}ms)`)
    }
    pushTestLog(`  ${result.allPassed ? '✅ 全部通过' : '❌ 存在失败'}`)
  } catch (e: unknown) {
    state.status = 'done'
    state.allPassed = false
    const msg = e instanceof Error ? e.message : String(e)
    pushTestLog(`  ✗ 测试异常: ${msg}`)
  }
}

async function runAllTests() {
  testRunning.value = true
  testLogs.value = []
  initTestStates()
  const fileNames = [...testStates.value.keys()]
  testProgress.value = { current: 0, total: fileNames.length }
  pushTestLog(`═══ 开始批量测试 (${fileNames.length} 个书源) ═══`)

  for (const fn of fileNames) {
    testProgress.value.current++
    await runSingleTest(fn)
  }

  const passed = [...testStates.value.values()].filter(s => s.allPassed === true).length
  const failed = [...testStates.value.values()].filter(s => s.allPassed === false).length
  const skipped = [...testStates.value.values()].filter(s => s.allPassed === null).length
  pushTestLog(`═══ 测试完成: ${passed} 通过, ${failed} 失败, ${skipped} 跳过 ═══`)
  testRunning.value = false
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
        ✅ {{ [...testStates.values()].filter(s => s.allPassed === true).length }}
        ❌ {{ [...testStates.values()].filter(s => s.allPassed === false).length }}
      </span>
    </div>

    <!-- 双栏布局：书源列表 + 日志 -->
    <div class="bv-test__body">
      <!-- 左侧：书源列表 -->
      <div class="bv-test__list">
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
            <n-button
              size="tiny"
              quaternary
              :disabled="testRunning"
              @click="runSingleTest(src.fileName)"
            >
              测试
            </n-button>
          </div>
          <!-- 步骤进度指示 -->
          <div v-if="testStates.has(src.fileName)" class="bv-test__steps">
            <span
              v-for="step in (testStates.get(src.fileName)?.steps ?? [])"
              :key="step.step"
              class="bv-test__step"
              :class="step.passed ? 'bv-test__step--pass' : 'bv-test__step--fail'"
              :title="step.message"
            >
              {{ step.passed ? '✓' : '✗' }} {{ { search: '搜索', bookInfo: '详情', chapterList: '目录', chapterContent: '正文', explore: '发现' }[step.step] || step.step }}
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
          <span>测试日志</span>
          <n-button size="tiny" quaternary @click="testLogs = []">清空</n-button>
        </div>
        <div ref="testLogContainer" class="bv-test__log-body">
          <div v-if="testLogs.length === 0" class="bv-test__log-empty">暂无日志，点击"全部测试"开始</div>
          <div v-for="(log, i) in testLogs" :key="i" class="bv-test__log-line">{{ log }}</div>
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
.bv-pane--fill { flex: 1; }

.bv-test__toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-shrink: 0;
}
.bv-test__progress {
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
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
.bv-test__list::-webkit-scrollbar { width: 4px; }
.bv-test__list::-webkit-scrollbar-track { background: transparent; }
.bv-test__list::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 2px; }
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
.bv-test__log-body::-webkit-scrollbar { width: 4px; }
.bv-test__log-body::-webkit-scrollbar-track { background: transparent; }
.bv-test__log-body::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 2px; }
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

@media (pointer: coarse), (max-width: 640px) {
  .bv-test__body {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }
  .bv-test__list {
    max-height: 35vh;
  }
}
</style>
