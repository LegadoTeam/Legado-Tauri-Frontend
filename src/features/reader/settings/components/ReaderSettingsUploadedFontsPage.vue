<script setup lang="ts">
import { ref } from 'vue';
import { Check, ChevronLeft, Pencil, Trash2, Upload } from 'lucide-vue-next';
import type { ReaderSettings, ReaderTypography } from '@/components/reader/types';
import type { UserFontMeta } from '@/composables/useUserFonts';

defineProps<{
  settings: ReaderSettings;
  userFonts: UserFontMeta[];
  uploading: boolean;
  uploadError: string;
}>();

const emit = defineEmits<{
  back: [];
  'update-typography': [patch: Partial<ReaderTypography>];
  'upload-font': [file: File];
  'delete-font': [id: string];
  'rename-font': [id: string, displayName: string];
}>();

const fileInput = ref<HTMLInputElement | null>(null);
const isDragOver = ref(false);

// 内联重命名状态
const renamingId = ref<string | null>(null);
const renameValue = ref('');

function triggerUpload() {
  fileInput.value?.click();
}

function processFiles(files: FileList | File[]) {
  const arr = Array.from(files);
  const valid = arr.filter((f) =>
    /\.(ttf|otf|woff|woff2)$/i.test(f.name),
  );
  for (const file of valid) {
    emit('upload-font', file);
  }
}

function onFileChange(e: Event) {
  const files = (e.target as HTMLInputElement).files;
  if (files && files.length > 0) {
    processFiles(files);
  }
  // 重置 input 以支持重复上传同一文件
  (e.target as HTMLInputElement).value = '';
}

function onDragOver(e: DragEvent) {
  e.preventDefault();
  isDragOver.value = true;
}

function onDragLeave() {
  isDragOver.value = false;
}

function onDrop(e: DragEvent) {
  e.preventDefault();
  isDragOver.value = false;
  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    processFiles(files);
  }
}

function startRename(font: UserFontMeta) {
  renamingId.value = font.id;
  renameValue.value = font.displayName;
}

function commitRename(id: string) {
  const name = renameValue.value.trim();
  if (name && name !== '') {
    emit('rename-font', id, name);
  }
  renamingId.value = null;
}

function cancelRename() {
  renamingId.value = null;
}
</script>

<template>
  <!-- 整体容器支持拖拽 -->
  <div
    class="uf-root"
    :class="{ 'uf-root--dragover': isDragOver }"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
  <!-- 标题栏 -->
  <div class="uf-header">
    <button class="uf-back" @click="emit('back')">
      <ChevronLeft :size="16" />
    </button>
    <span class="uf-title">上传字体</span>
    <button class="uf-upload-btn" :disabled="uploading" @click="triggerUpload">
      <Upload :size="14" />
      <span>选择文件</span>
    </button>
    <!-- 隐藏的文件选择 input，支持多选，跨平台兼容 -->
    <input
      ref="fileInput"
      type="file"
      accept=".ttf,.otf,.woff,.woff2"
      multiple
      style="display: none"
      @change="onFileChange"
    />
  </div>

  <!-- 拖拽提示条 -->
  <div v-if="isDragOver" class="uf-drop-hint">
    <Upload :size="20" />
    <span>松手即可导入字体</span>
  </div>

  <!-- 上传中状态 -->
  <div v-if="uploading" class="uf-state">
    <n-spin size="small" />
    <span>正在上传字体…</span>
  </div>
  <!-- 上传错误 -->
  <div v-if="uploadError" class="uf-state uf-state--error">
    {{ uploadError }}
  </div>

  <!-- 空状态 -->
  <div v-if="userFonts.length === 0 && !uploading" class="uf-state uf-empty">
    <span>暂无上传字体</span>
    <span class="uf-empty-hint">支持 TTF、OTF、WOFF、WOFF2，可拖拽到此导入</span>
  </div>

  <!-- 字体列表 -->
  <div v-else-if="userFonts.length > 0" class="uf-list">
    <div
      v-for="font in userFonts"
      :key="font.id"
      class="uf-item"
      :class="{ 'uf-item--active': settings.typography.fontFamily === font.displayName }"
    >
      <!-- 名称区（可内联重命名） -->
      <div class="uf-item__info" @click="emit('update-typography', { fontFamily: font.displayName })">
        <!-- 重命名输入框 -->
        <input
          v-if="renamingId === font.id"
          v-model="renameValue"
          class="uf-rename-input"
          autofocus
          @keydown.enter.prevent="commitRename(font.id)"
          @keydown.escape.prevent="cancelRename"
          @blur="commitRename(font.id)"
          @click.stop
        />
        <div v-else class="uf-item__name">{{ font.displayName }}</div>
        <!-- 字体预览 -->
        <div class="uf-item__preview" :style="{ fontFamily: font.displayName }">
          永字八法 AaBbCc
        </div>
      </div>

      <!-- 操作按钮区 -->
      <div class="uf-item__actions">
        <!-- 当前选中标记 -->
        <Check
          v-if="settings.typography.fontFamily === font.displayName"
          :size="14"
          stroke="#63e2b7"
          :stroke-width="2.5"
        />
        <!-- 重命名 -->
        <button
          class="uf-icon-btn"
          title="重命名"
          @click.stop="renamingId === font.id ? commitRename(font.id) : startRename(font)"
        >
          <Pencil :size="13" />
        </button>
        <!-- 删除 -->
        <button
          class="uf-icon-btn uf-icon-btn--danger"
          title="删除"
          @click.stop="emit('delete-font', font.id)"
        >
          <Trash2 :size="13" />
        </button>
      </div>
    </div>
  </div>
  </div>
