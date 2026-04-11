<script setup lang="ts">
import { ref, computed } from 'vue'
import { useReaderSettings } from './composables/useReaderSettings'
import { PRESET_THEMES, type FlipMode } from './types'

const props = defineProps<{
  sourceType?: string
}>()

const { settings, updateTypography, setTheme, setFlipMode } = useReaderSettings()

/* ---- L2 子页面导航 ---- */
type SubPage = 'none' | 'spacing' | 'font' | 'shortcuts' | 'typography' | 'more'
const subPage = ref<SubPage>('none')
const prevPage = ref<SubPage>('none')

function navigateTo(page: SubPage) {
  prevPage.value = subPage.value
  subPage.value = page
}
function goBack() {
  subPage.value = prevPage.value
  prevPage.value = 'none'
}

/* ---- 主题 & 日夜 ---- */
const DAY_THEME = PRESET_THEMES[0]
const NIGHT_THEME = PRESET_THEMES[4]
const isNight = computed(() => settings.theme.name === NIGHT_THEME.name)

/* ---- 主题雅称映射 ---- */
const THEME_ELEGANT_NAMES: Record<string, string> = {
  '默认白': '霜白',
  '护眼绿': '碧荫',
  '羊皮纸': '书香',
  '暮光蓝': '暮蓝',
  '纯黑夜': '子夜',
  '柔粉色': '桃粉',
}

function toggleDayNight() {
  setTheme(isNight.value ? DAY_THEME : NIGHT_THEME)
}

/* ---- 字号 ---- */
function decreaseFontSize() {
  if (settings.typography.fontSize > 12) updateTypography({ fontSize: settings.typography.fontSize - 1 })
}
function increaseFontSize() {
  if (settings.typography.fontSize < 40) updateTypography({ fontSize: settings.typography.fontSize + 1 })
}

/* ---- 翻页模式 ---- */
const isComic = computed(() => props.sourceType === 'comic')

const FLIP_OPTIONS: { label: string; value: FlipMode }[] = [
  { label: '仿真', value: 'simulation' },
  { label: '覆盖', value: 'cover' },
  { label: '平移', value: 'slide' },
  { label: '上下', value: 'scroll' },
  { label: '无动画', value: 'none' },
]

const COMIC_FLIP_OPTIONS: { label: string; value: FlipMode }[] = [
  { label: '上下', value: 'scroll' },
]

const activeFlipOptions = computed(() => isComic.value ? COMIC_FLIP_OPTIONS : FLIP_OPTIONS)

/** 漫画模式只允许选白色 */
const activeThemes = computed(() => isComic.value ? PRESET_THEMES.slice(0, 1) : PRESET_THEMES)

/* ---- 字体预设 ---- */
const FONT_PRESETS = [
  { label: '系统默认', value: 'system-ui, -apple-system, sans-serif' },
  { label: '衬线体', value: '"Noto Serif SC", "Source Han Serif CN", "SimSun", serif' },
  { label: '宋体', value: '"SimSun", "宋体", serif' },
  { label: '楷体', value: '"KaiTi", "楷体", serif' },
  { label: '黑体', value: '"SimHei", "黑体", sans-serif' },
  { label: '仿宋', value: '"FangSong", "仿宋", serif' },
]

const currentFontLabel = computed(() => {
  return FONT_PRESETS.find(f => f.value === settings.typography.fontFamily)?.label ?? '自定义'
})

/* ---- 字重预设（仅保留字体普遍支持的三档）---- */
const FONT_WEIGHT_PRESETS = [
  { label: '细', value: 300 },
  { label: '正常', value: 400 },
  { label: '粗', value: 700 },
]

/* ---- 对齐方式 ---- */
const TEXT_ALIGN_OPTIONS: { label: string; value: 'left' | 'center' | 'right' | 'justify' }[] = [
  { label: '左', value: 'left' },
  { label: '居中', value: 'center' },
  { label: '右', value: 'right' },
  { label: '两端', value: 'justify' },
]

/* ---- 文字阴影预设 ---- */
const TEXT_SHADOW_PRESETS = [
  { label: '无', value: 'none' },
  { label: '轻描', value: '0 1px 3px rgba(0,0,0,0.35)' },
  { label: '浮雕', value: '1px 1px 0 rgba(0,0,0,0.45), -1px -1px 0 rgba(255,255,255,0.08)' },
  { label: '发光', value: '0 0 8px rgba(255,255,255,0.5)' },
]

