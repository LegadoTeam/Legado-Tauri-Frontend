/**
 * src/stores/backStack.ts — 全局返回键堆栈
 *
 * 统一管理 Android 硬件返回键（popstate）和键盘 Escape / BrowserBack 的处理。
 *
 * 使用方式：
 *   const backStack = useBackStackStore();
 *
 *   // 组件打开时注册
 *   const handler = () => closeMyOverlay();
 *   backStack.push(handler);
 *
 *   // 组件通过 UI 按钮关闭时注销（会自动消耗对应的 history 记录）
 *   backStack.remove(handler);
 *
 *   // 组件卸载时（若仍在堆栈中）清理，不触发历史导航
 *   backStack.detach(handler);
 */
import { defineStore } from 'pinia';

export type BackHandler = () => void;

export const useBackStackStore = defineStore('backStack', () => {
  const _stack: BackHandler[] = [];
  /** UI 主动关闭时触发的 history.go(-1) 产生的 popstate 需要跳过的次数 */
  let _skip = 0;

  /**
   * 注册一个返回处理器，并向浏览器历史压入一条记录（用于 Android 硬件返回键）。
   */
  function push(handler: BackHandler): void {
    _stack.push(handler);
    history.pushState({ _legadoBack: true }, '');
  }

  /**
   * 移除指定处理器并消耗对应的 history 记录。
   * 适用于组件通过 UI 按钮关闭（而非返回键）的场景，不会调用 handler。
   */
  function remove(handler: BackHandler): void {
    const i = _stack.lastIndexOf(handler);
    if (i >= 0) {
      _stack.splice(i, 1);
      _skip++;
      history.go(-1);
    }
  }

  /**
   * 仅从堆栈中移除 handler，不消耗历史记录。
   * 适用于组件卸载、或历史记录已被外部手段消耗时的清理。
   */
  function detach(handler: BackHandler): void {
    const i = _stack.lastIndexOf(handler);
    if (i >= 0) {
      _stack.splice(i, 1);
    }
  }

  /**
   * 由全局 popstate 监听器调用（Android 硬件返回键触发）。
   * 返回 true 表示已由堆栈处理。
   */
  function onPopState(): boolean {
    if (_skip > 0) {
      _skip--;
      return true;
    }
    const handler = _stack.pop();
    if (handler) {
      handler();
      return true;
    }
    return false;
  }

  /**
   * 由键盘 Escape / BrowserBack 路径调用（via handleGlobalBack）。
   * 返回 true 表示已由堆栈处理。
   */
  function onKeyBack(): boolean {
    if (_stack.length === 0) {
      return false;
    }
    const handler = _stack.pop()!;
    // 通知 popstate 监听器：即将到来的事件是本次清理触发的，跳过
    _skip++;
    history.go(-1);
    handler();
    return true;
  }

  return { push, remove, detach, onPopState, onKeyBack };
});
