import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { BUILTIN_USER_AGENT, type AppConfig } from '@/composables/useAppConfig';
import { eventListenSync } from '@/composables/useEventBus';
import { invokeWithTimeout } from '@/composables/useInvoke';
import { isTransportAvailable } from '@/composables/useTransport';

const TIMEOUT = 10_000;

const DEFAULT_CONFIG: AppConfig = {
  http_user_agent: BUILTIN_USER_AGENT,
  http_follow_redirects: true,
  http_connect_timeout_secs: 10,
  http_ignore_tls_errors: true,
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
  ui_enable_eruda: false,
  windows_main_window_width: 0,
  windows_main_window_height: 0,
  video_player_type: 'xgplayer',
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
  video_autoplay: true,
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
  sync_baidu_app_name: 'legado-tauri',
};

export const useAppConfigStore = defineStore('appConfig', () => {
  const config = ref<AppConfig>({ ...DEFAULT_CONFIG });
  const savingKey = ref<string | null>(null);
  const ready = ref(false);
  let configChangeUnlisten: (() => void) | null = null;

  /** 从后端加载完整配置 */
  async function loadConfig(): Promise<AppConfig> {
    const available = await isTransportAvailable();
    if (!available) {
      ready.value = true;
      return config.value;
    }
    const cfg = await invokeWithTimeout<AppConfig>('app_config_get_all', undefined, TIMEOUT);
    config.value = cfg;
    ready.value = true;
    return cfg;
  }

  /** 确保已初始化（首次调用会加载） */
  async function ensureLoaded() {
    if (!ready.value) {
      await loadConfig();
    }
  }

  /** 设置单个配置项并持久化 */
  async function setConfig(key: string, value: unknown): Promise<void> {
    savingKey.value = key;
    try {
      await invokeWithTimeout<void>('app_config_set', { key, value }, TIMEOUT);
      await loadConfig();
    } finally {
      savingKey.value = null;
    }
  }

  /** 重置单个配置项为内置默认值 */
  async function resetConfig(key: string): Promise<void> {
    savingKey.value = key;
    try {
      await invokeWithTimeout<void>('app_config_reset', { key }, TIMEOUT);
      await loadConfig();
    } finally {
      savingKey.value = null;
    }
  }

  /**
   * 安装后端 app_config:changed 事件监听（如同步完成后自动重载配置）。
   * 应在应用启动时调用一次。
   */
  function installChangedListener() {
    if (configChangeUnlisten) return;
    configChangeUnlisten = eventListenSync('app_config:changed', () => {
      void loadConfig();
    });
  }

  // ── Computed getters ──────────────────────────────────────────────────
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
    config,
    savingKey,
    ready,
    loadConfig,
    ensureLoaded,
    setConfig,
    resetConfig,
    installChangedListener,
    // computed
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
});
