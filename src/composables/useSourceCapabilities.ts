/**
 * useSourceCapabilities
 *
 * 管理书源能力检测（search / explore / bookInfo / toc / content）以及
 * 用户对各书源「探索」和「搜索」功能的独立开关。
 *
 * 能力检测结果缓存在内存中（会话期间有效）。
 * 用户开关持久化到 localStorage。
 */

import { reactive, computed } from 'vue'
import { evalBookSource } from './useBookSource'

// ── 能力检测缓存（fileName -> Set<string>）─────────────────────────────────
const fnsCache = reactive<Record<string, Set<string>>>({})

export async function detectCapabilities(fileName: string): Promise<Set<string>> {
  if (fnsCache[fileName]) return fnsCache[fileName]
  try {
    const raw = await evalBookSource(fileName)
    const fns = new Set(raw.split(',').map(s => s.trim()).filter(Boolean))
    fnsCache[fileName] = fns
    return fns
  } catch {
    fnsCache[fileName] = new Set()
    return fnsCache[fileName]
  }
}

export function invalidateCapability(fileName: string) {
  delete fnsCache[fileName]
}

export function invalidateAllCapabilities() {
  Object.keys(fnsCache).forEach(k => delete fnsCache[k])
}

/** 返回已缓存的能力集合（未检测时返回 undefined） */
export function getCachedCapabilities(fileName: string): Set<string> | undefined {
  return fnsCache[fileName]
}

// ── 用户开关（localStorage 持久化）──────────────────────────────────────────
const LS_EXPLORE_KEY = 'source-explore-disabled'
const LS_SEARCH_KEY  = 'source-search-disabled'

function loadDisabledSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

function saveDisabledSet(key: string, set: Set<string>) {
  localStorage.setItem(key, JSON.stringify([...set]))
}

// 使用 reactive Set 包装（通过 reactive 对象触发响应式）
const _exploreDisabled = reactive<{ v: Set<string> }>({ v: loadDisabledSet(LS_EXPLORE_KEY) })
const _searchDisabled  = reactive<{ v: Set<string> }>({ v: loadDisabledSet(LS_SEARCH_KEY) })

export function isExploreUserEnabled(fileName: string): boolean {
  return !_exploreDisabled.v.has(fileName)
}

export function isSearchUserEnabled(fileName: string): boolean {
  return !_searchDisabled.v.has(fileName)
}

export function setExploreUserEnabled(fileName: string, enabled: boolean) {
  if (enabled) {
    _exploreDisabled.v.delete(fileName)
  } else {
    _exploreDisabled.v.add(fileName)
  }
  // 触发响应式更新
  _exploreDisabled.v = new Set(_exploreDisabled.v)
  saveDisabledSet(LS_EXPLORE_KEY, _exploreDisabled.v)
}

export function setSearchUserEnabled(fileName: string, enabled: boolean) {
  if (enabled) {
    _searchDisabled.v.delete(fileName)
  } else {
    _searchDisabled.v.add(fileName)
  }
  _searchDisabled.v = new Set(_searchDisabled.v)
  saveDisabledSet(LS_SEARCH_KEY, _searchDisabled.v)
}

/** 计算属性辅助：返回一个响应式的引用，方便模板中直接读取 */
export function useCapabilityFlags() {
  return {
    exploreDisabled: computed(() => _exploreDisabled.v),
    searchDisabled:  computed(() => _searchDisabled.v),
    isExploreUserEnabled,
    isSearchUserEnabled,
    setExploreUserEnabled,
    setSearchUserEnabled,
  }
}
