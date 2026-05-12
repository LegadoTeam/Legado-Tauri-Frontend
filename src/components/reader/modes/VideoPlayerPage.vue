<script setup lang="ts">
import { openUrl } from '@tauri-apps/plugin-opener';
import { ChevronLeft, Link, Keyboard, ArrowUp, Copy, Check } from 'lucide-vue-next';
import { storeToRefs } from 'pinia';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { ChapterItem, ChapterGroup } from '@/types';
import { useAppConfigStore, groupChapters, useScriptBridgeStore } from '@/stores';
import type { ReaderBookInfo } from '../types';
import {
  ensureFrontendNamespaceLoaded,
  getFrontendStorageItem,
  legacyLocalStorageEntries,
  legacyLocalStorageRemove,
  setFrontendStorageItem,
} from '../../../composables/useFrontendStorage';
import { parseVideoSource } from '../video/types';
import type { VideoCategoryGroup } from '../video/types';
import VideoMode from './VideoMode.vue';

const props = defineProps<{
  /** chapterContent 拿到的播放地址（空则展示 loading/error 状态） */
  content: string;
  chapters: ChapterItem[];
  activeChapterIndex: number;
  bookInfo?: ReaderBookInfo;
  /** 正在加载 chapterContent（网络请求阶段） */
  loading: boolean;
  error: string;
  hasPrev: boolean;
  hasNext: boolean;
  fileName: string;
  resumeTime: number;
  /** 视频多线路分组数据（可选，由父组件传入） */
  chapterGroups?: ChapterGroup[];
  /** 初始选中的线路索引 */
  initialGroupIndex?: number;
  /** 将线路标签显示在视频下方（书架模式），而非目录侧边栏 */
  inlineGroupTabs?: boolean;
  /** 各集播放进度（key = chapter.url） */
  episodeProgress?: Record<string, { time: number; duration: number; lastPlayedAt: number }>;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'goto-chapter', index: number): void;
  (e: 'prev-chapter'): void;
  (e: 'next-chapter'): void;
  (e: 'progress', time: number, duration: number): void;
  (e: 'ended'): void;
  (e: 'retry'): void;
  /** 切换线路分组时通知父组件 */
  (e: 'switch-group', groupIndex: number): void;
}>();

// 播放器 ref（完整 expose 类型）
const videoModeRef = ref<{
  getCurrentTime?: () => number;
  getDuration?: () => number;
  play?: () => void;
  pause?: () => void;
  isPaused?: () => boolean;
  seek?: (delta: number) => void;
  getVolume?: () => number;
  setVolume?: (v: number) => void;
  enterFullscreen?: () => void;
  exitFullscreen?: () => void;
  isFullscreen?: () => boolean;
} | null>(null);

const _appCfg = useAppConfigStore();
const { videoAutoNext, videoSeekStepSecs } = storeToRefs(_appCfg);

const _bridge = useScriptBridgeStore();
const logScrollRef = ref<HTMLElement | null>(null);
const contentLoadFinished = ref(false);
const logStartedAt = ref(Date.now());
const logCopied = ref(false);

async function copyLogs() {
  const text = loadingLogs.value.join('\n');
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    logCopied.value = true;
    setTimeout(() => { logCopied.value = false; }, 2000);
  } catch {
    // ignore
  }
}

// ── 分组 & 排序状态 ──────────────────────────────────────────────────────

/** 分组数据（优先使用 props，否则从 chapters 推导） */
const groups = computed<ChapterGroup[]>(() => {
  if (props.chapterGroups && props.chapterGroups.length > 1) {
    return props.chapterGroups;
  }
  return groupChapters(props.chapters);
});

const hasGroups = computed(() => groups.value.length > 1);
const activeGroupIndex = ref(props.initialGroupIndex ?? 0);
const sortOrder = ref<'asc' | 'desc'>('asc');
const STORAGE_NAMESPACE = 'reader.video-page';

/** 前端存储 key，用于记忆标签和排序 */
function vpStorageKey(suffix: string) {
  const bookKey = props.bookInfo?.bookUrl || props.fileName;
  return `vp-video-${bookKey}-${suffix}`;
}

function saveVpTabState() {
  setFrontendStorageItem(STORAGE_NAMESPACE, vpStorageKey('group'), String(activeGroupIndex.value));
  setFrontendStorageItem(STORAGE_NAMESPACE, vpStorageKey('sort'), sortOrder.value);
}

function restoreVpTabState() {
  try {
    const savedGroup = getFrontendStorageItem(STORAGE_NAMESPACE, vpStorageKey('group'));
    if (savedGroup !== null) {
      const idx = Number(savedGroup);
      if (idx >= 0 && idx < groups.value.length) {
        activeGroupIndex.value = idx;
      }
    }
    const savedSort = getFrontendStorageItem(STORAGE_NAMESPACE, vpStorageKey('sort'));
    if (savedSort === 'desc') {
      sortOrder.value = 'desc';
    }
  } catch {
    /* ignore */
  }
}

// 恢复记忆
onMounted(() => {
  void ensureFrontendNamespaceLoaded(STORAGE_NAMESPACE, () => {
    const bookKey = props.bookInfo?.bookUrl || props.fileName;
    const migrated: Record<string, string> = {};
    const legacy = legacyLocalStorageEntries(`vp-video-${bookKey}-`);
    for (const [key, value] of Object.entries(legacy)) {
      migrated[key] = value;
      legacyLocalStorageRemove(key);
    }
    return Object.keys(migrated).length ? migrated : null;
  }).then(() => {
    if (hasGroups.value) {
      restoreVpTabState();
    }
    restoreCategories();
    // 若有已保存的分类选择，在内容加载后自动触发覆盖请求
    if (Object.keys(selectedCategories.value).length > 0 && props.content) {
      void fetchWithCategories();
    }
  });
});

