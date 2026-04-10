/**
 * useEnv — 运行环境检测（单例，模块加载时初始化一次）
 *
 * 暴露的变量：
 *   isTauri    — 是否运行在 Tauri 原生壳中
 *   isMobile   — 是否为移动端（响应式 computed，受 layoutMode 影响）
 *   autoIsMobile — 自动检测结果（固定值，不受覆盖影响）
 *   platform   — 操作系统平台字符串
 *   envLabel   — 人类可读的环境标签（用于 UI 展示 / 调试）
 *   layoutMode — 当前布局模式 ref（"auto" | "mobile" | "desktop"）
 *   setLayoutMode — 设置布局模式覆盖
 *
 * 用法：
 *   import { isTauri, isMobile, envLabel, platform } from '@/composables/useEnv'
 */

import { ref, computed, type ComputedRef } from 'vue'

/** 是否运行在 Tauri 原生壳中 */
export const isTauri: boolean =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/** 自动检测的移动端结果（固定值，不受模式覆盖影响） */
export const autoIsMobile: boolean =
  typeof window !== 'undefined' && (
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    window.matchMedia('(pointer: coarse)').matches
  )

/** 操作系统平台 */
export const platform: string = (() => {
  if (typeof navigator === 'undefined') return ''
  const ua = navigator.userAgent
  if (/Windows/i.test(ua)) return 'Windows'
  if (/Mac OS X/i.test(ua)) return 'macOS'
  if (/Linux/i.test(ua)) return 'Linux'
  if (/Android/i.test(ua)) return 'Android'
  if (/iPhone|iPad/i.test(ua)) return 'iOS'
  return ''
})()

// ── 布局模式覆盖（"auto" | "mobile" | "desktop"） ─────────────────────────

/** 当前布局模式（由 useAppConfig 加载后通过 setLayoutMode 设置） */
export const layoutMode = ref<string>('auto')

/** 设置布局模式覆盖 */
export function setLayoutMode(mode: string) {
  layoutMode.value = mode
}

/**
 * 是否为移动端布局（响应式）
 * - auto：使用自动检测结果
 * - mobile：强制移动端
 * - desktop：强制桌面端
 */
export const isMobile: ComputedRef<boolean> = computed(() => {
  switch (layoutMode.value) {
    case 'mobile': return true
    case 'desktop': return false
    default: return autoIsMobile
  }
})

/** 人类可读的环境标签 */
export const envLabel: string = (() => {
  if (isTauri) return 'Tauri'
  if (autoIsMobile) return '移动端浏览器'
  return '浏览器'
})()
