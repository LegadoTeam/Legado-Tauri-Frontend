import { BrowserQRCodeReader } from '@zxing/browser';
import QRCode from 'qrcode';
import { useAppConfig, type AppConfig } from './useAppConfig';
import { eventListen, eventListenSync } from './useEventBus';
import {
  ensureFrontendNamespaceLoaded,
  getFrontendStorageItem,
  legacyLocalStorageGet,
  legacyLocalStorageRemove,
  setFrontendStorageJson,
} from './useFrontendStorage';
import { invokeWithTimeout } from './useInvoke';

const READER_SETTINGS_NAMESPACE = 'dynamic-config.reader.defaults.lastEffective';
const READER_SETTINGS_KEY = 'state';
const SOURCE_FLAGS_NAMESPACE = 'source.capabilities';
const SOURCE_EXPLORE_DISABLED_KEY = 'exploreDisabled';
const SOURCE_SEARCH_DISABLED_KEY = 'searchDisabled';

export interface SyncStatus {
  enabled: boolean;
  running: boolean;
  lastSuccessAt: number;
  lastFailedAt: number;
  lastError: string;
  dirtyDomains: string[];
  conflictCount: number;
  lastRunSummary: string;
}

export interface SyncRunSummary {
  status: string;
  mode: string;
  domains: string[];
  uploadedDomains: string[];
  appliedDomains: string[];
  conflictCount: number;
  message: string;
}

export interface SyncConflict {
  id: string;
  domain: string;
  key: string;
  message: string;
  local: unknown;
  remote: unknown;
  createdAt: number;
  resolved: boolean;
}

export interface SyncCredentials {
  password: string;
}

export interface SyncQrPayload {
  type: 'legado-sync-config';
  version: 1;
  provider: 'webdav' | 'ftp' | 'baidu_netdisk';
  profileId: string;
  webdavUrl: string;
  username: string;
  password: string;
  rootDir: string;
  allowHttp: boolean;
  enabledScopes: string[];
  triggerPolicy: Record<string, boolean | number>;
  mobilePolicy: Record<string, boolean | number>;
}

export interface ReaderSessionPayload {
  active: boolean;
  bookId: string;
  chapterIndex: number;
  chapterName: string;
  chapterUrl: string;
  pageIndex: number;
  scrollRatio: number;
  playbackTime: number;
  updatedAt: number;
}

export interface SyncV2ProgressResult {
  status: string;
  message: string;
  local?: unknown;
  remote?: unknown;
}

export interface SyncV2ScriptFilesResult {
  domain: string;
  uploaded: string[];
  downloaded: string[];
  conflicts: string[];
  skipped: string[];
}

export interface SyncV2BookshelfResult {
  uploaded: string[];
  downloaded: string[];
  applied: string[];
  deleted: string[];
  skipped: string[];
}

export interface SyncV2BookSettingsResult {
  uploaded: string[];
  applied: string[];
  skipped: string[];
}

