<script setup lang="ts">
import { useMessage } from 'naive-ui';
/**
 * AI 书源工作台 — 独立调试面板
 *
 * 含两类结果：
 *  1. AI 上次调试记录（由 aiTestResults prop 传入）
 *  2. 用户手动调试（各功能独立选项卡 + 独立运行按钮）
 *
 * 选项卡顶部徽标实时反映当前最新结果（手动 > AI 自动）。
 */
import { ref, computed, watch } from 'vue';
import type { TestResult } from '../../composables/useAiAgent';
import { invokeWithTimeout } from '../../composables/useInvoke';

// ── Props ─────────────────────────────────────────────────────────────────
const props = defineProps<{
  /** 当前草稿/书源文件名（含 .js），用于 Tauri 调用 */
  fileName: string;
  /** AI agent 最近运行产生的测试结果 */
  aiTestResults: TestResult[];
}>();

// ── 选项卡定义 ────────────────────────────────────────────────────────────
type TabId = 'search' | 'bookInfo' | 'chapterList' | 'chapterContent' | 'explore';

interface TabDef {
  id: TabId;
  label: string;
  /** AI 结果数组中对应的 name 字段，null = AI 不测试此项 */
  aiKey: string | null;
}

const TAB_DEFS: TabDef[] = [
  { id: 'search', label: '搜索', aiKey: '搜索' },
  { id: 'bookInfo', label: '详情', aiKey: '书籍详情' },
  { id: 'chapterList', label: '目录', aiKey: '章节目录' },
  { id: 'chapterContent', label: '正文', aiKey: '章节正文' },
  { id: 'explore', label: '发现', aiKey: null },
];

// ── 状态：每个选项卡的手动测试状态 ───────────────────────────────────────
interface RunState {
  status: 'idle' | 'running' | 'ok' | 'error';
  output: string;
  durationMs: number;
  lastRunAt: number | null;
}

function emptyState(): RunState {
  return { status: 'idle', output: '', durationMs: 0, lastRunAt: null };
}

const runStates = ref<Record<TabId, RunState>>({
  search: emptyState(),
  bookInfo: emptyState(),
  chapterList: emptyState(),
  chapterContent: emptyState(),
  explore: emptyState(),
});

// ── 输入字段 ──────────────────────────────────────────────────────────────
const searchKeyword = ref('');
const searchPage = ref(1);
const bookInfoUrl = ref('');
const chapterListUrl = ref('');
const chapterContentUrl = ref('');
const exploreCategory = ref('');
const explorePage = ref(1);

const activeTab = ref<TabId>('search');
const message = useMessage();

// ── 从文件名变更时重置所有手动测试状态 ───────────────────────────────────
watch(
  () => props.fileName,
  () => {
    for (const tab of TAB_DEFS) {
      runStates.value[tab.id] = emptyState();
    }
  },
);

// ── AI 结果查询 ───────────────────────────────────────────────────────────
function getAiResult(tabId: TabId): TestResult | null {
  const def = TAB_DEFS.find((t) => t.id === tabId);
  if (!def?.aiKey) {
    return null;
  }
  return props.aiTestResults.find((r) => r.name === def.aiKey) ?? null;
}

// ── 选项卡徽标（手动结果优先，其次 AI 结果）─────────────────────────────
function getTabBadgeInfo(tabId: TabId): { text: string; type: 'success' | 'error' | 'muted' } {
  const manual = runStates.value[tabId];
  if (manual.status === 'ok') {
    return { text: '✓', type: 'success' };
  }
  if (manual.status === 'error') {
    return { text: '✗', type: 'error' };
  }
  const ai = getAiResult(tabId);
  if (ai) {
    if (ai.status === 'ok') {
      return { text: 'AI✓', type: 'success' };
    }
    if (ai.status === 'error') {
      return { text: 'AI✗', type: 'error' };
    }
  }
  return { text: '—', type: 'muted' };
}

// ── 把 JSON 数组中的首个 bookUrl 提取出来 ────────────────────────────────
function extractFirstBookUrl(json: string): string {
  try {
    const arr = JSON.parse(json);
    if (Array.isArray(arr) && arr.length > 0) {
      const first = arr[0] as Record<string, unknown>;
      return (first.bookUrl as string) || (first.url as string) || '';
    }
  } catch {
    // ignore
  }
  return '';
}

