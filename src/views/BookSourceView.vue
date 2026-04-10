<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useMessage } from 'naive-ui'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { isMobile } from '../composables/useEnv'
import BookSourceDocs from '../components/docs/BookSourceDocs.vue'
import InstalledSourcesTab from '../components/booksource/InstalledSourcesTab.vue'
import OnlineSourcesTab from '../components/booksource/OnlineSourcesTab.vue'
import DebugSourceTab from '../components/booksource/DebugSourceTab.vue'
import TestSourcesTab from '../components/booksource/TestSourcesTab.vue'
import MobileToolbarMenu from '../components/layout/MobileToolbarMenu.vue'
import {
  type BookSourceMeta,
  listBookSources,
  getBookSourceDir,
  getBookSourceDirs,
} from '../composables/useBookSource'
import {
  detectCapabilities,
  getCachedCapabilities,
} from '../composables/useSourceCapabilities'

const message = useMessage()

const activeTab = ref<'installed' | 'online' | 'debug' | 'test' | 'docs'>('installed')

// ---- 共享状态 ----
const sources = ref<BookSourceMeta[]>([])
const loading = ref(false)
const sourceDir = ref('')
const sourceDirs = ref<string[]>([])

const shortSourceDir = computed(() => {
  if (!sourceDir.value) return ''
  const sep = sourceDir.value.includes('\\') ? '\\' : '/'
  const parts = sourceDir.value.split(sep).filter(Boolean)
  if (parts.length <= 3) return sourceDir.value
  return `…${sep}${parts.slice(-2).join(sep)}`
})

async function openSourceDirInExplorer() {
  if (!sourceDir.value) return
  try {
    await invoke('open_dir_in_explorer', { path: sourceDir.value })
  } catch (e: unknown) {
    message.error(`无法打开目录: ${e instanceof Error ? e.message : String(e)}`)
  }
}

