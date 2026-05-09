<script setup lang="ts">
import { NInputNumber, useMessage } from 'naive-ui';
import { storeToRefs } from 'pinia';
import { computed, onMounted, ref } from 'vue';
import type { StorageDebugDump } from '@/composables/useFrontendStorage';
import type { ShelfBook } from '@/types';
import { comicCacheClear, comicCacheSize } from '@/composables/useBookSource';
import { hasNativeTransport } from '@/composables/useEnv';
import { loadStorageDebugDump } from '@/composables/useFrontendStorage';
import { invokeWithTimeout } from '@/composables/useInvoke';
import { isTransportAvailable } from '@/composables/useTransport';
import { useAppConfigStore, useBookshelfStore } from '@/stores';
import SettingItem from './SettingItem.vue';
import SettingSection from './SettingSection.vue';

const message = useMessage();
const _appCfg = useAppConfigStore();
const { config, savingKey } = storeToRefs(_appCfg);
const { setConfig, loadConfig } = _appCfg;
const { loadBooks } = useBookshelfStore();

const comicCacheSizeBytes = ref(0);
const comicCacheClearing = ref(false);
const coverCacheSizeBytes = ref(0);
const coverCacheClearing = ref(false);
const transportReady = ref(hasNativeTransport);

const loadingInspector = ref(false);
const storageDump = ref<StorageDebugDump | null>(null);
const scriptScopes = ref<Array<{ namespace: string; count: number }>>([]);
const selectedFrontendNamespace = ref('');
const selectedScriptScope = ref('');
const bookshelfItems = ref<ShelfBook[]>([]);
const selectedBookshelfId = ref('');

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

const frontendNamespaceOptions = computed(() =>
  Object.entries(storageDump.value?.frontend ?? {}).map(([namespace, values]) => ({
    label: `${namespace} (${Object.keys(values).length})`,
    value: namespace,
  })),
);

const currentFrontendNamespaceData = computed(() => {
  if (!selectedFrontendNamespace.value) {
    return null;
  }
  return storageDump.value?.frontend[selectedFrontendNamespace.value] ?? null;
});

const scriptScopeOptions = computed(() =>
  scriptScopes.value.map((scope) => ({
    label: `${scope.namespace} (${scope.count})`,
    value: scope.namespace,
  })),
);

const currentScriptScopeData = ref<unknown>(null);

const bookshelfOptions = computed(() =>
  bookshelfItems.value.map((book) => ({
    label: `${book.name} · ${book.id}`,
    value: book.id,
  })),
);

const currentBookshelfData = computed(
  () => bookshelfItems.value.find((book) => book.id === selectedBookshelfId.value) ?? null,
);

async function handleSet(key: string, value: string) {
  try {
    await setConfig(key, value);
    message.success('已保存');
  } catch (e: unknown) {
    message.error(`保存失败: ${e}`);
  }
}

async function refreshCacheSize() {
  if (!transportReady.value) {
    return;
  }
  try {
    comicCacheSizeBytes.value = await comicCacheSize();
  } catch {
    /* ignore */
  }
  try {
    coverCacheSizeBytes.value = await invokeWithTimeout<number>('cover_cache_size', {}, 10_000);
  } catch {
    /* ignore */
  }
}

async function handleClearCache() {
  if (!transportReady.value) {
    return;
  }
  comicCacheClearing.value = true;
  try {
    const freed = await comicCacheClear();
    comicCacheSizeBytes.value = 0;
    message.success(`已清理 ${formatBytes(freed)}`);
  } catch (e: unknown) {
    message.error(`清理失败: ${e}`);
  } finally {
    comicCacheClearing.value = false;
  }
}

async function handleClearCoverCache() {
  if (!transportReady.value) {
    return;
  }
  coverCacheClearing.value = true;
  try {
    const freed = await invokeWithTimeout<number>('cover_cache_clear', {}, 15_000);
    coverCacheSizeBytes.value = 0;
    message.success(`封面缓存已清理 ${formatBytes(freed)}`);
  } catch (e: unknown) {
    message.error(`清理失败: ${e}`);
  } finally {
    coverCacheClearing.value = false;
  }
}

