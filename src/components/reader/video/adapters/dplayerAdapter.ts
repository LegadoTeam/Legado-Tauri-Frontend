/**
 * DPlayer 播放器适配器
 *
 * 封装 DPlayer API，通过 hls.js 支持 HLS 流。
 */

import type { IVideoPlayer, VideoPlayerEvent, VideoSource } from '../types';
import { useAppConfig } from '../../../../composables/useAppConfig';

export class DplayerAdapter implements IVideoPlayer {
  private player: import('dplayer').default | null = null;
  private container: HTMLElement | null = null;

  async mount(container: HTMLElement, source: VideoSource): Promise<void> {
    this.container = container;
    await this.initPlayer(source);
  }

  private async initPlayer(source: VideoSource): Promise<void> {
    const [{ default: DPlayer }, hlsModule] = await Promise.all([
      import('dplayer'),
      import('hls.js'),
    ]);

    const Hls = hlsModule.default;

    if (!this.container) return;

    const { videoDpDanmaku, videoDpTheme } = useAppConfig();

    // 创建播放器容器 div
    const el = document.createElement('div');
    this.container.appendChild(el);

    const dpConfig: Record<string, unknown> = {
      container: el,
      autoplay: false,
      theme: videoDpTheme.value,
      danmaku: videoDpDanmaku.value ? { id: 'legado-video', api: '' } : undefined,
      video: {
        url: source.url,
        type: source.type === 'hls' ? 'customHls' : (source.type ?? 'auto'),
      },
    };

    // HLS 自定义解码
    if (source.type === 'hls' && Hls.isSupported()) {
      dpConfig.video = {
        url: source.url,
        type: 'customHls',
        customType: {
          customHls: (video: HTMLVideoElement) => {
            const hls = new Hls({
              xhrSetup: source.headers
                ? (xhr: XMLHttpRequest) => {
                    for (const [k, v] of Object.entries(source.headers!)) {
                      xhr.setRequestHeader(k, v);
                    }
                  }
                : undefined,
            });
            hls.loadSource(video.src);
            hls.attachMedia(video);
          },
        },
      };
    }

    // 字幕
    if (source.subtitles?.length) {
      const first = source.subtitles.find((s) => s.default) ?? source.subtitles[0];
      dpConfig.subtitle = {
        url: first.url,
        type: 'webvtt',
        fontSize: '24px',
        bottom: '40px',
        color: '#fff',
      };
    }

    this.player = new DPlayer(dpConfig as ConstructorParameters<typeof DPlayer>[0]);
  }

  play(): void {
    this.player?.play();
  }
  pause(): void {
    this.player?.pause();
  }

  seek(seconds: number): void {
    if (this.player) {
      this.player.seek(seconds);
    }
  }

  getCurrentTime(): number {
    return this.player?.video?.currentTime ?? 0;
  }

  getDuration(): number {
    return this.player?.video?.duration ?? 0;
  }

  setVolume(v: number): void {
    if (this.player?.video) {
      this.player.volume(v, true, false);
    }
  }

  getVolume(): number {
    return this.player?.video?.volume ?? 1;
  }

  setPlaybackRate(rate: number): void {
    if (this.player) {
      this.player.speed(rate);
    }
  }

  getPlaybackRate(): number {
    return this.player?.video?.playbackRate ?? 1;
  }

  enterFullscreen(): void {
    this.player?.fullScreen?.request('web');
  }
  exitFullscreen(): void {
    this.player?.fullScreen?.cancel('web');
  }
  isFullscreen(): boolean {
    return !!document.fullscreenElement;
  }

  on(event: VideoPlayerEvent, handler: (...args: unknown[]) => void): void {
    this.player?.on(event as string, handler);
  }

  off(event: VideoPlayerEvent, handler: (...args: unknown[]) => void): void {
    // DPlayer 没有原生 off 方法，通过 video 元素移除
    this.player?.video?.removeEventListener(event, handler as EventListener);
  }

  destroy(): void {
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }
    this.container = null;
  }
}
