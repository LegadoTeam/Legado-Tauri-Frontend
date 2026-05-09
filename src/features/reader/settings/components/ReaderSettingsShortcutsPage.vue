<script setup lang="ts">
import { ChevronLeft } from 'lucide-vue-next';

defineProps<{
  volumeKeyPageTurnEnabled: boolean;
}>();

const emit = defineEmits<{
  (e: 'back'): void;
}>();
</script>

<template>
  <div class="reader-settings__sub-header">
    <button class="reader-settings__back" @click="emit('back')">
      <ChevronLeft :size="16" />
    </button>
    <span class="reader-settings__sub-title">快捷键说明</span>
  </div>

  <div class="reader-settings__shortcuts">
    <div class="reader-settings__shortcut-row">
      <span class="reader-settings__shortcut-keys">
        <kbd>←</kbd> <kbd>A</kbd>
        <kbd v-if="volumeKeyPageTurnEnabled">音量+</kbd>
      </span>
      <span class="reader-settings__shortcut-desc">上一页 / 上一章</span>
    </div>
    <div class="reader-settings__shortcut-row">
      <span class="reader-settings__shortcut-keys">
        <kbd>→</kbd> <kbd>D</kbd>
        <kbd v-if="volumeKeyPageTurnEnabled">音量-</kbd>
      </span>
      <span class="reader-settings__shortcut-desc">下一页 / 下一章</span>
    </div>
    <div class="reader-settings__shortcut-row">
      <span class="reader-settings__shortcut-keys"><kbd>Space</kbd> <kbd>Enter</kbd></span>
      <span class="reader-settings__shortcut-desc">打开 / 关闭菜单</span>
    </div>
    <div class="reader-settings__shortcut-note">
      音量键翻页默认关闭；开启后在菜单关闭且未听书时生效，滚动模式按一屏上下移动。
    </div>
  </div>
</template>

<style scoped>
.reader-settings__sub-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.reader-settings__back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background 0.15s;
}

.reader-settings__back:hover {
  background: rgba(255, 255, 255, 0.1);
}

.reader-settings__sub-title {
  font-size: 0.875rem;
  font-weight: 600;
}

.reader-settings__shortcuts {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.reader-settings__shortcut-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.reader-settings__shortcut-keys {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.reader-settings__shortcut-keys kbd {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.06);
  font-size: 0.75rem;
  font-family: inherit;
  line-height: 1.6;
}

.reader-settings__shortcut-desc {
  font-size: 0.8125rem;
  opacity: 0.7;
  text-align: right;
}

.reader-settings__shortcut-note {
  font-size: 0.75rem;
  opacity: 0.45;
  line-height: 1.5;
  padding-top: 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
</style>
