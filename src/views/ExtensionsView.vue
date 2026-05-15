<!-- ExtensionsView — 前端插件管理页，负责插件安装、编辑、启停、排序、示例与配置管理。 -->
<script setup lang="ts">
import { Folder, Search, Code2 } from 'lucide-vue-next';
import { useMessage, useDialog, type DropdownOption } from 'naive-ui';
import { storeToRefs } from 'pinia';
import { ref, computed, onMounted, onUnmounted } from 'vue';
import JavaScriptHighlightEditor from '@/components/base/JavaScriptHighlightEditor.vue';
import ExampleCard from '@/components/extensions/ExampleCard.vue';
import ExtensionCard from '@/components/extensions/ExtensionCard.vue';
import AppPageHeader from '@/components/layout/AppPageHeader.vue';
import MobileToolbarMenu from '@/components/layout/MobileToolbarMenu.vue';
import { isMobile } from '@/composables/useEnv';
import { eventListen } from '@/composables/useEventBus';
import { invokeWithTimeout } from '@/composables/useInvoke';
import { useOverlayBackstack } from '@/composables/useOverlayBackstack';
import {
  useFrontendPluginsStore,
  type PluginSettingValue,
  type ResolvedPluginSettingField,
} from '@/stores';
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
} from '../composables/useExtension';
import { EXAMPLE_SCRIPTS, type ExampleScript } from '../data/extensionExamples';
import { saveExportFile } from '../utils/exportFile';

const message = useMessage();
const dialog = useDialog();

const activeTab = ref<'installed' | 'examples'>('installed');
const extensions = ref<ExtensionMeta[]>([]);
const extDir = ref('');
const loading = ref(false);
const reloadingAll = ref(false);
const searchQuery = ref('');
const categoryFilter = ref<string>('');

const showEditor = ref(false);
const editorTitle = ref('');
const editorContent = ref('');
const editorFile = ref('');
const editorSaving = ref(false);
const editorVscodeOpen = ref(false);
const editorReloaded = ref(false);
const editorOpenKey = ref(0);

const showPreview = ref(false);
const previewTitle = ref('');
const previewSource = ref('');
const previewExampleId = ref<string | null>(null);
const installLoading = ref(false);
const showSettings = ref(false);
const settingsTitle = ref('');
const settingsFileName = ref('');
const settingsLoading = ref(false);
const settingsSaving = ref(false);
const settingsFields = ref<ResolvedPluginSettingField[]>([]);
const settingsValues = ref<Record<string, PluginSettingValue>>({});
const settingsDraftValues = ref<Record<string, PluginSettingValue>>({});

useOverlayBackstack(
  () => showEditor.value,
  () => {
    showEditor.value = false;
  },
);
useOverlayBackstack(
  () => showPreview.value,
  () => {
    showPreview.value = false;
  },
);
useOverlayBackstack(
  () => showSettings.value,
  () => {
    showSettings.value = false;
  },
);

const showUrlImport = ref(false);
const urlImportUrl = ref('');
const urlImporting = ref(false);

useOverlayBackstack(
  () => showUrlImport.value,
  () => {
    showUrlImport.value = false;
  },
);

const frontendPluginsStore = useFrontendPluginsStore();
const { plugins: runtimePlugins } = storeToRefs(frontendPluginsStore);
const {
  ensureInitialized: ensureFrontendPlugins,
  movePlugin,
  reloadPlugin,
  getPluginSettings,
  updatePluginSetting,
  resetPluginSettings,
} = frontendPluginsStore;

const runtimeByFileName = computed(
  () => new Map(runtimePlugins.value.map((plugin) => [plugin.fileName, plugin])),
);

const shortExtDir = computed(() => {
  if (!extDir.value) {
    return '';
  }
  const sep = extDir.value.includes('\\') ? '\\' : '/';
  const parts = extDir.value.split(sep).filter(Boolean);
  if (parts.length <= 3) {
    return extDir.value;
  }
  return `…${sep}${parts.slice(-2).join(sep)}`;
});

const categories = computed(() => {
  const cats = new Set(extensions.value.map((e) => e.category || '其他'));
  return [{ label: '全部', value: '' }, ...[...cats].map((c) => ({ label: c, value: c }))];
});

const examplesSearchQuery = ref('');
const examplesCategoryFilter = ref('');

const exampleCategories = computed(() => {
  const cats = new Set(EXAMPLE_SCRIPTS.map((e) => e.meta.category || '其他'));
  return [{ label: '全部', value: '' }, ...[...cats].map((c) => ({ label: c, value: c }))];
});

