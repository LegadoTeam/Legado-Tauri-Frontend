<script setup lang="ts">
import { ChevronLeft } from 'lucide-vue-next';
import { toRef } from 'vue';
import { isMobile } from '@/composables/useEnv';
import { useReaderSettingsPanelModel } from '@/features/reader/settings/useReaderSettingsPanelModel';
import ReaderSettingsCustomFontPage from '@/features/reader/settings/components/ReaderSettingsCustomFontPage.vue';
import ReaderSettingsFontPage from '@/features/reader/settings/components/ReaderSettingsFontPage.vue';
import ReaderSettingsMorePage from '@/features/reader/settings/components/ReaderSettingsMorePage.vue';
import ReaderSettingsPagePaddingPage from '@/features/reader/settings/components/ReaderSettingsPagePaddingPage.vue';
import ReaderSettingsShortcutsPage from '@/features/reader/settings/components/ReaderSettingsShortcutsPage.vue';
import ReaderSettingsSpacingPage from '@/features/reader/settings/components/ReaderSettingsSpacingPage.vue';
import ReaderSettingsTypographyPage from '@/features/reader/settings/components/ReaderSettingsTypographyPage.vue';

const props = defineProps<{
  sourceType?: string;
}>();

const emit = defineEmits<{
  (e: 'dump-pagination-layout'): void;
}>();

const {
  settings,
  updateTypography,
  updatePagePadding,
  setFlipMode,
  resetSettings,
  hideTapZoneDebugPreview,
  subPage,
  navigateTo,
  goBack,
  isNight,
  toggleDayNight,
  decreaseFontSize,
  increaseFontSize,
  isComic,
  isVideo,
  canDumpPaginationLayout,
  activeFlipOptions,
  EXPERIMENTAL_FLIP_MODE_HINT,
  showExperimentalFlipModeHint,
  themeOptions,
  selectedThemeId,
  selectThemeOption,
  THEME_ELEGANT_NAMES,
  TAP_ACTION_OPTIONS,
  tapActionLabel,
  tapActionIcon,
  setTapAction,
  toggleTapAction,
  dumpPaginationLayout,
  systemFonts,
  systemFontsLoading,
  systemFontsError,
  fontSearchQuery,
  showAllFonts,
  loadSystemFonts,
  filteredSystemFonts,
  copyFontList,
  FONT_PRESETS,
  currentFontLabel,
  FONT_WEIGHT_PRESETS,
  TEXT_ALIGN_OPTIONS,
  TEXT_SHADOW_PRESETS,
  backgroundOptions,
  selectedBackgroundId,
  selectBackground,
  skinOptions,
  selectedSkinId,
  selectSkin,
  tapZoneBarRef,
  onDividerPointerDown,
  onTapZoneBarPointerMove,
  onTapZoneBarPointerUp,
} = useReaderSettingsPanelModel({
  sourceType: toRef(props, 'sourceType'),
  onDumpPaginationLayout: () => emit('dump-pagination-layout'),
});

defineExpose({ isNight, toggleDayNight, hideTapZoneDebugPreview });
</script>

