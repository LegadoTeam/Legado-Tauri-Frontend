/**
 * useMobileHorizontalSwipe — 移动端横向滑动切换页签的兼容占位。
 *
 * Android WebView 下原实现会通过 setPointerCapture 接管内容区 pointer 事件，
 * 已确认会导致书源管理中的按钮、开关等交互控件失效。这里全局禁用该手势，
 * 保留调用接口，避免 BookSourceView / ExploreView 逐处改模板。
 */
import { ref } from 'vue';

interface MobileHorizontalSwipeOptions {
  threshold?: number;
  verticalTolerance?: number;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  shouldIgnoreTarget?: (target: EventTarget | null) => boolean;
}

export function useMobileHorizontalSwipe(options: MobileHorizontalSwipeOptions) {
  void options;
  const swiping = ref(false);

  function noop() {
    // 手势已全局禁用，不能在这里 preventDefault / stopPropagation。
  }

  return {
    swiping,
    onSwipePointerDown: noop,
    onSwipePointerMove: noop,
    onSwipePointerUp: noop,
    onSwipePointerCancel: noop,
    onSwipeClickCapture: noop,
  };
}
