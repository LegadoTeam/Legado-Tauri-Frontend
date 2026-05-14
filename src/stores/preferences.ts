/**
 * usePreferencesStore — 前端 UI 偏好配置统一管理
 *
 * 统一管理原本分散在各 composable 中的前端偏好配置：
 * - 阅读器默认设置（字体、行距、主题等）
 * - 各视图卡片密度
 * - 搜索偏好（默认书源等）
 *
 * 底层持久化走 useDynamicConfig。
 */
import { defineStore } from 'pinia';
import { reactive, readonly } from 'vue';
import { useDynamicConfig } from '@/composables/useDynamicConfig';

// ── 阅读器偏好设置 ───────────────────────────────────────────────────────

export interface ReaderPreferences {
  /** 字体大小（px） */
  fontSize: number;
  /** 行高倍数 */
  lineHeight: number;
  /** 段落间距（px） */
  paragraphSpacing: number;
  /** 左右内边距（px） */
  paddingH: number;
  /** 主题 ID */
  themePresetId: string;
  /** 背景预设 ID */
  backgroundPresetId: string;
  /** 背景图片 URL */
  backgroundImage: string;
  /** 翻页模式："scroll" | "page" */
  pageMode: string;
  /** 自动繁简转换模式 */
  chineseConvert: '' | 's2t' | 's2tw' | 's2hk' | 't2s' | 'tw2s' | 'hk2s';
}

// ── 视图卡片密度 ──────────────────────────────────────────────────────────

export type ViewDensityMode = 'compact' | 'normal' | 'comfortable';

export interface ViewDensityPreferences {
  bookshelf: ViewDensityMode;
  search: ViewDensityMode;
  explore: ViewDensityMode;
}

// ── 目录自动更新偏好 ─────────────────────────────────────────────────────

export interface TocAutoUpdatePreferences {
  /** 是否启用自动更新目录，默认 false */
  enabled: boolean;
  /** 每次打开图书时自动检测 */
  onBookOpen: boolean;
  /** 每次启动 App 时自动检测所有书籍 */
  onAppStart: boolean;
  /** 切换到书架视图时自动检测所有书籍 */
  onShelfView: boolean;
  /** 两次自动检测的最小间隔（秒），默认 7200（2 小时） */
  minIntervalSecs: number;
}

// ── 开发者工具偏好 ───────────────────────────────────────────────────────

export interface DevToolsPreferences {
  /** 是否启用 vConsole 调试面板 */
  vConsoleEnabled: boolean;
}

// ── 搜索偏好 ──────────────────────────────────────────────────────────────

export interface SearchPreferences {
  /** 最近使用的搜索书源 fileName，null 表示全部 */
  lastSourceFileName: string | null;
  /** 每源最多展示结果数 */
  maxResultsPerSource: number;
  /** 搜索并发数（同时向多少个书源发起搜索），默认 5 */
  searchConcurrency: number;
  /** 换源搜索并发数，默认 5 */
  switchSourceConcurrency: number;
  /** 单次搜索超时（秒），默认 35 */
  searchTimeoutSecs: number;
  /** 发现页加载超时（秒），默认 35 */
  exploreTimeoutSecs: number;
  /** 目录/章节列表超时（秒），默认 125 */
  chapterListTimeoutSecs: number;
  /** 章节正文超时（秒），默认 35 */
  chapterContentTimeoutSecs: number;
}

// ── Store ─────────────────────────────────────────────────────────────────

export const usePreferencesStore = defineStore('preferences', () => {
  const readerConfig = useDynamicConfig<ReaderPreferences>({
    namespace: 'preferences.reader',
    version: 1,
    defaults: () => ({
      fontSize: 18,
      lineHeight: 1.75,
      paragraphSpacing: 12,
      paddingH: 20,
      themePresetId: '',
      backgroundPresetId: '',
      backgroundImage: '',
      pageMode: 'scroll',
      chineseConvert: '',
    }),
  });

  const densityConfig = useDynamicConfig<ViewDensityPreferences>({
    namespace: 'preferences.viewDensity',
    version: 1,
    defaults: () => ({
      bookshelf: 'normal',
      search: 'normal',
      explore: 'normal',
    }),
  });

  const tocAutoUpdateConfig = useDynamicConfig<TocAutoUpdatePreferences>({
    namespace: 'preferences.tocAutoUpdate',
    version: 1,
    defaults: () => ({
      enabled: false,
      onBookOpen: false,
      onAppStart: false,
      onShelfView: false,
      minIntervalSecs: 7200,
    }),
  });

  const devToolsConfig = useDynamicConfig<DevToolsPreferences>({
    namespace: 'preferences.devTools',
    version: 1,
    defaults: () => ({
      vConsoleEnabled: false,
    }),
  });

  const searchConfig = useDynamicConfig<SearchPreferences>({
    namespace: 'preferences.search',
    version: 1,
    defaults: () => ({
      lastSourceFileName: null,
      maxResultsPerSource: 20,
      searchConcurrency: 5,
      switchSourceConcurrency: 5,
      searchTimeoutSecs: 35,
      exploreTimeoutSecs: 35,
      chapterListTimeoutSecs: 125,
      chapterContentTimeoutSecs: 35,
    }),
  });

  // ── 目录自动更新 Actions ──────────────────────────────────────────────

  function patchTocAutoUpdate(patch: Partial<TocAutoUpdatePreferences>) {
    tocAutoUpdateConfig.replace({ ...tocAutoUpdateConfig.state, ...patch });
  }

  // ── 阅读器偏好 Actions ────────────────────────────────────────────────

  async function patchReader(patch: Partial<ReaderPreferences>) {
    readerConfig.replace({ ...readerConfig.state, ...patch });
  }

  async function resetReader() {
    readerConfig.reset();
  }

  // ── 视图密度 Actions ──────────────────────────────────────────────────

  function setViewDensity(view: keyof ViewDensityPreferences, mode: ViewDensityMode) {
    densityConfig.replace({ ...densityConfig.state, [view]: mode });
  }

  // ── 搜索偏好 Actions ──────────────────────────────────────────────────

  function setLastSearchSource(fileName: string | null) {
    searchConfig.replace({ ...searchConfig.state, lastSourceFileName: fileName });
  }

  function patchSearch(patch: Partial<SearchPreferences>) {
    searchConfig.replace({ ...searchConfig.state, ...patch });
  }

  // ── 开发者工具 Actions ──────────────────────────────────────────────

  function patchDevTools(patch: Partial<DevToolsPreferences>) {
    devToolsConfig.replace({ ...devToolsConfig.state, ...patch });
  }

  // ── ready 状态（等待所有后端存储加载完成） ────────────────────────────

  const ready = Promise.all([readerConfig.ready, densityConfig.ready, searchConfig.ready, tocAutoUpdateConfig.ready, devToolsConfig.ready]).then(
    () => undefined,
  );

  return {
    // 阅读器偏好
    reader: readonly(readerConfig.state) as ReaderPreferences,
    patchReader,
    resetReader,
    // 目录自动更新
    tocAutoUpdate: readonly(tocAutoUpdateConfig.state) as TocAutoUpdatePreferences,
    patchTocAutoUpdate,
    // 视图密度
    viewDensity: readonly(densityConfig.state) as ViewDensityPreferences,
    setViewDensity,
    // 搜索偏好
    search: readonly(searchConfig.state) as SearchPreferences,
    setLastSearchSource,
    patchSearch,
    // 开发者工具偏好
    devTools: readonly(devToolsConfig.state) as DevToolsPreferences,
    patchDevTools,
    // 就绪状态
    ready,
  };
});