<template>
  <div class="reader-settings" @click.stop>
    <!-- ============ L1 主设置 ============ -->
    <template v-if="subPage === 'none'">
      <!-- 视频模式下提示使用播放器自带控件 -->
      <template v-if="isVideo">
        <div class="reader-settings__row">
          <span class="reader-settings__hint">视频模式：请使用播放器控件调节播放设置</span>
        </div>
      </template>

      <template v-else>
        <!-- 亮度 -->
        <div class="reader-settings__row">
          <span class="reader-settings__label">亮度</span>
          <n-slider
            :value="settings.brightness"
            @update:value="
              (v: number) => {
                settings.brightness = v;
              }
            "
            :min="20"
            :max="100"
            :step="5"
            style="flex: 1"
          />
          <span class="reader-settings__val" style="width: 36px">{{ settings.brightness }}%</span>
        </div>

        <!-- 字号 + 字体 + 更多 -->
        <div class="reader-settings__row">
          <span class="reader-settings__label">字号</span>
          <div class="reader-settings__font-ctl">
            <button
              class="reader-settings__pill reader-settings__pill--sm"
              @click="decreaseFontSize"
            >
              A<sup>-</sup>
            </button>
            <span class="reader-settings__val reader-settings__val--sm">{{
              settings.typography.fontSize
            }}</span>
            <button
              class="reader-settings__pill reader-settings__pill--sm"
              @click="increaseFontSize"
            >
              A<sup>+</sup>
            </button>
          </div>
          <button
            class="reader-settings__pill reader-settings__pill--nav"
            @click="navigateTo('font')"
          >
            {{ currentFontLabel }} ›
          </button>
          <button class="reader-settings__pill" @click="navigateTo('more')">更多 ›</button>
        </div>

        <!-- 颜色 -->
        <div class="reader-settings__row">
          <span class="reader-settings__label">颜色</span>
          <div class="reader-settings__themes">
            <button
              v-for="t in themeOptions"
              :key="t.id"
              class="reader-settings__swatch"
              :class="{ 'reader-settings__swatch--active': selectedThemeId === t.id }"
              :style="{
                background: t.preview.backgroundColor,
                borderColor: selectedThemeId === t.id ? t.preview.textColor : 'transparent',
              }"
              :title="t.description || t.name"
              @click="selectThemeOption(t)"
            >
              <span class="reader-settings__swatch-inner" :style="{ color: t.preview.textColor }">
                {{ THEME_ELEGANT_NAMES[t.name] ?? t.name }}
              </span>
            </button>
          </div>
        </div>

        <!-- 背景 -->
        <div class="reader-settings__row reader-settings__row--top">
          <span class="reader-settings__label">背景</span>
          <div class="reader-settings__bg-list">
            <div v-for="bg in backgroundOptions" :key="bg.id" class="reader-settings__bg-wrap">
              <button
                class="reader-settings__bg-thumb"
                :class="{
                  'reader-settings__bg-thumb--active': selectedBackgroundId === bg.id,
                }"
                :style="{
                  backgroundColor: bg.preview.backgroundColor || '#fff',
                  backgroundImage: bg.preview.backgroundImage || 'none',
                  backgroundSize: bg.preview.backgroundSize || 'cover',
                  backgroundPosition: bg.preview.backgroundPosition || 'center',
                  backgroundRepeat: bg.preview.backgroundRepeat || 'no-repeat',
                  backgroundBlendMode: bg.preview.backgroundBlendMode || 'normal',
                }"
                :title="bg.description || bg.name"
                @click="selectBackground(bg)"
              >
                <span
                  class="reader-settings__bg-name"
                  :style="{ color: bg.preview.textColor || 'rgba(0, 0, 0, 0.78)' }"
                >
                  {{ bg.name }}
                </span>
              </button>
            </div>
          </div>
        </div>

        <div class="reader-settings__row reader-settings__row--top">
          <span class="reader-settings__label">皮肤</span>
          <div class="reader-settings__skin-list">
            <button
              v-for="skin in skinOptions"
              :key="skin.id"
              class="reader-settings__skin-card"
              :class="{ 'reader-settings__skin-card--active': selectedSkinId === skin.id }"
              :title="skin.description || skin.name"
              @click="selectSkin(skin)"
            >
              <span
                class="reader-settings__skin-preview"
                :style="{
                  background:
                    skin.preview.styleVars?.['--reader-body-surface'] ||
                    skin.preview.backgroundColor ||
                    '#f5f5f5',
                }"
              >
                <span
                  class="reader-settings__skin-preview-bar"
                  :style="{
                    background:
                      skin.preview.styleVars?.['--reader-top-bar-bg'] || 'rgba(0, 0, 0, 0.18)',
                  }"
                />
                <span
                  class="reader-settings__skin-preview-paper"
                  :style="{ color: skin.preview.textColor || '#1f2937' }"
                >
                  Aa
                </span>
              </span>
              <span class="reader-settings__skin-name">{{ skin.name }}</span>
            </button>
          </div>
        </div>

        <!-- 翻页 -->
        <div class="reader-settings__row">
          <span class="reader-settings__label">{{ isComic ? '漫画翻页' : '翻页' }}</span>
          <div class="reader-settings__flip-mode-block">
            <div class="reader-settings__pill-group">
              <button
                v-for="opt in activeFlipOptions"
                :key="opt.value"
                class="reader-settings__pill"
                :class="{ 'reader-settings__pill--active': settings.flipMode === opt.value }"
                @click="setFlipMode(opt.value)"
              >
                {{ opt.label }}
              </button>
            </div>
            <div v-if="showExperimentalFlipModeHint" class="reader-settings__flip-mode-hint">
              {{ EXPERIMENTAL_FLIP_MODE_HINT }}
            </div>
          </div>
        </div>
      </template>
    </template>

    <!-- ============ L2 更多设置 ============ -->
    <ReaderSettingsMorePage
      v-else-if="subPage === 'more'"
      :settings="settings"
      :font-weight-presets="FONT_WEIGHT_PRESETS"
      :is-comic="isComic"
      :is-video="isVideo"
      :is-mobile="isMobile"
      :can-dump-pagination-layout="canDumpPaginationLayout"
      @back="goBack"
      @reset="resetSettings"
      @update-typography="updateTypography"
      @set-layout-debug="settings.layoutDebugMode = $event"
      @set-volume-key-page-turn="settings.volumeKeyPageTurnEnabled = $event"
      @set-hide-top-bar-on-mobile="settings.hideTopBarOnMobile = $event"
      @dump-pagination-layout="dumpPaginationLayout"
      @navigate="navigateTo"
    />

    <!-- ============ L2 点击控制 ============ -->
    <template v-else-if="subPage === 'tapControls'">
      <div class="reader-settings__sub-header">
        <button class="reader-settings__back" @click="goBack()">
          <ChevronLeft :size="16" />
        </button>
        <span class="reader-settings__sub-title">点击控制</span>
      </div>

      <div class="reader-settings__row">
        <span class="reader-settings__label">左区</span>
        <div class="reader-settings__pill-group">
          <button
            v-for="opt in TAP_ACTION_OPTIONS"
            :key="`left-${opt.value}`"
            class="reader-settings__pill"
            :class="{ 'reader-settings__pill--active': settings.tapLeftAction === opt.value }"
            @click="setTapAction('left', opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <div class="reader-settings__row">
        <span class="reader-settings__label">右区</span>
        <div class="reader-settings__pill-group">
          <button
            v-for="opt in TAP_ACTION_OPTIONS"
            :key="`right-${opt.value}`"
            class="reader-settings__pill"
            :class="{ 'reader-settings__pill--active': settings.tapRightAction === opt.value }"
            @click="setTapAction('right', opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <div class="reader-settings__row">
        <span class="reader-settings__label">中区</span>
        <span class="reader-settings__hint">固定打开或关闭阅读菜单</span>
      </div>

      <!-- 点击区域 -->
      <div class="reader-settings__row reader-settings__row--top">
        <span class="reader-settings__label">点击区</span>
        <div
          class="reader-settings__tap-zone-bar"
          ref="tapZoneBarRef"
          @pointermove="onTapZoneBarPointerMove"
          @pointerup="onTapZoneBarPointerUp"
          @pointercancel="onTapZoneBarPointerUp"
        >
          <button
            type="button"
            class="reader-settings__tap-region reader-settings__tap-region--left"
            :style="{ width: settings.tapZoneLeft * 100 + '%' }"
            title="点击切换左区动作，拖动分界调整宽度"
            @click="toggleTapAction('left')"
          >
            <span class="reader-settings__tap-action-icon">{{
              tapActionIcon(settings.tapLeftAction)
            }}</span>
            <span>{{ tapActionLabel(settings.tapLeftAction) }}</span>
            <span>{{ Math.round(settings.tapZoneLeft * 100) }}%</span>
          </button>
          <div
            class="reader-settings__tap-divider"
            @pointerdown="onDividerPointerDown($event, 'left')"
            title="拖动调整"
          >
            <span class="reader-settings__tap-divider-grip">⋮</span>
          </div>
          <div
            class="reader-settings__tap-region reader-settings__tap-region--center"
            style="flex: 1"
          >
            <span class="reader-settings__tap-action-icon">☰</span>
            <span>菜单</span>
            <span>{{ Math.round((settings.tapZoneRight - settings.tapZoneLeft) * 100) }}%</span>
          </div>
          <div
            class="reader-settings__tap-divider"
            @pointerdown="onDividerPointerDown($event, 'right')"
            title="拖动调整"
          >
            <span class="reader-settings__tap-divider-grip">⋮</span>
          </div>
          <button
            type="button"
            class="reader-settings__tap-region reader-settings__tap-region--right"
            :style="{ width: (1 - settings.tapZoneRight) * 100 + '%' }"
            title="点击切换右区动作，拖动分界调整宽度"
            @click="toggleTapAction('right')"
          >
            <span class="reader-settings__tap-action-icon">{{
              tapActionIcon(settings.tapRightAction)
            }}</span>
            <span>{{ tapActionLabel(settings.tapRightAction) }}</span>
            <span>{{ Math.round((1 - settings.tapZoneRight) * 100) }}%</span>
          </button>
        </div>
      </div>

      <div class="reader-settings__tap-debug-note">
        点击左右色块可切换动作；拖动分界可调整点击区宽度。调整时会在阅读页短暂显示预览。
      </div>
    </template>

    <!-- ============ L2 间距设置 ============ -->
    <ReaderSettingsSpacingPage
      v-else-if="subPage === 'spacing'"
      :settings="settings"
      @back="goBack"
      @update-typography="updateTypography"
    />

    <!-- ============ L2 页边距设置 ============ -->
    <ReaderSettingsPagePaddingPage
      v-else-if="subPage === 'pagePadding'"
      :settings="settings"
      @back="goBack"
      @update-page-padding="updatePagePadding"
    />

    <!-- ============ L2 字体选择 ============ -->
    <ReaderSettingsFontPage
      v-else-if="subPage === 'font'"
      :settings="settings"
      :font-presets="FONT_PRESETS"
      @back="goBack"
      @update-typography="updateTypography"
      @navigate="navigateTo"
      @load-system-fonts="loadSystemFonts"
    />

    <!-- ============ L2 字体样式 ============ -->
    <ReaderSettingsTypographyPage
      v-else-if="subPage === 'typography'"
      :settings="settings"
      :text-align-options="TEXT_ALIGN_OPTIONS"
      :text-shadow-presets="TEXT_SHADOW_PRESETS"
      @back="goBack"
      @update-typography="updateTypography"
    />

    <!-- ============ L2 快捷键说明 ============ -->
    <ReaderSettingsShortcutsPage
      v-else-if="subPage === 'shortcuts'"
      :volume-key-page-turn-enabled="settings.volumeKeyPageTurnEnabled"
      @back="goBack"
    />

    <!-- ============ L2 自定义系统字体 ============ -->
    <ReaderSettingsCustomFontPage
      v-else-if="subPage === 'customFont'"
      v-model:show-all-fonts="showAllFonts"
      v-model:font-search-query="fontSearchQuery"
      :settings="settings"
      :system-fonts="systemFonts"
      :system-fonts-loading="systemFontsLoading"
      :system-fonts-error="systemFontsError"
      :filtered-system-fonts="filteredSystemFonts"
      @back="goBack"
      @copy-font-list="copyFontList"
      @update-typography="updateTypography"
    />
  </div>
