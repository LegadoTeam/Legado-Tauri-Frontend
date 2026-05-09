import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue';
import type { ReaderAppearancePatch } from '@/composables/useFrontendPlugins';
import { useFrontendPlugins } from '@/composables/useFrontendPlugins';
import { invokeWithTimeout } from '@/composables/useInvoke';
import { useReaderSettingsStore } from '@/stores';
import { PRESET_THEMES, type ReaderTapAction } from '@/components/reader/types';
import {
  BG_PRESETS,
  COMIC_FLIP_OPTIONS,
  EXPERIMENTAL_FLIP_MODE_HINT,
  EXPERIMENTAL_FLIP_MODES,
  FLIP_OPTIONS,
  FONT_PRESETS,
  FONT_WEIGHT_PRESETS,
  TAP_ACTION_OPTIONS,
  TEXT_ALIGN_OPTIONS,
  TEXT_SHADOW_PRESETS,
  THEME_ELEGANT_NAMES,
  type ThemeOption,
} from './readerSettingsOptions';

type SubPage =
  | 'none'
  | 'spacing'
  | 'font'
  | 'shortcuts'
  | 'typography'
  | 'pagePadding'
  | 'tapControls'
  | 'more'
  | 'customFont';

interface SysFont {
  name: string;
  cjk_likely: boolean;
}

interface BackgroundOption {
  id: string;
  name: string;
  description?: string;
  source: 'builtin' | 'plugin';
  value?: string;
  preview: {
    backgroundColor?: string;
    backgroundImage?: string;
    backgroundSize?: string;
    backgroundPosition?: string;
    backgroundRepeat?: string;
    backgroundBlendMode?: string;
    textColor?: string;
  };
}

interface SkinOption {
  id: string;
  name: string;
  description?: string;
  source: 'builtin' | 'plugin';
  preview: ReaderAppearancePatch;
}