/* ---- 背景纹理预设 ---- */
interface BgPreset {
  name: string
  value: string
  thumb: string
}

const BG_PRESETS: BgPreset[] = [
  { name: '纯色', value: '', thumb: '' },
  {
    name: '纸纹',
    value: 'repeating-linear-gradient(0deg, transparent, transparent 28px, rgba(0,0,0,0.04) 28px, rgba(0,0,0,0.04) 29px)',
    thumb: 'repeating-linear-gradient(0deg, transparent, transparent 6px, rgba(0,0,0,0.08) 6px, rgba(0,0,0,0.08) 7px)',
  },
  {
    name: '牛皮纸',
    value: 'radial-gradient(ellipse at 20% 80%, rgba(180,140,100,0.12) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(180,140,100,0.08) 0%, transparent 50%)',
    thumb: 'radial-gradient(ellipse at 30% 70%, rgba(180,140,100,0.25) 0%, transparent 60%)',
  },
  {
    name: '织物',
    value: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.02) 2px, rgba(0,0,0,0.02) 4px), repeating-linear-gradient(-45deg, transparent, transparent 2px, rgba(0,0,0,0.02) 2px, rgba(0,0,0,0.02) 4px)',
    thumb: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px), repeating-linear-gradient(-45deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px)',
  },
  {
    name: '星点',
    value: 'radial-gradient(1px 1px at 10% 20%, rgba(255,255,255,0.12) 1px, transparent 0), radial-gradient(1px 1px at 40% 60%, rgba(255,255,255,0.09) 1px, transparent 0), radial-gradient(1px 1px at 70% 15%, rgba(255,255,255,0.1) 1px, transparent 0), radial-gradient(1px 1px at 90% 80%, rgba(255,255,255,0.08) 1px, transparent 0)',
    thumb: 'radial-gradient(1px 1px at 25% 35%, rgba(255,255,255,0.3) 1px, transparent 0), radial-gradient(1px 1px at 65% 55%, rgba(255,255,255,0.2) 1px, transparent 0)',
  },
]

/* ---- 点击区域拖拽调整 ---- */
const tapZoneBarRef = ref<HTMLElement | null>(null)
let _draggingDivider: 'left' | 'right' | null = null

function onDividerPointerDown(e: PointerEvent, which: 'left' | 'right') {
  e.preventDefault()
  _draggingDivider = which
  tapZoneBarRef.value?.setPointerCapture(e.pointerId)
}

function onTapZoneBarPointerMove(e: PointerEvent) {
  if (!_draggingDivider || !tapZoneBarRef.value) return
  const rect = tapZoneBarRef.value.getBoundingClientRect()
  const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  // 吸附到 5% 格
  const snapped = Math.round(relX * 20) / 20
  if (_draggingDivider === 'left') {
    settings.tapZoneLeft = Math.max(0.10, Math.min(settings.tapZoneRight - 0.15, snapped))
  } else {
    settings.tapZoneRight = Math.max(settings.tapZoneLeft + 0.15, Math.min(0.90, snapped))
  }
}

function onTapZoneBarPointerUp() {
  _draggingDivider = null
}

defineExpose({ isNight, toggleDayNight })
</script>

