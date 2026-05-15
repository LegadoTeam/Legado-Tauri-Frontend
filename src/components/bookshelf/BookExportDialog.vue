<script setup lang="ts">
import { X, Info, Loader2, CheckCircle2, AlertCircle } from 'lucide-vue-next';
import { NModal, NCard, NButton, NProgress, NRadio, NRadioGroup } from 'naive-ui';
import { storeToRefs } from 'pinia';
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue';
import type { ShelfBook, CachedChapter } from '@/types';
import { isHarmonyNative, isTauri, platform } from '@/composables/useEnv';
import { invokeWithTimeout } from '@/composables/useInvoke';
import { useOverlayBackstack } from '@/composables/useOverlayBackstack';
import { usePrefetchStore, useAppConfigStore } from '@/stores';
import { base64ToBytes, pickExportPath, writeExportFile } from '@/utils/exportFile';

const props = defineProps<{
  show: boolean;
  book: ShelfBook;
  chapters: CachedChapter[];
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
}>();

type ExportFormat = 'txt' | 'epub';
type ExportPhase = 'idle' | 'picking' | 'caching' | 'exporting' | 'done' | 'error';

const format = ref<ExportFormat>('txt');
const phase = ref<ExportPhase>('idle');
const errorMsg = ref('');
const savedPath = ref('');
const cacheDone = ref(0);
const cacheTotal = ref(0);
const logLines = ref<string[]>([]);
const logEl = ref<HTMLDivElement | null>(null);

const prefetchStore = usePrefetchStore();
const appConfigStore = useAppConfigStore();
const { manualRunning, manualProgress } = storeToRefs(prefetchStore);
const { startManualPrefetch, cancelManualPrefetch } = prefetchStore;

let _stopWatch: (() => void) | null = null;
let _pollTimer: ReturnType<typeof setInterval> | null = null;
let _timeoutTimer: ReturnType<typeof setTimeout> | null = null;

const progressPercent = computed(() => {
  if (!cacheTotal.value) {
    return 0;
  }
  return Math.min(100, Math.round((cacheDone.value / cacheTotal.value) * 100));
});

const isRunning = computed(
  () => phase.value === 'picking' || phase.value === 'caching' || phase.value === 'exporting',
);

const canClose = computed(() => !isRunning.value);
const isTauriMobile = computed(() => {
  const value = platform.value.toLowerCase();
  return isTauri && (value === 'android' || value === 'ios');
});

useOverlayBackstack(
  () => props.show && canClose.value,
  () => {
    void handleClose();
  },
);

function addLog(line: string) {
  const timeStr = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  logLines.value.push(`[${timeStr}] ${line}`);
  if (logLines.value.length > 500) {
    logLines.value.splice(0, 50);
  }
  nextTick(() => {
    if (logEl.value) {
      logEl.value.scrollTop = logEl.value.scrollHeight;
    }
  });
}

function cleanupCompletion() {
  _stopWatch?.();
  _stopWatch = null;
  if (_pollTimer !== null) {
    clearInterval(_pollTimer);
    _pollTimer = null;
  }
  if (_timeoutTimer !== null) {
    clearTimeout(_timeoutTimer);
    _timeoutTimer = null;
  }
}

function waitForCachingComplete(bookId: string, chapters: CachedChapter[]): Promise<void> {
  const expectedIndices = new Set(chapters.map((ch) => ch.index));
  const totalChapters = chapters.length;
  return new Promise<void>((resolve, reject) => {
    // Tauri mode: watch manualRunning
    _stopWatch = watch(manualRunning, (running) => {
      if (!running) {
        cleanupCompletion();
        resolve();
      }
    });

    // Universal polling: checks actual cached indices (works for both Tauri and WS mode)
    // Useful in WS mode where manualRunning never changes
    _pollTimer = setInterval(async () => {
      try {
        const cached = await invokeWithTimeout<number[]>(
          'bookshelf_get_cached_indices',
          { id: bookId },
          10000,
        );
        const cachedCount = cached.filter((idx) => expectedIndices.has(idx)).length;
        cacheDone.value = Math.max(cacheDone.value, Math.min(cachedCount, totalChapters));
        if (cachedCount >= totalChapters) {
          cleanupCompletion();
          resolve();
        }
      } catch {
        // ignore poll errors
      }
    }, 3000);

    // 30 min timeout
    _timeoutTimer = setTimeout(
      () => {
        cleanupCompletion();
        reject(new Error('缓存超时（30分钟），已有缓存章节将被导出'));
      },
      30 * 60 * 1000,
    );
  });
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'book';
}

