/**
 * useReaderSettings — 阅读器设置状态管理
 *
 * 管理排版、主题、翻页模式等所有可自定义选项。
 * 支持全局默认偏好（前端动态配置）和每本书独立设置（前端命名空间存储）。
 *
 * 工作流：
 *   1. 默认使用最近一次实际生效的全局偏好
 *   2. 打开某本书时调用 activateBookSettings(bookId, saved?) 加载该书设置
 *   3. 阅读期间所有修改实时更新全局偏好快照 + 当前书籍设置
 *   4. 关闭阅读器时调用 deactivateBookSettings()
 */
import { reactive, ref, watch, toRefs, type WatchStopHandle } from 'vue';
import {
  type ReaderSettings,
  type ReaderPagePadding,
  type ReaderTypography,
  type ReaderTheme,
  type FlipMode,
  type PaginationEngine,
  DEFAULT_SETTINGS,
} from '@/components/reader/types';
import { useDynamicConfig } from '@/composables/useDynamicConfig';
import {
  ensureFrontendNamespaceLoaded,
  getFrontendStorageItem,
  legacyLocalStorageGet,
  legacyLocalStorageRemove,
  setFrontendStorageItem,
} from '@/composables/useFrontendStorage';

const LEGACY_STORAGE_KEY = 'legado-reader-settings';
const BOOK_STORAGE_PREFIX = 'legado-reader-settings-book-';
const BOOK_STORAGE_NAMESPACE = 'reader.book-settings';
const TAP_ZONE_DEBUG_AUTO_CLOSE_MS = 1200;
const READER_DEFAULTS_NAMESPACE = 'reader.defaults.lastEffective';
const READER_DEFAULTS_STORAGE_NAMESPACE = `dynamic-config.${READER_DEFAULTS_NAMESPACE}`;
const READER_DEFAULTS_STATE_KEY = 'state';
const READER_DEFAULTS_VERSION = 1;
const BOOK_LEVEL_GLOBAL_FIELDS: (keyof ReaderSettings)[] = ['paginationEngine'];

type StoredReaderSettings = Partial<ReaderSettings> & {
  debugMode?: boolean;
};

type DynamicConfigEnvelope<T> = {
  version: number;
  data: T;
};

interface ReaderDefaultsSnapshot {
  version: number;
  updatedAt: string;
  values: ReaderSettings;
}

function cloneDefaults(): ReaderSettings {
  return {
    ...DEFAULT_SETTINGS,
    typography: { ...DEFAULT_SETTINGS.typography },
    theme: { ...DEFAULT_SETTINGS.theme },
    pagePadding: { ...DEFAULT_SETTINGS.pagePadding },
  };
}

function cloneSettings(settings: ReaderSettings): ReaderSettings {
  return {
    ...settings,
    typography: { ...settings.typography },
    theme: { ...settings.theme },
    pagePadding: { ...settings.pagePadding },
  };
}

function resolvePagePadding(
  base: ReaderPagePadding,
  partial: StoredReaderSettings,
): ReaderPagePadding {
  const legacyPadding = typeof partial.padding === 'number' ? partial.padding : undefined;
  return {
    top: partial.pagePadding?.top ?? legacyPadding ?? base.top,
    right: partial.pagePadding?.right ?? legacyPadding ?? base.right,
    bottom: partial.pagePadding?.bottom ?? legacyPadding ?? base.bottom,
    left: partial.pagePadding?.left ?? legacyPadding ?? base.left,
  };
}

function mergeSettings(base: ReaderSettings, partial: StoredReaderSettings): ReaderSettings {
  const pagePadding = resolvePagePadding(base.pagePadding, partial);
  const merged = {
    ...base,
    ...partial,
    typography: { ...base.typography, ...partial.typography },
    theme: { ...base.theme, ...partial.theme },
    pagePadding,
    layoutDebugMode:
      typeof partial.layoutDebugMode === 'boolean'
        ? partial.layoutDebugMode
        : typeof partial.debugMode === 'boolean'
          ? partial.debugMode
          : base.layoutDebugMode,
    padding:
      typeof partial.padding === 'number'
        ? partial.padding
        : Math.round(
            (pagePadding.top + pagePadding.right + pagePadding.bottom + pagePadding.left) / 4,
          ),
  } as ReaderSettings & { debugMode?: boolean };

  delete merged.debugMode;
  // 迁移旧 paginationEngine 值：'auto'/'simple' → 'pretext'
  if (
    merged.paginationEngine === ('auto' as string) ||
    merged.paginationEngine === ('simple' as string)
  ) {
    merged.paginationEngine = 'pretext';
  }
  return merged;
}

