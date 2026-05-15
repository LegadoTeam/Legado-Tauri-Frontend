<script setup lang="ts">
import { X } from 'lucide-vue-next';
import { useDialog, useMessage } from 'naive-ui';
import { computed, ref, watch } from 'vue';
import {
  checkRepositorySourceSync,
  installFromRepository,
  listBookSources,
  previewRemoteBookSource,
  toSafeFileName,
  type BookSourceMeta,
  type RepoSourceSyncResult,
  type RemoteBookSourcePreview,
} from '@/composables/useBookSource';
import { useOverlayBackstack } from '@/composables/useOverlayBackstack';

const props = defineProps<{
  show: boolean;
  /** 已解析好的 HTTP(S) 下载地址；若为空则直接显示 parseError */
  downloadUrl: string;
  /** 原始链接（仅用于错误态显示，如 legado:// 链接） */
  rawLink?: string;
  /** 预解析阶段的错误，非空时直接进入错误态 */
  parseError?: string;
  /** 仓库清单中声明的 UUID；远程文件缺 UUID 时用它作为系统补全值 */
  expectedUuid?: string;
}>();

const emit = defineEmits<{
  'update:show': [value: boolean];
  /** 安装成功后触发 */
  installed: [payload: { name: string; fileName: string; uuid: string }];
}>();

const message = useMessage();
const dialog = useDialog();

type RemoteSyncStatus = 'idle' | 'checking' | 'same' | 'different' | 'error';

const loading = ref(false);
const installing = ref(false);
const error = ref('');
const preview = ref<RemoteBookSourcePreview | null>(null);
const installedSources = ref<BookSourceMeta[]>([]);
const localSource = ref<BookSourceMeta | null>(null);
const syncStatus = ref<RemoteSyncStatus>('idle');
const syncError = ref('');
const localVersion = ref('');
const remoteVersion = ref('');

let loadRunId = 0;

// ── computed ─────────────────────────────────────────────────────────────

const meta = computed(() => preview.value?.meta ?? null);
const mirrorUrls = computed(() => meta.value?.urls.slice(1) ?? []);
const requireUrls = computed(() => meta.value?.requireUrls ?? []);
const hasResolvedUrl = computed(
  () => !!props.downloadUrl && props.downloadUrl !== (props.rawLink ?? ''),
);
const sourceTypeLabel = computed(() => {
  switch (meta.value?.sourceType) {
    case 'comic':
      return '漫画';
    case 'video':
      return '视频';
    default:
      return '小说';
  }
});
const installActionText = computed(() => (localSource.value ? '覆盖安装' : '安装'));
const installTargetFileName = computed(() => {
  const current = meta.value;
  if (!current) {
    return '';
  }
  if (localSource.value) {
    return localSource.value.fileName;
  }
  return getAvailableFileName(current.fileName, current.name);
});
const fileNameConflict = computed(() => {
  const current = meta.value;
  if (!current || localSource.value) {
    return false;
  }
  return installedSources.value.some((source) => source.fileName === current.fileName);
});
const localSourcePath = computed(() => {
  if (!localSource.value) {
    return '';
  }
  const dir = localSource.value.sourceDir || '';
  const sep = dir.includes('\\') ? '\\' : '/';
  if (!dir) {
    return localSource.value.fileName;
  }
  return dir.endsWith('\\') || dir.endsWith('/')
    ? `${dir}${localSource.value.fileName}`
    : `${dir}${sep}${localSource.value.fileName}`;
});
const versionDiff = computed<'upgrade' | 'downgrade' | 'same' | null>(() => {
  if (!localSource.value) {
    return null;
  }
  const cmp = compareVersions(remoteVersion.value || meta.value?.version || '', localVersion.value);
  if (cmp === null) {
    return null;
  }
  if (cmp > 0) {
    return 'upgrade';
  }
  if (cmp < 0) {
    return 'downgrade';
  }
  return 'same';
});
const installStateAlertType = computed<'info' | 'warning' | 'error' | 'success'>(() => {
  if (syncStatus.value === 'error') {
    return 'warning';
  }
  if (!localSource.value) {
    return 'info';
  }
  switch (syncStatus.value) {
    case 'same':
      return 'success';
    case 'different':
      return versionDiff.value === 'downgrade' ? 'error' : 'warning';
    default:
      return 'info';
  }
});
const installStateTitle = computed(() => {
  if (syncStatus.value === 'error' && !localSource.value) {
    return '本地安装状态检测失败';
  }
  if (!localSource.value) {
    return '将作为新书源安装';
  }
  switch (syncStatus.value) {
    case 'checking':
      return '检测到同一 UUID 已安装书源，正在比较差异';
    case 'same':
      return '检测到同一 UUID 已安装书源，远端内容与本地一致';
    case 'different':
      if (versionDiff.value === 'upgrade') {
        return '检测到同一 UUID 已安装书源，将升级覆盖';
      }
      if (versionDiff.value === 'downgrade') {
        return '检测到同一 UUID 已安装书源，将降级覆盖';
      }
      return '检测到同一 UUID 已安装书源，将覆盖本地内容';
    case 'error':
      return '检测到同一 UUID 已安装书源，但差异检查失败';
    default:
      return '检测到同一 UUID 已安装书源';
  }
});
const installStateText = computed(() => {
  if (syncStatus.value === 'error' && !localSource.value) {
    return syncError.value || '无法确认本地是否已存在同一 UUID 书源，请手动留意覆盖风险。';
  }
  if (!localSource.value) {
    return fileNameConflict.value
      ? `本地存在同名但 UUID 不同的书源，将改用文件名 ${installTargetFileName.value} 安装。`
      : '本地未发现同一 UUID 的书源，将作为新书源安装。';
  }
  switch (syncStatus.value) {
    case 'checking':
      return '正在比较服务器与本地源码，@enabled 行会被忽略；安装时会再次确认覆盖。';
    case 'same':
      return '比较时已忽略 @enabled 行；如果继续覆盖，主要会刷新源码本体。';
    case 'different':
      if (versionDiff.value === 'upgrade') {
        return '远端版本高于本地版本，继续后将覆盖现有文件。';
      }
      if (versionDiff.value === 'downgrade') {
        return '远端版本低于本地版本，继续后会发生降级覆盖，请谨慎操作。';
      }
      return '远端与本地内容不一致，继续后将直接覆盖当前同一 UUID 书源。';
    case 'error':
      return syncError.value || '无法完成本地与远端差异检查，继续安装仍会覆盖同名文件。';
    default:
      return '当前同一 UUID 书源已存在，继续安装会覆盖本地文件。';
  }
});