function onGroupTabClick(idx: number) {
  activeGroupIndex.value = idx;
  saveVpTabState();
  emit('switch-group', idx);
}

function toggleVpSort() {
  sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  saveVpTabState();
}

/** 获取某集的播放进度信息 */
function getEpProgress(ch: ChapterItem) {
  return props.episodeProgress?.[ch.url];
}

/** 某集是否已看完（>=90%） */
function isEpWatched(ch: ChapterItem): boolean {
  const p = getEpProgress(ch);
  return !!p && p.duration > 0 && p.time >= p.duration * 0.9;
}

/** 某集播放进度比例（0-1），已看完返回 0 */
function epProgressRatio(ch: ChapterItem): number {
  const p = getEpProgress(ch);
  if (!p || p.duration <= 0 || p.time <= 0) return 0;
  if (isEpWatched(ch)) return 0;
  return p.time / p.duration;
}

/** 当前分组中的章节列表（含排序） */
const displayEpisodes = computed(() => {
  let list: ChapterItem[];
  if (hasGroups.value) {
    const g = groups.value[activeGroupIndex.value];
    list = g ? g.chapters : [];
  } else {
    list = props.chapters;
  }
  return sortOrder.value === 'desc' ? [...list].toReversed() : list;
});
const hasEpisodeList = computed(() => displayEpisodes.value.length >= 1);

function resolveChapterIndex(chapter: ChapterItem) {
  const byRef = props.chapters.indexOf(chapter);
  if (byRef >= 0) {
    return byRef;
  }
  return props.chapters.findIndex(
    (item) => item.url === chapter.url && (item.group || '') === (chapter.group || ''),
  );
}

function emitGotoChapter(chapter: ChapterItem) {
  const index = resolveChapterIndex(chapter);
  if (index >= 0) {
    emit('goto-chapter', index);
  }
}

const activeChapter = computed(() => props.chapters[props.activeChapterIndex]);

const videoTitle = computed(() => props.bookInfo?.name || activeChapter.value?.name || '视频播放');
const sourceName = computed(
  () => props.bookInfo?.sourceName || props.bookInfo?.fileName || props.fileName || '未知书源',
);
const pageUrl = computed(() => activeChapter.value?.url || '');

