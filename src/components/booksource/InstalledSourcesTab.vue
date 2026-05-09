<script setup lang="ts">
import { openUrl } from '@tauri-apps/plugin-opener';
import { Search } from 'lucide-vue-next';
import { useMessage, useDialog } from 'naive-ui';
import { storeToRefs } from 'pinia';
import { ref, computed } from 'vue';
import { eventEmit } from '@/composables/useEventBus';
import { invokeWithTimeout } from '@/composables/useInvoke';
import { useOverlayBackstack } from '@/composables/useOverlayBackstack';
import { useBookSourceStore } from '@/stores';
import { saveExportFile } from '@/utils/exportFile';
import defaultLogoUrl from '../../assets/booksource-default.svg';
import {
  type BookSourceMeta,
  readBookSource,
  saveBookSource,
  deleteBookSource,
  toggleBookSource,
  toSafeFileName,
  newBookSourceTemplate,
  newVideoSourceTemplate,
  openInVscode,
  pickBookSourceDir,
  addBookSourceDir,
  removeBookSourceDir,
  configReadJson,
  configWrite,
  configDeleteKey,
} from '../../composables/useBookSource';
import BookSourceEditorModal from '../BookSourceEditorModal.vue';
import BookSourceInstallDialog from '../BookSourceInstallDialog.vue';
import SourceCard from './SourceCard.vue';

const props = defineProps<{
  sources: BookSourceMeta[];
  sourceDir: string;
  sourceDirs: string[];
  loading: boolean;
}>();

const emits = defineEmits<{
  reload: [];
  navigateTab: [tab: string];
  selectDebugSource: [source: BookSourceMeta];
}>();

const message = useMessage();
const bookSourceStore = useBookSourceStore();
const dialog = useDialog();

const { exploreDisabled, searchDisabled } = storeToRefs(bookSourceStore);
const { setExploreUserEnabled, setSearchUserEnabled, getPendingUpdate } = bookSourceStore;

// ---- 搜索过滤 ----
const searchQuery = ref('');
const filtered = computed(() => {
  const q = searchQuery.value.trim();
  if (!q) {
    return props.sources;
  }
  return props.sources.filter(
    (s) => s.name.includes(q) || s.url.includes(q) || s.tags.some((t) => t.includes(q)),
  );
});

// ---- 目录相关 ----
async function openSourceDirInExplorer() {
  if (!props.sourceDir) {
    return;
  }
  try {
    await invokeWithTimeout('open_dir_in_explorer', { path: props.sourceDir });
  } catch (e: unknown) {
    message.error(`无法打开目录: ${e instanceof Error ? e.message : String(e)}`);
  }
}

const shortSourceDir = computed(() => {
  if (!props.sourceDir) {
    return '';
  }
  const sep = props.sourceDir.includes('\\') ? '\\' : '/';
  const parts = props.sourceDir.split(sep).filter(Boolean);
  if (parts.length <= 3) {
    return props.sourceDir;
  }
  return `…${sep}${parts.slice(-2).join(sep)}`;
});

function shortDir(dir: string) {
  const sep = dir.includes('\\') ? '\\' : '/';
  const parts = dir.split(sep).filter(Boolean);
  if (parts.length <= 3) {
    return dir;
  }
  return `…${sep}${parts.slice(-3).join(sep)}`;
}

const externalDirs = computed(() => {
  if (props.sourceDirs.length <= 1) {
    return [];
  }
  return props.sourceDirs.slice(1);
});

const showDirManager = ref(false);

useOverlayBackstack(
  () => showDirManager.value,
  () => {
    showDirManager.value = false;
  },
);

// ---- 导入在线书源 ----
const showUrlInputModal = ref(false);
const urlInputValue = ref('');
const showInstallDialog = ref(false);
const installDialogUrl = ref('');

useOverlayBackstack(
  () => showUrlInputModal.value,
  () => {
    showUrlInputModal.value = false;
  },
);

useOverlayBackstack(
  () => showInstallDialog.value,
  () => {
    showInstallDialog.value = false;
  },
);

