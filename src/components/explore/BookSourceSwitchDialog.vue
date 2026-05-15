<script setup lang="ts">
import { ChevronLeft, X, ChevronRight } from 'lucide-vue-next';
import { useMessage } from 'naive-ui';
import { computed, ref, watch } from 'vue';
import type { BookDetail, BookItem, BookSourceMeta, ChapterItem } from '@/types';
import { useOverlayBackstack } from '@/composables/useOverlayBackstack';
import {
  type CachedChapter,
  type ShelfBook,
  type UpdateShelfBookPayload,
  useBookshelfStore,
  usePreferencesStore,
  useScriptBridgeStore,
} from '@/stores';
import { listBookSources } from '../../composables/useBookSource';
import { isMobile } from '../../composables/useEnv';
import { mapWithConcurrencyLimit } from '../../utils/async';
import { getBookMetaLine, getLatestChapterText } from '../../utils/bookMeta';
import {
  SWITCHABLE_METADATA_FIELDS,
  buildDiffPair,
  type ChapterMatchCandidate,
  type MetadataFieldKey,
  type SourceCandidate,
  type SwitchableBookMeta,
  applyMetadataSelection,
  buildCandidateBookMeta,
  diffMetadataFields,
  getMetadataValue,
  rankBookCandidates,
  rankChapterMatches,
} from '../../utils/bookSourceSwitch';
import { getCoverImageUrl } from '../../utils/coverImage';
import BookCoverImg from '../BookCoverImg.vue';

interface WholeBookSwitchedPayload {
  shelfBook: ShelfBook;
  chapters: ChapterItem[];
  matchedChapterIndex: number;
  matchedChapterUrl?: string;
  matchedChapterName?: string;
  sourceSwitched: boolean;
}

interface TemporaryChapterSwitchPayload {
  chapterIndex: number;
  fileName: string;
  sourceName: string;
  sourceBookUrl: string;
  chapterUrl: string;
  chapterName: string;
  reason: string;
  score: number;
}

const props = defineProps<{
  show: boolean;
  mode: 'whole-book' | 'chapter-temp';
  currentBook: SwitchableBookMeta;
  currentFileName: string;
  currentSourceName: string;
  currentSourceType?: string;
  currentChapters: ChapterItem[];
  currentReadChapterIndex: number;
  currentReadChapterUrl?: string;
  shelfBookId?: string;
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'whole-book-switched', payload: WholeBookSwitchedPayload): void;
  (e: 'chapter-temp-switched', payload: TemporaryChapterSwitchPayload): void;
}>();

const message = useMessage();
const { runSearch, runBookInfo, runChapterList } = useScriptBridgeStore();
const { updateBook } = useBookshelfStore();
const prefsStore = usePreferencesStore();

const availableSources = ref<BookSourceMeta[]>([]);
const searching = ref(false);
const loadingCandidate = ref(false);
const applying = ref(false);
const searchKeyword = ref('');
const currentBookState = ref<SwitchableBookMeta>({ ...props.currentBook });
const candidates = ref<SourceCandidate[]>([]);
const selectedCandidateKey = ref('');
const candidateDetail = ref<BookDetail | null>(null);
const candidateChapters = ref<ChapterItem[]>([]);
const selectedMetadataFields = ref<MetadataFieldKey[]>([]);
const syncFutureChapters = ref(true);
const selectedMatchChapterIndex = ref<number | null>(null);
const mobilePage = ref<'list' | 'detail'>('list');
const activeSearchToken = ref(0);
const activeDetailToken = ref(0);

const dialogTitle = computed(() =>
  props.mode === 'chapter-temp' ? '当前章节临时换源' : '整本换源与元信息覆盖',
);

const selectedCandidate = computed(
  () => candidates.value.find((candidate) => candidate.key === selectedCandidateKey.value) ?? null,
);

function candidateLatestChapter(book: BookItem): string {
  return getLatestChapterText(book);
}

function candidateMetaLine(book: BookItem): string[] {
  return getBookMetaLine(book);
}

const candidateMeta = computed<SwitchableBookMeta | null>(() =>
  selectedCandidate.value
    ? buildCandidateBookMeta(selectedCandidate.value.book, candidateDetail.value)
    : null,
);

const comparisonRows = computed(() =>
  SWITCHABLE_METADATA_FIELDS.map(({ key, label }) => {
    const currentValue = getMetadataValue(currentBookState.value, key).trim();
    const candidateValue = candidateMeta.value
      ? getMetadataValue(candidateMeta.value, key).trim()
      : '';
    return {
      key,
      label,
      currentValue,
      candidateValue,
      diff: buildDiffPair(currentValue, candidateValue),
      different: !!candidateValue && currentValue !== candidateValue,
    };
  }),
);