function formatTime(ts?: number) {
  if (!ts) {
    return '';
  }
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ── URL 处理 ──────────────────────────────────────────────────────────────

// ── 通用分类系统 ──────────────────────────────────────────────────────────

/**
 * 分类覆盖内容：用户选择分类后通过 runChapterContent(url, selectedCategories)
 * 获取的新内容。若存在则覆盖 props.content。
 */
const categoryContent = ref('');
const categoryFetching = ref(false);

/** 当前用户选中的分类选项（{ [groupId]: optionId }） */
const selectedCategories = ref<Record<string, string>>({});

/** 实际展示/播放内容（分类覆盖 > 原始内容） */
const activeContent = computed(() => categoryContent.value || props.content);
const showPlayerLoading = computed(
  () => props.loading || (!props.error && !activeContent.value.trim() && !contentLoadFinished.value),
);

const loadingLogs = computed(() =>
  _bridge.state.logs
    .filter((log) => log.time >= logStartedAt.value)
    .slice(-120)
    .map((log) => {
      const d = new Date(log.time);
      const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
      const source = log.source ? `[${log.source}] ` : '';
      return `${time} ${source}${log.message}`;
    }),
);

watch(
  () => props.activeChapterIndex,
  () => {
    contentLoadFinished.value = false;
    logStartedAt.value = Date.now();
  },
  { immediate: true },
);

watch(
  () => props.loading,
  (loading, wasLoading) => {
    if (loading) {
      contentLoadFinished.value = false;
      if (!wasLoading) {
        logStartedAt.value = Date.now();
      }
      return;
    }
    if (wasLoading) {
      contentLoadFinished.value = true;
    }
  },
);

watch(
  () => [props.content, props.error] as const,
  ([content, error]) => {
    if (content || error) {
      contentLoadFinished.value = true;
    }
  },
  { immediate: true },
);

watch(
  loadingLogs,
  () => {
    nextTick(() => {
      if (logScrollRef.value) {
        logScrollRef.value.scrollTop = logScrollRef.value.scrollHeight;
      }
    });
  },
  { flush: 'post' },
);

/** 尝试从 content 中提取视频流 URL；视频书源的 content 返回值就是实际播放地址 */
const videoSource = computed(() => {
  if (!activeContent.value.trim()) {
    return null;
  }
  return parseVideoSource(activeContent.value);
});

/** 当前内容声明的分类维度列表 */
const availableCategories = computed<VideoCategoryGroup[]>(
  () => videoSource.value?.categories ?? [],
);

/** 分类 storage key */
function vpCatStorageKey() {
  const bookKey = props.bookInfo?.bookUrl || props.fileName;
  return `vp-cat-${bookKey}`;
}

function saveCategories() {
  setFrontendStorageItem(
    STORAGE_NAMESPACE,
    vpCatStorageKey(),
    JSON.stringify(selectedCategories.value),
  );
}

function restoreCategories() {
  try {
    const raw = getFrontendStorageItem(STORAGE_NAMESPACE, vpCatStorageKey());
    if (raw) {
      selectedCategories.value = JSON.parse(raw) as Record<string, string>;
    }
  } catch {
    /* ignore */
  }
}

async function fetchWithCategories() {
  const chapter = props.chapters[props.activeChapterIndex];
  if (!chapter) return;
  const params = selectedCategories.value;
  if (Object.keys(params).length === 0) return;
  categoryFetching.value = true;
  try {
    const raw = await _bridge.runChapterContent(
      props.fileName,
      chapter.url,
      undefined,
      params,
    );
    categoryContent.value = typeof raw === 'string' ? raw : String(raw ?? '');
  } catch {
    // 静默失败，保留旧内容
  } finally {
    categoryFetching.value = false;
  }
}

async function onSelectCategoryOption(groupId: string, optionId: string) {
  if (selectedCategories.value[groupId] === optionId) return;
  selectedCategories.value = { ...selectedCategories.value, [groupId]: optionId };
  saveCategories();
  await fetchWithCategories();
}

// 换集时清除分类覆盖内容，但保留选择，然后按保存的分类重新请求
watch(
  () => props.activeChapterIndex,
  () => {
    categoryContent.value = '';
    // 保留 selectedCategories，让 fetchWithCategories 在新集重用
    void fetchWithCategories();
  },
);

// watch content 变化（外部重新加载集内容时，若有分类选择则覆盖）
watch(
  () => props.content,
  (newContent) => {
    if (!newContent) return;
    // 若当前已有分类选择且没有已覆盖的内容，触发一次覆盖请求
    if (Object.keys(selectedCategories.value).length > 0 && !categoryContent.value) {
      void fetchWithCategories();
    }
  },
);

const videoSourceUrl = computed(() => {
  const line = videoSource.value?.url ?? '';
  try {
    const url = new URL(line);
    return url.toString();
  } catch {
    return line;
  }
});

/** 显示用的缩略 URL（去掉协议头，超长截断） */
const videoSourceUrlShort = computed(() => {
  const raw = videoSourceUrl.value;
  if (!raw) {
    return '';
  }
  const stripped = raw.replace(/^https?:\/\//, '');
  return stripped.length > 72 ? stripped.slice(0, 72) + '…' : stripped;
});

type DetailRow = { label: string; value: string; isUrl?: boolean };

function pushRow(rows: DetailRow[], label: string, value: unknown, isUrl = false) {
  if (value === undefined || value === null || value === '') {
    return;
  }
  rows.push({ label, value: String(value), isUrl });
}

const detailRows = computed<DetailRow[]>(() => {
  const b = props.bookInfo;
  const rows: DetailRow[] = [];
  pushRow(rows, '实际播放地址', videoSourceUrl.value, true);
  pushRow(rows, '页面所在地址', pageUrl.value, true);
  pushRow(rows, '当前选集', activeChapter.value?.name);
  pushRow(
    rows,
    '选集序号',
    props.chapters.length ? `${props.activeChapterIndex + 1}/${props.chapters.length}` : '',
  );
  pushRow(rows, '视频标题', b?.name);
  pushRow(rows, '作者', b?.author);
  pushRow(rows, '书源名字', b?.sourceName);
  pushRow(rows, '书源文件', b?.fileName || props.fileName);
  pushRow(rows, '作品地址', b?.bookUrl, true);
  pushRow(rows, '分类标签', b?.kind);
  pushRow(rows, '状态', b?.status);
  pushRow(rows, '最新章节', b?.lastChapter || b?.latestChapter);
  pushRow(rows, '最新章节地址', b?.latestChapterUrl, true);
  pushRow(rows, '字数', b?.wordCount);
  pushRow(rows, '详情章节数', b?.chapterCount ? `${b.chapterCount} 章` : '');
  pushRow(rows, '目录章节数', b?.totalChapters ? `${b.totalChapters} 章` : '');
  pushRow(rows, '更新时间', b?.updateTime);
  pushRow(rows, '加入时间', formatTime(b?.addedAt));
  pushRow(rows, '最后阅读', formatTime(b?.lastReadAt));
  pushRow(rows, '播放流类型', videoSource.value?.type);
  pushRow(
    rows,
    '清晰度数量',
    videoSource.value?.qualities?.length ? `${videoSource.value.qualities.length} 个` : '',
  );
  pushRow(
    rows,
    '字幕数量',
    videoSource.value?.subtitles?.length ? `${videoSource.value.subtitles.length} 个` : '',
  );
  pushRow(
    rows,
    '请求头',
    videoSource.value?.headers && Object.keys(videoSource.value.headers).length
      ? JSON.stringify(videoSource.value.headers)
      : '',
  );
  return rows;
});

async function openExternalUrl(url: string) {
  if (!url) {
    return;
  }
  try {
    await openUrl(url);
  } catch {
    // 非标准 URL（如 m3u8 直链）时回退到复制
    navigator.clipboard.writeText(url).catch(() => {});
  }
}

// ── 播放结束处理（含 auto-next） ─────────────────────────────────────────

function handleEnded() {
  emit('ended');
  if (videoAutoNext.value && props.hasNext) {
    emit('next-chapter');
  }
}

// ── 键盘快捷键 ────────────────────────────────────────────────────────────

/**
 * 全局键盘快捷键（VideoPlayerPage 挂载期间生效）
 *
 * Space / K   ：播放 / 暂停
 * ← / J       ：快退 N 秒
 * → / L       ：快进 N 秒
 * Shift + ←   ：上一集
 * Shift + →   ：下一集
 * F           ：切换全屏
 * M           ：静音切换
 * ↑           ：音量 +10%
 * ↓           ：音量 -10%
 * Esc         ：退出全屏 / 关闭播放器
 */
function onKeydown(e: KeyboardEvent) {
  // 忽略输入框内的按键
  const target = e.target as HTMLElement;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
    return;
  }

  const videoRef = videoModeRef.value;
  const step = videoSeekStepSecs.value;

  switch (e.key) {
    case ' ':
    case 'k':
    case 'K':
      e.preventDefault();
      if (videoRef?.isPaused?.()) {
        videoRef.play?.();
      } else {
        videoRef?.pause?.();
      }
      break;

    case 'ArrowLeft':
      e.preventDefault();
      if (e.shiftKey) {
        if (props.hasPrev) {
          emit('prev-chapter');
        }
      } else {
        videoRef?.seek?.(-step);
      }
      break;

    case 'ArrowRight':
      e.preventDefault();
      if (e.shiftKey) {
        if (props.hasNext) {
          emit('next-chapter');
        }
      } else {
        videoRef?.seek?.(step);
      }
      break;

    case 'j':
    case 'J':
      e.preventDefault();
      videoRef?.seek?.(-step);
      break;

    case 'l':
    case 'L':
      e.preventDefault();
      videoRef?.seek?.(step);
      break;

    case 'f':
    case 'F':
      e.preventDefault();
      if (videoRef?.isFullscreen?.()) {
        videoRef.exitFullscreen?.();
      } else {
        videoRef?.enterFullscreen?.();
      }
      break;

    case 'm':
    case 'M': {
      e.preventDefault();
      const vol = videoRef?.getVolume?.() ?? 1;
      videoRef?.setVolume?.(vol > 0 ? 0 : 1);
      break;
    }

    case 'ArrowUp':
      e.preventDefault();
      videoRef?.setVolume?.(Math.min(1, (videoRef.getVolume?.() ?? 1) + 0.1));
      break;

    case 'ArrowDown':
      e.preventDefault();
      videoRef?.setVolume?.(Math.max(0, (videoRef.getVolume?.() ?? 1) - 0.1));
      break;

    case 'Escape':
      if (videoRef?.isFullscreen?.()) {
        e.preventDefault();
        videoRef.exitFullscreen?.();
      }
      break;
  }
}

onMounted(() => document.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown));

