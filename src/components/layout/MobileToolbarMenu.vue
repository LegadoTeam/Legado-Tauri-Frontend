<script setup lang="ts">
/**
 * MobileToolbarMenu — 移动端工具栏三点菜单
 *
 * 桌面端：渲染默认 slot（完整工具栏按钮）
 * 移动端：收起为竖三点下拉菜单
 *
 * 用法：
 *   <MobileToolbarMenu :options="menuOptions" @select="handleSelect">
 *     <!-- 桌面端工具栏按钮 -->
 *     <n-button .../>
 *   </MobileToolbarMenu>
 */
import { isMobile } from '../../composables/useEnv'

export interface MenuOption {
  label: string
  key: string
  disabled?: boolean
}

defineProps<{
  options: MenuOption[]
}>()

const emit = defineEmits<{
  (e: 'select', key: string): void
}>()
</script>

<template>
  <!-- 桌面端：直接展示 slot 内容 -->
  <template v-if="!isMobile">
    <slot />
  </template>
  <!-- 移动端：三点下拉菜单 -->
  <n-dropdown
    v-else
    trigger="click"
    :options="options"
    placement="bottom-end"
    @select="(key: string) => emit('select', key)"
  >
    <n-button size="small" quaternary>
      <template #icon>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
      </template>
    </n-button>
  </n-dropdown>
</template>
