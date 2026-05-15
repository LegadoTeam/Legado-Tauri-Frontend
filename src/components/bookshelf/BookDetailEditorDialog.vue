<script setup lang="ts">
import { Edit3, Eye, Save, X } from 'lucide-vue-next';
import { useMessage, type SelectOption } from 'naive-ui';
import { computed, reactive, ref, watch } from 'vue';
import { useOverlayBackstack } from '@/composables/useOverlayBackstack';
import { useBookshelfStore, type ShelfBook, type UpdateShelfBookPayload } from '@/stores';
import BookCoverImg from '../BookCoverImg.vue';

type DetailMode = 'view' | 'edit';

interface DetailForm {
  name: string;
  author: string;
  coverUrl: string;
  intro: string;
  kind: string;
  bookUrl: string;
  fileName: string;
  sourceName: string;
  lastChapter: string;
  totalChapters: number | null;
  readChapterIndex: number | null;
  readChapterUrl: string;
  sourceType: string;
  addedAt: number | null;
  lastReadAt: number | null;
  readPageIndex: number | null;
  readScrollRatio: number | null;
  readPlaybackTime: number | null;
  readerSettings: string;
  isPrivate: boolean;
}

const props = defineProps<{
  show: boolean;
  book: ShelfBook | null;
  initialMode: DetailMode;
}>();

const emit = defineEmits<{
  'update:show': [value: boolean];
  saved: [bookId: string];
}>();

const message = useMessage();
const bookshelfStore = useBookshelfStore();

const mode = ref<DetailMode>('view');
const saving = ref(false);
const detailBook = ref<ShelfBook | null>(null);
const form = reactive<DetailForm>({
  name: '',
  author: '',
  coverUrl: '',
  intro: '',
  kind: '',
  bookUrl: '',
  fileName: '',
  sourceName: '',
  lastChapter: '',
  totalChapters: 0,
  readChapterIndex: -1,
  readChapterUrl: '',
  sourceType: 'novel',
  addedAt: 0,
  lastReadAt: 0,
  readPageIndex: -1,
  readScrollRatio: -1,
  readPlaybackTime: -1,
  readerSettings: '',
  isPrivate: false,
});

const sourceTypeOptions: SelectOption[] = [
  { label: '小说', value: 'novel' },
  { label: '漫画', value: 'comic' },
  { label: '视频', value: 'video' },
];

const dialogTitle = computed(() => (mode.value === 'edit' ? '编辑书籍详情' : '书籍详情'));

const currentRows = computed(() => {
  const book = detailBook.value;
  if (!book) {
    return [];
  }
  return [
    { label: '书籍 ID', value: book.id },
    { label: '书名', value: book.name },
    { label: '作者', value: book.author },
    { label: '分类', value: book.kind },
    { label: '书源类型', value: sourceTypeLabel(book.sourceType) },
    { label: '书籍 URL', value: book.bookUrl },
    { label: '书源文件', value: book.fileName },
    { label: '书源名称', value: book.sourceName },
    { label: '最新章节', value: book.lastChapter },
    { label: '总章节数', value: book.totalChapters },
    { label: '阅读章节索引', value: book.readChapterIndex },
    { label: '阅读章节 URL', value: book.readChapterUrl },
    { label: '分页页码', value: book.readPageIndex },
    { label: '滚动比例', value: book.readScrollRatio },
    { label: '视频播放秒数', value: book.readPlaybackTime },
    { label: '加入时间', value: formatTimestamp(book.addedAt) },
    { label: '最后阅读时间', value: formatTimestamp(book.lastReadAt) },
    { label: '隐私书籍', value: book.isPrivate ? '是' : '否' },
  ];
});

function sourceTypeLabel(value: string): string {
  const label = sourceTypeOptions.find((item) => item.value === value)?.label;
  return String(label ?? (value || '小说'));
}

function optionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeInt(value: number | null, fallback: number): number {
  return Number.isFinite(value) ? Math.trunc(value as number) : fallback;
}

