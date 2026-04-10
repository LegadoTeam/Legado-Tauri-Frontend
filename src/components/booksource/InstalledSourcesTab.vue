<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMessage, useDialog } from 'naive-ui'
import { emit } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { openUrl } from '@tauri-apps/plugin-opener'
import BookSourceEditorModal from '../BookSourceEditorModal.vue'
import defaultLogoUrl from '../../assets/booksource-default.svg'
import {
  type BookSourceMeta,
  readBookSource,
  saveBookSource,
  deleteBookSource,
  toggleBookSource,
  toSafeFileName,
  newBookSourceTemplate,
  openInVscode,
  pickBookSourceDir,
  addBookSourceDir,
  removeBookSourceDir,
} from '../../composables/useBookSource'
import {
  detectCapabilities,
  invalidateCapability,
  getCachedCapabilities,
  useCapabilityFlags,
} from '../../composables/useSourceCapabilities'

const props = defineProps<{
  sources: BookSourceMeta[]
  sourceDir: string
  sourceDirs: string[]
  loading: boolean
}>()

const emits = defineEmits<{
  reload: []
  navigateTab: [tab: string]
  selectDebugSource: [fileName: string]
}>()

const message = useMessage()
const dialog = useDialog()

const {
  exploreDisabled,
  searchDisabled,
  setExploreUserEnabled,
  setSearchUserEnabled,
} = useCapabilityFlags()

// ---- 搜索过滤 ----
const searchQuery = ref('')
const filtered = computed(() => {
  const q = searchQuery.value.trim()
  if (!q) return props.sources
  return props.sources.filter(s =>
    s.name.includes(q) || s.url.includes(q) || s.tags.some(t => t.includes(q)),
  )
})

// ---- 目录相关 ----
async function openSourceDirInExplorer() {
  if (!props.sourceDir) return
  try {
    await invoke('open_dir_in_explorer', { path: props.sourceDir })
  } catch (e: unknown) {
    message.error(`无法打开目录: ${e instanceof Error ? e.message : String(e)}`)
  }
}

const shortSourceDir = computed(() => {
  if (!props.sourceDir) return ''
  const sep = props.sourceDir.includes('\\') ? '\\' : '/'
  const parts = props.sourceDir.split(sep).filter(Boolean)
  if (parts.length <= 3) return props.sourceDir
  return `…${sep}${parts.slice(-2).join(sep)}`
})

function shortDir(dir: string) {
  const sep = dir.includes('\\') ? '\\' : '/'
  const parts = dir.split(sep).filter(Boolean)
  if (parts.length <= 3) return dir
  return `…${sep}${parts.slice(-3).join(sep)}`
}

const externalDirs = computed(() => {
  if (props.sourceDirs.length <= 1) return []
  return props.sourceDirs.slice(1)
})

const showDirManager = ref(false)

async function addExternalDir() {
  try {
    const picked = await pickBookSourceDir()
    if (!picked) return
    await addBookSourceDir(picked)
    emits('reload')
    message.success(`已添加目录: ${shortDir(picked)}`)
  } catch (e: unknown) {
    message.error(`添加失败: ${e instanceof Error ? e.message : String(e)}`)
  }
}

async function removeExternalDir(dir: string) {
  try {
    await removeBookSourceDir(dir)
    emits('reload')
    message.success(`已移除目录: ${shortDir(dir)}`)
  } catch (e: unknown) {
    message.error(`移除失败: ${e instanceof Error ? e.message : String(e)}`)
  }
}

// ---- 编辑器弹窗 ----
const showEditor = ref(false)
const editorTitle = ref('')
const editorContent = ref('')
const editorFile = ref('')
const editorSaving = ref(false)
const editorReloaded = ref(false)

async function openEditor(src?: BookSourceMeta) {
  if (src) {
    editorTitle.value = `编辑：${src.name}`
    editorFile.value = src.fileName
    try {
      editorContent.value = await readBookSource(src.fileName)
    } catch (e: unknown) {
      message.error(`读取失败: ${e instanceof Error ? e.message : String(e)}`)
      return
    }
  } else {
    editorTitle.value = '新建书源'
    editorFile.value = ''
    editorContent.value = newBookSourceTemplate()
  }
  showEditor.value = true
}