const matchingChapters = computed<ChapterMatchCandidate[]>(() => {
  if (props.currentReadChapterIndex < 0 || !candidateChapters.value.length) {
    return [];
  }
  return rankChapterMatches(
    props.currentChapters,
    props.currentReadChapterIndex,
    candidateChapters.value,
  );
});

const selectedMatch = computed(
  () =>
    matchingChapters.value.find((item) => item.index === selectedMatchChapterIndex.value) ?? null,
);

const canApplyMetadataOnly = computed(
  () =>
    selectedMetadataFields.value.some((field) => {
      const row = comparisonRows.value.find((item) => item.key === field);
      return !!row?.candidateValue;
    }) || props.mode === 'chapter-temp',
);

const applyButtonText = computed(() => {
  if (props.mode === 'chapter-temp') {
    return '替换当前章节正文';
  }
  return syncFutureChapters.value ? '应用整本换源' : '批量应用选中字段';
});

const showDesktopSplit = computed(() => !isMobile.value);
const showMobileList = computed(() => isMobile.value && mobilePage.value === 'list');
const showMobileDetail = computed(
  () => isMobile.value && mobilePage.value === 'detail' && !!selectedCandidate.value,
);
const desktopDetailVisible = computed(() => !isMobile.value && !!selectedCandidate.value);

useOverlayBackstack(() => props.show, closeDialog);

function closeDialog() {
  emit('update:show', false);
}

function goMobileList() {
  mobilePage.value = 'list';
}

function selectCandidate(candidateKey: string) {
  selectedCandidateKey.value = candidateKey;
  if (isMobile.value) {
    mobilePage.value = 'detail';
  }
}

function refreshSelectedMetadataFields(nextCurrent = currentBookState.value) {
  if (!candidateMeta.value) {
    selectedMetadataFields.value = [];
    return;
  }
  selectedMetadataFields.value = diffMetadataFields(nextCurrent, candidateMeta.value);
}

function buildCachedChapters(chapters: ChapterItem[]): CachedChapter[] {
  return chapters.map((chapter, index) => ({
    index,
    name: chapter.name,
    url: chapter.url,
  }));
}

function toggleMetadataField(field: MetadataFieldKey, checked: boolean) {
  const next = new Set(selectedMetadataFields.value);
  if (checked) {
    next.add(field);
  } else {
    next.delete(field);
  }
  selectedMetadataFields.value = [...next];
}

function buildMetadataOnlyPayload(nextCurrent: SwitchableBookMeta): UpdateShelfBookPayload {
  return {
    id: props.shelfBookId ?? '',
    name: currentBookState.value.name,
    author: nextCurrent.author,
    coverUrl: getCoverImageUrl(nextCurrent.coverUrl),
    intro: nextCurrent.intro,
    kind: nextCurrent.kind,
    bookUrl: currentBookState.value.bookUrl ?? '',
    fileName: props.currentFileName,
    sourceName: props.currentSourceName,
    lastChapter: nextCurrent.lastChapter,
    totalChapters: props.currentChapters.length,
    readChapterIndex: props.currentReadChapterIndex,
    readChapterUrl: props.currentReadChapterUrl,
    sourceType: props.currentSourceType ?? 'novel',
    createSourceSwitchBackup: false,
    clearContentCache: false,
  };
}