</template>

<style scoped>
.reader-settings {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 0;
  /* border-top: 1px solid rgba(255, 255, 255, 0.08); */
  /* border-bottom: 1px solid rgba(255, 255, 255, 0.08); */
}

/* ---- 通用行 ---- */
.reader-settings__row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.reader-settings__switch-row {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.reader-settings__flip-mode-block {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.reader-settings__hint {
  font-size: 12px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.62);
}

.reader-settings__flip-mode-hint {
  font-size: 12px;
  line-height: 1.5;
  color: rgba(255, 196, 105, 0.88);
}

.reader-settings__tap-debug-note {
  margin-top: -4px;
  margin-left: 48px;
  font-size: 12px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.48);
}

.reader-settings__row--top {
  align-items: flex-start;
}

.reader-settings__label {
  flex-shrink: 0;
  width: 36px;
  font-size: 0.8125rem;
  opacity: 0.7;
}

.reader-settings__val {
  font-size: 0.875rem;
  text-align: center;
  min-width: 28px;
}

/* ---- 字号控件 ---- */
.reader-settings__font-ctl {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* ---- 小号药丸（字号 A-/A+） ---- */
.reader-settings__pill--sm {
  height: 28px;
  min-width: 32px;
  padding: 0 4px;
  font-size: 0.75rem;
}

.reader-settings__val--sm {
  min-width: 20px;
  font-size: 0.875rem;
  text-align: center;
}

/* ---- 药丸按钮 ---- */
.reader-settings__pill {
  height: 36px;
  min-width: 52px;
  padding: 0 14px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.06);
  color: inherit;
  font-size: 0.8125rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  transition:
    background 0.15s,
    border-color 0.15s;
  white-space: nowrap;
}

