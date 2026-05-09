/**
 * video.js 播放器适配器
 *
 * 封装 video.js API，内置 VHS（Video.js HTTP Streaming）支持 HLS/DASH。
 * 性能说明：使用 `fill: true` 填满容器（需父容器具有明确尺寸），
 * 避免 `fluid: true` 的 intrinsic padding-top 重绘开销。
 */

import type { IVideoPlayer, VideoPlayerEvent, VideoSource } from '../types';
import { useAppConfig } from '../../../../composables/useAppConfig';

export class VideojsAdapter implements IVideoPlayer {
  private player: ReturnType<(typeof import('video.js'))['default']> | null = null;
  private videoEl: HTMLVideoElement | null = null;
  private hlsInstance: import('hls.js').default | null = null;

  async mount(container: HTMLElement, source: VideoSource): Promise<void> {
    // 创建 video 元素
    this.videoEl = document.createElement('video');
    this.videoEl.className = 'video-js vjs-big-play-centered vjs-fluid';
    this.videoEl.setAttribute('playsinline', '');
    container.appendChild(this.videoEl);

    // 等待播放器初始化完成（含动态 import）
    await this.initPlayer(source);
  }

  private async initPlayer(source: VideoSource): Promise<void> {
    const [videojsModule, hlsModule] = await Promise.all([import('video.js'), import('hls.js')]);
    // video.js CSS
    await import('video.js/dist/video-js.css');

    const videojs = videojsModule.default;
    const Hls = hlsModule.default;

    if (!this.videoEl) return;

    const { videoVjsPreload, videoVjsPip } = useAppConfig();

    this.player = videojs(this.videoEl, {
      controls: true,
      autoplay: false,
      preload: videoVjsPreload.value as 'auto' | 'metadata' | 'none',
      // fill 填满父容器（父容器已通过 aspect-ratio 固定宽高比，不需要 fluid 的 padding-top 技巧）
      fill: true,
      playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2, 3],
      pictureInPictureToggle: videoVjsPip.value,
      html5: {
        vhs: { overrideNative: true },
        nativeAudioTracks: false,
        nativeVideoTracks: false,
      },
    });

    // 字幕
    if (source.subtitles?.length) {
      for (const sub of source.subtitles) {
        this.player.addRemoteTextTrack(
          {
            kind: 'subtitles',
            label: sub.label,
            srclang: sub.srclang ?? 'zh',
            src: sub.url,
            default: sub.default ?? false,
          },
          false,
        );
      }
    }

    // HLS 流使用 hls.js（WebView2 不原生支持 HLS）
    if (source.type === 'hls' && Hls.isSupported()) {
      this.hlsInstance = new Hls({
        xhrSetup: source.headers
          ? (xhr: XMLHttpRequest) => {
              for (const [k, v] of Object.entries(source.headers!)) {
                xhr.setRequestHeader(k, v);
              }
            }
          : undefined,
      });
      this.hlsInstance.loadSource(source.url);
      this.hlsInstance.attachMedia(
        this.player.tech({ IWillNotUseThisInPlugins: true }).el() as HTMLVideoElement,
      );
    } else {
      this.player.src({
        src: source.url,
        type: source.type === 'mp4' ? 'video/mp4' : `application/x-${source.type}`,
      });
    }
  }

  play(): void {
    this.player?.play();
  }
  pause(): void {
    this.player?.pause();
  }
  seek(seconds: number): void {
    this.player?.currentTime(seconds);
  }
  getCurrentTime(): number {
    return this.player?.currentTime() ?? 0;
  }
  getDuration(): number {
    return this.player?.duration() ?? 0;
  }
  setVolume(v: number): void {
    this.player?.volume(v);
  }
  getVolume(): number {
    return this.player?.volume() ?? 1;
  }
  setPlaybackRate(rate: number): void {
    this.player?.playbackRate(rate);
  }
  getPlaybackRate(): number {
    return this.player?.playbackRate() ?? 1;
  }

  enterFullscreen(): void {
    this.player?.requestFullscreen();
  }
  exitFullscreen(): void {
    this.player?.exitFullscreen();
  }
  isFullscreen(): boolean {
    return this.player?.isFullscreen() ?? false;
  }

  on(event: VideoPlayerEvent, handler: (...args: unknown[]) => void): void {
    this.player?.on(event, handler);
  }

  off(event: VideoPlayerEvent, handler: (...args: unknown[]) => void): void {
    this.player?.off(event, handler);
  }

  destroy(): void {
    this.hlsInstance?.destroy();
    this.hlsInstance = null;
    if (this.player) {
      this.player.dispose();
      this.player = null;
    }
    this.videoEl = null;
  }
}
