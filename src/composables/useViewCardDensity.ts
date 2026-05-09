import { computed } from 'vue';
import { useDynamicConfig } from './useDynamicConfig';

export type CardSizeKey = 'xs' | 's' | 'm' | 'l' | 'xl' | 'xxl';
export type CardDensityView = 'bookshelf' | 'search' | 'explore';

type CardDensityPreset = {
  key: CardSizeKey;
  label: string;
  colMin: string;
  coverW?: string;
  coverH?: string;
  mobileColMin?: string;
};

const CARD_SIZE_KEYS: CardSizeKey[] = ['xs', 's', 'm', 'l', 'xl', 'xxl'];

const CARD_DENSITY_PRESETS: Record<CardDensityView, CardDensityPreset[]> = {
  explore: [
    { key: 'xs', label: '极小', colMin: '130px', coverW: '32px', coverH: '44px' },
    { key: 's', label: '小', colMin: '170px', coverW: '36px', coverH: '48px' },
    { key: 'm', label: '中', colMin: '210px', coverW: '42px', coverH: '56px' },
    { key: 'l', label: '大', colMin: '270px', coverW: '52px', coverH: '70px' },
    { key: 'xl', label: '特大', colMin: '340px', coverW: '64px', coverH: '86px' },
    { key: 'xxl', label: '超大', colMin: '440px', coverW: '80px', coverH: '108px' },
  ],
  search: [
    { key: 'xs', label: '极小', colMin: '180px', coverW: '32px', coverH: '44px' },
    { key: 's', label: '小', colMin: '200px', coverW: '36px', coverH: '48px' },
    { key: 'm', label: '中', colMin: '220px', coverW: '42px', coverH: '56px' },
    { key: 'l', label: '大', colMin: '260px', coverW: '48px', coverH: '64px' },
    { key: 'xl', label: '特大', colMin: '320px', coverW: '58px', coverH: '78px' },
    { key: 'xxl', label: '超大', colMin: '380px', coverW: '68px', coverH: '92px' },
  ],
  bookshelf: [
    { key: 'xs', label: '极小', colMin: '96px', mobileColMin: '88px' },
    { key: 's', label: '小', colMin: '108px', mobileColMin: '96px' },
    { key: 'm', label: '中', colMin: '120px', mobileColMin: '100px' },
    { key: 'l', label: '大', colMin: '140px', mobileColMin: '118px' },
    { key: 'xl', label: '特大', colMin: '168px', mobileColMin: '140px' },
    { key: 'xxl', label: '超大', colMin: '200px', mobileColMin: '168px' },
  ],
};

const LEGACY_KEYS: Partial<Record<CardDensityView, string>> = {
  explore: 'explore-card-size',
};

export function normalizeCardSizeKey(raw: unknown, fallback: CardSizeKey): CardSizeKey {
  return typeof raw === 'string' && CARD_SIZE_KEYS.includes(raw as CardSizeKey)
    ? (raw as CardSizeKey)
    : fallback;
}

export function useViewCardDensity(view: CardDensityView, fallback: CardSizeKey = 'm') {
  const presets = CARD_DENSITY_PRESETS[view];
  const legacyKey = LEGACY_KEYS[view];
  const store = useDynamicConfig<{ sizeKey: CardSizeKey }>({
    namespace: `ui.cardDensity.${view}`,
    version: 1,
    defaults: () => ({ sizeKey: fallback }),
    migrate: ({ storedData, readLegacy }) => {
      if (storedData && typeof storedData === 'object') {
        const storedSizeKey = (storedData as { sizeKey?: unknown }).sizeKey;
        return { sizeKey: normalizeCardSizeKey(storedSizeKey, fallback) };
      }
      if (!legacyKey) {
        return null;
      }
      return { sizeKey: normalizeCardSizeKey(readLegacy(legacyKey), fallback) };
    },
    legacyKeys: legacyKey ? [legacyKey] : undefined,
  });

  const activeSizeKey = computed<CardSizeKey>({
    get: () => store.state.sizeKey,
    set: (key) => store.replace({ sizeKey: key }),
  });

  const activeSize = computed(
    () => presets.find((preset) => preset.key === activeSizeKey.value) ?? presets[2],
  );

  const style = computed<Record<string, string>>(() => ({
    '--book-card-col-min': activeSize.value.colMin,
    ...(activeSize.value.mobileColMin
      ? { '--book-card-col-min-mobile': activeSize.value.mobileColMin }
      : {}),
    ...(activeSize.value.coverW ? { '--book-card-cover-w': activeSize.value.coverW } : {}),
    ...(activeSize.value.coverH ? { '--book-card-cover-h': activeSize.value.coverH } : {}),
  }));

  function setSize(key: CardSizeKey) {
    activeSizeKey.value = key;
  }

  return {
    cardSizes: presets,
    activeSizeKey,
    activeSize,
    style,
    setSize,
  };
}
