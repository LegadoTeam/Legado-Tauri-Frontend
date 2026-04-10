<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMessage } from 'naive-ui'
import { openUrl } from '@tauri-apps/plugin-opener'
import defaultLogoUrl from '../../assets/booksource-default.svg'
import {
  type BookSourceMeta,
  type RepoSourceInfo,
  type RepoManifest,
  fetchRepository,
  installFromRepository,
  configRead,
  configWrite,
} from '../../composables/useBookSource'

const props = defineProps<{
  sources: BookSourceMeta[]
}>()

const emits = defineEmits<{
  reload: []
}>()

const message = useMessage()

// ---- 仓库配置 ----
const REPO_CONFIG_SCOPE = '__app__'
const REPO_CONFIG_KEY   = 'repositories'

interface Repository {
  id: string
  name: string
  url: string
  description: string
}

const repositories  = ref<Repository[]>([])
const activeRepoId  = ref('')
const onlineManifest = ref<RepoManifest | null>(null)
const onlineSources = ref<RepoSourceInfo[]>([])
const onlineLoading = ref(false)
const onlineSearch  = ref('')
const onlineError   = ref('')
const installingSet = ref(new Set<string>())

const showRepoModal  = ref(false)
const repoForm = ref({ id: '', name: '', url: '', description: '' })

async function persistRepos() {
  try {
    const data = JSON.stringify({ repos: repositories.value, activeId: activeRepoId.value })
    await configWrite(REPO_CONFIG_SCOPE, REPO_CONFIG_KEY, data)
  } catch { /* 非关键操作 */ }
}

async function loadRepoConfig() {
  try {
    const raw = await configRead(REPO_CONFIG_SCOPE, REPO_CONFIG_KEY)
    if (!raw) return
    const data = JSON.parse(raw) as { repos?: Repository[]; activeId?: string }
    if (Array.isArray(data.repos) && data.repos.length) {
      repositories.value = data.repos
      activeRepoId.value = data.activeId ?? data.repos[0]?.id ?? ''
    }
  } catch { /* 配置损坏时静默回退 */ }
}

function openAddRepo() {
  repoForm.value = { id: '', name: '', url: '', description: '' }
  showRepoModal.value = true
}

function saveRepo() {
  if (!repoForm.value.name || !repoForm.value.url) { message.warning('名称和 URL 不能为空'); return }
  if (repoForm.value.id) {
    const r = repositories.value.find(r => r.id === repoForm.value.id)
    if (r) Object.assign(r, repoForm.value)
  } else {
    const newRepo = { ...repoForm.value, id: crypto.randomUUID() }
    repositories.value.push(newRepo)
    activeRepoId.value = newRepo.id
  }
  showRepoModal.value = false
  persistRepos()
}

function removeRepo(id: string) {
  repositories.value = repositories.value.filter(r => r.id !== id)
  if (activeRepoId.value === id) {
    activeRepoId.value = repositories.value[0]?.id ?? ''
    onlineSources.value = []
    onlineManifest.value = null
  }
  persistRepos()
}

async function fetchOnlineSources() {
  const repo = repositories.value.find(r => r.id === activeRepoId.value)
  if (!repo) { message.warning('请先添加并选择一个仓库'); return }
  onlineLoading.value = true
  onlineError.value = ''
  onlineSources.value = []
  onlineManifest.value = null
  try {
    const manifest = await fetchRepository(repo.url)
    onlineManifest.value = manifest
    onlineSources.value = manifest.sources
    message.success(`已加载「${manifest.name}」共 ${manifest.sources.length} 个书源`)
  } catch (e: unknown) {
    onlineError.value = e instanceof Error ? e.message : '请求失败'
    message.error(`加载失败: ${onlineError.value}`)
  } finally {
    onlineLoading.value = false
  }
}

const filteredOnline = computed(() => {
  if (!onlineSearch.value) return onlineSources.value
  const q = onlineSearch.value.toLowerCase()
  return onlineSources.value.filter(s =>
    s.name.toLowerCase().includes(q) ||
    s.url.toLowerCase().includes(q) ||
    (s.author ?? '').toLowerCase().includes(q) ||
    s.tags.some(t => t.toLowerCase().includes(q))
  )
})

function isInstalled(src: RepoSourceInfo) {
  return props.sources.some(s => s.fileName === src.fileName)
}