function extractFirstChapterUrl(json: string): string {
  try {
    const arr = JSON.parse(json);
    if (Array.isArray(arr)) {
      // support flat array or grouped
      const flat = arr.flatMap((item: unknown) =>
        Array.isArray((item as Record<string, unknown>)?.chapters)
          ? ((item as Record<string, unknown>).chapters as unknown[])
          : [item],
      );
      const first = flat[0] as Record<string, unknown>;
      return (first?.url as string) || (first?.chapterUrl as string) || '';
    }
  } catch {
    // ignore
  }
  return '';
}

// ── 搜索 ──────────────────────────────────────────────────────────────────
async function runSearch() {
  if (!props.fileName) {
    message.warning('当前草稿尚未命名，请先让 AI 保存书源');
    return;
  }
  if (!searchKeyword.value.trim()) {
    message.warning('请输入搜索关键词');
    return;
  }
  const st = runStates.value.search;
  st.status = 'running';
  st.output = '';
  const t0 = Date.now();
  try {
    const raw = await invokeWithTimeout<unknown>(
      'booksource_search',
      { fileName: props.fileName, keyword: searchKeyword.value.trim(), page: searchPage.value },
      35000,
    );
    st.output = JSON.stringify(raw, null, 2);
    st.status = 'ok';
    // 链式填入：把第一个 bookUrl 自动填到详情输入框
    const url = extractFirstBookUrl(st.output);
    if (url && !bookInfoUrl.value) {
      bookInfoUrl.value = url;
    }
  } catch (e: unknown) {
    st.output = e instanceof Error ? e.message : String(e);
    st.status = 'error';
  }
  st.durationMs = Date.now() - t0;
  st.lastRunAt = Date.now();
}

// ── 书籍详情 ──────────────────────────────────────────────────────────────
async function runBookInfo() {
  if (!props.fileName) {
    message.warning('当前草稿尚未命名');
    return;
  }
  if (!bookInfoUrl.value.trim()) {
    message.warning('请输入书籍 URL');
    return;
  }
  const st = runStates.value.bookInfo;
  st.status = 'running';
  st.output = '';
  const t0 = Date.now();
  try {
    const raw = await invokeWithTimeout<unknown>(
      'booksource_book_info',
      { fileName: props.fileName, bookUrl: bookInfoUrl.value.trim() },
      35000,
    );
    st.output = JSON.stringify(raw, null, 2);
    st.status = 'ok';
    // 链式：详情返回的 bookUrl 填入目录
    const detail = raw as Record<string, unknown>;
    const tocUrl = (detail?.bookUrl as string) || bookInfoUrl.value;
    if (tocUrl && !chapterListUrl.value) {
      chapterListUrl.value = tocUrl;
    }
  } catch (e: unknown) {
    st.output = e instanceof Error ? e.message : String(e);
    st.status = 'error';
  }
  st.durationMs = Date.now() - t0;
  st.lastRunAt = Date.now();
}

// ── 章节目录 ──────────────────────────────────────────────────────────────
async function runChapterList() {
  if (!props.fileName) {
    message.warning('当前草稿尚未命名');
    return;
  }
  if (!chapterListUrl.value.trim()) {
    message.warning('请输入书籍 URL');
    return;
  }
  const st = runStates.value.chapterList;
  st.status = 'running';
  st.output = '';
  const t0 = Date.now();
  try {
    const raw = await invokeWithTimeout<unknown>(
      'booksource_chapter_list',
      { fileName: props.fileName, bookUrl: chapterListUrl.value.trim(), taskId: null },
      125000,
    );
    st.output = JSON.stringify(raw, null, 2);
    st.status = 'ok';
    // 链式：把第一章 URL 填入正文
    const chUrl = extractFirstChapterUrl(st.output);
    if (chUrl && !chapterContentUrl.value) {
      chapterContentUrl.value = chUrl;
    }
  } catch (e: unknown) {
    st.output = e instanceof Error ? e.message : String(e);
    st.status = 'error';
  }
  st.durationMs = Date.now() - t0;
  st.lastRunAt = Date.now();
}

