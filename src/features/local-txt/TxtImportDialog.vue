<script setup lang="ts">
import { Upload, BookOpen, X, Check, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-vue-next';
import { NModal, NCard, NButton, NInput, NRadio, NRadioGroup, NSpin, NAlert, NProgress } from 'naive-ui';
import { ref, computed, watch } from 'vue';
import { useOverlayBackstack } from '@/composables/useOverlayBackstack';
import {
  getAllRules,
  previewAllRules,
  splitChapters,
  MAX_CHAPTERS,
  type ChapterRule,
} from '@/features/local-txt/chapterSplitter';

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (
    e: 'imported',
    payload: {
      title: string;
      author: string;
      chapters: Array<{ title: string; content: string }>;
      preface: string;
    },
  ): void;
}>();

// ── 状态 ─────────────────────────────────────────────────────────────────

type Phase = 'upload' | 'preview' | 'importing' | 'done';

const phase = ref<Phase>('upload');
const errorMsg = ref('');
const fileName = ref('');
const rawText = ref('');
const bookTitle = ref('');
const bookAuthor = ref('');
const selectedRuleId = ref('cn-chapter-or-divider');
const expandedRuleId = ref<string | null>(null);
const importProgress = ref(0);
const isDragOver = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);

// ── 规则预览 ──────────────────────────────────────────────────────────────

const allRules = computed(() => getAllRules());

interface RulePreview {
  rule: ChapterRule;
  count: number;
  firstChapters: string[];
}

const rulePreviews = ref<RulePreview[]>([]);

function buildPreviews() {
  if (!rawText.value) return;
  rulePreviews.value = previewAllRules(rawText.value, allRules.value);
}

const selectedPreview = computed(
  () => rulePreviews.value.find((p) => p.rule.id === selectedRuleId.value) ?? null,
);

const chapterCountLabel = computed(() => {
  if (!selectedPreview.value) return '';
  const count = selectedPreview.value.count;
  const truncated = count >= MAX_CHAPTERS;
  return truncated ? `${count}+ 章（已截断）` : `${count} 章`;
});

// ── 读取文件 ──────────────────────────────────────────────────────────────

async function readFileText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  // 优先 UTF-8，若出现替换字符且文件名/内容暗示 GBK，尝试 GBK
  try {
    const utf8 = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return utf8;
  } catch {
    try {
      return new TextDecoder('gbk').decode(buffer);
    } catch {
      return new TextDecoder('utf-8', { fatal: false }).decode(buffer);
    }
  }
}