</template>

<style scoped>
.uf-root {
  display: contents;
}

.uf-root--dragover .uf-header,
.uf-root--dragover .uf-list,
.uf-root--dragover .uf-state,
.uf-root--dragover .uf-empty {
  opacity: 0.4;
  pointer-events: none;
}

.uf-drop-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  border: 2px dashed rgba(99, 226, 183, 0.6);
  border-radius: 10px;
  color: #63e2b7;
  font-size: 0.875rem;
  background: rgba(99, 226, 183, 0.06);
  animation: uf-drop-pulse 1s ease-in-out infinite;
}

@keyframes uf-drop-pulse {
  0%, 100% { border-color: rgba(99, 226, 183, 0.4); }
  50% { border-color: rgba(99, 226, 183, 0.9); }
}

.uf-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.uf-back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background 0.15s;
}

.uf-back:hover {
  background: rgba(255, 255, 255, 0.1);
}

.uf-title {
  font-size: 0.875rem;
  font-weight: 600;
  flex: 1;
}

.uf-upload-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 12px;
  border-radius: 6px;
  border: 1px solid rgba(99, 226, 183, 0.4);
  background: rgba(99, 226, 183, 0.1);
  color: #63e2b7;
  font-size: 0.75rem;
  cursor: pointer;
  transition:
    background 0.15s,
    opacity 0.15s;
  white-space: nowrap;
}

.uf-upload-btn:hover:not(:disabled) {
  background: rgba(99, 226, 183, 0.2);
}

.uf-upload-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.uf-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px 0;
  font-size: 0.8125rem;
  opacity: 0.55;
}

.uf-state--error {
  color: #ff6b6b;
  opacity: 1;
}

.uf-empty {
  padding: 24px 0;
}

.uf-empty-hint {
  font-size: 0.6875rem;
  opacity: 0.6;
}

.uf-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.uf-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid transparent;
  transition:
    background 0.15s,
    border-color 0.15s;
  cursor: pointer;
}

.uf-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.uf-item--active {
  background: rgba(99, 226, 183, 0.08);
  border-color: rgba(99, 226, 183, 0.25);
}

.uf-item__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.uf-item__name {
  font-size: 0.8125rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.uf-item__preview {
  font-size: 0.75rem;
  opacity: 0.55;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.uf-item__actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.uf-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.45);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition:
    background 0.15s,
    color 0.15s;
}

.uf-icon-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
}

.uf-icon-btn--danger:hover {
  background: rgba(255, 100, 100, 0.15);
  color: #ff6b6b;
}

.uf-rename-input {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(99, 226, 183, 0.5);
  border-radius: 4px;
  color: inherit;
  font-size: 0.8125rem;
  padding: 2px 6px;
  outline: none;
  width: 100%;
}
</style>
