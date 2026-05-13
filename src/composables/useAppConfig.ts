/**
 * useAppConfig — 应用级全局配置管理（单例）
 *
 * 封装 Rust 后端 `app_config` 模块的全部 Tauri 命令，提供响应式配置状态。
 * 全局单例模式，可在任意组件中 `const cfg = useAppConfig()` 使用。
 *
 * 与 `script_config` 的区别：
 * - `app_config`：应用级设置（HTTP UA、超时、UI 开关等），全局唯一
 * - `script_config`：脚本级键值持久化，按 scope 隔离
 */

import { ref, computed } from 'vue';
import { eventListenSync } from './useEventBus';
import { invokeWithTimeout } from './useInvoke';
import { isTransportAvailable } from './useTransport';

// ── 类型定义（与 Rust AppConfig 结构体对齐） ─────────────────────────────

export interface AppConfig {
  http_user_agent: string;
  http_follow_redirects: boolean;
  http_connect_timeout_secs: number;
  /** 是否忽略 TLS 证书错误（Android 兼容性开关，重启后生效） */
  http_ignore_tls_errors: boolean;
  /** 代理模式："system"（系统代理）| "none"（无代理）| "custom"（自定义），修改后需重启 */
  proxy_mode: string;
  /** 代理协议类型（仅 proxy_mode=custom 时生效）："http" | "socks5" */
  proxy_type: string;
  /** 代理服务器主机名或 IP */
  proxy_host: string;
  /** 代理服务器端口 */
  proxy_port: number;
  /** 代理认证用户名（可为空） */
  proxy_username: string;
  /** 代理认证密码（可为空） */
  proxy_password: string;
  engine_timeout_secs: number;
  /** 书源目录监听开关（全平台统一，重启后生效） */
  booksource_watcher_enabled: boolean;
  browser_probe_enabled: boolean;
  browser_probe_user_agent: string;
  browser_probe_timeout_secs: number;
  browser_probe_visible_by_default: boolean;
  browser_probe_force_visible: boolean;
  browser_probe_persist_profile: boolean;
  comic_cache_enabled: boolean;
  /** 布局模式："auto" | "mobile" | "desktop" */
  ui_layout_mode: string;
  /** UI 主题模式："auto" | "light" | "dark" */
  ui_theme: string;
  /** Windows 主窗口上次退出时的逻辑宽度，0 表示未记录 */
  windows_main_window_width: number;
  /** Windows 主窗口上次退出时的逻辑高度，0 表示未记录 */
  windows_main_window_height: number;
  /** 默认视频播放器："videojs" | "xgplayer" | "dplayer" */
  video_player_type: string;
  /** 默认播放速率（0.25 ~ 3.0） */
  video_default_rate: number;
  /** 播放结束后是否自动播放下一集 */
  video_auto_next: boolean;
  /** 默认画质偏好："auto" | "highest" | "lowest" */
  video_quality_prefer: string;
  /** 是否记忆视频播放进度 */
  video_remember_progress: boolean;
  /** 键盘快捷键快进/快退步长（秒） */
  video_seek_step_secs: number;
  /** video.js 预加载: "auto" | "metadata" | "none" */
  video_vjs_preload: string;
  /** video.js 画中画按钮 */
  video_vjs_pip: boolean;
  /** xgplayer 下载按钮 */
  video_xg_download: boolean;
  /** DPlayer 弹幕 */
  video_dp_danmaku: boolean;
  /** DPlayer 主题色 */
  video_dp_theme: string;
  /** 打开视频后是否自动开始播放 */
  video_autoplay: boolean;
  /** 是否启用 WebSocket 服务器（B/S 模式） */
  web_server_enabled: boolean;
  /** WebSocket 服务器监听端口 */
  web_server_port: number;
  /** Web 服务器静态文件目录（Vue 构建产物），空字符串表示不提供静态文件服务 */
  web_server_dist_path: string;
  /** 全局最小请求间隔（毫秒），0 = 不限制 */
  request_min_delay_ms: number;
  /** 自动预缓存章节数，0 = 关闭，-1 = 全部缓存 */
  cache_prefetch_count: number;
  /** 阅读时静默预缓存并发数（1 = 顺序） */
  cache_prefetch_concurrency: number;
  /** 导出时强制缓存并发数（1 = 顺序） */
  export_prefetch_concurrency: number;
  sync_enabled: boolean;
  sync_provider: string;
  sync_profile_id: string;
  sync_webdav_url: string;
  sync_webdav_username: string;
  sync_webdav_root_dir: string;
  sync_webdav_allow_http: boolean;
  sync_trigger_enabled: boolean;
  sync_timer_enabled: boolean;
  sync_timer_interval_secs: number;
  sync_trigger_on_startup: boolean;
  sync_trigger_on_resume: boolean;
  sync_trigger_on_unlock_resume: boolean;
  sync_trigger_on_bookshelf_change: boolean;
  sync_trigger_on_booksource_change: boolean;
  sync_trigger_on_settings_change: boolean;
  sync_scope_bookshelf: boolean;
  sync_scope_reading_progress: boolean;
  sync_scope_booksources: boolean;
  sync_scope_reader_settings: boolean;
  sync_scope_app_settings: boolean;
  sync_scope_source_flags: boolean;
  sync_scope_extensions: boolean;
  sync_scope_script_config: boolean;
  sync_mobile_foreground_only: boolean;
  sync_mobile_screen_on_only: boolean;
  sync_mobile_wifi_only: boolean;
  sync_mobile_pause_on_low_battery: boolean;
  sync_mobile_startup_delay_ms: number;
  sync_mobile_resume_delay_ms: number;
  sync_baidu_app_name: string;
}