// ── 章节正文 ──────────────────────────────────────────────────────────────
async function runChapterContent() {
  if (!props.fileName) {
    message.warning('当前草稿尚未命名');
    return;
  }
  if (!chapterContentUrl.value.trim()) {
    message.warning('请输入章节 URL');
    return;
  }
  const st = runStates.value.chapterContent;
  st.status = 'running';
  st.output = '';
  const t0 = Date.now();
  try {
    const raw = await invokeWithTimeout<unknown>(
      'booksource_chapter_content',
      { fileName: props.fileName, chapterUrl: chapterContentUrl.value.trim() },
      35000,
    );
    st.output = JSON.stringify(raw, null, 2);
    st.status = 'ok';
  } catch (e: unknown) {
    st.output = e instanceof Error ? e.message : String(e);
    st.status = 'error';
  }
  st.durationMs = Date.now() - t0;
  st.lastRunAt = Date.now();
}

// ── 发现页 ────────────────────────────────────────────────────────────────
async function runExplore() {
  if (!props.fileName) {
    message.warning('当前草稿尚未命名');
    return;
  }
  const st = runStates.value.explore;
  st.status = 'running';
  st.output = '';
  const t0 = Date.now();
  try {
    const raw = await invokeWithTimeout<unknown>(
      'booksource_explore',
      {
        fileName: props.fileName,
        category: exploreCategory.value.trim() || '',
        page: explorePage.value,
      },
      35000,
    );
    st.output = JSON.stringify(raw, null, 2);
    st.status = 'ok';
  } catch (e: unknown) {
    st.output = e instanceof Error ? e.message : String(e);
    st.status = 'error';
  }
  st.durationMs = Date.now() - t0;
  st.lastRunAt = Date.now();
}

// ── 工具 ──────────────────────────────────────────────────────────────────
function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

const isRunning = computed(() => TAB_DEFS.some((t) => runStates.value[t.id].status === 'running'));

// 把搜索结果第一个 bookUrl 快速填到对应输入框
function fillBookUrlFromSearch() {
  const url = extractFirstBookUrl(runStates.value.search.output);
  if (url) {
    bookInfoUrl.value = url;
    chapterListUrl.value = url;
    activeTab.value = 'bookInfo';
  }
}
function fillChapterUrlFromList() {
  const url = extractFirstChapterUrl(runStates.value.chapterList.output);
  if (url) {
    chapterContentUrl.value = url;
    activeTab.value = 'chapterContent';
  }
}
function fillBookUrlFromDetail() {
  try {
    const obj = JSON.parse(runStates.value.bookInfo.output) as Record<string, unknown>;
    const url = (obj?.bookUrl as string) || bookInfoUrl.value;
    if (url) {
      chapterListUrl.value = url;
      activeTab.value = 'chapterList';
    }
  } catch {
    if (bookInfoUrl.value) {
      chapterListUrl.value = bookInfoUrl.value;
      activeTab.value = 'chapterList';
    }
  }
}

// 清空某个 tab 的手动结果
function clearState(tabId: TabId) {
  runStates.value[tabId] = emptyState();
}
</script>