function normalizeNumber(value: number | null, fallback: number): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function formatTimestamp(value: number): string {
  if (!value) {
    return '未记录';
  }
  return `${new Date(value).toLocaleString()} (${value})`;
}

function resetForm(book: ShelfBook | null) {
  detailBook.value = book;
  if (!book) {
    return;
  }
  form.name = book.name;
  form.author = book.author;
  form.coverUrl = book.coverUrl ?? '';
  form.intro = book.intro ?? '';
  form.kind = book.kind ?? '';
  form.bookUrl = book.bookUrl;
  form.fileName = book.fileName;
  form.sourceName = book.sourceName;
  form.lastChapter = book.lastChapter ?? '';
  form.totalChapters = book.totalChapters;
  form.readChapterIndex = book.readChapterIndex;
  form.readChapterUrl = book.readChapterUrl ?? '';
  form.sourceType = book.sourceType || 'novel';
  form.addedAt = book.addedAt;
  form.lastReadAt = book.lastReadAt;
  form.readPageIndex = book.readPageIndex;
  form.readScrollRatio = book.readScrollRatio;
  form.readPlaybackTime = book.readPlaybackTime;
  form.readerSettings = book.readerSettings ?? '';
  form.isPrivate = book.isPrivate;
}

function validateForm(): string | null {
  if (!form.name.trim()) {
    return '书名不能为空';
  }
  if (!form.bookUrl.trim()) {
    return '书籍 URL 不能为空';
  }
  if (!form.fileName.trim()) {
    return '书源文件不能为空';
  }
  if (!form.sourceName.trim()) {
    return '书源名称不能为空';
  }
  if (!form.sourceType.trim()) {
    return '书源类型不能为空';
  }
  return null;
}

async function saveDetail() {
  const book = detailBook.value;
  if (!book || saving.value) {
    return;
  }
  const error = validateForm();
  if (error) {
    message.warning(error);
    return;
  }

  saving.value = true;
  try {
    const payload: UpdateShelfBookPayload = {
      id: book.id,
      name: form.name.trim(),
      author: form.author.trim(),
      coverUrl: optionalText(form.coverUrl),
      intro: optionalText(form.intro),
      kind: optionalText(form.kind),
      bookUrl: form.bookUrl.trim(),
      fileName: form.fileName.trim(),
      sourceName: form.sourceName.trim(),
      lastChapter: optionalText(form.lastChapter),
      totalChapters: Math.max(0, normalizeInt(form.totalChapters, book.totalChapters)),
      readChapterIndex: normalizeInt(form.readChapterIndex, book.readChapterIndex),
      readChapterUrl: optionalText(form.readChapterUrl),
      sourceType: form.sourceType.trim(),
      addedAt: Math.max(0, normalizeInt(form.addedAt, book.addedAt)),
      lastReadAt: Math.max(0, normalizeInt(form.lastReadAt, book.lastReadAt)),
      readPageIndex: normalizeInt(form.readPageIndex, book.readPageIndex),
      readScrollRatio: normalizeNumber(form.readScrollRatio, book.readScrollRatio),
      readPlaybackTime: normalizeNumber(form.readPlaybackTime, book.readPlaybackTime),
      readerSettings: form.readerSettings,
      isPrivate: form.isPrivate,
    };
    const saved = await bookshelfStore.updateBook(payload);
    detailBook.value = saved;
    resetForm(saved);
    mode.value = 'view';
    emit('saved', saved.id);
    message.success('书籍详情已保存');
  } catch (saveError) {
    message.error(
      `保存失败: ${saveError instanceof Error ? saveError.message : String(saveError)}`,
    );
  } finally {
    saving.value = false;
  }
}

function closeDialog() {
  emit('update:show', false);
}

useOverlayBackstack(() => props.show, closeDialog);

