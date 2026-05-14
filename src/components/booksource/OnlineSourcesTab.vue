<script setup lang="ts">
import { openUrl } from "@tauri-apps/plugin-opener";
import { useMessage, useDialog } from "naive-ui";
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useOverlayBackstack } from "@/composables/useOverlayBackstack";
import { safeRandomUUID } from "@/utils/uuid";
import defaultLogoUrl from "../../assets/booksource-default.svg";
import BookSourceInstallDialog from "../BookSourceInstallDialog.vue";
import OnlineSourceCard from "./OnlineSourceCard.vue";
import { formatVersion, compareVersions } from "@/utils/versionUtils";
import {
  type BookSourceMeta,
  type RepoSourceInfo,
  type RepoManifest,
  type RepoSourceSyncResult,
  getBookSourceIdentity,
  hasExplicitBookSourceUuid,
  fetchRepository,
  installFromRepository,
  checkRepositorySourceSync,
  deleteBookSource,
  configRead,
  configWrite,
} from "../../composables/useBookSource";

type RepoSyncStatus = "idle" | "checking" | "synced" | "update" | "error";

interface RepoSyncState {
  status: RepoSyncStatus;
  localVersion: string;
  remoteVersion: string;
  error: string;
}

const props = defineProps<{
  sources: BookSourceMeta[];
  active?: boolean;
}>();

const emits = defineEmits<{
  reload: [];
}>();

const message = useMessage();
const dialog = useDialog();

// 追踪当前状态消息，显示新消息前自动销毁上一条，避免消息堆积
let statusMsg: ReturnType<typeof message.success> | null = null;
function showStatusMsg(
  type: "success" | "info" | "warning" | "error",
  content: string,
) {
  statusMsg?.destroy();
  statusMsg = message[type](content);
}

// ---- 仓库配置 ----
const REPO_CONFIG_SCOPE = "__app__";
const REPO_CONFIG_KEY = "repositories";

interface Repository {
  id: string;
  name: string;
  url: string;
  description: string;
}

const repositories = ref<Repository[]>([]);
const activeRepoId = ref("");
const onlineManifest = ref<RepoManifest | null>(null);
const onlineSources = ref<RepoSourceInfo[]>([]);
const onlineLoading = ref(false);
const onlineSearch = ref("");
const onlineError = ref("");
const installingSet = ref(new Set<string>());
const updatingSet = ref(new Set<string>());
const deletingSet = ref(new Set<string>());

// ---- 安装弹窗 ----
const showInstallDialog = ref(false);
const installDialogUrl = ref("");
const installDialogExpectedUuid = ref("");
const syncStates = ref<Record<string, RepoSyncState>>({});
const syncRunning = ref(false);
const bulkUpdating = ref(false);
const bulkForceUpdating = ref(false);

const showRepoModal = ref(false);
const repoForm = ref({ id: "", name: "", url: "", description: "" });

useOverlayBackstack(
  () => showRepoModal.value,
  () => {
    showRepoModal.value = false;
  },
);

let syncRunId = 0;

function normalizeRepoUrl(url: string) {
  return url.trim();
}

function resetOnlineState() {
  onlineError.value = "";
  onlineSources.value = [];
  onlineManifest.value = null;
  clearSyncStates();
}

function findRepositoryByUrl(url: string) {
  const normalizedUrl = normalizeRepoUrl(url);
  return repositories.value.find(
    (repo) => normalizeRepoUrl(repo.url) === normalizedUrl,
  );
}

async function persistRepos() {
  try {
    const data = JSON.stringify({
      repos: repositories.value,
      activeId: activeRepoId.value,
    });
    await configWrite(REPO_CONFIG_SCOPE, REPO_CONFIG_KEY, data);
  } catch {
    /* 非关键操作 */
  }
}

async function loadRepoConfig() {
  try {
    const raw = await configRead(REPO_CONFIG_SCOPE, REPO_CONFIG_KEY);
    if (!raw) {
      return;
    }
    const data = JSON.parse(raw) as { repos?: Repository[]; activeId?: string };
    if (Array.isArray(data.repos) && data.repos.length) {
      const repos = data.repos
        .map((repo) => ({
          ...repo,
          name: repo.name?.trim() ?? "",
          url: normalizeRepoUrl(repo.url ?? ""),
          description: repo.description?.trim() ?? "",
        }))
        .filter((repo) => repo.name && repo.url);

      repositories.value = repos;
      activeRepoId.value = repos.some((repo) => repo.id === data.activeId)
        ? (data.activeId ?? "")
        : (repos[0]?.id ?? "");
    }
  } catch {
    /* 配置损坏时静默回退 */
  }
}

