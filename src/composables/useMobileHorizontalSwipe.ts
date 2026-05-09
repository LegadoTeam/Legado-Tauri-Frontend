import { ref } from 'vue';
import { isMobile } from './useEnv';

interface MobileHorizontalSwipeOptions {
  threshold?: number;
  verticalTolerance?: number;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  shouldIgnoreTarget?: (target: EventTarget | null) => boolean;
}

const DEFAULT_IGNORE_SELECTOR =
  'input, textarea, select, iframe, [contenteditable="true"], .monaco-editor, .n-tabs-nav';

function defaultShouldIgnoreTarget(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest(DEFAULT_IGNORE_SELECTOR);
}

function getCurrentElement(e: PointerEvent): HTMLElement | null {
  return e.currentTarget instanceof HTMLElement ? e.currentTarget : null;
}

export function useMobileHorizontalSwipe(options: MobileHorizontalSwipeOptions) {
  const threshold = options.threshold ?? 64;
  const verticalTolerance = options.verticalTolerance ?? 1.35;
  const swiping = ref(false);

  let pointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let movedHorizontally = false;
  let suppressNextClick = false;

  function isEnabled() {
    return isMobile.value;
  }

  function shouldIgnoreTarget(target: EventTarget | null) {
    return options.shouldIgnoreTarget?.(target) ?? defaultShouldIgnoreTarget(target);
  }

  function onSwipePointerDown(e: PointerEvent) {
    if (!isEnabled() || !e.isPrimary || shouldIgnoreTarget(e.target)) {
      pointerId = null;
      return;
    }
    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    movedHorizontally = false;
    swiping.value = false;
    getCurrentElement(e)?.setPointerCapture(e.pointerId);
  }

  function onSwipePointerMove(e: PointerEvent) {
    if (pointerId !== e.pointerId) {
      return;
    }
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * verticalTolerance) {
      movedHorizontally = true;
      swiping.value = true;
      if (e.cancelable) {
        e.preventDefault();
      }
    }
  }

  function finishSwipe(e: PointerEvent) {
    if (pointerId !== e.pointerId) {
      return;
    }
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const shouldSwipe =
      Math.abs(dx) >= threshold && Math.abs(dx) > Math.abs(dy) * verticalTolerance;
    if (shouldSwipe) {
      suppressNextClick = true;
      if (dx < 0) {
        options.onSwipeLeft();
      } else {
        options.onSwipeRight();
      }
    }
    pointerId = null;
    movedHorizontally = false;
    swiping.value = false;
    getCurrentElement(e)?.releasePointerCapture(e.pointerId);
  }

  function onSwipePointerUp(e: PointerEvent) {
    finishSwipe(e);
  }

  function onSwipePointerCancel(e: PointerEvent) {
    if (pointerId === e.pointerId) {
      pointerId = null;
      movedHorizontally = false;
      swiping.value = false;
    }
  }

  function onSwipeClickCapture(e: MouseEvent) {
    if (!suppressNextClick && !movedHorizontally) {
      return;
    }
    suppressNextClick = false;
    e.preventDefault();
    e.stopPropagation();
  }

  return {
    swiping,
    onSwipePointerDown,
    onSwipePointerMove,
    onSwipePointerUp,
    onSwipePointerCancel,
    onSwipeClickCapture,
  };
}
