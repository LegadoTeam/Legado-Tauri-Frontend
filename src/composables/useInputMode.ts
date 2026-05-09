import { onMounted, onUnmounted, ref } from 'vue';

export type InputMode = 'touch' | 'mouse' | 'keyboard' | 'remote';

// 模块级单例，所有调用方共享同一个 inputMode ref
const inputMode = ref<InputMode>('mouse');

const remoteKeys = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Enter',
  'Escape',
  'Backspace',
  'ContextMenu',
]);

function setInputMode(mode: InputMode) {
  inputMode.value = mode;
  document.documentElement.dataset.inputMode = mode;
}

export function useInputMode() {
  function onPointerDown(event: PointerEvent) {
    if (event.pointerType === 'touch') {
      setInputMode('touch');
      return;
    }

    if (event.pointerType === 'mouse') {
      setInputMode('mouse');
      return;
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    if (remoteKeys.has(event.key)) {
      setInputMode('remote');
      return;
    }

    if (event.key === 'Tab') {
      setInputMode('keyboard');
    }
  }

  onMounted(() => {
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
  });

  onUnmounted(() => {
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('keydown', onKeyDown, true);
  });

  return {
    inputMode,
    setInputMode,
  };
}
