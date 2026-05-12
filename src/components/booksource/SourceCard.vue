<script setup lang="ts">
import { NTag, NSwitch, NButton, NPopover, NInputNumber, NCheckbox } from 'naive-ui';
import type { BookSourceMeta, UpdateCheckResult } from '@/composables/useBookSource';

defineProps<{
  src: BookSourceMeta;
  sourceDir: string;
  defaultLogoUrl: string;
  searchEnabled: boolean;
  exploreEnabled: boolean;
  capabilities?: Set<string>;
  delayOverride: number;
  updateInfo?: UpdateCheckResult;
  updateBusy: boolean;
  selectable?: boolean;
  selected?: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
  edit: [];
  reload: [];
  delete: [];
  'navigate-debug': [];
  'open-url': [url: string];
  'toggle-search': [];
  'toggle-explore': [];
  'load-delay': [];
  'save-delay': [value: number | null];
  'apply-update': [];
  'select': [];
}>();
</script>

<template>
  <div
    class="src-card"
    :class="{
      'src-card--off': !src.enabled,
      'src-card--selected': selected,
      'src-card--selectable': selectable,
    }"
  >
    <!-- 多选复选框 -->
    <div v-if="selectable" class="src-card__checkbox">
      <n-checkbox :checked="selected" @click="emit('select')" />
    </div>
    <!-- 顶部：Logo + 标题区 + 开关 -->
    <div class="src-card__header">
      <img
        v-if="src.logo && src.logo.toLowerCase() !== 'default'"
        :src="src.logo"
        class="src-card__logo"
        :alt="src.name"
        @error="($event.target as HTMLImageElement).src = defaultLogoUrl"
      />
      <img v-else :src="defaultLogoUrl" class="src-card__logo" :alt="src.name" />

      <div class="src-card__title">
        <div class="src-card__name-line">
          <span class="src-card__name">{{ src.name }}</span>
          <n-tag v-if="!src.enabled" size="tiny" :bordered="false" class="src-card__badge src-card__badge--off"
            >已禁用</n-tag
          >
          <n-tag v-if="src.tags[0]" size="tiny" :bordered="false" class="src-card__badge src-card__badge--group">{{
            src.tags[0]
          }}</n-tag>
          <n-tag
            v-if="src.sourceDir !== sourceDir"
            size="tiny"
            type="info"
            :bordered="false"
            class="src-card__badge"
            :title="src.sourceDir"
            >外部</n-tag
          >
          <n-tag
            v-if="updateInfo"
            size="tiny"
            type="success"
            :bordered="false"
            class="src-card__badge"
            :title="`本地 v${updateInfo.localVersion || '未标注'} → 远端 v${updateInfo.remoteVersion || '未标注'}`"
            >可升级</n-tag
          >
          <span v-if="src.author" class="src-card__author">{{ src.author }}</span>
        </div>
        <div class="src-card__url-line">
          <a class="src-card__url" href="#" @click.prevent.stop="emit('open-url', src.url)">{{ src.url }}</a>
          <n-tag
            v-if="src.urls && src.urls.length > 1"
            size="tiny"
            type="warning"
            :bordered="false"
            class="src-card__mirror"
            :title="src.urls.join('\n')"
            >+{{ src.urls.length - 1 }} 镜像</n-tag
          >
        </div>
      </div>

      <n-switch :value="src.enabled" size="small" class="src-card__switch" @update:value="emit('toggle')" />
    </div>

    <!-- 能力 + 标签 -->
    <div class="src-card__chips">
      <template v-if="capabilities">
        <n-tag
          v-if="capabilities?.has('search')"
          size="tiny"
          :bordered="false"
          :type="searchEnabled ? 'success' : 'default'"
          class="src-card__cap"
          @click.stop="emit('toggle-search')"
          >搜索{{ searchEnabled ? '✓' : '✗' }}</n-tag
        >
        <n-tag
          v-if="capabilities?.has('explore')"
          size="tiny"
          :bordered="false"
          :type="exploreEnabled ? 'info' : 'default'"
          class="src-card__cap"
          @click.stop="emit('toggle-explore')"
          >发现{{ exploreEnabled ? '✓' : '✗' }}</n-tag
        >
        <n-tag
          v-if="capabilities?.has('bookInfo')"
          size="tiny"
          :bordered="false"
          class="src-card__cap src-card__cap--dim"
          >书目</n-tag
        >
        <n-tag
          v-if="capabilities?.has('chapterList')"
          size="tiny"
          :bordered="false"
          class="src-card__cap src-card__cap--dim"
          >目录</n-tag
        >
        <n-tag
          v-if="capabilities?.has('chapterContent')"
          size="tiny"
          :bordered="false"
          class="src-card__cap src-card__cap--dim"
          >正文</n-tag
        >
      </template>
      <span v-else class="src-card__cap-loading">检测中…</span>
      <template v-if="src.tags.length > 1">
        <span class="src-card__chip-sep" />
        <n-tag v-for="t in src.tags.slice(1)" :key="t" size="tiny" :bordered="false" class="src-card__tag">{{
          t
        }}</n-tag>
      </template>
    </div>

    <!-- 描述 -->
    <div v-if="src.description" class="src-card__desc">
      {{ src.description }}
    </div>

    <!-- 操作栏 -->
    <div class="src-card__actions">
      <n-button
        v-if="updateInfo"
        size="tiny"
        type="primary"
        quaternary
        class="src-action src-action--update"
        :loading="updateBusy"
        :disabled="updateBusy"
        @click="emit('apply-update')"
        >升级</n-button
      >
      <n-button size="tiny" quaternary class="src-action src-action--edit" @click="emit('edit')">编辑</n-button>
      <n-button size="tiny" quaternary class="src-action" @click="emit('reload')">重载</n-button>
      <n-button size="tiny" quaternary class="src-action src-action--debug" @click="emit('navigate-debug')"
        >调试</n-button
      >
      <!-- 每书源延迟覆盖 -->
      <n-popover trigger="click" placement="top" @update:show="(show: boolean) => show && emit('load-delay')">
        <template #trigger>
          <n-button size="tiny" quaternary class="src-action" :title="'最小请求延迟覆盖：' + delayOverride + ' ms'"
            >延迟</n-button
          >
        </template>
        <div style="display: flex; flex-direction: column; gap: 6px; min-width: 200px">
          <span style="font-size: 0.8rem; color: var(--n-text-color-3)">最小请求延迟（ms）</span>
          <n-input-number
            :value="delayOverride"
            size="small"
            :min="0"
            :max="60000"
            placeholder="0 = 跟随全局"
            style="width: 100%"
            @update:value="(v: number | null) => emit('save-delay', v)"
          />
          <span style="font-size: 0.75rem; opacity: 0.6"> 0 表示跟随全局设置；与 @minDelay 取最大值 </span>
        </div>
      </n-popover>
      <n-button size="tiny" quaternary class="src-action src-action--delete" @click="emit('delete')">删除</n-button>
    </div>
  </div>