.reader-settings__pill:hover {
  background: rgba(255, 255, 255, 0.14);
}

.reader-settings__pill--active {
  background: rgba(99, 226, 183, 0.15);
  border-color: #63e2b7;
  color: #63e2b7;
}

.reader-settings__pill--nav {
  margin-left: auto;
}

/* ---- 药丸组（翻页等） ---- */
.reader-settings__pill-group {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  flex: 1;
}

.reader-settings__pill-group .reader-settings__pill {
  flex: 1;
  min-width: 0;
  padding: 0 6px;
}

/* ---- 颜色色块 ---- */
.reader-settings__themes {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.reader-settings__swatch {
  width: 52px;
  height: 40px;
  border-radius: 10px;
  border: 2.5px solid transparent;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition:
    transform 0.15s,
    border-color 0.15s,
    box-shadow 0.15s;
  padding: 0;
}

.reader-settings__swatch:hover {
  transform: scale(1.06);
}

.reader-settings__swatch--active {
  transform: scale(1.08);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.15);
}

.reader-settings__swatch-inner {
  font-size: 0.5625rem;
  font-weight: bold;
  /* font-weight: 500; */
  letter-spacing: 0.05em;
  pointer-events: none;
  line-height: 1;
}

/* ---- 背景缩略图 ---- */
.reader-settings__bg-list {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  flex: 1;
}

