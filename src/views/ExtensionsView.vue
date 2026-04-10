<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useMessage, useDialog } from 'naive-ui'
import { openPath } from '@tauri-apps/plugin-opener'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import {
  type ExtensionMeta,
  listExtensions,
  readExtension,
  saveExtension,
  deleteExtension,
  toggleExtension,
  getExtensionDir,
  openExtensionInVscode,
  toExtSafeFileName,
  newExtensionTemplate,
} from '../composables/useExtension'
import { EXAMPLE_SCRIPTS, type ExampleScript } from '../data/extensionExamples'

const message = useMessage()
const dialog  = useDialog()

const activeTab      = ref<'installed' | 'examples'>('installed')
const extensions     = ref<ExtensionMeta[]>([])
const extDir         = ref('')
const loading        = ref(false)
const searchQuery    = ref('')
const categoryFilter = ref<string | null>(null)

const showEditor       = ref(false)
const editorTitle      = ref('')
const editorContent    = ref('')
const editorFile       = ref('')
const editorSaving     = ref(false)
const editorVscodeOpen = ref(false)
const editorReloaded   = ref(false)

const showPreview      = ref(false)
const previewTitle     = ref('')
const previewSource    = ref('')
const previewExampleId = ref<string | null>(null)
const installLoading   = ref(false)

const categories = computed(() => {
  const cats = new Set(extensions.value.map(e => e.category || '其他'))
  return [
    { label: '全部', value: null },
    ...[...cats].map(c => ({ label: c, value: c })),
  ]
})

const filtered = computed(() =>
  extensions.value.filter(e => {
    const byCategory = !categoryFilter.value || e.category === categoryFilter.value
    const q = searchQuery.value.trim()
    const bySearch = !q ||
      e.name.includes(q) || e.description.includes(q) ||
      e.author.includes(q) || e.category.includes(q)
    return byCategory && bySearch
  })
)

const installedFileNames = computed(() => new Set(extensions.value.map(e => e.fileName)))

async function loadExtensions() {
  loading.value = true
  try {
    const [list, dir] = await Promise.all([listExtensions(), getExtensionDir()])
    extensions.value = list
    extDir.value     = dir
  } catch (e: unknown) {
    message.error(`加载失败: ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    loading.value = false
  }
}

async function openDirInExplorer() {
  if (!extDir.value) return
  try { await openPath(extDir.value) }
  catch (e: unknown) { message.error(`无法打开目录: ${e instanceof Error ? e.message : String(e)}`) }
}

async function onToggle(ext: ExtensionMeta) {
  try {
    await toggleExtension(ext.fileName, !ext.enabled)
    ext.enabled = !ext.enabled
  } catch (e: unknown) {
    message.error(`切换失败: ${e instanceof Error ? e.message : String(e)}`)
  }
}

function confirmDelete(ext: ExtensionMeta) {
  dialog.warning({
    title: '删除扩展',
    content: `确认删除「${ext.name}」？此操作将删除磁盘文件，不可恢复。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await deleteExtension(ext.fileName)
        extensions.value = extensions.value.filter(e => e.fileName !== ext.fileName)
        message.success('已删除')
      } catch (e: unknown) {
        message.error(`删除失败: ${e instanceof Error ? e.message : String(e)}`)
      }
    },
  })
}

async function openEditor(ext?: ExtensionMeta) {
  if (ext) {
    editorTitle.value = `编辑：${ext.name}`
    editorFile.value  = ext.fileName
    try {
      editorContent.value = await readExtension(ext.fileName)
    } catch (e: unknown) {
      message.error(`读取失败: ${e instanceof Error ? e.message : String(e)}`)
      return
    }
  } else {
    editorTitle.value   = '新建扩展'
    editorFile.value    = ''
    editorContent.value = newExtensionTemplate()
  }
  showEditor.value = true
}

