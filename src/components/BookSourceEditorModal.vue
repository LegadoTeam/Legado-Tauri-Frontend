<!-- BookSourceEditorModal — 书源代码编辑弹层，外壳适配移动端/桌面端。 -->
<script setup lang="ts">
import { useMessage } from 'naive-ui';
import { computed, nextTick, ref, watch } from 'vue';
import BookSourceCodeEditor from '@/components/booksource/BookSourceCodeEditor.vue';
import { isMobile } from '@/composables/useEnv';
import { useOverlayBackstack } from '@/composables/useOverlayBackstack';
import { saveExportFile } from '@/utils/exportFile';

const props = defineProps<{
  show: boolean;
  title: string;
  content: string;
  fileName: string;
  saving: boolean;
  loading: boolean;
  loadError: string;
  reloaded: boolean;
  editorKey: number;
}>();

const emit = defineEmits<{
  'update:show': [value: boolean];
  'update:content': [value: string];
  save: [];
  'open-vscode': [];
  'open-external': [];
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
const editorRef = ref<InstanceType<typeof BookSourceCodeEditor> | null>(null);

watch(visible, async (v) => {
  if (v && !props.loading && !props.loadError) {
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
  if (exporting.value) {
    return;
  }
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
    :class="{ 'booksource-editor-fullscreen': isMobile }"
    :title="title"
    :bordered="false"
    :mask-closable="false"
    :style="{
      width: isMobile ? '100vw' : '80vw',
      height: isMobile ? '92vh' : '85vh',
    }"
    content-style="padding:0;display:flex;flex-direction:column;overflow:hidden"
  >
    <!-- 工具栏 -->
    <template #header-extra>
      <n-space :size="6" :wrap="false">
        <n-tag v-if="reloaded" type="warning" size="small" :bordered="false">
          {{ isMobile ? '已变更' : '文件已变更' }}
        </n-tag>
        <n-button
          v-if="!isMobile"
          size="small"
          quaternary
          :disabled="!fileName"
          @click="emit('open-vscode')"
        >
          VS Code 打开
        </n-button>
        <n-button
          v-if="isMobile"
          size="small"
          quaternary
          :disabled="!fileName"
          @click="emit('open-external')"
        >
          外部编辑器
        </n-button>
        <n-button size="small" quaternary @click="copySource"> 复制 </n-button>
        <n-button
          size="small"
          quaternary
          :loading="exporting"
          :disabled="!content"
          @click="exportSource"
        >
          导出
        </n-button>
        <n-button size="small" type="primary" :loading="saving" @click="emit('save')">
          保存
        </n-button>
      </n-space>
    </template>

    <div v-if="loading" class="booksource-editor-state">
      <n-spin size="small" />
      <span>正在读取书源...</span>
    </div>

    <n-result
      v-else-if="loadError"
      status="error"
      title="读取失败"
      :description="loadError"
      class="booksource-editor-result"
    />

    <BookSourceCodeEditor
      v-else
      ref="editorRef"
      v-model="code"
      :autofocus-key="editorKey"
      min-height="100%"
      placeholder="书源 JavaScript 内容..."
      @save="saveFromEditor"
    />
  </n-modal>
</template>

<style>
/* 移动端全屏：去除卡片圆角和阴影 */
.booksource-editor-fullscreen.n-card {
  border-radius: 0 !important;
  box-shadow: none !important;
}

.booksource-editor-state,
.booksource-editor-result {
  flex: 1;
  min-height: 0;
}

.booksource-editor-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--color-text-muted);
  font-size: 0.875rem;
}
</style>
