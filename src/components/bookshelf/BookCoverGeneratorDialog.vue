<script setup lang="ts">
import { Check, RefreshCw } from 'lucide-vue-next';
import { useMessage } from 'naive-ui';
import { computed, onUnmounted, ref, watch } from 'vue';
import { useBookshelfStore, type ShelfBook } from '@/stores';
import { BUILTIN_COVER_GENERATORS } from '@/utils/defaultCoverGenerators';
import BookCoverImg from '../BookCoverImg.vue';
import { useOverlayBackstack } from '@/composables/useOverlayBackstack';

type PreviewStatus = 'pending' | 'generating' | 'ready' | 'error';

interface CoverPreviewItem {
  id: string;
  name: string;
  description: string;
  status: PreviewStatus;
  coverUrl: string;
  error: string;
}

const props = defineProps<{
  show: boolean;
  book: ShelfBook | null;
}>();

const emit = defineEmits<{
  'update:show': [value: boolean];
  applied: [bookId: string];
}>();

const message = useMessage();
const { patchBook, loadBooks } = useBookshelfStore();

const previews = ref<CoverPreviewItem[]>([]);
const applyingId = ref('');
const generatedKey = ref('');
let generationRunId = 0;

const readyCount = computed(() => previews.value.filter((item) => item.status === 'ready').length);
const generating = computed(() => previews.value.some((item) => item.status === 'generating'));
const totalCount = computed(() => previews.value.length);

