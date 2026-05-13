<!-- BookSourceCodeEditor — 书源 JavaScript 代码编辑控件，统一复用高亮编辑器实现。 -->
<script setup lang="ts">
import { ref } from "vue";
import JavaScriptHighlightEditor from "@/components/base/JavaScriptHighlightEditor.vue";

withDefaults(
  defineProps<{
    modelValue: string;
    autofocusKey?: string | number;
    placeholder?: string;
  }>(),
  {
    autofocusKey: undefined,
    placeholder: "书源 JavaScript 内容...",
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
  save: [];
}>();

const editorRef = ref<InstanceType<typeof JavaScriptHighlightEditor> | null>(
  null,
);

function resetScroll() {
  editorRef.value?.resetScroll();
}

defineExpose({ resetScroll });
</script>

<template>
  <JavaScriptHighlightEditor
    ref="editorRef"
    :model-value="modelValue"
    :autofocus-key="autofocusKey"
    min-height="100%"
    :placeholder="placeholder"
    @update:model-value="emit('update:modelValue', $event)"
    @save="emit('save')"
  />
</template>
