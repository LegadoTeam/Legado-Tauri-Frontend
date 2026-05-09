<script setup lang="ts">
import { ref, watch } from 'vue';
import { useBreakpoint } from '../../composables/useBreakpoint';
import { useFocusNavigation } from '../../composables/useFocusNavigation';
import { useOverlayBackstack } from '../../composables/useOverlayBackstack';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  close: [];
}>();

const sheetRef = ref<HTMLElement | null>(null);
const { trapFocus, restoreFocus } = useFocusNavigation(sheetRef);
const { isMediumUp } = useBreakpoint();

function close() {
  emit('update:modelValue', false);
  emit('close');
  restoreFocus();
}

useOverlayBackstack(() => props.modelValue, close);

function onBackdropClick() {
  close();
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      // 等 DOM 更新后激活 focus trap
      setTimeout(() => trapFocus(), 0);
    }
  },
);
</script>

<template>
  <Teleport to="body">
    <Transition :name="isMediumUp ? 'sheet-fade' : 'sheet-slide'">
      <div
        v-if="modelValue"
        class="app-sheet-backdrop"
        :class="{ 'app-sheet-backdrop--centered': isMediumUp }"
        @click.self="onBackdropClick"
      >
        <div
          ref="sheetRef"
          class="app-sheet"
          :class="{ 'app-sheet--centered': isMediumUp }"
          role="dialog"
          aria-modal="true"
        >
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.app-sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--z-sheet);
  background: rgba(12, 16, 24, 0.48);
  display: flex;
  align-items: flex-end;
}

.app-sheet-backdrop--centered {
  align-items: center;
  justify-content: center;
}

.app-sheet {
  width: 100%;
  max-height: 80dvh;
  overflow-y: auto;
  background: var(--color-surface);
  border-radius: var(--radius-3) var(--radius-3) 0 0;
  padding-bottom: max(var(--space-4), var(--safe-bottom));
  box-shadow: var(--shadow-3);
}

.app-sheet--centered {
  width: auto;
  min-width: min(100vw - 2rem, var(--sheet-max-width));
  max-width: var(--sheet-max-width);
  max-height: 85dvh;
  border-radius: var(--radius-3);
  padding-bottom: var(--space-4);
}

/* 底部弹出动画 */
.sheet-slide-enter-active,
.sheet-slide-leave-active {
  transition: opacity var(--dur-base) var(--ease-standard);
}

.sheet-slide-enter-active .app-sheet,
.sheet-slide-leave-active .app-sheet {
  transition: transform var(--dur-base) var(--ease-standard);
}

.sheet-slide-enter-from,
.sheet-slide-leave-to {
  opacity: 0;
}

.sheet-slide-enter-from .app-sheet,
.sheet-slide-leave-to .app-sheet {
  transform: translateY(100%);
}

/* 居中淡入动画 */
.sheet-fade-enter-active,
.sheet-fade-leave-active {
  transition: opacity var(--dur-base) var(--ease-standard);
}

.sheet-fade-enter-active .app-sheet,
.sheet-fade-leave-active .app-sheet {
  transition: transform var(--dur-base) var(--ease-standard);
}

.sheet-fade-enter-from,
.sheet-fade-leave-to {
  opacity: 0;
}

.sheet-fade-enter-from .app-sheet,
.sheet-fade-leave-to .app-sheet {
  transform: scale(0.96);
}
</style>
