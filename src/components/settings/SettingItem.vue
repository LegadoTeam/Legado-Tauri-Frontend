<script setup lang="ts">
import { isMobile } from '@/composables/useEnv'

const props = withDefaults(defineProps<{
  /** 设置项标签 */
  label: string
  /** 设置项描述（可选） */
  desc?: string
  /** 是否强制垂直堆叠（默认在手机端自动垂直） */
  vertical?: boolean
}>(), {
  vertical: false,
})
</script>

<template>
  <div class="setting-item" :class="{ 'setting-item--vertical': props.vertical || isMobile }">
    <div class="setting-item__info">
      <span class="setting-item__label">{{ label }}</span>
      <span v-if="desc" class="setting-item__desc">{{ desc }}</span>
    </div>
    <div class="setting-item__control">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.setting-item {
  display: grid;
  grid-template-columns: minmax(180px, 240px) minmax(0, 1fr);
  align-items: start;
  gap: 16px;
  padding: 12px 0;
}

.setting-item + .setting-item {
  border-top: 1px solid var(--color-border);
}

.setting-item__info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.setting-item__label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-primary);
}

.setting-item__desc {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  line-height: 1.4;
}

.setting-item__control {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
  flex-wrap: wrap;
}

/* ── 垂直堆叠模式 ── */
.setting-item--vertical {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}

.setting-item--vertical .setting-item__control {
  flex-shrink: unset;
  width: 100%;
  justify-content: flex-start;
}

@media (max-width: 900px) {
  .setting-item {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .setting-item__control {
    justify-content: flex-start;
  }
}
</style>