async function handleFile(file: File) {
  if (!file.name.toLowerCase().endsWith('.txt')) {
    errorMsg.value = '仅支持 .txt 格式的文件';
    return;
  }
  if (file.size > 50 * 1024 * 1024) {
    errorMsg.value = '文件过大（最大支持 50 MB）';
    return;
  }
  errorMsg.value = '';
  phase.value = 'upload';

  try {
    const text = await readFileText(file);
    rawText.value = text;
    // 从文件名提取书名
    fileName.value = file.name;
    bookTitle.value = file.name.replace(/\.txt$/i, '').trim();
    bookAuthor.value = '';
    buildPreviews();
    phase.value = 'preview';
  } catch (err) {
    errorMsg.value = `读取文件失败: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ── 拖拽 / 文件选择 ───────────────────────────────────────────────────────

function onDragOver(e: DragEvent) {
  e.preventDefault();
  isDragOver.value = true;
}
function onDragLeave() {
  isDragOver.value = false;
}
async function onDrop(e: DragEvent) {
  e.preventDefault();
  isDragOver.value = false;
  const file = e.dataTransfer?.files[0];
  if (file) await handleFile(file);
}
function onClickUpload() {
  fileInputRef.value?.click();
}
async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) await handleFile(file);
  input.value = '';
}

// ── 导入 ─────────────────────────────────────────────────────────────────

async function doImport() {
  if (!rawText.value || !bookTitle.value.trim()) return;

  const rule = allRules.value.find((r) => r.id === selectedRuleId.value);
  if (!rule) return;

  phase.value = 'importing';
  importProgress.value = 0;

  // 把分割计算推进微任务，让 UI 先渲染 spinner
  await new Promise<void>((resolve) => setTimeout(resolve, 16));

  const result = splitChapters(rawText.value, rule);
  importProgress.value = 50;

  await new Promise<void>((resolve) => setTimeout(resolve, 16));

  emit('imported', {
    title: bookTitle.value.trim(),
    author: bookAuthor.value.trim(),
    chapters: result.chapters,
    preface: result.preface,
  });

  importProgress.value = 100;
  phase.value = 'done';
}

// ── 关闭 & 重置 ───────────────────────────────────────────────────────────

function close() {
  if (phase.value === 'importing') return;
  emit('update:show', false);
}

function reset() {
  phase.value = 'upload';
  rawText.value = '';
  fileName.value = '';
  bookTitle.value = '';
  bookAuthor.value = '';
  rulePreviews.value = [];
  errorMsg.value = '';
  importProgress.value = 0;
}

watch(
  () => props.show,
  (v) => {
    if (v) reset();
  },
);

useOverlayBackstack(
  () => props.show && phase.value !== 'importing',
  close,
);

// ── 规则展开预览 ──────────────────────────────────────────────────────────

function toggleExpand(id: string) {
  expandedRuleId.value = expandedRuleId.value === id ? null : id;
}

const canClose = computed(() => phase.value !== 'importing');
</script>

<template>
  <NModal
    :show="props.show"
    :mask-closable="canClose"
    @update:show="(v) => { if (!v && canClose) close(); }"
  >
    <NCard
      class="txt-import-dialog"
      :title="phase === 'done' ? '导入完成' : '导入本地 TXT'"
      :bordered="false"
      role="dialog"
    >
      <template #header-extra>
        <button
          v-if="canClose"
          class="txt-import-dialog__close"
          type="button"
          aria-label="关闭"
          @click="close"
        >
          <X :size="16" />
        </button>
      </template>

      <!-- ── 上传区域 ── -->
      <div v-if="phase === 'upload'" class="txt-import-dialog__body">
        <div
          class="txt-upload-zone"
          :class="{ 'txt-upload-zone--over': isDragOver }"
          role="button"
          tabindex="0"
          @click="onClickUpload"
          @keydown.enter="onClickUpload"
          @keydown.space.prevent="onClickUpload"
          @dragover="onDragOver"
          @dragleave="onDragLeave"
          @drop="onDrop"
        >
          <Upload :size="40" class="txt-upload-zone__icon" />
          <p class="txt-upload-zone__hint">点击或拖拽 TXT 文件到此处</p>
          <p class="txt-upload-zone__sub">支持 UTF-8 / GBK 编码，最大 50 MB</p>
        </div>
        <input
          ref="fileInputRef"
          type="file"
          accept=".txt,text/plain"
          class="txt-import-dialog__file-input"
          @change="onFileChange"
        />
        <NAlert v-if="errorMsg" type="error" :bordered="false" class="txt-import-dialog__error">
          {{ errorMsg }}
        </NAlert>
      </div>

      <!-- ── 分章节规则预览 ── -->
      <div v-else-if="phase === 'preview'" class="txt-import-dialog__body">
        <!-- 书名 / 作者 -->
        <div class="txt-import-dialog__meta">
          <div class="txt-import-dialog__meta-row">
            <label class="txt-import-dialog__label">书名</label>
            <NInput v-model:value="bookTitle" placeholder="书名" />
          </div>
          <div class="txt-import-dialog__meta-row">
            <label class="txt-import-dialog__label">作者</label>
            <NInput v-model:value="bookAuthor" placeholder="作者（可选）" />
          </div>
        </div>

        <!-- 规则选择 -->
        <p class="txt-import-dialog__section-title">选择分章节规则</p>
        <NRadioGroup v-model:value="selectedRuleId" class="txt-import-dialog__rules">
          <div
            v-for="preview in rulePreviews"
            :key="preview.rule.id"
            class="txt-rule-item"
            :class="{ 'txt-rule-item--selected': selectedRuleId === preview.rule.id }"
          >
            <div class="txt-rule-item__header">
              <NRadio :value="preview.rule.id" class="txt-rule-item__radio" />
              <span class="txt-rule-item__name">
                {{ preview.rule.name }}
                <span v-if="preview.rule.isPlugin" class="txt-rule-item__badge">插件</span>
              </span>
              <span
                class="txt-rule-item__count"
                :class="{ 'txt-rule-item__count--warn': preview.count <= 1 }"
              >
                {{ preview.count >= MAX_CHAPTERS ? `${preview.count}+ 章` : `${preview.count} 章` }}
              </span>
              <button
                class="txt-rule-item__expand"
                type="button"
                :aria-label="expandedRuleId === preview.rule.id ? '收起' : '展开预览'"
                @click.stop="toggleExpand(preview.rule.id)"
              >
                <ChevronUp v-if="expandedRuleId === preview.rule.id" :size="14" />
                <ChevronDown v-else :size="14" />
              </button>
            </div>
            <p class="txt-rule-item__desc">{{ preview.rule.description }}</p>
            <div v-if="expandedRuleId === preview.rule.id" class="txt-rule-item__preview">
              <span
                v-for="(ch, idx) in preview.firstChapters"
                :key="idx"
                class="txt-rule-item__preview-ch"
              >{{ ch }}</span>
              <span v-if="preview.count > 5" class="txt-rule-item__preview-more">
                …共 {{ preview.count }} 章
              </span>
            </div>
          </div>
        </NRadioGroup>

        <NAlert
          v-if="selectedPreview && selectedPreview.count <= 1 && rawText.length > 5000"
          type="warning"
          :bordered="false"
          class="txt-import-dialog__warn"
        >
          <AlertTriangle :size="14" style="vertical-align: middle; margin-right: 4px;" />
          当前规则未检测到章节，全书将作为单章节导入。请尝试其他规则。
        </NAlert>

        <NAlert
          v-if="selectedPreview && selectedPreview.count >= MAX_CHAPTERS"
          type="warning"
          :bordered="false"
          class="txt-import-dialog__warn"
        >
          <AlertTriangle :size="14" style="vertical-align: middle; margin-right: 4px;" />
          章节数超过上限 {{ MAX_CHAPTERS }}，已自动截断。请确认规则是否正确。
        </NAlert>

        <div class="txt-import-dialog__footer">
          <NButton @click="reset">重新选择</NButton>
          <NButton
            type="primary"
            :disabled="!bookTitle.trim()"
            @click="doImport"
          >
            <BookOpen :size="14" style="margin-right: 4px;" />
            导入（{{ chapterCountLabel }}）
          </NButton>
        </div>
      </div>

      <!-- ── 导入中 ── -->
      <div v-else-if="phase === 'importing'" class="txt-import-dialog__loading">
        <NSpin size="large" />
        <p class="txt-import-dialog__loading-text">正在导入，请稍候…</p>
        <NProgress
          type="line"
          :percentage="importProgress"
          :indicator-placement="'inside'"
          class="txt-import-dialog__progress"
        />
      </div>

      <!-- ── 完成 ── -->
      <div v-else-if="phase === 'done'" class="txt-import-dialog__done">
        <Check :size="48" class="txt-import-dialog__done-icon" />
        <p class="txt-import-dialog__done-text">《{{ bookTitle }}》已成功加入书架</p>
        <NButton type="primary" @click="close">完成</NButton>
      </div>
    </NCard>
  </NModal>
</template>

<style scoped>
.txt-import-dialog {
  width: min(540px, 92vw);
  max-height: 88vh;
  display: flex;
  flex-direction: column;
}

.txt-import-dialog :deep(.n-card__content) {
  overflow-y: auto;
  flex: 1;
}

.txt-import-dialog__close {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-muted, #888);
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
}
.txt-import-dialog__close:hover {
  color: var(--color-text, #333);
  background: var(--color-hover, rgba(0,0,0,.06));
}

.txt-import-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.txt-import-dialog__file-input {
  display: none;
}

/* ── 上传区 ── */
.txt-upload-zone {
  border: 2px dashed var(--color-border, #e0e0e0);
  border-radius: 12px;
  padding: 48px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  user-select: none;
  outline: none;
}
.txt-upload-zone:hover,
.txt-upload-zone:focus {
  border-color: var(--primary-color, #18a058);
  background: var(--primary-color-suppl, rgba(24,160,88,.04));
}
.txt-upload-zone--over {
  border-color: var(--primary-color, #18a058);
  background: var(--primary-color-suppl, rgba(24,160,88,.08));
}
.txt-upload-zone__icon {
  color: var(--color-text-muted, #aaa);
}
.txt-upload-zone--over .txt-upload-zone__icon,
.txt-upload-zone:hover .txt-upload-zone__icon {
  color: var(--primary-color, #18a058);
}
.txt-upload-zone__hint {
  font-size: var(--fs-15, 15px);
  font-weight: var(--fw-medium, 500);
  color: var(--color-text, #333);
  margin: 0;
}
.txt-upload-zone__sub {
  font-size: var(--fs-13, 13px);
  color: var(--color-text-muted, #888);
  margin: 0;
}

/* ── 元信息 ── */
.txt-import-dialog__meta {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.txt-import-dialog__meta-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.txt-import-dialog__label {
  font-size: var(--fs-13, 13px);
  color: var(--color-text-muted, #888);
  width: 32px;
  flex-shrink: 0;
}

/* ── 规则列表 ── */
.txt-import-dialog__section-title {
  font-size: var(--fs-13, 13px);
  font-weight: var(--fw-medium, 500);
  color: var(--color-text-muted, #888);
  margin: 0;
}
.txt-import-dialog__rules {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}
.txt-rule-item {
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 8px;
  padding: 10px 12px;
  cursor: pointer;
  transition: border-color 0.15s;
}
.txt-rule-item--selected {
  border-color: var(--primary-color, #18a058);
  background: var(--primary-color-suppl, rgba(24,160,88,.04));
}
.txt-rule-item__header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.txt-rule-item__radio {
  flex-shrink: 0;
}
.txt-rule-item__name {
  flex: 1;
  font-size: var(--fs-14, 14px);
  font-weight: var(--fw-medium, 500);
  color: var(--color-text, #333);
}
.txt-rule-item__badge {
  display: inline-block;
  font-size: 11px;
  background: var(--info-color, #2080f0);
  color: #fff;
  border-radius: 3px;
  padding: 0 4px;
  margin-left: 4px;
  vertical-align: middle;
}
.txt-rule-item__count {
  font-size: var(--fs-13, 13px);
  color: var(--color-text-muted, #888);
  white-space: nowrap;
}
.txt-rule-item__count--warn {
  color: var(--warning-color, #f0a020);
}
.txt-rule-item__expand {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-muted, #aaa);
  padding: 2px;
  display: flex;
  align-items: center;
}
.txt-rule-item__expand:hover {
  color: var(--color-text, #333);
}
.txt-rule-item__desc {
  font-size: var(--fs-12, 12px);
  color: var(--color-text-muted, #aaa);
  margin: 4px 0 0 24px;
}
.txt-rule-item__preview {
  margin-top: 8px;
  margin-left: 24px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.txt-rule-item__preview-ch {
  font-size: var(--fs-12, 12px);
  color: var(--color-text, #444);
  background: var(--color-hover, rgba(0,0,0,.04));
  border-radius: 4px;
  padding: 2px 8px;
}
.txt-rule-item__preview-more {
  font-size: var(--fs-12, 12px);
  color: var(--color-text-muted, #aaa);
  padding: 2px 8px;
}

/* ── 底部按钮 ── */
.txt-import-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 4px;
}

/* ── 警告 ── */
.txt-import-dialog__warn,
.txt-import-dialog__error {
  margin-top: 4px;
}

/* ── 加载中 ── */
.txt-import-dialog__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 24px 0;
}
.txt-import-dialog__loading-text {
  color: var(--color-text-muted, #888);
  margin: 0;
}
.txt-import-dialog__progress {
  width: 100%;
}

/* ── 完成 ── */
.txt-import-dialog__done {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 24px 0;
}
.txt-import-dialog__done-icon {
  color: var(--success-color, #18a058);
}
.txt-import-dialog__done-text {
  font-size: var(--fs-15, 15px);
  font-weight: var(--fw-medium, 500);
  color: var(--color-text, #333);
  margin: 0;
  text-align: center;
}
</style>