.reader-settings__bg-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.reader-settings__bg-thumb {
  width: 52px;
  height: 40px;
  border-radius: 10px;
  border: 2.5px solid transparent;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition:
    transform 0.15s,
    border-color 0.15s,
    box-shadow 0.15s;
  padding: 0;
}

.reader-settings__bg-thumb:hover {
  transform: scale(1.06);
}

.reader-settings__bg-thumb--active {
  border-color: #63e2b7;
  transform: scale(1.08);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.15);
}

.reader-settings__bg-name {
  font-size: 0.5625rem;
  font-weight: bold;
  /* font-weight: 500; */
  letter-spacing: 0.05em;
  pointer-events: none;
  line-height: 1;
}

.reader-settings__skin-list {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  flex: 1;
}

.reader-settings__skin-card {
  width: 72px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  color: inherit;
  cursor: pointer;
  overflow: hidden;
  transition:
    transform 0.15s ease,
    border-color 0.15s ease,
    background 0.15s ease;
}

.reader-settings__skin-card:hover {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.08);
}

.reader-settings__skin-card--active {
  border-color: #63e2b7;
  background: rgba(99, 226, 183, 0.12);
}

.reader-settings__skin-preview {
  position: relative;
  display: block;
  height: 46px;
  padding: 8px 8px 7px;
}

