export type BookSourceSiteRepoType = 'novel' | 'comic' | 'audio' | 'video';

export interface BookSourceSiteEntry {
  id: string;
  name: string;
  fileName: string;
  description: string;
  tags: string[];
  group: string;
  repoType: BookSourceSiteRepoType;
  version: string;
  uploader: string;
  downloads: number;
  likes: number;
  updatedAt: string;
  featured: boolean;
  source: 'official' | 'user';
  code: string;
}

const MOCK_SOURCE_TEMPLATE = [
  {
    id: 'official-1',
    name: '番茄小说精选源',
    fileName: 'fanqie精选.json',
    description: '针对移动端目录页和正文页做过兼容处理，适合作为默认小说源示例。',
    tags: ['小说', '稳定', '精选'],
    group: '免费',
    repoType: 'novel',
    version: '2.3.1',
    uploader: 'Legado Team',
    downloads: 12842,
    likes: 924,
    updatedAt: '2026-04-22T09:10:00+08:00',
    featured: true,
    source: 'official',
    code: `{
  "bookSourceName": "番茄小说精选源",
  "bookSourceGroup": "免费",
  "bookSourceType": 0,
  "url": "https://fanqie.example.com",
  "searchUrl": "/search?key={{key}}",
  "ruleSearch": {
    "bookList": ".result-item"
  }
}`,
  },
  {
    id: 'official-2',
    name: '起点目录增强版',
    fileName: 'qidian-advanced.json',
    description: '补齐分页目录和正文净化规则，适合需要完整元数据的小说站点。',
    tags: ['小说', '分页', '详情页'],
    group: '精品',
    repoType: 'novel',
    version: '1.8.4',
    uploader: '阅读器实验室',
    downloads: 9620,
    likes: 731,
    updatedAt: '2026-04-20T18:20:00+08:00',
    featured: true,
    source: 'official',
    code: `{
  "bookSourceName": "起点目录增强版",
  "bookSourceGroup": "精品",
  "bookSourceType": 0,
  "url": "https://qidian.example.com",
  "ruleBookInfo": {
    "name": ".book-name",
    "author": ".book-author"
  }
}`,
  },
  {
    id: 'official-3',
    name: '拷贝漫画适配源',
    fileName: 'copymanga.json',
    description: '保留章节图集规则，适配漫画模式翻页和图片惰性加载。',
    tags: ['漫画', '图片', '高热度'],
    group: '漫画',
    repoType: 'comic',
    version: '3.0.2',
    uploader: '源分享站',
    downloads: 21054,
    likes: 1548,
    updatedAt: '2026-04-23T12:08:00+08:00',
    featured: true,
    source: 'official',
    code: `{
  "bookSourceName": "拷贝漫画适配源",
  "bookSourceGroup": "漫画",
  "bookSourceType": 1,
  "url": "https://copymanga.example.com",
  "ruleContent": {
    "content": ".comic-image img@src"
  }
}`,
  },
  {
    id: 'official-4',
    name: '轻听书有声合集',
    fileName: 'audio-lite.json',
    description: '模拟有声书站点，带音频详情和章节播放地址字段。',
    tags: ['有声', '音频', '连续播放'],
    group: '有声',
    repoType: 'audio',
    version: '1.5.0',
    uploader: '轻听社区',
    downloads: 7433,
    likes: 468,
    updatedAt: '2026-04-19T21:16:00+08:00',
    featured: false,
    source: 'official',
    code: `{
  "bookSourceName": "轻听书有声合集",
  "bookSourceGroup": "有声",
  "bookSourceType": 2,
  "url": "https://audio.example.com",
  "ruleToc": {
    "chapterList": ".audio-item"
  }
}`,
  },
  {
    id: 'official-5',
    name: '影视书源演示版',
    fileName: 'video-demo.json',
    description: '用于演示视频类书源的卡片展示和详情统计，不接真实后端。',
    tags: ['视频', '演示', '实验'],
    group: '视频',
    repoType: 'video',
    version: '0.9.8',
    uploader: '前端插件组',
    downloads: 5812,
    likes: 289,
    updatedAt: '2026-04-17T15:35:00+08:00',
    featured: false,
    source: 'official',
    code: `{
  "bookSourceName": "影视书源演示版",
  "bookSourceGroup": "视频",
  "bookSourceType": 3,
  "url": "https://video.example.com",
  "ruleExplore": {
    "bookList": ".video-card"
  }
}`,
  },
  {
    id: 'official-6',
    name: '知轩藏书修正版',
    fileName: 'zxcs-fixed.json',
    description: '针对目录过滤和章节倒序做了修正，适合经典资源站点接入。',
    tags: ['小说', '修正', '经典站'],
    group: '精选',
    repoType: 'novel',
    version: '2.0.7',
    uploader: '清源计划',
    downloads: 11324,
    likes: 806,
    updatedAt: '2026-04-16T08:48:00+08:00',
    featured: true,
    source: 'official',
    code: `{
  "bookSourceName": "知轩藏书修正版",
  "bookSourceGroup": "精选",
  "bookSourceType": 0,
  "url": "https://zxcs.example.com",
  "ruleToc": {
    "chapterList": "#list dd"
  }
}`,
  },
  {
    id: 'official-7',
    name: 'ACGN 图源集合',
    fileName: 'acgn-comic.json',
    description: '多标签漫画源集合，适合测试分页筛选、标签展示和下载统计。',
    tags: ['漫画', 'ACGN', '合集'],
    group: '漫画',
    repoType: 'comic',
    version: '1.2.1',
    uploader: '像素小队',
    downloads: 8720,
    likes: 624,
    updatedAt: '2026-04-18T11:05:00+08:00',
    featured: false,
    source: 'official',
    code: `{
  "bookSourceName": "ACGN 图源集合",
  "bookSourceGroup": "漫画",
  "bookSourceType": 1,
  "url": "https://acgn.example.com"
}`,
  },
  {
    id: 'official-8',
    name: '多站聚合轻量源',
    fileName: 'aggregate-lite.json',
    description: '偏轻量化的聚合规则示例，用于站内搜索联调和上传演示。',
    tags: ['聚合', '轻量', '搜索'],
    group: '工具',
    repoType: 'novel',
    version: '1.1.3',
    uploader: 'Mock 站点',
    downloads: 6541,
    likes: 377,
    updatedAt: '2026-04-15T13:30:00+08:00',
    featured: false,
    source: 'official',
    code: `{
  "bookSourceName": "多站聚合轻量源",
  "bookSourceGroup": "工具",
  "bookSourceType": 0,
  "url": "https://aggregate.example.com"
}`,
  },
  {
    id: 'official-9',
    name: '晋江网页兼容版',
    fileName: 'jjwxc-web.json',
    description: '模拟需要 Cookie 和 UA 的站点展示效果，便于后续真后端接入。',
    tags: ['小说', '登录态', '兼容'],
    group: '精品',
    repoType: 'novel',
    version: '2.5.6',
    uploader: '猫薄荷',
    downloads: 14408,
    likes: 1093,
    updatedAt: '2026-04-24T08:30:00+08:00',
    featured: true,
    source: 'official',
    code: `{
  "bookSourceName": "晋江网页兼容版",
  "bookSourceGroup": "精品",
  "bookSourceType": 0,
  "url": "https://jjwxc.example.com"
}`,
  },
  {
    id: 'official-10',
    name: '广播剧采集样例',
    fileName: 'radio-drama.json',
    description: '演示音频类书源的分类筛选和上传用户信息展示。',
    tags: ['有声', '广播剧', '样例'],
    group: '有声',
    repoType: 'audio',
    version: '1.0.2',
    uploader: '声波计划',
    downloads: 4980,
    likes: 256,
    updatedAt: '2026-04-12T20:45:00+08:00',
    featured: false,
    source: 'official',
    code: `{
  "bookSourceName": "广播剧采集样例",
  "bookSourceGroup": "有声",
  "bookSourceType": 2,
  "url": "https://radio.example.com"
}`,
  },
  {
    id: 'official-11',
    name: '海外镜像备选源',
    fileName: 'mirror-oversea.json',
    description: '突出版本、上传者与下载数信息，适合作为卡片信息密度测试数据。',
    tags: ['镜像', '备选', '海外'],
    group: '工具',
    repoType: 'novel',
    version: '0.8.6',
    uploader: 'Delta',
    downloads: 3526,
    likes: 177,
    updatedAt: '2026-04-11T10:22:00+08:00',
    featured: false,
    source: 'official',
    code: `{
  "bookSourceName": "海外镜像备选源",
  "bookSourceGroup": "工具",
  "bookSourceType": 0,
  "url": "https://mirror.example.com"
}`,
  },
  {
    id: 'official-12',
    name: '新番视频源样式稿',
    fileName: 'anime-video-demo.json',
    description: '用于演示站点分页和视频卡片标签分组，当前仅提供纯前端 mock 效果。',
    tags: ['视频', '新番', '样式稿'],
    group: '视频',
    repoType: 'video',
    version: '0.6.5',
    uploader: 'UI Lab',
    downloads: 2842,
    likes: 145,
    updatedAt: '2026-04-10T17:02:00+08:00',
    featured: false,
    source: 'official',
    code: `{
  "bookSourceName": "新番视频源样式稿",
  "bookSourceGroup": "视频",
  "bookSourceType": 3,
  "url": "https://anime.example.com"
}`,
  },
] as const satisfies readonly BookSourceSiteEntry[];

export function createBookSourceSiteMocks(): BookSourceSiteEntry[] {
  return MOCK_SOURCE_TEMPLATE.map((entry) => ({
    ...entry,
    tags: [...entry.tags],
  }));
}

export function normalizeUploadTags(raw: string): string[] {
  return raw
    .split(/[\n,，、\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);
}