async function startExport() {
  if (isRunning.value) {
    return;
  }
  const chapters = props.chapters;
  if (!chapters.length) {
    errorMsg.value = '章节目录为空，请先打开书籍加载章节目录后再导出';
    phase.value = 'error';
    return;
  }

  errorMsg.value = '';
  savedPath.value = '';
  logLines.value = [];
  cacheTotal.value = chapters.length;
  cacheDone.value = 0;

  // Step 1: Pick save path via native dialog/user file picker.
  let pickedPath = '';
  if (isTauri || isHarmonyNative) {
    phase.value = 'picking';
    const ext = format.value;
    const defaultName = sanitizeFilename(props.book.name) + '.' + ext;
    try {
      const result = await pickExportPath({
        defaultName,
        filterName: ext.toUpperCase(),
        extensions: [ext],
      });
      if (!result) {
        // User cancelled
        phase.value = 'idle';
        return;
      }
      pickedPath = result;
    } catch (e: unknown) {
      errorMsg.value = '选择保存路径失败: ' + (e instanceof Error ? e.message : String(e));
      phase.value = 'error';
      return;
    }
  }

  // Step 2: Force cache all chapters
  phase.value = 'caching';
  addLog(`开始缓存《${props.book.name}》共 ${chapters.length} 章...`);

  const completionPromise = waitForCachingComplete(props.book.id, chapters);

  try {
    await startManualPrefetch(
      {
        id: props.book.id,
        fileName: props.book.fileName,
        bookUrl: props.book.bookUrl,
        bookName: props.book.name,
        sourceType: props.book.sourceType ?? 'novel',
        chapters: chapters.map((c) => ({
          index: c.index,
          name: c.name,
          url: c.url,
        })),
        startIndex: 0,
        count: -1,
        concurrency: appConfigStore.config.export_prefetch_concurrency || 3,
      },
      (chapterIndex, progress) => {
        cacheTotal.value = progress.total || chapters.length;
        cacheDone.value = Math.min(progress.done, cacheTotal.value);
        const ch = chapters[chapterIndex];
        if (ch) {
          addLog(
            `${progress.error ? '缓存失败' : '已处理'}：第 ${chapterIndex + 1} 章 ${ch.name}${progress.error ? `（${progress.error}）` : ''}`,
          );
        }
      },
    );
  } catch (e: unknown) {
    cleanupCompletion();
    errorMsg.value = '启动缓存失败: ' + (e instanceof Error ? e.message : String(e));
    phase.value = 'error';
    return;
  }

  // Wait for caching to complete
  try {
    await completionPromise;
  } catch (e: unknown) {
    // Timeout, but proceed with what we have
    addLog(`注意：${e instanceof Error ? e.message : '部分章节可能未缓存'}`);
  }

  if (phase.value !== 'caching') {
    // Was cancelled during wait
    return;
  }

  cacheDone.value = Math.max(cacheDone.value, Math.min(manualProgress.value.done, chapters.length));
  addLog(`缓存阶段完成（${cacheDone.value}/${chapters.length} 章），开始导出...`);

  // Step 3: Export
  phase.value = 'exporting';
  try {
    let actualPath = pickedPath;
    if (isTauriMobile.value) {
      const data = await invokeWithTimeout<{
        fileName: string;
        mime: string;
        base64: string;
      }>('bookshelf_export_book_data', { id: props.book.id, format: format.value }, 10 * 60 * 1000);
      await writeExportFile(pickedPath, { bytes: base64ToBytes(data.base64) });
    } else {
      actualPath = await invokeWithTimeout<string>(
        'bookshelf_export_book',
        { id: props.book.id, format: format.value, savePath: pickedPath },
        10 * 60 * 1000,
      );
    }
    savedPath.value = actualPath;
    addLog('导出完成！');
    addLog(`文件位置：${actualPath}`);
    phase.value = 'done';
  } catch (e: unknown) {
    errorMsg.value = '导出失败: ' + (e instanceof Error ? e.message : String(e));
    phase.value = 'error';
  }
}

async function handleCancel() {
  if (phase.value === 'caching') {
    cleanupCompletion();
    await cancelManualPrefetch();
  }
  phase.value = 'idle';
  emit('update:show', false);
}

async function handleClose() {
  if (isRunning.value) {
    return;
  }
  emit('update:show', false);
}

async function revealFile() {
  if (!savedPath.value) {
    return;
  }
  try {
    await invokeWithTimeout('bookshelf_reveal_export_file', { path: savedPath.value }, 5000);
  } catch {
    // ignore: may not be supported on all platforms
  }
}

async function copyPath() {
  if (!savedPath.value) {
    return;
  }
  try {
    await navigator.clipboard.writeText(savedPath.value);
  } catch {
    // ignore
  }
}