function openAddRepo() {
  repoForm.value = { id: "", name: "", url: "", description: "" };
  showRepoModal.value = true;
}

function saveRepo() {
  const previousActiveRepoId = activeRepoId.value;
  const name = repoForm.value.name.trim();
  const url = normalizeRepoUrl(repoForm.value.url);
  const description = repoForm.value.description.trim();

  if (!name || !url) {
    message.warning("名称和 URL 不能为空");
    return;
  }

  const duplicated = repositories.value.find(
    (repo) =>
      repo.id !== repoForm.value.id && normalizeRepoUrl(repo.url) === url,
  );
  if (duplicated) {
    activeRepoId.value = duplicated.id;
    showRepoModal.value = false;
    message.info("该仓库已存在，已切换到现有仓库");
    void persistRepos();
    if (
      props.active &&
      activeRepoId.value &&
      previousActiveRepoId === activeRepoId.value
    ) {
      void fetchOnlineSources({ silentSuccess: true });
    }
    return;
  }

  if (repoForm.value.id) {
    const r = repositories.value.find((repo) => repo.id === repoForm.value.id);
    if (r) {
      Object.assign(r, { ...repoForm.value, name, url, description });
      activeRepoId.value = r.id;
    }
  } else {
    const newRepo = { id: safeRandomUUID(), name, url, description };
    repositories.value.push(newRepo);
    activeRepoId.value = newRepo.id;
  }
  showRepoModal.value = false;
  void persistRepos();

  if (
    props.active &&
    activeRepoId.value &&
    previousActiveRepoId === activeRepoId.value
  ) {
    void fetchOnlineSources({ silentSuccess: true });
  }
}

function removeRepo(id: string) {
  const repo = repositories.value.find((r) => r.id === id);
  repositories.value = repositories.value.filter((r) => r.id !== id);
  if (activeRepoId.value === id) {
    activeRepoId.value = repositories.value[0]?.id ?? "";
    onlineSources.value = [];
    onlineManifest.value = null;
    clearSyncStates();
  }
  persistRepos();
}

function clearSyncStates() {
  syncRunId += 1;
  syncRunning.value = false;
  syncStates.value = {};
}

function sourceUuid(src: RepoSourceInfo) {
  return getBookSourceIdentity(src);
}

function syncKey(src: RepoSourceInfo) {
  return sourceUuid(src) || src.downloadUrl || src.fileName;
}

function getLocalSource(src: RepoSourceInfo) {
  if (hasExplicitBookSourceUuid(src)) {
    return localSourceMap.value.get(src.uuid?.trim() ?? "");
  }
  return localSourceNameMap.value.get(src.name.trim());
}

function getSyncState(src: RepoSourceInfo) {
  return syncStates.value[syncKey(src)];
}

function setSyncState(src: RepoSourceInfo, state: RepoSyncState) {
  syncStates.value[syncKey(src)] = state;
}

function makeInitialSyncState(src: RepoSourceInfo): RepoSyncState {
  return {
    status: "idle",
    localVersion: getLocalSource(src)?.version ?? "",
    remoteVersion: src.version ?? "",
    error: "",
  };
}

/** 获取在线书源相对于本地安装版本的差异类型。 */
function getVersionDiff(
  src: RepoSourceInfo,
): "upgrade" | "downgrade" | "same" | null {
  const local = getLocalSource(src);
  if (!local) {
    return null;
  }
  const cmp = compareVersions(src.version ?? "", local.version ?? "");
  if (cmp === null) {
    return null;
  }
  if (cmp > 0) {
    return "upgrade";
  }
  if (cmp < 0) {
    return "downgrade";
  }
  return "same";
}

function getDisplayVersionDiff(
  src: RepoSourceInfo,
): "upgrade" | "downgrade" | "same" | null {
  const diff = getVersionDiff(src);
  if (diff === "same" && getSyncState(src)?.status === "update") {
    return "upgrade";
  }
  return diff;
}