watch(
  () => [props.show, props.book, props.initialMode] as const,
  ([show, book, initialMode]) => {
    if (!show) {
      return;
    }
    mode.value = initialMode;
    resetForm(book);
  },
  { immediate: true },
);
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    class="book-detail-dialog"
    :title="dialogTitle"
    :bordered="false"
    :mask-closable="true"
    transform-origin="center"
    @update:show="emit('update:show', $event)"
  >
    <template #header-extra>
      <div class="bd-actions">
        <n-button
          v-if="mode === 'view'"
          size="small"
          quaternary
          :disabled="!detailBook"
          @click="mode = 'edit'"
        >
          <template #icon>
            <Edit3 :size="15" />
          </template>
          编辑
        </n-button>
        <n-button v-else size="small" quaternary :disabled="saving" @click="mode = 'view'">
          <template #icon>
            <Eye :size="15" />
          </template>
          查看
        </n-button>
      </div>
    </template>

    <div v-if="!detailBook" class="bd-empty">
      <p>没有选中的书籍</p>
      <n-button type="primary" @click="closeDialog">关闭</n-button>
    </div>

    <div v-else-if="mode === 'view'" class="bd-view app-scrollbar">
      <div class="bd-summary">
        <div class="bd-cover">
          <BookCoverImg
            :src="
              detailBook.coverReferer && detailBook.coverUrl
                ? { url: detailBook.coverUrl, referer: detailBook.coverReferer }
                : detailBook.coverUrl
            "
            :alt="detailBook.name"
            :base-url="detailBook.bookUrl"
          />
          <span v-if="!detailBook.coverUrl">暂无封面</span>
        </div>
        <div class="bd-title">
          <h3>{{ detailBook.name || '未知书名' }}</h3>
          <p>{{ detailBook.author || '佚名' }}</p>
          <p>
            {{ sourceTypeLabel(detailBook.sourceType) }} ·
            {{ detailBook.sourceName || '未知书源' }}
          </p>
        </div>
      </div>

      <section class="bd-section">
        <h4>简介</h4>
        <p class="bd-long-text">{{ detailBook.intro || '未记录' }}</p>
      </section>

      <section class="bd-section">
        <h4>详细字段</h4>
        <dl class="bd-detail-grid">
          <template v-for="row in currentRows" :key="row.label">
            <dt>{{ row.label }}</dt>
            <dd>{{ row.value ?? '未记录' }}</dd>
          </template>
        </dl>
      </section>

      <section class="bd-section">
        <h4>阅读器设置</h4>
        <pre class="bd-pre">{{ detailBook.readerSettings || '未记录' }}</pre>
      </section>
    </div>

    <n-form v-else class="bd-form app-scrollbar" label-placement="top" size="small">
      <div class="bd-form-grid">
        <n-form-item label="书名">
          <n-input v-model:value="form.name" />
        </n-form-item>
        <n-form-item label="作者">
          <n-input v-model:value="form.author" />
        </n-form-item>
        <n-form-item label="分类">
          <n-input v-model:value="form.kind" />
        </n-form-item>
        <n-form-item label="书源类型">
          <n-select v-model:value="form.sourceType" :options="sourceTypeOptions" />
        </n-form-item>
        <n-form-item label="书源名称">
          <n-input v-model:value="form.sourceName" />
        </n-form-item>
        <n-form-item label="书源文件">
          <n-input v-model:value="form.fileName" />
        </n-form-item>
        <n-form-item label="书籍 URL">
          <n-input v-model:value="form.bookUrl" />
        </n-form-item>
        <n-form-item label="封面 URL">
          <n-input v-model:value="form.coverUrl" />
        </n-form-item>
        <n-form-item label="最新章节">
          <n-input v-model:value="form.lastChapter" />
        </n-form-item>
        <n-form-item label="总章节数">
          <n-input-number v-model:value="form.totalChapters" :min="0" :precision="0" />
        </n-form-item>
        <n-form-item label="阅读章节索引">
          <n-input-number v-model:value="form.readChapterIndex" :min="-1" :precision="0" />
        </n-form-item>
        <n-form-item label="阅读章节 URL">
          <n-input v-model:value="form.readChapterUrl" />
        </n-form-item>
        <n-form-item label="分页页码">
          <n-input-number v-model:value="form.readPageIndex" :min="-1" :precision="0" />
        </n-form-item>
        <n-form-item label="滚动比例">
          <n-input-number v-model:value="form.readScrollRatio" :min="-1" :max="1" :step="0.01" />
        </n-form-item>
        <n-form-item label="视频播放秒数">
          <n-input-number v-model:value="form.readPlaybackTime" :min="-1" :step="1" />
        </n-form-item>
        <n-form-item label="加入时间戳">
          <n-input-number v-model:value="form.addedAt" :min="0" :precision="0" />
        </n-form-item>
        <n-form-item label="最后阅读时间戳">
          <n-input-number v-model:value="form.lastReadAt" :min="0" :precision="0" />
        </n-form-item>
        <n-form-item label="隐私书籍">
          <n-switch v-model:value="form.isPrivate" />
        </n-form-item>
      </div>

      <n-form-item label="简介">
        <n-input
          v-model:value="form.intro"
          type="textarea"
          :autosize="{ minRows: 4, maxRows: 8 }"
        />
      </n-form-item>
      <n-form-item label="阅读器设置 JSON">
        <n-input
          v-model:value="form.readerSettings"
          type="textarea"
          :autosize="{ minRows: 4, maxRows: 10 }"
        />
      </n-form-item>
    </n-form>

    <template #footer>
      <div class="bd-footer">
        <n-button quaternary :disabled="saving" @click="closeDialog">
          <template #icon>
            <X :size="15" />
          </template>
          关闭
        </n-button>
        <n-button v-if="mode === 'edit'" type="primary" :loading="saving" @click="saveDetail">
          <template #icon>
            <Save :size="15" />
          </template>
          保存
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
:global(.book-detail-dialog) {
  width: min(980px, calc(100vw - 32px));
  max-height: min(90dvh, 840px);
}

