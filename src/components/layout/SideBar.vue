<script setup lang="ts">
import {
  BookOpen,
  Compass,
  Search,
  LayoutGrid,
  Package,
  SlidersHorizontal,
  Image,
  Sun,
  SunMoon,
  Moon,
  CheckCircle2,
} from "lucide-vue-next";
import { ref, computed, type Component } from "vue";
import { useOverlayBackstack } from "@/composables/useOverlayBackstack";
import { useAppConfigStore } from "@/stores";
import type { NavItem } from "./types";
export type { NavItem };

const props = withDefaults(
  defineProps<{
    items?: NavItem[];
    activeId?: string;
  }>(),
  {
    items: () => [],
    activeId: "",
  },
);

const emit = defineEmits<{
  select: [id: string];
}>();

const appConfigStore = useAppConfigStore();

type ThemeMode = "light" | "auto" | "dark";

const themeMode = computed({
  get: () => (appConfigStore.config.ui_theme ?? "auto") as ThemeMode,
  set: (v: ThemeMode) => void appConfigStore.setConfig("ui_theme", v),
});

const showPromoModal = ref(false);

useOverlayBackstack(
  () => showPromoModal.value,
  () => {
    showPromoModal.value = false;
  },
);

function selectItem(id: string) {
  emit("select", id);
}

function onItemKeyDown(event: KeyboardEvent, index: number) {
  const itemEls = document.querySelectorAll<HTMLElement>(
    ".side-bar__item[tabindex]",
  );
  const len = itemEls.length;
  if (event.key === "ArrowDown") {
    event.preventDefault();
    itemEls[(index + 1) % len]?.focus();
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    itemEls[(index - 1 + len) % len]?.focus();
  } else if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    selectItem(props.items[index].id);
  }
}

/**
 * 内置导航图标映射（使用 lucide-vue-next 组件）
 */
const ICON_COMPONENTS: Record<string, Component> = {
  bookshelf: BookOpen,
  explore: Compass,
  search: Search,
  booksource: LayoutGrid,
  extensions: Package,
  settings: SlidersHorizontal,
};
</script>

<template>
  <nav class="side-bar" aria-label="主导航">
    <!-- ── Logo 顶部区（与标题栏等高）────────────────── -->
    <div class="side-bar__header">
      <div class="side-bar__logo-wrap">
        <div class="side-bar__logo-icon" aria-hidden="true">
          <BookOpen :size="20" />
        </div>
        <span class="side-bar__app-name">Legado</span>
      </div>
    </div>

    <!-- ── 导航列表 ─────────────────────────────────── -->
    <ul class="side-bar__list app-scrollbar--hidden" role="menubar">
      <li
        v-for="(item, index) in items"
        :key="item.id"
        class="side-bar__item focusable"
        :class="{ 'side-bar__item--active': activeId === item.id }"
        role="option"
        :aria-selected="activeId === item.id"
        :aria-label="item.label"
        tabindex="0"
        @click="selectItem(item.id)"
        @keydown="onItemKeyDown($event, index)"
      >
        <span class="side-bar__icon" aria-hidden="true">
          <component
            :is="ICON_COMPONENTS[item.icon]"
            :size="18"
            :stroke-width="1.75"
          />
        </span>
        <span class="side-bar__label">{{ item.label }}</span>
        <span v-if="item.badge" class="side-bar__badge">{{ item.badge }}</span>
      </li>
    </ul>

    <!-- 图片占位区域（待接入真实素材） -->
    <button
      class="side-bar__banner"
      aria-label="了解更多信息"
      @click="showPromoModal = true"
    >
      <div class="side-bar__banner-inner">
        <Image :size="26" :stroke-width="1.5" aria-hidden="true" />
        <span class="side-bar__banner-title">图片占位区</span>
        <span class="side-bar__banner-hint">点击了解更多</span>
      </div>
    </button>

    <!-- ── 底部固定区 ──────────────────────────────── -->
    <div class="side-bar__bottom">
      <!-- 主题切换（三段式） -->
      <div class="side-bar__section-label">主题</div>
      <div
        class="side-bar__theme-toggle"
        role="radiogroup"
        aria-label="主题模式切换"
      >
        <button
          class="theme-seg-btn"
          :class="{ 'theme-seg-btn--active': themeMode === 'light' }"
          aria-label="浅色模式"
          title="浅色"
          @click="themeMode = 'light'"
        >
          <Sun :size="13" :stroke-width="2.2" aria-hidden="true" />
          <span>浅色</span>
        </button>
        <button
          class="theme-seg-btn"
          :class="{ 'theme-seg-btn--active': themeMode === 'auto' }"
          aria-label="跟随系统"
          title="自动"
          @click="themeMode = 'auto'"
        >
          <!-- half-circle auto -->
          <SunMoon :size="13" :stroke-width="2.2" aria-hidden="true" />
          <span>自动</span>
        </button>
        <button
          class="theme-seg-btn"
          :class="{ 'theme-seg-btn--active': themeMode === 'dark' }"
          aria-label="深色模式"
          title="深色"
          @click="themeMode = 'dark'"
        >
          <!-- moon -->
          <Moon :size="13" :stroke-width="2.2" aria-hidden="true" />
          <span>深色</span>
        </button>
      </div>
    </div>
  </nav>

  <!-- 弹窗（渲染在 teleport body 中，无 XSS 风险） -->
  <n-modal
    v-model:show="showPromoModal"
    preset="card"
    title="关于收费"
    style="max-width: 320px"
  >
    <div class="promo-modal-body">
      <CheckCircle2
        :size="44"
        :stroke-width="1.5"
        class="promo-modal-icon"
        aria-hidden="true"
      />
      <p class="promo-modal-title">没有收费功能</p>
      <p class="promo-modal-desc">本应用所有功能完全免费开放，永无付费项目。</p>
    </div>
  </n-modal>