// ── 公开方法（供 ChapterReaderModal 获取播放进度） ────────────────────────

function getCurrentTime(): number {
  return videoModeRef.value?.getCurrentTime?.() ?? 0;
}

function getDuration(): number {
  return videoModeRef.value?.getDuration?.() ?? 0;
}

defineExpose({ getCurrentTime, getDuration });
</script>

<template>
  <div class="vp">
    <!-- ── 顶栏 ── -->
    <div class="vp__topbar">
      <n-button text circle class="vp__back-btn" @click="emit('close')">
        <template #icon>
          <ChevronLeft :size="20" :stroke-width="2.5" />
        </template>
      </n-button>
      <div class="vp__topbar-titles">
        <span class="vp__topbar-source" :title="sourceName">{{ sourceName }}</span>
      </div>

      <!-- 快捷键说明 -->
      <n-tooltip placement="bottom-end" :delay="400">
        <template #trigger>
          <n-button text circle class="vp__hotkey-btn">
            <template #icon>
              <Keyboard :size="16" />
            </template>
          </n-button>
        </template>
        <div class="vp__hotkey-tip">
          <table>
            <tbody>
              <tr>
                <td><kbd>Space</kbd> / <kbd>K</kbd></td>
                <td>播放 / 暂停</td>
              </tr>
              <tr>
                <td><kbd>←</kbd> / <kbd>J</kbd></td>
                <td>快退</td>
              </tr>
              <tr>
                <td><kbd>→</kbd> / <kbd>L</kbd></td>
                <td>快进</td>
              </tr>
              <tr>
                <td><kbd>Shift</kbd>+<kbd>←</kbd></td>
                <td>上一集</td>
              </tr>
              <tr>
                <td><kbd>Shift</kbd>+<kbd>→</kbd></td>
                <td>下一集</td>
              </tr>
              <tr>
                <td><kbd>F</kbd></td>
                <td>切换全屏</td>
              </tr>
              <tr>
                <td><kbd>M</kbd></td>
                <td>静音切换</td>
              </tr>
              <tr>
                <td><kbd>↑</kbd> / <kbd>↓</kbd></td>
                <td>音量调节</td>
              </tr>
              <tr>
                <td><kbd>Esc</kbd></td>
                <td>退出全屏 / 关闭</td>
              </tr>
            </tbody>
          </table>
        </div>
      </n-tooltip>
    </div>

    <!-- ── 主体（左列 + 右侧边栏） ── -->
    <div class="vp__body">
      <!-- 左 / 主列 -->
      <div class="vp__main">
        <div class="vp__content-titlebar">
          <div class="vp__info-heading">
            <div class="vp__info-title" :title="videoTitle">{{ videoTitle }}</div>
            <div class="vp__info-meta">
              <span v-if="bookInfo?.author" class="vp__info-author">{{ bookInfo.author }}</span>
              <span v-if="bookInfo?.kind" class="vp__info-pill">{{ bookInfo.kind }}</span>
              <span v-if="bookInfo?.status" class="vp__info-pill">{{ bookInfo.status }}</span>
              <span class="vp__info-pill">{{ sourceName }}</span>
            </div>
          </div>
          <div v-if="activeChapter" class="vp__info-episode" :title="activeChapter.name">
            {{ activeChapter.name }}
          </div>
        </div>

        <!-- 播放器容器（固定 16:9） -->
        <div class="vp__player-wrap">
          <div v-if="showPlayerLoading" class="vp__player-placeholder">
            <n-spin :show="true" />
            <span>获取播放地址…</span>
            <span v-if="!hasGroups" class="vp__loading-hint">正在加载线路列表，请稍候…</span>
          </div>
          <div v-else-if="error" class="vp__player-placeholder vp__player-placeholder--error">
            <n-alert type="error" :title="error" style="width: 90%; max-width: 420px">
              <p v-if="hasGroups" style="margin: 6px 0 8px; font-size: 0.875rem; opacity: 0.85">
                请尝试切换下方线路后重新播放
              </p>
              <n-button type="error" size="small" style="margin-top: 4px" @click="emit('retry')">
                重试
              </n-button>
            </n-alert>
          </div>
          <!-- 内容为空（脚本返回空地址）但未抛出错误时的兜底提示 -->
          <div v-else-if="!content" class="vp__player-placeholder vp__player-placeholder--error">
            <n-alert type="warning" title="无法获取播放地址" style="width: 90%; max-width: 420px">
              <p v-if="hasGroups" style="margin: 6px 0 8px; font-size: 0.875rem; opacity: 0.85">
                请尝试切换下方线路后重新播放
              </p>
              <n-button size="small" style="margin-top: 4px" @click="emit('retry')">
                重试
              </n-button>
            </n-alert>
          </div>
          <VideoMode
            v-else
            ref="videoModeRef"
            :content="activeContent"
            :file-name="fileName"
            :book-url="bookInfo?.bookUrl ?? ''"
            :chapter-url="activeChapter?.url ?? ''"
            :resume-time="resumeTime"
            @progress="(t, d) => emit('progress', t, d)"
            @ended="handleEnded"
            @next-chapter="emit('next-chapter')"
          />
          <!-- 分类切换中的加载遮罩 -->
          <div v-if="categoryFetching && !loading && !error" class="vp__category-fetching">
            <n-spin :show="true" />
            <span>切换中…</span>
          </div>
        </div>

        <div v-if="showPlayerLoading || loadingLogs.length" class="vp__load-log">
          <div class="vp__load-log-title">
            书源日志
            <n-button
              v-if="loadingLogs.length"
              text
              size="tiny"
              class="vp__log-copy-btn"
              :title="logCopied ? '已复制' : '复制日志'"
              @click="copyLogs"
            >
              <template #icon>
                <Check v-if="logCopied" :size="13" />
                <Copy v-else :size="13" />
              </template>
              {{ logCopied ? '已复制' : '复制' }}
            </n-button>
          </div>
          <div ref="logScrollRef" class="vp__load-log-body app-scrollbar app-scrollbar--thin">
            <div v-if="!loadingLogs.length" class="vp__load-log-empty">等待书源输出日志…</div>
            <div v-for="(line, i) in loadingLogs" :key="`${i}-${line}`" class="vp__load-log-line">
              {{ line }}
            </div>
          </div>
        </div>

        <!-- 线路标签（内嵌在视频下方，书架模式） -->
        <div v-if="props.inlineGroupTabs && hasGroups" class="vp__player-tabs">
          <button
            v-for="(g, gi) in groups"
            :key="g.name"
            class="vp__tab-btn"
            :class="{ 'vp__tab-btn--active': gi === activeGroupIndex }"
            @click="onGroupTabClick(gi)"
          >
            {{ g.name }}
            <span class="vp__tab-count">{{ g.chapters.length }}</span>
          </button>
        </div>

        <!-- 视频信息区 -->
        <div class="vp__info">
          <p v-if="bookInfo?.intro" class="vp__info-intro">{{ bookInfo.intro }}</p>

          <div class="vp__detail-list">
            <div v-for="row in detailRows" :key="row.label" class="vp__detail-row">
              <span class="vp__detail-label">{{ row.label }}</span>
              <a
                v-if="row.isUrl"
                class="vp__detail-value vp__detail-link"
                href="#"
                :title="row.value"
                @click.prevent="openExternalUrl(row.value)"
              >
                <Link :size="12" :stroke-width="2.3" class="vp__detail-icon" />
                <span>{{
                  row.label === '实际播放地址' ? videoSourceUrlShort || row.value : row.value
                }}</span>
              </a>
              <span v-else class="vp__detail-value" :title="row.value">{{ row.value }}</span>
            </div>
          </div>
        </div>

        <!-- 移动端选集区域（多集才显示，桌面端通过 CSS 隐藏） -->
        <div v-if="hasEpisodeList || availableCategories.length > 0" class="vp__strip">
          <!-- 通用分类面板（移动端） -->
          <div v-if="availableCategories.length > 0" class="vp__strip-categories">
            <div
              v-for="group in availableCategories"
              :key="group.id"
              class="vp__cat-group"
            >
              <div class="vp__cat-group-label">{{ group.label }}</div>
              <div class="vp__cat-options app-scrollbar--hidden">
                <button
                  v-for="opt in group.options"
                  :key="opt.id"
                  class="vp__cat-btn"
                  :class="{ 'vp__cat-btn--active': selectedCategories[group.id] === opt.id || (!selectedCategories[group.id] && group.defaultSelected === opt.id) }"
                  @click="onSelectCategoryOption(group.id, opt.id)"
                >
                  {{ opt.label }}
                  <span v-if="opt.badge" class="vp__cat-badge">{{ opt.badge }}</span>
                </button>
              </div>
            </div>
          </div>
          <div v-if="hasEpisodeList">
          <div class="vp__strip-header">
            <div class="vp__strip-label">
              选集
              <span class="vp__strip-count">{{ displayEpisodes.length }} 集</span>
            </div>
            <n-button text size="tiny" class="vp__sort-btn" @click="toggleVpSort">
              {{ sortOrder === 'asc' ? '正序' : '倒序' }}
              <ArrowUp
                :size="12"
                :style="{
                  transform: sortOrder === 'desc' ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s',
                }"
              />
            </n-button>
          </div>
          <!-- 分组标签 -->
          <div v-if="hasGroups && !props.inlineGroupTabs" class="vp__strip-tabs app-scrollbar--hidden">
            <button
              v-for="(g, gi) in groups"
              :key="g.name"
              class="vp__tab-btn"
              :class="{ 'vp__tab-btn--active': gi === activeGroupIndex }"
              @click="onGroupTabClick(gi)"
            >
              {{ g.name }}
              <span class="vp__tab-count">{{ g.chapters.length }}</span>
            </button>
          </div>
          <div class="vp__strip-scroll app-scrollbar--hidden">
            <button
              v-for="ch in displayEpisodes"
              :key="`${ch.group || ''}-${ch.url}`"
              class="vp__strip-btn"
              :class="{ 'vp__strip-btn--active': ch.url === activeChapter?.url }"
              @click="emitGotoChapter(ch)"
            >
              {{ ch.name }}
              <span v-if="isEpWatched(ch)" class="vp__ep-watched">已看</span>
              <div v-else-if="epProgressRatio(ch) > 0" class="vp__ep-bar">
                <div class="vp__ep-bar-fill" :style="{ width: (epProgressRatio(ch) * 100) + '%' }"></div>
              </div>
            </button>
          </div>
          </div>
        </div>
      </div>

      <!-- 桌面端右侧选集侧边栏（单集且无分类时整体隐藏） -->
      <div v-if="hasEpisodeList || availableCategories.length > 0" class="vp__sidebar">
        <!-- 通用分类面板（桌面端侧边栏） -->
        <div v-if="availableCategories.length > 0" class="vp__sidebar-categories">
          <div
            v-for="group in availableCategories"
            :key="group.id"
            class="vp__cat-group"
          >
            <div class="vp__cat-group-label">{{ group.label }}</div>
            <div class="vp__cat-options">
              <button
                v-for="opt in group.options"
                :key="opt.id"
                class="vp__cat-btn"
                :class="{ 'vp__cat-btn--active': selectedCategories[group.id] === opt.id || (!selectedCategories[group.id] && group.defaultSelected === opt.id) }"
                @click="onSelectCategoryOption(group.id, opt.id)"
              >
                {{ opt.label }}
                <span v-if="opt.badge" class="vp__cat-badge">{{ opt.badge }}</span>
              </button>
            </div>
          </div>
        </div>
        <template v-if="hasEpisodeList">
        <div class="vp__sidebar-header">
          <div class="vp__sidebar-heading">
            选集
            <span class="vp__sidebar-count">{{ displayEpisodes.length }} 集</span>
          </div>
          <n-button text size="tiny" class="vp__sort-btn" @click="toggleVpSort">
            {{ sortOrder === 'asc' ? '正序' : '倒序' }}
            <ArrowUp
              :size="12"
              :style="{
                transform: sortOrder === 'desc' ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s',
              }"
            />
          </n-button>
        </div>
        <div v-if="hasGroups && !props.inlineGroupTabs" class="vp__sidebar-tabs">
          <button
            v-for="(g, gi) in groups"
            :key="g.name"
            class="vp__tab-btn"
            :class="{ 'vp__tab-btn--active': gi === activeGroupIndex }"
            @click="onGroupTabClick(gi)"
          >
            {{ g.name }}
            <span class="vp__tab-count">{{ g.chapters.length }}</span>
          </button>
        </div>
        <div class="vp__sidebar-list app-scrollbar app-scrollbar--thin">
          <button
            v-for="(ch, i) in displayEpisodes"
            :key="`${ch.group || ''}-${ch.url}`"
            class="vp__sidebar-item"
            :class="{ 'vp__sidebar-item--active': ch.url === activeChapter?.url }"
            @click="emitGotoChapter(ch)"
          >
            <span class="vp__sidebar-idx">{{
              sortOrder === 'asc' ? i + 1 : displayEpisodes.length - i
            }}</span>
            <div class="vp__sidebar-meta">
              <span class="vp__sidebar-name">{{ ch.name }}</span>
              <span v-if="ch.url === activeChapter?.url" class="vp__sidebar-playing">正在播放</span>
              <span v-else-if="isEpWatched(ch)" class="vp__sidebar-watched">已看</span>
            </div>
            <div v-if="!isEpWatched(ch) && epProgressRatio(ch) > 0" class="vp__sidebar-progress">
              <div class="vp__sidebar-progress-fill" :style="{ width: (epProgressRatio(ch) * 100) + '%' }"></div>
            </div>
          </button>
        </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── 整页容器 ── */