async function applySingleField(field: MetadataFieldKey) {
  if (!props.shelfBookId) {
    message.warning('请先把当前书籍加入书架，再写入单个字段');
    return;
  }
  if (!candidateMeta.value?.[field]) {
    message.warning('候选书源没有可写入的值');
    return;
  }

  applying.value = true;
  try {
    const nextCurrent = applyMetadataSelection(currentBookState.value, candidateMeta.value, [
      field,
    ]);
    const shelfBook = await updateBook(buildMetadataOnlyPayload(nextCurrent));
    currentBookState.value = nextCurrent;
    refreshSelectedMetadataFields(nextCurrent);
    emit('whole-book-switched', {
      shelfBook,
      chapters: props.currentChapters,
      matchedChapterIndex: props.currentReadChapterIndex,
      matchedChapterUrl: props.currentReadChapterUrl,
      matchedChapterName:
        props.currentReadChapterIndex >= 0
          ? props.currentChapters[props.currentReadChapterIndex]?.name
          : undefined,
      sourceSwitched: false,
    });
    const label = SWITCHABLE_METADATA_FIELDS.find((item) => item.key === field)?.label ?? field;
    message.success(`${label} 已更新`);
  } catch (error) {
    message.error(`写入失败: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    applying.value = false;
  }
}

async function loadSources() {
  const all = await listBookSources();
  availableSources.value = all.filter((source) => {
    if (!source.enabled || source.fileName === props.currentFileName) {
      return false;
    }
    if (props.currentSourceType && source.sourceType !== props.currentSourceType) {
      return false;
    }
    return true;
  });
}

async function performSearch() {
  const keyword = searchKeyword.value.trim();
  const requestToken = activeSearchToken.value + 1;
  activeSearchToken.value = requestToken;
  if (!keyword) {
    candidates.value = [];
    selectedCandidateKey.value = '';
    return;
  }

  searching.value = true;
  try {
    const results = await mapWithConcurrencyLimit(
      [...availableSources.value],
      prefsStore.search.switchSourceConcurrency || 5,
      async (source) => {
        try {
          const raw = await runSearch(source.fileName, keyword, 1, source.sourceDir);
          if (requestToken !== activeSearchToken.value) {
            return [] as SourceCandidate[];
          }
          const list = Array.isArray(raw) ? (raw as BookItem[]) : [];
          return list
            .map((book) =>
              rankBookCandidates(
                props.currentBook,
                source.name,
                source.fileName,
                book,
                source.logo,
              ),
            )
            .filter((candidate): candidate is SourceCandidate => !!candidate);
        } catch {
          return [] as SourceCandidate[];
        }
      },
    );

    if (requestToken !== activeSearchToken.value) {
      return;
    }

    const merged = results.flatMap((result) => result);
    merged.sort((left, right) => right.score - left.score);
    candidates.value = merged;
    selectedCandidateKey.value = merged[0]?.key ?? '';
    if (!showDesktopSplit.value && merged[0]) {
      mobilePage.value = 'list';
    }
  } finally {
    searching.value = false;
  }
}

async function loadSelectedCandidate() {
  const candidate = selectedCandidate.value;
  const requestToken = activeDetailToken.value + 1;
  activeDetailToken.value = requestToken;
  if (!candidate) {
    candidateDetail.value = null;
    candidateChapters.value = [];
    selectedMetadataFields.value = [];
    selectedMatchChapterIndex.value = null;
    return;
  }

  loadingCandidate.value = true;
  try {
    const detail = (await runBookInfo(candidate.fileName, candidate.book.bookUrl)) as BookDetail;
    if (requestToken !== activeDetailToken.value) {
      return;
    }
    candidateDetail.value = detail;
    const tocUrl = detail.tocUrl ?? candidate.book.bookUrl;
    const rawChapters = await runChapterList(candidate.fileName, tocUrl);
    if (requestToken !== activeDetailToken.value) {
      return;
    }
    candidateChapters.value = Array.isArray(rawChapters) ? (rawChapters as ChapterItem[]) : [];
    refreshSelectedMetadataFields();
    selectedMatchChapterIndex.value = matchingChapters.value[0]?.index ?? null;
  } catch (error) {
    if (requestToken !== activeDetailToken.value) {
      return;
    }
    candidateDetail.value = null;
    candidateChapters.value = [];
    selectedMetadataFields.value = [];
    selectedMatchChapterIndex.value = null;
    message.error(
      `加载候选书源详情失败: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    if (requestToken === activeDetailToken.value) {
      loadingCandidate.value = false;
    }
  }
}

async function initialize() {
  activeSearchToken.value += 1;
  activeDetailToken.value += 1;
  searchKeyword.value = props.currentBook.name?.trim() || '';
  currentBookState.value = { ...props.currentBook };
  syncFutureChapters.value = props.mode === 'whole-book';
  mobilePage.value = 'list';
  candidates.value = [];
  selectedCandidateKey.value = '';
  candidateDetail.value = null;
  candidateChapters.value = [];
  selectedMetadataFields.value = [];
  selectedMatchChapterIndex.value = null;
  await loadSources();
  if (searchKeyword.value) {
    await performSearch();
  }
}

async function applySelection() {
  const candidate = selectedCandidate.value;
  const nextMeta = candidateMeta.value;
  if (!candidate || !nextMeta) {
    message.warning('请先选择一个候选书源');
    return;
  }

  if (props.mode === 'chapter-temp') {
    const match = selectedMatch.value;
    if (!match) {
      message.warning('当前未找到可用的章节匹配结果');
      return;
    }
    emit('chapter-temp-switched', {
      chapterIndex: props.currentReadChapterIndex,
      fileName: candidate.fileName,
      sourceName: candidate.sourceName,
      sourceBookUrl: candidate.book.bookUrl,
      chapterUrl: match.url,
      chapterName: match.name,
      reason: match.reasons.join(' / '),
      score: match.score,
    });
    closeDialog();
    return;
  }

  if (!props.shelfBookId) {
    message.warning('请先把当前书籍加入书架，再使用整本换源');
    return;
  }
  if (!syncFutureChapters.value && !canApplyMetadataOnly.value) {
    message.warning('至少选择一个可覆盖字段');
    return;
  }
  if (syncFutureChapters.value && !candidateChapters.value.length) {
    message.warning('目标书源未返回章节目录，无法整本换源');
    return;
  }

  applying.value = true;
  try {
    const mergedMeta = applyMetadataSelection(
      currentBookState.value,
      nextMeta,
      selectedMetadataFields.value,
    );

    let nextFileName = props.currentFileName;
    let nextSourceName = props.currentSourceName;
    let nextBookUrl = currentBookState.value.bookUrl ?? '';
    let nextChapters = props.currentChapters;
    let nextReadChapterIndex = props.currentReadChapterIndex;
    let nextReadChapterUrl = props.currentReadChapterUrl;

    if (syncFutureChapters.value) {
      nextFileName = candidate.fileName;
      nextSourceName = candidate.sourceName;
      nextBookUrl = candidate.book.bookUrl;
      nextChapters = candidateChapters.value;

      if (props.currentReadChapterIndex >= 0) {
        const match = selectedMatch.value ??
          matchingChapters.value[0] ?? {
            index: Math.min(props.currentReadChapterIndex, candidateChapters.value.length - 1),
            url:
              candidateChapters.value[
                Math.min(props.currentReadChapterIndex, candidateChapters.value.length - 1)
              ]?.url ?? '',
          };
        if (!match) {
          message.warning('没有可用的章节匹配结果，无法保持阅读位置');
          return;
        }
        nextReadChapterIndex = match.index;
        nextReadChapterUrl = match.url;
      }
    }

    const payload: UpdateShelfBookPayload = {
      id: props.shelfBookId,
      name: currentBookState.value.name,
      author: mergedMeta.author,
      coverUrl: getCoverImageUrl(mergedMeta.coverUrl),
      intro: mergedMeta.intro,
      kind: mergedMeta.kind,
      bookUrl: nextBookUrl,
      fileName: nextFileName,
      sourceName: nextSourceName,
      lastChapter: syncFutureChapters.value
        ? nextMeta.lastChapter || nextChapters[nextChapters.length - 1]?.name
        : mergedMeta.lastChapter,
      totalChapters: syncFutureChapters.value ? nextChapters.length : props.currentChapters.length,
      readChapterIndex: nextReadChapterIndex,
      readChapterUrl: nextReadChapterUrl,
      sourceType: props.currentSourceType ?? 'novel',
      createSourceSwitchBackup: syncFutureChapters.value,
      clearContentCache: syncFutureChapters.value,
    };

    const shelfBook = await updateBook(
      payload,
      syncFutureChapters.value ? buildCachedChapters(nextChapters) : undefined,
    );

    emit('whole-book-switched', {
      shelfBook,
      chapters: nextChapters,
      matchedChapterIndex: nextReadChapterIndex,
      matchedChapterUrl: nextReadChapterUrl,
      matchedChapterName:
        nextReadChapterIndex >= 0 ? nextChapters[nextReadChapterIndex]?.name : undefined,
      sourceSwitched: syncFutureChapters.value,
    });

    message.success(syncFutureChapters.value ? '整本换源已应用' : '元信息已覆盖');
    closeDialog();
  } catch (error) {
    message.error(`应用换源失败: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    applying.value = false;
  }
}

watch(
  () => props.show,
  (visible) => {
    if (visible) {
      void initialize();
      return;
    }
    activeSearchToken.value += 1;
    activeDetailToken.value += 1;
    searching.value = false;
    loadingCandidate.value = false;
  },
);

watch(selectedCandidateKey, () => {
  if (props.show) {
    void loadSelectedCandidate();
  }
});

watch(matchingChapters, (matches) => {
  if (!matches.length) {
    selectedMatchChapterIndex.value = null;
    return;
  }
  if (!matches.some((match) => match.index === selectedMatchChapterIndex.value)) {
    selectedMatchChapterIndex.value = matches[0].index;
  }
});
</script>

<template>
  <n-modal
    :show="show"
    :mask-closable="false"
    :auto-focus="false"
    :trap-focus="false"
    @update:show="emit('update:show', $event)"
  >
    <div class="switch-dialog__viewport">
      <div
        class="switch-dialog__shell"
        :class="{ 'switch-dialog__shell--compact': !desktopDetailVisible }"
      >
        <div class="switch-dialog__topbar">
          <button
            v-if="showMobileDetail"
            class="switch-dialog__icon-btn"
            type="button"
            @click="goMobileList"
          >
            <ChevronLeft :size="18" />
          </button>
          <div v-else class="switch-dialog__icon-gap" />

          <div class="switch-dialog__topbar-copy">
            <div class="switch-dialog__topbar-title">
              {{
                showMobileDetail
                  ? candidateMeta?.name || selectedCandidate?.book.name || dialogTitle
                  : dialogTitle
              }}
            </div>
            <div class="switch-dialog__topbar-subtitle">
              {{
                showMobileDetail
                  ? `${selectedCandidate?.sourceName ?? ''} · 差异详情`
                  : '选择候选书源并比较差异'
              }}
            </div>
          </div>

          <button class="switch-dialog__icon-btn" type="button" @click="closeDialog">
            <X :size="18" />
          </button>
        </div>

        <div
          class="switch-dialog__body"
          :class="{ 'switch-dialog__body--compact': !desktopDetailVisible }"
        >
          <section
            v-show="showDesktopSplit || showMobileList"
            class="switch-dialog__panel switch-dialog__panel--list"
            :class="{ 'switch-dialog__panel--list-compact': !desktopDetailVisible }"
          >
            <div class="switch-dialog__scroll app-scrollbar">
              <div class="switch-dialog__toolbar">
                <n-input
                  v-model:value="searchKeyword"
                  placeholder="输入书名重新搜索"
                  @keydown.enter.prevent="performSearch"
                />
                <n-button type="primary" :loading="searching" @click="performSearch"
                  >搜索候选书源</n-button
                >
              </div>

              <n-alert
                v-if="mode === 'whole-book' && !shelfBookId"
                type="warning"
                style="margin-bottom: 12px"
              >
                整本换源需要先加入书架，才能持久化目录、正文和元信息。
              </n-alert>

              <n-alert type="info" style="margin-bottom: 12px">
                当前按书名 100%
                匹配同一本书，书名固定不替换；可对作者、封面、简介、分类、最新章节分别比较并独立写入。
              </n-alert>

              <div class="switch-dialog__list-summary">
                <div class="switch-dialog__summary-title">候选书源</div>
                <div class="switch-dialog__summary-subtitle">点击书源进入详细差异页</div>
              </div>

              <n-spin :show="searching">
                <n-empty
                  v-if="!candidates.length"
                  description="还没有找到可用候选，尝试更换关键词或先启用更多书源"
                />
                <button
                  v-for="candidate in candidates"
                  v-else
                  :key="candidate.key"
                  class="switch-dialog__candidate"
                  :class="{
                    'switch-dialog__candidate--active': candidate.key === selectedCandidateKey,
                  }"
                  @click="selectCandidate(candidate.key)"
                >
                  <div class="switch-dialog__candidate-main">
                    <div class="switch-dialog__candidate-body">
                      <div v-if="candidate.book.coverUrl" class="switch-dialog__candidate-cover">
                        <BookCoverImg
                          :src="candidate.book.coverUrl"
                          :base-url="candidate.book.bookUrl"
                          :alt="`${candidate.book.name} 封面`"
                        />
                      </div>

                      <div class="switch-dialog__candidate-copy">
                        <div class="switch-dialog__candidate-title">{{ candidate.book.name }}</div>
                        <div class="switch-dialog__candidate-meta">
                          <span>{{ candidate.sourceName }}</span>
                          <span>匹配 {{ candidate.score }}</span>
                        </div>
                        <div class="switch-dialog__candidate-sub">
                          {{ candidate.book.author || '作者未知' }}
                        </div>
                        <div
                          v-if="candidateLatestChapter(candidate.book)"
                          class="switch-dialog__candidate-sub"
                        >
                          最新章节：{{ candidateLatestChapter(candidate.book) }}
                        </div>
                        <div v-if="candidate.book.status" class="switch-dialog__candidate-sub">
                          状态：{{ candidate.book.status }}
                        </div>
                        <div
                          v-if="candidateMetaLine(candidate.book).length"
                          class="switch-dialog__candidate-sub"
                        >
                          {{ candidateMetaLine(candidate.book).join(' · ') }}
                        </div>
                      </div>
                    </div>
                    <ChevronRight class="switch-dialog__candidate-arrow" :size="18" />
                  </div>
                </button>
              </n-spin>
            </div>
          </section>

          <section
            v-show="showDesktopSplit || showMobileDetail"
            class="switch-dialog__panel switch-dialog__panel--detail"
            :class="{ 'switch-dialog__panel--detail-hidden': !desktopDetailVisible }"
          >
            <div class="switch-dialog__scroll app-scrollbar">
              <n-empty v-if="!selectedCandidate" description="请选择候选书源查看差异" />

              <n-spin v-else :show="loadingCandidate">
                <div class="switch-dialog__header">
                  <div>
                    <div class="switch-dialog__title">
                      {{ candidateMeta?.name || selectedCandidate.book.name }}
                    </div>
                    <div class="switch-dialog__subtitle">
                      {{ selectedCandidate.sourceName }}
                      ·
                      {{ candidateMeta?.author || selectedCandidate.book.author || '作者未知' }}
                    </div>
                  </div>
                  <div class="switch-dialog__header-tags">
                    <n-tag type="default" :bordered="false">
                      书名固定：{{ currentBookState.name }}
                    </n-tag>
                    <n-tag type="info" :bordered="false">
                      候选目录 {{ candidateChapters.length }} 章
                    </n-tag>
                  </div>
                </div>

                <div class="switch-dialog__section">
                  <div class="switch-dialog__section-title">元信息差异</div>
                  <div class="switch-dialog__rows">
                    <div
                      v-for="row in comparisonRows"
                      :key="row.key"
                      class="switch-dialog__row"
                      :class="{ 'switch-dialog__row--same': !row.different }"
                    >
                      <div class="switch-dialog__row-check">
                        <n-checkbox
                          :checked="selectedMetadataFields.includes(row.key)"
                          :disabled="!row.candidateValue"
                          @update:checked="
                            (checked: boolean) => toggleMetadataField(row.key, checked)
                          "
                        />
                        <span>{{ row.label }}</span>
                        <n-tag v-if="!row.different" size="small" :bordered="false">一致</n-tag>
                        <n-tag v-else size="small" type="warning" :bordered="false">有差异</n-tag>
                        <n-button
                          v-if="mode === 'whole-book'"
                          text
                          size="small"
                          class="switch-dialog__row-apply"
                          :disabled="!row.different || !shelfBookId || applying"
                          @click="applySingleField(row.key)"
                        >
                          立即应用
                        </n-button>
                      </div>

                      <div v-if="row.key === 'coverUrl'" class="switch-dialog__cover-values">
                        <div class="switch-dialog__cover-card">
                          <div class="switch-dialog__row-label">当前</div>
                          <div class="switch-dialog__cover-frame">
                            <BookCoverImg
                              :src="currentBookState.coverUrl"
                              :base-url="currentBookState.bookUrl"
                              :alt="`${currentBookState.name} 当前封面`"
                            />
                          </div>
                          <div class="switch-dialog__cover-url">
                            {{ row.currentValue || '无封面地址' }}
                          </div>
                        </div>

                        <div class="switch-dialog__cover-card">
                          <div class="switch-dialog__row-label">候选</div>
                          <div class="switch-dialog__cover-frame">
                            <BookCoverImg
                              :src="candidateMeta?.coverUrl"
                              :base-url="candidateMeta?.bookUrl"
                              :alt="`${candidateMeta?.name || currentBookState.name} 候选封面`"
                            />
                          </div>
                          <div class="switch-dialog__cover-url">
                            {{ row.candidateValue || '无封面地址' }}
                          </div>
                        </div>
                      </div>

                      <div v-else class="switch-dialog__row-values">
                        <div>
                          <div class="switch-dialog__row-label">当前</div>
                          <div class="switch-dialog__row-text">
                            <template v-if="row.currentValue">
                              <span
                                v-for="(segment, index) in row.diff.current"
                                :key="`current-${row.key}-${index}`"
                                class="switch-dialog__diff-segment"
                                :class="`switch-dialog__diff-segment--${segment.kind}`"
                              >
                                {{ segment.text }}
                              </span>
                            </template>
                            <span v-else>空</span>
                          </div>
                        </div>

                        <div>
                          <div class="switch-dialog__row-label">候选</div>
                          <div class="switch-dialog__row-text">
                            <template v-if="row.candidateValue">
                              <span
                                v-for="(segment, index) in row.diff.candidate"
                                :key="`candidate-${row.key}-${index}`"
                                class="switch-dialog__diff-segment"
                                :class="`switch-dialog__diff-segment--${segment.kind}`"
                              >
                                {{ segment.text }}
                              </span>
                            </template>
                            <span v-else>空</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div v-if="mode === 'whole-book'" class="switch-dialog__section">
                  <div class="switch-dialog__section-title">应用方式</div>
                  <div class="switch-dialog__mode">
                    <div class="switch-dialog__mode-copy">
                      <div>同步切换后续目录与正文</div>
                      <span>关闭时仅覆盖上方勾选字段，不改当前书源。</span>
                    </div>
                    <n-switch
                      :value="syncFutureChapters"
                      :disabled="!shelfBookId"
                      @update:value="syncFutureChapters = $event"
                    />
                  </div>
                </div>

                <div
                  v-if="
                    (mode === 'chapter-temp' || syncFutureChapters) && currentReadChapterIndex >= 0
                  "
                  class="switch-dialog__section"
                >
                  <div class="switch-dialog__section-title">章节匹配</div>
                  <n-empty
                    v-if="!matchingChapters.length"
                    description="没有找到足够可靠的章节候选，建议先只覆盖元信息"
                  />
                  <n-radio-group
                    v-else
                    :value="selectedMatchChapterIndex"
                    @update:value="selectedMatchChapterIndex = Number($event)"
                  >
                    <div class="switch-dialog__match-list">
                      <label
                        v-for="match in matchingChapters"
                        :key="match.index"
                        class="switch-dialog__match"
                      >
                        <div class="switch-dialog__match-radio">
                          <n-radio :value="match.index" />
                        </div>
                        <div class="switch-dialog__match-main">
                          <div class="switch-dialog__match-title">
                            {{ match.name }}
                            <n-tag size="small" :bordered="false">评分 {{ match.score }}</n-tag>
                          </div>
                          <div class="switch-dialog__match-reason">
                            {{ match.reasons.join(' / ') }}
                          </div>
                        </div>
                      </label>
                    </div>
                  </n-radio-group>
                </div>
              </n-spin>
            </div>
          </section>
        </div>

        <div class="switch-dialog__footer">
          <n-button v-if="showMobileDetail" @click="goMobileList">返回列表</n-button>
          <n-button v-else @click="closeDialog">取消</n-button>
          <n-button
            type="primary"
            :loading="applying"
            :disabled="
              !selectedCandidate ||
              (mode === 'whole-book' && !syncFutureChapters && !canApplyMetadataOnly)
            "
            @click="applySelection"
          >
            {{ applyButtonText }}
          </n-button>
        </div>
      </div>
    </div>
  </n-modal>
</template>

<style scoped>
.switch-dialog__viewport {
  padding: 16px 24px;
  box-sizing: border-box;
}

.switch-dialog__shell {
  width: min(1160px, calc(100vw - 48px));
  min-height: min(720px, calc(100vh - 32px));
  max-height: calc(100vh - 32px);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  overflow: hidden;
  background: var(--color-surface);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
  border: 1px solid var(--color-border);
  transition:
    width var(--dur-base) var(--ease-standard),
    min-height var(--dur-base) var(--ease-standard),
    max-height var(--dur-base) var(--ease-standard);
}

.switch-dialog__shell--compact {
  width: min(700px, calc(100vw - 48px));
}

.switch-dialog__topbar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 18px 22px 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.switch-dialog__topbar-copy {
  min-width: 0;
  flex: 1;
}

.switch-dialog__topbar-title {
  font-size: var(--fs-18);
  font-weight: var(--fw-bold);
  color: var(--color-text);
}

.switch-dialog__topbar-subtitle {
  margin-top: 2px;
  font-size: var(--fs-12);
  color: var(--color-text-muted);
}

.switch-dialog__icon-btn,
.switch-dialog__icon-gap {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
}

.switch-dialog__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-text-soft);
  cursor: pointer;
  transition:
    transform var(--dur-fast) var(--ease-standard),
    border-color var(--dur-fast) var(--ease-standard),
    background var(--dur-fast) var(--ease-standard);
}

@media (hover: hover) and (pointer: fine) {
  .switch-dialog__icon-btn:hover {
    transform: translateY(-1px);
    border-color: var(--color-accent);
    background: var(--color-hover);
  }
}

.switch-dialog__body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  transition: grid-template-columns var(--dur-base) var(--ease-standard);
}

.switch-dialog__body--compact {
  grid-template-columns: minmax(0, 1fr) 0fr;
}

.switch-dialog__panel {
  min-width: 0;
  min-height: 0;
}

.switch-dialog__panel--list {
  border-right: 1px solid var(--color-border);
  background: var(--color-surface);
  transition:
    border-color var(--dur-base) var(--ease-standard),
    background var(--dur-base) var(--ease-standard);
}

.switch-dialog__panel--list-compact {
  border-right-color: transparent;
}

.switch-dialog__panel--detail {
  min-width: 0;
  opacity: 1;
  transform: translateX(0);
  transition:
    opacity var(--dur-base) var(--ease-standard),
    transform var(--dur-base) var(--ease-standard),
    border-color var(--dur-base) var(--ease-standard);
}

.switch-dialog__panel--detail-hidden {
  opacity: 0;
  pointer-events: none;
  overflow: hidden;
  transform: translateX(20px);
}

.switch-dialog__scroll {
  height: 100%;
  overflow: auto;
  padding: 18px 20px 22px;
  box-sizing: border-box;
}

.switch-dialog__toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 14px;
}

.switch-dialog__list-summary {
  margin-bottom: 12px;
}

.switch-dialog__summary-title {
  font-size: var(--fs-14);
  font-weight: var(--fw-bold);
  color: var(--color-text);
}

.switch-dialog__summary-subtitle {
  margin-top: 4px;
  font-size: var(--fs-12);
  color: var(--color-text-muted);
}

.switch-dialog__candidate {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: 16px;
  background: var(--color-surface);
  padding: 14px;
  text-align: left;
  margin-bottom: 10px;
  cursor: pointer;
  transition:
    border-color var(--dur-fast) var(--ease-standard),
    transform var(--dur-fast) var(--ease-standard),
    background var(--dur-fast) var(--ease-standard);
}

@media (hover: hover) and (pointer: fine) {
  .switch-dialog__candidate:hover {
    border-color: var(--color-accent);
    background: var(--color-surface);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-accent) 30%, transparent);
    transform: translateY(-1px);
  }
}
.switch-dialog__candidate--active {
  border-color: var(--color-accent);
  background: var(--color-surface);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-accent) 30%, transparent);
  transform: translateY(-1px);
}

.switch-dialog__candidate-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.switch-dialog__candidate-body {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.switch-dialog__candidate-copy {
  min-width: 0;
  flex: 1;
}

.switch-dialog__candidate-cover {
  width: 52px;
  height: 70px;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
}

.switch-dialog__candidate-title {
  font-weight: var(--fw-bold);
  color: var(--color-text);
}

.switch-dialog__candidate-meta,
.switch-dialog__candidate-sub,
.switch-dialog__subtitle,
.switch-dialog__match-reason,
.switch-dialog__mode-copy span,
.switch-dialog__row-label {
  font-size: var(--fs-12);
  color: var(--color-text-muted);
}

.switch-dialog__candidate-meta {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
}

.switch-dialog__candidate-sub {
  margin-top: 4px;
}

.switch-dialog__candidate-arrow {
  flex-shrink: 0;
  color: var(--color-text-muted);
}

.switch-dialog__header,
.switch-dialog__mode,
.switch-dialog__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.switch-dialog__title {
  font-size: var(--fs-18);
  font-weight: var(--fw-bold);
  color: var(--color-text);
}

.switch-dialog__header-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.switch-dialog__section {
  margin-top: 18px;
}

.switch-dialog__section-title {
  margin-bottom: 10px;
  font-size: var(--fs-13);
  font-weight: var(--fw-bold);
  color: var(--color-text-soft);
}

.switch-dialog__rows,
.switch-dialog__match-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.switch-dialog__row,
.switch-dialog__match {
  border: 1px solid var(--color-border);
  border-radius: 16px;
  background: var(--color-surface);
  padding: 12px;
}

.switch-dialog__row--same {
  opacity: 0.72;
}

.switch-dialog__row-check {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 10px;
  font-weight: var(--fw-semibold);
}

.switch-dialog__row-apply {
  margin-left: auto;
}

.switch-dialog__row-values,
.switch-dialog__cover-values {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.switch-dialog__row-text {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.72;
  color: var(--color-text);
}

.switch-dialog__diff-segment--removed {
  background: color-mix(in srgb, var(--color-danger) 18%, transparent);
  color: color-mix(in srgb, var(--color-danger) 82%, var(--color-text) 18%);
  border-radius: 4px;
}

.switch-dialog__diff-segment--added {
  background: color-mix(in srgb, var(--color-success) 18%, transparent);
  color: color-mix(in srgb, var(--color-success) 82%, var(--color-text) 18%);
  border-radius: 4px;
}

.switch-dialog__cover-frame {
  width: 132px;
  height: 176px;
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
}

.switch-dialog__cover-url {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-text-muted);
  word-break: break-all;
}

.switch-dialog__match {
  display: flex;
  gap: 10px;
}

.switch-dialog__match-radio {
  padding-top: 4px;
}

.switch-dialog__match-main {
  min-width: 0;
  flex: 1;
}

.switch-dialog__match-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  color: var(--color-text);
  font-weight: var(--fw-semibold);
}

.switch-dialog__footer {
  flex-shrink: 0;
  justify-content: flex-end;
  padding: 16px 22px 18px;
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);
}

@media (max-width: 860px) {
  .switch-dialog__viewport {
    padding: 10px;
  }

  .switch-dialog__shell {
    width: calc(100vw - 20px);
    min-height: min(680px, calc(100vh - 20px));
    max-height: calc(100vh - 20px);
    border-radius: 14px;
  }

  .switch-dialog__shell--compact {
    width: calc(100vw - 20px);
  }

  .switch-dialog__topbar {
    padding: 14px 14px 12px;
  }

  .switch-dialog__body,
  .switch-dialog__row-values,
  .switch-dialog__cover-values {
    grid-template-columns: 1fr;
    display: grid;
  }

  .switch-dialog__toolbar,
  .switch-dialog__footer {
    display: flex;
    flex-direction: column;
    align-items: stretch;
  }

  .switch-dialog__panel--list {
    border-right: none;
    background: transparent;
  }

  .switch-dialog__panel--detail-hidden {
    opacity: 1;
    pointer-events: auto;
    overflow: visible;
    transform: none;
  }

  .switch-dialog__scroll {
    padding: 14px 14px 18px;
  }

  .switch-dialog__header {
    align-items: flex-start;
    flex-direction: column;
  }

  .switch-dialog__header-tags {
    justify-content: flex-start;
  }

  .switch-dialog__cover-frame {
    width: 120px;
    height: 160px;
  }
}
</style>