async function installSource(src: RepoSourceInfo) {
  if (isInstalled(src)) { message.info('该书源已安装'); return }
  installingSet.value.add(src.fileName)
  try {
    await installFromRepository(src.downloadUrl, src.fileName)
    emits('reload')
    message.success(`已安装「${src.name}」`)
  } catch (e: unknown) {
    message.error(`安装失败: ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    installingSet.value.delete(src.fileName)
  }
}

async function installAll() {
  const toInstall = filteredOnline.value.filter(s => !isInstalled(s))
  if (!toInstall.length) { message.info('所有书源均已安装'); return }
  let ok = 0
  for (const src of toInstall) {
    try {
      installingSet.value.add(src.fileName)
      await installFromRepository(src.downloadUrl, src.fileName)
      ok++
    } catch { /* skip */ }
    finally { installingSet.value.delete(src.fileName) }
  }
  emits('reload')
  message.success(`批量安装 ${ok} 个书源`)
}

// 初始化
loadRepoConfig()
</script>

<template>
  <div class="bv-pane">
    <!-- 仓库选择 + 操作 -->
    <div class="bv-toolbar">
      <n-select
        v-model:value="activeRepoId"
        :options="repositories.map(r => ({ label: r.name, value: r.id }))"
        size="small"
        style="width:220px"
        placeholder="请先添加仓库..."
        :disabled="!repositories.length"
      />
      <n-button size="small" :loading="onlineLoading" type="primary" :disabled="!activeRepoId" @click="fetchOnlineSources">
        获取书源列表
      </n-button>
      <n-button size="small" @click="openAddRepo">+ 添加仓库</n-button>
      <n-button v-if="activeRepoId" size="small" quaternary @click="removeRepo(activeRepoId)">移除</n-button>
      <div style="flex:1" />
      <n-input v-model:value="onlineSearch" placeholder="搜索名称/作者/标签..." clearable size="small" style="width:200px" :disabled="!onlineSources.length" />
      <n-button v-if="filteredOnline.length" size="small" @click="installAll">批量安装 ({{ filteredOnline.filter(s => !isInstalled(s)).length }})</n-button>
    </div>

    <!-- 仓库描述 -->
    <div class="bv-repo-desc" v-if="onlineManifest">
      {{ onlineManifest.name }} · v{{ onlineManifest.version }} · 更新于 {{ onlineManifest.updatedAt }}
    </div>
    <div class="bv-repo-desc" v-else-if="repositories.find(r => r.id === activeRepoId)?.description">
      {{ repositories.find(r => r.id === activeRepoId)?.description }}
    </div>

    <!-- 加载态 / 错误态 -->
    <n-spin :show="onlineLoading" style="width:100%">
      <n-alert v-if="onlineError" type="error" :title="onlineError" style="margin:12px 0" />

      <div v-if="!repositories.length && !onlineLoading" class="bv-online-empty">
        <n-empty description="尚未添加仓库，点击「+ 添加仓库」输入仓库 JSON 地址" style="padding:48px 0" />
      </div>

      <div v-else-if="!onlineSources.length && !onlineLoading" class="bv-online-empty">
        <n-empty description="点击「获取书源列表」从仓库拉取书源" style="padding:48px 0" />
      </div>

      <div v-else class="bv-source-list">
        <div
          v-for="src in filteredOnline"
          :key="src.fileName"
          class="src-card"
          :class="{ 'src-card--installed': isInstalled(src) }"
        >
          <div class="src-card__header">
            <img
              v-if="src.logo && src.logo.toLowerCase() !== 'default'"
              :src="src.logo"
              class="src-card__logo"
              :alt="src.name"
              @error="($event.target as HTMLImageElement).src = defaultLogoUrl"
            />
            <img v-else :src="defaultLogoUrl" class="src-card__logo" :alt="src.name" />

            <div class="src-card__title">
              <div class="src-card__name-line">
                <span class="src-card__name">{{ src.name }}</span>
                <n-tag v-if="src.version" size="tiny" :bordered="false" type="info" class="src-card__badge">v{{ src.version }}</n-tag>
                <n-tag v-if="src.tags[0]" size="tiny" :bordered="false" class="src-card__badge src-card__badge--group">{{ src.tags[0] }}</n-tag>
                <span v-if="src.author" class="src-card__author">{{ src.author }}</span>
              </div>
              <div class="src-card__url-line">
                <a class="src-card__url" href="#" @click.prevent.stop="openUrl(src.url)">{{ src.url }}</a>
              </div>
            </div>

            <n-button
              size="tiny"
              :type="isInstalled(src) ? 'default' : 'primary'"
              :disabled="isInstalled(src) || installingSet.has(src.fileName)"
              :loading="installingSet.has(src.fileName)"
              class="src-card__install-btn"
              @click="installSource(src)"
            >
              {{ isInstalled(src) ? '已安装' : '安装' }}
            </n-button>
          </div>

          <div class="src-card__chips" v-if="src.tags.length > 1 || src.fileSize">
            <n-tag v-for="t in src.tags.slice(1, 4)" :key="t" size="tiny" :bordered="false" class="src-card__tag">{{ t }}</n-tag>
            <span v-if="src.tags.length > 1 && src.fileSize" class="src-card__chip-sep" />
            <span v-if="src.fileSize" class="src-card__file-size">
              {{ src.fileSize > 1024 ? (src.fileSize / 1024).toFixed(1) + ' KB' : src.fileSize + ' B' }}
            </span>
          </div>

          <div v-if="src.description" class="src-card__desc">{{ src.description }}</div>
        </div>
      </div>
    </n-spin>
  </div>

  <!-- 添加/编辑仓库弹窗 -->
  <n-modal v-model:show="showRepoModal" preset="card" title="添加在线书源仓库" style="width:460px;max-width:95vw" :mask-closable="false">
    <n-form label-placement="top" size="small">
      <n-form-item label="仓库名称">
        <n-input v-model:value="repoForm.name" placeholder="例：社区精选书源" />
      </n-form-item>
      <n-form-item label="JSON 地址 (URL)">
        <n-input v-model:value="repoForm.url" placeholder="https://..." />
      </n-form-item>
      <n-form-item label="描述（可选）">
        <n-input v-model:value="repoForm.description" placeholder="说明这个仓库的来源" />
      </n-form-item>
    </n-form>
    <template #footer>
      <div style="display:flex;justify-content:flex-end;gap:8px">
        <n-button @click="showRepoModal = false">取消</n-button>
        <n-button type="primary" @click="saveRepo">保存</n-button>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
.bv-pane {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
  padding-top: 12px;
}
.bv-pane :deep(.n-spin-container) { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.bv-pane :deep(.n-spin-content) { flex: 1; min-height: 0; display: flex; flex-direction: column; }

.bv-toolbar { flex-shrink: 0; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }

.bv-repo-desc { font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 10px; }

.bv-source-list {
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-right: 4px;
}
.bv-source-list::-webkit-scrollbar { width: 5px; }
.bv-source-list::-webkit-scrollbar-track { background: transparent; }
.bv-source-list::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 3px; }
.bv-source-list::-webkit-scrollbar-thumb:hover { background: var(--color-text-muted); }

/* ---- 卡片（复用样式） ---- */
.src-card {
  display: flex; flex-direction: column; gap: 6px; padding: 10px 14px;
  border-radius: var(--radius-sm); border: 1px solid var(--color-border); border-left: 3px solid transparent;
  background: var(--color-surface-raised);
  transition: border-color var(--transition-fast), background var(--transition-fast), box-shadow var(--transition-fast);
}
.src-card:hover { border-color: var(--color-accent); border-left-color: var(--color-accent); box-shadow: 0 1px 8px rgba(0,0,0,0.06); }
.src-card--installed { opacity: 0.55; }
.src-card__install-btn { flex-shrink: 0; }
.src-card__file-size { font-size: 0.625rem; color: var(--color-text-muted); background: var(--color-surface); border-radius: var(--radius-xs); padding: 1px 5px; opacity: 0.7; }

.src-card__header { display: flex; align-items: center; gap: 10px; min-height: 36px; }
.src-card__logo { width: 32px; height: 32px; border-radius: var(--radius-xs); object-fit: contain; flex-shrink: 0; opacity: 0.85; transition: opacity var(--transition-fast); }
.src-card:hover .src-card__logo { opacity: 1; }
.src-card__title { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.src-card__name-line { display: flex; align-items: center; gap: 5px; overflow: hidden; }
.src-card__name { font-size: 0.8375rem; font-weight: 600; color: var(--color-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 240px; flex-shrink: 1; }
.src-card__badge { flex-shrink: 0; font-size: 0.625rem !important; --n-border-radius: 3px !important; }
.src-card__badge--group { --n-color: var(--color-surface-hover) !important; --n-text-color: var(--color-text-muted) !important; }
.src-card__author { font-size: 0.6875rem; color: var(--color-text-muted); opacity: 0.6; white-space: nowrap; flex-shrink: 0; margin-left: auto; }
.src-card__url-line { display: flex; align-items: center; gap: 5px; min-width: 0; }
.src-card__url { font-size: 0.7rem; color: var(--color-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; opacity: 0.6; text-decoration: none; cursor: pointer; transition: color var(--transition-fast), opacity var(--transition-fast); }
.src-card__url:hover { color: var(--color-accent); opacity: 1; text-decoration: underline; }

.src-card__chips { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.src-card__chip-sep { width: 1px; height: 10px; background: var(--color-border); flex-shrink: 0; margin: 0 2px; }
.src-card__tag { font-size: 0.6rem !important; height: 15px !important; line-height: 13px !important; padding: 0 5px !important; --n-color: color-mix(in srgb, var(--color-border) 80%, transparent) !important; --n-text-color: var(--color-text-muted) !important; opacity: 0.65; }
.src-card__desc { font-size: 0.7rem; color: var(--color-text-muted); line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-left: 42px; opacity: 0.75; }

@media (pointer: coarse), (max-width: 640px) {
  .bv-toolbar { gap: 6px; }
  .src-card { padding: 8px 10px; gap: 5px; }
  .src-card__logo { width: 28px; height: 28px; }
  .src-card__name { max-width: 160px; font-size: 0.8rem; }
}
</style>
