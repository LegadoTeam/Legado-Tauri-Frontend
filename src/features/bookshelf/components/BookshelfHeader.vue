<script setup lang="ts">
import { computed } from 'vue';
import { LayoutGrid, EyeOff, Eye, FolderPlus, FilePlus } from 'lucide-vue-next';
import type { CardSizeKey } from '@/composables/useViewCardDensity';
import type { ShelfGroup } from '@/types/shelfGroup';

const props = defineProps<{
  bookCount: number;
  privacyModeEnabled: boolean;
  cardSizes: { key: CardSizeKey; label: string }[];
  activeSizeKey: CardSizeKey;
  activeSizeLabel: string;
  groups: ShelfGroup[];
  activeGroupId: string;
  showGroupMenu: boolean;
}>();

const emit = defineEmits<{
  (e: 'set-size', key: CardSizeKey): void;
  (e: 'toggle-privacy'): void;
  (e: 'toggle-group-menu'): void;
  (e: 'select-group', groupId: string): void;
  (e: 'import-txt'): void;
}>();

// 启用的分组（排除禁用的）
const enabledGroups = computed(() => {
  return props.groups.filter(g => g.enabled);
});

// 是否显示分组标签栏（至少有一个启用的分组）
const showGroupBar = computed(() => {
  return enabledGroups.value.length > 0;
});
</script>

<template>
  <div class="bs-header">
    <div class="bs-header__row">
      <div>
        <h1 class="bs-header__title">书架</h1>
        <p class="bs-header__sub">
          {{ privacyModeEnabled ? '隐私模式' : `${bookCount} 本书籍` }}
        </p>
      </div>
      <div class="bs-header__actions">
        <!-- 分组按钮 -->
        <button
          class="bs-icon-btn"
          :class="{ 'bs-icon-btn--active': showGroupMenu }"
          type="button"
          title="分组管理"
          aria-label="分组管理"
          @click="emit('toggle-group-menu')"
        >
          <FolderPlus :size="16" />
        </button>
        <!-- TXT 导入按钮 -->
        <button
          class="bs-icon-btn"
          type="button"
          title="导入本地 TXT"
          aria-label="导入本地 TXT"
          @click="emit('import-txt')"
        >
          <FilePlus :size="16" />
        </button>
        <n-dropdown
          trigger="click"
          :options="cardSizes.map((size) => ({ label: size.label, key: size.key }))"
          :value="activeSizeKey"
          @select="(key: string) => emit('set-size', key as CardSizeKey)"
        >
          <button
            class="bs-icon-btn"
            type="button"
            :title="`卡片大小（${activeSizeLabel}）`"
            aria-label="卡片大小"
          >
            <LayoutGrid :size="16" />
          </button>
        </n-dropdown>
        <button
          class="bs-icon-btn"
          :class="{ 'bs-icon-btn--active': privacyModeEnabled }"
          type="button"
          :title="privacyModeEnabled ? '退出隐私模式' : '进入隐私模式'"
          aria-label="隐私模式"
          @click="emit('toggle-privacy')"
        >
          <EyeOff v-if="privacyModeEnabled" :size="16" />
          <Eye v-else :size="16" />
        </button>
      </div>
    </div>

    <!-- 分组标签栏 -->
    <div v-if="showGroupBar" class="bs-header__groups">
      <button
        v-for="group in enabledGroups"
        :key="group.id"
        class="bs-group-tag"
        :class="{ 'bs-group-tag--active': activeGroupId === group.id }"
        @click="emit('select-group', group.id)"
      >
        {{ group.name }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.bs-header {
  flex-shrink: 0;
  padding: 24px 24px 8px;
}
.bs-header__row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.bs-header__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.bs-header__title {
  font-size: var(--fs-20);
  font-weight: var(--fw-bold);
  color: var(--color-text);
  margin: 0 0 2px;
}
.bs-header__sub {
  font-size: var(--fs-13);
  color: var(--color-text-muted);
  margin: 0;
}
.bs-icon-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-1);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition:
    color var(--dur-fast) var(--ease-standard),
    border-color var(--dur-fast) var(--ease-standard),
    background var(--dur-fast) var(--ease-standard);
}
@media (hover: hover) and (pointer: fine) {
  .bs-icon-btn:hover {
    color: var(--color-text);
    border-color: var(--color-text-muted);
  }
}
.bs-icon-btn--active {
  color: var(--color-accent);
  border-color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 12%, transparent);
}
@media (pointer: coarse), (max-width: 640px) {
  .bs-header {
    padding: 16px 16px 6px;
  }
}

/* 分组标签栏 */
.bs-header__groups {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border);
}

.bs-group-tag {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  font-size: var(--fs-13);
  color: var(--color-text-muted);
  background: var(--color-fill-secondary);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  cursor: pointer;
  transition:
    color var(--dur-fast) var(--ease-standard),
    border-color var(--dur-fast) var(--ease-standard),
    background var(--dur-fast) var(--ease-standard);
}

@media (hover: hover) and (pointer: fine) {
  .bs-group-tag:hover {
    color: var(--color-text);
    border-color: var(--color-text-muted);
  }
}

.bs-group-tag--active {
  color: var(--color-accent);
  border-color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 12%, transparent);
}

@media (pointer: coarse), (max-width: 640px) {
  .bs-header__groups {
    gap: 6px;
    margin-top: 10px;
    padding-top: 10px;
    overflow-x: auto;
    flex-wrap: nowrap;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .bs-header__groups::-webkit-scrollbar {
    display: none;
  }

  .bs-group-tag {
    flex-shrink: 0;
    padding: 5px 10px;
    font-size: 12px;
  }
}
</style>
