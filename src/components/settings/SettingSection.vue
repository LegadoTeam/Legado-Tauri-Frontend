<script setup lang="ts">
defineProps<{
  /** 分区标题 */
  title: string
  /** 用于 scrollIntoView 定位的 id */
  sectionId?: string
}>()
</script>

<template>
  <section :id="sectionId" class="setting-section">
    <h2 class="setting-section__title">{{ title }}</h2>
    <div class="setting-section__body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.setting-section {
  scroll-margin-top: 16px;
}

.setting-section__title {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--color-border);
}

.setting-section__body {
  display: flex;
  flex-direction: column;
}
</style>