.reader-settings__skin-preview-bar {
  display: block;
  height: 8px;
  border-radius: 999px;
  margin-bottom: 6px;
}

.reader-settings__skin-preview-paper {
  display: flex;
  align-items: center;
  justify-content: center;
  height: calc(100% - 14px);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.88);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
}

.reader-settings__skin-name {
  display: block;
  padding: 0 6px 8px;
  font-size: 0.625rem;
  font-weight: 600;
  line-height: 1.2;
  text-align: center;
}

/* ---- L2 子页面头部 ---- */
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

/* ---- L2 字体列表 ---- */
.reader-settings__font-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.reader-settings__font-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 8px;
  border: none;
  background: rgba(255, 255, 255, 0.04);
  color: inherit;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background 0.15s;
}

.reader-settings__font-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.reader-settings__font-item--active {
  background: rgba(99, 226, 183, 0.1);
  color: #63e2b7;
}

/* ---- 颜色选择器色块 ---- */
.reader-settings__color-swatch {
  position: relative;
  display: inline-flex;
  cursor: pointer;
  flex-shrink: 0;
}

.reader-settings__color-swatch input[type='color'] {
  position: absolute;
  inset: 0;
  opacity: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
  border: none;
  padding: 0;
}

.reader-settings__color-swatch span {
  display: block;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1.5px solid rgba(255, 255, 255, 0.2);
  transition: border-color 0.15s;
  pointer-events: none;
}

.reader-settings__color-swatch:hover span {
  border-color: rgba(255, 255, 255, 0.5);
}

/* ---- 点击区域指示器 ---- */
.reader-settings__tap-zone-bar {
  flex: 1;
  display: flex;
  align-items: stretch;
  height: 44px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.12);
  user-select: none;
  touch-action: none;
}

.reader-settings__tap-region {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  font-size: 0.6875rem;
  min-width: 0;
  overflow: hidden;
  transition: background 0.15s;
  border: none;
  padding: 0 2px;
  font-family: inherit;
  white-space: nowrap;
}

.reader-settings__tap-region--left {
  background: rgba(99, 226, 183, 0.08);
  color: rgba(99, 226, 183, 0.85);
  flex-shrink: 0;
  cursor: pointer;
}

.reader-settings__tap-region--center {
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.55);
}

.reader-settings__tap-region--right {
  background: rgba(99, 226, 183, 0.08);
  color: rgba(99, 226, 183, 0.85);
  flex-shrink: 0;
  cursor: pointer;
}

.reader-settings__tap-region--left:hover,
.reader-settings__tap-region--right:hover {
  background: rgba(99, 226, 183, 0.16);
}

.reader-settings__tap-action-icon {
  font-size: 0.875rem;
  line-height: 1;
  font-weight: 700;
}

.reader-settings__tap-divider {
  width: 14px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.08);
  cursor: ew-resize;
  touch-action: none;
  transition: background 0.15s;
}

.reader-settings__tap-divider:hover {
  background: rgba(99, 226, 183, 0.25);
}

.reader-settings__tap-divider-grip {
  font-size: 0.75rem;
  line-height: 1;
  color: rgba(255, 255, 255, 0.4);
  letter-spacing: -2px;
  pointer-events: none;
}

/* ---- 字体列表补充样式 ---- */
.reader-settings__font-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
  margin: 4px 0;
}

.reader-settings__font-item--nav {
  justify-content: space-between;
}

.reader-settings__font-custom-badge {
  font-size: 0.625rem;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(99, 226, 183, 0.2);
  color: #63e2b7;
}

</style>
