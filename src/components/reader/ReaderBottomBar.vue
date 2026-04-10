<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { ChapterItem } from '../../composables/useScriptBridge'
import ReaderSettingsPanel from './ReaderSettingsPanel.vue'
import { useReaderSettings } from './composables/useReaderSettings'
import { PRESET_THEMES } from './types'

const props = defineProps<{
  chapters: ChapterItem[]
  currentIndex: number
  hasPrev: boolean
  hasNext: boolean
  sourceType?: string
}>()

const emit = defineEmits<{
  (e: 'prev'): void
  (e: 'next'): void
  (e: 'goto', idx: number): void
  (e: 'open-toc'): void
  (e: 'settings-visible', val: boolean): void
}>()

const settingsRef = ref<InstanceType<typeof ReaderSettingsPanel> | null>(null)
const showSettings = ref(false)

function toggleSettings() {
  showSettings.value = !showSettings.value
}

function closeSettings() {
  showSettings.value = false
}

watch(showSettings, (val) => emit('settings-visible', val))

defineExpose({ closeSettings })

const sliderValue = computed({
  get: () => props.currentIndex + 1,
  set: (val: number) => {
    const idx = val - 1
    if (idx !== props.currentIndex && idx >= 0 && idx < props.chapters.length) {
      emit('goto', idx)
    }
  },
})

/* ---- 日夜切换（直接从 useReaderSettings 读取，不依赖 settingsRef） ---- */
const { settings, setTheme } = useReaderSettings()
const NIGHT_THEME = PRESET_THEMES[4]
const DAY_THEME = PRESET_THEMES[0]

const isNight = computed(() => settings.theme.name === NIGHT_THEME.name)

function toggleDayNight() {
  setTheme(isNight.value ? DAY_THEME : NIGHT_THEME)
}
</script>

<template>
  <div class="reader-bottom-bar">
    <!-- 进度条行（设置展开时隐藏） -->
    <div v-if="!showSettings" class="reader-bottom-bar__progress">
      <button class="reader-bottom-bar__text-btn" :disabled="!hasPrev" @click="emit('prev')">上一章</button>
      <n-slider
        v-model:value="sliderValue"
        :min="1"
        :max="Math.max(chapters.length, 1)"
        :step="1"
        :tooltip="true"
        :format-tooltip="(v: number) => chapters[v - 1]?.name ?? ''"
        style="flex:1; margin: 0 12px"
      />
      <button class="reader-bottom-bar__text-btn" :disabled="!hasNext" @click="emit('next')">下一章</button>
    </div>

    <!-- 设置面板（内嵌展开） -->
    <Transition name="reader-bottom-expand">
      <ReaderSettingsPanel v-if="showSettings" ref="settingsRef" :source-type="sourceType" />
    </Transition>

    <!-- 功能按钮行 -->
    <div class="reader-bottom-bar__actions">
      <button class="reader-bottom-bar__action" @click="emit('open-toc')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        <span>目录</span>
      </button>
      <button class="reader-bottom-bar__action" @click="toggleDayNight">
        <svg v-if="isNight" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        <span>{{ isNight ? '日间' : '夜间' }}</span>
      </button>
      <button
        class="reader-bottom-bar__action"
        :class="{ 'reader-bottom-bar__action--active': showSettings }"
        @click="toggleSettings"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        <span>设置</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.reader-bottom-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 11;
  padding: 12px 16px;
  padding-bottom: max(12px, var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)));
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(12px);
  color: #e0e0e0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.reader-bottom-bar__progress {
  display: flex;
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
  justify-content: space-around;
}

.reader-bottom-bar__action {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: inherit;
  font-size: 0.6875rem;
  cursor: pointer;
  padding: 6px 16px;
  border-radius: 6px;
  transition: background 0.15s;
}
.reader-bottom-bar__action:hover {
  background: rgba(255, 255, 255, 0.1);
}
.reader-bottom-bar__action--active {
  color: #63e2b7;
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