.vp {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: var(--color-surface);
  color: var(--color-text-primary);
  overflow: hidden;
}

/* ── 顶栏 ── */
.vp__topbar {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 56px;
  padding: 0 12px 0 6px;
  flex-shrink: 0;
  background: var(--color-surface-raised);
  border-bottom: 1px solid var(--color-border);
}

.vp__back-btn {
  flex-shrink: 0;
}

.vp__topbar-titles {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1px;
}

.vp__topbar-book {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}

.vp__topbar-source {
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}

.vp__hotkey-btn {
  flex-shrink: 0;
  color: var(--color-text-muted);
  opacity: 0.7;
  transition: opacity var(--transition-fast);
}

.vp__hotkey-btn:hover {
  opacity: 1;
}

.vp__hotkey-tip table {
  border-collapse: collapse;
  font-size: 0.78rem;
}

.vp__hotkey-tip tr td:first-child {
  padding-right: 14px;
  white-space: nowrap;
  padding-bottom: 4px;
  opacity: 0.85;
}

.vp__hotkey-tip kbd {
  display: inline-block;
  padding: 1px 5px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.1);
  font-size: 0.72rem;
  font-family: inherit;
}

/* ── 主体（flex 容器，mobile=column，desktop=row） ── */
.vp__body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── 左/主列 ── */
.vp__main {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.vp__content-titlebar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px 12px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
  background: var(--color-surface);
}

