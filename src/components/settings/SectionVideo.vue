<script setup lang="ts">
import { useMessage } from 'naive-ui';
import { storeToRefs } from 'pinia';
import { useAppConfigStore } from '@/stores';
import SettingItem from './SettingItem.vue';
import SettingSection from './SettingSection.vue';

const message = useMessage();
const _appCfg = useAppConfigStore();
const {
  savingKey,
  videoPlayerType,
  videoDefaultRate,
  videoAutoNext,
  videoQualityPrefer,
  videoRememberProgress,
  videoSeekStepSecs,
  videoVjsPreload,
  videoVjsPip,
  videoXgDownload,
  videoDpDanmaku,
  videoDpTheme,
  videoAutoplay,
} = storeToRefs(_appCfg);
const { setConfig } = _appCfg;

const PLAYER_OPTIONS = [
  { label: 'Video.js', value: 'videojs' },
  { label: 'XGPlayer（西瓜播放器）', value: 'xgplayer' },
  { label: 'DPlayer', value: 'dplayer' },
];

const QUALITY_OPTIONS = [
  { label: '自动', value: 'auto' },
  { label: '最高画质', value: 'highest' },
  { label: '最低画质', value: 'lowest' },
];

const RATE_OPTIONS = [
  { label: '0.5x', value: 0.5 },
  { label: '0.75x', value: 0.75 },
  { label: '1.0x', value: 1.0 },
  { label: '1.25x', value: 1.25 },
  { label: '1.5x', value: 1.5 },
  { label: '2.0x', value: 2.0 },
  { label: '3.0x', value: 3.0 },
];

const VJS_PRELOAD_OPTIONS = [
  { label: '自动（auto）', value: 'auto' },
  { label: '仅元数据（metadata）', value: 'metadata' },
  { label: '不预加载（none）', value: 'none' },
];

const SEEK_STEP_OPTIONS = [
  { label: '5 秒', value: 5 },
  { label: '10 秒', value: 10 },
  { label: '15 秒', value: 15 },
  { label: '30 秒', value: 30 },
  { label: '60 秒', value: 60 },
];

async function handleSet(key: string, value: string) {
  try {
    await setConfig(key, value);
    message.success('已保存');
  } catch (e: unknown) {
    message.error(`保存失败: ${e}`);
  }
}
</script>

