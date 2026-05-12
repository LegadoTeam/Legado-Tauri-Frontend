<script setup lang="ts">
import { Eye, EyeOff, Trash2, Edit3, Plus, Folder } from 'lucide-vue-next';
import { NButton, NInput, NPopconfirm, NSwitch, NModal } from 'naive-ui';
import { computed, nextTick, ref, watch } from 'vue';
import { useOverlayBackstack } from '@/composables/useOverlayBackstack';
import type { ShelfGroup } from '@/types/shelfGroup';

const props = defineProps<{
  show: boolean;
  groups: ShelfGroup[];
  activeGroupId: string;
  allGroupEnabled: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'select', groupId: string): void;
  (e: 'add', name: string): void;
  (e: 'remove', groupId: string): void;
  (e: 'rename', groupId: string, name: string): void;
  (e: 'toggle', groupId: string, enabled: boolean): void;
  (e: 'toggle-all'): void;
}>();

const addingNew = ref(false);
const editingGroupId = ref<string | null>(null);
const editingName = ref('');

// 新建分组弹窗
const showAddModal = ref(false);
const newGroupName = ref('');

useOverlayBackstack(
  () => props.show,
  () => {
    emit('update:show', false);
  },
);

const sortedGroups = computed(() => {
  return [...props.groups].sort((a, b) => {
    // 全部书籍在最前面
    if (a.id === 'all') return -1;
    if (b.id === 'all') return 1;
    return a.order - b.order;
  });
});

function startAddNew() {
  showAddModal.value = true;
  newGroupName.value = '';
  nextTick(() => {
    const input = document.getElementById('new-group-name-input');
    if (input instanceof HTMLInputElement) {
      input.focus();
    }
  });
}

function confirmAdd() {
  const name = newGroupName.value.trim();
  if (name) {
    emit('add', name);
  }
  showAddModal.value = false;
  newGroupName.value = '';
}

function cancelAdd() {
  showAddModal.value = false;
  newGroupName.value = '';
}

function startRename(group: ShelfGroup) {
  editingGroupId.value = group.id;
  editingName.value = group.name;
  nextTick(() => {
    const input = document.getElementById(`edit-group-${group.id}`);
    if (input instanceof HTMLInputElement) {
      input.focus();
      input.select();
    }
  });
}

function confirmRename(groupId: string) {
  const name = editingName.value.trim();
  if (name) {
    emit('rename', groupId, name);
  }
  editingGroupId.value = null;
  editingName.value = '';
}

function cancelRename() {
  editingGroupId.value = null;
  editingName.value = '';
}

function handleRemove(groupId: string) {
  emit('remove', groupId);
}

function handleToggle(group: ShelfGroup, enabled: boolean) {
  emit('toggle', group.id, enabled);
}

function selectGroup(groupId: string) {
  emit('select', groupId);
  emit('update:show', false);
}

function handleKeydown(e: KeyboardEvent, action: 'add' | 'rename', groupId?: string) {
  if (e.key === 'Enter') {
    if (action === 'add') {
      confirmAdd();
    } else if (action === 'rename' && groupId) {
      confirmRename(groupId);
    }
  } else if (e.key === 'Escape') {
    if (action === 'add') {
      cancelAdd();
    } else {
      cancelRename();
    }
  }
}
</script>

