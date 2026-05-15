<script setup lang="ts">
import { ChevronLeft } from 'lucide-vue-next';
import type { ReaderSettings, ReaderTypography } from '@/components/reader/types';

defineProps<{
  settings: ReaderSettings;
  textAlignOptions: Array<{
    label: string;
    value: ReaderTypography['textAlign'];
  }>;
  textShadowPresets: Array<{ label: string; value: string }>;
}>();

const emit = defineEmits<{
  back: [];
  'update-typography': [patch: Partial<ReaderTypography>];
}>();
</script>

<template>
  <div class="reader-settings__sub-header">
    <button class="reader-settings__back" @click="emit('back')">
      <ChevronLeft :size="16" />
    </button>
    <span class="reader-settings__sub-title">字体样式</span>
  </div>

  <!-- 斜体 -->
  <div class="reader-settings__row">
    <span class="reader-settings__label">斜体</span>
    <div class="reader-settings__pill-group">
      <button
        class="reader-settings__pill"
        :class="{
          'reader-settings__pill--active': settings.typography.fontStyle === 'normal',
        }"
        @click="emit('update-typography', { fontStyle: 'normal' })"
      >
        正常
      </button>
      <button
        class="reader-settings__pill"
        :class="{
          'reader-settings__pill--active': settings.typography.fontStyle === 'italic',
        }"
        style="font-style: italic"
        @click="emit('update-typography', { fontStyle: 'italic' })"
      >
        斜体
      </button>
      <button
        class="reader-settings__pill"
        :class="{
          'reader-settings__pill--active': settings.typography.fontStyle === 'oblique',
        }"
        style="font-style: oblique"
        @click="emit('update-typography', { fontStyle: 'oblique' })"
      >
        倾斜
      </button>
    </div>
  </div>

  <!-- 对齐 -->
  <div class="reader-settings__row">
    <span class="reader-settings__label">对齐</span>
    <div class="reader-settings__pill-group">
      <button
        v-for="a in textAlignOptions"
        :key="a.value"
        class="reader-settings__pill"
        :class="{
          'reader-settings__pill--active': settings.typography.textAlign === a.value,
        }"
        @click="emit('update-typography', { textAlign: a.value })"
      >
        {{ a.label }}
      </button>
    </div>
  </div>

  <!-- 文字装饰 -->
  <div class="reader-settings__row">
    <span class="reader-settings__label">装饰</span>
    <div class="reader-settings__pill-group">
      <button
        class="reader-settings__pill"
        :class="{
          'reader-settings__pill--active': settings.typography.textDecoration === 'none',
        }"
        @click="emit('update-typography', { textDecoration: 'none' })"
      >
        无
      </button>
      <button
        class="reader-settings__pill"
        :class="{
          'reader-settings__pill--active': settings.typography.textDecoration === 'underline',
        }"
        style="text-decoration: underline"
        @click="emit('update-typography', { textDecoration: 'underline' })"
      >
        下划线
      </button>
      <button
        class="reader-settings__pill"
        :class="{
          'reader-settings__pill--active': settings.typography.textDecoration === 'line-through',
        }"
        style="text-decoration: line-through"
        @click="emit('update-typography', { textDecoration: 'line-through' })"
      >
        删除线
      </button>
    </div>
  </div>

  <!-- 文字描边 -->
  <div class="reader-settings__row">
    <span class="reader-settings__label">描边</span>
    <n-slider
      :value="settings.typography.textStrokeWidth"
      @update:value="(v: number) => emit('update-typography', { textStrokeWidth: v })"
      :min="0"
      :max="3"
      :step="0.5"
      :format-tooltip="(v: number) => v + 'px'"
      style="flex: 1"
    />
    <span class="reader-settings__val" style="width: 40px"
      >{{ settings.typography.textStrokeWidth }}px</span
    >
    <label class="reader-settings__color-swatch" title="描边颜色">
      <input
        ref="strokeColorInputRef"
        type="color"
        :value="
          settings.typography.textStrokeColor === 'transparent'
            ? '#000000'
            : settings.typography.textStrokeColor
        "
        @input="
          (e) =>
            emit('update-typography', {
              textStrokeColor: (e.target as HTMLInputElement).value,
            })
        "
      />
      <span
        :style="{
          background:
            settings.typography.textStrokeColor === 'transparent'
              ? '#555'
              : settings.typography.textStrokeColor,
        }"
      />
    </label>
  </div>

  <!-- 文字阴影 -->
  <div class="reader-settings__row">
    <span class="reader-settings__label">阴影</span>
    <div class="reader-settings__pill-group">
      <button
        v-for="sh in textShadowPresets"
        :key="sh.label"
        class="reader-settings__pill"
        :class="{
          'reader-settings__pill--active': settings.typography.textShadow === sh.value,
        }"
        @click="emit('update-typography', { textShadow: sh.value })"
      >
        {{ sh.label }}
      </button>
    </div>
  </div>
</template>
