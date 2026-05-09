// [BOOT] 前端入口打点：记录 JS 开始执行的时间，用于切割 Android 52s 启动空档
const _bootT0 = Date.now();
console.log(`[BOOT][Frontend] main.ts 开始执行 t=${_bootT0}`);
window.__LEGADO_SET_BOOT_STAGE?.('main-ts-started');

import naive from 'naive-ui';
import { createPinia } from 'pinia';
import { createApp } from 'vue';
import './style.css';
import './styles/tokens.css';
import './styles/theme.css';
import './styles/base.css';
import './styles/responsive.css';
import './styles/reader.css';
import './styles/focus.css';
import './styles/remote.css';
import './styles/components.css';
import App from './App.vue';
import { initFrontendStorage } from './composables/useFrontendStorage';
import { invokeWithTimeout } from './composables/useInvoke';
import { isTransportAvailable } from './composables/useTransport';

async function bootstrapEruda() {
  try {
    const available = await isTransportAvailable();
    if (!available) {
      return;
    }
    const config = await invokeWithTimeout<{ ui_enable_eruda?: boolean }>(
      'app_config_get_all',
      undefined,
      10_000,
    );
    if (config.ui_enable_eruda) {
      const eruda = await import('eruda');
      eruda.default.init();
    }
  } catch {
    /* ignore */
  }
}

void bootstrapEruda();

// Naive UI 已通过 unplugin-vue-components 按需自动导入，无需全量 app.use(naive)
const app = createApp(App);
app.use(createPinia());
app.config.errorHandler = (err, instance, info) => {
  const details = err instanceof Error ? err.stack || err.message : String(err);
  console.error('[BOOT][Frontend] Vue error', { err, info, instance });
  window.__LEGADO_SHOW_BOOT_ERROR?.(`Vue 渲染异常 (${info}):\n${details}`);
};
// 挂载后记录首屏到达时间，并移除骨架屏
app.use(naive);

// 在挂载前从后端预取所有持久化数据，确保 useDynamicConfig 的 ready 可立即 resolve，
// 不再依赖 localStorage 作为同步备份，彻底消除脏数据干扰。
await initFrontendStorage();
console.log(`[BOOT][Frontend] 前端存储预取完成 cost=${Date.now() - _bootT0}ms`);

try {
  app.mount('#app');
  window.__LEGADO_SET_BOOT_STAGE?.('app-mounted');
  console.log(`[BOOT][Frontend] App 挂载完成 cost=${Date.now() - _bootT0}ms`);
} catch (err) {
  const details = err instanceof Error ? err.stack || err.message : String(err);
  window.__LEGADO_SHOW_BOOT_ERROR?.(`App 挂载失败:\n${details}`);
  throw err;
}

// 隐藏首屏骨架屏（过渡动画后移除）
const skeleton = document.getElementById('app-skeleton');
if (skeleton) {
  skeleton.classList.add('hidden');
  const removeSkeleton = () => {
    if (skeleton.parentNode) {
      skeleton.remove();
    }
  };
  skeleton.addEventListener('transitionend', removeSkeleton, { once: true });
  // Android WebView 有时不触发 transitionend，500ms 后强制移除
  setTimeout(removeSkeleton, 500);
}
