<script setup lang="ts">
import { Bug } from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import {
  ensureFrontendNamespaceLoaded,
  getFrontendStorageItem,
  setFrontendStorageItem,
} from '@/composables/useFrontendStorage';

defineProps<{
  unreadCount: number;
}>();

const emit = defineEmits<{
  /** 点击（非拖拽）时触发，用于恢复展开日志面板 */
  open: [];
}>();

const FAB_SIZE = 44;
const STORAGE_NS = 'ui.log-fab';
const STORAGE_KEY = 'pos';

const fabLeft = ref(0);
const fabTop = ref(0);
const fabInitialized = ref(false);

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function savePos() {
  setFrontendStorageItem(
    STORAGE_NS,
    STORAGE_KEY,
    JSON.stringify({ left: fabLeft.value, top: fabTop.value }),
  );
}

function initPos() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = vw - FAB_SIZE - 12;
  let top = vh - FAB_SIZE - 64;
  try {
    const raw = getFrontendStorageItem(STORAGE_NS, STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { left?: unknown; top?: unknown };
      if (typeof parsed.left === 'number' && typeof parsed.top === 'number') {
        left = parsed.left;
        top = parsed.top;
      }
    }
  } catch {
    // 读取失败时使用默认位置
  }
  fabLeft.value = clamp(left, 0, vw - FAB_SIZE);
  fabTop.value = clamp(top, 0, vh - FAB_SIZE);
  fabInitialized.value = true;
}

onMounted(() => {
  void ensureFrontendNamespaceLoaded(STORAGE_NS, () => null);
  initPos();
});

const fabStyle = computed(() => ({
  left: `${fabLeft.value}px`,
  top: `${fabTop.value}px`,
  visibility: (fabInitialized.value ? 'visible' : 'hidden') as 'visible' | 'hidden',
}));

let _dragging = false;
let _moved = false;
let _sx = 0;
let _sy = 0;
let _sl = 0;
let _st = 0;

function onPointerDown(e: PointerEvent) {
  _dragging = true;
  _moved = false;
  _sx = e.clientX;
  _sy = e.clientY;
  _sl = fabLeft.value;
  _st = fabTop.value;
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  e.preventDefault();
}

function onPointerMove(e: PointerEvent) {
  if (!_dragging) {
    return;
  }
  const dx = e.clientX - _sx;
  const dy = e.clientY - _sy;
  if (Math.abs(dx) + Math.abs(dy) > 5) {
    _moved = true;
  }
  fabLeft.value = clamp(_sl + dx, 0, window.innerWidth - FAB_SIZE);
  fabTop.value = clamp(_st + dy, 0, window.innerHeight - FAB_SIZE);
}

function onPointerUp() {
  if (!_dragging) {
    return;
  }
  _dragging = false;
  if (_moved) {
    savePos();
  } else {
    emit('open');
  }
}
</script>

<template>
  <button
    class="log-fab"
    :style="fabStyle"
    title="日志调试（已最小化，点击恢复）"
    aria-label="恢复日志面板"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <Bug :size="20" />
    <span v-if="unreadCount > 0" class="log-fab__badge">{{
      unreadCount > 99 ? '99+' : unreadCount
    }}</span>
  </button>
</template>

<style scoped>
.log-fab {
  position: fixed;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: #18181b;
  color: #d4d4d8;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  box-shadow:
    0 2px 12px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.08);
  /* 始终在最顶层，高于任何弹窗 */
  z-index: 99999;
  -webkit-tap-highlight-color: transparent;
  touch-action: none;
  user-select: none;
  transition: background 120ms ease;
}

.log-fab:active {
  cursor: grabbing;
  background: #27272a;
}

.log-fab__badge {
  position: absolute;
  top: -3px;
  right: -3px;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  background: #ef4444;
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
  font-family: inherit;
  pointer-events: none;
}
</style>
