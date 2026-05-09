<script setup lang="ts">
import { useMessage } from 'naive-ui';
import { computed, ref, watch } from 'vue';
import { isMobile } from '@/composables/useEnv';
import { useOverlayBackstack } from '@/composables/useOverlayBackstack';
import {
  createBookSourceSiteMocks,
  normalizeUploadTags,
  type BookSourceSiteEntry,
  type BookSourceSiteRepoType,
} from './booksourceSiteMock';

type SortMode = 'featured' | 'newest' | 'downloads';

interface UploadFormState {
  name: string;
  uploader: string;
  group: string;
  repoType: BookSourceSiteRepoType;
  tags: string;
  description: string;
  code: string;
  fileName: string;
}

const message = useMessage();

const DEFAULT_UPLOAD_FORM: UploadFormState = {
  name: '',
  uploader: '',
  group: '免费',
  repoType: 'novel',
  tags: '',
  description: '',
  code: '',
  fileName: '',
};

const sourceList = ref<BookSourceSiteEntry[]>(createBookSourceSiteMocks());
const search = ref('');
const selectedGroup = ref<string | null>(null);
const selectedRepoType = ref<BookSourceSiteRepoType | null>(null);
const sortMode = ref<SortMode>('featured');
const onlyUserUpload = ref(false);
const page = ref(1);
const pageSize = ref(6);

const showUploadModal = ref(false);
const showMobileDetail = ref(false);
const selectedSourceId = ref(sourceList.value[0]?.id ?? '');
const uploadSubmitting = ref(false);
const uploadForm = ref<UploadFormState>({ ...DEFAULT_UPLOAD_FORM });

useOverlayBackstack(
  () => showUploadModal.value,
  () => {
    showUploadModal.value = false;
  },
);
useOverlayBackstack(
  () => showMobileDetail.value,
  () => {
    showMobileDetail.value = false;
  },
);

const groupOptions = computed(() => {
  const groups = Array.from(new Set(sourceList.value.map((item) => item.group)));
  return groups.map((group) => ({ label: group, value: group }));
});

const repoTypeOptions = [
  { label: '小说', value: 'novel' },
  { label: '漫画', value: 'comic' },
  { label: '有声', value: 'audio' },
  { label: '视频', value: 'video' },
] satisfies { label: string; value: BookSourceSiteRepoType }[];

const sortOptions = [
  { label: '精选优先', value: 'featured' },
  { label: '最新上传', value: 'newest' },
  { label: '下载最多', value: 'downloads' },
] satisfies { label: string; value: SortMode }[];

const filteredSources = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  const list = sourceList.value.filter((item) => {
    const matchesKeyword =
      !keyword ||
      item.name.toLowerCase().includes(keyword) ||
      item.description.toLowerCase().includes(keyword) ||
      item.uploader.toLowerCase().includes(keyword) ||
      item.tags.some((tag) => tag.toLowerCase().includes(keyword));
    const matchesGroup = !selectedGroup.value || item.group === selectedGroup.value;
    const matchesType = !selectedRepoType.value || item.repoType === selectedRepoType.value;
    const matchesSource = !onlyUserUpload.value || item.source === 'user';
    return matchesKeyword && matchesGroup && matchesType && matchesSource;
  });

  return list.toSorted((left, right) => {
    if (sortMode.value === 'downloads') {
      return right.downloads - left.downloads;
    }
    if (sortMode.value === 'newest') {
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    }
    if (left.featured !== right.featured) {
      return Number(right.featured) - Number(left.featured);
    }
    return right.downloads - left.downloads;
  });
});

const pageCount = computed(() =>
  Math.max(1, Math.ceil(filteredSources.value.length / Math.max(pageSize.value, 1))),
);

const pagedSources = computed(() => {
  const start = (page.value - 1) * pageSize.value;
  return filteredSources.value.slice(start, start + pageSize.value);
});

const selectedSource = computed(
  () => sourceList.value.find((item) => item.id === selectedSourceId.value) ?? null,
);

const totalDownloads = computed(() =>
  sourceList.value.reduce((sum, item) => sum + item.downloads, 0),
);
const totalUploads = computed(
  () => sourceList.value.filter((item) => item.source === 'user').length,
);
const featuredCount = computed(() => sourceList.value.filter((item) => item.featured).length);

watch([search, selectedGroup, selectedRepoType, sortMode, onlyUserUpload, pageSize], () => {
  page.value = 1;
});

watch(pageCount, (nextCount) => {
  if (page.value > nextCount) {
    page.value = nextCount;
  }
});

