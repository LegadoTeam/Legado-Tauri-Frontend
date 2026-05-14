/**
 * useVConsole — 管理 vConsole 调试面板的生命周期
 *
 * 根据 preferences.devTools.vConsoleEnabled 的值动态初始化或销毁 vConsole，
 * 并在系统主题（暗色/亮色）切换时同步更新 vConsole 的 theme 配置。
 */
import { watch, type Ref } from 'vue';
import VConsole from 'vconsole';
import { usePreferencesStore } from '@/stores/preferences';
import { storeToRefs } from 'pinia';

let _instance: VConsole | null = null;

export function useVConsole(effectiveDark: Ref<boolean>) {
  const prefStore = usePreferencesStore();
  const { devTools } = storeToRefs(prefStore);

  function getTheme(): 'dark' | 'light' {
    return effectiveDark.value ? 'dark' : 'light';
  }

  function init() {
    if (_instance) return;
    _instance = new VConsole({ theme: getTheme() });
  }

  function destroy() {
    if (!_instance) return;
    _instance.destroy();
    _instance = null;
  }

  // 跟随 enabled 开关
  watch(
    () => devTools.value.vConsoleEnabled,
    (enabled) => {
      if (enabled) {
        init();
      } else {
        destroy();
      }
    },
    { immediate: true },
  );

  // 跟随主题变化实时切换
  watch(effectiveDark, (dark) => {
    if (_instance) {
      _instance.setOption('theme', dark ? 'dark' : 'light');
    }
  });
}
