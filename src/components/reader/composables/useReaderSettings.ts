/**
 * useReaderSettings — 阅读器设置状态管理
 *
 * 管理排版、主题、翻页模式等所有可自定义选项。
 * 支持全局设置（localStorage）和每本书独立设置。
 *
 * 工作流：
 *   1. 默认使用全局设置（STORAGE_KEY）
 *   2. 打开某本书时调用 activateBookSettings(bookId, saved?) 加载该书设置
 *   3. 阅读期间所有修改实时同步到全局 + 生成快照供书架持久化
 *   4. 关闭阅读器时调用 deactivateBookSettings()
 */
import { reactive, watch, toRefs, type WatchStopHandle } from 'vue'
import {
  type ReaderSettings,
  type ReaderTypography,
  type ReaderTheme,
  type FlipMode,
  DEFAULT_SETTINGS,
} from '../types'

const STORAGE_KEY = 'legado-reader-settings'
const BOOK_STORAGE_PREFIX = 'legado-reader-settings-book-'

function mergeSettings(base: ReaderSettings, partial: Partial<ReaderSettings>): ReaderSettings {
  return {
    ...base,
    ...partial,
    typography: { ...base.typography, ...(partial.typography ?? {}) },
    theme: { ...base.theme, ...(partial.theme ?? {}) },
  }
}

function loadGlobalSettings(): ReaderSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      return mergeSettings(
        { ...DEFAULT_SETTINGS, typography: { ...DEFAULT_SETTINGS.typography }, theme: { ...DEFAULT_SETTINGS.theme } },
        JSON.parse(raw) as Partial<ReaderSettings>,
      )
    }
  } catch { /* 损坏数据则回退默认 */ }
  return { ...DEFAULT_SETTINGS, typography: { ...DEFAULT_SETTINGS.typography }, theme: { ...DEFAULT_SETTINGS.theme } }
}

function loadBookSettings(bookId: string): ReaderSettings | null {
  try {
    const raw = localStorage.getItem(BOOK_STORAGE_PREFIX + bookId)
    if (raw) {
      return mergeSettings(
        { ...DEFAULT_SETTINGS, typography: { ...DEFAULT_SETTINGS.typography }, theme: { ...DEFAULT_SETTINGS.theme } },
        JSON.parse(raw) as Partial<ReaderSettings>,
      )
    }
  } catch { /* 损坏数据则回退 */ }
  return null
}

function saveGlobalSettings(s: ReaderSettings) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch { /* storage 满则静默 */ }
}

function saveBookSettings(bookId: string, s: ReaderSettings) {
  try { localStorage.setItem(BOOK_STORAGE_PREFIX + bookId, JSON.stringify(s)) } catch { /* 静默 */ }
}

// 单例状态，多个组件共享同一份设置
let _settings: ReturnType<typeof reactive<ReaderSettings>> | null = null
/** 当前激活的书籍 ID，null = 使用全局设置 */
let _activeBookId: string | null = null
/** 书籍 watcher，激活后负责同步保存到 localStorage */
let _bookWatcher: WatchStopHandle | null = null

