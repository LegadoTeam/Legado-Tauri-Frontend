<script setup lang="ts">
import type { NavItem } from './SideBar.vue'

withDefaults(defineProps<{
  items?: NavItem[]
  activeId?: string
}>(), {
  items: () => [],
  activeId: ''
})

const emit = defineEmits<{
  select: [id: string]
}>()

/**
 * 内置 Lucide 风格 SVG 图标库（与 SideBar 保持一致）
 * 值为 SVG 内部元素字符串，由组件自身控制，不接受外部输入，无 XSS 风险。
 */
const ICON_PATHS: Record<string, string> = {
  bookshelf:  `<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>`,
  explore:    `<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>`,
  search:     `<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>`,
  booksource: `<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><path d="M3 17h4m-2-2v4"/>`,
  extensions: `<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>`,
  settings:   `<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>`,
}
</script>

<template>
  <nav class="bottom-nav">
    <button
      v-for="item in items"
      :key="item.id"
      class="bottom-nav__item"
      :class="{ 'bottom-nav__item--active': activeId === item.id }"
      :aria-label="item.label"
      @click="emit('select', item.id)"
    >
      <span class="bottom-nav__icon" aria-hidden="true">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22" height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linecap="round"
          stroke-linejoin="round"
          v-html="ICON_PATHS[item.icon] ?? ''"
        />
      </span>
      <span class="bottom-nav__label">{{ item.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
.bottom-nav {
  grid-area: bottomnav;
  display: flex;
  align-items: stretch;
  justify-content: space-around;
  min-height: var(--bottomnav-h);
  background: var(--color-surface-raised);
  border-top: 1px solid var(--color-border);
  user-select: none;
  padding: 0 2px;
  /* iOS / Android 圆角屏安全区避让 */
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.bottom-nav__item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: color var(--transition-fast);
  padding: 2px 0;
  min-width: 0;
  -webkit-tap-highlight-color: transparent;
}

.bottom-nav__item:active {
  opacity: 0.7;
}

.bottom-nav__item--active {
  color: var(--color-accent);
}

.bottom-nav__icon {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bottom-nav__label {
  font-size: 0.688rem;
  font-weight: 500;
  letter-spacing: 0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  line-height: 1.2;
}
</style>