async function checkSingleSourceSync(src: RepoSourceInfo, runId: number) {
  const initialState = makeInitialSyncState(src);
  setSyncState(src, {
    ...initialState,
    status: "checking",
  });

  try {
    const local = getLocalSource(src);
    if (!local) {
      return;
    }
    const result: RepoSourceSyncResult = await checkRepositorySourceSync(
      local.fileName,
      src.downloadUrl,
      sourceUuid(src),
    );
    if (runId !== syncRunId) {
      return;
    }

    setSyncState(src, {
      status: result.isConsistent ? "synced" : "update",
      localVersion: result.localVersion,
      remoteVersion: result.remoteVersion || src.version || "",
      error: "",
    });
  } catch (e: unknown) {
    if (runId !== syncRunId) {
      return;
    }

    setSyncState(src, {
      ...initialState,
      status: "error",
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

async function runInstalledSyncChecks(
  sources: RepoSourceInfo[],
  announce = false,
) {
  const targets = sources.filter((src) => isInstalled(src));
  const runId = ++syncRunId;
  syncStates.value = {};

  if (!targets.length) {
    syncRunning.value = false;
    return;
  }

  for (const src of targets) {
    setSyncState(src, {
      ...makeInitialSyncState(src),
      status: "checking",
    });
  }

  syncRunning.value = true;
  const queue = targets.slice();
  const concurrency = Math.min(4, targets.length);

  const worker = async () => {
    while (queue.length) {
      if (runId !== syncRunId) {
        return;
      }
      const current = queue.shift();
      if (!current) {
        return;
      }
      // oxlint-disable-next-line no-await-in-loop -- intentional queue-worker pattern inside Promise.all concurrency
      await checkSingleSourceSync(current, runId);
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  if (runId !== syncRunId) {
    return;
  }
  syncRunning.value = false;

  if (!announce) {
    return;
  }

  const updated = updateAvailableCount.value;
  const failed = checkErrorCount.value;
  if (!updated && !failed) {
    // showStatusMsg('success', `已检查 ${targets.length} 个已安装书源，本地与服务器一致`);
    return;
  }

  const summary = [`已检查 ${targets.length} 个已安装书源`];
  if (updated) {
    summary.push(`发现 ${updated} 个可更新`);
  }
  if (failed) {
    summary.push(`${failed} 个检查失败`);
  }
  showStatusMsg("warning", summary.join("，"));
}

async function refreshSingleSourceSync(src: RepoSourceInfo) {
  if (!syncRunId) {
    syncRunId = 1;
  }
  await checkSingleSourceSync(src, syncRunId);
}

async function fetchOnlineSources(
  options: { silentSuccess?: boolean; preserveCurrent?: boolean } = {},
) {
  const repo = repositories.value.find((r) => r.id === activeRepoId.value);
  if (!repo) {
    message.warning("请先添加并选择一个仓库");
    return;
  }

  if (onlineLoading.value) {
    return;
  }

  const { silentSuccess = false, preserveCurrent = false } = options;
  onlineLoading.value = true;
  onlineError.value = "";
  if (!preserveCurrent) {
    onlineSources.value = [];
    onlineManifest.value = null;
  }
  clearSyncStates();
  try {
    showStatusMsg(
      "info",
      `正在加载「${repo.name}」，如果书源较多可能需要一些时间...`,
    );
    const manifest = await fetchRepository(repo.url);
    // showStatusMsg('success', `已加载「${manifest.name}」书源列表，正在处理数据...`);
    // 将相对路径的 downloadUrl 解析为绝对 URL，兼容仓库服务端返回相对路径的情况
    manifest.sources = manifest.sources.map((src) => {
      if (src.downloadUrl && !/^https?:\/\//i.test(src.downloadUrl)) {
        try {
          return {
            ...src,
            downloadUrl: new URL(src.downloadUrl, repo.url).href,
          };
        } catch {
          return src;
        }
      }
      return src;
    });
    onlineManifest.value = manifest;
    onlineSources.value = manifest.sources;
    const installedMatches = manifest.sources.filter((src) =>
      isInstalled(src),
    ).length;
    if (!silentSuccess) {
      showStatusMsg(
        "success",
        `已加载「${manifest.name}」共 ${manifest.sources.length} 个书源`,
      );
    } else {
      statusMsg?.destroy();
      statusMsg = null;
    }
    void runInstalledSyncChecks(manifest.sources, installedMatches > 0);
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error("[OnlineSourcesTab] fetchOnlineSources error:", e);
    onlineError.value = errMsg || "请求失败";
    clearSyncStates();
    message.error(`加载失败: ${onlineError.value}`);
  } finally {
    onlineLoading.value = false;
  }
}

const filteredOnline = computed(() => {
  if (!onlineSearch.value) {
    return onlineSources.value;
  }
  const q = onlineSearch.value.toLowerCase();
  return onlineSources.value.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.url.toLowerCase().includes(q) ||
      (s.author ?? "").toLowerCase().includes(q) ||
      s.tags.some((t) => t.toLowerCase().includes(q)),
  );
});

const localSourceMap = computed(
  () =>
    new Map(
      props.sources.map(
        (source) => [getBookSourceIdentity(source), source] as const,
      ),
    ),
);
const localSourceNameMap = computed(
  () =>
    new Map(
      props.sources.map((source) => [source.name.trim(), source] as const),
    ),
);

const installedOnlineSources = computed(() =>
  onlineSources.value.filter((source) => isInstalled(source)),
);

const installedOnlineCount = computed(
  () => installedOnlineSources.value.length,
);

const updateAvailableCount = computed(
  () =>
    installedOnlineSources.value.filter(
      (source) => getSyncState(source)?.status === "update",
    ).length,
);

const checkingCount = computed(
  () =>
    installedOnlineSources.value.filter(
      (source) => getSyncState(source)?.status === "checking",
    ).length,
);
// used in template; void reference prevents noUnusedLocals false positive
void checkingCount;

const checkErrorCount = computed(
  () =>
    installedOnlineSources.value.filter(
      (source) => getSyncState(source)?.status === "error",
    ).length,
);

function isInstalled(src: RepoSourceInfo) {
  return !!getLocalSource(src);
}

function getSyncTagLabel(src: RepoSourceInfo) {
  const status = getSyncState(src)?.status ?? "idle";
  switch (status) {
    case "checking":
      return "检查中";
    case "synced":
      return "已同步";
    case "update":
      return "发现更新";
    case "error":
      return "检查失败";
    default:
      return "待检查";
  }
}
// used in template; void reference prevents noUnusedLocals false positive
void getSyncTagLabel;

function getSyncTagType(src: RepoSourceInfo) {
  const status = getSyncState(src)?.status ?? "idle";
  switch (status) {
    case "synced":
      return "success";
    case "update":
      return "warning";
    case "error":
      return "error";
    case "checking":
      return "info";
    default:
      return "default";
  }
}
// used in template; void reference prevents noUnusedLocals false positive
void getSyncTagType;

function getSyncHint(src: RepoSourceInfo) {
  const state = getSyncState(src) ?? makeInitialSyncState(src);
  switch (state.status) {
    case "checking":
      return "正在比较服务器与本地源码，@enabled 行会被忽略";
    case "synced":
      return `本地与服务器内容一致，比较时已忽略 @enabled 行`;
    case "update":
      return `本地 ${formatVersion(state.localVersion)}，远端 ${formatVersion(state.remoteVersion)}，忽略 @enabled 后内容仍不一致`;
    case "error":
      return state.error || "检查失败";
    default:
      return `尚未检查，当前本地 ${formatVersion(state.localVersion)}，远端 ${formatVersion(state.remoteVersion)}`;
  }
}
// used in template; void reference prevents noUnusedLocals false positive
void getSyncHint;

function installSource(src: RepoSourceInfo) {
  installDialogUrl.value = src.downloadUrl;
  installDialogExpectedUuid.value = sourceUuid(src);
  showInstallDialog.value = true;
}

async function onInstallDialogInstalled(payload: {
  name: string;
  fileName: string;
  uuid: string;
}) {
  const src = onlineSources.value.find((s) => sourceUuid(s) === payload.uuid);
  if (src) {
    await refreshSingleSourceSync(src);
  }
  emits("reload");
}

/** 从已安装书源列表中找到适合写入的文件名（避免与不同 UUID 的书源文件冲突） */
function resolveInstallFileName(
  srcFileName: string,
  srcUuid: string,
  reservedNames: Set<string>,
): string {
  const localByFile = props.sources.find((s) => s.fileName === srcFileName);
  if (!localByFile || getBookSourceIdentity(localByFile) === srcUuid) {
    // 无冲突或找到同 UUID 的本地文件：直接用原始文件名
    return srcFileName;
  }
  // 存在同名但不同 UUID 的本地文件，自动生成不冲突的新文件名
  const dot = srcFileName.toLowerCase().endsWith(".js")
    ? srcFileName.length - 3
    : srcFileName.length;
  const stem = srcFileName.slice(0, dot) || "booksource";
  const ext = srcFileName.toLowerCase().endsWith(".js")
    ? srcFileName.slice(dot)
    : ".js";
  let index = 2;
  let candidate = `${stem}-${index}${ext}`;
  while (reservedNames.has(candidate)) {
    index += 1;
    candidate = `${stem}-${index}${ext}`;
  }
  return candidate;
}

async function installAll() {
  if (!filteredOnline.value.length) {
    message.info("当前没有可安装的书源");
    return;
  }

  const toInstall = filteredOnline.value.filter((s) => !isInstalled(s));
  if (!toInstall.length) {
    message.info("所有书源均已安装");
    return;
  }

  // 预先建立"已占用文件名"集合，用于并发安装时避免互相抢占同一备用文件名
  const reservedNames = new Set(props.sources.map((s) => s.fileName));

  const results = await Promise.allSettled(
    toInstall.map(async (src) => {
      installingSet.value.add(src.fileName);
      try {
        const targetFileName = resolveInstallFileName(
          src.fileName,
          sourceUuid(src),
          reservedNames,
        );
        reservedNames.add(targetFileName);
        await installFromRepository(
          src.downloadUrl,
          targetFileName,
          sourceUuid(src),
        );
        await refreshSingleSourceSync(src);
      } finally {
        installingSet.value.delete(src.fileName);
      }
    }),
  );
  const ok = results.filter((r) => r.status === "fulfilled").length;
  emits("reload");
  message.success(`批量安装 ${ok} 个书源`);
}

async function performRepositoryUpdate(
  src: RepoSourceInfo,
  force = false,
  silent = false,
) {
  if (updatingSet.value.has(src.fileName)) {
    return false;
  }

  updatingSet.value.add(src.fileName);
  try {
    const local = getLocalSource(src);
    if (!local) {
      throw new Error("未找到同一 UUID 的本地书源");
    }
    await installFromRepository(
      src.downloadUrl,
      local.fileName,
      sourceUuid(src),
    );
    await refreshSingleSourceSync(src);
    emits("reload");
    if (!silent) {
      message.success(
        force ? `已强制更新「${src.name}」` : `已更新「${src.name}」`,
      );
    }
    return true;
  } catch (e: unknown) {
    if (!silent) {
      message.error(
        `${force ? "强制更新" : "更新"}失败: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    return false;
  } finally {
    updatingSet.value.delete(src.fileName);
  }
}

function confirmDeleteInstalled(src: RepoSourceInfo) {
  dialog.warning({
    title: "删除书源",
    content: `确认删除「${src.name}」？此操作将删除磁盘文件，不可恢复。`,
    positiveText: "删除",
    negativeText: "取消",
    onPositiveClick: async () => {
      deletingSet.value.add(src.fileName);
      try {
        const local = getLocalSource(src);
        if (!local) {
          throw new Error("未找到同一 UUID 的本地书源");
        }
        await deleteBookSource(local.fileName, local.sourceDir);
        emits("reload");
        message.success(`已删除「${src.name}」`);
      } catch (e: unknown) {
        message.error(
          `删除失败: ${e instanceof Error ? e.message : String(e)}`,
        );
      } finally {
        deletingSet.value.delete(src.fileName);
      }
    },
  });
}

async function recheckInstalledSources() {
  if (!installedOnlineCount.value) {
    message.info("当前仓库没有已安装书源需要检查");
    return;
  }
  await runInstalledSyncChecks(onlineSources.value, true);
}

async function updateAll(force = false) {
  const targets = force
    ? installedOnlineSources.value.slice()
    : installedOnlineSources.value.filter(
        (src) => getSyncState(src)?.status === "update",
      );

  if (!targets.length) {
    message.info(
      force ? "当前仓库没有可强制更新的已安装书源" : "当前没有需要更新的书源",
    );
    return;
  }

  if (force) {
    bulkForceUpdating.value = true;
  } else {
    bulkUpdating.value = true;
  }

  let ok = 0;
  let failed = 0;
  try {
    const updateResults = await Promise.allSettled(
      targets.map((src) => performRepositoryUpdate(src, force, true)),
    );
    for (const r of updateResults) {
      if (r.status === "fulfilled" && r.value) {
        ok++;
      } else {
        failed++;
      }
    }
  } finally {
    if (force) {
      bulkForceUpdating.value = false;
    } else {
      bulkUpdating.value = false;
    }
  }

  const prefix = force ? "批量强制更新" : "批量更新";
  if (failed) {
    message.warning(`${prefix}完成：成功 ${ok} 个，失败 ${failed} 个`);
  } else {
    message.success(`${prefix}完成：成功 ${ok} 个`);
  }
}

function confirmForceUpdateAll() {
  if (!installedOnlineCount.value) {
    message.info("当前仓库没有可强制更新的已安装书源");
    return;
  }

  dialog.warning({
    title: "批量强制更新",
    content: `将覆盖当前仓库中全部 ${installedOnlineCount.value} 个已安装书源。比较时会忽略 @enabled 行，但强制更新仍会直接写入服务器版本。确认继续？`,
    positiveText: "全部覆盖",
    negativeText: "取消",
    onPositiveClick: async () => {
      await updateAll(true);
    },
  });
}

function removeActiveRepo() {
  if (!activeRepoId.value) {
    message.info("当前没有可移除的仓库");
    return;
  }
  removeRepo(activeRepoId.value);
  message.success("已移除当前仓库");
}

function openAddRepoFromDeepLink(url: string, name?: string) {
  repoForm.value = { id: "", name: name ?? "", url, description: "" };
  showRepoModal.value = true;
}

function handleAddRepoEvent(e: Event) {
  const { url, name } =
    (e as CustomEvent<{ url: string; name?: string }>).detail ?? {};
  if (url) openAddRepoFromDeepLink(url, name);
}

onMounted(() => {
  window.addEventListener("app:add-repo", handleAddRepoEvent);
});

onUnmounted(() => {
  window.removeEventListener("app:add-repo", handleAddRepoEvent);
});

defineExpose({
  openAddRepo,
  fetchOnlineSources,
  removeActiveRepo,
  recheckInstalledSources,
  installAll,
  updateAll,
  confirmForceUpdateAll,
});

watch(activeRepoId, (next, prev) => {
  if (next === prev) {
    return;
  }

  if (!next) {
    resetOnlineState();
    void persistRepos();
    return;
  }

  void persistRepos();
  if (props.active) {
    void fetchOnlineSources({ silentSuccess: true });
  }
});

watch(
  () => props.active,
  (active) => {
    if (!active || !activeRepoId.value || !repositories.value.length) {
      return;
    }
    void fetchOnlineSources({ silentSuccess: true, preserveCurrent: true });
  },
);

// 初始化
void loadRepoConfig();
</script>

<template>
  <div class="bv-pane">
    <!-- 仓库选择 + 操作 -->
    <div class="bv-toolbar">
      <n-select
        v-model:value="activeRepoId"
        :options="repositories.map((r) => ({ label: r.name, value: r.id }))"
        size="small"
        style="width: 220px"
        placeholder="请先添加仓库..."
        :disabled="!repositories.length"
      />
      <div class="bv-toolbar__spacer" />
      <div v-if="onlineSources.length" class="bv-toolbar__stats">
        <span class="bv-stat">已安装 {{ installedOnlineCount }}</span>
        <span v-if="checkingCount" class="bv-stat"
          >检查中 {{ checkingCount }}</span
        >
        <span v-if="updateAvailableCount" class="bv-stat bv-stat--warning"
          >待更新 {{ updateAvailableCount }}</span
        >
        <span v-if="checkErrorCount" class="bv-stat bv-stat--error"
          >失败 {{ checkErrorCount }}</span
        >
      </div>
      <n-input
        v-model:value="onlineSearch"
        placeholder="搜索名称/作者/标签..."
        clearable
        size="small"
        style="width: 200px"
        :disabled="!onlineSources.length"
      />
    </div>

    <!-- 仓库描述 -->
    <div class="bv-repo-desc" v-if="onlineManifest">
      {{ onlineManifest.name }} · v{{ onlineManifest.version }} · 更新于
      {{ onlineManifest.updatedAt }}
    </div>
    <div
      class="bv-repo-desc"
      v-else-if="repositories.find((r) => r.id === activeRepoId)?.description"
    >
      {{ repositories.find((r) => r.id === activeRepoId)?.description }}
    </div>
    <div v-if="onlineSources.length" class="bv-compare-note">
      一致性检查按 UUID 匹配，并会忽略 @enabled 与 @uuid 行。
    </div>

    <!-- 加载态 / 错误态 -->
    <n-spin :show="onlineLoading" style="width: 100%">
      <n-alert
        v-if="onlineError"
        type="error"
        :title="onlineError"
        style="margin: 12px 0"
      />

      <div
        v-if="!repositories.length && !onlineLoading"
        class="bv-online-empty"
      >
        <n-empty
          description="尚未添加仓库，点击「+ 添加仓库」输入仓库 JSON 地址"
          style="padding: 48px 0"
        />
      </div>

      <div
        v-else-if="!onlineSources.length && !onlineLoading"
        class="bv-online-empty"
      >
        <n-empty
          description="点击「获取书源列表」从仓库拉取书源"
          style="padding: 48px 0"
        />
      </div>

      <div v-else class="bv-source-list app-scrollbar">
        <OnlineSourceCard
          v-for="src in filteredOnline"
          :key="syncKey(src)"
          :src="src"
          :default-logo-url="defaultLogoUrl"
          :installed="isInstalled(src)"
          :version-diff="getDisplayVersionDiff(src)"
          :local-version="getLocalSource(src)?.version"
          :bulk-busy="bulkUpdating || bulkForceUpdating"
          :deleting="deletingSet.has(src.fileName)"
          @install="installSource(src)"
          @delete="confirmDeleteInstalled(src)"
          @open-url="openUrl"
        />
      </div>
    </n-spin>
  </div>

  <!-- 添加/编辑仓库弹窗 -->
  <n-modal
    v-model:show="showRepoModal"
    preset="card"
    title="添加在线书源仓库"
    style="width: 460px; max-width: 95vw"
    :mask-closable="false"
  >
    <n-form label-placement="top" size="small">
      <n-form-item label="仓库名称">
        <n-input v-model:value="repoForm.name" placeholder="例：社区精选书源" />
      </n-form-item>
      <n-form-item label="JSON 地址 (URL)">
        <n-input v-model:value="repoForm.url" placeholder="https://..." />
      </n-form-item>
      <n-form-item label="描述（可选）">
        <n-input
          v-model:value="repoForm.description"
          placeholder="说明这个仓库的来源"
        />
      </n-form-item>
    </n-form>
    <template #footer>
      <div
        style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        "
      >
        <!-- <n-button size="small" quaternary @click="addCommunityRepository"
          >一键添加社区书源</n-button
        > -->
        <div style="display: flex; justify-content: flex-end; gap: 8px">
          <n-button @click="showRepoModal = false">取消</n-button>
          <n-button type="primary" @click="saveRepo">保存</n-button>
        </div>
      </div>
    </template>
  </n-modal>

  <!-- 单个书源安装弹窗 -->
  <BookSourceInstallDialog
    :show="showInstallDialog"
    :download-url="installDialogUrl"
    :expected-uuid="installDialogExpectedUuid"
    @update:show="showInstallDialog = $event"
    @installed="onInstallDialogInstalled"
  />
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

.bv-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.bv-toolbar__spacer {
  flex: 1;
}

.bv-toolbar__stats {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.bv-stat {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  background: var(--color-surface-hover);
  border-radius: 999px;
  padding: 2px 8px;
  white-space: nowrap;
}

.bv-stat--warning {
  color: var(--color-warning);
}

.bv-stat--error {
  color: var(--color-danger);
}

.bv-repo-desc {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin-bottom: 10px;
}

.bv-compare-note {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  margin-bottom: 10px;
  opacity: 0.8;
}

.bv-source-list {
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-right: 4px;
}

@media (pointer: coarse), (max-width: 640px) {
  .bv-toolbar {
    gap: 6px;
  }
  .bv-toolbar__spacer {
    display: none;
  }
  .bv-toolbar__stats {
    width: 100%;
  }
}
</style>
