<script setup lang="ts">
import { computed } from 'vue';
import { Film, Image, Music, BookOpen } from 'lucide-vue-next';

const props = withDefaults(
  defineProps<{
    sourceType?: string;
    /** false = 半透明（书架卡片用）；true = 不透明（发现页用） */
    opaque?: boolean;
    size?: number;
  }>(),
  { sourceType: '', opaque: false, size: 13 },
);

const ICON_MAP: Record<string, typeof Film> = {
  comic: Image,
  video: Film,
  music: Music,
  novel: BookOpen,
};

const TITLE_MAP: Record<string, string> = {
  comic: '漫画',
  video: '视频',
  music: '音乐',
  novel: '小说',
};

// novel 是默认类型，不显示
const icon = computed(() => {
  const t = props.sourceType;
  if (!t || t === 'novel') return null;
  return ICON_MAP[t] ?? null;
});

const title = computed(() => TITLE_MAP[props.sourceType ?? ''] ?? props.sourceType);
</script>

<template>
  <span
    v-if="icon"
    class="source-type-badge"
    :class="{ 'source-type-badge--opaque': opaque }"
    :style="{ width: `${size + 9}px`, height: `${size + 9}px`, borderRadius: '50%' }"
    :title="title"
  >
    <component :is="icon" :size="size" :stroke-width="2.2" />
  </span>
</template>

<style scoped>
.source-type-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.38);
  color: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(4px);
  flex-shrink: 0;
}

.source-type-badge--opaque {
  background: rgba(24, 160, 88, 0.9);
  color: #fff;
  backdrop-filter: none;
}
</style>