/** 内置默认 User-Agent（与 Rust BUILTIN_USER_AGENT 保持一致） */
export const BUILTIN_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ── 全局状态（单例） ──────────────────────────────────────────────────────

const config = ref<AppConfig>({
  http_user_agent: BUILTIN_USER_AGENT,
  http_follow_redirects: true,
  http_connect_timeout_secs: 10,
  http_ignore_tls_errors: true,
  proxy_mode: 'system',
  proxy_type: 'http',
  proxy_host: '',
  proxy_port: 0,
  proxy_username: '',
  proxy_password: '',
  engine_timeout_secs: 30,
  booksource_watcher_enabled: false,
  browser_probe_enabled: true,
  browser_probe_user_agent: '',
  browser_probe_timeout_secs: 0,
  browser_probe_visible_by_default: false,
  browser_probe_force_visible: false,
  browser_probe_persist_profile: true,
  comic_cache_enabled: true,
  ui_layout_mode: 'auto',
  ui_theme: 'auto',
  ui_enable_aplus_tracking: true,
  windows_main_window_width: 0,
  windows_main_window_height: 0,
  video_player_type: 'videojs',
  video_default_rate: 1.0,
  video_auto_next: true,
  video_quality_prefer: 'auto',
  video_remember_progress: true,
  video_seek_step_secs: 10,
  video_vjs_preload: 'auto',
  video_vjs_pip: true,
  video_xg_download: false,
  video_dp_danmaku: false,
  video_dp_theme: '#00b1ff',
  video_autoplay: false,
  web_server_enabled: false,
  web_server_port: 7688,
  web_server_dist_path: '',
  request_min_delay_ms: 300,
  cache_prefetch_count: 3,
  cache_prefetch_concurrency: 2,
  export_prefetch_concurrency: 3,
  sync_enabled: false,
  sync_provider: 'webdav',
  sync_profile_id: 'default',
  sync_webdav_url: '',
  sync_webdav_username: '',
  sync_webdav_root_dir: 'legado-sync',
  sync_webdav_allow_http: false,
  sync_trigger_enabled: true,
  sync_timer_enabled: false,
  sync_timer_interval_secs: 900,
  sync_trigger_on_startup: true,
  sync_trigger_on_resume: true,
  sync_trigger_on_unlock_resume: true,
  sync_trigger_on_bookshelf_change: false,
  sync_trigger_on_booksource_change: false,
  sync_trigger_on_settings_change: false,
  sync_scope_bookshelf: true,
  sync_scope_reading_progress: true,
  sync_scope_booksources: true,
  sync_scope_reader_settings: true,
  sync_scope_app_settings: true,
  sync_scope_source_flags: false,
  sync_scope_extensions: false,
  sync_scope_script_config: false,
  sync_mobile_foreground_only: true,
  sync_mobile_screen_on_only: true,
  sync_mobile_wifi_only: true,
  sync_mobile_pause_on_low_battery: true,
  sync_mobile_startup_delay_ms: 5000,
  sync_mobile_resume_delay_ms: 1500,
  sync_baidu_app_key: '',
  sync_baidu_app_name: 'legado-tauri',
});

/** 正在保存中的配置 key（用于 UI loading 状态） */
const savingKey = ref<string | null>(null);

let initialized = false;

const TIMEOUT = 10_000;

// ── 导出 ──────────────────────────────────────────────────────────────────