// ── helpers ───────────────────────────────────────────────────────────────

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(2)} MB`;
  }
  if (size >= 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${size} B`;
}

function normalizeText(value: string | undefined | null) {
  return value?.trim() || '未提供';
}

function formatVersion(value: string | undefined | null) {
  const v = value?.trim().replace(/^v/i, '') || '';
  return v ? `v${v}` : '未标注版本';
}

function cleanVersion(v: string) {
  return v.trim().replace(/^v/i, '');
}

function parseVersion(v: string) {
  return v.split('.').map((p) => parseInt(p, 10) || 0);
}

function compareVersions(a: string, b: string): 1 | -1 | 0 | null {
  const ca = cleanVersion(a);
  const cb = cleanVersion(b);
  if (!ca || !cb) {
    return null;
  }
  const pa = parseVersion(ca);
  const pb = parseVersion(cb);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na > nb) {
      return 1;
    }
    if (na < nb) {
      return -1;
    }
  }
  return 0;
}

function resetInstallState() {
  installedSources.value = [];
  localSource.value = null;
  syncStatus.value = 'idle';
  syncError.value = '';
  localVersion.value = '';
  remoteVersion.value = '';
}

function uniqueFileName(baseName: string, usedNames: Set<string>) {
  const dot = baseName.toLowerCase().endsWith('.js') ? baseName.length - 3 : baseName.length;
  const stem = baseName.slice(0, dot) || 'booksource';
  const ext = baseName.toLowerCase().endsWith('.js') ? baseName.slice(dot) : '.js';
  let index = 2;
  let candidate = baseName.toLowerCase().endsWith('.js') ? baseName : `${baseName}.js`;
  while (usedNames.has(candidate)) {
    candidate = `${stem}-${index}${ext}`;
    index += 1;
  }
  return candidate;
}

function getAvailableFileName(preferredFileName: string, fallbackName: string) {
  const used = new Set(installedSources.value.map((source) => source.fileName));
  const preferred = preferredFileName || toSafeFileName(fallbackName || 'booksource');
  return uniqueFileName(preferred, used);
}

// ── install state ─────────────────────────────────────────────────────────