function makeBookKey(book: ShelfBook): string {
  return `${book.id}|${book.name}|${book.author}|${book.kind ?? ''}`;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function resetPreviewState() {
  previews.value = BUILTIN_COVER_GENERATORS.map((generator) => ({
    id: generator.id,
    name: generator.name,
    description: generator.description,
    status: 'pending',
    coverUrl: '',
    error: '',
  }));
}

async function generatePreviews(book: ShelfBook, force = false) {
  const key = makeBookKey(book);
  if (!force && generatedKey.value === key && previews.value.length) {
    return;
  }
  generatedKey.value = key;
  generationRunId += 1;
  const runId = generationRunId;
  resetPreviewState();

  for (const generator of BUILTIN_COVER_GENERATORS) {
    if (runId !== generationRunId) {
      return;
    }
    const item = previews.value.find((preview) => preview.id === generator.id);
    if (!item) {
      continue;
    }
    item.status = 'generating';
    item.error = '';
    await nextFrame();
    try {
      const coverUrl = generator.generate(book);
      if (runId !== generationRunId) {
        return;
      }
      item.coverUrl = coverUrl;
      item.status = 'ready';
    } catch (error) {
      item.status = 'error';
      item.error = error instanceof Error ? error.message : String(error);
    }
    await nextFrame();
  }
}

function regenerate() {
  if (props.book) {
    void generatePreviews(props.book, true);
  }
}

async function applyCover(item: CoverPreviewItem) {
  const book = props.book;
  if (!book || item.status !== 'ready' || !item.coverUrl || applyingId.value) {
    return;
  }
  applyingId.value = item.id;
  try {
    await patchBook(book.id, { coverUrl: item.coverUrl });
    await loadBooks();
    emit('applied', book.id);
    message.success(`已应用 ${item.name}`);
  } catch (error) {
    message.error(`应用封面失败: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    applyingId.value = '';
  }
}

function closeDialog() {
  emit('update:show', false);
}

useOverlayBackstack(() => props.show, closeDialog);

watch(
  () => [props.show, props.book] as const,
  ([show, book]) => {
    if (!show) {
      generationRunId += 1;
      return;
    }
    if (book) {
      void generatePreviews(book);
    } else {
      resetPreviewState();
    }
  },
  { immediate: true },
);

onUnmounted(() => {
  generationRunId += 1;
});
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    class="cover-generator-dialog"
    title="生成封面"
    :bordered="false"
    :mask-closable="true"
    transform-origin="center"
    @update:show="emit('update:show', $event)"
  >
    <template #header-extra>
      <n-button size="small" quaternary :disabled="!book || generating" @click="regenerate">
        <template #icon>
          <RefreshCw :size="15" />
        </template>
        重新生成
      </n-button>
    </template>

    <div v-if="!book" class="cg-empty">
      <p class="cg-empty__title">没有选中的书籍</p>
      <p class="cg-empty__desc">请先从书架选择一本书。</p>
      <n-button type="primary" @click="closeDialog">关闭</n-button>
    </div>

    <div v-else class="cg-dialog">
      <div class="cg-summary">
        <div class="cg-summary__cover">
          <BookCoverImg
            :src="book.coverReferer && book.coverUrl ? { url: book.coverUrl, referer: book.coverReferer } : book.coverUrl"
            :alt="book.name"
            :base-url="book.bookUrl"
          />
          <span v-if="!book.coverUrl">暂无封面</span>
        </div>
        <div class="cg-summary__meta">
          <h3>{{ book.name }}</h3>
          <p>{{ book.author || '佚名' }}</p>
          <p>预览 {{ totalCount }} 种内置封面，已生成 {{ readyCount }} 张</p>
        </div>
      </div>

      <section class="cg-grid app-scrollbar" aria-label="封面预览列表">
        <article
          v-for="item in previews"
          :key="item.id"
          class="cg-card"
          :class="`cg-card--${item.status}`"
        >
          <div class="cg-card__preview">
            <img v-if="item.coverUrl" :src="item.coverUrl" :alt="item.name" loading="lazy" />
            <div v-else-if="item.status === 'generating'" class="cg-card__state">
              <n-spin size="small" />
              <span>生成中</span>
            </div>
            <div v-else-if="item.status === 'error'" class="cg-card__state cg-card__state--error">
              <span>生成失败</span>
            </div>
            <div v-else class="cg-card__state">
              <span>等待生成</span>
            </div>
          </div>
          <div class="cg-card__body">
            <div class="cg-card__info">
              <h3>{{ item.name }}</h3>
              <p>{{ item.error || item.description }}</p>
            </div>
            <button
              class="cg-card__apply focusable"
              type="button"
              :disabled="item.status !== 'ready' || applyingId === item.id"
              @click="applyCover(item)"
            >
              <Check v-if="item.status === 'ready'" :size="14" />
              <span>
                {{
                  applyingId === item.id ? '应用中' : item.status === 'ready' ? '应用' : item.name
                }}
              </span>
            </button>
          </div>
        </article>
      </section>
    </div>
  </n-modal>
</template>

<style scoped>
:global(.cover-generator-dialog) {
  width: min(1160px, calc(100vw - 32px));
  max-height: min(88dvh, 820px);
}

:global(.cover-generator-dialog .n-card__content) {
  padding: 0;
  overflow: hidden;
}

.cg-dialog {
  display: flex;
  flex-direction: column;
  height: min(78dvh, 730px);
  min-height: 460px;
}

.cg-summary {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid var(--color-border);
}

.cg-summary__cover {
  aspect-ratio: 5 / 7;
  overflow: hidden;
  border-radius: 6px;
  background: color-mix(in srgb, var(--color-text) 8%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  font-size: var(--fs-11);
}

.cg-summary__cover img,
.cg-card__preview img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.cg-summary__meta h3 {
  margin: 0 0 4px;
  color: var(--color-text);
  font-size: var(--fs-16);
  line-height: var(--lh-tight);
}

.cg-summary__meta p {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--fs-13);
}

.cg-grid {
  --cg-card-w: clamp(168px, 16vw, 196px);
  --cg-gap: clamp(10px, 1.6vw, 24px);
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  align-items: flex-start;
  justify-content: space-evenly;
  column-gap: var(--cg-gap);
  row-gap: calc(var(--cg-gap) + 4px);
  padding: clamp(12px, 1.6vw, 20px);
}

.cg-card {
  flex: 0 0 var(--cg-card-w);
  width: var(--cg-card-w);
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--color-surface) 82%, transparent);
  display: flex;
  flex-direction: column;
}

.cg-card__preview {
  position: relative;
  flex: 0 0 auto;
  width: 100%;
  height: calc(var(--cg-card-w) * 1.4);
  background: color-mix(in srgb, var(--color-text) 7%, transparent);
}

.cg-card__state {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  font-size: var(--fs-13);
}

.cg-card__state--error {
  color: var(--color-danger);
}

.cg-card__body {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  justify-content: space-between;
  min-height: 112px;
  padding: 10px;
  background: color-mix(in srgb, var(--color-surface) 92%, transparent);
}

.cg-card__apply {
  flex: 0 0 auto;
  align-self: flex-end;
  min-width: 82px;
  height: 30px;
  padding: 0 12px;
  border: 0;
  border-radius: 6px;
  background: var(--color-accent);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  font-size: var(--fs-12);
  font-weight: var(--fw-semibold);
  cursor: pointer;
}

.cg-card__apply:disabled {
  cursor: default;
  opacity: 0.6;
  background: color-mix(in srgb, var(--color-text) 18%, transparent);
}

.cg-card__info {
  flex: 1 1 auto;
  min-width: 0;
}

.cg-card__info h3 {
  min-width: 0;
  margin: 0;
  font-size: var(--fs-14);
  line-height: var(--lh-tight);
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cg-card__info p {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--fs-12);
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.cg-empty {
  min-height: 280px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--color-text-muted);
}

.cg-empty__title {
  margin: 0;
  font-size: var(--fs-18);
  font-weight: var(--fw-bold);
  color: var(--color-text);
}

.cg-empty__desc {
  margin: 0 0 8px;
}

@media (pointer: coarse), (max-width: 720px) {
  :global(.cover-generator-dialog) {
    width: 100vw;
    max-width: 100vw;
    height: calc(100dvh - var(--safe-area-inset-top, env(safe-area-inset-top, 0px)));
    max-height: calc(100dvh - var(--safe-area-inset-top, env(safe-area-inset-top, 0px)));
    margin: var(--safe-area-inset-top, env(safe-area-inset-top, 0px)) 0 0;
    border-radius: 16px 16px 0 0;
  }

  .cg-dialog {
    height: calc(
      100dvh - var(--safe-area-inset-top, env(safe-area-inset-top, 0px)) - 68px
    );
    min-height: 0;
  }

  .cg-summary {
    grid-template-columns: 52px minmax(0, 1fr);
    padding: 10px 12px;
  }

  .cg-grid {
    --cg-gap: clamp(8px, 3vw, 14px);
    display: flex;
    flex-direction: column;
    flex-wrap: nowrap;
    align-items: stretch;
    gap: var(--cg-gap);
    padding: var(--cg-gap);
    justify-content: flex-start;
  }

  .cg-card {
    width: 100%;
    min-width: 0;
    flex-basis: auto;
    flex-direction: row;
  }

  .cg-card__preview {
    width: 128px;
    height: 179px;
    flex: 0 0 128px;
  }

  .cg-card__body {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 179px;
    justify-content: space-between;
    gap: 7px;
    padding: 10px;
  }

  .cg-card__apply {
    align-self: flex-end;
    min-width: 88px;
    width: auto;
    height: 30px;
    padding: 0 12px;
  }

  .cg-card__info p {
    -webkit-line-clamp: 3;
  }
}

@media (max-width: 380px) {
  .cg-card__preview {
    width: 112px;
    height: 157px;
    flex-basis: 112px;
  }

  .cg-card__body {
    min-height: 157px;
  }
}
</style>