const filteredExamples = computed(() =>
  EXAMPLE_SCRIPTS.filter((ex) => {
    const byCategory =
      !examplesCategoryFilter.value ||
      (ex.meta.category || '其他') === examplesCategoryFilter.value;
    const q = examplesSearchQuery.value.trim();
    const bySearch =
      !q ||
      (ex.meta.name ?? '').includes(q) ||
      (ex.meta.description ?? '').includes(q) ||
      (ex.meta.author ?? '').includes(q) ||
      (ex.meta.category ?? '').includes(q);
    return byCategory && bySearch;
  }),
);

const filtered = computed(() =>
  extensions.value.filter((e) => {
    const byCategory =
      !categoryFilter.value || categoryFilter.value === '' || e.category === categoryFilter.value;
    const q = searchQuery.value.trim();
    const bySearch =
      !q ||
      e.name.includes(q) ||
      e.description.includes(q) ||
      e.author.includes(q) ||
      e.category.includes(q);
    return byCategory && bySearch;
  }),
);

const installedFileNames = computed(() => new Set(extensions.value.map((e) => e.fileName)));
const installedHeaderMenuOptions: DropdownOption[] = [
  { label: '新建扩展', key: 'new' },
  { label: '导入本地', key: 'import-file' },
  { label: '从 URL 安装', key: 'import-url' },
  { label: '刷新列表', key: 'refresh' },
  { label: '全部重载', key: 'reload-all' },
];