:global(.book-detail-dialog .n-card__content) {
  padding: 0;
  overflow: hidden;
}

.bd-actions,
.bd-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.bd-empty {
  display: flex;
  min-height: 220px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--color-text-muted);
}

.bd-view,
.bd-form {
  max-height: min(72dvh, 680px);
  overflow-y: auto;
  padding: 18px;
}

.bd-summary {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  gap: 14px;
  align-items: center;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--color-border);
}

.bd-cover {
  display: flex;
  aspect-ratio: 3 / 4;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 6px;
  background: var(--color-surface-soft);
  color: var(--color-text-muted);
  font-size: var(--fs-12);
}

.bd-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.bd-title {
  min-width: 0;
}

.bd-title h3 {
  margin: 0 0 6px;
  font-size: 1.05rem;
  font-weight: var(--fw-semibold);
  color: var(--color-text);
}

.bd-title p {
  margin: 3px 0;
  color: var(--color-text-muted);
  font-size: var(--fs-13);
}

.bd-section {
  padding-top: 16px;
}

.bd-section h4 {
  margin: 0 0 10px;
  font-size: var(--fs-13);
  font-weight: var(--fw-semibold);
  color: var(--color-text-soft);
}

.bd-long-text {
  margin: 0;
  white-space: pre-wrap;
  line-height: 1.65;
  color: var(--color-text);
}

.bd-detail-grid {
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr);
  gap: 8px 14px;
  margin: 0;
}

.bd-detail-grid dt {
  color: var(--color-text-muted);
}

.bd-detail-grid dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--color-text);
}

.bd-pre {
  max-height: 220px;
  margin: 0;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  border-radius: 6px;
  background: var(--color-surface-soft);
  padding: 10px;
  color: var(--color-text);
}

.bd-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 14px;
}

.bd-footer {
  width: 100%;
}

@media (max-width: 640px) {
  :global(.book-detail-dialog) {
    width: calc(100vw - 16px);
  }

  .bd-view,
  .bd-form {
    max-height: 72dvh;
    padding: 14px;
  }

  .bd-form-grid,
  .bd-detail-grid {
    grid-template-columns: 1fr;
  }

  .bd-detail-grid {
    gap: 4px;
  }

  .bd-detail-grid dt {
    font-weight: var(--fw-semibold);
  }
}
</style>
