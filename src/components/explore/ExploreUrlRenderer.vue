<script setup lang="ts">
/**
 * ExploreUrlRenderer — 网页发现源 URL 渲染器
 *
 * 将书源 explore() 返回的 URL 在 iframe 中加载，
 * 适用于 sourceType = 'webpage' 的网页发现源。
 *
 * 与 ExploreHtmlRenderer 的区别：
 * - 直接加载外部 URL，不注入 bridge 脚本
 * - 允许页内自由导航（不限制 sandbox allow-same-origin）
 */
import { ref, watch } from 'vue';

const props = defineProps<{
  /** 要加载的页面 URL */
  url: string;
}>();

const loading = ref(true);
const iframeRef = ref<HTMLIFrameElement | null>(null);

watch(
  () => props.url,
  () => {
    loading.value = true;
  },
);

function handleLoad() {
  loading.value = false;
}
</script>

<template>
  <div class="eur">
    <Transition name="eur-fade">
      <div v-if="loading" class="eur__loading">
        <n-spin size="small" />
      </div>
    </Transition>
    <iframe
      ref="iframeRef"
      class="eur__frame"
      :src="url"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
      referrerpolicy="no-referrer"
      @load="handleLoad"
    />
  </div>
</template>

<style scoped>
.eur {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.eur__loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.15);
  z-index: 1;
}

.eur__frame {
  width: 100%;
  height: 100%;
  min-height: 0;
  border: none;
  display: block;
}

.eur-fade-enter-active,
.eur-fade-leave-active {
  transition: opacity 0.2s ease;
}
.eur-fade-enter-from,
.eur-fade-leave-to {
  opacity: 0;
}
</style>
