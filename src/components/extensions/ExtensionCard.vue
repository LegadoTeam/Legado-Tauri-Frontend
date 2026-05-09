<script setup lang="ts">
import { NTag, NSwitch, NButton } from 'naive-ui';
import { ref } from 'vue';
import { ChevronDown } from 'lucide-vue-next';
import type { ExtensionMeta } from '@/composables/useExtension';
import type { FrontendPluginRecord } from '@/composables/useFrontendPlugins';
import { catDot, catType, runAtLabel, runtimeStatusType, runtimeStatusLabel } from '@/utils/extensionDisplayUtils';

const props = defineProps<{
  ext: ExtensionMeta;
  runtimeInfo?: FrontendPluginRecord;
}>();

const emit = defineEmits<{
  toggle: [];
  move: [direction: -1 | 1];
  reload: [];
  'view-code': [];
  edit: [];
  delete: [];
  settings: [];
  export: [];
}>();

const showDetails = ref(false);
</script>

<template>
  <div class="ext-card" :class="{ 'ext-card--off': !props.ext.enabled }">
    <div class="ext-card__stripe" :style="{ background: catDot(props.ext.category) }" />
    <div class="ext-card__body">
      <div class="ext-card__name-row">
        <span class="ext-card__name">{{ props.ext.name }}</span>
        <n-tag :type="catType(props.ext.category) as any" size="tiny" :bordered="false">
          {{ props.ext.category || '其他' }}
        </n-tag>
        <n-tag
          size="tiny"
          :bordered="false"
          style="background: var(--color-surface-secondary, rgba(0, 0, 0, 0.04))"
        >
          {{ runAtLabel(props.ext.runAt) }}
        </n-tag>
        <n-tag
          size="tiny"
          :type="runtimeStatusType(props.runtimeInfo?.status) as any"
          :bordered="false"
        >
          {{ runtimeStatusLabel(props.runtimeInfo?.status) }}
        </n-tag>
      </div>
      <p class="ext-card__desc">{{ props.ext.description || '暂无描述' }}</p>
      <div v-if="props.runtimeInfo?.status === 'error'" class="ext-card__error">
        <span class="ext-card__error-title">运行错误</span>
        <span class="ext-card__error-msg">{{ props.runtimeInfo?.runtimeError }}</span>
      </div>
      <div class="ext-card__meta">
        <span>v{{ props.ext.version }}</span>
        <span class="ext-card__dot" />
        <span>{{ props.ext.author || '未知作者' }}</span>
        <template v-if="props.runtimeInfo">
          <span class="ext-card__dot" />
          <span>
            hooks {{ props.runtimeInfo?.runtimeHooks.length ?? 0 }}
          </span>
          <span class="ext-card__dot" />
          <span>
            slots {{ props.runtimeInfo?.runtimeSlots.length ?? 0 }}
          </span>
          <span class="ext-card__dot" />
          <span>
            actions
            {{
              props.runtimeInfo?.runtimeBookshelfActions.length ?? 0
            }}
          </span>
          <span class="ext-card__dot" />
          <span>
            covers
            {{
              props.runtimeInfo?.runtimeCoverGenerators.length ?? 0
            }}
          </span>
        </template>
        <template v-if="props.ext.grants.length">
          <span class="ext-card__dot" />
          <span v-for="g in props.ext.grants.slice(0, 3)" :key="g" class="ext-card__grant">{{
            g
          }}</span>
          <span v-if="props.ext.grants.length > 3" class="ext-card__grant"
            >+{{ props.ext.grants.length - 3 }}</span
          >
        </template>
      </div>
    </div>
    <div class="ext-card__actions">
      <div class="ext-card__toggle">
        <n-switch :value="props.ext.enabled" size="small" @update:value="emit('toggle')" />
        <span class="ext-card__toggle-text">
          {{ props.ext.enabled ? '已启用' : '已禁用' }}
        </span>
      </div>
      <div class="ext-card__action-list">
        <n-button
          v-if="props.runtimeInfo?.hasSettings"
          size="tiny"
          quaternary
          @click="emit('settings')"
          >设置</n-button
        >
        <n-button size="tiny" quaternary @click="emit('move', -1)"
          >上移</n-button
        >
        <n-button size="tiny" quaternary @click="emit('move', 1)"
          >下移</n-button
        >
        <n-button size="tiny" quaternary @click="emit('reload')"
          >重载</n-button
        >
        <n-button size="tiny" quaternary @click="emit('view-code')"
          >查看代码</n-button
        >
        <n-button size="tiny" quaternary @click="emit('edit')">编辑</n-button>
        <n-button size="tiny" quaternary @click="emit('export')">导出</n-button>
        <n-button size="tiny" quaternary type="error" @click="emit('delete')"
          >删除</n-button
        >
        <n-button
          v-if="props.runtimeInfo"
          size="tiny"
          quaternary
          :title="showDetails ? '收起详情' : '展开详情'"
          @click="showDetails = !showDetails"
        >
          <template #icon>
            <ChevronDown :size="13" :style="showDetails ? 'transform: rotate(180deg)' : ''" />
          </template>
        </n-button>
      </div>
    </div>
    <transition name="ext-details">
      <div v-if="showDetails && props.runtimeInfo" class="ext-card__details">
        <div v-if="props.runtimeInfo.runtimeHooks.length" class="ext-card__detail-row">
          <span class="ext-card__detail-label">Hooks</span>
          <div class="ext-card__detail-tags">
            <n-tag v-for="h in props.runtimeInfo.runtimeHooks" :key="h" size="tiny" :bordered="false">{{ h }}</n-tag>
          </div>
        </div>
        <div v-if="props.runtimeInfo.runtimeSlots.length" class="ext-card__detail-row">
          <span class="ext-card__detail-label">Slots</span>
          <div class="ext-card__detail-tags">
            <n-tag v-for="s in props.runtimeInfo.runtimeSlots" :key="s" size="tiny" :bordered="false" type="info">{{ s }}</n-tag>
          </div>
        </div>
        <div v-if="props.runtimeInfo.runtimeBookshelfActions?.length" class="ext-card__detail-row">
          <span class="ext-card__detail-label">书架动作</span>
          <span class="ext-card__detail-value">{{ props.runtimeInfo.runtimeBookshelfActions.join(', ') }}</span>
        </div>
        <div class="ext-card__detail-row">
          <span class="ext-card__detail-label">插件 ID</span>
          <span class="ext-card__detail-value" style="font-family: monospace; font-size: 11px">{{ props.runtimeInfo.pluginId }}</span>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.ext-card {
  display: grid;
  grid-template-columns: 4px minmax(0, 1fr) auto;
  align-items: stretch;
  background: var(--color-surface-elevated, var(--color-surface));
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md, 6px);
  overflow: hidden;
  transition: box-shadow var(--dur-fast) var(--ease-standard);
}
.ext-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
.ext-card--off {
  opacity: 0.55;
}
.ext-card__stripe {
  flex-shrink: 0;
  grid-row: 1 / span 2;
}
.ext-card__body {
  flex: 1;
  min-width: 0;
  padding: 10px 12px;
}
.ext-card__name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 3px;
  flex-wrap: wrap;
}
.ext-card__name {
  font-weight: var(--fw-semibold);
  font-size: var(--fs-14);
  color: var(--color-text);
}
.ext-card__desc {
  font-size: 0.78rem;
  color: var(--color-text-soft);
  margin: 0 0 5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ext-card__error {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 10px;
  margin: 0 0 6px;
  background: color-mix(in srgb, var(--color-danger, #e88080) 10%, transparent);
  border-radius: var(--radius-sm, 4px);
  border-left: 3px solid var(--color-danger, #e88080);
}
.ext-card__error-title {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--color-danger, #e88080);
}
.ext-card__error-msg {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  white-space: pre-wrap;
  word-break: break-word;
}
.ext-card__meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.7rem;
  color: var(--color-text-muted);
  flex-wrap: wrap;
}
.ext-card__dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--color-text-muted);
  flex-shrink: 0;
}
.ext-card__grant {
  font-family: 'Cascadia Code', 'Consolas', monospace;
  font-size: 0.65rem;
  background: var(--color-surface-secondary, rgba(0, 0, 0, 0.04));
  padding: 1px 5px;
  border-radius: 3px;
  color: var(--color-text-soft);
}
.ext-card__actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px 12px;
  padding: 10px 12px;
  width: min(360px, 38vw);
  min-width: 320px;
  border-left: 1px solid var(--color-border);
  background: color-mix(
    in srgb,
    var(--color-surface-secondary, rgba(0, 0, 0, 0.02)) 76%,
    transparent
  );
}
.ext-card__toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.ext-card__toggle-text {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  white-space: nowrap;
}
.ext-card__action-list {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  flex-wrap: wrap;
  min-width: 0;
}
.ext-card__details {
  grid-column: 1 / -1;
  padding: 8px 10px;
  background: var(--color-surface, #f5f5f5);
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.ext-card__detail-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.ext-card__detail-label {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  min-width: 60px;
  flex-shrink: 0;
  padding-top: 1px;
}
.ext-card__detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.ext-card__detail-value {
  font-size: 0.7rem;
  color: var(--color-text-soft);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ext-details-enter-active,
.ext-details-leave-active {
  transition: all 0.18s ease;
  overflow: hidden;
}
.ext-details-enter-from,
.ext-details-leave-to {
  opacity: 0;
  max-height: 0;
}
.ext-details-enter-to,
.ext-details-leave-from {
  opacity: 1;
  max-height: 200px;
}
</style>