</template>

<style scoped>
/* ---- 卡片 ---- */
.src-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  border-left: 3px solid transparent;
  background: var(--color-surface-raised);
  position: relative;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast);
}

.src-card--selectable {
  padding-left: 32px;
}

.src-card:hover {
  border-color: var(--color-accent);
  border-left-color: var(--color-accent);
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.06);
}

.src-card--off {
  opacity: 0.55;
  border-left-color: var(--color-danger);
}

.src-card--off:hover {
  border-left-color: var(--color-danger);
}

.src-card--selected {
  border-color: var(--color-accent);
  background: var(--color-accent-subtle);
}

.src-card__checkbox {
  position: absolute;
  left: 4px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1;
}

.src-card__header {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 36px;
}

.src-card__logo {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-xs);
  object-fit: contain;
  flex-shrink: 0;
  opacity: 0.85;
  transition: opacity var(--transition-fast);
}

.src-card:hover .src-card__logo {
  opacity: 1;
}

.src-card__title {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.src-card__name-line {
  display: flex;
  align-items: center;
  gap: 5px;
  overflow: hidden;
}

.src-card__name {
  font-size: 0.8375rem;
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 240px;
  flex-shrink: 1;
}

.src-card__badge {
  flex-shrink: 0;
  font-size: 0.625rem !important;
  --n-border-radius: 3px !important;
}

.src-card__badge--off {
  --n-color: var(--color-danger-subtle) !important;
  --n-text-color: var(--color-danger) !important;
  font-weight: 600;
}

.src-card__badge--group {
  --n-color: var(--color-surface-hover) !important;
  --n-text-color: var(--color-text-muted) !important;
}

.src-card__author {
  font-size: 0.6875rem;
  color: var(--color-text-muted);
  opacity: 0.6;
  white-space: nowrap;
  flex-shrink: 0;
  margin-left: auto;
}

.src-card__url-line {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}

.src-card__url {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
  opacity: 0.6;
  text-decoration: none;
  cursor: pointer;
  transition:
    color var(--transition-fast),
    opacity var(--transition-fast);
}

.src-card__url:hover {
  color: var(--color-accent);
  opacity: 1;
  text-decoration: underline;
}

.src-card__mirror {
  flex-shrink: 0;
}

.src-card__switch {
  flex-shrink: 0;
}

.src-card__chips {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.src-card__cap {
  font-size: 0.625rem !important;
  height: 16px !important;
  line-height: 14px !important;
  padding: 0 5px !important;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}

.src-card__cap--dim {
  cursor: default;
  --n-color: color-mix(in srgb, var(--color-border) 60%, transparent) !important;
  --n-text-color: var(--color-text-muted) !important;
  opacity: 0.7;
}

.src-card__cap-loading {
  font-size: 0.6rem;
  color: var(--color-text-muted);
  opacity: 0.5;
}

.src-card__chip-sep {
  width: 1px;
  height: 10px;
  background: var(--color-border);
  flex-shrink: 0;
  margin: 0 2px;
}

.src-card__tag {
  font-size: 0.6rem !important;
  height: 15px !important;
  line-height: 13px !important;
  padding: 0 5px !important;
  --n-color: color-mix(in srgb, var(--color-border) 80%, transparent) !important;
  --n-text-color: var(--color-text-muted) !important;
  opacity: 0.65;
}

.src-card__desc {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-left: 42px;
  opacity: 0.75;
}

.src-card__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.src-card:hover .src-card__actions {
  opacity: 1;
}

.src-action {
  font-size: 0.7125rem !important;
  padding: 0 7px !important;
  height: 22px !important;
  border-radius: var(--radius-xs) !important;
}

.src-action--edit {
  --n-text-color: var(--color-accent) !important;
  --n-text-color-hover: var(--color-accent) !important;
  --n-color-hover: var(--color-accent-subtle) !important;
}

.src-action--debug {
  --n-text-color: var(--color-text-secondary) !important;
  --n-text-color-hover: var(--color-text-primary) !important;
  --n-color-hover: var(--color-surface-hover) !important;
}

.src-action--update {
  --n-text-color: var(--color-success) !important;
  --n-text-color-hover: var(--color-success) !important;
  --n-color-hover: color-mix(in srgb, var(--color-success) 12%, transparent) !important;
}

.src-action--delete {
  --n-text-color: var(--color-danger) !important;
  --n-text-color-hover: var(--color-danger) !important;
  --n-color-hover: var(--color-danger-subtle) !important;
}

/* ---- 移动端 ---- */
@media (pointer: coarse), (max-width: 640px) {
  .src-card {
    padding: 8px 10px;
    gap: 5px;
  }

  .src-card__header {
    align-items: flex-start;
  }

  .src-card__logo {
    width: 28px;
    height: 28px;
  }

  .src-card__title {
    gap: 4px;
  }

  .src-card__name-line {
    align-items: flex-start;
    flex-wrap: wrap;
    overflow: visible;
  }

  .src-card__name {
    max-width: none;
    min-width: 0;
    flex: 1 1 100%;
    font-size: 0.8rem;
    line-height: 1.3;
    white-space: normal;
  }

  .src-card__author {
    margin-left: 0;
    flex-basis: 100%;
  }

  .src-card__url-line {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .src-card__url {
    white-space: normal;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  .src-card__actions {
    opacity: 1 !important;
    justify-content: flex-start;
    flex-wrap: wrap;
    margin-top: 2px;
  }

  .src-card__desc {
    padding-left: 0;
    white-space: normal;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
  }
}
</style>
