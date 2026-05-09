<script setup lang="ts">
import { Menu, Sun, Moon, Volume2, Settings } from 'lucide-vue-next';
import { ref, computed, watch } from 'vue';
import { useReaderSettingsStore, type ChapterItem } from '@/stores';
// eslint-disable-next-line typescript/consistent-type-imports -- component used in template as <ReaderSettingsPanel> and in ref<InstanceType<typeof ReaderSettingsPanel>>
import ReaderSettingsPanel from './ReaderSettingsPanel.vue';
import { PRESET_THEMES } from './types';

const props = withDefaults(
  defineProps<{
    chapters: ChapterItem[];
    currentIndex: number;
    hasPrev: boolean;
    hasNext: boolean;
    sourceType?: string;
    /** 控制底部栏显隐（CSS transition，不卸载 DOM） */
    visible?: boolean;
  }>(),
  {
    visible: true,
  },
);

const emit = defineEmits<{
  (e: 'prev'): void;
  (e: 'next'): void;
  (e: 'goto', idx: number): void;
  (e: 'open-toc'): void;
  (e: 'settings-visible', val: boolean): void;
  (e: 'dump-pagination-layout'): void;
  (e: 'tts-toggle'): void;
}>();

const settingsRef = ref<InstanceType<typeof ReaderSettingsPanel> | null>(null);
const showSettings = ref(false);

function toggleSettings() {
  if (showSettings.value) {
    settingsRef.value?.hideTapZoneDebugPreview?.();
  }
  showSettings.value = !showSettings.value;
}

function closeSettings() {
  settingsRef.value?.hideTapZoneDebugPreview?.();
  showSettings.value = false;
}

watch(showSettings, (val) => emit('settings-visible', val));

defineExpose({ closeSettings });

const sliderValue = computed({
  get: () => props.currentIndex + 1,
  set: (val: number) => {
    const idx = val - 1;
    if (idx !== props.currentIndex && idx >= 0 && idx < props.chapters.length) {
      emit('goto', idx);
    }
  },
});

/* ---- 日夜切换（直接从 useReaderSettings 读取，不依赖 settingsRef） ---- */
const { settings, setTheme } = useReaderSettingsStore();
const NIGHT_THEME = PRESET_THEMES[4];
const DAY_THEME = PRESET_THEMES[0];

/* ---- TTS 状态（仅用于高亮按钮） ---- */
import { useTts } from '@/composables/useTts';
const tts = useTts();

const isNight = computed(() => settings.theme.name === NIGHT_THEME.name);

function toggleDayNight() {
  setTheme(isNight.value ? DAY_THEME : NIGHT_THEME);
}
</script>