async function saveEditor() {
  if (!editorFile.value) {
    const m    = editorContent.value.match(/\/\/\s*@name\s+(.+)/)
    const name = m?.[1]?.trim() || '未命名扩展'
    editorFile.value = toExtSafeFileName(name)
  }
  editorSaving.value = true
  try {
    await saveExtension(editorFile.value, editorContent.value)
    message.success('已保存')
    showEditor.value = false
    await loadExtensions()
  } catch (e: unknown) {
    message.error(`保存失败: ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    editorSaving.value = false
  }
}

async function openEditorInVscode() {
  if (!editorFile.value) { message.warning('请先保存，再用 VS Code 打开'); return }
  editorVscodeOpen.value = true
  try {
    await openExtensionInVscode(editorFile.value)
  } catch (e: unknown) {
    message.error(`${e instanceof Error ? e.message : String(e)}`)
  } finally {
    editorVscodeOpen.value = false
  }
}

async function viewInstalledCode(ext: ExtensionMeta) {
  try {
    previewSource.value    = await readExtension(ext.fileName)
    previewTitle.value     = ext.name
    previewExampleId.value = null
    showPreview.value      = true
  } catch (e: unknown) {
    message.error(`读取失败: ${e instanceof Error ? e.message : String(e)}`)
  }
}

function viewExampleCode(example: ExampleScript) {
  previewSource.value    = example.source
  previewTitle.value     = example.meta.name ?? example.id
  previewExampleId.value = example.id
  showPreview.value      = true
}

function isExampleInstalled(example: ExampleScript): boolean {
  return installedFileNames.value.has(toExtSafeFileName(example.meta.name ?? example.id))
}

async function installExample(example: ExampleScript) {
  const fileName = toExtSafeFileName(example.meta.name ?? example.id)
  installLoading.value = true
  try {
    await saveExtension(fileName, example.source)
    await loadExtensions()
    message.success(`已安装「${example.meta.name}」`)
  } catch (e: unknown) {
    message.error(`安装失败: ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    installLoading.value = false
  }
}

async function installFromPreview() {
  const example = EXAMPLE_SCRIPTS.find(e => e.id === previewExampleId.value)
  if (!example) return
  await installExample(example)
  showPreview.value = false
}

const CATEGORY_TYPE: Record<string, string> = {
  '内容处理': 'info', '统计': 'primary', '主题': 'success',
  '工具': 'warning', '书源辅助': 'error', '其他': 'default',
}
const CATEGORY_DOT: Record<string, string> = {
  '内容处理': '#4dabf7', '统计': '#9775fa', '主题': '#51cf66',
  '工具': '#ffa94d', '书源辅助': '#ff6b6b', '其他': '#adb5bd',
}
const RUN_AT_LABEL: Record<string, string> = {
  'document-start': '初始化时', 'content-ready': '内容就绪',
  'document-idle': '空闲时', 'document-end': '渲染后',
}

function catType(cat: string): string { return CATEGORY_TYPE[cat] ?? 'default' }
function catDot(cat: string):  string { return CATEGORY_DOT[cat]  ?? '#adb5bd' }
function runAtLabel(v: string): string { return RUN_AT_LABEL[v] ?? v }

let unlistenExt: UnlistenFn | null = null

onMounted(async () => {
  await loadExtensions()
  unlistenExt = await listen<{ fileName: string }>('extension:changed', async (event) => {
    await loadExtensions()
    if (showEditor.value && editorFile.value === event.payload.fileName) {
      try {
        editorContent.value  = await readExtension(event.payload.fileName)
        editorReloaded.value = true
        setTimeout(() => { editorReloaded.value = false }, 3000)
      } catch { /* 文件可能已被删除 */ }
    }
  })
})

onUnmounted(() => { unlistenExt?.() })
</script>

<template>
  <div class="ext-view">

    <!-- 页头 -->
    <div class="ext-header">
      <div class="ext-header__row">
        <h1 class="ext-header__title">插件管理  (暂未实现仅占位)</h1>
        <div
          v-if="extDir"
          class="ext-header__dir"
          @click="openDirInExplorer"
          title="在资源管理器中打开"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          <span class="ext-header__dir-path">{{ extDir }}</span>
        </div>
      </div>
      <p class="ext-header__sub">
        使用 UserScript 格式编写扩展，可接管内容处理、主题、统计等功能，由 Boa 引擎驱动
      </p>
    </div>

    <!-- 主 Tabs -->
    <n-tabs v-model:value="activeTab" type="line" animated class="ext-tabs">

      <!-- ===== 已安装 ===== -->
      <n-tab-pane name="installed" tab="已安装">
        <div class="ext-pane">

          <div class="ext-toolbar">
            <n-input
              v-model:value="searchQuery"
              placeholder="搜索名称、作者、分类..."
              clearable size="small" style="width:220px"
            >
              <template #prefix>
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </template>
            </n-input>
            <n-select v-model:value="categoryFilter" :options="categories" size="small" style="width:130px" />
            <div style="flex:1" />
            <n-button size="small" type="primary" @click="openEditor()">+ 新建扩展</n-button>
            <n-button size="small" quaternary :loading="loading" @click="loadExtensions">刷新</n-button>
          </div>

          <div class="ext-stats">
            共 {{ filtered.length }} 个扩展，已启用 {{ filtered.filter(e => e.enabled).length }} 个
          </div>

          <n-spin :show="loading" class="ext-list-wrap">
            <div class="ext-list">
              <div
                v-for="ext in filtered"
                :key="ext.fileName"
                class="ext-card"
                :class="{ 'ext-card--off': !ext.enabled }"
              >
                <div class="ext-card__stripe" :style="{ background: catDot(ext.category) }" />
                <div class="ext-card__body">
                  <div class="ext-card__name-row">
                    <span class="ext-card__name">{{ ext.name }}</span>
                    <n-tag :type="catType(ext.category) as any" size="tiny" :bordered="false">
                      {{ ext.category || '其他' }}
                    </n-tag>
                    <n-tag size="tiny" :bordered="false" style="background:var(--color-surface-secondary,rgba(0,0,0,.04))">
                      {{ runAtLabel(ext.runAt) }}
                    </n-tag>
                  </div>
                  <p class="ext-card__desc">{{ ext.description || '暂无描述' }}</p>
                  <div class="ext-card__meta">
                    <span>v{{ ext.version }}</span>
                    <span class="ext-card__dot" />
                    <span>{{ ext.author || '未知作者' }}</span>
                    <template v-if="ext.grants.length">
                      <span class="ext-card__dot" />
                      <span v-for="g in ext.grants.slice(0, 3)" :key="g" class="ext-card__grant">{{ g }}</span>
                      <span v-if="ext.grants.length > 3" class="ext-card__grant">+{{ ext.grants.length - 3 }}</span>
                    </template>
                  </div>
                </div>
                <div class="ext-card__actions">
                  <n-switch :value="ext.enabled" size="small" @update:value="onToggle(ext)" />
                  <n-button size="tiny" quaternary @click="viewInstalledCode(ext)">查看代码</n-button>
                  <n-button size="tiny" quaternary @click="openEditor(ext)">编辑</n-button>
                  <n-button size="tiny" quaternary type="error" @click="confirmDelete(ext)">删除</n-button>
                </div>
              </div>

              <n-empty
                v-if="!filtered.length && !loading"
                description="暂无扩展，可新建或从「内置示例」安装"
                style="padding:48px 0"
              />
            </div>
          </n-spin>

        </div>
      </n-tab-pane>

      <!-- ===== 内置示例 ===== -->
      <n-tab-pane name="examples" tab="内置示例">
        <div class="ext-pane">
          <p class="examples-tip">
            以下为内置示例脚本，展示 UserScript 格式与 Legado 扩展 API 的使用方式。
            点击「查看代码」预览完整源码，点击「安装」写入扩展目录即可启用。
          </p>
          <div class="examples-grid">
            <div v-for="ex in EXAMPLE_SCRIPTS" :key="ex.id" class="example-card">
              <div class="example-card__band" :style="{ background: catDot(ex.meta.category ?? '') }" />
              <div class="example-card__body">
                <div class="example-card__name-row">
                  <span class="example-card__name">{{ ex.meta.name }}</span>
                  <n-tag :type="catType(ex.meta.category ?? '') as any" size="tiny" :bordered="false">
                    {{ ex.meta.category || '其他' }}
                  </n-tag>
                </div>
                <p class="example-card__desc">{{ ex.meta.description }}</p>
                <div class="example-card__grants" v-if="ex.meta.grants?.length">
                  <span v-for="g in ex.meta.grants" :key="g" class="example-card__grant-tag">{{ g }}</span>
                </div>
                <div class="example-card__meta">
                  <span>v{{ ex.meta.version }}</span>
                  <span class="ext-card__dot" />
                  <span>{{ ex.meta.author }}</span>
                  <span class="ext-card__dot" />
                  <span>{{ runAtLabel(ex.meta.runAt ?? 'document-idle') }}</span>
                </div>
              </div>
              <div class="example-card__foot">
                <n-button size="small" quaternary @click="viewExampleCode(ex)">查看代码</n-button>
                <n-button
                  size="small"
                  :type="isExampleInstalled(ex) ? 'default' : 'primary'"
                  :disabled="isExampleInstalled(ex)"
                  :loading="installLoading"
                  @click="installExample(ex)"
                >
                  {{ isExampleInstalled(ex) ? '已安装' : '安装' }}
                </n-button>
              </div>
            </div>
          </div>
        </div>
      </n-tab-pane>

    </n-tabs>

    <!-- 编辑器弹窗 -->
    <n-modal
      v-model:show="showEditor"
      preset="card"
      :title="editorTitle"
      style="width:820px;max-width:95vw;max-height:92vh;display:flex;flex-direction:column"
      :mask-closable="false"
    >
      <n-alert v-if="editorReloaded" type="info" :show-icon="true" style="margin-bottom:8px;font-size:12px">
        文件已被外部修改，内容已自动重载
      </n-alert>
      <n-input
        v-model:value="editorContent"
        type="textarea"
        :rows="24"
        style="font-family:'JetBrains Mono','Cascadia Code','Consolas',monospace;font-size:13px"
        placeholder="UserScript 内容..."
      />
      <template #footer>
        <div style="display:flex;align-items:center;gap:8px;margin-top:8px">
          <n-button
            v-if="editorFile"
            size="small" quaternary
            :loading="editorVscodeOpen"
            @click="openEditorInVscode"
            title="在 VS Code 中打开，保存后自动重载"
          >
            <template #icon>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
              </svg>
            </template>
            在 VS Code 中打开
          </n-button>
          <div style="flex:1" />
          <n-button @click="showEditor = false">取消</n-button>
          <n-button type="primary" :loading="editorSaving" @click="saveEditor">保存到磁盘</n-button>
        </div>
      </template>
    </n-modal>

    <!-- 代码预览弹窗（只读） -->
    <n-modal
      v-model:show="showPreview"
      preset="card"
      :title="previewTitle"
      style="width:760px;max-width:95vw;max-height:90vh;display:flex;flex-direction:column"
    >
      <div class="code-preview">
        <pre class="code-preview__pre">{{ previewSource }}</pre>
      </div>
      <template #footer>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px">
          <n-button @click="showPreview = false">关闭</n-button>
          <n-button
            v-if="previewExampleId && !isExampleInstalled(EXAMPLE_SCRIPTS.find(e => e.id === previewExampleId)!)"
            type="primary"
            :loading="installLoading"
            @click="installFromPreview"
          >
            安装此脚本
          </n-button>
        </div>
      </template>
    </n-modal>

  </div>
</template>

<style scoped>
.ext-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--color-surface);
}

