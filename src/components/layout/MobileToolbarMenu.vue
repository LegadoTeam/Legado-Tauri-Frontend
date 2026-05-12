<script setup lang="ts">
import type { DropdownOption } from 'naive-ui';
/**
 * MobileToolbarMenu — 移动端工具栏三点菜单
 *
 * 桌面端：渲染为下拉菜单
 * 移动端：收起为竖三点下拉菜单（AppSheet + AppListItem）
 *
 * 用法：
 *   <MobileToolbarMenu :options="menuOptions" @select="handleSelect">
 *     <!-- 可选的默认 slot -->
 *   </MobileToolbarMenu>
 */
import { MoreVertical } from 'lucide-vue-next';
import { ref } from 'vue';
import { isMobile } from '../../composables/useEnv';
import AppListItem from '../base/AppListItem.vue';
import AppSheet from '../base/AppSheet.vue';

export type MenuOption = DropdownOption;

const props = defineProps<{
  options: MenuOption[];
}>();

const emit = defineEmits<{
  (e: 'select', key: string): void;
}>();

const sheetOpen = ref(false);
const dropdownOpen = ref(false);

function onSelect(key: string) {
  sheetOpen.value = false;
  dropdownOpen.value = false;
  emit('select', key);
}
</script>

<template>
  <!-- 桌面端：渲染为下拉菜单 -->
  <template v-if="!isMobile">
    <n-dropdown
      trigger="click"
      :options="options"
      :show-arrow="true"
      @select="onSelect"
    >
      <n-button size="small" quaternary aria-label="更多操作">
        <template #icon>
          <MoreVertical :size="16" />
        </template>
      </n-button>
    </n-dropdown>
  </template>
  <!-- 移动端：三点菜单触发 AppSheet 底部抽屉 -->
  <template v-else>
    <n-button size="small" quaternary aria-label="更多操作" @click="sheetOpen = true">
      <template #icon>
        <MoreVertical :size="16" />
      </template>
    </n-button>
    <AppSheet v-model="sheetOpen">
      <div class="mtm-sheet" role="menu">
        <template v-for="opt in options" :key="String(opt.key)">
          <div v-if="opt.type === 'divider'" class="mtm-divider" role="separator" />
          <AppListItem
            v-else
            :title="String(opt.label ?? opt.key)"
            :disabled="!!opt.disabled"
            role="menuitem"
            @click="onSelect(String(opt.key))"
          />
        </template>
      </div>
    </AppSheet>
  </template>
</template>

<style scoped>
.mtm-sheet {
  padding: var(--space-2) var(--space-3) var(--space-4);
  display: flex;
  flex-direction: column;
}

.mtm-divider {
  height: 1px;
  background: var(--color-border);
  margin: var(--space-1) 0;
}
</style>