/* ── 播放器容器（保持 16:9） ── */
.vp__player-wrap {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #000;
  flex-shrink: 0;
  position: relative;
}

.vp__player-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.875rem;
}

.vp__player-placeholder--error {
  background: rgba(0, 0, 0, 0.6);
}

.vp__loading-hint {
  font-size: 0.75rem;
  opacity: 0.6;
  margin-top: -4px;
}

.vp__load-log {
  display: flex;
  flex-direction: column;
  min-height: 96px;
  max-height: 160px;
  border-bottom: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface-raised) 82%, #000 18%);
  flex-shrink: 0;
}

.vp__load-log-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px 5px 16px;
  color: var(--color-text-muted);
  font-size: 0.75rem;
  font-weight: 600;
}

.vp__log-copy-btn {
  color: var(--color-text-muted);
  font-size: 0.72rem;
  gap: 3px;
  opacity: 0.75;
  transition: opacity var(--transition-fast);
}

.vp__log-copy-btn:hover {
  opacity: 1;
}

.vp__load-log-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0 16px 10px;
  font-family: ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', monospace;
  font-size: 0.72rem;
  line-height: 1.5;
}

.vp__load-log-line {
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--color-text-secondary, var(--color-text-primary));
}

.vp__load-log-empty {
  color: var(--color-text-muted);
}