async function loadExtensions() {
  loading.value = true;
  try {
    await ensureFrontendPlugins();
    const [list, dir] = await Promise.all([listExtensions(), getExtensionDir()]);
    const orderMap = new Map(runtimePlugins.value.map((plugin, index) => [plugin.fileName, index]));
    extensions.value = [...list].toSorted(
      (left, right) =>
        (orderMap.get(left.fileName) ?? Number.MAX_SAFE_INTEGER) -
        (orderMap.get(right.fileName) ?? Number.MAX_SAFE_INTEGER),
    );
    extDir.value = dir;
  } catch (e: unknown) {
    message.error(`加载失败: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    loading.value = false;
  }
}

async function forceReloadExtensions() {
  if (reloadingAll.value) {
    return;
  }
  reloadingAll.value = true;
  try {
    await reloadPlugin();
    await loadExtensions();
  } finally {
    reloadingAll.value = false;
  }
}

async function openDirInExplorer() {
  if (!extDir.value) {
    return;
  }
  try {
    await invokeWithTimeout('open_dir_in_explorer', { path: extDir.value }, 5_000);
  } catch (e: unknown) {
    message.error(`无法打开目录: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function onToggle(ext: ExtensionMeta) {
  try {
    await toggleExtension(ext.fileName, !ext.enabled);
    await loadExtensions();
  } catch (e: unknown) {
    message.error(`切换失败: ${e instanceof Error ? e.message : String(e)}`);
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
        await deleteExtension(ext.fileName);
        extensions.value = extensions.value.filter((e) => e.fileName !== ext.fileName);
        message.success('已删除');
      } catch (e: unknown) {
        message.error(`删除失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  });
}

async function openEditor(ext?: ExtensionMeta) {
  if (ext) {
    editorTitle.value = `编辑：${ext.name}`;
    editorFile.value = ext.fileName;
    try {
      editorContent.value = await readExtension(ext.fileName);
    } catch (e: unknown) {
      message.error(`读取失败: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
  } else {
    editorTitle.value = '新建扩展';
    editorFile.value = '';
    editorContent.value = newExtensionTemplate();
  }
  editorOpenKey.value += 1;
  showEditor.value = true;
}

async function saveEditor() {
  if (!editorFile.value) {
    const m = editorContent.value.match(/\/\/\s*@name\s+(.+)/);
    const name = m?.[1]?.trim() || '未命名扩展';
    editorFile.value = toExtSafeFileName(name);
  }
  editorSaving.value = true;
  try {
    await saveExtension(editorFile.value, editorContent.value);
    message.success('已保存');
    showEditor.value = false;
    await loadExtensions();
  } catch (e: unknown) {
    message.error(`保存失败: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    editorSaving.value = false;
  }
}

async function openEditorInVscode() {
  if (!editorFile.value) {
    message.warning('请先保存，再用 VS Code 打开');
    return;
  }
  editorVscodeOpen.value = true;
  try {
    await openExtensionInVscode(editorFile.value);
  } catch (e: unknown) {
    message.error(`${e instanceof Error ? e.message : String(e)}`);
  } finally {
    editorVscodeOpen.value = false;
  }
}

async function viewInstalledCode(ext: ExtensionMeta) {
  try {
    previewSource.value = await readExtension(ext.fileName);
    previewTitle.value = ext.name;
    previewExampleId.value = null;
    showPreview.value = true;
  } catch (e: unknown) {
    message.error(`读取失败: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function viewExampleCode(example: ExampleScript) {
  previewSource.value = example.source;
  previewTitle.value = example.meta.name ?? example.id;
  previewExampleId.value = example.id;
  showPreview.value = true;
}

function isExampleInstalled(example: ExampleScript): boolean {
  return installedFileNames.value.has(toExtSafeFileName(example.meta.name ?? example.id));
}

async function installExample(example: ExampleScript) {
  const fileName = toExtSafeFileName(example.meta.name ?? example.id);
  installLoading.value = true;
  try {
    await saveExtension(fileName, example.source);
    await loadExtensions();
    message.success(`已安装「${example.meta.name}」`);
  } catch (e: unknown) {
    message.error(`安装失败: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    installLoading.value = false;
  }
}

async function installFromPreview() {
  const example = EXAMPLE_SCRIPTS.find((e) => e.id === previewExampleId.value);
  if (!example) {
    return;
  }
  await installExample(example);
  showPreview.value = false;
}

function importFromFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'text/javascript,application/javascript,text/plain,.js';
  input.multiple = true;
  input.addEventListener('change', async () => {
    if (!input.files?.length) {
      return;
    }
    const files = Array.from(input.files);
    let ok = 0;
    for (const file of files) {
      try {
        const text = await file.text();
        await saveExtension(file.name, text);
        ok++;
      } catch (e) {
        message.error(`导入 ${file.name} 失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    if (ok) {
      message.success(`已导入 ${ok} 个扩展`);
      void loadExtensions();
    }
  });
  input.click();
}

async function exportExtension(ext: ExtensionMeta) {
  try {
    const source = await readExtension(ext.fileName);
    const saved = await saveExportFile({
      defaultName: ext.fileName,
      mime: 'text/javascript;charset=utf-8',
      text: source,
      filterName: 'JavaScript',
      extensions: ['js'],
    });
    if (!saved) {
      return;
    }
    message.success('已导出扩展');
  } catch (e: unknown) {
    message.error(`导出失败: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function importFromUrl() {
  const url = urlImportUrl.value.trim();
  if (!url) {
    return;
  }
  urlImporting.value = true;
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    const text = await resp.text();
    const nameMatch = text.match(/\/\/\s*@name\s+(.+)/);
    const name = nameMatch?.[1]?.trim() || 'unknown';
    const fileName = toExtSafeFileName(name);
    await saveExtension(fileName, text);
    await loadExtensions();
    message.success(`已安装「${name}」`);
    showUrlImport.value = false;
    urlImportUrl.value = '';
  } catch (e: unknown) {
    message.error(`安装失败: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    urlImporting.value = false;
  }
}

function handleInstalledHeaderMenuSelect(key: string) {
  switch (key) {
    case 'new':
      void openEditor();
      break;
    case 'import-file':
      importFromFile();
      break;
    case 'import-url':
      showUrlImport.value = true;
      break;
    case 'refresh':
      void loadExtensions();
      break;
    case 'reload-all':
      void forceReloadExtensions();
      break;
    default:
      break;
  }
}

async function moveExtensionItem(fileName: string, direction: -1 | 1) {
  await movePlugin(fileName, direction);
  await loadExtensions();
}

async function reloadExtensionItem(fileName: string) {
  await reloadPlugin(fileName);
  await loadExtensions();
}

function getSettingString(key: string): string {
  const value = settingsValues.value[key];
  return typeof value === 'string' ? value : '';
}

function getDraftString(key: string): string {
  const value = settingsDraftValues.value[key];
  return typeof value === 'string' ? value : getSettingString(key);
}

function getSettingNumber(key: string): number {
  const value = settingsValues.value[key];
  return typeof value === 'number' ? value : 0;
}

function getSettingScalar(key: string): string | number | null {
  const value = settingsValues.value[key];
  return typeof value === 'string' || typeof value === 'number' ? value : null;
}

function getSettingBoolean(key: string): boolean {
  return settingsValues.value[key] === true;
}

function getSettingStringArray(key: string): string[] {
  const value = settingsValues.value[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function getDraftStringList(key: string): string {
  const draft = settingsDraftValues.value[key];
  if (Array.isArray(draft)) {
    return (draft as string[]).filter(Boolean).join('\n');
  }
  if (typeof draft === 'string') {
    return draft;
  }
  return getSettingStringArray(key).join('\n');
}

async function loadSettingsDialog(fileName: string) {
  settingsLoading.value = true;
  try {
    const payload = await getPluginSettings(fileName);
    settingsTitle.value = `${payload.plugin.name} 设置`;
    settingsFileName.value = fileName;
    settingsFields.value = payload.fields;
    settingsValues.value = payload.values;
    settingsDraftValues.value = { ...payload.values };
    showSettings.value = true;
  } catch (e: unknown) {
    message.error(`加载设置失败: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    settingsLoading.value = false;
  }
}

async function saveSettingsField(key: string, value: PluginSettingValue | undefined) {
  if (!settingsFileName.value) {
    return;
  }
  settingsSaving.value = true;
  try {
    await updatePluginSetting(settingsFileName.value, key, value);
    await loadSettingsDialog(settingsFileName.value);
    await loadExtensions();
  } catch (e: unknown) {
    message.error(`保存设置失败: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    settingsSaving.value = false;
  }
}

function setDraftSetting(key: string, value: PluginSettingValue) {
  settingsDraftValues.value = {
    ...settingsDraftValues.value,
    [key]: value,
  };
}

async function resetSettingsDialog() {
  if (!settingsFileName.value) {
    return;
  }
  settingsSaving.value = true;
  try {
    await resetPluginSettings(settingsFileName.value);
    await loadSettingsDialog(settingsFileName.value);
    await loadExtensions();
    message.success('已恢复插件默认设置');
  } catch (e: unknown) {
    message.error(`恢复失败: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    settingsSaving.value = false;
  }
}

let unlistenExt: (() => void) | null = null;
let unlistenViewReload: (() => void) | null = null;

function handleInstallPluginEvent(e: Event) {
  const { url } = (e as CustomEvent<{ url: string }>).detail ?? {};
  if (!url) {
    return;
  }
  urlImportUrl.value = url;
  showUrlImport.value = true;
}

onMounted(async () => {
  await loadExtensions();
  window.addEventListener('app:install-plugin', handleInstallPluginEvent);
  unlistenExt = await eventListen<{ fileName: string }>('extension:changed', async (event) => {
    await loadExtensions();
    if (showEditor.value && editorFile.value === event.payload.fileName) {
      try {
        editorContent.value = await readExtension(event.payload.fileName);
        editorReloaded.value = true;
        setTimeout(() => {
          editorReloaded.value = false;
        }, 3000);
      } catch {
        /* 文件可能已被删除 */
      }
    }
  });
  unlistenViewReload = await eventListen<{ view?: string }>('app:view-reload', async (event) => {
    if (event.payload?.view === 'extensions') {
      await forceReloadExtensions();
    }
  });
});

onUnmounted(() => {
  window.removeEventListener('app:install-plugin', handleInstallPluginEvent);
  unlistenExt?.();
  unlistenViewReload?.();
});
</script>

<template>
  <div class="ext-view">
    <AppPageHeader title="前端插件管理" :divider="true" :hide-subtitle-on-mobile="true">
      <template #title-extra>
        <div
          v-if="extDir && !isMobile"
          class="ext-header__dir ext-header__dir--clickable"
          :title="extDir"
          @click="openDirInExplorer"
        >
          <Folder :size="12" />
          <span class="ext-header__dir-path">{{ shortExtDir }}</span>
        </div>
      </template>
      <template #subtitle>
        插件脚本全部在前端页面内运行，现已支持阅读器管线、书架右键动作、封面生成器与声明式交互弹窗
      </template>
      <template #actions>
        <MobileToolbarMenu
          v-if="activeTab === 'installed'"
          :options="installedHeaderMenuOptions"
          @select="handleInstalledHeaderMenuSelect"
        >
          <n-button size="small" type="primary" @click="openEditor()">新建扩展</n-button>
          <n-button size="small" quaternary :loading="loading" @click="loadExtensions"
            >刷新</n-button
          >
          <n-button size="small" quaternary :loading="reloadingAll" @click="forceReloadExtensions"
            >全部重载</n-button
          >
        </MobileToolbarMenu>
      </template>
    </AppPageHeader>

    <n-alert class="ext-feature-warning" type="warning" :show-icon="true">
      插件系统暂时还是预览版，暂时还不好用，请谨慎使用并手动检查插件来源与运行结果。
    </n-alert>

    <!-- 主 Tabs -->
    <n-tabs v-model:value="activeTab" type="line" animated class="ext-tabs">
      <!-- ===== 已安装 ===== -->
      <n-tab-pane name="installed" tab="已安装">
        <div class="ext-pane ext-pane--scroll app-scrollbar">
          <div class="ext-toolbar">
            <n-input
              v-model:value="searchQuery"
              class="ext-toolbar__search"
              placeholder="搜索名称、作者、分类..."
              clearable
              size="small"
            >
              <template #prefix>
                <Search :size="13" />
              </template>
            </n-input>
            <n-select
              v-model:value="categoryFilter"
              :options="categories"
              class="ext-toolbar__filter"
              size="small"
            />
          </div>

          <div class="ext-stats">
            共 {{ filtered.length }} 个扩展，已启用
            {{ filtered.filter((e) => e.enabled).length }} 个，前端运行中
            {{
              filtered.filter((e) => runtimeByFileName.get(e.fileName)?.status === 'active').length
            }}
            个，异常
            {{
              filtered.filter((e) => runtimeByFileName.get(e.fileName)?.status === 'error').length
            }}
            个
          </div>

          <n-spin :show="loading" class="ext-list-wrap">
            <div class="ext-list">
              <ExtensionCard
                v-for="ext in filtered"
                :key="ext.fileName"
                :ext="ext"
                :runtime-info="runtimeByFileName.get(ext.fileName)"
                @toggle="onToggle(ext)"
                @move="(dir) => moveExtensionItem(ext.fileName, dir)"
                @reload="reloadExtensionItem(ext.fileName)"
                @view-code="viewInstalledCode(ext)"
                @edit="openEditor(ext)"
                @delete="confirmDelete(ext)"
                @settings="loadSettingsDialog(ext.fileName)"
                @export="exportExtension(ext)"
              />

              <n-empty
                v-if="!filtered.length && !loading"
                description="暂无扩展，可新建或从「内置示例」安装"
                style="padding: 48px 0"
              />
            </div>
          </n-spin>
        </div>
      </n-tab-pane>

      <!-- ===== 内置示例 ===== -->
      <n-tab-pane name="examples" tab="内置示例">
        <div class="ext-pane ext-pane--scroll app-scrollbar">
          <div class="ext-toolbar">
            <n-input
              v-model:value="examplesSearchQuery"
              size="small"
              clearable
              placeholder="搜索示例..."
              class="ext-toolbar__search"
            >
              <template #prefix>
                <Search :size="13" />
              </template>
            </n-input>
            <n-select
              v-model:value="examplesCategoryFilter"
              :options="exampleCategories"
              class="ext-toolbar__filter"
              size="small"
            />
          </div>
          <p class="examples-tip">
            以下为内置示例脚本，展示 UserScript 格式与 Legado 扩展 API 的使用方式。
            点击「查看代码」预览完整源码，点击「安装」写入扩展目录即可启用。
          </p>
          <div class="examples-grid">
            <ExampleCard
              v-for="ex in filteredExamples"
              :key="ex.id"
              :ex="ex"
              :installed="isExampleInstalled(ex)"
              :install-loading="installLoading"
              @view-code="viewExampleCode(ex)"
              @install="installExample(ex)"
            />
          </div>
        </div>
      </n-tab-pane>
    </n-tabs>

    <!-- 编辑器弹窗 -->
    <n-modal
      v-model:show="showEditor"
      preset="card"
      :title="editorTitle"
      style="width: 820px; max-width: 95vw; height: 92vh; display: flex; flex-direction: column"
      content-style="display:flex;flex-direction:column;overflow:hidden"
      :mask-closable="false"
    >
      <n-alert
        v-if="editorReloaded"
        type="info"
        :show-icon="true"
        style="margin-bottom: 8px; font-size: 12px"
      >
        文件已被外部修改，内容已自动重载
      </n-alert>
      <JavaScriptHighlightEditor
        v-model="editorContent"
        :autofocus-key="editorOpenKey"
        min-height="0"
        placeholder="UserScript 内容..."
        @save="saveEditor"
      />
      <template #footer>
        <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px">
          <n-button
            v-if="editorFile"
            size="small"
            quaternary
            :loading="editorVscodeOpen"
            @click="openEditorInVscode"
            title="在 VS Code 中打开，保存后自动重载"
          >
            <template #icon>
              <Code2 :size="14" />
            </template>
            在 VS Code 中打开
          </n-button>
          <div style="flex: 1" />
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
      style="width: 760px; max-width: 95vw; max-height: 90vh; display: flex; flex-direction: column"
    >
      <div class="code-preview">
        <pre class="code-preview__pre">{{ previewSource }}</pre>
      </div>
      <template #footer>
        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px">
          <n-button @click="showPreview = false">关闭</n-button>
          <n-button
            v-if="
              previewExampleId &&
              !isExampleInstalled(EXAMPLE_SCRIPTS.find((e) => e.id === previewExampleId)!)
            "
            type="primary"
            :loading="installLoading"
            @click="installFromPreview"
          >
            安装此脚本
          </n-button>
        </div>
      </template>
    </n-modal>

    <n-modal
      v-model:show="showSettings"
      preset="card"
      :title="settingsTitle"
      style="width: 720px; max-width: 95vw; max-height: 90vh; display: flex; flex-direction: column"
    >
      <n-spin :show="settingsLoading || settingsSaving">
        <div class="plugin-settings">
          <template v-for="field in settingsFields" :key="field.key || field.label || field.type">
            <div v-if="field.type === 'divider'" class="plugin-settings__divider" />

            <div v-else-if="field.type === 'info'" class="plugin-settings__info">
              <div class="plugin-settings__info-title">{{ field.label }}</div>
              <div v-if="field.description" class="plugin-settings__info-desc">
                {{ field.description }}
              </div>
            </div>

            <div v-else-if="field.key" class="plugin-settings__row">
              <div class="plugin-settings__label-wrap">
                <div class="plugin-settings__label">
                  {{ field.label || field.key }}
                </div>
                <div v-if="field.description" class="plugin-settings__desc">
                  {{ field.description }}
                </div>
              </div>

              <div class="plugin-settings__control">
                <n-input
                  v-if="field.type === 'text'"
                  :value="getDraftString(field.key)"
                  :placeholder="field.placeholder"
                  :disabled="field.disabled"
                  @update:value="setDraftSetting(field.key, $event)"
                  @blur="saveSettingsField(field.key, getDraftString(field.key))"
                />

                <n-input
                  v-else-if="field.type === 'password'"
                  type="password"
                  show-password-on="click"
                  :value="getDraftString(field.key)"
                  :placeholder="field.placeholder"
                  :disabled="field.disabled"
                  @update:value="setDraftSetting(field.key, $event)"
                  @blur="saveSettingsField(field.key, getDraftString(field.key))"
                />

                <n-input
                  v-else-if="field.type === 'textarea'"
                  type="textarea"
                  :rows="field.rows ?? 4"
                  :value="getDraftString(field.key)"
                  :placeholder="field.placeholder"
                  :disabled="field.disabled"
                  @update:value="setDraftSetting(field.key, $event)"
                  @blur="saveSettingsField(field.key, getDraftString(field.key))"
                />

                <n-input-number
                  v-else-if="field.type === 'number'"
                  :value="getSettingNumber(field.key)"
                  :min="field.min"
                  :max="field.max"
                  :step="field.step ?? 1"
                  :disabled="field.disabled"
                  style="width: 100%"
                  @update:value="
                    saveSettingsField(field.key, typeof $event === 'number' ? $event : 0)
                  "
                />

                <div v-else-if="field.type === 'color'" class="plugin-settings__color-row">
                  <input
                    class="plugin-settings__color-input"
                    type="color"
                    :value="getSettingString(field.key) || '#000000'"
                    :disabled="field.disabled"
                    @input="saveSettingsField(field.key, ($event.target as HTMLInputElement).value)"
                  />
                  <span class="plugin-settings__color-text">
                    {{ getSettingString(field.key) || '#000000' }}
                  </span>
                </div>

                <n-switch
                  v-else-if="field.type === 'switch'"
                  :value="getSettingBoolean(field.key)"
                  :disabled="field.disabled"
                  @update:value="saveSettingsField(field.key, $event)"
                />

                <n-select
                  v-else-if="field.type === 'select'"
                  :value="getSettingScalar(field.key)"
                  :options="field.options"
                  :disabled="field.disabled"
                  @update:value="saveSettingsField(field.key, $event as string | number)"
                />

                <n-radio-group
                  v-else-if="field.type === 'radio'"
                  :value="getSettingScalar(field.key)"
                  :disabled="field.disabled"
                  @update:value="saveSettingsField(field.key, $event as string | number)"
                >
                  <n-space vertical>
                    <n-radio
                      v-for="option in field.options ?? []"
                      :key="String(option.value)"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </n-radio>
                  </n-space>
                </n-radio-group>

                <div v-else-if="field.type === 'slider'" class="plugin-settings__slider-wrap">
                  <n-slider
                    :value="getSettingNumber(field.key)"
                    :min="field.min ?? 0"
                    :max="field.max ?? 100"
                    :step="field.step ?? 1"
                    :disabled="field.disabled"
                    @update:value="saveSettingsField(field.key, $event)"
                  />
                  <span class="plugin-settings__slider-value">{{
                    getSettingNumber(field.key)
                  }}</span>
                </div>

                <n-input
                  v-else-if="field.type === 'string-list'"
                  type="textarea"
                  :value="getDraftStringList(field.key)"
                  :placeholder="field.placeholder || '每行一条规则'"
                  :disabled="field.disabled"
                  :rows="field.rows ?? 5"
                  @update:value="setDraftSetting(field.key, $event)"
                  @blur="
                    saveSettingsField(
                      field.key,
                      getDraftStringList(field.key)
                        .split('\n')
                        .filter((s) => Boolean(s.trim())),
                    )
                  "
                />
              </div>
            </div>
          </template>

          <n-empty
            v-if="!settingsFields.length && !settingsLoading"
            description="这个插件当前没有可配置项"
            style="padding: 32px 0"
          />
        </div>
      </n-spin>

      <template #footer>
        <div class="plugin-settings__footer">
          <n-button quaternary :disabled="settingsSaving" @click="resetSettingsDialog"
            >恢复默认</n-button
          >
          <div style="flex: 1" />
          <n-button @click="showSettings = false">关闭</n-button>
        </div>
      </template>
    </n-modal>

    <!-- 从 URL 安装插件 -->
    <n-modal
      v-model:show="showUrlImport"
      preset="card"
      title="从 URL 安装插件"
      style="width: 480px; max-width: 95vw"
      :mask-closable="false"
    >
      <div style="display: flex; flex-direction: column; gap: 12px">
        <n-input
          v-model:value="urlImportUrl"
          placeholder="https://example.com/my-plugin.js"
          :disabled="urlImporting"
          @keyup.enter="importFromUrl"
        />
        <n-alert type="warning" :show-icon="true" style="font-size: 12px">
          请确保来源可信，插件脚本将在本地执行。
        </n-alert>
      </div>
      <template #footer>
        <div style="display: flex; justify-content: flex-end; gap: 8px">
          <n-button @click="showUrlImport = false">取消</n-button>
          <n-button
            type="primary"
            :loading="urlImporting"
            :disabled="!urlImportUrl.trim()"
            @click="importFromUrl"
          >
            安装
          </n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<style scoped>
.ext-view {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  /* background: var(--color-bg-page); */
}
.ext-feature-warning {
  margin: 8px 24px 0;
  flex-shrink: 0;
}

.ext-header__dir {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--color-text-muted);
  opacity: 0.6;
}

.ext-header__dir--clickable {
  cursor: pointer;
  border-radius: var(--radius-1);
  padding: 2px 8px;
  transition:
    background var(--dur-fast) var(--ease-standard),
    color var(--dur-fast) var(--ease-standard),
    opacity var(--dur-fast) var(--ease-standard);
}

@media (hover: hover) and (pointer: fine) {
  .ext-header__dir--clickable:hover {
    background: var(--color-hover);
    color: var(--color-text-soft);
    opacity: 1;
  }
}

.ext-header__dir-path {
  font-size: var(--fs-11);
  font-family: 'Cascadia Code', 'Consolas', monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 420px;
}

/* Tabs */
.ext-tabs {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 0 24px;
}

:deep(.n-tabs-nav) {
  padding-top: 4px;
  flex-shrink: 0;
}

:deep(.n-tabs-content) {
  flex: 1;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

:deep(.n-tabs-pane-wrapper) {
  flex: 1;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  display: flex;
}

:deep(.n-tab-pane) {
  flex: 1;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0;
}

/* Pane */
.ext-pane {
  height: 100%;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.ext-pane--scroll {
  overflow-y: auto;
  overflow-x: hidden;
}
.ext-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px 8px;
}
.ext-toolbar__search {
  width: 220px;
  min-width: 0;
}
.ext-toolbar__filter {
  width: 130px;
  flex-shrink: 0;
}
.ext-stats {
  flex-shrink: 0;
  padding: 0 20px 6px;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}
.ext-list-wrap {
  display: block;
  overflow: visible;
}
.ext-list-wrap :deep(.n-spin-container) {
  display: block;
  min-height: auto;
}
.ext-list-wrap :deep(.n-spin-content) {
  display: block;
  min-height: auto;
}
.ext-list {
  height: auto;
  min-height: auto;
  overflow: visible;
  padding: 4px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* 已安装卡片 */

/* 示例脚本区 */
.examples-tip {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  padding: 12px 20px 8px;
  flex-shrink: 0;
}
.examples-grid {
  flex: none;
  min-height: auto;
  overflow: visible;
  padding: 4px 16px 16px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(320px, 100%), 1fr));
  grid-auto-rows: max-content;
  gap: 12px;
  align-content: start;
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

.plugin-settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 62vh;
  overflow: auto;
  padding-right: 4px;
}

.plugin-settings__row {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}

.plugin-settings__label-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.plugin-settings__label {
  font-size: var(--fs-14);
  font-weight: var(--fw-semibold);
  color: var(--color-text);
}

.plugin-settings__desc {
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--color-text-muted);
}

.plugin-settings__control {
  min-width: 0;
}

.plugin-settings__divider {
  height: 1px;
  background: var(--color-border);
}

.plugin-settings__info {
  padding: 10px 12px;
  border-radius: var(--radius-1);
  background: color-mix(in srgb, var(--color-accent) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-accent) 18%, var(--color-border));
}

.plugin-settings__info-title {
  font-size: 0.82rem;
  font-weight: var(--fw-semibold);
  color: var(--color-text);
}

.plugin-settings__info-desc {
  margin-top: 4px;
  font-size: var(--fs-12);
  line-height: var(--lh-base);
  color: var(--color-text-soft);
}

.plugin-settings__color-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.plugin-settings__color-input {
  width: 44px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: transparent;
}

.plugin-settings__color-text {
  font-size: var(--fs-12);
  color: var(--color-text-soft);
  font-family: 'Cascadia Code', 'Consolas', monospace;
}

.plugin-settings__slider-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}

.plugin-settings__slider-value {
  width: 36px;
  text-align: right;
  font-size: var(--fs-12);
  color: var(--color-text-soft);
}

.plugin-settings__footer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

@media (max-width: 1280px) {
  .ext-card {
    grid-template-columns: 4px minmax(0, 1fr);
  }

  .ext-card__stripe {
    grid-row: 1 / span 2;
  }

  .ext-card__actions {
    grid-column: 2;
    width: auto;
    min-width: 0;
    border-left: 0;
    border-top: 1px solid var(--color-border);
    justify-content: space-between;
    flex-wrap: wrap;
  }

  .ext-card__action-list {
    justify-content: flex-start;
  }
}

/* ── 移动端适配 ─────────────────────────── */
@media (pointer: coarse), (max-width: 640px) {
  .ext-toolbar {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
    padding: 12px 14px 8px;
  }

  .ext-toolbar__search,
  .ext-toolbar__filter {
    width: 100%;
  }

  .ext-tabs :deep(.n-tabs-nav) {
    padding-top: 0;
  }

  .ext-tabs {
    padding: 0 14px;
  }

  .examples-tip {
    padding: 10px 14px 6px;
  }

  .examples-grid {
    grid-template-columns: minmax(0, 1fr);
    padding: 4px 12px 16px;
    gap: 10px;
  }

  .example-card {
    min-width: 0;
  }

  .ext-stats {
    padding: 0 14px 6px;
    line-height: 1.5;
  }

  .ext-list {
    padding: 4px 12px 16px;
  }

  .ext-card {
    grid-template-columns: 4px minmax(0, 1fr);
  }

  .ext-card__stripe {
    grid-row: 1 / span 2;
  }

  .ext-card__actions {
    grid-column: 2;
    width: auto;
    min-width: 0;
    border-left: 0;
    border-top: 1px solid var(--color-border);
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
  }

  .ext-card__toggle {
    justify-content: space-between;
  }

  .ext-card__action-list {
    justify-content: flex-start;
  }

  .example-card__name-row,
  .example-card__meta,
  .example-card__foot {
    flex-wrap: wrap;
  }

  :deep(.n-tabs-tab) {
    padding: 6px 2px !important;
    font-size: 0.8125rem !important;
  }

  .plugin-settings__row {
    grid-template-columns: 1fr;
    gap: 8px;
  }
}
</style>
