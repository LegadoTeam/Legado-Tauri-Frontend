<script setup lang="ts">
import { computed } from 'vue'
import SettingSection from './SettingSection.vue'
import SettingItem from './SettingItem.vue'
import { useReaderSettings } from '@/components/reader/composables/useReaderSettings'
import { PRESET_THEMES, type FlipMode } from '@/components/reader/types'

const { settings, setTheme, setFlipMode, updateTypography, resetSettings } = useReaderSettings()

const NIGHT_THEME = PRESET_THEMES[4]
const DAY_THEME = PRESET_THEMES[0]
const readerIsNight = computed(() => settings.theme.name === NIGHT_THEME.name)

function toggleNight() {
  setTheme(readerIsNight.value ? DAY_THEME : NIGHT_THEME)
}

const FLIP_OPTIONS: { label: string; value: FlipMode }[] = [
  { label: '仿真', value: 'simulation' },
  { label: '覆盖', value: 'cover' },
  { label: '平移', value: 'slide' },
  { label: '上下滚动', value: 'scroll' },
  { label: '无动画', value: 'none' },
]

function decreaseFontSize() {
  if (settings.typography.fontSize > 12) {
    updateTypography({ fontSize: settings.typography.fontSize - 1 })
  }
}

function increaseFontSize() {
  if (settings.typography.fontSize < 40) {
    updateTypography({ fontSize: settings.typography.fontSize + 1 })
  }
}
</script>

<template>
  <SettingSection title="阅读偏好" section-id="section-reader">
    <!-- 夜间模式 -->
    <SettingItem label="夜间模式" desc="切换阅读器背景主题（纯黑夜 / 默认白）">
      <n-switch :value="readerIsNight" @update:value="toggleNight" />
    </SettingItem>

    <!-- 主题色 -->
    <SettingItem label="背景颜色" desc="选择阅读器预设主题">
      <div class="reader-themes">
        <button
          v-for="t in PRESET_THEMES"
          :key="t.name"
          class="reader-swatch"
          :class="{ 'reader-swatch--active': settings.theme.name === t.name }"
          :style="{ background: t.backgroundColor, outlineColor: t.textColor }"
          :title="t.name"
          @click="setTheme(t)"
        />
      </div>
    </SettingItem>

    <!-- 字号 -->
    <SettingItem label="字号" desc="阅读器正文字体大小">
      <div class="font-size-ctl">
        <n-button size="small" circle :disabled="settings.typography.fontSize <= 12" @click="decreaseFontSize">A<sup>-</sup></n-button>
        <span class="font-size-val">{{ settings.typography.fontSize }}px</span>
        <n-button size="small" circle :disabled="settings.typography.fontSize >= 40" @click="increaseFontSize">A<sup>+</sup></n-button>
      </div>
    </SettingItem>

    <!-- 翻页模式 -->
    <SettingItem label="翻页模式" desc="阅读器默认翻页方式">
      <n-radio-group
        :value="settings.flipMode"
        size="small"
        @update:value="(v: string) => setFlipMode(v as FlipMode)"
      >
        <n-radio-button v-for="opt in FLIP_OPTIONS" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </n-radio-button>
      </n-radio-group>
    </SettingItem>

    <!-- 行距 -->
    <SettingItem label="行距" desc="正文行间距倍数">
      <div class="slider-row">
        <n-slider
          :value="settings.typography.lineHeight"
          @update:value="(v: number) => updateTypography({ lineHeight: v })"
          :min="1.0" :max="3.0" :step="0.1"
          :format-tooltip="(v: number) => v.toFixed(1)"
          style="width: 140px"
        />
        <span class="slider-val">{{ settings.typography.lineHeight.toFixed(1) }}</span>
      </div>
    </SettingItem>

    <!-- 返回行为 -->
    <SettingItem label="返回键行为" desc="阅读时（未打开菜单/设置）按返回键的行为">
      <n-radio-group
        :value="settings.backBehavior"
        size="small"
        @update:value="(v: string) => (settings.backBehavior = v as 'bookshelf' | 'desktop')"
      >
        <n-radio-button value="bookshelf">返回书架</n-radio-button>
        <n-radio-button value="desktop">回到桌面</n-radio-button>
      </n-radio-group>
    </SettingItem>

    <!-- 重置 -->
    <SettingItem label="恢复默认" desc="将所有阅读设置重置为默认值">
      <n-button size="small" quaternary @click="resetSettings">恢复默认阅读设置</n-button>
    </SettingItem>
  </SettingSection>
</template>

<style scoped>
.reader-themes {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.reader-swatch {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid transparent;
  outline: 2px solid transparent;
  cursor: pointer;
  transition: outline-offset 0.15s, outline-color 0.15s;
  outline-offset: 2px;
}

.reader-swatch--active {
  outline-width: 2px;
  outline-style: solid;
  outline-offset: 2px;
}

.font-size-ctl {
  display: flex;
  align-items: center;
  gap: 10px;
}

.font-size-val {
  font-size: 0.875rem;
  font-weight: 600;
  min-width: 44px;
  text-align: center;
  color: var(--color-text-primary);
}

.slider-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.slider-val {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  min-width: 36px;
  text-align: right;
}
</style>