function importFromUrl() {
  urlInputValue.value = '';
  showUrlInputModal.value = true;
}

function confirmUrlInput() {
  const url = urlInputValue.value.trim();
  if (!url) {
    message.warning('请输入书源地址');
    return;
  }
  if (!/^https?:\/\//i.test(url)) {
    message.warning('请输入有效的 http(s) 地址');
    return;
  }
  showUrlInputModal.value = false;
  installDialogUrl.value = url;
  showInstallDialog.value = true;
}

async function addExternalDir() {
  try {
    const picked = await pickBookSourceDir();
    if (!picked) {
      return;
    }
    await addBookSourceDir(picked);
    emits('reload');
    message.success(`已添加目录: ${shortDir(picked)}`);
  } catch (e: unknown) {
    message.error(`添加失败: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function removeExternalDir(dir: string) {
  try {
    await removeBookSourceDir(dir);
    emits('reload');
    message.success(`已移除目录: ${shortDir(dir)}`);
  } catch (e: unknown) {
    message.error(`移除失败: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ---- 编辑器弹窗 ----
const showEditor = ref(false);
const editorTitle = ref('');
const editorContent = ref('');
const editorFile = ref('');
const editorSourceDir = ref('');
const editorSaving = ref(false);
const editorReloaded = ref(false);
const editorOpenKey = ref(0);
const updatingSourceSet = ref(new Set<string>());

// ---- 每书源最小请求延迟覆盖 ----
const MIN_DELAY_KEY = '__min_delay_ms';
/** fileName → 已加载的覆盖值（null = 未加载，0 = 跟随全局） */
const sourceDelayOverrides = ref<Map<string, number>>(new Map());

async function loadDelayOverride(fileName: string): Promise<void> {
  if (sourceDelayOverrides.value.has(fileName)) {
    return;
  }
  const v = await configReadJson<number>(fileName, MIN_DELAY_KEY);
  sourceDelayOverrides.value.set(fileName, v ?? 0);
}

async function saveDelayOverride(src: BookSourceMeta, val: number | null): Promise<void> {
  const effective = val === null || val <= 0 ? 0 : val;
  if (effective === 0) {
    await configDeleteKey(src.fileName, MIN_DELAY_KEY);
    sourceDelayOverrides.value.set(src.fileName, 0);
  } else {
    await configWrite(src.fileName, MIN_DELAY_KEY, effective);
    sourceDelayOverrides.value.set(src.fileName, effective);
  }
  // 使 worker 重新加载以生效
  await reloadSingleSource(src);
}

async function openEditor(src?: BookSourceMeta, newType?: 'novel' | 'comic' | 'video') {
  if (src) {
    editorTitle.value = `编辑：${src.name}`;
    editorFile.value = src.fileName;
    editorSourceDir.value = src.sourceDir;
    try {
      editorContent.value = await readBookSource(src.fileName, src.sourceDir);
    } catch (e: unknown) {
      message.error(`读取失败: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
  } else {
    editorTitle.value = '新建书源';
    editorFile.value = '';
    editorSourceDir.value = '';
    editorContent.value = newType === 'video' ? newVideoSourceTemplate() : newBookSourceTemplate();
  }
  editorOpenKey.value += 1;
  showEditor.value = true;
}

async function saveEditor() {
  if (!editorFile.value) {
    const match = editorContent.value.match(/@name\s+(.+)/);
    const name = match?.[1]?.trim() || '未命名书源';
    editorFile.value = toSafeFileName(name);
  }
  editorSaving.value = true;
  try {
    await saveBookSource(editorFile.value, editorContent.value, editorSourceDir.value || undefined);
    message.success('已保存');
    showEditor.value = false;
    emits('reload');
  } catch (e: unknown) {
    message.error(`保存失败: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    editorSaving.value = false;
  }
}

async function openEditorInVscode() {
  if (!editorFile.value) {
    message.warning('请先保存书源，再用 VS Code 打开');
    return;
  }
  try {
    await openInVscode(editorFile.value, editorSourceDir.value || undefined);
  } catch (e: unknown) {
    message.error(`${e instanceof Error ? e.message : String(e)}`);
  }
}

function importFromFile() {
  const input = document.createElement('input');
  input.type = 'file';
  // Android 不识别 .js 扩展名过滤（会灰化文件），改用 MIME 类型；
  // text/* 兼容 text/javascript / text/plain 等，确保 Android 文件管理器可选 .js 文件
  input.accept = 'text/javascript,application/javascript,text/plain,.js,application/json,.json';
  input.multiple = true;
  input.addEventListener('change', async () => {
    if (!input.files?.length) {
      return;
    }
    const files = Array.from(input.files);
    let ok = 0;
    const errors: string[] = [];
    for (const file of files) {
      try {
        const text = await file.text();
        if (file.name.toLowerCase().endsWith('.json')) {
          // JSON 批量导入：[{ fileName, content }] 格式
          const arr: Array<{ fileName: string; content: string }> = JSON.parse(text);
          if (!Array.isArray(arr)) {
            throw new Error('JSON 格式错误，应为数组');
          }
          for (const item of arr) {
            if (typeof item.fileName === 'string' && typeof item.content === 'string') {
              await saveBookSource(item.fileName, item.content);
              ok++;
            }
          }
        } else {
          await saveBookSource(file.name, text);
          ok++;
        }
      } catch (e) {
        errors.push(`${file.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    for (const err of errors) {
      message.error(`导入失败 — ${err}`);
    }
    if (ok) {
      message.success(`已导入 ${ok} 个书源`);
      emits('reload');
    }
  });
  input.click();
}

async function exportSources() {
  const sources = props.sources;
  if (!sources.length) {
    message.warning('没有可导出的书源');
    return;
  }
  let ok = 0;
  const items: Array<{ fileName: string; content: string }> = [];
  for (const src of sources) {
    try {
      const content = await readBookSource(src.fileName, src.sourceDir);
      items.push({ fileName: src.fileName, content });
      ok++;
    } catch {
      // 跳过读取失败的书源
    }
  }
  if (!items.length) {
    message.error('书源读取失败，无法导出');
    return;
  }
  const saved = await saveExportFile({
    defaultName: `booksources-${new Date().toISOString().slice(0, 10)}.json`,
    mime: 'application/json;charset=utf-8',
    text: JSON.stringify(items, null, 2),
    filterName: 'JSON',
    extensions: ['json'],
  });
  if (saved) {
    message.success(`已导出 ${ok} 个书源`);
  }
}

// ---- 书源操作 ----
async function onToggle(src: BookSourceMeta) {
  try {
    await toggleBookSource(src.fileName, !src.enabled, src.sourceDir);
    src.enabled = !src.enabled;
    // toggle 成功后触发新启用书源的能力检测（不影响列表渲染）
    if (src.enabled) {
      void bookSourceStore.detectCapabilities(src.fileName);
    }
  } catch (e: unknown) {
    message.error(`切换失败: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function confirmDelete(src: BookSourceMeta) {
  dialog.warning({
    title: '删除书源',
    content: `确认删除「${src.name}」？此操作将删除磁盘文件，不可恢复。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await deleteBookSource(src.fileName, src.sourceDir);
        emits('reload');
        message.success('已删除');
      } catch (e: unknown) {
        message.error(`删除失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  });
}

async function reloadAllSources() {
  try {
    emits('reload');
    await eventEmit('app:booksource-reload', { scope: 'all' });
    message.success('已重载所有书源');
  } catch {
    /* ignore */
  }
}

async function reloadSingleSource(src: BookSourceMeta) {
  try {
    bookSourceStore.invalidateCapability(src.fileName);
    emits('reload');
    await eventEmit('app:booksource-reload', { scope: 'single', fileName: src.fileName });
    message.success(`已重载「${src.name}」`);
  } catch (e: unknown) {
    message.error(`重载失败: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function applySourceUpdate(src: BookSourceMeta) {
  if (updatingSourceSet.value.has(src.uuid)) {
    return;
  }
  updatingSourceSet.value.add(src.uuid);
  try {
    await bookSourceStore.applyUpdate(src.fileName);
    emits('reload');
    await eventEmit('app:booksource-reload', { scope: 'single', fileName: src.fileName });
    message.success(`已升级「${src.name}」`);
  } catch (e: unknown) {
    message.error(`升级失败: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    updatingSourceSet.value.delete(src.uuid);
  }
}

// ---- 能力检测 ----
function ensureCapabilities() {
  for (const src of props.sources) {
    if (!bookSourceStore.getCachedCapabilities(src.fileName)) {
      bookSourceStore.detectCapabilities(src.fileName);
    }
  }
}

// 外部文件变化 → 编辑器自动重载
async function handleFileChange(fileName: string) {
  if (showEditor.value && editorFile.value === fileName) {
    try {
      editorContent.value = await readBookSource(fileName, editorSourceDir.value || undefined);
      editorReloaded.value = true;
      setTimeout(() => {
        editorReloaded.value = false;
      }, 3000);
    } catch {
      /* 文件可能被删除 */
    }
  }
}

function openDirManager() {
  showDirManager.value = true;
}

defineExpose({
  ensureCapabilities,
  handleFileChange,
  openDirManager,
  importFromFile,
  importFromUrl,
  exportSources,
  openEditor,
  reloadAllSources,
});
</script>

<template>
  <div class="bv-pane">
    <!-- 工具栏 -->
    <div class="bv-toolbar">
      <n-input
        v-model:value="searchQuery"
        placeholder="搜索书源名称或 URL..."
        clearable
        size="small"
        style="width: 220px; max-width: 100%"
      >
        <template #prefix>
          <Search :size="13" />
        </template>
      </n-input>
      <!-- 统计 -->
      <span class="bv-stat">
        共 {{ filtered.length }} 个书源， 已启用
        {{ filtered.filter((s) => s.enabled).length }} 个<template v-if="sourceDirs.length > 1"
          >，{{ sourceDirs.length }} 个目录</template
        >
      </span>
    </div>
    <!-- 列表 -->
    <n-spin :show="loading" class="bv-source-list-wrap">
      <div class="bv-source-list app-scrollbar">
        <SourceCard
          v-for="src in filtered"
          :key="src.sourceKey"
          :src="src"
          :source-dir="sourceDir"
          :default-logo-url="defaultLogoUrl"
          :search-enabled="!searchDisabled.has(src.fileName)"
          :explore-enabled="!exploreDisabled.has(src.fileName)"
          :capabilities="bookSourceStore.getCachedCapabilities(src.fileName) ?? undefined"
          :delay-override="sourceDelayOverrides.get(src.fileName) ?? 0"
          :update-info="getPendingUpdate(src.uuid)"
          :update-busy="updatingSourceSet.has(src.uuid)"
          @toggle="onToggle(src)"
          @edit="openEditor(src)"
          @reload="reloadSingleSource(src)"
          @delete="confirmDelete(src)"
          @navigate-debug="emits('navigateTab', 'debug'); emits('selectDebugSource', src)"
          @open-url="openUrl($event)"
          @toggle-search="setSearchUserEnabled(src.fileName, searchDisabled.has(src.fileName))"
          @toggle-explore="setExploreUserEnabled(src.fileName, exploreDisabled.has(src.fileName))"
          @load-delay="loadDelayOverride(src.fileName)"
          @save-delay="saveDelayOverride(src, $event)"
          @apply-update="applySourceUpdate(src)"
        />
        <n-empty
          v-if="!filtered.length && !loading"
          description="暂无书源，可导入 .js 文件或从在线仓库安装"
          style="padding: 48px 0"
        />
      </div>
    </n-spin>
  </div>

  <!-- 书源编辑器弹窗 -->
  <BookSourceEditorModal
    v-model:show="showEditor"
    v-model:content="editorContent"
    :title="editorTitle"
    :file-name="editorFile"
    :saving="editorSaving"
    :reloaded="editorReloaded"
    :editor-key="editorOpenKey"
    @save="saveEditor"
    @open-vscode="openEditorInVscode"
  />

  <!-- 外部目录管理弹窗 -->
  <n-modal
    v-model:show="showDirManager"
    preset="card"
    title="书源目录管理"
    style="width: 560px; max-width: 95vw"
    :mask-closable="true"
  >
    <div class="dir-mgr">
      <div class="dir-mgr__item dir-mgr__item--builtin">
        <div class="dir-mgr__path">
          <n-tag size="tiny" type="primary" :bordered="false">内置</n-tag>
          <span class="dir-mgr__path-text" :title="sourceDir">{{ shortSourceDir }}</span>
        </div>
        <n-button size="tiny" quaternary @click="openSourceDirInExplorer">打开</n-button>
      </div>
      <div v-for="dir in externalDirs" :key="dir" class="dir-mgr__item">
        <div class="dir-mgr__path">
          <n-tag size="tiny" type="info" :bordered="false">外部</n-tag>
          <span class="dir-mgr__path-text" :title="dir">{{ shortDir(dir) }}</span>
        </div>
        <div class="dir-mgr__actions">
          <n-button
            size="tiny"
            quaternary
            @click="invokeWithTimeout('open_dir_in_explorer', { path: dir })"
            >打开</n-button
          >
          <n-button size="tiny" quaternary type="error" @click="removeExternalDir(dir)"
            >移除</n-button
          >
        </div>
      </div>
      <n-empty
        v-if="!externalDirs.length"
        description="未添加外部目录"
        size="small"
        style="padding: 16px 0"
      />
    </div>
    <template #footer>
      <div style="display: flex; justify-content: space-between; align-items: center">
        <span class="dir-mgr__hint">外部目录中的 .js 书源将被自动载入，文件变动实时监听。</span>
        <n-button type="primary" size="small" @click="addExternalDir">添加外部目录</n-button>
      </div>
    </template>
  </n-modal>

  <!-- 导入在线书源：URL 输入弹窗 -->
  <n-modal
    v-model:show="showUrlInputModal"
    preset="dialog"
    title="导入在线书源"
    positive-text="安装"
    negative-text="取消"
    @positive-click="confirmUrlInput"
    @negative-click="showUrlInputModal = false"
  >
    <n-input
      v-model:value="urlInputValue"
      placeholder="输入书源 .js 文件地址（https://...）"
      clearable
      autofocus
      @keyup.enter="confirmUrlInput"
    />
  </n-modal>

  <!-- 书源安装确认弹窗 -->
  <BookSourceInstallDialog
    :show="showInstallDialog"
    :download-url="installDialogUrl"
    @update:show="showInstallDialog = $event"
    @installed="$emit('reload')"
  />
</template>

<style scoped>
/* ---- 工具栏 ---- */
.bv-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

/* ---- 统计 ---- */
.bv-stat {
  flex-shrink: 0;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  white-space: nowrap;
}

/* ---- Pane ---- */
.bv-pane {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
  padding-top: 12px;
}

.bv-pane :deep(.n-spin-container) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.bv-pane :deep(.n-spin-content) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* ---- 列表 ---- */
.bv-source-list-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.bv-source-list {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-right: 4px;
  padding-bottom: 16px;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

/* ---- 目录管理弹窗 ---- */
.dir-mgr {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dir-mgr__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}

.dir-mgr__item--builtin {
  background: var(--color-surface-raised);
}

.dir-mgr__path {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.dir-mgr__path-text {
  font-family: var(--font-mono, monospace);
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dir-mgr__actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.dir-mgr__hint {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

/* ---- 移动端 ---- */
@media (pointer: coarse), (max-width: 640px) {
  .bv-toolbar {
    align-items: stretch;
    gap: 6px;
  }

  .bv-stat {
    width: 100%;
    white-space: normal;
    line-height: 1.4;
  }
}
</style>