async function loadSources() {
  loading.value = true
  try {
    const [list, dir, dirs] = await Promise.all([listBookSources(), getBookSourceDir(), getBookSourceDirs()])
    sources.value = list
    sourceDir.value = dir
    sourceDirs.value = dirs
    for (const src of list) {
      if (!getCachedCapabilities(src.fileName)) {
        detectCapabilities(src.fileName)
      }
    }
  } catch (e: unknown) {
    message.error(`加载失败: ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    loading.value = false
  }
}

// ---- 子组件 refs ----
const installedRef = ref<InstanceType<typeof InstalledSourcesTab> | null>(null)
const debugRef = ref<InstanceType<typeof DebugSourceTab> | null>(null)

function onNavigateTab(tab: string) {
  activeTab.value = tab as typeof activeTab.value
}

function onSelectDebugSource(fileName: string) {
  activeTab.value = 'debug'
  debugRef.value?.setDebugSource(fileName)
}

// ── 移动端工具栏菜单 ──────────────────────────────────────────────────
const mobileMenuOptions = computed(() => [
  { label: '目录管理', key: 'dir' },
  { label: '导入本地', key: 'import-file' },
  { label: '导入在线', key: 'import-online' },
  { label: '新建书源', key: 'new' },
  { label: '全部重载', key: 'reload', disabled: loading.value },
])

function handleMobileMenuSelect(key: string) {
  switch (key) {
    case 'dir': installedRef.value?.openDirManager(); break
    case 'import-file': installedRef.value?.importFromFile(); break
    case 'import-online': activeTab.value = 'online'; break
    case 'new': installedRef.value?.openEditor(); break
    case 'reload': installedRef.value?.reloadAllSources(); break
  }
}

// ── 初始化 ──
let unlistenFileChange: UnlistenFn | null = null

onMounted(async () => {
  await loadSources()

  unlistenFileChange = await listen<{ fileName: string }>('booksource:changed', async (event) => {
    await loadSources()
    installedRef.value?.handleFileChange(event.payload.fileName)
  })
})

onUnmounted(() => {
  unlistenFileChange?.()
})
</script>

<template>
  <div class="booksource-view">
    <!-- 顶部标题 -->
    <div class="bv-header">
      <div class="bv-header__title-wrap">
        <div class="bv-header__title-row">
          <h1 class="bv-header__title">书源管理</h1>
          <div class="bv-header__dir bv-header__dir--clickable" v-if="sourceDir && !isMobile"
            @click="openSourceDirInExplorer" :title="sourceDir">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span class="bv-header__dir-path">{{ shortSourceDir }}</span>
          </div>
        </div>
        <p class="bv-header__sub">管理已安装书源、浏览在线书源仓库、调试书源可用性</p>
      </div>
      <!-- 已安装 Tab 操作按钮（右上角） -->
      <div v-if="activeTab === 'installed'" class="bv-header__actions">
        <MobileToolbarMenu :options="mobileMenuOptions" @select="handleMobileMenuSelect">
          <n-button size="small" quaternary title="管理外部书源目录" @click="installedRef?.openDirManager()">目录</n-button>
          <n-button size="small" quaternary @click="installedRef?.importFromFile()">导入本地</n-button>
          <n-button size="small" quaternary @click="activeTab = 'online'">导入在线</n-button>
          <n-button size="small" type="primary" @click="installedRef?.openEditor()">新建书源</n-button>
          <n-button size="small" :loading="loading" @click="installedRef?.reloadAllSources()">全部重载</n-button>
        </MobileToolbarMenu>
      </div>
    </div>

    <!-- 主 Tabs -->
    <n-tabs v-model:value="activeTab" type="line" animated class="bv-tabs">
      <n-tab-pane name="installed" tab="已安装书源">
        <InstalledSourcesTab ref="installedRef" :sources="sources" :source-dir="sourceDir" :source-dirs="sourceDirs"
          :loading="loading" @reload="loadSources" @navigate-tab="onNavigateTab"
          @select-debug-source="onSelectDebugSource" />
      </n-tab-pane>

      <n-tab-pane name="online" tab="在线书源">
        <OnlineSourcesTab :sources="sources" @reload="loadSources" />
      </n-tab-pane>

      <n-tab-pane name="debug" tab="调试书源">
        <DebugSourceTab ref="debugRef" :sources="sources" />
      </n-tab-pane>

      <n-tab-pane name="test" tab="书源测试">
        <TestSourcesTab :sources="sources" />
      </n-tab-pane>

      <n-tab-pane name="docs" tab="开发文档" display-directive="show">
        <div class="bv-pane bv-pane--fill">
          <BookSourceDocs />
        </div>
      </n-tab-pane>
    </n-tabs>
  </div>
</template>

<style scoped>
/* ---- 外层 ---- */
.booksource-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--color-surface);
}

/* ---- 页头 ---- */
.bv-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 24px 24px 16px;
  border-bottom: 1px solid var(--color-border);
}

.bv-header__title-wrap {
  flex: 1;
  min-width: 0;
}

.bv-header__actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
}

.bv-header__title-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 6px;
}

.bv-header__title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text-primary);
  letter-spacing: -0.01em;
}

.bv-header__dir {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--color-text-muted);
  opacity: 0.6;
}

.bv-header__dir--clickable {
  cursor: pointer;
  border-radius: var(--radius-xs);
  padding: 2px 8px;
  transition: background var(--transition-fast), color var(--transition-fast), opacity var(--transition-fast);
}

.bv-header__dir--clickable:hover {
  background: var(--color-surface-hover);
  color: var(--color-text-secondary);
  opacity: 1;
}

.bv-header__dir-path {
  font-size: 0.6875rem;
  font-family: 'Cascadia Code', 'Consolas', monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 420px;
}

.bv-header__sub {
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
  line-height: 1.4;
}

/* ---- Tabs ---- */
.bv-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0 24px;
}

:deep(.n-tabs-nav) {
  padding-top: 4px;
}

:deep(.n-tabs-tab) {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-muted) !important;
  padding: 8px 2px;
  transition: color var(--transition-fast);
}

:deep(.n-tabs-tab--active) {
  font-weight: 600;
  color: var(--color-text-primary) !important;
}

:deep(.n-tabs-tab:hover:not(.n-tabs-tab--active)) {
  color: var(--color-text-secondary) !important;
}

:deep(.n-tabs-bar) {
  background: var(--color-accent) !important;
  height: 2px;
}

:deep(.n-tabs-pane-wrapper) {
  flex: 1;
  overflow: hidden;
}

:deep(.n-tab-pane) {
  height: 100%;
  padding: 0;
}

/* ---- 通用 Pane ---- */
.bv-pane {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
  padding-top: 12px;
}

.bv-pane--fill {
  padding-top: 0;
  overflow: hidden;
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

/* ── 移动端适配 ── */
@media (pointer: coarse),
(max-width: 640px) {
  .bv-header {
    padding: 16px 16px 12px;
  }

  .bv-header__sub {
    display: none;
  }

  .bv-tabs {
    padding: 0 12px;
  }

  :deep(.n-tabs-tab) {
    padding: 6px 2px !important;
    font-size: 0.8125rem !important;
  }
}
</style>
