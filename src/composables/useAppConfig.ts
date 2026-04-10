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

import { ref, computed } from 'vue'
import { invokeWithTimeout } from './useInvoke'

// ── 类型定义（与 Rust AppConfig 结构体对齐） ─────────────────────────────

export interface AppConfig {
  http_user_agent: string
  http_follow_redirects: boolean
  http_connect_timeout_secs: number
  engine_timeout_secs: number
  comic_cache_enabled: boolean
  ui_show_debug_float: boolean
  /** 布局模式："auto" | "mobile" | "desktop" */
  ui_layout_mode: string
  /** UI 主题模式："auto" | "light" | "dark" */
  ui_theme: string
  /** 侧载调试页 URL，仅允许 localhost / 局域网 IP */
  ui_sideload_debug_url: string
}

/** 内置默认 User-Agent（与 Rust BUILTIN_USER_AGENT 保持一致） */
export const BUILTIN_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// ── 全局状态（单例） ──────────────────────────────────────────────────────

const config = ref<AppConfig>({
  http_user_agent: BUILTIN_USER_AGENT,
  http_follow_redirects: true,
  http_connect_timeout_secs: 10,
  engine_timeout_secs: 30,
  comic_cache_enabled: true,
  ui_show_debug_float: true,
  ui_layout_mode: 'auto',
  ui_theme: 'auto',
  ui_sideload_debug_url: '',
})

/** 正在保存中的配置 key（用于 UI loading 状态） */
const savingKey = ref<string | null>(null)

let initialized = false

const TIMEOUT = 10_000

// ── 导出 ──────────────────────────────────────────────────────────────────

export function useAppConfig() {
  /** 从后端加载完整配置 */
  async function loadConfig(): Promise<AppConfig> {
    const cfg = await invokeWithTimeout<AppConfig>('app_config_get_all', undefined, TIMEOUT)
    config.value = cfg
    initialized = true
    return cfg
  }

  /** 确保已初始化（首次调用会加载） */
  async function ensureLoaded() {
    if (!initialized) await loadConfig()
  }

  /**
   * 设置单个配置项并持久化
   *
   * @param key   配置字段名（如 `"http_user_agent"`）
   * @param value 字符串值（布尔用 `"true"/"false"`，数字用整数字符串）
   */
  async function setConfig(key: string, value: string): Promise<void> {
    savingKey.value = key
    try {
      await invokeWithTimeout<void>('app_config_set', { key, value }, TIMEOUT)
      await loadConfig()
    } finally {
      savingKey.value = null
    }
  }

  /** 重置单个配置项为内置默认值并持久化 */
  async function resetConfig(key: string): Promise<void> {
    savingKey.value = key
    try {
      await invokeWithTimeout<void>('app_config_reset', { key }, TIMEOUT)
      await loadConfig()
    } finally {
      savingKey.value = null
    }
  }

  // ── Computed getters（方便组件直接读取） ──────────────────────────────

  const httpUserAgent = computed(() => config.value.http_user_agent)
  const httpFollowRedirects = computed(() => config.value.http_follow_redirects)
  const httpConnectTimeoutSecs = computed(() => config.value.http_connect_timeout_secs)
  const engineTimeoutSecs = computed(() => config.value.engine_timeout_secs)
  const comicCacheEnabled = computed(() => config.value.comic_cache_enabled)
  const uiShowDebugFloat = computed(() => config.value.ui_show_debug_float)
  const uiLayoutMode = computed(() => config.value.ui_layout_mode)
  const uiTheme = computed(() => config.value.ui_theme)
  const uiSideloadDebugUrl = computed(() => config.value.ui_sideload_debug_url)

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
    comicCacheEnabled,
    uiShowDebugFloat,
    uiLayoutMode,
    uiTheme,
    uiSideloadDebugUrl,
  }
}
