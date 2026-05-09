import { type Ref, onUnmounted, ref } from 'vue';

const FOCUSABLE_SELECTORS = [
  'button:not(:disabled)',
  'a[href]',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  "[tabindex]:not([tabindex='-1'])",
  "[role='button']",
  "[role='option']",
  "[role='tab']",
  '[data-focusable="true"]',
].join(',');

const FOCUS_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

type Direction = 'up' | 'down' | 'left' | 'right';

interface FocusScope {
  id: number;
  container: HTMLElement;
  previousActiveElement: HTMLElement | null;
}

const scopeStack: FocusScope[] = [];
let scopeIdSeed = 0;

let globalHandlerInstalled = false;
let globalKeydownHandler: ((event: KeyboardEvent) => void) | null = null;

function isElementVisible(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') {
    return false;
  }
  if (el.offsetParent === null && style.position !== 'fixed') {
    return false;
  }
  return true;
}

function isInputEditingTarget(target: EventTarget | null): target is HTMLElement {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  if (!FOCUS_TAGS.has(target.tagName)) {
    return false;
  }
  const input = target as HTMLInputElement;
  const type = (input.type || '').toLowerCase();
  return type !== 'checkbox' && type !== 'radio' && type !== 'button' && type !== 'submit';
}

function getActiveScopeContainer(): HTMLElement | null {
  return scopeStack.length > 0 ? scopeStack[scopeStack.length - 1]!.container : null;
}

export function getFocusableElements(container: ParentNode = document): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)).filter((el) => {
    if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') {
      return false;
    }
    return isElementVisible(el);
  });
}

function focusElement(el: HTMLElement | undefined) {
  if (!el) {
    return;
  }
  el.focus({ preventScroll: false });
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function findNearestByDirection(
  current: HTMLElement,
  elements: HTMLElement[],
  direction: Direction,
): HTMLElement | undefined {
  const currentRect = current.getBoundingClientRect();
  const currentCenterX = currentRect.left + currentRect.width / 2;
  const currentCenterY = currentRect.top + currentRect.height / 2;

  let best: HTMLElement | undefined;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const el of elements) {
    if (el === current) {
      continue;
    }

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

    if (!isCandidate) {
      continue;
    }

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

export function moveFocusByDirection(direction: Direction, container?: ParentNode): boolean {
  const targetContainer = container ?? getActiveScopeContainer() ?? document;
  const focusables = getFocusableElements(targetContainer);
  if (focusables.length === 0) {
    return false;
  }

  const active = document.activeElement as HTMLElement | null;
  if (!active || !focusables.includes(active)) {
    focusElement(focusables[0]);
    return true;
  }

  const next = findNearestByDirection(active, focusables, direction);
  if (!next) {
    return false;
  }

  focusElement(next);
  return true;
}

export function activateFocusedElement(): boolean {
  const active = document.activeElement as HTMLElement | null;
  if (!active || active === document.body) {
    return false;
  }

  active.click();
  return true;
}

export function installGlobalFocusNavigation(options?: {
  onBack?: () => boolean | void;
  onEscape?: () => boolean | void;
}) {
  if (globalHandlerInstalled) {
    return () => {
      // no-op，避免重复安装时提前卸载。
    };
  }

  globalKeydownHandler = (event: KeyboardEvent) => {
    if (event.defaultPrevented) {
      return;
    }

    if (isInputEditingTarget(event.target)) {
      if (event.key === 'Escape') {
        (event.target as HTMLElement).blur();
        event.preventDefault();
      }
      // 输入框为空时，方向键允许导航出去
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        const input = event.target as HTMLInputElement;
        const value = input.value ?? '';
        if (value.length === 0) {
          // 空输入框：方向键直接导航
          const dirMap: Record<string, Direction> = {
            ArrowUp: 'up',
            ArrowDown: 'down',
            ArrowLeft: 'left',
            ArrowRight: 'right',
          };
          const dir = dirMap[event.key];
          if (dir && moveFocusByDirection(dir)) {
            event.preventDefault();
          }
        }
        // 非空输入框：保留原始文本编辑行为
      }
      return;
    }

    if (event.key === 'ArrowUp') {
      if (moveFocusByDirection('up')) {
        event.preventDefault();
      }
      return;
    }
    if (event.key === 'ArrowDown') {
      if (moveFocusByDirection('down')) {
        event.preventDefault();
      }
      return;
    }
    if (event.key === 'ArrowLeft') {
      if (moveFocusByDirection('left')) {
        event.preventDefault();
      }
      return;
    }
    if (event.key === 'ArrowRight') {
      if (moveFocusByDirection('right')) {
        event.preventDefault();
      }
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      if (activateFocusedElement()) {
        event.preventDefault();
      }
      return;
    }

    if (event.key === 'Escape' || event.key === 'BrowserBack') {
      const handled = options?.onEscape?.() ?? options?.onBack?.();
      if (handled) {
        event.preventDefault();
      }
      return;
    }

    if (event.key === 'Backspace') {
      const handled = options?.onBack?.();
      if (handled) {
        event.preventDefault();
      }
    }
  };

  document.addEventListener('keydown', globalKeydownHandler, true);
  globalHandlerInstalled = true;

  return () => {
    if (globalKeydownHandler) {
      document.removeEventListener('keydown', globalKeydownHandler, true);
      globalKeydownHandler = null;
      globalHandlerInstalled = false;
    }
  };
}

export function useFocusNavigation(containerRef: Ref<HTMLElement | null>) {
  const previousActiveElement = ref<HTMLElement | null>(null);
  let trapHandler: ((event: KeyboardEvent) => void) | null = null;
  let trappedScopeId: number | null = null;

  function getFocusable(): HTMLElement[] {
    if (!containerRef.value) {
      return [];
    }
    return getFocusableElements(containerRef.value);
  }

  function trapFocus() {
    if (!containerRef.value) {
      return;
    }

    previousActiveElement.value = document.activeElement as HTMLElement | null;

    trappedScopeId = ++scopeIdSeed;
    scopeStack.push({
      id: trappedScopeId,
      container: containerRef.value,
      previousActiveElement: previousActiveElement.value,
    });

    const focusable = getFocusable();
    if (focusable.length > 0) {
      focusElement(focusable[0]);
    }

    trapHandler = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') {
        return;
      }

      const activeScope = scopeStack[scopeStack.length - 1];
      if (!activeScope || activeScope.id !== trappedScopeId) {
        return;
      }

      const currentFocusable = getFocusable();
      if (currentFocusable.length === 0) {
        return;
      }

      const first = currentFocusable[0];
      const last = currentFocusable[currentFocusable.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          focusElement(last);
        }
      } else if (document.activeElement === last) {
        event.preventDefault();
        focusElement(first);
      }
    };

    document.addEventListener('keydown', trapHandler, true);
  }

  function releaseFocus() {
    if (trapHandler) {
      document.removeEventListener('keydown', trapHandler, true);
      trapHandler = null;
    }

    if (trappedScopeId != null) {
      const idx = scopeStack.findIndex((scope) => scope.id === trappedScopeId);
      if (idx >= 0) {
        scopeStack.splice(idx, 1);
      }
      trappedScopeId = null;
    }
  }

  function restoreFocus() {
    releaseFocus();
    if (previousActiveElement.value && document.contains(previousActiveElement.value)) {
      previousActiveElement.value.focus();
    }
    previousActiveElement.value = null;
  }

  onUnmounted(() => {
    releaseFocus();
  });

  return { trapFocus, releaseFocus, restoreFocus, getFocusable };
}
