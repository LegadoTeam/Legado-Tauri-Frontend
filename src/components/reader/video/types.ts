/**
 * 视频播放器抽象层类型定义
 *
 * 提供统一的播放器接口 `IVideoPlayer`，使前端可在 video.js / xgplayer / DPlayer 之间无缝切换。
 */

/**
 * 通用分类系统：单个选项（如"4K线路"、"国语"、"1080P"）
 *
 * 设计为通用，不限于"线路"这一语义——书源可以用它表示
 * 线路、清晰度、语言、字幕等任何维度的切换。
 */
export interface VideoCategoryOption {
  /** 选项唯一 ID，用于回传书源 */
  id: string;
  /** 展示标签 */
  label: string;
  /** 可选角标（如集数提示、"热"、"新"等） */
  badge?: string;
}

/**
 * 通用分类维度（一组互斥的选项）。
 * 例如：{ id:"route", label:"切换线路", options:[...] }
 */
export interface VideoCategoryGroup {
  /** 维度唯一 ID，回传时作为 selectedCategories 的 key */
  id: string;
  /** 维度展示名称 */
  label: string;
  /** 该维度下的选项列表 */
  options: VideoCategoryOption[];
  /** 书源可指定的默认选中项（可选） */
  defaultSelected?: string;
}

/** 视频书源 chapterContent 返回的视频源信息 */
export interface VideoSource {
  /** 视频播放地址（与 m3u8Content 二选一） */
  url: string;
  /** 视频流类型，影响解码器选择 */
  type?: 'hls' | 'dash' | 'mp4' | 'flv';
  /**
   * 书源直接返回的 m3u8 文本内容（以 #EXTM3U 开头）。
   * 存在时 url 可为空字符串，播放器层会自动生成 Blob URL。
   * 适用于书源需要对 m3u8 片段列表进行修改的场景。
   */
  m3u8Content?: string;
  /** 自定义 HTTP 请求头（如 Referer 防盗链） */
  headers?: Record<string, string>;
  /** 多清晰度源列表 */
  qualities?: VideoQuality[];
  /** 外挂字幕列表 */
  subtitles?: VideoSubtitle[];
  /**
   * 通用分类选项组（线路/清晰度/语言等）。
   * 若存在，App 会在播放器侧边栏展示分类选择面板。
   * 用户选择后，App 将 selectedCategories 作为第二参数传回 chapterContent 重新请求。
   */
  categories?: VideoCategoryGroup[];
}

export interface VideoQuality {
  label: string;
  url: string;
}

export interface VideoSubtitle {
  label: string;
  url: string;
  /** 是否为默认启用字幕 */
  default?: boolean;
  /** 字幕语言代码（如 "zh-CN"） */
  srclang?: string;
}

/** 播放器事件类型 */
export type VideoPlayerEvent =
  | 'play'
  | 'pause'
  | 'ended'
  | 'timeupdate'
  | 'error'
  | 'volumechange'
  | 'ratechange'
  | 'loadedmetadata'
  | 'waiting'
  | 'canplay';

/** 统一播放器接口，所有适配器必须实现 */
export interface IVideoPlayer {
  /** 挂载播放器到 DOM 容器并加载视频源（异步，完成后才可安全注册事件） */
  mount(container: HTMLElement, source: VideoSource): Promise<void>;

  play(): void;
  pause(): void;
  /** 跳转到指定秒数 */
  seek(seconds: number): void;
  /** 获取当前播放时间（秒） */
  getCurrentTime(): number;
  /** 获取视频总时长（秒） */
  getDuration(): number;
  /** 设置音量（0 ~ 1） */
  setVolume(v: number): void;
  getVolume(): number;
  /** 设置播放速率（如 1.0、1.5、2.0） */
  setPlaybackRate(rate: number): void;
  getPlaybackRate(): number;
  /** 进入全屏 */
  enterFullscreen(): void;
  /** 退出全屏 */
  exitFullscreen(): void;
  /** 是否处于全屏 */
  isFullscreen(): boolean;

  /** 注册事件监听 */
  on(event: VideoPlayerEvent, handler: (...args: unknown[]) => void): void;
  /** 移除事件监听 */
  off(event: VideoPlayerEvent, handler: (...args: unknown[]) => void): void;

  /** 销毁播放器实例，释放资源 */
  destroy(): void;
}

/** 支持的播放器类型 */
export type VideoPlayerType = 'videojs' | 'xgplayer' | 'dplayer';

/**
 * 解析 chapterContent 返回值为 VideoSource 对象。
 * 兼容以下三种格式：
 * 1. 纯 URL 字符串
 * 2. JSON 对象（含 url 字段，或含 m3u8Content 字段）
 * 3. 原始 m3u8 文本内容（以 `#EXTM3U` 开头）
 */
export function parseVideoSource(raw: string): VideoSource {
  const trimmed = raw.trim();

  // 原始 m3u8 文本内容（书源直接返回 m3u8 内容）
  if (trimmed.startsWith('#EXTM3U')) {
    return { url: '', type: 'hls', m3u8Content: trimmed };
  }

  // 尝试 JSON 解析
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as VideoSource;
      // JSON 含 m3u8Content 字段（书源通过 JSON 返回 m3u8 内容）
      if (parsed.m3u8Content) {
        return { ...parsed, type: parsed.type ?? 'hls' };
      }
      if (parsed.url) {
        return parsed;
      }
    } catch {
      // JSON 解析失败，当作纯 URL 处理
    }
  }

  // 纯 URL 字符串
  const url = trimmed;
  const type = guessStreamType(url);
  return { url, type };
}

/** 根据 URL 后缀猜测流类型 */
function guessStreamType(url: string): VideoSource['type'] {
  const lower = url.toLowerCase();
  if (lower.includes('.m3u8')) {
    return 'hls';
  }
  if (lower.includes('.mpd')) {
    return 'dash';
  }
  if (lower.includes('.flv')) {
    return 'flv';
  }
  return 'mp4';
}
