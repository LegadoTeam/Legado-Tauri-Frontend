<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    divider?: boolean;
    hideSubtitleOnMobile?: boolean;
  }>(),
  {
    divider: false,
    hideSubtitleOnMobile: false,
  },
);
</script>

<template>
  <header class="app-page-header" :class="{ 'app-page-header--divider': divider }">
    <div class="app-page-header__main">
      <div class="app-page-header__title-row">
        <div v-if="$slots.leading" class="app-page-header__leading">
          <slot name="leading" />
        </div>
        <div class="app-page-header__title-group">
          <h1 class="app-page-header__title">{{ title }}</h1>
          <slot name="title-extra" />
        </div>
        <div v-if="$slots.actions" class="app-page-header__actions">
          <slot name="actions" />
        </div>
      </div>
      <div
        v-if="$slots.subtitle"
        class="app-page-header__subtitle"
        :class="{ 'app-page-header__subtitle--hide-mobile': hideSubtitleOnMobile }"
      >
        <slot name="subtitle" />
      </div>
    </div>
  </header>
</template>

<style scoped>
.app-page-header {
  flex-shrink: 0;
  padding: var(--space-6) var(--space-6) var(--space-3);
}

.app-page-header--divider {
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.app-page-header__main {
  min-width: 0;
  flex: 1;
}

.app-page-header__title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.app-page-header__leading {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.app-page-header__title-group {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.app-page-header__title {
  margin: 0;
  font-size: var(--fs-20);
  font-weight: var(--fw-bold);
  color: var(--color-text);
  letter-spacing: -0.01em;
}

.app-page-header__subtitle {
  margin-top: 6px;
  font-size: var(--fs-13);
  line-height: var(--lh-tight);
  color: var(--color-text-soft);
}

.app-page-header__actions {
  margin-left: auto;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}

@media (pointer: coarse), (max-width: 640px) {
  .app-page-header {
    padding: var(--space-4) var(--space-4) var(--space-2);
  }

  .app-page-header--divider {
    padding-bottom: var(--space-3);
  }

  .app-page-header__title-row {
    align-items: flex-start;
  }

  .app-page-header__subtitle--hide-mobile {
    display: none;
  }
}
</style>