export function useReaderSettings() {
  if (!_settings) {
    _settings = reactive<ReaderSettings>(loadGlobalSettings())
    // 全局 watcher 始终存活，无需停止
    watch(
      () => ({ ..._settings! }),
      (val) => {
        saveGlobalSettings(val as ReaderSettings)
        // 若激活了书籍设置，同时保存到书籍 localStorage
        if (_activeBookId) {
          saveBookSettings(_activeBookId, val as ReaderSettings)
        }
      },
      { deep: true },
    )
  }
  const settings = _settings

  /** 更新排版属性（局部） */
  function updateTypography(patch: Partial<ReaderTypography>) {
    Object.assign(settings.typography, patch)
  }

  /** 切换主题 */
  function setTheme(theme: ReaderTheme) {
    Object.assign(settings.theme, theme)
  }

  /** 切换翻页模式 */
  function setFlipMode(mode: FlipMode) {
    settings.flipMode = mode
  }

  /** 重置为默认设置 */
  function resetSettings() {
    const defaults = {
      ...DEFAULT_SETTINGS,
      typography: { ...DEFAULT_SETTINGS.typography },
      theme: { ...DEFAULT_SETTINGS.theme },
    }
    Object.assign(settings, defaults)
  }

  /**
   * 激活某本书的独立设置。
   * @param bookId 书架 ID
   * @param savedJson 书架存储的 JSON 字符串（优先使用），undefined 则从 localStorage 加载
   */
  function activateBookSettings(bookId: string, savedJson?: string) {
    _activeBookId = bookId
    // 优先使用书架上存储的设置 JSON
    let bookSettings: ReaderSettings | null = null
    if (savedJson) {
      try {
        bookSettings = mergeSettings(
          { ...DEFAULT_SETTINGS, typography: { ...DEFAULT_SETTINGS.typography }, theme: { ...DEFAULT_SETTINGS.theme } },
          JSON.parse(savedJson) as Partial<ReaderSettings>,
        )
      } catch { /* 忽略解析错误 */ }
    }
    // 回退到 localStorage 中的书籍设置
    if (!bookSettings) {
      bookSettings = loadBookSettings(bookId)
    }
    // 有书籍独立设置则应用，否则沿用当前全局设置
    if (bookSettings) {
      Object.assign(settings, {
        ...bookSettings,
        typography: { ...bookSettings.typography },
        theme: { ...bookSettings.theme },
      })
    }
  }

  /** 停用书籍独立设置，恢复全局设置 */
  function deactivateBookSettings() {
    if (!_activeBookId) return
    _activeBookId = null
    _bookWatcher?.()
    _bookWatcher = null
    // 恢复全局设置
    const global = loadGlobalSettings()
    Object.assign(settings, {
      ...global,
      typography: { ...global.typography },
      theme: { ...global.theme },
    })
  }

  /** 获取当前设置的 JSON 快照，用于写入书架持久化 */
  function getSettingsJson(): string {
    return JSON.stringify(settings)
  }

  /** 当前是否处于书籍独立设置模式 */
  function isBookMode(): boolean {
    return _activeBookId !== null
  }

  /** 生成内容区 CSS 变量对象，直接绑定到 :style */
  function getContentStyle(): Record<string, string> {
    const t = settings.typography
    return {
      '--reader-font-family': t.fontFamily,
      '--reader-font-size': `${t.fontSize}px`,
      '--reader-line-height': `${t.lineHeight}`,
      '--reader-letter-spacing': `${t.letterSpacing}px`,
      '--reader-word-spacing': `${t.wordSpacing}px`,
      '--reader-paragraph-spacing': `${t.paragraphSpacing}px`,
      '--reader-text-indent': `${t.textIndent}em`,
      '--reader-font-weight': `${t.fontWeight}`,
      '--reader-font-style': t.fontStyle,
      '--reader-text-align': t.textAlign,
      '--reader-text-decoration': t.textDecoration,
      '--reader-text-transform': t.textTransform,
      '--reader-font-variant': t.fontVariant,
      '--reader-writing-mode': t.writingMode,
      '--reader-text-stroke-width': `${t.textStrokeWidth}px`,
      '--reader-text-stroke-color': t.textStrokeColor,
      '--reader-text-shadow': t.textShadow,
      '--reader-bg-color': settings.theme.backgroundColor,
      '--reader-text-color': settings.theme.textColor,
      '--reader-selection-color': settings.theme.selectionColor,
      '--reader-padding': `${settings.padding}px`,
      '--reader-brightness': `${settings.brightness}%`,
      '--reader-bg-image': settings.backgroundImage || 'none',
    }
  }

  return {
    settings,
    ...toRefs(settings),
    updateTypography,
    setTheme,
    setFlipMode,
    resetSettings,
    activateBookSettings,
    deactivateBookSettings,
    getSettingsJson,
    isBookMode,
    getContentStyle,
  }
}
