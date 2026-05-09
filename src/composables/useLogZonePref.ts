/**
 * useLogZonePref — 实时日志区域显示开关
 * 纯前端偏好，持久化到 localStorage，不走 Rust AppConfig。
 */
import { ref, watch } from 'vue';

const LS_KEY = 'legado-ui-log-zone-enabled';

function readLS(): boolean {
  try {
    return localStorage.getItem(LS_KEY) === 'true';
  } catch {
    return false;
  }
}

// 模块级单例，避免多处 import 时状态不同步
const logZoneEnabled = ref<boolean>(readLS());

watch(logZoneEnabled, (v) => {
  try {
    localStorage.setItem(LS_KEY, String(v));
  } catch {
    // ignore storage errors
  }
});

export function useLogZonePref() {
  return { logZoneEnabled };
}