<template>
  <div class="reader-settings" @click.stop>
    <!-- ============ L1 主设置 ============ -->
    <template v-if="subPage === 'none'">
      <!-- 亮度 -->
      <div class="reader-settings__row">
        <span class="reader-settings__label">亮度</span>
        <n-slider :value="settings.brightness" @update:value="(v: number) => { settings.brightness = v }" :min="20"
          :max="100" :step="5" style="flex:1" />
        <span class="reader-settings__val" style="width:36px">{{ settings.brightness }}%</span>
      </div>

      <!-- 字号 + 字体 + 更多 -->
      <div class="reader-settings__row">
        <span class="reader-settings__label">字号</span>
        <div class="reader-settings__font-ctl">
          <button class="reader-settings__pill reader-settings__pill--sm"
            @click="decreaseFontSize">A<sup>-</sup></button>
          <span class="reader-settings__val reader-settings__val--sm">{{ settings.typography.fontSize }}</span>
          <button class="reader-settings__pill reader-settings__pill--sm"
            @click="increaseFontSize">A<sup>+</sup></button>
        </div>
        <button class="reader-settings__pill reader-settings__pill--nav" @click="navigateTo('font')">
          {{ currentFontLabel }} ›
        </button>
        <button class="reader-settings__pill" @click="navigateTo('more')">
          更多 ›
        </button>
      </div>

      <!-- 颜色 -->
      <div class="reader-settings__row">
        <span class="reader-settings__label">颜色</span>
        <div class="reader-settings__themes">
          <button v-for="t in activeThemes" :key="t.name" class="reader-settings__swatch"
            :class="{ 'reader-settings__swatch--active': settings.theme.name === t.name }"
            :style="{ background: t.backgroundColor, borderColor: settings.theme.name === t.name ? t.textColor : 'transparent' }"
            :title="t.name" @click="setTheme(t)">
            <span class="reader-settings__swatch-inner" :style="{ color: t.textColor }">
              {{ THEME_ELEGANT_NAMES[t.name] ?? t.name }}
            </span>
          </button>
        </div>
      </div>

      <!-- 背景 -->
      <div class="reader-settings__row reader-settings__row--top">
        <span class="reader-settings__label">背景</span>
        <div class="reader-settings__bg-list">
          <div v-for="bg in BG_PRESETS" :key="bg.name" class="reader-settings__bg-wrap">
            <button class="reader-settings__bg-thumb"
              :class="{ 'reader-settings__bg-thumb--active': settings.backgroundImage === bg.value }"
              :style="{ backgroundImage: bg.thumb || 'none', backgroundColor: settings.theme.backgroundColor }"
              :title="bg.name" @click="settings.backgroundImage = bg.value">
              <span class="reader-settings__bg-name">{{ bg.name }}</span>
            </button>

            <!-- 他应该在背景图内部  跟颜色一样  浮动在内部居中位置 -->
          </div>
        </div>
      </div>

      <!-- 翻页 -->
      <div class="reader-settings__row">
        <span class="reader-settings__label">{{ isComic ? '漫画翻页' : '翻页' }}</span>
        <div class="reader-settings__pill-group">
          <button v-for="opt in activeFlipOptions" :key="opt.value" class="reader-settings__pill"
            :class="{ 'reader-settings__pill--active': settings.flipMode === opt.value }"
            @click="setFlipMode(opt.value)">
            {{ opt.label }}
          </button>
        </div>
      </div>


    </template>

    <!-- ============ L2 更多设置 ============ -->
    <template v-else-if="subPage === 'more'">
      <div class="reader-settings__sub-header">
        <button class="reader-settings__back" @click="goBack()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span class="reader-settings__sub-title">更多设置</span>
      </div>

      <!-- 粗细 -->
      <div class="reader-settings__row">
        <span class="reader-settings__label">粗细</span>
        <div class="reader-settings__pill-group">
          <button v-for="w in FONT_WEIGHT_PRESETS" :key="w.value" class="reader-settings__pill"
            :class="{ 'reader-settings__pill--active': settings.typography.fontWeight === w.value }"
            :style="{ fontWeight: w.value }" @click="updateTypography({ fontWeight: w.value })">{{ w.label }}</button>
        </div>
      </div>

      <!-- 点击区域 -->
      <div v-if="!isComic" class="reader-settings__row reader-settings__row--top">
        <span class="reader-settings__label">点击区</span>
        <div
          class="reader-settings__tap-zone-bar"
          ref="tapZoneBarRef"
          @pointermove="onTapZoneBarPointerMove"
          @pointerup="onTapZoneBarPointerUp"
          @pointercancel="onTapZoneBarPointerUp"
        >
          <!-- 左区（上一页） -->
          <div
            class="reader-settings__tap-region reader-settings__tap-region--left"
            :style="{ width: (settings.tapZoneLeft * 100) + '%' }"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            <span>{{ Math.round(settings.tapZoneLeft * 100) }}%</span>
          </div>
          <!-- 左分界拖柄 -->
          <div
            class="reader-settings__tap-divider"
            @pointerdown="onDividerPointerDown($event, 'left')"
            title="拖动调整"
          >
            <span class="reader-settings__tap-divider-grip">⋮</span>
          </div>
          <!-- 中区（菜单） -->
          <div class="reader-settings__tap-region reader-settings__tap-region--center" style="flex:1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            <span>{{ Math.round((settings.tapZoneRight - settings.tapZoneLeft) * 100) }}%</span>
          </div>
          <!-- 右分界拖柄 -->
          <div
            class="reader-settings__tap-divider"
            @pointerdown="onDividerPointerDown($event, 'right')"
            title="拖动调整"
          >
            <span class="reader-settings__tap-divider-grip">⋮</span>
          </div>
          <!-- 右区（下一页） -->
          <div
            class="reader-settings__tap-region reader-settings__tap-region--right"
            :style="{ width: ((1 - settings.tapZoneRight) * 100) + '%' }"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            <span>{{ Math.round((1 - settings.tapZoneRight) * 100) }}%</span>
          </div>
        </div>
      </div>

      <!-- 导航列表 -->
      <div class="reader-settings__more-list">
        <button class="reader-settings__more-item" @click="navigateTo('spacing')">
          <span>间距设置</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
        <button class="reader-settings__more-item" @click="navigateTo('typography')">
          <span>字体样式</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
        <button class="reader-settings__more-item" @click="navigateTo('shortcuts')">
          <span>快捷键说明</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </template>

    <!-- ============ L2 间距设置 ============ -->
    <template v-else-if="subPage === 'spacing'">
      <div class="reader-settings__sub-header">
        <button class="reader-settings__back" @click="goBack()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span class="reader-settings__sub-title">间距设置</span>
      </div>

      <div class="reader-settings__row">
        <span class="reader-settings__label">行距</span>
        <n-slider :value="settings.typography.lineHeight"
          @update:value="(v: number) => updateTypography({ lineHeight: v })" :min="1.0" :max="3.0" :step="0.1"
          :format-tooltip="(v: number) => v.toFixed(1)" style="flex:1" />
        <span class="reader-settings__val" style="width:36px">{{ settings.typography.lineHeight.toFixed(1) }}</span>
      </div>
      <div class="reader-settings__row">
        <span class="reader-settings__label">段距</span>
        <n-slider :value="settings.typography.paragraphSpacing"
          @update:value="(v: number) => updateTypography({ paragraphSpacing: v })" :min="0" :max="40" :step="2"
          style="flex:1" />
        <span class="reader-settings__val" style="width:36px">{{ settings.typography.paragraphSpacing }}px</span>
      </div>
      <div class="reader-settings__row">
        <span class="reader-settings__label">缩进</span>
        <n-slider :value="settings.typography.textIndent"
          @update:value="(v: number) => updateTypography({ textIndent: v })" :min="0" :max="4" :step="0.5"
          :format-tooltip="(v: number) => v.toFixed(1) + 'em'" style="flex:1" />
        <span class="reader-settings__val" style="width:36px">{{ settings.typography.textIndent }}em</span>
      </div>
      <div class="reader-settings__row">
        <span class="reader-settings__label">字距</span>
        <n-slider :value="settings.typography.letterSpacing"
          @update:value="(v: number) => updateTypography({ letterSpacing: v })" :min="0" :max="6" :step="0.5"
          :format-tooltip="(v: number) => v.toFixed(1) + 'px'" style="flex:1" />
        <span class="reader-settings__val" style="width:36px">{{ settings.typography.letterSpacing }}px</span>
      </div>
      <div class="reader-settings__row">
        <span class="reader-settings__label">边距</span>
        <n-slider :value="settings.padding" @update:value="(v: number) => { settings.padding = v }" :min="4" :max="64"
          :step="4" style="flex:1" />
        <span class="reader-settings__val" style="width:36px">{{ settings.padding }}px</span>
      </div>
    </template>

    <!-- ============ L2 字体选择 ============ -->
    <template v-else-if="subPage === 'font'">
      <div class="reader-settings__sub-header">
        <button class="reader-settings__back" @click="goBack()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span class="reader-settings__sub-title">字体选择</span>
      </div>

      <div class="reader-settings__font-list">
        <button v-for="fp in FONT_PRESETS" :key="fp.label" class="reader-settings__font-item"
          :class="{ 'reader-settings__font-item--active': settings.typography.fontFamily === fp.value }"
          :style="{ fontFamily: fp.value }" @click="updateTypography({ fontFamily: fp.value })">
          <span>{{ fp.label }}</span>
          <svg v-if="settings.typography.fontFamily === fp.value" width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="#63e2b7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </button>
      </div>
    </template>

    <!-- ============ L2 字体样式 ============ -->
    <template v-else-if="subPage === 'typography'">
      <div class="reader-settings__sub-header">
        <button class="reader-settings__back" @click="goBack()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span class="reader-settings__sub-title">字体样式</span>
      </div>

      <!-- 斜体 -->
      <div class="reader-settings__row">
        <span class="reader-settings__label">斜体</span>
        <div class="reader-settings__pill-group">
          <button class="reader-settings__pill"
            :class="{ 'reader-settings__pill--active': settings.typography.fontStyle === 'normal' }"
            @click="updateTypography({ fontStyle: 'normal' })">正常</button>
          <button class="reader-settings__pill"
            :class="{ 'reader-settings__pill--active': settings.typography.fontStyle === 'italic' }"
            style="font-style:italic" @click="updateTypography({ fontStyle: 'italic' })">斜体</button>
          <button class="reader-settings__pill"
            :class="{ 'reader-settings__pill--active': settings.typography.fontStyle === 'oblique' }"
            style="font-style:oblique" @click="updateTypography({ fontStyle: 'oblique' })">倾斜</button>
        </div>
      </div>

      <!-- 对齐 -->
      <div class="reader-settings__row">
        <span class="reader-settings__label">对齐</span>
        <div class="reader-settings__pill-group">
          <button v-for="a in TEXT_ALIGN_OPTIONS" :key="a.value" class="reader-settings__pill"
            :class="{ 'reader-settings__pill--active': settings.typography.textAlign === a.value }"
            @click="updateTypography({ textAlign: a.value })">{{ a.label }}</button>
        </div>
      </div>

      <!-- 文字装饰 -->
      <div class="reader-settings__row">
        <span class="reader-settings__label">装饰</span>
        <div class="reader-settings__pill-group">
          <button class="reader-settings__pill"
            :class="{ 'reader-settings__pill--active': settings.typography.textDecoration === 'none' }"
            @click="updateTypography({ textDecoration: 'none' })">无</button>
          <button class="reader-settings__pill"
            :class="{ 'reader-settings__pill--active': settings.typography.textDecoration === 'underline' }"
            style="text-decoration:underline" @click="updateTypography({ textDecoration: 'underline' })">下划线</button>
          <button class="reader-settings__pill"
            :class="{ 'reader-settings__pill--active': settings.typography.textDecoration === 'line-through' }"
            style="text-decoration:line-through"
            @click="updateTypography({ textDecoration: 'line-through' })">删除线</button>
        </div>
      </div>

      <!-- 书写模式 -->
      <div class="reader-settings__row">
        <span class="reader-settings__label">书写</span>
        <div class="reader-settings__pill-group">
          <button class="reader-settings__pill"
            :class="{ 'reader-settings__pill--active': settings.typography.writingMode === 'horizontal-tb' }"
            @click="updateTypography({ writingMode: 'horizontal-tb' })">横排</button>
          <button class="reader-settings__pill"
            :class="{ 'reader-settings__pill--active': settings.typography.writingMode === 'vertical-rl' }"
            @click="updateTypography({ writingMode: 'vertical-rl' })">竖排↷</button>
          <button class="reader-settings__pill"
            :class="{ 'reader-settings__pill--active': settings.typography.writingMode === 'vertical-lr' }"
            @click="updateTypography({ writingMode: 'vertical-lr' })">竖排↶</button>
        </div>
      </div>

      <!-- 文字转换 -->
      <div class="reader-settings__row">
        <span class="reader-settings__label">转换</span>
        <div class="reader-settings__pill-group">
          <button class="reader-settings__pill"
            :class="{ 'reader-settings__pill--active': settings.typography.textTransform === 'none' }"
            @click="updateTypography({ textTransform: 'none' })">无</button>
          <button class="reader-settings__pill"
            :class="{ 'reader-settings__pill--active': settings.typography.textTransform === 'uppercase' }"
            @click="updateTypography({ textTransform: 'uppercase' })">大写</button>
          <button class="reader-settings__pill"
            :class="{ 'reader-settings__pill--active': settings.typography.textTransform === 'lowercase' }"
            @click="updateTypography({ textTransform: 'lowercase' })">小写</button>
          <button class="reader-settings__pill"
            :class="{ 'reader-settings__pill--active': settings.typography.textTransform === 'capitalize' }"
            @click="updateTypography({ textTransform: 'capitalize' })">首字母</button>
        </div>
      </div>

      <!-- 文字描边 -->
      <div class="reader-settings__row">
        <span class="reader-settings__label">描边</span>
        <n-slider :value="settings.typography.textStrokeWidth"
          @update:value="(v: number) => updateTypography({ textStrokeWidth: v })" :min="0" :max="3" :step="0.5"
          :format-tooltip="(v: number) => v + 'px'" style="flex:1" />
        <span class="reader-settings__val" style="width:40px">{{ settings.typography.textStrokeWidth }}px</span>
        <label class="reader-settings__color-swatch" title="描边颜色">
          <input ref="strokeColorInputRef" type="color"
            :value="settings.typography.textStrokeColor === 'transparent' ? '#000000' : settings.typography.textStrokeColor"
            @input="(e) => updateTypography({ textStrokeColor: (e.target as HTMLInputElement).value })" />
          <span
            :style="{ background: settings.typography.textStrokeColor === 'transparent' ? '#555' : settings.typography.textStrokeColor }" />
        </label>
      </div>

      <!-- 文字阴影 -->
      <div class="reader-settings__row">
        <span class="reader-settings__label">阴影</span>
        <div class="reader-settings__pill-group">
          <button v-for="sh in TEXT_SHADOW_PRESETS" :key="sh.label" class="reader-settings__pill"
            :class="{ 'reader-settings__pill--active': settings.typography.textShadow === sh.value }"
            @click="updateTypography({ textShadow: sh.value })">{{ sh.label }}</button>
        </div>
      </div>
    </template>

    <!-- ============ L2 快捷键说明 ============ -->
    <template v-else-if="subPage === 'shortcuts'">
      <div class="reader-settings__sub-header">
        <button class="reader-settings__back" @click="goBack()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span class="reader-settings__sub-title">快捷键说明</span>
      </div>

      <div class="reader-settings__shortcuts">
        <div class="reader-settings__shortcut-row">
          <span class="reader-settings__shortcut-keys">
            <kbd>←</kbd> <kbd>A</kbd> <kbd>音量+</kbd>
          </span>
          <span class="reader-settings__shortcut-desc">上一页 / 上一章</span>
        </div>
        <div class="reader-settings__shortcut-row">
          <span class="reader-settings__shortcut-keys">
            <kbd>→</kbd> <kbd>D</kbd> <kbd>音量-</kbd>
          </span>
          <span class="reader-settings__shortcut-desc">下一页 / 下一章</span>
        </div>
        <div class="reader-settings__shortcut-row">
          <span class="reader-settings__shortcut-keys">
            <kbd>Space</kbd> <kbd>Enter</kbd>
          </span>
          <span class="reader-settings__shortcut-desc">打开 / 关闭菜单</span>
        </div>
        <div class="reader-settings__shortcut-note">
          翻页快捷键在菜单关闭时生效。滚动模式仅支持快捷键切换章节。
        </div>
      </div>
    </template>
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
  transition: background 0.15s, border-color 0.15s;
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
  transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
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
  transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
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

/* ---- L2 快捷键说明 ---- */
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

/* ---- 更多设置导航列表 ---- */
.reader-settings__more-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 4px;
}

.reader-settings__more-item {
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

.reader-settings__more-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

/* ---- 颜色选择器色块 ---- */
.reader-settings__color-swatch {
  position: relative;
  display: inline-flex;
  cursor: pointer;
  flex-shrink: 0;
}

.reader-settings__color-swatch input[type="color"] {
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
}

.reader-settings__tap-region--left {
  background: rgba(99, 226, 183, 0.08);
  color: rgba(99, 226, 183, 0.85);
  flex-shrink: 0;
}

.reader-settings__tap-region--center {
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.55);
}

.reader-settings__tap-region--right {
  background: rgba(99, 226, 183, 0.08);
  color: rgba(99, 226, 183, 0.85);
  flex-shrink: 0;
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
</style>
