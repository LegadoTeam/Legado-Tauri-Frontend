<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { isMobile } from '@/composables/useEnv'
import SectionGeneral from '@/components/settings/SectionGeneral.vue'
import SectionReader from '@/components/settings/SectionReader.vue'
import SectionNetwork from '@/components/settings/SectionNetwork.vue'
import SectionStorage from '@/components/settings/SectionStorage.vue'
import SectionAdvanced from '@/components/settings/SectionAdvanced.vue'
import SectionAbout from '@/components/settings/SectionAbout.vue'

// ── 分区导航定义 ──────────────────────────────────────────────────────────
interface NavItem {
  id: string
  label: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'section-general', label: '通用' },
  { id: 'section-reader', label: '阅读偏好' },
  { id: 'section-network', label: '网络' },
  { id: 'section-storage', label: '存储' },
  { id: 'section-advanced', label: '高级' },
  { id: 'section-about', label: '关于' },
]

const activeSection = ref('section-general')
const contentRef = ref<HTMLElement | null>(null)

// ── 点击导航滚动到对应分区 ────────────────────────────────────────────────
function scrollToSection(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  activeSection.value = id
}

// ── IntersectionObserver 自动高亮当前可见分区 ─────────────────────────────
let observer: IntersectionObserver | null = null

function setupObserver() {
  if (isMobile.value) return
  observer?.disconnect()
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          activeSection.value = entry.target.id
          break
        }
      }
    },
    {
      root: contentRef.value,
      rootMargin: '-10% 0px -70% 0px',
      threshold: 0,
    },
  )
  for (const item of NAV_ITEMS) {
    const el = document.getElementById(item.id)
    if (el) observer.observe(el)
  }
}

onMounted(() => {
  // 等 DOM 渲染完成
  requestAnimationFrame(() => setupObserver())
})

onUnmounted(() => {
  observer?.disconnect()
})
</script>

<template>
  <div class="settings-view" :class="{ 'settings-view--mobile': isMobile }">
    <!-- 页头 -->
    <div class="sv-header">
      <h1 class="sv-header__title">设置</h1>
      <p class="sv-header__sub">应用配置与环境信息</p>
    </div>

    <div class="sv-body">
      <!-- 桌面端：左侧分区导航 -->
      <nav v-if="!isMobile" class="sv-nav">
        <button v-for="item in NAV_ITEMS" :key="item.id" class="sv-nav__item"
          :class="{ 'sv-nav__item--active': activeSection === item.id }" @click="scrollToSection(item.id)">
          {{ item.label }}
        </button>
      </nav>

      <!-- 内容区 -->
      <div ref="contentRef" class="sv-content">
        <SectionGeneral />
        <SectionReader />
        <SectionNetwork />
        <SectionStorage />
        <SectionAdvanced />
        <SectionAbout />
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--color-surface);
}

/* ── 页头 ── */
.sv-header {
  flex-shrink: 0;
  padding: 24px 24px 12px;
}

.sv-header__title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 2px;
}

.sv-header__sub {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  margin: 0;
}

/* ── 主体：桌面双栏 / 手机单列 ── */
.sv-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  gap: 0;
}

/* ── 桌面端左侧导航 ── */
.sv-nav {
  flex-shrink: 0;
  width: 160px;
  padding: 8px 12px 24px 24px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  position: sticky;
  top: 0;
  align-self: flex-start;
  overflow-y: auto;
}

.sv-nav__item {
  display: block;
  width: 100%;
  padding: 8px 12px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 0.8125rem;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.sv-nav__item:hover {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
}

.sv-nav__item--active {
  background: var(--color-accent-subtle);
  color: var(--color-accent);
  font-weight: 600;
}

/* ── 内容区 ── */
.sv-content {
  flex: 1;
  overflow-y: auto;
  padding: 4px 24px 32px 16px;
  display: flex;
  flex-direction: column;
  gap: 28px;
  width: min(760px, 100%);
  max-width: none;
}

.sv-content::-webkit-scrollbar {
  width: 5px;
}

.sv-content::-webkit-scrollbar-track {
  background: transparent;
}

.sv-content::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 3px;
}

/* ── 手机端适配 ── */
.settings-view--mobile .sv-header {
  padding: 16px 16px 8px;
}

.settings-view--mobile .sv-content {
  padding: 4px 16px 24px;
  max-width: 100%;
  gap: 24px;
}
</style>
