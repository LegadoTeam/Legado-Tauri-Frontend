<script setup lang="ts">
import { formatVersion } from '@/utils/versionUtils';
import type { RepoSourceInfo } from '../../composables/useBookSource';

const props = defineProps<{
  src: RepoSourceInfo;
  defaultLogoUrl: string;
  installed: boolean;
  versionDiff: 'upgrade' | 'downgrade' | 'same' | null;
  localVersion: string | undefined;
  bulkBusy: boolean;
  deleting: boolean;
}>();

const emit = defineEmits<{
  install: [];
  delete: [];
  'open-url': [url: string];
}>();
</script>

<template>
  <div class="src-card" :class="{ 'src-card--installed': installed }">
    <div class="src-card__header">
      <img
        v-if="props.src.logo && props.src.logo.toLowerCase() !== 'default'"
        :src="props.src.logo"
        class="src-card__logo"
        :alt="props.src.name"
        @error="($event.target as HTMLImageElement).src = defaultLogoUrl"
      />
      <img v-else :src="defaultLogoUrl" class="src-card__logo" :alt="props.src.name" />

      <div class="src-card__title">
        <div class="src-card__name-line">
          <span class="src-card__name">{{ props.src.name }}</span>
          <n-tag
            v-if="props.src.version"
            size="tiny"
            :bordered="false"
            type="info"
            class="src-card__badge"
            >v{{ props.src.version }}</n-tag
          >
          <!-- 已安装的版本差异提示 -->
          <template v-if="installed">
            <n-tag
              v-if="versionDiff === 'upgrade'"
              size="tiny"
              type="success"
              :bordered="false"
              class="src-card__badge"
              :title="`本地 ${formatVersion(localVersion ?? '')} → 仓库 ${formatVersion(props.src.version ?? '')}`"
              >↑ 可升级</n-tag
            >
            <n-tag
              v-else-if="versionDiff === 'downgrade'"
              size="tiny"
              type="warning"
              :bordered="false"
              class="src-card__badge"
              :title="`本地 ${formatVersion(localVersion ?? '')} → 仓库 ${formatVersion(props.src.version ?? '')}，降级需谨慎`"
              >↓ 降级</n-tag
            >
            <n-tag
              v-else-if="versionDiff === 'same'"
              size="tiny"
              type="default"
              :bordered="false"
              class="src-card__badge"
              >已是最新</n-tag
            >
          </template>
          <n-tag
            v-if="props.src.tags[0]"
            size="tiny"
            :bordered="false"
            class="src-card__badge src-card__badge--group"
            >{{ props.src.tags[0] }}</n-tag
          >
          <span v-if="props.src.author" class="src-card__author">{{ props.src.author }}</span>
        </div>
        <div class="src-card__url-line">
          <a class="src-card__url" href="#" @click.prevent.stop="emit('open-url', props.src.url)">{{
            props.src.url
          }}</a>
        </div>
      </div>

      <div class="src-card__actions" :class="{ 'src-card__actions--installed': installed }">
        <!-- 未安装：安装按钮 -->
        <n-button
          v-if="!installed"
          size="tiny"
          type="primary"
          :disabled="bulkBusy"
          class="src-action"
          @click="emit('install')"
        >
          安装
        </n-button>
        <!-- 已安装：升级 / 降级 / 强制更新均通过安装弹窗走完整确认流程 -->
        <template v-else>
          <n-button
            v-if="versionDiff === 'upgrade'"
            size="tiny"
            type="primary"
            quaternary
            :disabled="bulkBusy"
            class="src-action src-action--update"
            @click="emit('install')"
          >
            更新
          </n-button>
          <n-button
            v-else-if="versionDiff === 'downgrade'"
            size="tiny"
            type="warning"
            quaternary
            :disabled="bulkBusy"
            class="src-action src-action--downgrade"
            @click="emit('install')"
          >
            降级
          </n-button>
          <n-button
            v-else
            size="tiny"
            quaternary
            :disabled="bulkBusy"
            class="src-action src-action--update"
            @click="emit('install')"
          >
            强制更新
          </n-button>
          <n-button
            size="tiny"
            quaternary
            :disabled="deleting"
            :loading="deleting"
            class="src-action src-action--delete"
            @click="emit('delete')"
          >
            删除
          </n-button>
        </template>
      </div>
    </div>

    <!-- DISABLED: 同步检查功能暂时关闭，书源卡片同步状态行已隐藏。恢复时取消注释。
    <div v-if="installed" class="src-card__status-row">
      <n-tag size="tiny" :bordered="false">
      </n-tag>
      <span class="src-card__status-text">
      </span>
    </div>
    -->

    <div v-if="props.src.tags.length > 1 || props.src.fileSize" class="src-card__chips">
      <n-tag
        v-for="t in props.src.tags.slice(1, 4)"
        :key="t"
        size="tiny"
        :bordered="false"
        class="src-card__tag"
        >{{ t }}</n-tag
      >
      <span v-if="props.src.tags.length > 1 && props.src.fileSize" class="src-card__chip-sep" />
      <span v-if="props.src.fileSize" class="src-card__file-size">
        {{
          props.src.fileSize > 1024
            ? (props.src.fileSize / 1024).toFixed(1) + ' KB'
            : props.src.fileSize + ' B'
        }}
      </span>
    </div>

    <div v-if="props.src.description" class="src-card__desc">{{ props.src.description }}</div>
  </div>