watch(
  () => props.show,
  (show) => {
    if (show) {
      phase.value = 'idle';
      errorMsg.value = '';
      savedPath.value = '';
      logLines.value = [];
      cacheTotal.value = 0;
      cacheDone.value = 0;
      format.value = 'txt';
    } else {
      cleanupCompletion();
    }
  },
);

onBeforeUnmount(() => {
  cleanupCompletion();
});
</script>

<template>
  <NModal
    :show="show"
    :mask-closable="canClose"
    :close-on-esc="canClose"
    @update:show="(v: boolean) => !v && handleClose()"
    class="export-modal"
  >
    <NCard
      class="export-card"
      :title="`导出《${book.name}》`"
      :bordered="false"
      role="dialog"
      aria-modal="true"
    >
      <template #header-extra>
        <button
          v-if="canClose"
          class="export-close-btn"
          type="button"
          aria-label="关闭"
          @click="handleClose"
        >
          <X :size="16" :stroke-width="2.5" />
        </button>
      </template>

      <div class="export-body">
        <!-- Format Selection -->
        <div v-if="phase === 'idle'" class="export-section">
          <p class="export-section__label">选择导出格式</p>
          <NRadioGroup v-model:value="format" class="export-format-group">
            <div class="export-format-item">
              <NRadio value="txt" class="export-radio">
                <div class="export-format-content">
                  <span class="export-format-title">TXT 纯文本</span>
                  <span class="export-format-desc">兼容性最佳，文件较小，适合绝大多数阅读器</span>
                </div>
              </NRadio>
            </div>
            <div class="export-format-item">
              <NRadio value="epub" class="export-radio">
                <div class="export-format-content">
                  <span class="export-format-title">EPUB 电子书</span>
                  <span class="export-format-desc"
                    >含目录结构，适合 Kindle、Apple Books 等专业阅读器</span
                  >
                </div>
              </NRadio>
            </div>
          </NRadioGroup>

          <div class="export-info">
            <Info :size="14" />
            <span>
              导出前将自动扫描并缓存全部
              {{ chapters.length }} 章节内容，时间取决于网络和书源速度
            </span>
          </div>
        </div>

        <!-- Picking path state -->
        <div v-if="phase === 'picking'" class="export-section export-state">
          <div class="export-state__spinner">
            <Loader2 class="spin-anim" :size="24" />
          </div>
          <p class="export-state__text">请在弹出的对话框中选择保存位置...</p>
        </div>

        <!-- Caching progress -->
        <div v-if="phase === 'caching' || phase === 'exporting'" class="export-section">
          <div class="export-phase-header">
            <span class="export-phase-label">
              <template v-if="phase === 'caching'">
                正在缓存章节内容
                <span class="export-phase-count">{{ cacheDone }} / {{ cacheTotal }}</span>
              </template>
              <template v-else>正在生成文件...</template>
            </span>
          </div>

          <NProgress
            v-if="phase === 'caching'"
            type="line"
            :percentage="progressPercent"
            :indicator-placement="'inside'"
            :height="20"
            :border-radius="4"
            class="export-progress"
          />
          <NProgress
            v-else
            type="line"
            :percentage="100"
            processing
            :indicator-placement="'inside'"
            :height="20"
            :border-radius="4"
            class="export-progress"
          />

          <div ref="logEl" class="export-log app-scrollbar">
            <div v-for="(line, i) in logLines" :key="i" class="export-log__line">
              {{ line }}
            </div>
          </div>
        </div>

        <!-- Done state -->
        <div v-if="phase === 'done'" class="export-section export-done">
          <div class="export-done__icon">
            <CheckCircle2 :size="32" />
          </div>
          <p class="export-done__title">导出成功</p>
          <p class="export-done__path">{{ savedPath }}</p>
          <div class="export-log app-scrollbar" style="margin-top: 12px">
            <div v-for="(line, i) in logLines" :key="i" class="export-log__line">
              {{ line }}
            </div>
          </div>
        </div>

        <!-- Error state -->
        <div v-if="phase === 'error'" class="export-section export-error">
          <div class="export-error__icon">
            <AlertCircle :size="28" />
          </div>
          <p class="export-error__msg">{{ errorMsg }}</p>
        </div>
      </div>

      <template #footer>
        <div class="export-footer">
          <!-- Idle: Start + Cancel -->
          <template v-if="phase === 'idle'">
            <NButton @click="handleClose">取消</NButton>
            <NButton type="primary" @click="startExport" :disabled="!chapters.length">
              开始导出
            </NButton>
          </template>

          <!-- Caching: Cancel only -->
          <template v-else-if="phase === 'caching'">
            <NButton @click="handleCancel">取消导出</NButton>
          </template>

          <!-- Exporting: no actions (can't cancel) -->
          <template v-else-if="phase === 'exporting' || phase === 'picking'">
            <NButton disabled>导出中...</NButton>
          </template>

          <!-- Done -->
          <template v-else-if="phase === 'done'">
            <NButton @click="copyPath">复制路径</NButton>
            <NButton v-if="isTauri" @click="revealFile">打开文件位置</NButton>
            <NButton type="primary" @click="handleClose">完成</NButton>
          </template>

          <!-- Error -->
          <template v-else-if="phase === 'error'">
            <NButton @click="handleClose">关闭</NButton>
            <NButton type="primary" @click="startExport">重试</NButton>
          </template>
        </div>
      </template>
    </NCard>
  </NModal>
</template>

<style scoped>
.export-modal {
  display: flex;
  align-items: center;
  justify-content: center;
}

.export-card {
  width: min(520px, 96vw);
  max-height: 92dvh;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.24);
  overflow: hidden;
}

