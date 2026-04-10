/**
 * User-Agent 预设数据
 * 从 SettingsView 中独立出来，供 SectionNetwork 引用
 */

export interface UaPreset {
  label: string
  value: string
}

export interface UaGroup {
  label: string
  presets: UaPreset[]
}

export const UA_GROUPS: UaGroup[] = [
  {
    label: 'Windows',
    presets: [
      { label: 'Chrome 146 (Win)', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36' },
      { label: 'Chrome 145 (Win)', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36' },
      { label: 'Chrome 144 (Win)', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36' },
      { label: 'Chrome 120 (Win)', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      { label: 'Edge 146 (Win)', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0' },
      { label: 'Firefox 149 (Win)', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0' },
      { label: 'Firefox 135 (Win)', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0' },
    ],
  },
  {
    label: 'macOS',
    presets: [
      { label: 'Chrome 147 (Mac)', value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36' },
      { label: 'Chrome 146 (Mac)', value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36' },
      { label: 'Chrome 145 (Mac)', value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36' },
      { label: 'Chrome 120 (Mac)', value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      { label: 'Safari 26.4 (Mac)', value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.4 Safari/605.1.15' },
      { label: 'Safari 26.3 (Mac)', value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Safari/605.1.15' },
      { label: 'Firefox 149 (Mac)', value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:149.0) Gecko/20100101 Firefox/149.0' },
    ],
  },
  {
    label: 'Android',
    presets: [
      { label: 'Chrome 146 Mobile (Android)', value: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36' },
      { label: 'Chrome 145 Mobile (Android)', value: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Mobile Safari/537.36' },
      { label: 'Chrome 144 Mobile (Android)', value: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36' },
      { label: 'Chrome 130 Mobile (Android)', value: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36' },
      { label: 'Samsung Browser 29 (Android)', value: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/29.0 Chrome/136.0.0.0 Mobile Safari/537.36' },
    ],
  },
  {
    label: 'iOS',
    presets: [
      { label: 'Safari 26.4 (iPhone)', value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.4 Mobile/15E148 Safari/604.1' },
      { label: 'Safari 26.3 (iPhone)', value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Mobile/15E148 Safari/604.1' },
      { label: 'Safari 18.6 (iPhone)', value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1' },
      { label: 'Chrome 146 (iPhone)', value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/146.0.7680.151 Mobile/15E148 Safari/604.1' },
    ],
  },
  {
    label: 'Linux',
    presets: [
      { label: 'Chrome 146 (Linux)', value: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36' },
      { label: 'Chrome 145 (Linux)', value: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36' },
      { label: 'Firefox 149 (Linux)', value: 'Mozilla/5.0 (X11; Linux x86_64; rv:149.0) Gecko/20100101 Firefox/149.0' },
    ],
  },
]

/** 转换为 Naive UI n-select 分组 options 格式 */
export const uaSelectOptions = UA_GROUPS.map(g => ({
  type: 'group' as const,
  label: g.label,
  key: g.label,
  children: g.presets.map(p => ({ label: p.label, value: p.value })),
}))
