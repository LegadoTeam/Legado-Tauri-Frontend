/**
 * 西瓜播放器（xgplayer）适配器
 *
 * xgplayer 自带 HLS/DASH 插件支持，无需额外依赖。
 */

import type { IVideoPlayer, VideoPlayerEvent, VideoSource } from '../types';
import { useAppConfig } from '../../../../composables/useAppConfig';

/** xgplayer 事件名映射：统一接口事件 → xgplayer 实际事件 */
const EVENT_MAP: Record<VideoPlayerEvent, string> = {
  play: 'play',
  pause: 'pause',
  ended: 'ended',
  timeupdate: 'timeupdate',
  error: 'error',
  volumechange: 'volumechange',
  ratechange: 'ratechange',
  loadedmetadata: 'loadedmetadata',
  waiting: 'waiting',
  canplay: 'canplay',
};

export class XgplayerAdapter implements IVideoPlayer {
  private player: InstanceType<typeof import('xgplayer').default> | null = null;
  private container: HTMLElement | null = null;

  async mount(container: HTMLElement, source: VideoSource): Promise<void> {
    this.container = container;
    await this.initPlayer(source);
  }

  private async initPlayer(source: VideoSource): Promise<void> {
    const { default: Player } = await import('xgplayer');
    await import('xgplayer/dist/index.min.css');

    if (!this.container) return;

    const { videoXgDownload } = useAppConfig();

    // 创建播放器容器 div
    const el = document.createElement('div');
    this.container.appendChild(el);

    const config: Record<string, unknown> = {
      el,
      url: source.url,
      fluid: true,
      playbackRate: [0.5, 0.75, 1, 1.25, 1.5, 2, 3],
      playsinline: true,
      autoplay: false,
      download: videoXgDownload.value,
    };

    // HLS 支持
    if (source.type === 'hls') {
      try {
        const { HlsPlugin } = await import('xgplayer-hls');
        config.plugins = [HlsPlugin];
        config.hls = source.headers ? { headers: source.headers } : undefined;
      } catch {
        // HLS 插件未安装，回退到原生
        config.url = source.url;
      }
    }

    this.player = new Player(config as ConstructorParameters<typeof Player>[0]);

    // 字幕
    if (source.subtitles?.length) {
      // xgplayer 通过配置设置字幕，运行时设置需依赖其 API
      // 回退：通过 video 元素添加 track
      const videoEl = this.player.video;
      if (videoEl) {
        for (const sub of source.subtitles) {
          const track = document.createElement('track');
          track.kind = 'subtitles';
          track.label = sub.label;
          track.srclang = sub.srclang ?? 'zh';
          track.src = sub.url;
          if (sub.default) track.default = true;
          videoEl.appendChild(track);
        }
      }
    }
  }

  play(): void {
    this.player?.play();
  }
  pause(): void {
    this.player?.pause();
  }
  seek(seconds: number): void {
    if (this.player) this.player.currentTime = seconds;
  }
  getCurrentTime(): number {
    return this.player?.currentTime ?? 0;
  }
  getDuration(): number {
    return this.player?.duration ?? 0;
  }
  setVolume(v: number): void {
    if (this.player) this.player.volume = v;
  }
  getVolume(): number {
    return this.player?.volume ?? 1;
  }
  setPlaybackRate(rate: number): void {
    if (this.player) this.player.playbackRate = rate;
  }
  getPlaybackRate(): number {
    return this.player?.playbackRate ?? 1;
  }

  enterFullscreen(): void {
    this.player?.getFullscreen();
  }
  exitFullscreen(): void {
    this.player?.exitFullscreen();
  }
  isFullscreen(): boolean {
    return this.player?.fullscreen ?? false;
  }

  on(event: VideoPlayerEvent, handler: (...args: unknown[]) => void): void {
    this.player?.on(EVENT_MAP[event] ?? event, handler);
  }

  off(event: VideoPlayerEvent, handler: (...args: unknown[]) => void): void {
    this.player?.off(EVENT_MAP[event] ?? event, handler);
  }

  destroy(): void {
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }
    this.container = null;
  }
}