function extractStoredReaderSettings(raw: unknown): StoredReaderSettings | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const source =
    record.values && typeof record.values === 'object'
      ? (record.values as Record<string, unknown>)
      : record;
  const next = { ...source } as StoredReaderSettings & { version?: unknown; updatedAt?: unknown };
  delete next.version;
  delete next.updatedAt;
  return next;
}

function sanitizeBookStoredSettings(partial: StoredReaderSettings): StoredReaderSettings {
  const next = { ...partial };
  for (const field of BOOK_LEVEL_GLOBAL_FIELDS) {
    delete next[field];
  }
  return next;
}

function createReaderDefaultsSnapshot(values: ReaderSettings): ReaderDefaultsSnapshot {
  return {
    version: READER_DEFAULTS_VERSION,
    updatedAt: new Date().toISOString(),
    values: cloneSettings(values),
  };
}

function getReaderDefaultsStore() {
  return useDynamicConfig<ReaderDefaultsSnapshot>({
    namespace: READER_DEFAULTS_NAMESPACE,
    version: READER_DEFAULTS_VERSION,
    defaults: () => createReaderDefaultsSnapshot(cloneDefaults()),
    migrate: ({ storedData, readLegacy }) => {
      const storedSettings = extractStoredReaderSettings(storedData);
      if (storedSettings) {
        return createReaderDefaultsSnapshot(mergeSettings(cloneDefaults(), storedSettings));
      }

      const legacyRaw = readLegacy(LEGACY_STORAGE_KEY);
      if (!legacyRaw) {
        return null;
      }
      try {
        return createReaderDefaultsSnapshot(
          mergeSettings(cloneDefaults(), JSON.parse(legacyRaw) as StoredReaderSettings),
        );
      } catch {
        return null;
      }
    },
    legacyKeys: [LEGACY_STORAGE_KEY],
  });
}

function readCachedGlobalSettings(): StoredReaderSettings | null {
  try {
    const raw = getFrontendStorageItem(
      READER_DEFAULTS_STORAGE_NAMESPACE,
      READER_DEFAULTS_STATE_KEY,
    );
    if (!raw) {
      return null;
    }

    const envelope = JSON.parse(raw) as DynamicConfigEnvelope<unknown>;
    if (envelope.version !== READER_DEFAULTS_VERSION) {
      return null;
    }

    return extractStoredReaderSettings(envelope.data);
  } catch {
    return null;
  }
}

function loadGlobalSettings(): ReaderSettings {
  const cachedSettings = readCachedGlobalSettings();
  if (cachedSettings) {
    return mergeSettings(cloneDefaults(), cachedSettings);
  }

  const legacyRaw = legacyLocalStorageGet(LEGACY_STORAGE_KEY);
  if (legacyRaw) {
    try {
      return mergeSettings(cloneDefaults(), JSON.parse(legacyRaw) as StoredReaderSettings);
    } catch {
      /* 损坏数据则回退 */
    }
  }

  const store = getReaderDefaultsStore();
  return mergeSettings(cloneDefaults(), store.state.values);
}

function loadBookSettings(bookId: string): ReaderSettings | null {
  try {
    const raw = getFrontendStorageItem(BOOK_STORAGE_NAMESPACE, bookId);
    if (raw) {
      return mergeSettings(
        loadGlobalSettings(),
        sanitizeBookStoredSettings(JSON.parse(raw) as StoredReaderSettings),
      );
    }
  } catch {
    /* 损坏数据则回退 */
  }
  return null;
}

function saveBookSettings(bookId: string, s: ReaderSettings) {
  try {
    const stored = cloneSettings(s) as StoredReaderSettings;
    const sanitized = sanitizeBookStoredSettings(stored);
    setFrontendStorageItem(BOOK_STORAGE_NAMESPACE, bookId, JSON.stringify(sanitized));
  } catch {
    /* 静默 */
  }
}

