<script setup lang="ts">
import { computed } from 'vue';
import { useOverlayBackstack } from '@/composables/useOverlayBackstack';
import ReaderImmersiveSurface from '../../features/reader/components/ReaderImmersiveSurface.vue';
import ReaderModal from '../../features/reader/components/ReaderModal.vue';
import ReaderVideoSurface from '../../features/reader/components/ReaderVideoSurface.vue';
import {
  type ChapterReaderModalEmit,
  type ChapterReaderModalProps,
  useChapterReaderModalController,
} from '../reader/composables/useChapterReaderModalController';

const props = defineProps<ChapterReaderModalProps>();
const emit = defineEmits<ChapterReaderModalEmit>();

const controller = useChapterReaderModalController(props, emit);
const isVideoMode = computed(() => controller.isVideoMode.value);
const effectiveStyle = computed(() => controller.effectiveStyle.value);
const settings = controller.settings;

// 视频模式通过 Teleport 挂载，不经过 ReaderModal，需单独注册返回栈
useOverlayBackstack(
  () => isVideoMode.value && props.show,
  () => emit('update:show', false),
);
</script>

<template>
  <!-- ── 视频模式：Teleport 到主内容区（保留底部任务栏） ── -->
  <Teleport v-if="isVideoMode && show" to="#main-content">
    <div class="video-layer">
      <ReaderVideoSurface
        :ref="controller.videoModeRef"
        :chapter-groups="chapterGroups"
        :initial-group-index="initialGroupIndex"
        :inline-group-tabs="inlineGroupTabs"
        :episode-progress="episodeProgress"
      />
    </div>
  </Teleport>

  <!-- ── 小说 / 漫画模式：沉浸全屏阅读器 ── -->
  <ReaderModal v-if="!isVideoMode" :show="show" @update:show="emit('update:show', $event)">
    <ReaderImmersiveSurface
      :ref="controller.menuLayerRef"
      :style-value="effectiveStyle"
      :skin-preset-id="settings.skinPresetId"
    />
  </ReaderModal>
</template>

<style scoped>
.reader-modal {
  --reader-body-top: 0px;
  --reader-body-right: 0px;
  --reader-body-bottom: 0px;
  --reader-body-left: 0px;
  --reader-body-max-width: none;
  --reader-body-margin: 0;
  --reader-body-surface: transparent;
  --reader-body-border: none;
  --reader-body-shadow: none;
  --reader-body-radius: 0px;
  --reader-body-backdrop-filter: none;
  --reader-top-left: 0px;
  --reader-top-right: 0px;
  --reader-top-top: 0px;
  --reader-top-max-width: none;
  --reader-top-margin: 0;
  --reader-top-radius: 0px;
  --reader-top-border: none;
  --reader-top-shadow: none;
  --reader-bottom-left: 0px;
  --reader-bottom-right: 0px;
  --reader-bottom-bottom: 0px;
  --reader-bottom-max-width: none;
  --reader-bottom-margin: 0;
  --reader-bottom-radius: 0px;
  --reader-bottom-border: none;
  --reader-bottom-shadow: none;
  --reader-menu-overlay-bg: rgba(0, 0, 0, 0.35);
  --reader-shell-title-display: none;
  --reader-shell-title-text: '';
  --reader-shell-title-height: 0px;
  --reader-shell-title-bg: transparent;
  --reader-shell-title-color: inherit;
  --reader-shell-title-padding: 0;
  --reader-shell-title-border: none;
  --reader-shell-title-font: inherit;
  --reader-shell-title-z-index: 9;
  --reader-shell-winctrls-display: none;
  --reader-shell-winctrls-text: '';
  --reader-shell-winctrls-height: 0px;
  --reader-shell-winctrls-bg: transparent;
  --reader-shell-winctrls-color: inherit;
  --reader-shell-winctrls-font: inherit;
  --reader-shell-winctrls-z-index: 9;
  --reader-plugin-top-left-top: calc(
    var(--safe-area-inset-top, env(safe-area-inset-top, 0px)) + 14px
  );
  --reader-plugin-top-left-left: 14px;
  --reader-plugin-top-right-top: calc(
    var(--safe-area-inset-top, env(safe-area-inset-top, 0px)) + 14px
  );
  --reader-plugin-top-right-right: 14px;
  --reader-plugin-bottom-left-left: 14px;
  --reader-plugin-bottom-left-bottom: calc(env(safe-area-inset-bottom, 0px) + 14px);
  --reader-plugin-bottom-right-right: 14px;
  --reader-plugin-bottom-right-bottom: calc(env(safe-area-inset-bottom, 0px) + 14px);
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  box-sizing: border-box;
  position: relative;
  overflow: hidden;
  background-color: var(--reader-bg-color, var(--color-surface));
  background-image: var(--reader-bg-image, none);
  background-size: var(--reader-bg-size, auto);
  background-position: var(--reader-bg-position, 0 0);
  background-repeat: var(--reader-bg-repeat, repeat);
  background-attachment: var(--reader-bg-attachment, scroll);
  background-blend-mode: var(--reader-bg-blend-mode, normal);
  color: var(--reader-text-color, var(--color-text-primary));
  font-synthesis: weight style;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  touch-action: manipulation;
  padding-top: var(--safe-area-inset-top, env(safe-area-inset-top, 0px));
  -webkit-text-size-adjust: none;
  text-size-adjust: none;
}