/* ── 信息区 ── */
.vp__info {
  padding: 14px 16px 16px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.vp__info-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.vp__info-heading {
  flex: 1;
  min-width: 0;
}

.vp__info-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 6px;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vp__info-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.vp__info-author {
  color: var(--color-text-secondary, var(--color-text-muted));
}

.vp__info-pill {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  max-width: 100%;
  padding: 0 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xs, 4px);
  background: var(--color-surface-raised);
  color: var(--color-text-muted);
  font-size: 0.75rem;
  line-height: 1.3;
}

.vp__info-episode {
  flex-shrink: 0;
  max-width: min(34vw, 260px);
  padding-top: 2px;
  color: var(--color-text-muted);
  font-size: 0.8125rem;
  line-height: 1.4;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vp__info-intro {
  margin: 10px 0 0;
  font-size: 0.8125rem;
  color: var(--color-text-secondary, var(--color-text-muted));
  line-height: 1.65;
  white-space: pre-wrap;
}

.vp__detail-list {
  display: grid;
  grid-template-columns: minmax(92px, 128px) minmax(0, 1fr);
  gap: 1px 12px;
  margin-top: 14px;
  border-top: 1px solid var(--color-border);
  padding-top: 10px;
}

.vp__detail-row {
  display: contents;
}

.vp__detail-label,
.vp__detail-value {
  min-width: 0;
  padding: 5px 0;
  font-size: 0.765rem;
  line-height: 1.45;
}

.vp__detail-label {
  color: var(--color-text-muted);
  white-space: nowrap;
}

.vp__detail-value {
  color: var(--color-text-secondary, var(--color-text-primary));
  word-break: break-all;
}

.vp__detail-link {
  display: inline-flex;
  align-items: flex-start;
  gap: 4px;
  color: var(--color-accent);
  text-decoration: none;
}

.vp__detail-link:hover {
  text-decoration: underline;
}

.vp__detail-icon {
  flex-shrink: 0;
  margin-top: 2px;
}

/* ── 视频下方内嵌线路标签（书架模式） ── */
.vp__player-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 14px 16px 8px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
  flex-shrink: 0;
  overflow: visible;
}

/* ── 移动端选集区域 ── */
.vp__strip {
  flex-shrink: 0;
  padding: 10px 0 12px;
  border-bottom: 1px solid var(--color-border);
}

.vp__strip-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 8px;
}

.vp__strip-label {
  display: flex;
  align-items: baseline;
  gap: 5px;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--color-text-primary);
}

.vp__strip-count {
  font-size: 0.72rem;
  font-weight: 400;
  color: var(--color-text-muted);
}

.vp__strip-tabs {
  display: flex;
  gap: 6px;
  padding: 8px 16px 8px;
  overflow-x: auto;
  overflow-y: visible;
}

.vp__strip-scroll {
  display: flex;
  gap: 8px;
  padding: 0 16px;
  overflow-x: auto;
}

.vp__strip-btn {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  height: 40px;
  padding: 0 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-raised);
  color: var(--color-text-primary);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast);
}

.vp__strip-btn:hover {
  border-color: var(--color-accent);
}

.vp__strip-btn--active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: #fff;
  font-weight: 700;
}

/* 集数条进度指示器 */
.vp__ep-watched {
  display: block;
  font-size: 0.625rem;
  color: var(--color-accent);
  line-height: 1;
  margin-top: 2px;
}

.vp__ep-bar {
  height: 2px;
  margin-top: 3px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 1px;
  overflow: hidden;
}

.vp__ep-bar-fill {
  height: 100%;
  background: var(--color-accent);
  border-radius: 1px;
}

/* ── 共用标签按钮（移动端 strip + 桌面端 sidebar 复用） ── */
.vp__tab-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  padding: 4px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-raised);
  color: var(--color-text-primary);
  font-size: 0.8125rem;
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast);
}

.vp__tab-btn:hover {
  border-color: var(--color-accent);
}