watch(filteredSources, (list) => {
  if (!list.length) {
    selectedSourceId.value = '';
    return;
  }
  if (!list.some((item) => item.id === selectedSourceId.value)) {
    selectedSourceId.value = list[0].id;
  }
});

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('zh-CN');
}

function formatNumber(value: number) {
  return value.toLocaleString('zh-CN');
}

function repoTypeLabel(type: BookSourceSiteRepoType) {
  return repoTypeOptions.find((item) => item.value === type)?.label ?? type;
}

function repoTypeTag(type: BookSourceSiteRepoType) {
  if (type === 'comic') {
    return 'success';
  }
  if (type === 'audio') {
    return 'warning';
  }
  if (type === 'video') {
    return 'info';
  }
  return 'default';
}

function resetUploadForm() {
  uploadForm.value = { ...DEFAULT_UPLOAD_FORM };
}

function openUploadDialog() {
  resetUploadForm();
  showUploadModal.value = true;
}

function resetFilters() {
  search.value = '';
  selectedGroup.value = null;
  selectedRepoType.value = null;
  sortMode.value = 'featured';
  onlyUserUpload.value = false;
  pageSize.value = 6;
}

function refreshMockData() {
  const userUploads = sourceList.value
    .filter((item) => item.source === 'user')
    .map((item) => Object.assign({}, item, { tags: [...item.tags] }));
  sourceList.value = [...userUploads, ...createBookSourceSiteMocks()];
  message.success('模拟数据已刷新');
}

async function copySourceCode(source: BookSourceSiteEntry | null) {
  if (!source) {
    return;
  }
  try {
    await navigator.clipboard.writeText(source.code);
    message.success(`已复制 ${source.name} 代码`);
  } catch {
    message.error('复制失败');
  }
}

function openSourceDetail(source: BookSourceSiteEntry) {
  selectedSourceId.value = source.id;
  if (isMobile.value) {
    showMobileDetail.value = true;
  }
}

function simulateDownload(source: BookSourceSiteEntry) {
  source.downloads += 1;
  message.success(`已模拟下载 ${source.name}`);
}

