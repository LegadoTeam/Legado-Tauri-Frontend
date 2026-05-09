import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useNavigationStore = defineStore('navigation', () => {
  /** 当前激活的视图 ID */
  const activeView = ref('bookshelf');

  /** 搜索视图的初始限定书源（fileName），null 表示搜索全部书源 */
  const searchInitSource = ref<string | null>(null);

  /** 导航到搜索视图，可选限定单一书源 */
  function navigateToSearch(sourceFileName?: string) {
    searchInitSource.value = sourceFileName ?? null;
    activeView.value = 'search';
  }

  function setActiveView(view: string) {
    activeView.value = view;
  }

  return { activeView, searchInitSource, navigateToSearch, setActiveView };
});