export function useReaderSettingsPanelModel(options: {
  sourceType: Ref<string | undefined>;
  onDumpPaginationLayout: () => void;
}) {
  const {
    settings,
    updateTypography,
    updatePagePadding,
    setTheme,
    setFlipMode,
    resetSettings,
    showTapZoneDebugPreview,
    hideTapZoneDebugPreview,
  } = useReaderSettingsStore();
  const { readerThemes, readerBackgrounds, readerSkins } = useFrontendPlugins();
  const TAP_ZONE_DEBUG_PREVIEW_MS = 1400;

  const subPage = ref<SubPage>('none');
  const prevPage = ref<SubPage>('none');

  function navigateTo(page: SubPage) {
    prevPage.value = subPage.value;
    subPage.value = page;
  }

  function goBack() {
    subPage.value = prevPage.value;
    prevPage.value = 'none';
  }

  watch(subPage, (page, previous) => {
    if (previous === 'tapControls' && page !== 'tapControls') {
      hideTapZoneDebugPreview();
    }
  });

  onBeforeUnmount(() => {
    hideTapZoneDebugPreview();
  });

  const DAY_THEME = PRESET_THEMES[0];
  const NIGHT_THEME = PRESET_THEMES[4];
  const isNight = computed(() => settings.theme.name === NIGHT_THEME.name);

  function toggleDayNight() {
    setTheme(isNight.value ? DAY_THEME : NIGHT_THEME);
  }

  function decreaseFontSize() {
    if (settings.typography.fontSize > 12) {
      updateTypography({ fontSize: settings.typography.fontSize - 1 });
    }
  }

  function increaseFontSize() {
    if (settings.typography.fontSize < 40) {
      updateTypography({ fontSize: settings.typography.fontSize + 1 });
    }
  }

  const isComic = computed(() => options.sourceType.value === 'comic');
  const isVideo = computed(() => options.sourceType.value === 'video');
  const canDumpPaginationLayout = computed(
    () => !isComic.value && !isVideo.value && settings.flipMode !== 'scroll',
  );
  const activeFlipOptions = computed(() => (isComic.value ? COMIC_FLIP_OPTIONS : FLIP_OPTIONS));
  const showExperimentalFlipModeHint = computed(() =>
    EXPERIMENTAL_FLIP_MODES.has(settings.flipMode),
  );

  const builtinThemeOptions = computed<ThemeOption[]>(() =>
    (isComic.value ? PRESET_THEMES.slice(0, 1) : PRESET_THEMES).map((theme) => ({
      id: `builtin:theme:${theme.name}`,
      name: theme.name,
      source: 'builtin',
      theme,
      preview: {
        backgroundColor: theme.backgroundColor,
        textColor: theme.textColor,
        selectionColor: theme.selectionColor,
      },
    })),
  );

  const pluginThemeOptions = computed<ThemeOption[]>(() =>
    readerThemes.value.map((theme) => ({
      id: theme.id,
      name: theme.name,
      description: theme.description,
      source: 'plugin',
      preview: {
        backgroundColor: theme.preview.backgroundColor || '#ffffff',
        textColor: theme.preview.textColor || '#1a1a1a',
        selectionColor: theme.preview.selectionColor,
      },
    })),
  );

  const themeOptions = computed<ThemeOption[]>(() => [
    ...builtinThemeOptions.value,
    ...pluginThemeOptions.value,
  ]);

  const selectedThemeId = computed(() => {
    if (settings.themePresetId) {
      return settings.themePresetId;
    }
    return (
      builtinThemeOptions.value.find((option) => option.theme?.name === settings.theme.name)?.id ??
      `builtin:theme:${settings.theme.name}`
    );
  });

  function selectThemeOption(option: ThemeOption) {
    if (option.source === 'plugin') {
      settings.themePresetId = option.id;
      return;
    }
    if (option.theme) {
      setTheme(option.theme);
    }
  }

  function tapActionLabel(action: ReaderTapAction) {
    return action === 'prev' ? '上一页' : '下一页';
  }

  function tapActionIcon(action: ReaderTapAction) {
    return action === 'prev' ? '‹' : '›';
  }

  function setTapAction(side: 'left' | 'right', action: ReaderTapAction) {
    if (side === 'left') {
      settings.tapLeftAction = action;
    } else {
      settings.tapRightAction = action;
    }
    showTapZoneDebugPreview(TAP_ZONE_DEBUG_PREVIEW_MS);
  }

  function toggleTapAction(side: 'left' | 'right') {
    const current = side === 'left' ? settings.tapLeftAction : settings.tapRightAction;
    setTapAction(side, current === 'prev' ? 'next' : 'prev');
  }

  function dumpPaginationLayout() {
    options.onDumpPaginationLayout();
  }

  const systemFonts = ref<SysFont[]>([]);
  const systemFontsLoading = ref(false);
  const systemFontsError = ref('');
  const fontSearchQuery = ref('');
  const showAllFonts = ref(false);

  async function loadSystemFonts() {
    if (systemFonts.value.length > 0 || systemFontsLoading.value) {
      return;
    }
    systemFontsLoading.value = true;
    systemFontsError.value = '';
    try {
      const result = await invokeWithTimeout<SysFont[]>('list_system_fonts', {}, 15000);
      systemFonts.value = result;
    } catch (e) {
      systemFontsError.value = String(e);
    } finally {
      systemFontsLoading.value = false;
    }
  }

  const filteredSystemFonts = computed(() => {
    const q = fontSearchQuery.value.trim().toLowerCase();
    const list = q
      ? systemFonts.value.filter((font) => font.name.toLowerCase().includes(q))
      : systemFonts.value;
    const cjk = list.filter((font) => font.cjk_likely);
    const other = list.filter((font) => !font.cjk_likely);
    return { cjk, other };
  });

  async function copyFontList() {
    const names = systemFonts.value.map((font) => font.name).join('\n');
    try {
      await navigator.clipboard.writeText(names);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = names;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  }

  const currentFontLabel = computed(() => {
    return FONT_PRESETS.find((font) => font.value === settings.typography.fontFamily)?.label ?? '自定义';
  });

  const builtinBackgroundOptions = computed<BackgroundOption[]>(() =>
    BG_PRESETS.map((bg) => ({
      id: bg.id,
      name: bg.name,
      source: 'builtin',
      value: bg.value,
      preview: {
        backgroundColor: '#ffffff',
        backgroundImage: bg.thumb || 'none',
        backgroundSize: 'auto',
        backgroundPosition: 'center',
        backgroundRepeat: bg.thumb ? 'repeat' : 'no-repeat',
        textColor: '#1a1a1a',
      },
    })),
  );

  const pluginBackgroundOptions = computed<BackgroundOption[]>(() =>
    readerBackgrounds.value.map((background) => ({
      id: background.id,
      name: background.name,
      description: background.description,
      source: 'plugin',
      preview: {
        backgroundColor: background.preview.backgroundColor || '#f8f8f8',
        backgroundImage: background.preview.backgroundImage || 'none',
        backgroundSize: background.preview.backgroundSize || 'cover',
        backgroundPosition: background.preview.backgroundPosition || 'center',
        backgroundRepeat: background.preview.backgroundRepeat || 'no-repeat',
        backgroundBlendMode: background.preview.backgroundBlendMode || 'normal',
        textColor: background.preview.textColor || '#1a1a1a',
      },
    })),
  );

  const backgroundOptions = computed<BackgroundOption[]>(() => [
    ...builtinBackgroundOptions.value,
    ...pluginBackgroundOptions.value,
  ]);

  const selectedBackgroundId = computed(() => {
    if (settings.backgroundPresetId) {
      return settings.backgroundPresetId;
    }
    return (
      builtinBackgroundOptions.value.find((option) => option.value === settings.backgroundImage)
        ?.id ?? 'builtin:plain'
    );
  });

  function selectBackground(option: BackgroundOption) {
    if (option.source === 'plugin') {
      settings.backgroundPresetId = option.id;
      settings.backgroundImage = '';
      return;
    }
    settings.backgroundPresetId = '';
    settings.backgroundImage = option.value ?? '';
  }

  const skinOptions = computed<SkinOption[]>(() => [
    {
      id: 'builtin:skin:none',
      name: '默认',
      source: 'builtin',
      description: '使用系统默认阅读器布局',
      preview: {
        backgroundColor: '#101010',
        textColor: '#f7f7f7',
        styleVars: {
          '--reader-top-bar-bg': 'rgba(0, 0, 0, 0.65)',
          '--reader-body-surface': 'transparent',
        },
      },
    },
    ...readerSkins.value.map((skin) => ({
      id: skin.id,
      name: skin.name,
      description: skin.description,
      source: 'plugin' as const,
      preview: skin.preview,
    })),
  ]);

  const selectedSkinId = computed(() => settings.skinPresetId || 'builtin:skin:none');

  function selectSkin(option: SkinOption) {
    settings.skinPresetId = option.source === 'plugin' ? option.id : '';
  }

  const tapZoneBarRef = ref<HTMLElement | null>(null);
  let draggingDivider: 'left' | 'right' | null = null;

  function onDividerPointerDown(e: PointerEvent, which: 'left' | 'right') {
    e.preventDefault();
    draggingDivider = which;
    showTapZoneDebugPreview(TAP_ZONE_DEBUG_PREVIEW_MS);
    tapZoneBarRef.value?.setPointerCapture(e.pointerId);
  }

  function onTapZoneBarPointerMove(e: PointerEvent) {
    if (!draggingDivider || !tapZoneBarRef.value) {
      return;
    }
    const rect = tapZoneBarRef.value.getBoundingClientRect();
    const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const snapped = Math.round(relX * 20) / 20;
    if (draggingDivider === 'left') {
      const nextLeft = Math.max(0.1, Math.min(settings.tapZoneRight - 0.15, snapped));
      if (nextLeft !== settings.tapZoneLeft) {
        settings.tapZoneLeft = nextLeft;
        showTapZoneDebugPreview(TAP_ZONE_DEBUG_PREVIEW_MS);
      }
    } else {
      const nextRight = Math.max(settings.tapZoneLeft + 0.15, Math.min(0.9, snapped));
      if (nextRight !== settings.tapZoneRight) {
        settings.tapZoneRight = nextRight;
        showTapZoneDebugPreview(TAP_ZONE_DEBUG_PREVIEW_MS);
      }
    }
  }

  function onTapZoneBarPointerUp() {
    if (draggingDivider) {
      showTapZoneDebugPreview(TAP_ZONE_DEBUG_PREVIEW_MS);
    }
    draggingDivider = null;
  }

  return {
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
  };
}