async function saveEditor() {
  if (!editorFile.value) {
    const match = editorContent.value.match(/@name\s+(.+)/)
    const name = match?.[1]?.trim() || '未命名书源'
    editorFile.value = toSafeFileName(name)
  }
  editorSaving.value = true
  try {
    await saveBookSource(editorFile.value, editorContent.value)
    message.success('已保存')
    showEditor.value = false
    emits('reload')
  } catch (e: unknown) {
    message.error(`保存失败: ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    editorSaving.value = false
  }
}

async function openEditorInVscode() {
  if (!editorFile.value) {
    message.warning('请先保存书源，再用 VS Code 打开')
    return
  }
  try {
    await openInVscode(editorFile.value)
  } catch (e: unknown) {
    message.error(`${e instanceof Error ? e.message : String(e)}`)
  }
}

function importFromFile() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.js'
  input.multiple = true
  input.onchange = async () => {
    if (!input.files?.length) return
    let ok = 0
    for (const file of Array.from(input.files)) {
      try {
        const text = await file.text()
        await saveBookSource(file.name, text)
        ok++
      } catch (e: unknown) {
        message.error(`导入 ${file.name} 失败: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    if (ok) {
      message.success(`已导入 ${ok} 个书源`)
      emits('reload')
    }
  }
  input.click()
}

// ---- 书源操作 ----
async function onToggle(src: BookSourceMeta) {
  try {
    await toggleBookSource(src.fileName, !src.enabled)
    src.enabled = !src.enabled
  } catch (e: unknown) {
    message.error(`切换失败: ${e instanceof Error ? e.message : String(e)}`)
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
        await deleteBookSource(src.fileName)
        emits('reload')
        message.success('已删除')
      } catch (e: unknown) {
        message.error(`删除失败: ${e instanceof Error ? e.message : String(e)}`)
      }
    },
  })
}

async function reloadAllSources() {
  try {
    emits('reload')
    await emit('app:booksource-reload', { scope: 'all' })
    message.success('已重载所有书源')
  } catch { /* ignore */ }
}

async function reloadSingleSource(src: BookSourceMeta) {
  try {
    invalidateCapability(src.fileName)
    emits('reload')
    await emit('app:booksource-reload', { scope: 'single', fileName: src.fileName })
    message.success(`已重载「${src.name}」`)
  } catch (e: unknown) {
    message.error(`重载失败: ${e instanceof Error ? e.message : String(e)}`)
  }
}

// ---- 能力检测 ----
function ensureCapabilities() {
  for (const src of props.sources) {
    if (!getCachedCapabilities(src.fileName)) {
      detectCapabilities(src.fileName)
    }
  }
}

// 外部文件变化 → 编辑器自动重载
async function handleFileChange(fileName: string) {
  if (showEditor.value && editorFile.value === fileName) {
    try {
      editorContent.value = await readBookSource(fileName)
      editorReloaded.value = true
      setTimeout(() => { editorReloaded.value = false }, 3000)
    } catch { /* 文件可能被删除 */ }
  }
}

function openDirManager() {
  showDirManager.value = true
}

defineExpose({ ensureCapabilities, handleFileChange, openDirManager, importFromFile, openEditor, reloadAllSources })
</script>