</template>

<style scoped>
/* ── 侧边栏容器 ──────────────────────────────────────────── */
.side-bar {
  grid-area: sidebar;
  display: flex;
  flex-direction: column;
  width: var(--sidebar-w);
  background: transparent;
  overflow: hidden;
}

/* ── Logo 顶部区 ─────────────────────────────────────────── */
.side-bar__header {
  margin-top: 20px;
  margin-bottom: 10px;
  flex-shrink: 0;
  height: var(--topbar-height);
  display: flex;
  align-items: center;
  padding: 0 var(--space-4);
  background: transparent;
}

.side-bar__logo-wrap {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.side-bar__logo-icon {
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(
    135deg,
    var(--brand-800) 0%,
    var(--brand-900) 100%
  );
  border-radius: var(--radius-2);
  color: var(--brand-100);
  flex-shrink: 0;
}

.side-bar__app-name {
  font-size: var(--fs-20);
  font-weight: var(--fw-bold);
  letter-spacing: 0.02em;
  color: var(--color-sidebar-text);
}

/* ── 导航列表 ─────────────────────────────────────────────── */
.side-bar__list {
  flex: 1;
  list-style: none;
  margin: 0;
  padding: var(--space-2) var(--space-2);
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
  overflow-x: hidden;
}

/* ── 菜单项 ──────────────────────────────────────────────── */
.side-bar__item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  height: 40px;
  padding: 0 var(--space-3) 0 14px;
  border-radius: 10px;
  cursor: pointer;
  color: var(--color-sidebar-text-muted);
  transition:
    background 120ms ease,
    color 120ms ease;
  white-space: nowrap;
  overflow: hidden;
  position: relative;
  outline: none;
  border: none;
}

@media (hover: hover) and (pointer: fine) {
  .side-bar__item:hover {
    background: var(--color-sidebar-hover);
    color: var(--color-sidebar-text);
  }
}

.side-bar__item:focus-visible {
  box-shadow: inset 0 0 0 2px var(--color-accent);
}

.side-bar__item--active {
  background: var(--color-sidebar-active-bg);
  color: var(--color-sidebar-active-text);
  font-weight: var(--fw-semibold);
}

.side-bar__item--active::before {
  content: "";
  position: absolute;
  left: 0;
  top: 22%;
  bottom: 22%;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: currentColor;
}

