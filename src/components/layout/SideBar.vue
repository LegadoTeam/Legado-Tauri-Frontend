<script setup lang="ts">
import { ref } from 'vue'

export interface NavItem {
  id: string
  /** icon key，对应组件内置 SVG 图标库 */
  icon: string
  label: string
  badge?: number
}

withDefaults(defineProps<{
  items?: NavItem[]
  collapsed?: boolean
  activeId?: string
}>(), {
  items: () => [],
  collapsed: false,
  activeId: ''
})

const emit = defineEmits<{
  select: [id: string]
  'update:collapsed': [value: boolean]
}>()

const localActiveId = ref<string>('')

function selectItem(id: string) {
  localActiveId.value = id
  emit('select', id)
}

/**
 * 内置 Lucide 风格 SVG 图标库（stroke-based, 24×24 viewBox）
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
  <nav class="side-bar" :class="{ 'side-bar--collapsed': collapsed }">
    <!-- 导航列表 -->
    <ul class="side-bar__list" role="menubar">
      <li
        v-for="item in items"
        :key="item.id"
        class="side-bar__item"
        :class="{ 'side-bar__item--active': (activeId || localActiveId) === item.id }"
        role="menuitem"
        :aria-label="item.label"
        @click="selectItem(item.id)"
      >
        <span class="side-bar__icon" aria-hidden="true">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16" height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-linejoin="round"
            v-html="ICON_PATHS[item.icon] ?? ''"
          />
        </span>
        <Transition name="label-fade">
          <span v-if="!collapsed" class="side-bar__label">{{ item.label }}</span>
        </Transition>
        <span v-if="item.badge && !collapsed" class="side-bar__badge">{{ item.badge }}</span>
      </li>
    </ul>

    <!-- 底部折叠按钮 -->
    <div class="side-bar__footer">
      <button
        class="side-bar__collapse-btn"
        :aria-label="collapsed ? '展开菜单' : '收起菜单'"
        @click="$emit('update:collapsed', !collapsed)"
      >
        <span class="side-bar__icon" aria-hidden="true">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14" height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline v-if="collapsed" points="9 18 15 12 9 6" />
            <polyline v-else points="15 18 9 12 15 6" />
          </svg>
        </span>
        <Transition name="label-fade">
          <span v-if="!collapsed" class="side-bar__collapse-label">收起</span>
        </Transition>
      </button>
    </div>
  </nav>
</template>

<style scoped>
/* ── 容器 ─────────────────────────────── */
.side-bar {
  grid-area: sidebar;
  display: flex;
  flex-direction: column;
  width: var(--sidebar-w);
  background: var(--color-sidebar-bg);
  border-right: 1px solid var(--color-sidebar-border);
  transition: width var(--transition-base);
  overflow: hidden;
}

.side-bar--collapsed {
  width: var(--sidebar-collapsed-w);
}

/* ── 导航列表 ─────────────────────────── */
.side-bar__list {
  flex: 1;
  list-style: none;
  margin: 0;
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
}
.side-bar__list::-webkit-scrollbar { display: none; }

/* ── 菜单项 ───────────────────────────── */
.side-bar__item {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 36px;
  padding: 0 10px;
  border-radius: 7px;
  cursor: pointer;
  color: var(--color-sidebar-text-muted);
  transition: background var(--transition-fast), color var(--transition-fast);
  white-space: nowrap;
  overflow: hidden;
  /* 严格左对齐 */
  justify-content: flex-start;
}

.side-bar__item:hover {
  background: var(--color-sidebar-hover);
  color: var(--color-sidebar-text);
}

.side-bar__item--active {
  background: var(--color-sidebar-active-bg);
  color: var(--color-sidebar-active-text);
  font-weight: 600;
}
.side-bar__item--active:hover {
  background: rgba(99, 102, 241, 0.24);
}

/* ── 图标 ─────────────────────────────── */
.side-bar__icon {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  /* 光学居中补偿 */
  margin-top: 0.5px;
}

/* ── 文字标签 ─────────────────────────── */
.side-bar__label {
  font-size: 0.8125rem;   /* 13px */
  font-weight: 500;
  letter-spacing: 0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── 徽标 ─────────────────────────────── */
.side-bar__badge {
  margin-left: auto;
  flex-shrink: 0;
  min-width: 18px;
  padding: 0 4px;
  height: 16px;
  border-radius: 999px;
  background: var(--color-sidebar-active-bg);
  color: #fff;
  font-size: 0.6875rem;  /* 11px */
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ── 底部折叠区 ───────────────────────── */
.side-bar__footer {
  flex-shrink: 0;
  padding: 4px 8px 8px;
  border-top: 1px solid var(--color-sidebar-border);
}

.side-bar__collapse-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: 32px;
  padding: 0 10px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--color-sidebar-text-muted);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
  white-space: nowrap;
  overflow: hidden;
  justify-content: flex-start;
  font-family: inherit;
}

.side-bar__collapse-btn:hover {
  background: var(--color-sidebar-hover);
  color: var(--color-sidebar-text);
}

.side-bar__collapse-label {
  font-size: 0.8125rem;
  font-weight: 500;
  letter-spacing: 0.01em;
}

/* ── label 展开/收起过渡 ─────────────── */
.label-fade-enter-active {
  transition: opacity var(--transition-fast);
  transition-delay: 80ms;
}
.label-fade-leave-active {
  transition: opacity 80ms ease;
}
.label-fade-enter-from,
.label-fade-leave-to {
  opacity: 0;
}
.label-fade-enter-to,
.label-fade-leave-from {
  opacity: 1;
}
</style>