/* 页头 */
.ext-header {
  flex-shrink: 0;
  padding: 20px 24px 12px;
  border-bottom: 1px solid var(--color-border);
}
.ext-header__row {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 2px;
}
.ext-header__title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-text-primary);
}
.ext-header__dir {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: 4px;
  padding: 2px 6px;
  transition: background var(--transition-fast, .15s), color var(--transition-fast, .15s);
}
.ext-header__dir:hover {
  background: var(--color-surface-overlay, rgba(0,0,0,.06));
  color: var(--color-text-primary);
}
.ext-header__dir-path {
  font-size: .72rem;
  font-family: 'Cascadia Code', 'Consolas', monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 420px;
}
.ext-header__sub {
  font-size: .8125rem;
  color: var(--color-text-muted);
}

/* Tabs */
.ext-tabs {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.ext-tabs :deep(.n-tabs-nav) { padding: 0 24px; flex-shrink: 0; }
.ext-tabs :deep(.n-tabs-pane-wrapper) { flex: 1; overflow: hidden; }
.ext-tabs :deep(.n-tab-pane) { height: 100%; padding: 0; }

/* Pane */
.ext-pane {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.ext-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px 8px;
}
.ext-stats {
  flex-shrink: 0;
  padding: 0 20px 6px;
  font-size: .75rem;
  color: var(--color-text-muted);
}
.ext-list-wrap { flex: 1; overflow: hidden; }
.ext-list {
  height: 100%;
  overflow-y: auto;
  padding: 4px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* 已安装卡片 */
.ext-card {
  display: flex;
  align-items: stretch;
  background: var(--color-surface-elevated, var(--color-surface));
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md, 6px);
  overflow: hidden;
  transition: box-shadow var(--transition-fast, .15s);
}
.ext-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,.06); }
.ext-card--off  { opacity: .55; }
.ext-card__stripe { width: 4px; flex-shrink: 0; }
.ext-card__body {
  flex: 1;
  min-width: 0;
  padding: 10px 12px;
}
.ext-card__name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 3px;
  flex-wrap: wrap;
}
.ext-card__name {
  font-weight: 600;
  font-size: .875rem;
  color: var(--color-text-primary);
}
.ext-card__desc {
  font-size: .78rem;
  color: var(--color-text-secondary);
  margin: 0 0 5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ext-card__meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: .7rem;
  color: var(--color-text-muted);
  flex-wrap: wrap;
}
.ext-card__dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--color-text-muted);
  flex-shrink: 0;
}
.ext-card__grant {
  font-family: 'Cascadia Code', 'Consolas', monospace;
  font-size: .65rem;
  background: var(--color-surface-secondary, rgba(0,0,0,.04));
  padding: 1px 5px;
  border-radius: 3px;
  color: var(--color-text-secondary);
}
.ext-card__actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 12px;
}

