/**
 * 全局类型定义入口
 *
 * 将分散在各 composable 和组件文件中的共享类型统一在此导出，
 * 避免类型与运行时实现混合导入，防止格式化工具错误推断 import 性质。
 */

// ── 书源 ───────────────────────────────────────────────────────────────
export type {
  BookSourceMeta,
  RepoSourceInfo,
  RepoManifest,
  RepoSourceSyncResult,
  TestStepResult,
  TestRunResult,
} from '@/composables/useBookSource';

// ── 脚本桥接（书源运行时）─────────────────────────────────────────────
export type { BookItem, BookDetail, ChapterItem, ChapterGroup } from '@/stores';

// ── 书架 ───────────────────────────────────────────────────────────────
export type {
  ShelfBook,
  CachedChapter,
  PatchShelfBookPayload,
  UpdateShelfBookPayload,
} from '@/composables/useBookshelf';

export type { ShelfGroup, ShelfGroupWithCount } from '@/types/shelfGroup';

// ── 布局 ───────────────────────────────────────────────────────────────
export type { NavItem } from '@/components/layout/types';

// ── 搜索聚合 ───────────────────────────────────────────────────────────
export type { TaggedBookItem, AggregatedBook } from '@/components/explore/types';

// ── AI ─────────────────────────────────────────────────────────────────
export type { AgentActivity, TestResult } from '@/composables/useAiAgent';

// ── 书源管理子组件 ref 实例类型 ────────────────────────────────────────
// （避免格式化工具将运行时组件 import 错误推断为 import type）
import type DebugSourceTab from '@/components/booksource/DebugSourceTab.vue';
import type InstalledSourcesTab from '@/components/booksource/InstalledSourcesTab.vue';
import type OnlineSourcesTab from '@/components/booksource/OnlineSourcesTab.vue';

export type DebugSourceTabInstance = InstanceType<typeof DebugSourceTab>;
export type InstalledSourcesTabInstance = InstanceType<typeof InstalledSourcesTab>;
export type OnlineSourcesTabInstance = InstanceType<typeof OnlineSourcesTab>;
