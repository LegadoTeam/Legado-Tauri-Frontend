import { ref } from 'vue'

/** 当前激活的视图 ID */
export const activeView = ref('bookshelf')

/** 搜索视图的初始限定书源（fileName），null 表示搜索全部书源 */
export const searchInitSource = ref<string | null>(null)

/** 导航到搜索视图，可选限定单一书源 */
export function navigateToSearch(sourceFileName?: string) {
  searchInitSource.value = sourceFileName ?? null
  activeView.value = 'search'
}
