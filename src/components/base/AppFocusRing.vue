<script setup lang="ts">
withDefaults(
  defineProps<{
    focused?: boolean;
    disabled?: boolean;
  }>(),
  {
    focused: false,
    disabled: false,
  },
);
</script>

<template>
  <div
    class="app-focus-ring"
    :class="{
      'app-focus-ring--focused': focused,
      'app-focus-ring--disabled': disabled,
    }"
    :data-focus-visible="focused ? 'true' : undefined"
  >
    <slot />
  </div>
</template>

<style scoped>
.app-focus-ring {
  display: contents;
}

.app-focus-ring--focused:not(.app-focus-ring--disabled) > :first-child,
.app-focus-ring:focus-within:not(.app-focus-ring--disabled) > :first-child {
  outline: 3px solid var(--color-focus);
  outline-offset: 3px;
  border-radius: inherit;
}
</style>
