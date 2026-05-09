import { onMounted, onUnmounted } from 'vue';

type RemoteAction = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back' | 'menu';

const keyMap: Record<string, RemoteAction | undefined> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Enter: 'confirm',
  ' ': 'confirm',
  Escape: 'back',
  Backspace: 'back',
  ContextMenu: 'menu',
};

function getFocusableElements(container: ParentNode = document): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      [
        'button:not(:disabled)',
        'a[href]',
        'input:not(:disabled)',
        'select:not(:disabled)',
        'textarea:not(:disabled)',
        "[tabindex]:not([tabindex='-1'])",
        "[role='button']",
        "[role='option']",
      ].join(','),
    ),
  ).filter((el) => {
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
}

function focusElement(el: HTMLElement | undefined) {
  if (!el) return;
  el.focus({ preventScroll: false });
  el.dataset.focused = 'true';

  setTimeout(() => {
    el.dataset.focused = 'false';
  }, 180);
}

function findNearestByDirection(
  current: HTMLElement,
  elements: HTMLElement[],
  direction: 'up' | 'down' | 'left' | 'right',
): HTMLElement | undefined {
  const currentRect = current.getBoundingClientRect();
  const currentCenterX = currentRect.left + currentRect.width / 2;
  const currentCenterY = currentRect.top + currentRect.height / 2;

  let best: HTMLElement | undefined;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const el of elements) {
    if (el === current) continue;

    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = centerX - currentCenterX;
    const dy = centerY - currentCenterY;

    const isCandidate =
      (direction === 'up' && dy < -4) ||
      (direction === 'down' && dy > 4) ||
      (direction === 'left' && dx < -4) ||
      (direction === 'right' && dx > 4);

    if (!isCandidate) continue;

    const primary = direction === 'up' || direction === 'down' ? Math.abs(dy) : Math.abs(dx);
    const secondary = direction === 'up' || direction === 'down' ? Math.abs(dx) : Math.abs(dy);
    const score = primary * 2 + secondary;

    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }

  return best;
}

export function useRemoteControl(options?: {
  onBack?: () => void;
  onMenu?: () => void;
  onLeft?: () => boolean | void;
  onRight?: () => boolean | void;
  onUp?: () => boolean | void;
  onDown?: () => boolean | void;
}) {
  function onKeyDown(event: KeyboardEvent) {
    const action = keyMap[event.key];
    if (!action) return;

    const active = document.activeElement as HTMLElement | null;
    const focusables = getFocusableElements();

    if (action === 'confirm') {
      if (active && active !== document.body) {
        event.preventDefault();
        active.click();
      }
      return;
    }

    if (action === 'back') {
      event.preventDefault();
      options?.onBack?.();
      return;
    }

    if (action === 'menu') {
      event.preventDefault();
      options?.onMenu?.();
      return;
    }

    const customHandled =
      action === 'left'
        ? options?.onLeft?.()
        : action === 'right'
          ? options?.onRight?.()
          : action === 'up'
            ? options?.onUp?.()
            : action === 'down'
              ? options?.onDown?.()
              : false;

    if (customHandled) {
      event.preventDefault();
      return;
    }

    if (!active || active === document.body) {
      focusElement(focusables[0]);
      event.preventDefault();
      return;
    }

    const next = findNearestByDirection(
      active,
      focusables,
      action as 'up' | 'down' | 'left' | 'right',
    );
    if (next) {
      event.preventDefault();
      focusElement(next);
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', onKeyDown, true);
  });

  onUnmounted(() => {
    document.removeEventListener('keydown', onKeyDown, true);
  });
}