/* 示例脚本区 */
.examples-tip {
  font-size: .8125rem;
  color: var(--color-text-muted);
  padding: 12px 20px 8px;
  flex-shrink: 0;
}
.examples-grid {
  flex: 1;
  overflow-y: auto;
  padding: 4px 16px 16px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 12px;
  align-content: start;
}
.example-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md, 6px);
  overflow: hidden;
  transition: box-shadow var(--transition-fast, .15s);
  background: var(--color-surface-elevated, var(--color-surface));
}
.example-card:hover { box-shadow: 0 2px 12px rgba(0,0,0,.08); }
.example-card__band { height: 4px; flex-shrink: 0; }
.example-card__body { flex: 1; padding: 12px 14px 10px; }
.example-card__name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 5px;
}
.example-card__name {
  font-weight: 600;
  font-size: .9rem;
  color: var(--color-text-primary);
}
.example-card__desc {
  font-size: .8rem;
  color: var(--color-text-secondary);
  margin: 0 0 8px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.example-card__grants {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}
.example-card__grant-tag {
  font-family: 'Cascadia Code', 'Consolas', monospace;
  font-size: .64rem;
  background: var(--color-surface-secondary, rgba(0,0,0,.04));
  border: 1px solid var(--color-border);
  padding: 1px 6px;
  border-radius: 3px;
  color: var(--color-text-secondary);
}
.example-card__meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: .7rem;
  color: var(--color-text-muted);
}
.example-card__foot {
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-top: 1px solid var(--color-border);
  background: var(--color-surface-secondary, rgba(0,0,0,.02));
}

/* 代码预览 */
.code-preview {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md, 6px);
  overflow: auto;
  max-height: 60vh;
  background: #1e1e1e;
}
.code-preview__pre {
  margin: 0;
  padding: 16px 18px;
  font-family: 'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace;
  font-size: 12.5px;
  line-height: 1.65;
  color: #d4d4d4;
  white-space: pre;
  tab-size: 2;
}

/* ── 移动端适配 ─────────────────────────── */
@media (pointer: coarse), (max-width: 640px) {
  :deep(.n-tabs-tab) {
    padding: 6px 2px !important;
    font-size: 0.8125rem !important;
  }
}
</style>