// 单例状态，多个组件共享同一份设置
let _settings: ReturnType<typeof reactive<ReaderSettings>> | null = null;
const tapZoneDebugPreviewVisible = ref(false);
let tapZoneDebugPreviewTimer: ReturnType<typeof setTimeout> | null = null;
/** 当前激活的书籍 ID，null = 使用全局设置 */
let _activeBookId: string | null = null;
let _bookWatcher: WatchStopHandle | null = null;
let _suspendPersistenceDepth = 0;

function runWithoutPersistence(task: () => void) {
  _suspendPersistenceDepth += 1;
  try {
    task();
  } finally {
    queueMicrotask(() => {
      _suspendPersistenceDepth -= 1;
    });
  }
}

function applySettings(target: ReaderSettings, next: ReaderSettings) {
  Object.assign(target, {
    ...next,
    typography: { ...next.typography },
    theme: { ...next.theme },
    pagePadding: { ...next.pagePadding },
  });
}

export function useReaderSettings() {
  const readerDefaultsStore = getReaderDefaultsStore();

  async function persistSettingsSnapshot(nextSettings: ReaderSettings) {
    await readerDefaultsStore.replace(createReaderDefaultsSnapshot(nextSettings));
    if (_activeBookId) {
      saveBookSettings(_activeBookId, nextSettings);
    }
  }

  if (!_settings) {
    _settings = reactive(loadGlobalSettings());
    watch(
      _settings,
      (val) => {
        if (_suspendPersistenceDepth > 0) {
          return;
        }
        const nextSettings = cloneSettings(val as ReaderSettings);
        void persistSettingsSnapshot(nextSettings);
      },
      { deep: true },
    );
  }
  const settings = _settings;

  function hideTapZoneDebugPreview() {
    if (tapZoneDebugPreviewTimer) {
      clearTimeout(tapZoneDebugPreviewTimer);
      tapZoneDebugPreviewTimer = null;
    }
    tapZoneDebugPreviewVisible.value = false;
  }

  function showTapZoneDebugPreview(durationMs = TAP_ZONE_DEBUG_AUTO_CLOSE_MS) {
    if (tapZoneDebugPreviewTimer) {
      clearTimeout(tapZoneDebugPreviewTimer);
    }
    tapZoneDebugPreviewVisible.value = true;
    tapZoneDebugPreviewTimer = setTimeout(() => {
      tapZoneDebugPreviewTimer = null;
      tapZoneDebugPreviewVisible.value = false;
    }, durationMs);
  }

  /** 更新排版属性（局部） */
  function updateTypography(patch: Partial<ReaderTypography>) {
    Object.assign(settings.typography, patch);
  }

  /** 更新页边距属性（局部） */
  function updatePagePadding(patch: Partial<ReaderPagePadding>) {
    Object.assign(settings.pagePadding, patch);
    settings.padding = Math.round(
      (settings.pagePadding.top +
        settings.pagePadding.right +
        settings.pagePadding.bottom +
        settings.pagePadding.left) /
        4,
    );
  }

  /** 切换主题 */
  function setTheme(theme: ReaderTheme) {
    Object.assign(settings.theme, theme);
    settings.themePresetId = '';
  }

  /** 切换翻页模式 */
  function setFlipMode(mode: FlipMode) {
    settings.flipMode = mode;
  }

  async function setPaginationEngine(engine: PaginationEngine) {
    if (settings.paginationEngine === engine) {
      return;
    }

    const previousEngine = settings.paginationEngine;
    runWithoutPersistence(() => {
      settings.paginationEngine = engine;
    });

    try {
      await persistSettingsSnapshot(cloneSettings(settings));
    } catch (error) {
      runWithoutPersistence(() => {
        settings.paginationEngine = previousEngine;
      });
      throw error;
    }
  }

  /** 重置为默认设置 */
  function resetSettings() {
    const defaults = cloneDefaults();
    Object.assign(settings, defaults);
  }

  /**
   * 激活某本书的独立设置。
   * @param bookId 书架 ID
   * @param savedJson 书架存储的 JSON 字符串（优先使用），undefined 则从前端命名空间存储加载
   */
  function activateBookSettings(bookId: string, savedJson?: string) {
    _activeBookId = bookId;
    let bookSettings: ReaderSettings | null = null;
    if (savedJson) {
      try {
        bookSettings = mergeSettings(
          loadGlobalSettings(),
          sanitizeBookStoredSettings(JSON.parse(savedJson) as StoredReaderSettings),
        );
      } catch {
        /* 忽略解析错误 */
      }
    }
    bookSettings ??= loadBookSettings(bookId);
    const applyNextSettings = (nextSettings: ReaderSettings) => {
      runWithoutPersistence(() => {
        applySettings(settings, nextSettings);
      });
    };
    applyNextSettings(bookSettings ?? loadGlobalSettings());

    void ensureFrontendNamespaceLoaded(BOOK_STORAGE_NAMESPACE, () => {
      const legacy = legacyLocalStorageGet(BOOK_STORAGE_PREFIX + bookId);
      if (!legacy) {
        return null;
      }
      legacyLocalStorageRemove(BOOK_STORAGE_PREFIX + bookId);
      return { [bookId]: legacy };
    }).then(() => {
      if (_activeBookId !== bookId || savedJson) {
        return;
      }
      applyNextSettings(loadBookSettings(bookId) ?? loadGlobalSettings());
    });
  }

  /** 停用书籍独立设置，恢复全局设置 */
  function deactivateBookSettings() {
    if (!_activeBookId) {
      return;
    }
    _activeBookId = null;
    _bookWatcher?.();
    _bookWatcher = null;
    const global = loadGlobalSettings();
    runWithoutPersistence(() => {
      applySettings(settings, global);
    });
  }

  /** 获取当前设置的 JSON 快照，用于写入书架持久化。
   * 全局兼容策略类字段（如 paginationEngine）不落到单书，避免覆盖前端动态默认值。
   */
  function getSettingsJson(): string {
    const stored = cloneSettings(settings) as StoredReaderSettings;
    return JSON.stringify(sanitizeBookStoredSettings(stored));
  }

  /** 当前是否处于书籍独立设置模式 */
  function isBookMode(): boolean {
    return _activeBookId !== null;
  }

  /** 生成内容区 CSS 变量对象，直接绑定到 :style */
  function getContentStyle(): Record<string, string> {
    const t = settings.typography;
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
      '--reader-font-variant': t.fontVariant,
      '--reader-text-stroke-width': `${t.textStrokeWidth}px`,
      '--reader-text-stroke-color': t.textStrokeColor,
      '--reader-text-shadow': t.textShadow,
      '--reader-bg-color': settings.theme.backgroundColor,
      '--reader-text-color': settings.theme.textColor,
      '--reader-selection-color': settings.theme.selectionColor,
      '--reader-padding-top': `${settings.pagePadding.top}px`,
      '--reader-padding-right': `${settings.pagePadding.right}px`,
      '--reader-padding-bottom': `${settings.pagePadding.bottom}px`,
      '--reader-padding-left': `${settings.pagePadding.left}px`,
      '--reader-padding': `${settings.pagePadding.top}px ${settings.pagePadding.right}px ${settings.pagePadding.bottom}px ${settings.pagePadding.left}px`,
      '--reader-brightness': `${settings.brightness}%`,
      '--reader-bg-image': settings.backgroundImage || 'none',
      '--reader-bg-size': 'auto',
      '--reader-bg-position': '0 0',
      '--reader-bg-repeat': 'repeat',
      '--reader-bg-attachment': 'scroll',
      '--reader-bg-blend-mode': 'normal',
    };
  }

  return {
    settings,
    ...toRefs(settings),
    updateTypography,
    updatePagePadding,
    setTheme,
    setFlipMode,
    setPaginationEngine,
    resetSettings,
    activateBookSettings,
    deactivateBookSettings,
    getSettingsJson,
    isBookMode,
    getContentStyle,
    tapZoneDebugPreviewVisible,
    showTapZoneDebugPreview,
    hideTapZoneDebugPreview,
  };
}