async function loadInstalledState(
  remoteMeta: BookSourceMeta,
  hasExplicitUuid: boolean,
  targetUrl: string,
  fallbackRemoteVersion: string,
  runId: number,
) {
  resetInstallState();
  try {
    const installed = await listBookSources();
    if (runId !== loadRunId) {
      return;
    }
    installedSources.value = installed;
    const existing =
      installed.find((s) => s.uuid === remoteMeta.uuid) ??
      (!hasExplicitUuid
        ? installed.find((s) => s.name.trim() === remoteMeta.name.trim())
        : undefined) ??
      null;
    localSource.value = existing;
    localVersion.value = existing?.version ?? '';
    remoteVersion.value = fallbackRemoteVersion;
    if (!existing) {
      return;
    }

    syncStatus.value = 'checking';
    try {
      const result: RepoSourceSyncResult = await checkRepositorySourceSync(
        existing.fileName,
        targetUrl,
        remoteMeta.uuid,
      );
      if (runId !== loadRunId) {
        return;
      }
      syncStatus.value = result.isConsistent ? 'same' : 'different';
      localVersion.value = result.localVersion || existing.version || '';
      remoteVersion.value = result.remoteVersion || fallbackRemoteVersion;
    } catch (e: unknown) {
      if (runId !== loadRunId) {
        return;
      }
      syncStatus.value = 'error';
      syncError.value = e instanceof Error ? e.message : String(e);
    }
  } catch (e: unknown) {
    if (runId !== loadRunId) {
      return;
    }
    syncStatus.value = 'error';
    syncError.value = `本地安装状态读取失败: ${e instanceof Error ? e.message : String(e)}`;
  }
}

// ── load preview ──────────────────────────────────────────────────────────

async function startLoad() {
  const runId = ++loadRunId;
  loading.value = true;
  error.value = '';
  preview.value = null;
  resetInstallState();

  try {
    const data = await previewRemoteBookSource(props.downloadUrl, props.expectedUuid);
    if (runId !== loadRunId) {
      return;
    }
    preview.value = data;
    void loadInstalledState(
      data.meta,
      data.hasExplicitUuid,
      props.downloadUrl,
      data.meta.version,
      runId,
    );
  } catch (e: unknown) {
    if (runId !== loadRunId) {
      return;
    }
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    if (runId === loadRunId) {
      loading.value = false;
    }
  }
}

// ── dialog control ────────────────────────────────────────────────────────

function closeDialog() {
  emit('update:show', false);
}

useOverlayBackstack(() => props.show, closeDialog);

watch(
  () => props.show,
  (visible) => {
    if (!visible) {
      // 关闭时重置所有状态，以便下次打开时干净启动
      loadRunId += 1;
      loading.value = false;
      installing.value = false;
      preview.value = null;
      error.value = '';
      resetInstallState();
      return;
    }
    // 打开时：优先展示预解析错误，否则开始加载
    if (props.parseError) {
      error.value = props.parseError;
      return;
    }
    if (!props.downloadUrl) {
      error.value = '书源地址为空';
      return;
    }
    void startLoad();
  },
);

// ── install ───────────────────────────────────────────────────────────────

function buildOverwriteContent(current: RemoteBookSourcePreview) {
  const local = localSource.value;
  if (!local) {
    return '';
  }
  const localLabel = formatVersion(localVersion.value || local.version);
  const remoteLabel = formatVersion(remoteVersion.value || current.meta.version);
  switch (syncStatus.value) {
    case 'same':
      return `本地已存在同一 UUID 书源「${current.meta.name}」，且远端内容与本地一致（比较时已忽略 @enabled 与 @uuid）。仍要重新覆盖安装吗？`;
    case 'different':
      if (versionDiff.value === 'upgrade') {
        return `本地已安装「${current.meta.name}」，将从 ${localLabel} 覆盖为 ${remoteLabel}。确认继续？`;
      }
      if (versionDiff.value === 'downgrade') {
        return `仓库版本 ${remoteLabel} 低于本地版本 ${localLabel}，继续会降级覆盖「${current.meta.name}」。确认继续？`;
      }
      return `本地已存在同一 UUID 书源「${current.meta.name}」，远端与本地内容不一致，继续会直接覆盖当前文件。确认继续？`;
    case 'error':
      return `本地已存在同一 UUID 书源「${current.meta.name}」，但差异检查失败（${syncError.value || '未知错误'}）。仍要覆盖安装吗？`;
    default:
      return `本地已存在同一 UUID 书源「${current.meta.name}」，继续会覆盖当前文件。确认继续？`;
  }
}

