/**
 * useFrontendPluginsStore — 前端插件运行时 Pinia Store
 *
 * 使用包装模式：将现有 useFrontendPlugins composable（2250+ 行，包含完整插件运行时）
 * 接入 Pinia 体系，以获得 DevTools 支持与统一状态管理。
 *
 * 原 composable 逻辑不变，此文件仅负责注册为 Pinia Store。
 */
import { defineStore } from 'pinia';
import { useFrontendPlugins } from '@/composables/useFrontendPlugins';

export const useFrontendPluginsStore = defineStore('frontendPlugins', () => {
  return useFrontendPlugins();
});