<template>
  <div class="atp">
    <!-- ── 选项卡行 ────────────────────────────────────────── -->
    <div class="atp-tabs" role="tablist">
      <button
        v-for="tab in TAB_DEFS"
        :key="tab.id"
        class="atp-tab"
        :class="{ 'atp-tab--active': activeTab === tab.id }"
        role="tab"
        :aria-selected="activeTab === tab.id"
        @click="activeTab = tab.id"
      >
        <span class="atp-tab-label">{{ tab.label }}</span>
        <span class="atp-tab-badge" :class="`atp-tab-badge--${getTabBadgeInfo(tab.id).type}`">{{
          getTabBadgeInfo(tab.id).text
        }}</span>
      </button>
    </div>

    <!-- ── 选项卡内容区 ────────────────────────────────────── -->
    <div class="atp-body">
      <!-- ── 搜索 ── -->
      <div v-show="activeTab === 'search'" class="atp-pane">
        <!-- AI 记录 -->
        <div v-if="getAiResult('search')" class="ai-record">
          <div class="ai-record-hd">
            <span class="ai-record-icon">🤖</span>
            <span class="ai-record-title">AI 上次调试</span>
            <n-tag
              :type="getAiResult('search')!.status === 'ok' ? 'success' : 'error'"
              size="tiny"
              round
            >
              {{ getAiResult('search')!.status === 'ok' ? '通过' : '失败' }}
            </n-tag>
          </div>
          <pre class="atp-pre atp-pre--ai">{{ getAiResult('search')!.output }}</pre>
        </div>
        <!-- 手动测试 -->
        <div class="manual-section">
          <div class="manual-hd">
            <span class="manual-title">手动测试</span>
            <span
              v-if="runStates.search.lastRunAt"
              class="manual-meta"
              :class="runStates.search.status === 'ok' ? 'meta--ok' : 'meta--err'"
            >
              {{ runStates.search.status === 'ok' ? '✓ 通过' : '✗ 失败' }}
              &nbsp;{{ fmtMs(runStates.search.durationMs) }}
            </span>
          </div>
          <div class="manual-inputs">
            <n-input
              v-model:value="searchKeyword"
              placeholder="搜索关键词，如：斗破苍穹"
              size="small"
              :disabled="runStates.search.status === 'running'"
              @keydown.enter="runSearch"
            />
            <n-input-number
              v-model:value="searchPage"
              :min="1"
              size="small"
              placeholder="页码"
              style="width: 90px; flex-shrink: 0"
            />
            <n-button
              type="primary"
              size="small"
              :loading="runStates.search.status === 'running'"
              :disabled="!fileName || runStates.search.status === 'running'"
              @click="runSearch"
              >运行</n-button
            >
            <n-button
              v-if="runStates.search.status !== 'idle'"
              size="small"
              quaternary
              @click="clearState('search')"
              >清空</n-button
            >
          </div>
          <!-- 链式操作 -->
          <div v-if="runStates.search.status === 'ok'" class="chain-actions">
            <span class="chain-label">链式 →</span>
            <n-button size="tiny" @click="fillBookUrlFromSearch"
              >将首个书籍 URL 填入"详情"和"目录"</n-button
            >
          </div>
          <!-- 输出 -->
          <div v-if="runStates.search.output" class="manual-output">
            <div class="output-hd">
              <span class="output-label">{{
                runStates.search.status === 'error' ? '错误信息' : '返回结果 (JSON)'
              }}</span>
            </div>
            <pre
              class="atp-pre"
              :class="runStates.search.status === 'error' ? 'atp-pre--error' : ''"
              >{{ runStates.search.output }}</pre
            >
          </div>
        </div>
      </div>

      <!-- ── 详情 ── -->
      <div v-show="activeTab === 'bookInfo'" class="atp-pane">
        <div v-if="getAiResult('bookInfo')" class="ai-record">
          <div class="ai-record-hd">
            <span class="ai-record-icon">🤖</span>
            <span class="ai-record-title">AI 上次调试</span>
            <n-tag
              :type="getAiResult('bookInfo')!.status === 'ok' ? 'success' : 'error'"
              size="tiny"
              round
            >
              {{ getAiResult('bookInfo')!.status === 'ok' ? '通过' : '失败' }}
            </n-tag>
          </div>
          <pre class="atp-pre atp-pre--ai">{{ getAiResult('bookInfo')!.output }}</pre>
        </div>
        <div class="manual-section">
          <div class="manual-hd">
            <span class="manual-title">手动测试</span>
            <span
              v-if="runStates.bookInfo.lastRunAt"
              class="manual-meta"
              :class="runStates.bookInfo.status === 'ok' ? 'meta--ok' : 'meta--err'"
            >
              {{ runStates.bookInfo.status === 'ok' ? '✓ 通过' : '✗ 失败' }}
              &nbsp;{{ fmtMs(runStates.bookInfo.durationMs) }}
            </span>
          </div>
          <div class="manual-inputs">
            <n-input
              v-model:value="bookInfoUrl"
              placeholder="书籍 URL（bookUrl）"
              size="small"
              :disabled="runStates.bookInfo.status === 'running'"
              @keydown.enter="runBookInfo"
            />
            <n-button
              type="primary"
              size="small"
              :loading="runStates.bookInfo.status === 'running'"
              :disabled="!fileName || runStates.bookInfo.status === 'running'"
              @click="runBookInfo"
              >运行</n-button
            >
            <n-button
              v-if="runStates.bookInfo.status !== 'idle'"
              size="small"
              quaternary
              @click="clearState('bookInfo')"
              >清空</n-button
            >
          </div>
          <div v-if="runStates.bookInfo.status === 'ok'" class="chain-actions">
            <span class="chain-label">链式 →</span>
            <n-button size="tiny" @click="fillBookUrlFromDetail">将 bookUrl 填入"目录"</n-button>
          </div>
          <div v-if="runStates.bookInfo.output" class="manual-output">
            <div class="output-hd">
              <span class="output-label">{{
                runStates.bookInfo.status === 'error' ? '错误信息' : '返回结果 (JSON)'
              }}</span>
            </div>
            <pre
              class="atp-pre"
              :class="runStates.bookInfo.status === 'error' ? 'atp-pre--error' : ''"
              >{{ runStates.bookInfo.output }}</pre
            >
          </div>
        </div>
      </div>

      <!-- ── 目录 ── -->
      <div v-show="activeTab === 'chapterList'" class="atp-pane">
        <div v-if="getAiResult('chapterList')" class="ai-record">
          <div class="ai-record-hd">
            <span class="ai-record-icon">🤖</span>
            <span class="ai-record-title">AI 上次调试</span>
            <n-tag
              :type="getAiResult('chapterList')!.status === 'ok' ? 'success' : 'error'"
              size="tiny"
              round
            >
              {{ getAiResult('chapterList')!.status === 'ok' ? '通过' : '失败' }}
            </n-tag>
          </div>
          <pre class="atp-pre atp-pre--ai">{{ getAiResult('chapterList')!.output }}</pre>
        </div>
        <div class="manual-section">
          <div class="manual-hd">
            <span class="manual-title">手动测试</span>
            <span
              v-if="runStates.chapterList.lastRunAt"
              class="manual-meta"
              :class="runStates.chapterList.status === 'ok' ? 'meta--ok' : 'meta--err'"
            >
              {{ runStates.chapterList.status === 'ok' ? '✓ 通过' : '✗ 失败' }}
              &nbsp;{{ fmtMs(runStates.chapterList.durationMs) }}
            </span>
          </div>
          <div class="manual-inputs">
            <n-input
              v-model:value="chapterListUrl"
              placeholder="书籍 URL（bookUrl）"
              size="small"
              :disabled="runStates.chapterList.status === 'running'"
              @keydown.enter="runChapterList"
            />
            <n-button
              type="primary"
              size="small"
              :loading="runStates.chapterList.status === 'running'"
              :disabled="!fileName || runStates.chapterList.status === 'running'"
              @click="runChapterList"
              >运行</n-button
            >
            <n-button
              v-if="runStates.chapterList.status !== 'idle'"
              size="small"
              quaternary
              @click="clearState('chapterList')"
              >清空</n-button
            >
          </div>
          <div v-if="runStates.chapterList.status === 'ok'" class="chain-actions">
            <span class="chain-label">链式 →</span>
            <n-button size="tiny" @click="fillChapterUrlFromList">将首章 URL 填入"正文"</n-button>
          </div>
          <div v-if="runStates.chapterList.output" class="manual-output">
            <div class="output-hd">
              <span class="output-label">{{
                runStates.chapterList.status === 'error' ? '错误信息' : '返回结果 (JSON)'
              }}</span>
            </div>
            <pre
              class="atp-pre"
              :class="runStates.chapterList.status === 'error' ? 'atp-pre--error' : ''"
              >{{ runStates.chapterList.output }}</pre
            >
          </div>
        </div>
      </div>

      <!-- ── 正文 ── -->
      <div v-show="activeTab === 'chapterContent'" class="atp-pane">
        <div v-if="getAiResult('chapterContent')" class="ai-record">
          <div class="ai-record-hd">
            <span class="ai-record-icon">🤖</span>
            <span class="ai-record-title">AI 上次调试</span>
            <n-tag
              :type="getAiResult('chapterContent')!.status === 'ok' ? 'success' : 'error'"
              size="tiny"
              round
            >
              {{ getAiResult('chapterContent')!.status === 'ok' ? '通过' : '失败' }}
            </n-tag>
          </div>
          <pre class="atp-pre atp-pre--ai">{{ getAiResult('chapterContent')!.output }}</pre>
        </div>
        <div class="manual-section">
          <div class="manual-hd">
            <span class="manual-title">手动测试</span>
            <span
              v-if="runStates.chapterContent.lastRunAt"
              class="manual-meta"
              :class="runStates.chapterContent.status === 'ok' ? 'meta--ok' : 'meta--err'"
            >
              {{ runStates.chapterContent.status === 'ok' ? '✓ 通过' : '✗ 失败' }}
              &nbsp;{{ fmtMs(runStates.chapterContent.durationMs) }}
            </span>
          </div>
          <div class="manual-inputs">
            <n-input
              v-model:value="chapterContentUrl"
              placeholder="章节 URL（chapterUrl）"
              size="small"
              :disabled="runStates.chapterContent.status === 'running'"
              @keydown.enter="runChapterContent"
            />
            <n-button
              type="primary"
              size="small"
              :loading="runStates.chapterContent.status === 'running'"
              :disabled="!fileName || runStates.chapterContent.status === 'running'"
              @click="runChapterContent"
              >运行</n-button
            >
            <n-button
              v-if="runStates.chapterContent.status !== 'idle'"
              size="small"
              quaternary
              @click="clearState('chapterContent')"
              >清空</n-button
            >
          </div>
          <div v-if="runStates.chapterContent.output" class="manual-output">
            <div class="output-hd">
              <span class="output-label">{{
                runStates.chapterContent.status === 'error' ? '错误信息' : '返回结果 (JSON)'
              }}</span>
            </div>
            <pre
              class="atp-pre"
              :class="runStates.chapterContent.status === 'error' ? 'atp-pre--error' : ''"
              >{{ runStates.chapterContent.output }}</pre
            >
          </div>
        </div>
      </div>

      <!-- ── 发现 ── -->
      <div v-show="activeTab === 'explore'" class="atp-pane">
        <!-- 发现无 AI 记录，直接显示提示 -->
        <div class="ai-record ai-record--none">
          <span class="ai-record-icon">ℹ️</span>
          <span style="font-size: 12px; color: var(--color-text-muted)"
            >AI 暂不自动测试发现功能，请手动调试。留空分类名表示获取分类列表。</span
          >
        </div>
        <div class="manual-section">
          <div class="manual-hd">
            <span class="manual-title">手动测试</span>
            <span
              v-if="runStates.explore.lastRunAt"
              class="manual-meta"
              :class="runStates.explore.status === 'ok' ? 'meta--ok' : 'meta--err'"
            >
              {{ runStates.explore.status === 'ok' ? '✓ 通过' : '✗ 失败' }}
              &nbsp;{{ fmtMs(runStates.explore.durationMs) }}
            </span>
          </div>
          <div class="manual-inputs">
            <n-input
              v-model:value="exploreCategory"
              placeholder="分类名称（留空 = 获取分类列表）"
              size="small"
              :disabled="runStates.explore.status === 'running'"
              @keydown.enter="runExplore"
            />
            <n-input-number
              v-model:value="explorePage"
              :min="1"
              size="small"
              placeholder="页码"
              style="width: 90px; flex-shrink: 0"
            />
            <n-button
              type="primary"
              size="small"
              :loading="runStates.explore.status === 'running'"
              :disabled="!fileName || runStates.explore.status === 'running'"
              @click="runExplore"
              >运行</n-button
            >
            <n-button
              v-if="runStates.explore.status !== 'idle'"
              size="small"
              quaternary
              @click="clearState('explore')"
              >清空</n-button
            >
          </div>
          <div v-if="runStates.explore.output" class="manual-output">
            <div class="output-hd">
              <span class="output-label">{{
                runStates.explore.status === 'error' ? '错误信息' : '返回结果 (JSON)'
              }}</span>
            </div>
            <pre
              class="atp-pre"
              :class="runStates.explore.status === 'error' ? 'atp-pre--error' : ''"
              >{{ runStates.explore.output }}</pre
            >
          </div>
        </div>
      </div>
    </div>
    <!-- /atp-body -->

    <!-- 底部全局状态条 -->
    <div class="atp-footer">
      <span v-if="!fileName" class="footer-hint">⚠ 草稿尚未保存，请先让 AI 生成书源代码</span>
      <span v-else-if="isRunning" class="footer-running">⟳ 测试中…</span>
      <span v-else class="footer-hint">书源：{{ fileName }}</span>
    </div>
  </div>
