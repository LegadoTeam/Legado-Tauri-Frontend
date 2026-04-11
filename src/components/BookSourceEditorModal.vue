<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { isMobile } from '@/composables/useEnv'

const props = defineProps<{
  show: boolean
  title: string
  content: string
  fileName: string
  saving: boolean
  reloaded: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  'update:content': [value: string]
  save: []
  'open-vscode': []
}>()

const visible = computed({
  get: () => props.show,
  set: (v) => emit('update:show', v),
})

const code = computed({
  get: () => props.content,
  set: (v) => emit('update:content', v),
})

const textareaRef = ref<HTMLTextAreaElement | null>()

watch(
  () => props.show,
  async (v) => {
    if (v) {
      await nextTick()
      textareaRef.value?.focus()
    }
  },
)

/* Ctrl/Cmd+S 快捷保存 */
function onKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    if (!props.saving) emit('save')
  }
}

/* Tab 键插入两个空格 */
function onTab(e: KeyboardEvent) {
  if (e.key !== 'Tab') return
  e.preventDefault()
  const ta = e.target as HTMLTextAreaElement
  const start = ta.selectionStart
  const end = ta.selectionEnd
  const indent = '  '
  code.value = code.value.substring(0, start) + indent + code.value.substring(end)
  nextTick(() => {
    ta.selectionStart = ta.selectionEnd = start + indent.length
  })
}
</script>

<template>
  <n-modal v-model:show="visible" preset="card" :title="title" :bordered="false" :mask-closable="false"
    :style="{ width: isMobile ? '95vw' : '80vw', height: isMobile ? '90vh' : '85vh' }" content-style="padding:0;display:flex;flex-direction:column;overflow:hidden">
    <!-- 工具栏 -->
    <template #header-extra>
      <n-space :size="8">
        <n-tag v-if="reloaded" type="warning" size="small" :bordered="false">文件已变更</n-tag>
        <n-button size="small" quaternary :disabled="!fileName" @click="emit('open-vscode')">
          VS Code 打开
        </n-button>
        <n-button size="small" type="primary" :loading="saving" @click="emit('save')">
          保存
        </n-button>
      </n-space>
    </template>

    <!-- 编辑区 -->
    <textarea
      ref="textareaRef"
      :value="code"
      class="source-editor-textarea"
      spellcheck="false"
      autocomplete="off"
      autocorrect="off"
      autocapitalize="off"
      @input="code = ($event.target as HTMLTextAreaElement).value"
      @keydown="onKeydown"
      @keydown.tab="onTab"
    />
  </n-modal>
</template>

<style scoped>
.source-editor-textarea {
  flex: 1;
  width: 100%;
  resize: none;
  border: none;
  outline: none;
  padding: 12px 16px;
  font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  line-height: 1.6;
  tab-size: 2;
  color: var(--n-text-color, #333);
  background: var(--n-color, #fff);
  overflow: auto;
  white-space: pre;
  word-wrap: normal;
}

/* 暗色主题下调整 */
:root.dark .source-editor-textarea,
.n-config-provider[data-theme="dark"] .source-editor-textarea {
  color: #d4d4d4;
  background: #1e1e1e;
}
</style>