<template>
  <div
    class="reader-bottom-bar reader-bottom-bar-new"
    :class="{ 'reader-bottom-bar--hidden': visible === false }"
    :aria-hidden="visible === false ? 'true' : undefined"
  >
    <!-- 进度条行（设置展开时隐藏） -->
    <div v-if="!showSettings" class="reader-bottom-bar__progress">
      <button class="reader-bottom-bar__text-btn" :disabled="!hasPrev" @click="emit('prev')">
        上一章
      </button>
      <n-slider
        v-model:value="sliderValue"
        :min="1"
        :max="Math.max(chapters.length, 1)"
        :step="1"
        :tooltip="true"
        :format-tooltip="(v: number) => chapters[v - 1]?.name ?? ''"
        style="flex: 1; margin: 0 12px"
      />
      <button class="reader-bottom-bar__text-btn" :disabled="!hasNext" @click="emit('next')">
        下一章
      </button>
    </div>

    <!-- 设置面板（内嵌展开） -->
    <Transition name="reader-bottom-expand">
      <ReaderSettingsPanel
        v-if="showSettings"
        ref="settingsRef"
        :source-type="sourceType"
        @dump-pagination-layout="emit('dump-pagination-layout')"
      />
    </Transition>

    <!-- 功能按钮行 -->
    <div class="reader-bottom-bar__actions">
      <button class="reader-bottom-bar__action" @click="emit('open-toc')">
        <Menu :size="20" />
        <span>目录</span>
      </button>
      <button class="reader-bottom-bar__action" @click="toggleDayNight">
        <Sun v-if="isNight" :size="20" />
        <Moon v-else :size="20" />
        <span>{{ isNight ? '日间' : '夜间' }}</span>
      </button>
      <!-- TTS 按钮：漫画/视频模式无文本，不显示 -->
      <button
        v-if="sourceType !== 'comic' && sourceType !== 'video'"
        class="reader-bottom-bar__action"
        :class="{ 'reader-bottom-bar__action--active': tts.isPlaying.value || tts.isLoading.value }"
        @click="emit('tts-toggle')"
      >
        <Volume2 :size="20" />
        <span>朗读</span>
      </button>

      <button
        class="reader-bottom-bar__action"
        :class="{ 'reader-bottom-bar__action--active': showSettings }"
        @click="toggleSettings"
      >
        <Settings :size="20" />
        <span>设置</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.reader-bottom-bar {
  position: absolute;
  bottom: var(--reader-bottom-bottom, 0px);
  left: var(--reader-bottom-left, 0px);
  right: var(--reader-bottom-right, 0px);
  z-index: 11;
  max-width: var(--reader-bottom-max-width, none);
  margin: var(--reader-bottom-margin, 0);
  padding: var(--reader-bottom-padding, 12px 16px);
  padding-bottom: var(
    --reader-bottom-padding-bottom,
    max(12px, var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))
  );
  border: var(--reader-bottom-border, none);
  border-radius: var(--reader-bottom-radius, 0px);
  box-shadow: var(--reader-bottom-shadow, none);
  background: var(--reader-bottom-bar-bg, rgba(0, 0, 0, 0.65));
  backdrop-filter: var(--reader-bottom-bar-backdrop-filter, blur(12px));
  color: var(--reader-bottom-bar-color, #e0e0e0);
  display: flex;
  flex-direction: var(--reader-bottom-direction, column);
  gap: var(--reader-bottom-gap, 12px);
}

.reader-bottom-bar__progress {
  display: var(--reader-bottom-progress-display, flex);
  align-items: center;
  gap: 4px;
}

.reader-bottom-bar__text-btn {
  background: none;
  border: none;
  color: inherit;
  font-size: 0.8125rem;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  white-space: nowrap;
  opacity: 0.9;
  transition: opacity 0.15s;
}
.reader-bottom-bar__text-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.reader-bottom-bar__text-btn:not(:disabled):hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.1);
}

.reader-bottom-bar__actions {
  display: flex;
  justify-content: var(--reader-bottom-actions-justify, space-around);
  gap: var(--reader-bottom-actions-gap, 0px);
}

.reader-bottom-bar__action {
  display: flex;
  flex-direction: var(--reader-bottom-action-direction, column);
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: inherit;
  font-size: var(--reader-bottom-action-font-size, 0.6875rem);
  cursor: pointer;
  padding: var(--reader-bottom-action-padding, 6px 16px);
  border-radius: var(--reader-bottom-action-radius, 6px);
  transition: background 0.15s;
}
.reader-bottom-bar__action:hover {
  background: rgba(255, 255, 255, 0.1);
}
.reader-bottom-bar__action--active {
  color: var(--reader-bottom-bar-accent, #63e2b7);
}

/* 显隐过渡 */
.reader-bottom-bar-new {
  transition:
    opacity var(--dur-base) var(--ease-standard),
    transform var(--dur-base) var(--ease-standard);
}

.reader-bottom-bar--hidden {
  opacity: 0;
  pointer-events: none;
  transform: translateY(0.5rem);
}

/* 展开/折叠动画 */
.reader-bottom-expand-enter-active,
.reader-bottom-expand-leave-active {
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
}
.reader-bottom-expand-enter-from,
.reader-bottom-expand-leave-to {
  opacity: 0;
  max-height: 0;
}
.reader-bottom-expand-enter-to,
.reader-bottom-expand-leave-from {
  opacity: 1;
  max-height: 500px;
}
</style>