</template>

<style scoped>
/* ── 整体 ── */
.atp {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--color-surface);
}

/* ── 选项卡行 ── */
.atp-tabs {
  display: flex;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
  background: var(--color-surface);
  padding: 0 8px;
}
.atp-tab {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 7px 10px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  color: var(--color-text-secondary);
  font-size: 12px;
  transition:
    color 0.15s,
    border-color 0.15s;
  white-space: nowrap;
}
.atp-tab:hover {
  color: var(--color-text-primary);
}
.atp-tab--active {
  color: var(--color-accent);
  border-bottom-color: var(--color-accent);
  font-weight: 600;
}
.atp-tab-label {
  font-size: 13px;
}
.atp-tab-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 10px;
  line-height: 1.4;
  font-family: monospace;
  letter-spacing: 0;
}
.atp-tab-badge--success {
  background: color-mix(in srgb, var(--color-success, #18a058) 15%, transparent);
  color: var(--color-success, #18a058);
}
.atp-tab-badge--error {
  background: color-mix(in srgb, var(--color-danger, #d03050) 15%, transparent);
  color: var(--color-danger, #d03050);
}
.atp-tab-badge--muted {
  background: var(--color-surface-hover);
  color: var(--color-text-muted);
}

/* ── 内容区 ── */
.atp-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.atp-pane {
  flex: 1;
  overflow-y: auto;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* ── AI 记录区 ── */
.ai-record {
  border: 1px solid color-mix(in srgb, var(--color-accent) 25%, transparent);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--color-accent) 5%, var(--color-surface-raised));
  padding: 8px 10px;
  flex-shrink: 0;
}
.ai-record--none {
  display: flex;
  align-items: center;
  gap: 6px;
  border-color: var(--color-border);
  background: var(--color-surface-raised);
  padding: 6px 10px;
}
.ai-record-hd {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}
.ai-record-icon {
  font-size: 13px;
}
.ai-record-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

/* ── 手动测试区 ── */
.manual-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}
.manual-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px;
}
.manual-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
}
.manual-meta {
  font-size: 12px;
  font-family: monospace;
}
.meta--ok {
  color: var(--color-success, #18a058);
}
.meta--err {
  color: var(--color-danger, #d03050);
}
.manual-inputs {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}
.manual-inputs > :first-child {
  flex: 1;
  min-width: 160px;
}

/* ── 链式操作 ── */
.chain-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  padding: 3px 0;
}
.chain-label {
  font-size: 11px;
  color: var(--color-text-muted);
}

/* ── 输出区 ── */
.manual-output {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.output-hd {
  padding: 4px 10px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}
.output-label {
  font-size: 11px;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 600;
}

/* ── pre 输出 ── */
.atp-pre {
  margin: 0;
  padding: 8px 10px;
  font-size: 12px;
  font-family: 'Consolas', 'Menlo', monospace;
  white-space: pre;
  overflow: auto;
  line-height: 1.55;
  color: var(--color-text-primary);
  background: transparent;
  flex: 1;
  max-height: 420px;
}
.atp-pre--ai {
  max-height: 180px;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 11px;
}
.atp-pre--error {
  color: var(--color-danger, #d03050);
}

/* ── 底部状态条 ── */
.atp-footer {
  flex-shrink: 0;
  border-top: 1px solid var(--color-border);
  padding: 4px 12px;
  font-size: 11px;
  background: var(--color-surface);
}
.footer-hint {
  color: var(--color-text-muted);
}
.footer-running {
  color: var(--color-accent);
  animation: blink-text 1s ease-in-out infinite;
}
@keyframes blink-text {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}
</style>