<template>
  <n-drawer
    :show="show"
    placement="bottom"
    height="auto"
    :mask-closable="true"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <div class="group-menu">
      <div class="group-menu__header">
        <h3 class="group-menu__title">分组管理</h3>
        <n-button
          size="small"
          type="primary"
          @click="startAddNew"
        >
          <template #icon>
            <Plus :size="14" />
          </template>
          新建分组
        </n-button>
      </div>

      <!-- 分组列表 -->
      <div class="group-menu__list">
        <div
          v-for="group in sortedGroups"
          :key="group.id"
          class="group-menu__item"
          :class="{ 'group-menu__item--active': group.id === activeGroupId }"
        >
          <!-- 分组名称/编辑 -->
          <div class="group-menu__item-left">
            <template v-if="editingGroupId === group.id">
              <n-input
                :id="`edit-group-${group.id}`"
                v-model:value="editingName"
                size="tiny"
                @keydown="(e: KeyboardEvent) => handleKeydown(e, 'rename', group.id)"
                @blur="confirmRename(group.id)"
              />
            </template>
            <template v-else>
              <button
                class="group-menu__item-name"
                @click="selectGroup(group.id)"
              >
                <Folder v-if="group.id !== 'all'" :size="14" />
                {{ group.name }}
              </button>
            </template>
          </div>

          <!-- 操作按钮 -->
          <div class="group-menu__item-right">
            <!-- 全部书籍特殊处理：不显示编辑和删除按钮，但显示开关 -->
            <template v-if="group.id === 'all'">
              <n-switch
                :value="allGroupEnabled"
                size="small"
                @update:value="() => emit('toggle-all')"
              />
            </template>
            <template v-else>
              <n-switch
                :value="group.enabled"
                size="small"
                @update:value="(v: boolean) => handleToggle(group, v)"
              />
              <button
                class="group-menu__action-btn"
                title="编辑名称"
                @click="startRename(group)"
              >
                <Edit3 :size="14" />
              </button>
              <n-popconfirm
                @positive-click="handleRemove(group.id)"
              >
                <template #trigger>
                  <button class="group-menu__action-btn group-menu__action-btn--danger" title="删除分组">
                    <Trash2 :size="14" />
                  </button>
                </template>
                确定删除分组「{{ group.name }}」吗？
              </n-popconfirm>
            </template>
          </div>
        </div>
      </div>

      <div v-if="sortedGroups.length <= 1" class="group-menu__empty">
        暂无分组，点击上方按钮创建
      </div>
    </div>
  </n-drawer>

  <!-- 新建分组弹窗 -->
  <n-modal
    v-model:show="showAddModal"
    preset="dialog"
    title="新建分组"
    positive-text="确定"
    negative-text="取消"
    @positive-click="confirmAdd"
    @negative-click="cancelAdd"
  >
    <n-input
      id="new-group-name-input"
      v-model:value="newGroupName"
      placeholder="输入分组名称"
      @keyup.enter="confirmAdd"
    />
  </n-modal>
</template>

<style scoped>
.group-menu {
  padding: 16px;
}

.group-menu__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.group-menu__title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: var(--color-text);
}

.group-menu__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: var(--radius-1);
  transition: background var(--dur-fast) var(--ease-standard);
}

@media (hover: hover) and (pointer: fine) {
  .group-menu__item:hover {
    background: var(--color-fill-secondary);
  }
}

.group-menu__item--active {
  background: color-mix(in srgb, var(--color-accent) 15%, transparent);
}

.group-menu__item-left {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.group-menu__item-name {
  display: flex;
  align-items: center;
  gap: 8px;
  background: none;
  border: none;
  color: var(--color-text);
  font-size: 14px;
  cursor: pointer;
  padding: 4px 8px;
  margin: -4px -8px;
  border-radius: var(--radius-1);
  transition: background var(--dur-fast) var(--ease-standard);
}

@media (hover: hover) and (pointer: fine) {
  .group-menu__item-name:hover {
    background: var(--color-fill-tertiary);
  }
}

.group-menu__item-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.group-menu__action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: none;
  border: none;
  border-radius: var(--radius-1);
  color: var(--color-text-muted);
  cursor: pointer;
  transition:
    color var(--dur-fast) var(--ease-standard),
    background var(--dur-fast) var(--ease-standard);
}

@media (hover: hover) and (pointer: fine) {
  .group-menu__action-btn:hover {
    color: var(--color-text);
    background: var(--color-fill-tertiary);
  }
}

.group-menu__action-btn--danger:hover {
  color: var(--color-error);
  background: color-mix(in srgb, var(--color-error) 15%, transparent);
}

.group-menu__empty {
  text-align: center;
  padding: 24px;
  color: var(--color-text-muted);
  font-size: 14px;
}
</style>
