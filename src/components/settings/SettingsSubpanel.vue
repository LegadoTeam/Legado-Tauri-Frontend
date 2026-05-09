<script setup lang="ts">
import { ref } from 'vue';
import { isMobile } from '@/composables/useEnv';
import { useOverlayBackstack } from '@/composables/useOverlayBackstack';

withDefaults(
  defineProps<{
    title: string;
    description?: string;
    actionLabel?: string;
    desktopWidth?: string;
    mobileHeight?: string | number;
  }>(),
  {
    description: '',
    actionLabel: '打开面板',
    desktopWidth: 'min(720px, calc(100vw - 48px))',
    mobileHeight: '78vh',
  },
);

const show = ref(false);

useOverlayBackstack(
  () => show.value,
  () => {
    show.value = false;
  },
);
</script>

<template>
  <div class="settings-subpanel">
    <div class="settings-subpanel__main">
      <div class="settings-subpanel__head">
        <div class="settings-subpanel__title">{{ title }}</div>
        <div v-if="description" class="settings-subpanel__desc">{{ description }}</div>
      </div>
      <div class="settings-subpanel__summary">
        <slot name="summary" />
      </div>
    </div>
    <n-button size="small" @click="show = true">{{ actionLabel }}</n-button>
  </div>

  <n-drawer v-if="isMobile" v-model:show="show" placement="bottom" :height="mobileHeight">
    <n-drawer-content :title="title" closable>
      <div class="settings-subpanel__body app-scrollbar">
        <slot />
      </div>
    </n-drawer-content>
  </n-drawer>

  <n-modal
    v-else
    v-model:show="show"
    preset="card"
    :title="title"
    :style="{ width: desktopWidth }"
    class="settings-subpanel__modal"
  >
    <div class="settings-subpanel__body app-scrollbar">
      <slot />
    </div>
  </n-modal>
</template>

<style scoped>
.settings-subpanel {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.settings-subpanel__main {
  min-width: 0;
  flex: 1;
}

.settings-subpanel__head {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin-bottom: var(--space-2);
}

.settings-subpanel__title {
  font-size: var(--fs-13);
  font-weight: var(--fw-bold);
  color: var(--color-text);
}

.settings-subpanel__desc {
  font-size: var(--fs-12);
  line-height: var(--lh-base);
  color: var(--color-text-muted);
}

.settings-subpanel__summary {
  font-size: var(--fs-12);
  line-height: var(--lh-base);
  color: var(--color-text-soft);
}

.settings-subpanel__body {
  max-height: min(72vh, 680px);
  overflow-y: auto;
  padding-right: 4px;
}

.settings-subpanel__modal :deep(.n-card__content) {
  padding-top: 4px;
}

@media (max-width: 640px) {
  .settings-subpanel {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
