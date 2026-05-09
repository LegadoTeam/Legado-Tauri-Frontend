/**
 * 播放器工厂 — 根据配置动态创建对应的播放器适配器实例
 *
 * 使用动态 import 按需加载播放器代码，避免一次性打包全部播放器。
 */

import type { IVideoPlayer, VideoPlayerType } from './types';

/**
 * 创建播放器实例
 *
 * @param type 播放器类型（来自 app_config.video_player_type）
 * @returns 实现 IVideoPlayer 接口的适配器实例
 */
export async function createVideoPlayer(type: VideoPlayerType): Promise<IVideoPlayer> {
  switch (type) {
    case 'videojs': {
      const { VideojsAdapter } = await import('./adapters/videojsAdapter');
      return new VideojsAdapter();
    }
    case 'xgplayer': {
      const { XgplayerAdapter } = await import('./adapters/xgplayerAdapter');
      return new XgplayerAdapter();
    }
    case 'dplayer': {
      const { DplayerAdapter } = await import('./adapters/dplayerAdapter');
      return new DplayerAdapter();
    }
    default: {
      // 回退到 video.js
      const { VideojsAdapter } = await import('./adapters/videojsAdapter');
      return new VideojsAdapter();
    }
  }
}

/**
 * 预加载指定播放器的模块（仅触发 import，利用浏览器模块缓存）。
 * 在 VideoMode 挂载时调用，确保用户首次点击播放时模块已就绪。
 */
export async function preloadPlayerModule(type: VideoPlayerType): Promise<void> {
  switch (type) {
    case 'videojs':
      await import('./adapters/videojsAdapter');
      break;
    case 'xgplayer':
      await import('./adapters/xgplayerAdapter');
      break;
    case 'dplayer':
      await import('./adapters/dplayerAdapter');
      break;
  }
}
