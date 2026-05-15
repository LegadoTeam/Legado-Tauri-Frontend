<script setup lang="ts">
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import { computed, nextTick, onMounted, ref, watch } from 'vue';

hljs.registerLanguage('javascript', javascript);

const props = withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    autofocusKey?: string | number;
    minHeight?: string;
  }>(),
  {
    placeholder: '',
    autofocusKey: undefined,
    minHeight: '420px',
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
  save: [];
}>();

const textareaRef = ref<HTMLTextAreaElement | null>(null);
const highlightRef = ref<HTMLElement | null>(null);

const highlightedCode = computed(() => {
  const source = props.modelValue || ' ';
  const highlighted = hljs.highlight(source, {
    language: 'javascript',
    ignoreIllegals: true,
  }).value;
  return props.modelValue.endsWith('\n') ? `${highlighted}\n` : highlighted;
});

watch(
  () => props.autofocusKey,
  async () => {
    if (!props.autofocusKey) {
      return;
    }
    await nextTick();
    resetScroll();
    textareaRef.value?.focus();
  },
  { flush: 'post', immediate: true },
);

onMounted(resetScroll);

defineExpose({ resetScroll });

function updateValue(event: Event) {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value);
}

function syncScroll() {
  const textarea = textareaRef.value;
  const highlight = highlightRef.value;
  if (!textarea || !highlight) {
    return;
  }
  highlight.scrollTop = textarea.scrollTop;
  highlight.scrollLeft = textarea.scrollLeft;
}

function resetScroll() {
  if (textareaRef.value) {
    textareaRef.value.scrollTop = 0;
    textareaRef.value.scrollLeft = 0;
  }
  if (highlightRef.value) {
    highlightRef.value.scrollTop = 0;
    highlightRef.value.scrollLeft = 0;
  }
}

function onKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key === 's') {
    event.preventDefault();
    emit('save');
    return;
  }

  if (event.key !== 'Tab') {
    return;
  }

  event.preventDefault();
  const textarea = event.target as HTMLTextAreaElement;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const indent = '  ';
  emit(
    'update:modelValue',
    props.modelValue.substring(0, start) + indent + props.modelValue.substring(end),
  );
  nextTick(() => {
    textarea.selectionStart = textarea.selectionEnd = start + indent.length;
    syncScroll();
  });
}
</script>

<template>
  <div class="js-highlight-editor" :style="{ minHeight }">
    <pre
      ref="highlightRef"
      class="js-highlight-editor__highlight"
      aria-hidden="true"
    ><code v-html="highlightedCode" /></pre>
    <textarea
      ref="textareaRef"
      :value="modelValue"
      class="js-highlight-editor__textarea"
      :placeholder="placeholder"
      spellcheck="false"
      autocomplete="off"
      autocorrect="off"
      autocapitalize="off"
      @input="updateValue"
      @scroll="syncScroll"
      @keydown="onKeydown"
    />
  </div>
</template>