async function performInstall(current: RemoteBookSourcePreview) {
  installing.value = true;
  try {
    const targetFileName = installTargetFileName.value || current.meta.fileName;
    try {
      await installFromRepository(current.downloadUrl, targetFileName, current.meta.uuid);
    } catch (e: unknown) {
      // 如果目标路径存在另一个 UUID 的文件（可能因 UUID 去重未出现在已安装列表中），
      // 自动改用备用文件名重试一次
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('属于另一个')) {
        const dot = targetFileName.toLowerCase().endsWith('.js')
          ? targetFileName.length - 3
          : targetFileName.length;
        const stem = targetFileName.slice(0, dot) || 'booksource';
        const ext = targetFileName.toLowerCase().endsWith('.js')
          ? targetFileName.slice(dot)
          : '.js';
        const usedNames = new Set(installedSources.value.map((s) => s.fileName));
        let index = 2;
        let fallback = `${stem}-${index}${ext}`;
        while (usedNames.has(fallback)) {
          index += 1;
          fallback = `${stem}-${index}${ext}`;
        }
        await installFromRepository(current.downloadUrl, fallback, current.meta.uuid);
        message.success(`已安装「${current.meta.name}」`);
        emit('installed', { name: current.meta.name, fileName: fallback, uuid: current.meta.uuid });
        closeDialog();
        return;
      }
      throw e;
    }
    message.success(`已安装「${current.meta.name}」`);
    emit('installed', {
      name: current.meta.name,
      fileName: targetFileName,
      uuid: current.meta.uuid,
    });
    closeDialog();
  } catch (e: unknown) {
    message.error(`安装失败: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    installing.value = false;
  }
}

async function confirmInstall() {
  const current = preview.value;
  if (!current || installing.value) {
    return;
  }

  if (localSource.value) {
    dialog.warning({
      title: '覆盖安装书源',
      content: buildOverwriteContent(current),
      positiveText: installActionText.value,
      negativeText: '取消',
      onPositiveClick: async () => {
        await performInstall(current);
      },
    });
    return;
  }

  await performInstall(current);
}
</script>

<template>
  <n-modal
    :show="props.show"
    :mask-closable="true"
    :close-on-esc="true"
    @update:show="
      (v: boolean) => {
        if (!v) closeDialog();
      }
    "
  >
    <n-card class="bsid" title="安装书源" :bordered="false" role="dialog">
      <template #header-extra>
        <n-button quaternary circle size="small" aria-label="关闭" @click="closeDialog">
          <X :size="16" aria-hidden="true" />
        </n-button>
      </template>

      <div class="bsid__body">
        <n-alert v-if="error" type="error" title="无法读取书源">
          {{ error }}
        </n-alert>
        <div v-if="error && rawLink" class="bsid__raw-link">
          <div class="bsid__raw-link-label">原始地址</div>
          <div class="bsid__raw-link-value">{{ rawLink }}</div>
          <template v-if="hasResolvedUrl">
            <div class="bsid__raw-link-label">解析后地址</div>
            <div class="bsid__raw-link-value">{{ downloadUrl }}</div>
          </template>
        </div>

        <div v-else-if="loading" class="bsid__loading">
          <n-spin size="small" />
          <span>正在读取远程书源信息</span>
        </div>

        <template v-else-if="meta">
          <div class="bsid__head">
            <div class="bsid__title">{{ meta.name }}</div>
            <div class="bsid__tags">
              <n-tag size="small" type="info">{{ sourceTypeLabel }}</n-tag>
              <n-tag v-if="meta.version" size="small">v{{ meta.version }}</n-tag>
              <n-tag v-if="!meta.enabled" size="small" type="warning">默认禁用</n-tag>
            </div>
          </div>

          <div class="bsid__grid">
            <span>UUID</span>
            <strong>{{ meta.uuid }}</strong>
            <span>文件名</span>
            <strong>
              {{ installTargetFileName || meta.fileName }}
              <template v-if="fileNameConflict">（同名冲突已改名）</template>
            </strong>
            <span>作者</span>
            <strong>{{ normalizeText(meta.author) }}</strong>
            <span>源地址</span>
            <strong>{{ normalizeText(meta.url) }}</strong>
            <span>备用网址</span>
            <strong class="bsid__multiline">
              {{ mirrorUrls.length ? mirrorUrls.join('\n') : '未提供' }}
            </strong>
            <span>下载地址</span>
            <strong>{{ downloadUrl }}</strong>
            <span>更新地址</span>
            <strong class="bsid__multiline">{{ normalizeText(meta.updateUrl) }}</strong>
            <span>图标地址</span>
            <strong class="bsid__multiline">{{ normalizeText(meta.logo) }}</strong>
            <span>文件大小</span>
            <strong>{{ formatFileSize(meta.fileSize) }}</strong>
            <span>请求间隔</span>
            <strong>{{ meta.minDelayMs ? `${meta.minDelayMs} ms` : '未提供' }}</strong>
            <span>标签</span>
            <strong>{{ meta.tags.length ? meta.tags.join('、') : '未提供' }}</strong>
            <span>依赖脚本</span>
            <strong class="bsid__multiline">
              {{ requireUrls.length ? requireUrls.join('\n') : '无' }}
            </strong>
          </div>

          <div class="bsid__desc">
            {{ normalizeText(meta.description) }}
          </div>

          <n-alert :type="installStateAlertType" :show-icon="false">
            <div class="bsid__install-state">
              <div class="bsid__install-state-title">
                {{ installStateTitle }}
              </div>
              <div class="bsid__install-state-text">{{ installStateText }}</div>
              <div v-if="localSource" class="bsid__install-state-meta">
                <span>本地 {{ formatVersion(localVersion || localSource.version) }}</span>
                <span>远端 {{ formatVersion(remoteVersion || meta.version) }}</span>
              </div>
              <div v-if="localSourcePath" class="bsid__install-state-path">
                {{ localSourcePath }}
              </div>
            </div>
          </n-alert>
        </template>
      </div>

      <template #footer>
        <div class="bsid__actions">
          <n-button @click="closeDialog">取消</n-button>
          <n-button
            type="primary"
            :loading="installing"
            :disabled="loading || !!error || !preview"
            @click="confirmInstall"
          >
            {{ installActionText }}
          </n-button>
        </div>
      </template>
    </n-card>
  </n-modal>
</template>

<style scoped>
.bsid {
  width: min(560px, calc(100vw - 28px));
}

.bsid__body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: 60vh;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: 2px;
}

.bsid__loading {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 80px;
  color: var(--color-text-soft);
  font-size: var(--fs-14);
}

.bsid__raw-link {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-inline: 2px;
}

.bsid__raw-link-label {
  color: var(--color-text-muted);
  font-size: var(--fs-12);
}

.bsid__raw-link-value {
  color: var(--color-text-soft);
  font-size: var(--fs-12);
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.bsid__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.bsid__title {
  min-width: 0;
  color: var(--color-text);
  font-size: 1rem;
  font-weight: var(--fw-bold);
  overflow-wrap: anywhere;
}

.bsid__tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
  flex-shrink: 0;
}

.bsid__grid {
  display: grid;
  grid-template-columns: 80px minmax(0, 1fr);
  align-items: start;
  gap: 8px 12px;
  font-size: var(--fs-13);
}

.bsid__grid span {
  color: var(--color-text-muted);
  padding-top: 1px;
}

.bsid__grid strong {
  min-width: 0;
  color: var(--color-text);
  font-weight: var(--fw-medium);
  overflow-wrap: anywhere;
  word-break: break-all;
}

.bsid__multiline {
  white-space: pre-wrap;
}

.bsid__desc {
  max-height: 120px;
  overflow: auto;
  padding: 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-1);
  background: var(--color-surface-soft);
  color: var(--color-text-soft);
  font-size: var(--fs-13);
  line-height: 1.65;
  white-space: pre-wrap;
}

.bsid__install-state {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.bsid__install-state-title {
  color: var(--color-text);
  font-weight: var(--fw-semibold);
}

.bsid__install-state-text {
  color: var(--color-text-soft);
  line-height: 1.6;
}

.bsid__install-state-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  color: var(--color-text-muted);
  font-size: var(--fs-12);
}

.bsid__install-state-path {
  color: var(--color-text-muted);
  font-size: var(--fs-12);
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.bsid__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

@media (width <= 640px) {
  .bsid__head {
    flex-direction: column;
  }

  .bsid__tags {
    justify-content: flex-start;
  }

  .bsid__grid {
    grid-template-columns: 1fr;
  }
}
</style>