async function importUploadFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,.js,.txt,application/json,text/plain,application/javascript';
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    try {
      uploadForm.value.code = await file.text();
      uploadForm.value.fileName = file.name;
      if (!uploadForm.value.name) {
        uploadForm.value.name = file.name.replace(/\.[^.]+$/, '');
      }
      message.success(`已载入文件 ${file.name}`);
    } catch (error: unknown) {
      message.error(`读取文件失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  input.click();
}

function sanitizeFileName(input: string) {
  return input
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}

async function submitUpload() {
  const name = uploadForm.value.name.trim();
  const uploader = uploadForm.value.uploader.trim();
  const description = uploadForm.value.description.trim();
  const code = uploadForm.value.code.trim();

  if (!name || !uploader || !description || !code) {
    message.warning('请补全书源名称、上传用户、说明和代码内容');
    return;
  }

  uploadSubmitting.value = true;
  try {
    const entry: BookSourceSiteEntry = {
      id: `user-${Date.now()}`,
      name,
      fileName: uploadForm.value.fileName.trim() || `${sanitizeFileName(name)}.json`,
      description,
      tags: normalizeUploadTags(uploadForm.value.tags),
      group: uploadForm.value.group.trim() || '免费',
      repoType: uploadForm.value.repoType,
      version: '1.0.0',
      uploader,
      downloads: 0,
      likes: 0,
      updatedAt: new Date().toISOString(),
      featured: false,
      source: 'user',
      code,
    };

    sourceList.value = [entry, ...sourceList.value];
    selectedSourceId.value = entry.id;
    page.value = 1;
    showUploadModal.value = false;
    if (isMobile.value) {
      showMobileDetail.value = true;
    }
    message.success(`已模拟上传 ${entry.name}`);
  } finally {
    uploadSubmitting.value = false;
  }
}

defineExpose({
  openUploadDialog,
  refreshMockData,
  resetFilters,
});
</script>

<template>
  <div class="site-tab app-scrollbar">
    <n-alert type="info" :show-icon="false" class="site-banner">
      当前为纯前端模拟页，已预留后续前后端接入空间。现在可直接演示分页、筛选、上传、预览和下载数量变化。
    </n-alert>

    <div class="site-overview">
      <div class="site-overview__card">
        <span class="site-overview__label">站点书源</span>
        <strong class="site-overview__value">{{ formatNumber(sourceList.length) }}</strong>
        <span class="site-overview__meta">覆盖小说 / 漫画 / 有声 / 视频</span>
      </div>
      <div class="site-overview__card">
        <span class="site-overview__label">累计下载</span>
        <strong class="site-overview__value">{{ formatNumber(totalDownloads) }}</strong>
        <span class="site-overview__meta">卡片内下载按钮可实时模拟增长</span>
      </div>
      <div class="site-overview__card">
        <span class="site-overview__label">用户上传</span>
        <strong class="site-overview__value">{{ formatNumber(totalUploads) }}</strong>
        <span class="site-overview__meta">支持本地文件载入和手填代码上传</span>
      </div>
      <div class="site-overview__card">
        <span class="site-overview__label">精选推荐</span>
        <strong class="site-overview__value">{{ formatNumber(featuredCount) }}</strong>
        <span class="site-overview__meta">沿用当前应用面板化视觉和站点列表布局</span>
      </div>
    </div>

    <div class="site-toolbar">
      <div class="site-toolbar__filters">
        <n-input v-model:value="search" clearable placeholder="搜索书源、上传用户或标签" />
        <n-select
          v-model:value="selectedGroup"
          clearable
          placeholder="分类"
          :options="groupOptions"
        />
        <n-select
          v-model:value="selectedRepoType"
          clearable
          placeholder="类型"
          :options="repoTypeOptions"
        />
        <n-select v-model:value="sortMode" :options="sortOptions" />
      </div>
      <div class="site-toolbar__actions">
        <n-switch v-model:value="onlyUserUpload">
          <template #checked>只看用户上传</template>
          <template #unchecked>全部来源</template>
        </n-switch>
        <n-button quaternary @click="resetFilters">重置筛选</n-button>
        <n-button quaternary @click="refreshMockData">刷新模拟</n-button>
        <n-button type="primary" @click="openUploadDialog">上传书源</n-button>
      </div>
    </div>

    <div class="site-layout">
      <div class="site-list">
        <div v-if="pagedSources.length" class="site-grid">
          <article
            v-for="source in pagedSources"
            :key="source.id"
            class="site-card"
            :class="{ 'site-card--active': source.id === selectedSourceId }"
            @click="openSourceDetail(source)"
          >
            <div class="site-card__head">
              <div class="site-card__identity">
                <n-avatar round :size="44" class="site-card__avatar">
                  {{ source.name.slice(0, 1) }}
                </n-avatar>
                <div class="site-card__title-block">
                  <div class="site-card__title-row">
                    <h3 class="site-card__title">{{ source.name }}</h3>
                    <n-tag size="small" :type="repoTypeTag(source.repoType)">
                      {{ repoTypeLabel(source.repoType) }}
                    </n-tag>
                    <n-tag size="small" :bordered="false">
                      {{ source.source === 'user' ? '用户上传' : '精选仓库' }}
                    </n-tag>
                  </div>
                  <p class="site-card__desc">{{ source.description }}</p>
                </div>
              </div>
              <n-tag v-if="source.featured" size="small" type="success" :bordered="false">
                推荐
              </n-tag>
            </div>

            <div class="site-card__stats">
              <div class="site-card__stat">
                <span class="site-card__stat-label">上传用户</span>
                <strong>{{ source.uploader }}</strong>
              </div>
              <div class="site-card__stat">
                <span class="site-card__stat-label">下载数量</span>
                <strong>{{ formatNumber(source.downloads) }}</strong>
              </div>
              <div class="site-card__stat">
                <span class="site-card__stat-label">版本</span>
                <strong>v{{ source.version }}</strong>
              </div>
            </div>

            <div class="site-card__tags">
              <n-tag v-for="tag in source.tags" :key="tag" size="small" round>{{ tag }}</n-tag>
            </div>

            <div class="site-card__footer">
              <span>{{ source.group }}</span>
              <span>{{ formatDate(source.updatedAt) }}</span>
            </div>

            <div class="site-card__actions">
              <n-button size="small" quaternary @click.stop="openSourceDetail(source)">
                预览
              </n-button>
              <n-button size="small" quaternary @click.stop="copySourceCode(source)">
                复制代码
              </n-button>
              <n-button size="small" type="primary" @click.stop="simulateDownload(source)">
                下载 +1
              </n-button>
            </div>
          </article>
        </div>

        <n-empty v-else description="当前筛选条件下没有书源" class="site-empty" />

        <div class="site-pagination">
          <n-pagination
            v-model:page="page"
            v-model:page-size="pageSize"
            :page-count="pageCount"
            :page-sizes="[6, 9, 12]"
            show-size-picker
          />
        </div>
      </div>

      <aside v-if="!isMobile" class="site-preview">
        <div v-if="selectedSource" class="site-preview__card">
          <div class="site-preview__head">
            <div>
              <p class="site-preview__eyebrow">书源详情</p>
              <h3 class="site-preview__title">{{ selectedSource.name }}</h3>
            </div>
            <n-button size="small" quaternary @click="copySourceCode(selectedSource)">
              复制
            </n-button>
          </div>

          <div class="site-preview__meta">
            <span>上传者：{{ selectedSource.uploader }}</span>
            <span>下载：{{ formatNumber(selectedSource.downloads) }}</span>
            <span>更新：{{ formatDate(selectedSource.updatedAt) }}</span>
          </div>

          <p class="site-preview__desc">{{ selectedSource.description }}</p>

          <div class="site-preview__tags">
            <n-tag v-for="tag in selectedSource.tags" :key="tag" size="small" round>{{
              tag
            }}</n-tag>
          </div>

          <div class="site-preview__code app-scrollbar app-scrollbar--thin">
            <pre>{{ selectedSource.code }}</pre>
          </div>

          <div class="site-preview__bottom">
            <span>{{ selectedSource.fileName }}</span>
            <n-button size="small" type="primary" @click="simulateDownload(selectedSource)">
              立即下载
            </n-button>
          </div>
        </div>

        <n-empty v-else description="选择一项书源查看详情" class="site-preview__empty" />
      </aside>
    </div>

    <n-drawer v-model:show="showMobileDetail" placement="bottom" height="78%">
      <n-drawer-content v-if="selectedSource" :title="selectedSource.name" closable>
        <div class="site-preview__meta site-preview__meta--mobile">
          <span>上传者：{{ selectedSource.uploader }}</span>
          <span>下载：{{ formatNumber(selectedSource.downloads) }}</span>
          <span>版本：v{{ selectedSource.version }}</span>
        </div>
        <p class="site-preview__desc">{{ selectedSource.description }}</p>
        <div class="site-preview__tags">
          <n-tag v-for="tag in selectedSource.tags" :key="tag" size="small" round>{{ tag }}</n-tag>
        </div>
        <div class="site-preview__code app-scrollbar app-scrollbar--thin">
          <pre>{{ selectedSource.code }}</pre>
        </div>
        <div class="site-preview__bottom">
          <span>{{ selectedSource.fileName }}</span>
          <div class="site-preview__mobile-actions">
            <n-button size="small" quaternary @click="copySourceCode(selectedSource)"
              >复制</n-button
            >
            <n-button size="small" type="primary" @click="simulateDownload(selectedSource)">
              立即下载
            </n-button>
          </div>
        </div>
      </n-drawer-content>
    </n-drawer>

    <n-modal
      v-model:show="showUploadModal"
      preset="card"
      title="上传书源"
      class="site-upload-modal"
    >
      <n-form label-placement="top">
        <div class="site-upload-grid">
          <n-form-item label="书源名称">
            <n-input v-model:value="uploadForm.name" placeholder="例如：我的小说源" />
          </n-form-item>
          <n-form-item label="上传用户">
            <n-input v-model:value="uploadForm.uploader" placeholder="填写展示昵称" />
          </n-form-item>
          <n-form-item label="分类">
            <n-input v-model:value="uploadForm.group" placeholder="例如：免费 / 漫画 / 有声" />
          </n-form-item>
          <n-form-item label="类型">
            <n-select v-model:value="uploadForm.repoType" :options="repoTypeOptions" />
          </n-form-item>
        </div>

        <n-form-item label="标签">
          <n-input
            v-model:value="uploadForm.tags"
            placeholder="用空格、逗号或顿号分隔，例如：小说 稳定 精选"
          />
        </n-form-item>

        <n-form-item label="简介">
          <n-input
            v-model:value="uploadForm.description"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 4 }"
            placeholder="说明适配场景、站点特点或备注"
          />
        </n-form-item>

        <n-form-item label="书源代码">
          <n-input
            v-model:value="uploadForm.code"
            type="textarea"
            :autosize="{ minRows: 10, maxRows: 16 }"
            placeholder="可直接粘贴书源 JSON / JS 内容，或从本地文件载入"
          />
        </n-form-item>

        <div class="site-upload-actions">
          <n-button quaternary @click="importUploadFile">从本地文件载入</n-button>
          <n-button type="primary" :loading="uploadSubmitting" @click="submitUpload">
            提交模拟上传
          </n-button>
        </div>
      </n-form>
    </n-modal>
  </div>
</template>

<style scoped>
.site-tab {
  height: 100%;
  overflow: auto;
  padding: 16px 18px 22px;
}

.site-banner {
  margin-bottom: 16px;
}

.site-overview {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.site-overview__card {
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background:
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--color-accent) 5%, transparent),
      transparent 55%
    ),
    var(--color-surface-raised);
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.site-overview__label {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.site-overview__value {
  font-size: 28px;
  line-height: 1;
  color: var(--color-text-primary);
}

.site-overview__meta {
  font-size: 12px;
  color: var(--color-text-muted);
}

.site-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-raised);
  margin-bottom: 16px;
}

.site-toolbar__filters,
.site-toolbar__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.site-toolbar__filters {
  flex: 1;
  min-width: 0;
}

.site-toolbar__filters :deep(.n-input),
.site-toolbar__filters :deep(.n-base-selection) {
  width: 190px;
}

.site-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 16px;
  align-items: start;
}

.site-list {
  min-width: 0;
}

.site-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.site-card {
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-raised);
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    transform var(--transition-fast);
}

.site-card:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--color-accent) 36%, var(--color-border));
  box-shadow: 0 8px 28px rgba(15, 23, 42, 0.08);
}

.site-card--active {
  border-color: color-mix(in srgb, var(--color-accent) 54%, var(--color-border));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-accent) 16%, transparent);
}

.site-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.site-card__identity {
  display: flex;
  gap: 12px;
  min-width: 0;
  flex: 1;
}

.site-card__avatar {
  flex-shrink: 0;
  background: color-mix(in srgb, var(--color-accent) 10%, var(--color-surface));
  color: var(--color-accent);
}

.site-card__title-block {
  min-width: 0;
  flex: 1;
}

.site-card__title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.site-card__title {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text-primary);
  line-height: 1.35;
}

.site-card__desc {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.55;
}

.site-card__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.site-card__stat {
  padding: 10px;
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  border: 1px solid color-mix(in srgb, var(--color-border) 80%, transparent);
}

.site-card__stat-label {
  display: block;
  font-size: 11px;
  color: var(--color-text-muted);
  margin-bottom: 4px;
}

.site-card__stat strong {
  color: var(--color-text-primary);
  font-size: 13px;
}

.site-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.site-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  color: var(--color-text-muted);
  margin-bottom: 12px;
}

.site-card__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.site-pagination {
  display: flex;
  justify-content: center;
  margin-top: 18px;
}

.site-preview {
  min-width: 0;
}

.site-preview__card {
  position: sticky;
  top: 0;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-raised);
}

.site-preview__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.site-preview__eyebrow {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-bottom: 4px;
}

.site-preview__title {
  font-size: 18px;
  color: var(--color-text-primary);
}

.site-preview__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 12px;
}

.site-preview__meta--mobile {
  margin-top: 4px;
}

.site-preview__desc {
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-text-secondary);
  margin-bottom: 12px;
}

.site-preview__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 14px;
}

.site-preview__code {
  max-height: 360px;
  overflow: auto;
  padding: 12px;
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  margin-bottom: 14px;
}

.site-preview__code pre {
  font-family: 'Cascadia Code', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--color-text-primary);
}

.site-preview__bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  color: var(--color-text-muted);
}

.site-preview__mobile-actions {
  display: flex;
  gap: 8px;
}

.site-preview__empty,
.site-empty {
  padding: 60px 0;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-surface) 76%, transparent);
}

.site-upload-modal {
  width: min(760px, calc(100vw - 24px));
}

.site-upload-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.site-upload-actions {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

@media (max-width: 1200px) {
  .site-overview {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .site-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 960px) {
  .site-layout {
    grid-template-columns: 1fr;
  }

  .site-preview {
    display: none;
  }
}

@media (max-width: 768px) {
  .site-tab {
    padding: 12px;
  }

  .site-overview {
    grid-template-columns: 1fr;
  }

  .site-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .site-toolbar__filters :deep(.n-input),
  .site-toolbar__filters :deep(.n-base-selection) {
    width: 100%;
  }

  .site-card__stats {
    grid-template-columns: 1fr;
  }

  .site-card__actions,
  .site-preview__bottom,
  .site-upload-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .site-upload-grid {
    grid-template-columns: 1fr;
  }
}
</style>
