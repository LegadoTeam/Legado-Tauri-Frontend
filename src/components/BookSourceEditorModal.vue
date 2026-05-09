<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useMessage } from 'naive-ui';
import JavaScriptHighlightEditor from '@/components/base/JavaScriptHighlightEditor.vue';
import { isMobile } from '@/composables/useEnv';
import { useOverlayBackstack } from '@/composables/useOverlayBackstack';
import { saveExportFile } from '@/utils/exportFile';

const props = defineProps<{
  show: boolean;
  title: string;
  content: string;
  fileName: string;
  saving: boolean;
  reloaded: boolean;
  editorKey: number;
}>();

const emit = defineEmits<{
  'update:show': [value: boolean];
  'update:content': [value: string];
  save: [];
  'open-vscode': [];
}>();

const message = useMessage();

const visible = computed({
  get: () => props.show,
  set: (v) => emit('update:show', v),
});

useOverlayBackstack(
  () => visible.value,
  () => {
    visible.value = false;
  },
);

const code = computed({
  get: () => props.content,
  set: (v) => emit('update:content', v),
});

function saveFromEditor() {
  if (!props.saving) {
    emit('save');
  }
}

// ---- 滚动到顶部 ----
const editorRef = ref<InstanceType<typeof JavaScriptHighlightEditor> | null>(null);

watch(visible, async (v) => {
  if (v) {
    await nextTick();
    editorRef.value?.resetScroll();
  }
});

// ---- 复制 ----
async function copySource() {
  try {
    await navigator.clipboard.writeText(props.content);
    message.success('已复制书源代码');
  } catch {
    message.error('复制失败');
  }
}

// ---- 导出 ----
const exporting = ref(false);

async function exportSource() {
  if (exporting.value) return;
  exporting.value = true;
  try {
    const name = props.fileName || 'booksource.js';
    const saved = await saveExportFile({
      defaultName: name,
      mime: 'text/javascript;charset=utf-8',
      text: props.content,
      filterName: 'JavaScript',
      extensions: ['js'],
    });
    if (saved) {
      message.success(`已导出到 ${saved}`);
    }
  } catch (e: unknown) {
    message.error(`导出失败: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    exporting.value = false;
  }
}
</script>

<template>
  <n-modal
    v-model:show="visible"
    preset="card"
    :title="title"
    :bordered="false"
    :mask-closable="false"
    :style="{ width: isMobile ? '95vw' : '80vw', height: isMobile ? '90vh' : '85vh' }"
    content-style="padding:0;display:flex;flex-direction:column;overflow:hidden"
  >
    <!-- 工具栏 -->
    <template #header-extra>
      <n-space :size="8">
        <n-tag v-if="reloaded" type="warning" size="small" :bordered="false">文件已变更</n-tag>
        <n-button size="small" quaternary :disabled="!fileName" @click="emit('open-vscode')">
          VS Code 打开
        </n-button>
        <n-button size="small" quaternary @click="copySource">
          复制
        </n-button>
        <n-button size="small" quaternary :loading="exporting" :disabled="!content" @click="exportSource">
          导出
        </n-button>
        <n-button size="small" type="primary" :loading="saving" @click="emit('save')">
          保存
        </n-button>
      </n-space>
    </template>

    <JavaScriptHighlightEditor
      ref="editorRef"
      v-model="code"
      :autofocus-key="editorKey"
      min-height="100%"
      placeholder="书源 JavaScript 内容..."
      @save="saveFromEditor"
    />
  </n-modal>
</template>
