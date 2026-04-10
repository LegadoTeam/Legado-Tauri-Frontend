<script setup lang="ts">
/**
 * ScriptDialog — 全局脚本交互弹窗，响应 Boa 引擎发出的弹窗请求
 *
 * 三种模式（kind）：
 *   info  — 只读信息展示
 *   input — 带输入框，关闭时将输入值发回 Rust
 *   repl  — 嵌入式 JS REPL，可双向与 Boa 引擎交互
 */
import { ref, computed, watch } from 'vue'
import { useScriptBridge, type DialogRequest } from '../composables/useScriptBridge'

const bridge = useScriptBridge()

// ── 当前正在显示的弹窗 ──────────────────────────────────────────────────
const current = computed<DialogRequest | null>(() =>
  bridge.state.dialogs.length > 0 ? bridge.state.dialogs[0] : null
)
const visible = computed(() => current.value !== null)

// ── input 模式 ──────────────────────────────────────────────────────────
const inputValue = ref('')

// ── repl 模式 ───────────────────────────────────────────────────────────
const replCode       = ref('')
const replOutput     = ref<string[]>([])
const replRunning    = ref(false)
const replContextFile = ref<string | undefined>(undefined)

// 每次弹窗打开时重置状态
watch(current, (req) => {
  if (!req) return
  inputValue.value    = ''
  replCode.value      = ''
  replOutput.value    = []
  replContextFile.value = undefined
  // 如果 content 是字符串，直接作为 repl 初始代码
  if (req.kind === 'repl' && typeof req.content === 'string') {
    replCode.value = req.content
  }
})

// ── 操作 ────────────────────────────────────────────────────────────────
function handleConfirm() {
  if (!current.value) return
  const returnValue = current.value.kind === 'input' ? inputValue.value : null
  bridge.resolveDialog(current.value.id, returnValue)
}

function handleClose() {
  if (!current.value) return
  bridge.resolveDialog(current.value.id, null)
}