</template>

<style scoped>
/* ---- 卡片（复用样式） ---- */
.src-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  border-left: 3px solid transparent;
  background: var(--color-surface-raised);
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast);
}
.src-card:hover {
  border-color: var(--color-accent);
  border-left-color: var(--color-accent);
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.06);
}
.src-card--installed {
  opacity: 0.92;
  border-left-color: color-mix(in srgb, var(--color-accent) 34%, transparent);
}
.src-card__file-size {
  font-size: 0.625rem;
  color: var(--color-text-muted);
  background: var(--color-surface);
  border-radius: var(--radius-xs);
  padding: 1px 5px;
  opacity: 0.7;
}

.src-card__header {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 36px;
}
.src-card__actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}
.src-card__actions--installed {
  opacity: 0;
  transition: opacity var(--transition-fast);
}
.src-card:hover .src-card__actions--installed {
  opacity: 1;
}
.src-action {
  font-size: 0.7125rem !important;
  padding: 0 7px !important;
  height: 22px !important;
  border-radius: var(--radius-xs) !important;
}
.src-action--update {
  --n-text-color: var(--color-accent) !important;
  --n-text-color-hover: var(--color-accent) !important;
  --n-color-hover: var(--color-accent-subtle) !important;
}
.src-action--delete {
  --n-text-color: var(--color-danger) !important;
  --n-text-color-hover: var(--color-danger) !important;
  --n-color-hover: var(--color-danger-subtle) !important;
}
.src-action--downgrade {
  --n-text-color: var(--color-warning, #f0a020) !important;
  --n-text-color-hover: var(--color-warning, #f0a020) !important;
  --n-color-hover: rgba(240, 160, 32, 0.12) !important;
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

.src-card__status-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding-left: 42px;
}

.src-card__status-text {
  min-width: 0;
  flex: 1;
  font-size: 0.68rem;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.src-card__status-text--error {
  color: var(--color-danger);
}

.src-card__chips {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
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

@media (pointer: coarse), (max-width: 640px) {
  .src-card {
    padding: 8px 10px;
    gap: 5px;
  }
  .src-card__logo {
    width: 28px;
    height: 28px;
  }
  .src-card__actions--installed {
    opacity: 1 !important;
    justify-content: flex-start;
    flex-wrap: wrap;
    margin-top: 2px;
  }
  .src-card__name {
    max-width: 160px;
    font-size: 0.8rem;
  }
  .src-card__status-row,
  .src-card__desc {
    padding-left: 38px;
  }
}
</style>