<template>
  <div class="bv-pane">
    <!-- 工具栏 -->
    <div class="bv-toolbar">
      <n-input v-model:value="searchQuery" placeholder="搜索书源名称或 URL..." clearable size="small"
        style="width:220px;max-width:100%">
        <template #prefix>
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </template>
      </n-input>
      <!-- 统计 -->
      <span class="bv-stat">
        共 {{ filtered.length }} 个书源，
        已启用 {{filtered.filter(s => s.enabled).length}} 个<template v-if="sourceDirs.length > 1">，{{ sourceDirs.length
        }} 个目录</template>
      </span>
    </div>
    <!-- 列表 -->
    <n-spin :show="loading" class="bv-source-list-wrap">
      <div class="bv-source-list">
        <div v-for="src in filtered" :key="src.fileName" class="src-card" :class="{ 'src-card--off': !src.enabled }">
          <!-- 顶部：Logo + 标题区 + 开关 -->
          <div class="src-card__header">
            <img v-if="src.logo && src.logo.toLowerCase() !== 'default'" :src="src.logo" class="src-card__logo"
              :alt="src.name" @error="($event.target as HTMLImageElement).src = defaultLogoUrl" />
            <img v-else :src="defaultLogoUrl" class="src-card__logo" :alt="src.name" />

            <div class="src-card__title">
              <div class="src-card__name-line">
                <span class="src-card__name">{{ src.name }}</span>
                <n-tag v-if="!src.enabled" size="tiny" :bordered="false"
                  class="src-card__badge src-card__badge--off">已禁用</n-tag>
                <n-tag v-if="src.tags[0]" size="tiny" :bordered="false"
                  class="src-card__badge src-card__badge--group">{{
                    src.tags[0] }}</n-tag>
                <n-tag v-if="src.sourceDir !== sourceDir" size="tiny" type="info" :bordered="false"
                  class="src-card__badge" :title="src.sourceDir">外部</n-tag>
                <span v-if="src.author" class="src-card__author">{{ src.author }}</span>
              </div>
              <div class="src-card__url-line">
                <a class="src-card__url" href="#" @click.prevent.stop="openUrl(src.url)">{{ src.url }}</a>
                <n-tag v-if="src.urls && src.urls.length > 1" size="tiny" type="warning" :bordered="false"
                  class="src-card__mirror" :title="src.urls.join('\n')">+{{ src.urls.length - 1 }} 镜像</n-tag>
              </div>
            </div>

            <n-switch :value="src.enabled" size="small" class="src-card__switch" @update:value="onToggle(src)" />
          </div>

          <!-- 能力 + 标签 -->
          <div class="src-card__chips">
            <template v-if="getCachedCapabilities(src.fileName)">
              <n-tag v-if="getCachedCapabilities(src.fileName)?.has('search')" size="tiny" :bordered="false"
                :type="!searchDisabled.has(src.fileName) ? 'success' : 'default'" class="src-card__cap"
                @click.stop="setSearchUserEnabled(src.fileName, searchDisabled.has(src.fileName))">搜索{{
                  !searchDisabled.has(src.fileName) ? '✓' : '✗' }}</n-tag>
              <n-tag v-if="getCachedCapabilities(src.fileName)?.has('explore')" size="tiny" :bordered="false"
                :type="!exploreDisabled.has(src.fileName) ? 'info' : 'default'" class="src-card__cap"
                @click.stop="setExploreUserEnabled(src.fileName, exploreDisabled.has(src.fileName))">发现{{
                  !exploreDisabled.has(src.fileName) ? '✓' : '✗' }}</n-tag>
              <n-tag v-if="getCachedCapabilities(src.fileName)?.has('bookInfo')" size="tiny" :bordered="false"
                class="src-card__cap src-card__cap--dim">书目</n-tag>
              <n-tag v-if="getCachedCapabilities(src.fileName)?.has('chapterList')" size="tiny" :bordered="false"
                class="src-card__cap src-card__cap--dim">目录</n-tag>
              <n-tag v-if="getCachedCapabilities(src.fileName)?.has('chapterContent')" size="tiny" :bordered="false"
                class="src-card__cap src-card__cap--dim">正文</n-tag>
            </template>
            <span v-else class="src-card__cap-loading">检测中…</span>
            <template v-if="src.tags.length > 1">
              <span class="src-card__chip-sep" />
              <n-tag v-for="t in src.tags.slice(1)" :key="t" size="tiny" :bordered="false" class="src-card__tag">{{ t
              }}</n-tag>
            </template>
          </div>

          <!-- 描述 -->
          <div v-if="src.description" class="src-card__desc">{{ src.description }}</div>

          <!-- 操作栏 -->
          <div class="src-card__actions">
            <n-button size="tiny" quaternary class="src-action src-action--edit" @click="openEditor(src)">编辑</n-button>
            <n-button size="tiny" quaternary class="src-action" @click="reloadSingleSource(src)">重载</n-button>
            <n-button size="tiny" quaternary class="src-action src-action--debug"
              @click="emits('navigateTab', 'debug'); emits('selectDebugSource', src.fileName)">调试</n-button>
            <n-button size="tiny" quaternary class="src-action src-action--delete"
              @click="confirmDelete(src)">删除</n-button>
          </div>
        </div>
        <n-empty v-if="!filtered.length && !loading" description="暂无书源，可导入 .js 文件或从在线仓库安装" style="padding:48px 0" />
      </div>
    </n-spin>
  </div>

  <!-- 书源编辑器弹窗 -->
  <BookSourceEditorModal v-model:show="showEditor" v-model:content="editorContent" :title="editorTitle"
    :file-name="editorFile" :saving="editorSaving" :reloaded="editorReloaded" @save="saveEditor"
    @open-vscode="openEditorInVscode" />

  <!-- 外部目录管理弹窗 -->
  <n-modal v-model:show="showDirManager" preset="card" title="书源目录管理" style="width:560px;max-width:95vw"
    :mask-closable="true">
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
          <n-button size="tiny" quaternary @click="invoke('open_dir_in_explorer', { path: dir })">打开</n-button>
          <n-button size="tiny" quaternary type="error" @click="removeExternalDir(dir)">移除</n-button>
        </div>
      </div>
      <n-empty v-if="!externalDirs.length" description="未添加外部目录" size="small" style="padding: 16px 0" />
    </div>
    <template #footer>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="dir-mgr__hint">外部目录中的 .js 书源将被自动载入，文件变动实时监听。</span>
        <n-button type="primary" size="small" @click="addExternalDir">添加外部目录</n-button>
      </div>
    </template>
  </n-modal>
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
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-right: 4px;
}

.bv-source-list::-webkit-scrollbar {
  width: 5px;
}

.bv-source-list::-webkit-scrollbar-track {
  background: transparent;
}