.reader-modal::before {
  content: var(--reader-shell-title-text);
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: var(--reader-shell-title-z-index);
  display: var(--reader-shell-title-display);
  align-items: center;
  height: var(--reader-shell-title-height);
  box-sizing: border-box;
  padding: var(--reader-shell-title-padding);
  border: var(--reader-shell-title-border);
  background: var(--reader-shell-title-bg);
  color: var(--reader-shell-title-color);
  font: var(--reader-shell-title-font);
  pointer-events: none;
  white-space: pre;
}

/* 右侧窗口控制按钮（最小化 / 最大化 / 关闭），皮肤可通过 --reader-shell-winctrls-* 启用 */
.reader-modal::after {
  content: var(--reader-shell-winctrls-text);
  position: absolute;
  top: 0;
  right: 0;
  z-index: var(--reader-shell-winctrls-z-index);
  display: var(--reader-shell-winctrls-display);
  align-items: center;
  height: var(--reader-shell-winctrls-height);
  box-sizing: border-box;
  background: var(--reader-shell-winctrls-bg);
  color: var(--reader-shell-winctrls-color);
  font: var(--reader-shell-winctrls-font);
  pointer-events: none;
  white-space: pre;
  letter-spacing: 0.04em;
}

.reader-modal__body {
  position: absolute;
  top: var(--reader-body-top);
  right: var(--reader-body-right);
  bottom: var(--reader-body-bottom);
  left: var(--reader-body-left);
  z-index: 1;
  width: auto;
  height: auto;
  max-width: var(--reader-body-max-width);
  margin: var(--reader-body-margin);
  overflow: hidden;
  background: var(--reader-body-surface);
  border: var(--reader-body-border);
  border-radius: var(--reader-body-radius);
  box-shadow: var(--reader-body-shadow);
  backdrop-filter: var(--reader-body-backdrop-filter);
  -webkit-text-size-adjust: none;
  text-size-adjust: none;
}

.reader-modal[data-reader-skin='reader-disguise-skins:notepad'] :deep(.scroll-mode__body),
.reader-modal[data-reader-skin='reader-disguise-skins:notepad-light'] :deep(.scroll-mode__body) {
  padding: var(--reader-padding, 8px 10px 8px);
}

.reader-modal[data-reader-skin='reader-disguise-skins:notepad'] :deep(.scroll-mode__para),
.reader-modal[data-reader-skin='reader-disguise-skins:notepad-light'] :deep(.scroll-mode__para) {
  margin-bottom: 0 !important;
  text-indent: 0 !important;
  white-space: pre-wrap;
}

.reader-modal[data-reader-skin='reader-disguise-skins:notepad'] :deep(.reader-chapter-title),
.reader-modal[data-reader-skin='reader-disguise-skins:notepad-light'] :deep(.reader-chapter-title) {
  display: none;
}

.reader-modal__spin {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.reader-modal__measure-host {
  position: absolute;
  top: var(--reader-body-top);
  right: var(--reader-body-right);
  bottom: var(--reader-body-bottom);
  left: var(--reader-body-left);
  max-width: var(--reader-body-max-width);
  margin: var(--reader-body-margin);
  border-radius: var(--reader-body-radius);
  visibility: hidden;
  pointer-events: none;
  z-index: -1;
}

/* 视频模式：Teleport 到 #main-content 内，覆盖主内容区但不遮挡底部任务栏 */
.video-layer {
  position: absolute;
  inset: 0;
  z-index: 100;
  overflow: hidden;
  background: var(--color-content-bg, var(--color-surface));
}
</style>
