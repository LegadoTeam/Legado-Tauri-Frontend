/**
 * src/stores/index.ts — Pinia Store 统一导出入口
 */
export { useNavigationStore } from './navigation';
export { useBookSourceStore } from './bookSource';
export { useBookshelfStore } from './bookshelf';
export { useAppConfigStore } from './appConfig';
export { usePreferencesStore } from './preferences';
export { usePrivacyModeStore } from './privacyMode';
export { usePrefetchStore } from './prefetch';
export { useAiSessionsStore } from './aiSessions';
export { useScriptBridgeStore } from './scriptBridge';
export { useFrontendPluginsStore } from './frontendPlugins';
export { useShellStatusStore } from './shellStatus';
export { useBackStackStore } from './backStack';
export { useBookshelfUiStore } from '@/features/bookshelf/stores/bookshelfUi';
export { useBookshelfReaderStore } from '@/features/bookshelf/stores/bookshelfReader';
export { useReaderSessionStore } from '@/features/reader/stores/readerSession';
export { useReaderUiStore } from '@/features/reader/stores/readerUi';
export { useReaderSettingsStore } from '@/features/reader/stores/readerSettings';
export { useReaderActionsStore } from '@/features/reader/stores/readerActions';
export { useReaderViewStore } from '@/features/reader/stores/readerView';
export { useReaderBookmarksStore } from '@/features/reader/stores/readerBookmarks';
export type { BookmarkEntry } from '@/features/reader/stores/readerBookmarks';
export { useMusicPlayerStore } from './musicPlayer';
export type { PlayerTrack, PlayerBookContext, PlayMode } from './musicPlayer';
export type { BackHandler } from './backStack';

// 重新导出常用类型，方便组件直接从 stores 引入
export type { AiSession, AiDraft } from './aiSessions';
export type { PrefetchPayload } from './prefetch';
export type {
  ScriptLog,
  ScriptUiEvent,
  DialogRequest,
  BookItem,
  BookDetail,
  ChapterItem,
  ChapterGroup,
} from './scriptBridge';
export type { ShellTaskItem, ShellLogItem, ShellLogLevel, TaskStatus } from './shellStatus';
export { groupChapters } from './scriptBridge';
export type {
  ReaderPreferences,
  ViewDensityMode,
  ViewDensityPreferences,
  SearchPreferences,
  TocAutoUpdatePreferences,
} from './preferences';
// ShelfBook 类型（组件/视图直接从 stores 引入）
export type {
  ShelfBook,
  AddBookPayload,
  CachedChapter,
  UpdateShelfBookPayload,
  PatchShelfBookPayload,
} from '../composables/useBookshelf';
// useFrontendPlugins 的类型（通过 frontendPlugins store 透传）
export type {
  PluginSettingValue,
  ResolvedPluginSettingField,
} from '../composables/useFrontendPlugins';
