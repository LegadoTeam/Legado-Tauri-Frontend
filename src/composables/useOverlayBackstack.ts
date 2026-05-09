import { onBeforeUnmount, watch } from 'vue';
import { useBackStackStore } from '@/stores';

export function useOverlayBackstack(isActive: () => boolean, onClose: () => void) {
  const backStack = useBackStackStore();
  let backHandler: (() => void) | null = null;

  function activate() {
    if (backHandler) {
      return;
    }
    backHandler = () => {
      backHandler = null;
      onClose();
    };
    backStack.push(backHandler);
  }

  function deactivate(options?: { consume?: boolean }) {
    if (!backHandler) {
      return;
    }
    const handler = backHandler;
    backHandler = null;
    if (options?.consume === false) {
      backStack.detach(handler);
    } else {
      backStack.remove(handler);
    }
  }

  watch(
    isActive,
    (active) => {
      if (active) {
        activate();
      } else {
        deactivate();
      }
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    deactivate({ consume: false });
  });

  return { activate, deactivate };
}
