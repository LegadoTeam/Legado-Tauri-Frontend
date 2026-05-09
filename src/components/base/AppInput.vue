<script setup lang="ts">
defineProps<{
  label?: string;
  modelValue?: string;
  placeholder?: string;
  help?: string;
  invalid?: boolean;
  errorMessage?: string;
  type?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  search: [value: string];
}>();

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value);
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    emit('search', (event.target as HTMLInputElement).value);
  }
}
</script>

<template>
  <div class="app-input" :class="{ 'app-input--invalid': invalid }">
    <label v-if="label" class="app-input__label">{{ label }}</label>
    <div class="app-input__wrapper">
      <span v-if="$slots.prefix" class="app-input__affix app-input__prefix">
        <slot name="prefix" />
      </span>
      <input
        class="app-input__field focusable"
        :type="type ?? 'text'"
        :value="modelValue"
        :placeholder="placeholder"
        :aria-invalid="invalid ? 'true' : undefined"
        @input="onInput"
        @keydown="onKeyDown"
      />
      <span v-if="$slots.suffix" class="app-input__affix app-input__suffix">
        <slot name="suffix" />
      </span>
    </div>
    <p v-if="invalid && errorMessage" class="app-input__error">{{ errorMessage }}</p>
    <p v-else-if="help" class="app-input__help">{{ help }}</p>
  </div>
</template>

<style scoped>
.app-input {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.app-input__label {
  font-size: var(--fs-13);
  font-weight: var(--fw-medium);
  color: var(--color-text-soft);
}

.app-input__wrapper {
  display: flex;
  align-items: center;
  min-height: var(--tap-target);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-2);
  background: var(--color-surface);
  transition: border-color var(--dur-fast) var(--ease-standard);
  overflow: hidden;
}

.app-input__wrapper:focus-within {
  border-color: var(--color-accent);
  outline: 2px solid var(--color-focus);
  outline-offset: 0;
}

.app-input--invalid .app-input__wrapper {
  border-color: var(--color-danger);
}

.app-input--invalid .app-input__wrapper:focus-within {
  outline-color: var(--color-danger);
}

.app-input__field {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  padding-inline: var(--space-3);
  font-size: var(--fs-15);
  color: var(--color-text);
}

.app-input__field::placeholder {
  color: var(--color-text-muted);
}

.app-input__affix {
  display: flex;
  align-items: center;
  padding-inline: var(--space-2);
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.app-input__error {
  margin: 0;
  font-size: var(--fs-12);
  color: var(--color-danger);
}

.app-input__help {
  margin: 0;
  font-size: var(--fs-12);
  color: var(--color-text-muted);
}
</style>
