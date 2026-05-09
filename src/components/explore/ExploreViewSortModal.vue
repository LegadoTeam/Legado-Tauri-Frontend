<script setup lang="ts">
import { GripVertical } from 'lucide-vue-next';
import { ref, watch } from 'vue';
import { useOverlayBackstack } from '@/composables/useOverlayBackstack';
import type { BookSourceMeta } from '@/types';

const props = defineProps<{
  show: boolean;
  sources: BookSourceMeta[];
}>();

const emit = defineEmits<{
  'update:show': [value: boolean];
  confirm: [fileNames: string[]];
}>();

useOverlayBackstack(
  () => props.show,
  () => emit('update:show', false),
);

// 排序列表（打开弹窗时从 sources 初始化）
const sortList = ref<BookSourceMeta[]>([]);

watch(
  () => props.show,
  (visible) => {
    if (visible) {
      sortList.value = [...props.sources];
    }
  },
);

function handleConfirm() {
  emit('confirm', sortList.value.map((s) => s.fileName));
  emit('update:show', false);
}

// ── 排序列表拖拽（Pointer Events，避免 Tauri/WebView2 DnD 问题） ─────────
const sortListEl = ref<HTMLElement | null>(null);
const ptrFrom = ref(-1);
const ptrOver = ref(-1);

function startSortDrag(e: PointerEvent, idx: number) {
  e.preventDefault();
  ptrFrom.value = idx;
  ptrOver.value = idx;

  function onMove(ev: PointerEvent) {
    if (!sortListEl.value) {
      return;
    }
    const items = sortListEl.value.querySelectorAll<HTMLElement>('[data-sidx]');
    for (const item of items) {
      const r = item.getBoundingClientRect();
      if (ev.clientY >= r.top && ev.clientY <= r.bottom) {
        ptrOver.value = Number(item.dataset.sidx);
        break;
      }
    }
  }

  function onUp() {
    window.removeEventListener('pointermove', onMove);
    const from = ptrFrom.value;
    const to = ptrOver.value;
    ptrFrom.value = -1;
    ptrOver.value = -1;
    if (from >= 0 && to >= 0 && from !== to) {
      const arr = [...sortList.value];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      sortList.value = arr;
    }
  }

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp, { once: true });
}
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    title="书源排序"
    class="ev-sort-modal"
    :style="{ width: '340px', maxWidth: '95vw' }"
    :mask-closable="true"
    @update:show="(v) => emit('update:show', v)"
  >
    <div ref="sortListEl" class="ev-sort-list">
      <div
        v-for="(src, idx) in sortList"
        :key="src.fileName"
        :data-sidx="idx"
        class="ev-sort-item"
        :class="{
          'ev-sort-item--dragging': ptrFrom === idx,
          'ev-sort-item--drag-over': ptrOver === idx && ptrFrom !== idx,
        }"
      >
        <span class="ev-sort-item__handle" @pointerdown="startSortDrag($event, idx)">
          <GripVertical :size="16" />
        </span>
        <span class="ev-sort-item__name">{{ src.name }}</span>
      </div>
    </div>
    <template #footer>
      <div style="display: flex; justify-content: flex-end; gap: 8px">
        <n-button size="small" @click="emit('update:show', false)">取消</n-button>
        <n-button size="small" type="primary" @click="handleConfirm">确定</n-button>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
/* ── 排序弹窗 ──────────────────────────── */
.ev-sort-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  user-select: none;
}

.ev-sort-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: var(--space-2) 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-2);
  background: var(--color-surface);
  transition:
    background var(--dur-fast) var(--ease-standard),
    box-shadow var(--dur-fast) var(--ease-standard),
    border-color var(--dur-fast) var(--ease-standard);
}

.ev-sort-item--dragging {
  opacity: 0.35;
  border-style: dashed;
}

.ev-sort-item--drag-over {
  border-color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 10%, transparent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 30%, transparent);
}

.ev-sort-item__handle {
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  flex-shrink: 0;
  cursor: grab;
  touch-action: none;
  padding: 2px 4px;
  border-radius: var(--radius-1);
  transition:
    color var(--dur-fast) var(--ease-standard),
    background var(--dur-fast) var(--ease-standard);
}
@media (hover: hover) and (pointer: fine) {
  .ev-sort-item__handle:hover {
    color: var(--color-accent);
    background: var(--color-hover);
  }
}
.ev-sort-item__handle:active {
  cursor: grabbing;
}

.ev-sort-item__name {
  flex: 1;
  font-size: var(--fs-14);
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
