<script setup lang="ts">
import { NTag, NButton } from 'naive-ui';
import type { ExampleScript } from '@/data/extensionExamples';
import { catDot, catType, runAtLabel } from '@/utils/extensionDisplayUtils';

const props = defineProps<{
  ex: ExampleScript;
  installed: boolean;
  installLoading: boolean;
}>();

const emit = defineEmits<{
  'view-code': [];
  install: [];
}>();
</script>

<template>
  <div class="example-card">
    <div class="example-card__band" :style="{ background: catDot(props.ex.meta.category ?? '') }" />
    <div class="example-card__body">
      <div class="example-card__name-row">
        <span class="example-card__name">{{ props.ex.meta.name }}</span>
        <n-tag :type="catType(props.ex.meta.category ?? '') as any" size="tiny" :bordered="false">
          {{ props.ex.meta.category || '其他' }}
        </n-tag>
      </div>
      <p class="example-card__desc">{{ props.ex.meta.description }}</p>
      <div class="example-card__grants" v-if="props.ex.meta.grants?.length">
        <span v-for="g in props.ex.meta.grants" :key="g" class="example-card__grant-tag">{{
          g
        }}</span>
      </div>
      <div class="example-card__meta">
        <span>v{{ props.ex.meta.version }}</span>
        <span class="ext-card__dot" />
        <span>{{ props.ex.meta.author }}</span>
        <span class="ext-card__dot" />
        <span>{{ runAtLabel(props.ex.meta.runAt ?? 'document-idle') }}</span>
      </div>
    </div>
    <div class="example-card__foot">
      <n-button size="small" quaternary @click="emit('view-code')">查看代码</n-button>
      <n-button
        size="small"
        :type="props.installed ? 'default' : 'primary'"
        :disabled="props.installed"
        :loading="props.installLoading"
        @click="emit('install')"
      >
        {{ props.installed ? '已安装' : '安装' }}
      </n-button>
    </div>
  </div>
</template>

<style scoped>
.example-card {
  display: flex;
  flex-direction: column;
  align-self: start;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md, 6px);
  overflow: hidden;
  transition: box-shadow var(--dur-fast) var(--ease-standard);
  background: var(--color-surface-elevated, var(--color-surface));
}
.example-card:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}
.example-card__band {
  height: 4px;
  flex-shrink: 0;
}
.example-card__body {
  flex: 0 0 auto;
  padding: 12px 14px 10px;
}
.example-card__name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 5px;
}
.example-card__name {
  font-weight: var(--fw-semibold);
  font-size: 0.9rem;
  color: var(--color-text);
}
.example-card__desc {
  font-size: 0.8rem;
  color: var(--color-text-soft);
  margin: 0 0 8px;
  line-height: var(--lh-base);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.example-card__grants {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}
.example-card__grant-tag {
  font-family: 'Cascadia Code', 'Consolas', monospace;
  font-size: 0.64rem;
  background: var(--color-surface-secondary, rgba(0, 0, 0, 0.04));
  border: 1px solid var(--color-border);
  padding: 1px 6px;
  border-radius: 3px;
  color: var(--color-text-soft);
}
.example-card__meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.7rem;
  color: var(--color-text-muted);
}
.example-card__foot {
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-top: 1px solid var(--color-border);
  background: var(--color-surface-secondary, rgba(0, 0, 0, 0.02));
}
.ext-card__dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--color-text-muted);
  flex-shrink: 0;
}
</style>