export function useAppConfig() {
  /** 从后端加载完整配置 */
  async function loadConfig(): Promise<AppConfig> {
    const available = await isTransportAvailable();
    if (!available) {
      initialized = true;
      return config.value;
    }

    const cfg = await invokeWithTimeout<AppConfig>('app_config_get_all', undefined, TIMEOUT);
    config.value = cfg;
    initialized = true;
    return cfg;
  }

  /** 确保已初始化（首次调用会加载） */
  async function ensureLoaded() {
    if (!initialized) {
      await loadConfig();
    }
  }

  /**
   * 设置单个配置项并持久化
   *
   * @param key   配置字段名（如 `"http_user_agent"`）
   * @param value 字符串值（布尔用 `"true"/"false"`，数字用整数字符串）
   */
  async function setConfig(key: string, value: string): Promise<void> {
    savingKey.value = key;
    try {
      await invokeWithTimeout<void>('app_config_set', { key, value }, TIMEOUT);
      await loadConfig();
    } finally {
      savingKey.value = null;
    }
  }

  /** 重置单个配置项为内置默认值并持久化 */
  async function resetConfig(key: string): Promise<void> {
    savingKey.value = key;
    try {
      await invokeWithTimeout<void>('app_config_reset', { key }, TIMEOUT);
      await loadConfig();
    } finally {
      savingKey.value = null;
    }
  }

  // ── Computed getters（方便组件直接读取） ──────────────────────────────

  const httpUserAgent = computed(() => config.value.http_user_agent);
  const httpFollowRedirects = computed(() => config.value.http_follow_redirects);
  const httpConnectTimeoutSecs = computed(() => config.value.http_connect_timeout_secs);
  const engineTimeoutSecs = computed(() => config.value.engine_timeout_secs);
  const booksourceWatcherEnabled = computed(() => config.value.booksource_watcher_enabled);
  const browserProbeEnabled = computed(() => config.value.browser_probe_enabled);
  const browserProbeUserAgent = computed(() => config.value.browser_probe_user_agent);
  const browserProbeTimeoutSecs = computed(() => config.value.browser_probe_timeout_secs);
  const browserProbeVisibleByDefault = computed(
    () => config.value.browser_probe_visible_by_default,
  );
  const browserProbeForceVisible = computed(() => config.value.browser_probe_force_visible);
  const browserProbePersistProfile = computed(() => config.value.browser_probe_persist_profile);
  const comicCacheEnabled = computed(() => config.value.comic_cache_enabled);
  const uiLayoutMode = computed(() => config.value.ui_layout_mode);
  const uiTheme = computed(() => config.value.ui_theme);
  const uiEnableAplusTracking = computed(() => config.value.ui_enable_aplus_tracking);
  const videoPlayerType = computed(() => config.value.video_player_type);
  const videoDefaultRate = computed(() => config.value.video_default_rate);
  const videoAutoNext = computed(() => config.value.video_auto_next);
  const videoQualityPrefer = computed(() => config.value.video_quality_prefer);
  const videoRememberProgress = computed(() => config.value.video_remember_progress);
  const videoSeekStepSecs = computed(() => config.value.video_seek_step_secs);
  const videoVjsPreload = computed(() => config.value.video_vjs_preload);
  const videoVjsPip = computed(() => config.value.video_vjs_pip);
  const videoXgDownload = computed(() => config.value.video_xg_download);
  const videoDpDanmaku = computed(() => config.value.video_dp_danmaku);
  const videoDpTheme = computed(() => config.value.video_dp_theme);
  const videoAutoplay = computed(() => config.value.video_autoplay);

  return {
    /** 完整配置对象（响应式） */
    config,
    /** 正在保存的 key（用于 loading 状态展示） */
    savingKey,

    loadConfig,
    ensureLoaded,
    setConfig,
    resetConfig,

    // computed getters
    httpUserAgent,
    httpFollowRedirects,
    httpConnectTimeoutSecs,
    engineTimeoutSecs,
    booksourceWatcherEnabled,
    browserProbeEnabled,
    browserProbeUserAgent,
    browserProbeTimeoutSecs,
    browserProbeVisibleByDefault,
    browserProbeForceVisible,
    browserProbePersistProfile,
    comicCacheEnabled,
    uiLayoutMode,
    uiTheme,
    uiEnableAplusTracking,
    videoPlayerType,
    videoDefaultRate,
    videoAutoNext,
    videoQualityPrefer,
    videoRememberProgress,
    videoSeekStepSecs,
    videoVjsPreload,
    videoVjsPip,
    videoXgDownload,
    videoDpDanmaku,
    videoDpTheme,
    videoAutoplay,
  };
}

/**
 * 监听后端发出的 app_config:changed 事件（如同步完成后），自动重新加载全局配置。
 * 应在应用启动时调用一次（App.vue onMounted）。
 */
export function installAppConfigChangedListener(): () => void {
  return eventListenSync('app_config:changed', () => {
    const { loadConfig } = useAppConfig();
    void loadConfig();
  });
}