async function runRepl() {
  if (!replCode.value.trim() || replRunning.value) return
  replRunning.value = true
  try {
    const result = await bridge.replEval(replCode.value, replContextFile.value)
    replOutput.value.push(`> ${result}`)
  } catch (e: unknown) {
    replOutput.value.push(`[错误] ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    replRunning.value = false
  }
  // 最多保留 500 行输出
  if (replOutput.value.length > 500) {
    replOutput.value = replOutput.value.slice(-400)
  }
}

function clearOutput() {
  replOutput.value = []
}

// 内容格式化：对象类型转 JSON 字符串
function formatContent(content: unknown): string {
  if (typeof content === 'string') return content
  try {
    return JSON.stringify(content, null, 2)
  } catch {
    return String(content)
  }
}
</script>

<template>
  <!-- info / input 弹窗 -->
  <n-modal
    v-if="current && current.kind !== 'repl'"
    :show="visible"
    :title="current.title"
    preset="dialog"
    :positive-text="current.kind === 'input' ? '确定' : '关闭'"
    :negative-text="current.kind === 'input' ? '取消' : undefined"
    @positive-click="handleConfirm"
    @negative-click="handleClose"
    @close="handleClose"
    :closable="true"
    class="script-dialog"
  >
    <div class="dialog-content">
      <!-- 只读内容 -->
      <pre
        v-if="current.kind === 'info'"
        class="dialog-info-text"
      >{{ formatContent(current.content) }}</pre>

      <!-- 输入框 -->
      <template v-else-if="current.kind === 'input'">
        <p v-if="current.content" class="dialog-desc">
          {{ formatContent(current.content) }}
        </p>
        <n-input
          v-model:value="inputValue"
          placeholder="请输入..."
          autofocus
          @keydown.enter="handleConfirm"
        />
      </template>
    </div>
  </n-modal>

  <!-- repl 弹窗（大尺寸） -->
  <n-modal
    v-if="current && current.kind === 'repl'"
    :show="visible"
    :title="current.title || 'JS REPL'"
    preset="card"
    :style="{ width: '760px', maxHeight: '90vh' }"
    @close="handleClose"
    :closable="true"
    class="repl-dialog"
  >
    <div class="repl-container">
      <!-- 上方：代码编辑区 -->
      <div class="repl-editor-area">
        <div class="repl-editor-header">
          <span class="repl-label">代码</span>
          <n-select
            v-model:value="replContextFile"
            placeholder="无书源上下文（可选）"
            clearable
            :options="[]"
            size="small"
            class="repl-ctx-select"
          />
          <n-button
            size="small"
            type="primary"
            :loading="replRunning"
            :disabled="!replCode.trim()"
            @click="runRepl"
          >
            运行
          </n-button>
        </div>
        <n-input
          v-model:value="replCode"
          type="textarea"
          :rows="8"
          placeholder="// 在此输入 JavaScript 代码&#10;// 可调用 legado.log(), legado.http.get() 等 API"
          :input-props="{ spellcheck: false, style: 'font-family: var(--font-mono, monospace); font-size: 13px;' }"
          @keydown.ctrl.enter.prevent="runRepl"
        />
        <div class="repl-hint">Ctrl+Enter 运行</div>
      </div>

      <!-- 下方：输出区 -->
      <div class="repl-output-area">
        <div class="repl-output-header">
          <span class="repl-label">输出</span>
          <n-button size="tiny" quaternary @click="clearOutput">清空</n-button>
        </div>
        <div class="repl-output-scroll">
          <div
            v-for="(line, i) in replOutput"
            :key="i"
            :class="['repl-output-line', { 'is-error': line.startsWith('[错误]') }]"
          >{{ line }}</div>
          <div v-if="replOutput.length === 0" class="repl-empty">运行代码后结果显示在这里</div>
        </div>
      </div>

      <!-- 实时日志（最后5条） -->
      <div v-if="bridge.state.logs.length > 0" class="repl-log-area">
        <div class="repl-label">脚本日志</div>
        <div
          v-for="(log, i) in bridge.state.logs.slice(-5)"
          :key="i"
          class="repl-log-line"
        >
          <span class="log-time">{{ new Date(log.time).toLocaleTimeString() }}</span>
          <span>{{ log.message }}</span>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="repl-footer">
        <n-button @click="handleClose">关闭</n-button>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
.dialog-content {
  padding: 4px 0;
}
.dialog-info-text {
  white-space: pre-wrap;
  word-break: break-all;
  font-family: var(--font-mono, monospace);
  font-size: 13px;
  color: var(--color-text-2, #ccc);
  max-height: 400px;
  overflow-y: auto;
  background: var(--color-bg-3, #1e1e1e);
  border-radius: 6px;
  padding: 12px;
  margin: 0;
}
.dialog-desc {
  margin: 0 0 8px;
  color: var(--color-text-2, #aaa);
  font-size: 13px;
}

/* ── REPL ── */
.repl-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.repl-editor-area,
.repl-output-area,
.repl-log-area {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.repl-editor-header,
.repl-output-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.repl-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-3, #888);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex-shrink: 0;
}
.repl-ctx-select {
  flex: 1;
  max-width: 220px;
}
.repl-hint {
  font-size: 11px;
  color: var(--color-text-4, #666);
  text-align: right;
}
.repl-output-scroll {
  background: var(--color-bg-3, #111);
  border-radius: 6px;
  padding: 10px 12px;
  min-height: 80px;
  max-height: 180px;
  overflow-y: auto;
  font-family: var(--font-mono, monospace);
  font-size: 13px;
}
.repl-output-line {
  color: var(--color-text-1, #e0e0e0);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
}
.repl-output-line.is-error {
  color: #ff6b6b;
}
.repl-empty {
  color: var(--color-text-4, #555);
  font-style: italic;
}
.repl-log-area {
  background: rgba(255, 200, 0, 0.04);
  border-radius: 6px;
  padding: 8px 12px;
  gap: 4px;
}
.repl-log-line {
  font-size: 12px;
  color: var(--color-text-3, #999);
  display: flex;
  gap: 8px;
}
.log-time {
  color: var(--color-text-4, #666);
  flex-shrink: 0;
}
.repl-footer {
  display: flex;
  justify-content: flex-end;
}
</style>