@media (hover: hover) and (pointer: fine) {
  .side-bar__item--active:hover {
    background: var(--color-sidebar-active-bg);
  }
}

/* ── 图标 ─────────────────────────────────────────────────── */
.side-bar__icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ── 文字标签 ─────────────────────────────────────────────── */
.side-bar__label {
  font-size: var(--fs-13);
  font-weight: var(--fw-medium);
  letter-spacing: 0.015em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

/* ── 徽标 ─────────────────────────────────────────────────── */
.side-bar__badge {
  flex-shrink: 0;
  min-width: 18px;
  padding: 0 var(--space-1);
  height: 16px;
  border-radius: var(--radius-pill);
  background: var(--color-accent);
  color: #fff;
  font-size: var(--fs-11);
  font-weight: var(--fw-bold);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ── 底部固定区 ──────────────────────────────────────────── */
.side-bar__bottom {
  flex-shrink: 0;
  padding: var(--space-2) var(--space-2) var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

/* ── 小节标题 ────────────────────────────────────────────── */
.side-bar__section-label {
  font-size: var(--fs-11);
  font-weight: var(--fw-semibold);
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--color-sidebar-text-muted);
  padding: 0 var(--space-1);
}

/* ── 主题切换（三段式胶囊）────────────────────────────────── */
.side-bar__theme-toggle {
  display: flex;
  background: var(--color-surface-sunken);
  border-radius: 8px;
  padding: 3px;
  gap: 2px;
}

.theme-seg-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  height: 26px;
  padding: 0 4px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-sidebar-text-muted);
  cursor: pointer;
  font-size: var(--fs-11);
  font-weight: var(--fw-medium);
  font-family: var(--font-ui);
  transition:
    background 120ms ease,
    color 120ms ease,
    box-shadow 120ms ease;
  white-space: nowrap;
  -webkit-app-region: no-drag;
}

.theme-seg-btn--active {
  background: var(--color-surface-raised);
  color: var(--color-sidebar-active-text);
  font-weight: var(--fw-semibold);
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.1),
    0 1px 2px rgba(0, 0, 0, 0.06);
}

@media (hover: hover) and (pointer: fine) {
  .theme-seg-btn:not(.theme-seg-btn--active):hover {
    background: var(--color-sidebar-hover);
    color: var(--color-sidebar-text);
  }
}

/* ── 图片占位区（底部 Banner）────────────────────────────── */
.side-bar__banner {
  margin-left: 10px;
  margin-right: 10px;
  width: calc(100% - 20px);
  height: 300px;
  border: 1.5px dashed var(--color-sidebar-border);
  border-radius: var(--radius-1);
  background: transparent;
  background-color: #cccccc10;
  cursor: pointer;
  padding: 0;
  overflow: hidden;
  transition:
    background 120ms ease,
    border-color 120ms ease;
  -webkit-app-region: no-drag;
}

@media (hover: hover) and (pointer: fine) {
  .side-bar__banner:hover {
    background: var(--color-sidebar-hover);
    border-color: var(--color-accent);
  }

  .side-bar__banner:hover .side-bar__banner-inner {
    color: var(--color-accent);
  }
}

.side-bar__banner-inner {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  color: var(--color-sidebar-text-muted);
  transition: color 120ms ease;
}

.side-bar__banner-title {
  font-size: var(--fs-12);
  font-weight: var(--fw-medium);
}

.side-bar__banner-hint {
  font-size: var(--fs-11);
  opacity: 0.65;
}

/* ── 弹窗内容 ─────────────────────────────────────────────── */
.promo-modal-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-4) var(--space-3) var(--space-2);
  text-align: center;
  gap: var(--space-2);
}

.promo-modal-icon {
  color: var(--color-accent);
}

.promo-modal-title {
  margin: 0;
  font-size: var(--fs-18);
  font-weight: var(--fw-bold);
  color: var(--color-text-primary, var(--color-text));
}

.promo-modal-desc {
  margin: 0;
  font-size: var(--fs-14);
  color: var(--color-text-secondary, var(--color-text-muted));
  line-height: var(--lh-base);
}
</style>