.vp__tab-btn--active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: #fff;
  font-weight: 600;
}

.vp__tab-count {
  position: absolute;
  top: -7px;
  right: -7px;
  min-width: 16px;
  height: 16px;
  padding: 0 3px;
  border-radius: 8px;
  background: var(--color-text-muted);
  color: var(--color-surface);
  font-size: 0.5625rem;
  font-weight: 600;
  line-height: 16px;
  text-align: center;
  pointer-events: none;
  white-space: nowrap;
}

.vp__tab-btn--active .vp__tab-count {
  background: rgba(255, 255, 255, 0.85);
  color: var(--color-accent);
}

/* ── 排序按钮 ── */
.vp__sort-btn {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  cursor: pointer;
}

/* ── 桌面端侧边栏（移动端不显示） ── */
.vp__sidebar {
  display: none;
}

/* ────────────────────────────────────────────────────
   桌面端布局（≥ 768px）
   ─────────────────────────────────────────────────── */
@media (min-width: 768px) {
  .vp__body {
    flex-direction: row;
  }

  .vp__main {
    overflow-y: auto;
  }

  /* 移动端横条在桌面隐藏 */
  .vp__strip {
    display: none;
  }

  /* 侧边栏显现 */
  .vp__sidebar {
    display: flex;
    flex-direction: column;
    width: 300px;
    flex-shrink: 0;
    border-left: 1px solid var(--color-border);
    background: var(--color-surface-raised);
    overflow: hidden;
  }

  .vp__sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .vp__sidebar-heading {
    display: flex;
    align-items: baseline;
    gap: 6px;
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--color-text-primary);
    letter-spacing: 0;
  }

  .vp__sidebar-count {
    font-size: 0.75rem;
    font-weight: 400;
    color: var(--color-text-muted);
  }

  .vp__sidebar-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 8px 16px;
    flex-shrink: 0;
    border-bottom: 1px solid var(--color-border);
  }

  .vp__sidebar-list {
    flex: 1;
    overflow-y: auto;
  }

  .vp__sidebar-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    position: relative;
    width: 100%;
    padding: 11px 16px;
    border: none;
    border-bottom: 1px solid var(--color-border);
    background: transparent;
    color: var(--color-text-primary);
    cursor: pointer;
    text-align: left;
    transition: background var(--transition-fast);
  }

  .vp__sidebar-item:last-child {
    border-bottom: none;
  }

  .vp__sidebar-item:hover {
    background: color-mix(in srgb, var(--color-accent) 6%, var(--color-surface));
  }

  .vp__sidebar-item--active {
    background: color-mix(in srgb, var(--color-accent) 12%, transparent);
  }

  .vp__sidebar-idx {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-xs, 4px);
    background: var(--color-surface);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--color-text-muted);
    margin-top: 1px;
    transition:
      background var(--transition-fast),
      color var(--transition-fast);
  }

  .vp__sidebar-item--active .vp__sidebar-idx {
    background: var(--color-accent);
    color: #fff;
  }

  .vp__sidebar-meta {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .vp__sidebar-name {
    font-size: 0.8125rem;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text-primary);
  }

  .vp__sidebar-item--active .vp__sidebar-name {
    color: var(--color-accent);
    font-weight: 600;
  }

  .vp__sidebar-playing {
    font-size: 0.6875rem;
    color: var(--color-accent);
    font-weight: 500;
  }

  .vp__sidebar-watched {
    font-size: 0.6875rem;
    color: var(--color-text-tertiary);
  }

  .vp__sidebar-progress {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: rgba(128, 128, 128, 0.2);
    overflow: hidden;
  }

  .vp__sidebar-progress-fill {
    height: 100%;
    background: var(--color-accent);
    border-radius: 0;
  }
}

@media (max-width: 520px) {
  .vp__content-titlebar {
    flex-direction: column;
    gap: 6px;
  }

  .vp__info-title {
    white-space: normal;
  }

  .vp__info-episode {
    max-width: 100%;
    text-align: left;
  }

  .vp__detail-list {
    grid-template-columns: 1fr;
    gap: 0;
  }

  .vp__detail-label {
    padding-bottom: 1px;
  }

  .vp__detail-value {
    padding-top: 0;
    padding-bottom: 7px;
  }
}

/* ── 通用分类系统 ── */
.vp__category-fetching {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(0, 0, 0, 0.55);
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.8rem;
  pointer-events: none;
}

/* 侧边栏分类区域 */
.vp__sidebar-categories {
  padding: 10px 12px 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 10px;
}

/* 移动端 strip 分类区域 */
.vp__strip-categories {
  padding: 10px 14px 6px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-bottom: 1px solid var(--color-border);
}

/* 分类维度通用 */
.vp__cat-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.vp__cat-group-label {
  font-size: 0.72rem;
  color: var(--color-text-muted);
  font-weight: 500;
  letter-spacing: 0.02em;
}

.vp__cat-options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* 桌面端移动端共用的分类选项按钮 */
.vp__cat-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 4px;
  border: 1px solid var(--color-border);
  background: var(--color-surface-raised);
  color: var(--color-text-primary);
  font-size: 0.78rem;
  cursor: pointer;
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast);
  white-space: nowrap;
}

.vp__cat-btn:hover {
  background: var(--color-surface-raised2, var(--color-surface-raised));
  border-color: var(--color-accent);
}

.vp__cat-btn--active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: #fff;
  font-weight: 600;
}

.vp__cat-badge {
  font-size: 0.65rem;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  padding: 0 3px;
  line-height: 1.4;
}

.vp__cat-btn--active .vp__cat-badge {
  background: rgba(255, 255, 255, 0.25);
}
</style>
