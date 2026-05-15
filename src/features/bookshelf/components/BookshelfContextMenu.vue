<script setup lang="ts">
import type { DropdownOption } from 'naive-ui';
import { computed } from 'vue';
import type { ShelfGroup } from '@/types/shelfGroup';

const props = defineProps<{
  show: boolean;
  x: number;
  y: number;
  options: DropdownOption[];
  groups: ShelfGroup[];
  contextBookId?: string;
  /** 书籍当前所在分组 ID */
  contextBookGroupId?: string;
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'select', key: string): void;
}>();

const menuOptions = computed<DropdownOption[]>(() => {
  const newOptions = [...props.options];

  // 获取启用的自定义分组（排除全部书籍）
  const enabledGroups = props.groups.filter((g) => g.id !== 'all' && g.enabled);

  if (enabledGroups.length > 0) {
    const groupOptions: DropdownOption[] = enabledGroups.map((g) => ({
      label: g.name,
      key: `move-to-group:${g.id}`,
    }));

    const insertIndex = newOptions.findIndex((opt) => opt.key === 'div');

    if (insertIndex !== -1) {
      newOptions.splice(insertIndex, 0, {
        label: '移动到分组',
        key: 'group-menu',
        children: groupOptions,
      });
    } else {
      newOptions.push(
        { type: 'divider', key: 'group-div' },
        {
          label: '移动到分组',
          key: 'group-menu',
          children: groupOptions,
        },
      );
    }
  }

  // 如果书籍在某个分组中，添加"移出分组"选项
  if (props.contextBookGroupId && props.contextBookGroupId !== 'all') {
    const removeIndex = newOptions.findIndex((opt) => opt.key === 'group-div');
    if (removeIndex !== -1) {
      newOptions.splice(removeIndex + 1, 0, {
        label: '移出分组',
        key: 'remove-from-group',
      });
    } else {
      newOptions.push(
        { type: 'divider', key: 'group-div' },
        { label: '移出分组', key: 'remove-from-group' },
      );
    }
  }

  return newOptions;
});
</script>

<template>
  <n-dropdown
    :show="show"
    :x="x"
    :y="y"
    :options="menuOptions"
    placement="bottom-start"
    trigger="manual"
    @clickoutside="emit('update:show', false)"
    @select="emit('select', $event)"
  />
</template>