function readLocalJson(key: string): unknown {
  try {
    const raw =
      key === READER_SETTINGS_KEY
        ? getFrontendStorageItem(READER_SETTINGS_NAMESPACE, READER_SETTINGS_KEY)
        : getFrontendStorageItem(SOURCE_FLAGS_NAMESPACE, key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeLocalJson(key: string, value: unknown) {
  if (key === READER_SETTINGS_KEY) {
    setFrontendStorageJson(READER_SETTINGS_NAMESPACE, READER_SETTINGS_KEY, value);
    return;
  }
  setFrontendStorageJson(SOURCE_FLAGS_NAMESPACE, key, value);
}

async function pushClientState() {
  await invokeWithTimeout<void>(
    'sync_client_state_set',
    {
      domain: 'reader_settings',
      value: readLocalJson(READER_SETTINGS_KEY),
    },
    10000,
  ).catch(() => {});

  await invokeWithTimeout<void>(
    'sync_client_state_set',
    {
      domain: 'source_flags',
      value: {
        exploreDisabled: readLocalJson(SOURCE_EXPLORE_DISABLED_KEY) ?? [],
        searchDisabled: readLocalJson(SOURCE_SEARCH_DISABLED_KEY) ?? [],
      },
    },
    10000,
  ).catch(() => {});
}

function enabledScopes(config: AppConfig): string[] {
  const scopes: string[] = [];
  if (config.sync_scope_bookshelf) {
    scopes.push('bookshelf');
  }
  if (config.sync_scope_reading_progress) {
    scopes.push('reading_progress');
  }
  if (config.sync_scope_booksources) {
    scopes.push('booksources');
  }
  if (config.sync_scope_reader_settings) {
    scopes.push('reader_settings');
  }
  if (config.sync_scope_app_settings) {
    scopes.push('app_settings');
  }
  if (config.sync_scope_source_flags) {
    scopes.push('source_flags');
  }
  if (config.sync_scope_extensions) {
    scopes.push('extensions');
  }
  if (config.sync_scope_script_config) {
    scopes.push('script_config');
  }
  return scopes;
}

void ensureFrontendNamespaceLoaded(READER_SETTINGS_NAMESPACE, () => {
  const legacy = legacyLocalStorageGet('legado-reader-settings');
  if (!legacy) {
    return null;
  }
  legacyLocalStorageRemove('legado-reader-settings');
  return { [READER_SETTINGS_KEY]: legacy };
});

void ensureFrontendNamespaceLoaded(SOURCE_FLAGS_NAMESPACE, () => {
  const migrated: Record<string, string> = {};
  const exploreLegacy = legacyLocalStorageGet('source-explore-disabled');
  const searchLegacy = legacyLocalStorageGet('source-search-disabled');
  if (exploreLegacy) {
    migrated[SOURCE_EXPLORE_DISABLED_KEY] = exploreLegacy;
    legacyLocalStorageRemove('source-explore-disabled');
  }
  if (searchLegacy) {
    migrated[SOURCE_SEARCH_DISABLED_KEY] = searchLegacy;
    legacyLocalStorageRemove('source-search-disabled');
  }
  return Object.keys(migrated).length ? migrated : null;
});

export function installSyncClientStateListener() {
  return eventListenSync<{ domain: string; value: unknown }>('sync:client-state', ({ payload }) => {
    if (payload.domain === 'reader_settings') {
      writeLocalJson(READER_SETTINGS_KEY, payload.value);
    }
    if (payload.domain === 'source_flags') {
      const value = payload.value as { exploreDisabled?: unknown; searchDisabled?: unknown };
      writeLocalJson(SOURCE_EXPLORE_DISABLED_KEY, value?.exploreDisabled ?? []);
      writeLocalJson(SOURCE_SEARCH_DISABLED_KEY, value?.searchDisabled ?? []);
    }
  });
}

export function useSync() {
  const { config, setConfig, loadConfig } = useAppConfig();

  function getStatus(): Promise<SyncStatus> {
    return invokeWithTimeout<SyncStatus>('sync_get_status', undefined, 10000);
  }

  async function setCredentials(password: string): Promise<void> {
    await invokeWithTimeout<void>('sync_set_credentials', { password }, 10000);
  }

  async function clearCredentials(): Promise<void> {
    await invokeWithTimeout<void>('sync_clear_credentials', undefined, 10000);
  }

  async function getCredentials(): Promise<SyncCredentials> {
    return invokeWithTimeout<SyncCredentials>('sync_get_credentials', undefined, 10000);
  }

  async function testConnection(password?: string) {
    return invokeWithTimeout<{ ok: boolean; message: string }>(
      'sync_test_connection',
      { password: password ?? null },
      15000,
    );
  }

  async function syncNow(
    mode: 'sync' | 'pull' | 'push' = 'sync',
    conflictStrategy?: 'local' | 'remote',
  ): Promise<SyncRunSummary> {
    await pushClientState();
    const summary = await invokeWithTimeout<SyncRunSummary>(
      'sync_now',
      { mode, domains: null, conflictStrategy: conflictStrategy ?? null },
      120000,
    );
    if (summary.status !== 'conflict') {
      if (config.value.sync_scope_bookshelf) {
        await syncBookshelf().catch(() => undefined);
      }
      if (config.value.sync_scope_reader_settings) {
        await syncBookSettings().catch(() => undefined);
      }
      if (config.value.sync_scope_booksources) {
        await syncScriptFiles('booksources').catch(() => undefined);
      }
      if (config.value.sync_scope_extensions) {
        await syncScriptFiles('plugins').catch(() => undefined);
      }
    }
    return summary;
  }

  function listConflicts(): Promise<SyncConflict[]> {
    return invokeWithTimeout<SyncConflict[]>('sync_list_conflicts', undefined, 10000);
  }

  function resolveConflict(conflictId: string, action: string): Promise<void> {
    return invokeWithTimeout<void>('sync_resolve_conflict', { conflictId, action }, 10000);
  }

  async function generateQrPayload(): Promise<SyncQrPayload> {
    const credentials = await getCredentials();
    return {
      type: 'legado-sync-config',
      version: 1,
      provider:
        config.value.sync_provider === 'ftp' || config.value.sync_provider === 'baidu_netdisk'
          ? config.value.sync_provider
          : 'webdav',
      profileId: config.value.sync_profile_id,
      webdavUrl: config.value.sync_webdav_url,
      username: config.value.sync_webdav_username,
      password: credentials.password,
      rootDir: config.value.sync_webdav_root_dir,
      allowHttp: config.value.sync_webdav_allow_http,
      enabledScopes: enabledScopes(config.value),
      triggerPolicy: {
        enabled: config.value.sync_trigger_enabled,
        startup: config.value.sync_trigger_on_startup,
        resume: config.value.sync_trigger_on_resume,
        unlockResume: config.value.sync_trigger_on_unlock_resume,
        bookshelfChange: config.value.sync_trigger_on_bookshelf_change,
        booksourceChange: config.value.sync_trigger_on_booksource_change,
        settingsChange: config.value.sync_trigger_on_settings_change,
        timerEnabled: config.value.sync_timer_enabled,
        timerIntervalSecs: config.value.sync_timer_interval_secs,
      },
      mobilePolicy: {
        foregroundOnly: config.value.sync_mobile_foreground_only,
        screenOnOnly: config.value.sync_mobile_screen_on_only,
        wifiOnly: config.value.sync_mobile_wifi_only,
        pauseOnLowBattery: config.value.sync_mobile_pause_on_low_battery,
        startupDelayMs: config.value.sync_mobile_startup_delay_ms,
        resumeDelayMs: config.value.sync_mobile_resume_delay_ms,
      },
    };
  }

  async function generateQrDataUrl(): Promise<string> {
    const payload = await generateQrPayload();
    return QRCode.toDataURL(JSON.stringify(payload), { errorCorrectionLevel: 'M', margin: 1 });
  }

  async function importQrPayload(payload: SyncQrPayload): Promise<void> {
    if (payload.type !== 'legado-sync-config' || payload.version !== 1) {
      throw new Error('不是有效的 Legado 同步配置二维码');
    }
    await setConfig('sync_provider', payload.provider);
    await setConfig('sync_profile_id', payload.profileId || 'default');
    await setConfig('sync_webdav_url', payload.webdavUrl || '');
    await setConfig('sync_webdav_username', payload.username || '');
    await setConfig('sync_webdav_root_dir', payload.rootDir || 'legado-sync');
    await setConfig('sync_webdav_allow_http', String(payload.allowHttp));
    await setCredentials(payload.password || '');

    const scopeKeys = [
      'bookshelf',
      'reading_progress',
      'booksources',
      'reader_settings',
      'app_settings',
      'source_flags',
      'extensions',
      'script_config',
    ];
    for (const scope of scopeKeys) {
      await setConfig(`sync_scope_${scope}`, String(payload.enabledScopes.includes(scope)));
    }
    await setConfig('sync_enabled', 'true');
    await loadConfig();
  }

  async function scanQrFromVideo(videoEl: HTMLVideoElement): Promise<SyncQrPayload> {
    const reader = new BrowserQRCodeReader();
    const result = await reader.decodeOnceFromVideoDevice(undefined, videoEl);
    return JSON.parse(result.getText()) as SyncQrPayload;
  }

  function reportReaderSession(session: ReaderSessionPayload): Promise<void> {
    return invokeWithTimeout<void>('sync_report_reader_session', { session }, 5000);
  }

  function syncCurrentReadingProgress(bookId: string): Promise<SyncV2ProgressResult> {
    return invokeWithTimeout<SyncV2ProgressResult>(
      'sync_v2_sync_reading_progress',
      { bookId },
      30000,
    );
  }

  function syncScriptFiles(domain: 'booksources' | 'plugins'): Promise<SyncV2ScriptFilesResult> {
    return invokeWithTimeout<SyncV2ScriptFilesResult>(
      'sync_v2_sync_script_files',
      { domain },
      120000,
    );
  }

  function syncBookshelf(): Promise<SyncV2BookshelfResult> {
    return invokeWithTimeout<SyncV2BookshelfResult>('sync_v2_sync_bookshelf', undefined, 120000);
  }

  function syncBookSettings(): Promise<SyncV2BookSettingsResult> {
    return invokeWithTimeout<SyncV2BookSettingsResult>(
      'sync_v2_sync_book_settings',
      undefined,
      120000,
    );
  }

  function notifyLifecycle(event: 'startup' | 'resume' | 'background'): Promise<void> {
    return invokeWithTimeout<void>('sync_notify_lifecycle', { event }, 10000).catch(() => {});
  }

  function listenReadingConflict(handler: (payload: unknown) => void) {
    return eventListen('sync:reading-progress-conflict', ({ payload }) => handler(payload));
  }

  return {
    getStatus,
    setCredentials,
    clearCredentials,
    getCredentials,
    testConnection,
    syncNow,
    listConflicts,
    resolveConflict,
    generateQrPayload,
    generateQrDataUrl,
    importQrPayload,
    scanQrFromVideo,
    reportReaderSession,
    syncCurrentReadingProgress,
    syncScriptFiles,
    syncBookshelf,
    syncBookSettings,
    notifyLifecycle,
    listenReadingConflict,
  };
}