.bv-source-list::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 3px;
}

.bv-source-list::-webkit-scrollbar-thumb:hover {
  background: var(--color-text-muted);
}

/* ---- 卡片 ---- */
.src-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  border-left: 3px solid transparent;
  background: var(--color-surface-raised);
  transition: border-color var(--transition-fast), background var(--transition-fast), box-shadow var(--transition-fast);
}

.src-card:hover {
  border-color: var(--color-accent);
  border-left-color: var(--color-accent);
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.06);
}

.src-card--off {
  opacity: 0.55;
  border-left-color: var(--color-danger);
}

.src-card--off:hover {
  border-left-color: var(--color-danger);
}

.src-card__header {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 36px;
}

.src-card__logo {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-xs);
  object-fit: contain;
  flex-shrink: 0;
  opacity: 0.85;
  transition: opacity var(--transition-fast);
}

.src-card:hover .src-card__logo {
  opacity: 1;
}

.src-card__title {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.src-card__name-line {
  display: flex;
  align-items: center;
  gap: 5px;
  overflow: hidden;
}

.src-card__name {
  font-size: 0.8375rem;
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 240px;
  flex-shrink: 1;
}

.src-card__badge {
  flex-shrink: 0;
  font-size: 0.625rem !important;
  --n-border-radius: 3px !important;
}

.src-card__badge--off {
  --n-color: var(--color-danger-subtle) !important;
  --n-text-color: var(--color-danger) !important;
  font-weight: 600;
}

.src-card__badge--group {
  --n-color: var(--color-surface-hover) !important;
  --n-text-color: var(--color-text-muted) !important;
}

.src-card__author {
  font-size: 0.6875rem;
  color: var(--color-text-muted);
  opacity: 0.6;
  white-space: nowrap;
  flex-shrink: 0;
  margin-left: auto;
}

.src-card__url-line {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}

.src-card__url {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
  opacity: 0.6;
  text-decoration: none;
  cursor: pointer;
  transition: color var(--transition-fast), opacity var(--transition-fast);
}

.src-card__url:hover {
  color: var(--color-accent);
  opacity: 1;
  text-decoration: underline;
}

.src-card__mirror {
  flex-shrink: 0;
}

.src-card__switch {
  flex-shrink: 0;
}

.src-card__chips {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.src-card__cap {
  font-size: 0.625rem !important;
  height: 16px !important;
  line-height: 14px !important;
  padding: 0 5px !important;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}

.src-card__cap--dim {
  cursor: default;
  --n-color: color-mix(in srgb, var(--color-border) 60%, transparent) !important;
  --n-text-color: var(--color-text-muted) !important;
  opacity: 0.7;
}

.src-card__cap-loading {
  font-size: 0.6rem;
  color: var(--color-text-muted);
  opacity: 0.5;
}

.src-card__chip-sep {
  width: 1px;
  height: 10px;
  background: var(--color-border);
  flex-shrink: 0;
  margin: 0 2px;
}

.src-card__tag {
  font-size: 0.6rem !important;
  height: 15px !important;
  line-height: 13px !important;
  padding: 0 5px !important;
  --n-color: color-mix(in srgb, var(--color-border) 80%, transparent) !important;
  --n-text-color: var(--color-text-muted) !important;
  opacity: 0.65;
}

.src-card__desc {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-left: 42px;
  opacity: 0.75;
}

.src-card__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.src-card:hover .src-card__actions {
  opacity: 1;
}

.src-action {
  font-size: 0.7125rem !important;
  padding: 0 7px !important;
  height: 22px !important;
  border-radius: var(--radius-xs) !important;
}

.src-action--edit {
  --n-text-color: var(--color-accent) !important;
  --n-text-color-hover: var(--color-accent) !important;
  --n-color-hover: var(--color-accent-subtle) !important;
}

.src-action--debug {
  --n-text-color: var(--color-text-secondary) !important;
  --n-text-color-hover: var(--color-text-primary) !important;
  --n-color-hover: var(--color-surface-hover) !important;
}

.src-action--delete {
  --n-text-color: var(--color-danger) !important;
  --n-text-color-hover: var(--color-danger) !important;
  --n-color-hover: var(--color-danger-subtle) !important;
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
@media (pointer: coarse),
(max-width: 640px) {
  .bv-toolbar {
    gap: 6px;
  }

  .src-card {
    padding: 8px 10px;
    gap: 5px;
  }

  .src-card__logo {
    width: 28px;
    height: 28px;
  }

  .src-card__name {
    max-width: 160px;
    font-size: 0.8rem;
  }

  .src-card__actions {
    opacity: 1 !important;
    margin-top: 2px;
  }

  .src-card__desc {
    padding-left: 38px;
  }
}
</style>