async function refreshInspector() {
  if (!transportReady.value) {
    return;
  }
  loadingInspector.value = true;
  try {
    await loadConfig();
    storageDump.value = await loadStorageDebugDump();
    scriptScopes.value = await invokeWithTimeout<Array<{ namespace: string; count: number }>>(
      'config_list_scopes',
      undefined,
      10_000,
    );
    bookshelfItems.value = await loadBooks();

    if (!selectedFrontendNamespace.value && frontendNamespaceOptions.value.length > 0) {
      selectedFrontendNamespace.value = frontendNamespaceOptions.value[0].value;
    }
    if (!selectedScriptScope.value && scriptScopeOptions.value.length > 0) {
      selectedScriptScope.value = scriptScopeOptions.value[0].value;
    }
    if (!selectedBookshelfId.value && bookshelfItems.value.length > 0) {
      selectedBookshelfId.value = bookshelfItems.value[0].id;
    }
    await refreshSelectedScope();
  } catch (e: unknown) {
    message.error(`加载存储查看器失败: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    loadingInspector.value = false;
  }
}

async function refreshSelectedScope() {
  if (!selectedScriptScope.value || !transportReady.value) {
    currentScriptScopeData.value = null;
    return;
  }
  try {
    const entries = await invokeWithTimeout<Array<{ key: string; value: string }>>(
      'config_dump_scope',
      { scope: selectedScriptScope.value },
      10_000,
    );
    currentScriptScopeData.value = Object.fromEntries(
      entries.map((entry) => {
        try {
          return [entry.key, JSON.parse(entry.value)];
        } catch {
          return [entry.key, entry.value];
        }
      }),
    );
  } catch (e: unknown) {
    currentScriptScopeData.value = {
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

onMounted(async () => {
  transportReady.value = await isTransportAvailable();
  await refreshCacheSize();
  await refreshInspector();
});
</script>

<template>
  <SettingSection title="存储" section-id="section-storage" v-if="transportReady">
    <SettingItem
      label="漫画图片缓存"
      desc="启用后漫画图片经 Rust 后端下载缓存到本地，支持离线查看和预加载；关闭则由浏览器直接加载"
    >
      <n-switch
        :value="config.comic_cache_enabled"
        size="small"
        :loading="savingKey === 'comic_cache_enabled'"
        @update:value="(v: boolean) => handleSet('comic_cache_enabled', String(v))"
      />
    </SettingItem>

    <SettingItem
      label="缓存占用"
      :desc="`当前漫画图片缓存大小：${formatBytes(comicCacheSizeBytes)}`"
    >
      <n-button
        size="small"
        type="warning"
        :loading="comicCacheClearing"
        :disabled="comicCacheSizeBytes === 0"
        @click="handleClearCache"
      >
        清理缓存
      </n-button>
    </SettingItem>

    <SettingItem
      label="封面图片缓存"
      :desc="`书籍封面本地缓存大小：${formatBytes(coverCacheSizeBytes)}`"
    >
      <n-button
        size="small"
        type="warning"
        :loading="coverCacheClearing"
        :disabled="coverCacheSizeBytes === 0"
        @click="handleClearCoverCache"
      >
        清理封面缓存
      </n-button>
    </SettingItem>

    <SettingItem
      label="自动预缓存章节数"
      desc="阅读时点击`缓存章节`的默认章节数（0 = 关闭，-1 = 全部）；小说和漫画均支持，视频忽略"
    >
      <div class="slider-row">
        <n-slider
          :value="config.cache_prefetch_count"
          :min="-1"
          :max="50"
          :step="1"
          style="flex: 1"
          :loading="savingKey === 'cache_prefetch_count'"
          @update:value="(v: number) => handleSet('cache_prefetch_count', String(v))"
        />
        <span class="slider-value">
          {{
            config.cache_prefetch_count < 0
              ? '全部'
              : config.cache_prefetch_count === 0
                ? '关闭'
                : config.cache_prefetch_count + '章'
          }}
        </span>
      </div>
    </SettingItem>

    <SettingItem
      label="自动缓存并发数"
      desc="阅读时自动缓存章节的并发数（1 = 顺序缓存，默认 2）"
    >
      <n-input-number
        :value="config.cache_prefetch_concurrency"
        :min="1"
        :max="10"
        :step="1"
        style="width: 90px"
        :loading="savingKey === 'cache_prefetch_concurrency'"
        @update:value="(v) => handleSet('cache_prefetch_concurrency', String(Math.max(1, v ?? 2)))"
      />
    </SettingItem>

    <SettingItem
      label="导出缓存并发数"
      desc="书架右键导出书籍时缓存章节的并发数（1 = 顺序缓存，默认 3）"
    >
      <n-input-number
        :value="config.export_prefetch_concurrency"
        :min="1"
        :max="10"
        :step="1"
        style="width: 90px"
        :loading="savingKey === 'export_prefetch_concurrency'"
        @update:value="(v) => handleSet('export_prefetch_concurrency', String(Math.max(1, v ?? 3)))"
      />
    </SettingItem>

    <SettingItem
      label="数据库查看器"
      desc="用于查看 redb 中的应用配置、前端命名空间、脚本配置 scope 和书架元信息。"
      :vertical="true"
    >
      <div class="inspector-toolbar">
        <n-button size="small" :loading="loadingInspector" @click="refreshInspector">刷新</n-button>
        <span class="path-text">app_state: {{ storageDump?.appStatePath || '未初始化' }}</span>
        <span class="path-text">bookshelf: {{ storageDump?.bookshelfPath || '未初始化' }}</span>
      </div>

      <n-tabs type="line" animated>
        <n-tab-pane name="app-config" tab="应用配置">
          <pre class="json-view">{{ formatJson(storageDump?.appConfig ?? config) }}</pre>
        </n-tab-pane>

        <n-tab-pane name="frontend" tab="前端命名空间">
          <div class="selector-row">
            <n-select
              v-model:value="selectedFrontendNamespace"
              :options="frontendNamespaceOptions"
              placeholder="选择一个前端命名空间"
              clearable
            />
          </div>
          <pre class="json-view">{{
            formatJson(currentFrontendNamespaceData ?? { hint: '暂无前端命名空间数据' })
          }}</pre>
        </n-tab-pane>

        <n-tab-pane name="scripts" tab="脚本配置">
          <div class="selector-row">
            <n-select
              v-model:value="selectedScriptScope"
              :options="scriptScopeOptions"
              placeholder="选择一个脚本 scope"
              clearable
              @update:value="() => refreshSelectedScope()"
            />
          </div>
          <pre class="json-view">{{
            formatJson(currentScriptScopeData ?? { hint: '暂无脚本配置数据' })
          }}</pre>
        </n-tab-pane>

        <n-tab-pane name="bookshelf" tab="书架元信息">
          <div class="selector-row">
            <n-select
              v-model:value="selectedBookshelfId"
              :options="bookshelfOptions"
              placeholder="选择一本书"
              clearable
            />
          </div>
          <pre class="json-view">{{
            formatJson(currentBookshelfData ?? { hint: '当前书架为空' })
          }}</pre>
        </n-tab-pane>

        <n-tab-pane name="client-state" tab="同步状态">
          <pre class="json-view">{{
            formatJson(storageDump?.clientStates ?? { hint: '暂无客户端同步状态' })
          }}</pre>
        </n-tab-pane>
      </n-tabs>
    </SettingItem>
  </SettingSection>
</template>

<style scoped>
.slider-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 180px;
}

.slider-value {
  min-width: 44px;
  text-align: right;
  font-size: var(--fs-13);
  color: var(--color-text-muted);
}

.inspector-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3);
  align-items: center;
  margin-bottom: var(--space-3);
}

.selector-row {
  margin-bottom: var(--space-3);
}

.path-text {
  font-size: var(--fs-12);
  color: var(--color-text-muted);
  word-break: break-all;
}

.json-view {
  margin: 0;
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-surface-soft);
  border: 1px solid var(--color-border);
  color: var(--color-text-soft);
  font-size: var(--fs-12);
  line-height: 1.55;
  max-height: 420px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
