<script setup lang="ts">
import { Info } from 'lucide-vue-next';

withDefaults(
  defineProps<{
    icon?: string;
    title: string;
    desc?: string;
  }>(),
  {
    icon: undefined,
    desc: undefined,
  },
);
</script>

<template>
  <div class="app-empty">
    <div v-if="icon" class="app-empty__icon" aria-hidden="true">
      <span class="app-empty__icon-inner">{{ icon }}</span>
    </div>
    <div v-else class="app-empty__icon app-empty__icon--default" aria-hidden="true">
      <Info :size="40" :stroke-width="1.25" />
    </div>
    <p class="app-empty__title">{{ title }}</p>
    <p v-if="desc" class="app-empty__desc">{{ desc }}</p>
    <div v-if="$slots.action" class="app-empty__action">
      <slot name="action" />
    </div>
  </div>
</template>

<style scoped>
.app-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-10) var(--space-6);
  gap: var(--space-3);
  text-align: center;
}

.app-empty__icon {
  width: var(--space-10);
  height: var(--space-10);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  margin-bottom: var(--space-2);
}

.app-empty__icon-inner {
  font-size: 2.5rem;
  line-height: 1;
}

.app-empty__title {
  margin: 0;
  font-size: var(--fs-18);
  font-weight: var(--fw-medium);
  color: var(--color-text);
  line-height: var(--lh-tight);
}

.app-empty__desc {
  margin: 0;
  font-size: var(--fs-14);
  color: var(--color-text-soft);
  line-height: var(--lh-body);
  max-width: 24rem;
}

.app-empty__action {
  margin-top: var(--space-2);
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
  justify-content: center;
}
</style>