<style scoped>
.js-highlight-editor {
  position: relative;
  flex: 1;
  width: 100%;
  overflow: hidden;
  border: 1px solid var(--color-border, rgba(0, 0, 0, 0.12));
  border-radius: 6px;
  background: var(--color-code-bg, #f7f7f8);
}

.js-highlight-editor:focus-within {
  border-color: var(--color-primary, #18a058);
}

.js-highlight-editor__highlight,
.js-highlight-editor__textarea {
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  margin: 0;
  padding: 12px 16px;
  border: 0;
  font-family: 'JetBrains Mono', 'Cascadia Code', 'Fira Code', 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  font-variant-ligatures: none;
  line-height: 1.6;
  letter-spacing: 0;
  tab-size: 2;
  white-space: pre;
  word-wrap: normal;
}

.js-highlight-editor__highlight {
  overflow: auto;
  color: var(--color-text, #24292f);
  pointer-events: none;
}

.js-highlight-editor__highlight :deep(code) {
  display: block;
  min-width: max-content;
}

.js-highlight-editor__textarea {
  z-index: 1;
  display: block;
  width: 100%;
  height: 100%;
  resize: none;
  outline: none;
  color: transparent;
  caret-color: var(--color-text, #24292f);
  background: transparent;
  overflow: auto;
}

.js-highlight-editor__textarea::placeholder {
  color: var(--color-text-muted, #8a8f98);
  -webkit-text-fill-color: var(--color-text-muted, #8a8f98);
}

.js-highlight-editor__textarea::selection {
  background: rgba(24, 160, 88, 0.24);
}

.js-highlight-editor__highlight::-webkit-scrollbar {
  display: none;
}

.js-highlight-editor__highlight {
  scrollbar-width: none;
}

.js-highlight-editor__highlight :deep(.hljs-keyword),
.js-highlight-editor__highlight :deep(.hljs-literal),
.js-highlight-editor__highlight :deep(.hljs-symbol),
.js-highlight-editor__highlight :deep(.hljs-name) {
  color: #cf222e;
}

.js-highlight-editor__highlight :deep(.hljs-string),
.js-highlight-editor__highlight :deep(.hljs-regexp),
.js-highlight-editor__highlight :deep(.hljs-template-variable) {
  color: #0a7c42;
}

.js-highlight-editor__highlight :deep(.hljs-number),
.js-highlight-editor__highlight :deep(.hljs-built_in),
.js-highlight-editor__highlight :deep(.hljs-title.class_) {
  color: #953800;
}

.js-highlight-editor__highlight :deep(.hljs-title.function_),
.js-highlight-editor__highlight :deep(.hljs-attr),
.js-highlight-editor__highlight :deep(.hljs-property) {
  color: #0550ae;
}

.js-highlight-editor__highlight :deep(.hljs-comment) {
  color: #6e7781;
}

:root[data-theme='dark'] .js-highlight-editor,
.n-config-provider[data-theme='dark'] .js-highlight-editor {
  background: #1e1e1e;
  border-color: rgba(255, 255, 255, 0.12);
}

:root[data-theme='dark'] .js-highlight-editor__highlight,
:root[data-theme='dark'] .js-highlight-editor__textarea,
.n-config-provider[data-theme='dark'] .js-highlight-editor__highlight,
.n-config-provider[data-theme='dark'] .js-highlight-editor__textarea {
  caret-color: #d4d4d4;
  color: transparent;
}

:root[data-theme='dark'] .js-highlight-editor__highlight,
.n-config-provider[data-theme='dark'] .js-highlight-editor__highlight {
  color: #d4d4d4;
}

:root[data-theme='dark'] .js-highlight-editor__highlight :deep(.hljs-keyword),
:root[data-theme='dark'] .js-highlight-editor__highlight :deep(.hljs-literal),
:root[data-theme='dark'] .js-highlight-editor__highlight :deep(.hljs-symbol),
:root[data-theme='dark'] .js-highlight-editor__highlight :deep(.hljs-name),
.n-config-provider[data-theme='dark'] .js-highlight-editor__highlight :deep(.hljs-keyword),
.n-config-provider[data-theme='dark'] .js-highlight-editor__highlight :deep(.hljs-literal),
.n-config-provider[data-theme='dark'] .js-highlight-editor__highlight :deep(.hljs-symbol),
.n-config-provider[data-theme='dark'] .js-highlight-editor__highlight :deep(.hljs-name) {
  color: #c586c0;
}

:root[data-theme='dark'] .js-highlight-editor__highlight :deep(.hljs-string),
:root[data-theme='dark'] .js-highlight-editor__highlight :deep(.hljs-regexp),
:root[data-theme='dark'] .js-highlight-editor__highlight :deep(.hljs-template-variable),
.n-config-provider[data-theme='dark'] .js-highlight-editor__highlight :deep(.hljs-string),
.n-config-provider[data-theme='dark'] .js-highlight-editor__highlight :deep(.hljs-regexp),
.n-config-provider[data-theme='dark']
  .js-highlight-editor__highlight
  :deep(.hljs-template-variable) {
  color: #ce9178;
}

:root[data-theme='dark'] .js-highlight-editor__highlight :deep(.hljs-number),
:root[data-theme='dark'] .js-highlight-editor__highlight :deep(.hljs-built_in),
:root[data-theme='dark'] .js-highlight-editor__highlight :deep(.hljs-title.class_),
.n-config-provider[data-theme='dark'] .js-highlight-editor__highlight :deep(.hljs-number),
.n-config-provider[data-theme='dark'] .js-highlight-editor__highlight :deep(.hljs-built_in),
.n-config-provider[data-theme='dark'] .js-highlight-editor__highlight :deep(.hljs-title.class_) {
  color: #b5cea8;
}

:root[data-theme='dark'] .js-highlight-editor__highlight :deep(.hljs-title.function_),
:root[data-theme='dark'] .js-highlight-editor__highlight :deep(.hljs-attr),
:root[data-theme='dark'] .js-highlight-editor__highlight :deep(.hljs-property),
.n-config-provider[data-theme='dark'] .js-highlight-editor__highlight :deep(.hljs-title.function_),
.n-config-provider[data-theme='dark'] .js-highlight-editor__highlight :deep(.hljs-attr),
.n-config-provider[data-theme='dark'] .js-highlight-editor__highlight :deep(.hljs-property) {
  color: #9cdcfe;
}

:root[data-theme='dark'] .js-highlight-editor__highlight :deep(.hljs-comment),
.n-config-provider[data-theme='dark'] .js-highlight-editor__highlight :deep(.hljs-comment) {
  color: #6a9955;
}
</style>