<template>
  <SettingSection title="视频播放" section-id="section-video">
    <SettingItem
      label="播放与引擎设置"
      desc="默认播放器、倍速、画质和各播放器专属选项直接在当前页面展开。"
      :vertical="true"
    >
      <div class="video-panel-stack">
        <SettingItem label="默认播放器" desc="选择视频播放器引擎（切换后重新打开视频生效）">
          <n-select
            :value="videoPlayerType"
            :options="PLAYER_OPTIONS"
            :loading="savingKey === 'video_player_type'"
            style="width: 200px"
            @update:value="(v: string) => handleSet('video_player_type', v)"
          />
        </SettingItem>

        <SettingItem label="默认播放速率" desc="视频默认播放速度">
          <n-select
            :value="videoDefaultRate"
            :options="RATE_OPTIONS"
            :loading="savingKey === 'video_default_rate'"
            style="width: 120px"
            @update:value="(v: number) => handleSet('video_default_rate', String(v))"
          />
        </SettingItem>

        <SettingItem label="快捷键快进/快退步长" desc="按 ← / → / J / L 键时跳转的秒数">
          <n-select
            :value="videoSeekStepSecs"
            :options="SEEK_STEP_OPTIONS"
            :loading="savingKey === 'video_seek_step_secs'"
            style="width: 120px"
            @update:value="(v: number) => handleSet('video_seek_step_secs', String(v))"
          />
        </SettingItem>

        <SettingItem label="默认画质偏好" desc="多清晰度视频源时的默认选择">
          <n-select
            :value="videoQualityPrefer"
            :options="QUALITY_OPTIONS"
            :loading="savingKey === 'video_quality_prefer'"
            style="width: 140px"
            @update:value="(v: string) => handleSet('video_quality_prefer', v)"
          />
        </SettingItem>

        <SettingItem label="自动开始播放" desc="打开视频后立即自动播放（不等待用户点击播放按钮）">
          <n-switch
            :value="videoAutoplay"
            :loading="savingKey === 'video_autoplay'"
            @update:value="(v: boolean) => handleSet('video_autoplay', String(v))"
          />
        </SettingItem>

        <SettingItem label="自动播放下一集" desc="当前集播放结束后自动播放下一集">
          <n-switch
            :value="videoAutoNext"
            :loading="savingKey === 'video_auto_next'"
            @update:value="(v: boolean) => handleSet('video_auto_next', String(v))"
          />
        </SettingItem>

        <SettingItem label="记忆播放进度" desc="退出后再次打开时从上次位置继续播放">
          <n-switch
            :value="videoRememberProgress"
            :loading="savingKey === 'video_remember_progress'"
            @update:value="(v: boolean) => handleSet('video_remember_progress', String(v))"
          />
        </SettingItem>

        <template v-if="videoPlayerType === 'videojs'">
          <n-divider title-placement="left" style="margin: 8px 0; font-size: 0.8rem; opacity: 0.6">
            Video.js 专属
          </n-divider>

          <SettingItem
            label="预加载模式"
            desc="auto：立即缓冲；metadata：仅加载时长信息；none：点击后再加载（省流）"
          >
            <n-select
              :value="videoVjsPreload"
              :options="VJS_PRELOAD_OPTIONS"
              :loading="savingKey === 'video_vjs_preload'"
              style="width: 200px"
              @update:value="(v: string) => handleSet('video_vjs_preload', v)"
            />
          </SettingItem>

          <SettingItem label="画中画按钮" desc="在播放器控制栏显示画中画（PiP）按钮">
            <n-switch
              :value="videoVjsPip"
              :loading="savingKey === 'video_vjs_pip'"
              @update:value="(v: boolean) => handleSet('video_vjs_pip', String(v))"
            />
          </SettingItem>
        </template>

        <template v-else-if="videoPlayerType === 'xgplayer'">
          <n-divider title-placement="left" style="margin: 8px 0; font-size: 0.8rem; opacity: 0.6">
            西瓜播放器专属
          </n-divider>

          <SettingItem label="下载按钮" desc="在播放器控制栏显示下载按钮（需视频源支持直链下载）">
            <n-switch
              :value="videoXgDownload"
              :loading="savingKey === 'video_xg_download'"
              @update:value="(v: boolean) => handleSet('video_xg_download', String(v))"
            />
          </SettingItem>
        </template>

        <template v-else-if="videoPlayerType === 'dplayer'">
          <n-divider title-placement="left" style="margin: 8px 0; font-size: 0.8rem; opacity: 0.6">
            DPlayer 专属
          </n-divider>

          <SettingItem label="弹幕功能" desc="开启弹幕输入框（需书源提供弹幕 API 才能实际发送）">
            <n-switch
              :value="videoDpDanmaku"
              :loading="savingKey === 'video_dp_danmaku'"
              @update:value="(v: boolean) => handleSet('video_dp_danmaku', String(v))"
            />
          </SettingItem>

          <SettingItem label="主题色" desc="播放器进度条、按钮的强调色（CSS 颜色值）">
            <n-input
              :value="videoDpTheme"
              :loading="savingKey === 'video_dp_theme'"
              placeholder="#00b1ff"
              style="width: 140px"
              @change="(v: string) => handleSet('video_dp_theme', v)"
            >
              <template #prefix>
                <span
                  :style="{
                    width: '14px',
                    height: '14px',
                    borderRadius: '3px',
                    background: videoDpTheme,
                    display: 'inline-block',
                    border: '1px solid rgba(0,0,0,0.15)',
                  }"
                />
              </template>
            </n-input>
          </SettingItem>
        </template>
      </div>
    </SettingItem>
  </SettingSection>
</template>

<style scoped>
.video-panel-stack {
  display: flex;
  flex-direction: column;
}
</style>