.export-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: 6px;
  transition:
    background 0.15s,
    color 0.15s;
}
.export-close-btn:hover {
  background: var(--color-hover);
  color: var(--color-text);
}

.export-body {
  padding: 4px 0 8px;
  min-height: 120px;
}

.export-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.export-section__label {
  font-size: var(--fs-14);
  font-weight: var(--fw-semibold);
  color: var(--color-text);
  margin: 0;
}

.export-format-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.export-format-item {
  border: 1.5px solid var(--color-border);
  border-radius: 8px;
  padding: 10px 14px;
  cursor: pointer;
  transition:
    border-color 0.15s,
    background 0.15s;
}
.export-format-item:has(.n-radio.n-radio--checked) {
  border-color: var(--n-color-primary, #18a058);
  background: color-mix(in srgb, var(--n-color-primary, #18a058) 6%, transparent);
}

.export-radio {
  width: 100%;
}

.export-format-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-left: 4px;
}

.export-format-title {
  font-size: 0.9rem;
  font-weight: var(--fw-semibold);
  color: var(--color-text);
}

.export-format-desc {
  font-size: 0.78rem;
  color: var(--color-text-muted);
  line-height: 1.4;
}

.export-info {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 8px 10px;
  background: var(--color-hover);
  border-radius: 6px;
  font-size: 0.8rem;
  color: var(--color-text-muted);
  line-height: 1.5;
}
.export-info svg {
  flex-shrink: 0;
  margin-top: 1px;
}

/* Picking state */
.export-state {
  align-items: center;
  justify-content: center;
  padding: 32px 0;
  gap: 16px;
}
.export-state__spinner {
  color: var(--n-color-primary, #18a058);
}
.export-state__text {
  font-size: 0.9rem;
  color: var(--color-text-muted);
  margin: 0;
}

/* Progress */
.export-phase-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.export-phase-label {
  font-size: var(--fs-14);
  font-weight: var(--fw-semibold);
  color: var(--color-text);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.export-phase-count {
  font-size: 0.8rem;
  font-weight: 400;
  color: var(--color-text-muted);
}

.export-progress {
  margin: 2px 0;
}

.export-log {
  height: 180px;
  overflow-y: auto;
  background: var(--color-code-bg, rgba(0, 0, 0, 0.08));
  border-radius: 6px;
  padding: 8px 10px;
  font-family: var(--font-mono, 'Consolas', 'Menlo', monospace);
  font-size: var(--fs-12);
  color: var(--color-text-muted);
  line-height: 1.6;
}
.export-log__line {
  white-space: pre-wrap;
  word-break: break-all;
}

/* Done state */
.export-done {
  align-items: center;
  padding: 16px 0 8px;
  gap: 8px;
}
.export-done__icon {
  color: #18a058;
}
.export-done__title {
  font-size: 1rem;
  font-weight: var(--fw-bold);
  color: var(--color-text);
  margin: 0;
}
.export-done__path {
  font-size: 0.78rem;
  color: var(--color-text-muted);
  text-align: center;
  word-break: break-all;
  padding: 0 8px;
  margin: 0;
}

/* Error state */
.export-error {
  align-items: center;
  padding: 24px 0 8px;
  gap: 12px;
}
.export-error__icon {
  color: #d03050;
}
.export-error__msg {
  font-size: var(--fs-14);
  color: var(--color-text);
  text-align: center;
  line-height: var(--lh-base);
  margin: 0;
  padding: 0 8px;
}

/* Footer */
.export-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

/* Spinning animation */
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
.spin-anim {
  animation: spin 1s linear infinite;
}

/* Mobile responsive */
@media (max-width: 480px) {
  .export-card {
    border-radius: 0;
    width: 100vw;
    max-height: 100dvh;
    border-radius: 0;
  }
  .export-log {
    height: 140px;
  }
  .export-footer {
    justify-content: stretch;
  }
  .export-footer :deep(.n-button) {
    flex: 1;
  }
}
</style>
