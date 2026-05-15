<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';
import { storeToRefs } from 'pinia';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import AppPageHeader from '@/components/layout/AppPageHeader.vue';
import SectionAbout from '@/components/settings/SectionAbout.vue';
import SectionAdvanced from '@/components/settings/SectionAdvanced.vue';
import SectionDeveloper from '@/components/settings/SectionDeveloper.vue';
import SectionGeneral from '@/components/settings/SectionGeneral.vue';
import SectionNetwork from '@/components/settings/SectionNetwork.vue';
import SectionReader from '@/components/settings/SectionReader.vue';
import SectionStorage from '@/components/settings/SectionStorage.vue';
import SectionSync from '@/components/settings/SectionSync.vue';
import SectionVideo from '@/components/settings/SectionVideo.vue';
import { isMobile, isHarmonyNative } from '@/composables/useEnv';
import { useNavigationStore, useBackStackStore } from '@/stores';

interface TabItem {
  id: string;
  label: string;
}

type MobileStage = 'menu' | 'detail';

const TABS = computed<TabItem[]>(() => {
  const base: TabItem[] = [
    { id: 'general', label: '通用' },
    { id: 'reader', label: '阅读偏好' },
    { id: 'video', label: '视频播放' },
    { id: 'network', label: '网络' },
    { id: 'sync', label: '同步' },
    { id: 'storage', label: '存储' },
    { id: 'advanced', label: '服务模式' },
    { id: 'developer', label: '开发设置' },
    { id: 'about', label: '关于' },
  ];
  // 鸿蒙端暂不支持 WebDAV 同步，隐藏同步标签页
  return isHarmonyNative ? base.filter((t) => t.id !== 'sync') : base;
});

const TAB_COMPONENTS = {
  general: SectionGeneral,
  reader: SectionReader,
  video: SectionVideo,
  network: SectionNetwork,
  sync: SectionSync,
  storage: SectionStorage,
  advanced: SectionAdvanced,
  developer: SectionDeveloper,
  about: SectionAbout,
} as const;

const navigationStore = useNavigationStore();
const { activeView } = storeToRefs(navigationStore);

const activeTab = ref<keyof typeof TAB_COMPONENTS>('general');
const mobileStage = ref<MobileStage>('menu');

const _backStack = useBackStackStore();
let _backHandler: (() => void) | null = null;

const activeSectionComponent = computed(() => TAB_COMPONENTS[activeTab.value]);
const activeTabIndex = computed(() => TABS.value.findIndex((tab) => tab.id === activeTab.value));
const activeTabLabel = computed(() => TABS.value[activeTabIndex.value]?.label ?? activeTab.value);
const isSettingsDetailActive = computed(
  () => isMobile.value && activeView.value === 'settings' && mobileStage.value === 'detail',
);

function selectTab(id: keyof typeof TAB_COMPONENTS) {
  activeTab.value = id;
  if (isMobile.value) {
    mobileStage.value = 'detail';
  }
}

function openMobileTab(id: string) {
  if (id in TAB_COMPONENTS) {
    selectTab(id as keyof typeof TAB_COMPONENTS);
  }
}

function showMobileMenu() {
  mobileStage.value = 'menu';
}

function activateHistoryGuard() {
  if (_backHandler) {
    return;
  }
  _backHandler = () => {
    _backHandler = null; // 自注销
    if (!isSettingsDetailActive.value) {
      return;
    }
    showMobileMenu();
  };
  _backStack.push(_backHandler);
}

function deactivateHistoryGuard(options?: { consume?: boolean }) {
  if (!_backHandler) {
    return;
  }
  const h = _backHandler;
  _backHandler = null;
  if (options?.consume === false) {
    _backStack.detach(h); // 不触发历史导航
  } else {
    _backStack.remove(h); // 消耗 history 记录
  }
}

function goBackFromDetail() {
  if (!isSettingsDetailActive.value) {
    return;
  }
  deactivateHistoryGuard({ consume: true });
  showMobileMenu();
}

function onMobileKeyDown(event: KeyboardEvent) {
  // BrowserBack / Escape 已由全局堆栈处理（App.vue 安装的 useFocusNavigation + popstate 监听器）
  // 此处仅处理尚未被全局捕获的情况（如使用 event.stopPropagation 的子组件）
  if (event.defaultPrevented) {
    return;
  }
  if (!isSettingsDetailActive.value) {
    return;
  }
  if (event.key === 'Escape' || event.key === 'BrowserBack') {
    event.preventDefault();
    goBackFromDetail();
  }
}

watch(isSettingsDetailActive, (enabled) => {
  if (enabled) {
    activateHistoryGuard();
    window.addEventListener('keydown', onMobileKeyDown);
    return;
  }
  window.removeEventListener('keydown', onMobileKeyDown);
  deactivateHistoryGuard({ consume: activeView.value !== 'settings' });
});

watch(
  () => isMobile.value,
  (mobile) => {
    if (!mobile) {
      mobileStage.value = 'menu';
    }
  },
);

watch(activeView, (view) => {
  if (view !== 'settings' && isMobile.value) {
    mobileStage.value = 'menu';
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onMobileKeyDown);
  if (_backHandler) {
    _backStack.detach(_backHandler);
    _backHandler = null;
  }
});
</script>

<template>
  <div class="settings-view" :class="{ 'settings-view--mobile': isMobile }">
    <template v-if="!isMobile">
      <AppPageHeader title="设置" :divider="true">
        <template #subtitle>统一管理应用行为、阅读偏好、网络、同步与调试相关配置</template>
      </AppPageHeader>

      <nav class="sv-tab-bar" role="tablist" aria-label="设置分类">
        <button
          v-for="tab in TABS"
          :key="tab.id"
          class="sv-tab focusable"
          :class="{ 'sv-tab--active': activeTab === tab.id }"
          role="tab"
          :aria-selected="activeTab === tab.id"
          :tabindex="activeTab === tab.id ? 0 : -1"
          @click="openMobileTab(tab.id)"
          @keydown.left.prevent="
            openMobileTab(TABS[Math.max(0, TABS.findIndex((t) => t.id === activeTab) - 1)].id)
          "
          @keydown.right.prevent="
            openMobileTab(
              TABS[Math.min(TABS.length - 1, TABS.findIndex((t) => t.id === activeTab) + 1)].id,
            )
          "
        >
          {{ tab.label }}
        </button>
      </nav>

      <div class="sv-panel app-scrollbar" role="tabpanel">
        <component :is="activeSectionComponent" />
      </div>
    </template>

    <template v-else>
      <div v-if="mobileStage === 'menu'" class="sv-mobile-menu-page">
        <AppPageHeader title="设置" :divider="true" class="">
          <template #subtitle>统一管理应用行为、阅读偏好、网络、同步与调试相关配置</template>
        </AppPageHeader>

        <nav class="sv-mobile-list" aria-label="设置分类列表">
          <button
            v-for="tab in TABS"
            :key="tab.id"
            class="sv-mobile-list__item focusable"
            @click="openMobileTab(tab.id)"
          >
            <span class="sv-mobile-list__label">{{ tab.label }}</span>
            <ChevronRight class="sv-mobile-list__arrow" :size="18" />
          </button>
        </nav>
      </div>

      <div v-else class="sv-mobile-detail-page">
        <header class="sv-mobile-detail-header">
          <button class="sv-mobile-detail-header__back focusable" @click="goBackFromDetail">
            <ChevronLeft :size="18" />
            <span>返回</span>
          </button>
          <div class="sv-mobile-detail-header__title">{{ activeTabLabel }}</div>
          <div class="sv-mobile-detail-header__placeholder" aria-hidden="true" />
        </header>

        <div class="sv-panel app-scrollbar sv-panel--mobile">
          <component :is="activeSectionComponent" />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.settings-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--color-bg-page, var(--color-bg));
}

.settings-view--mobile {
  background:
    radial-gradient(
      circle at top right,
      color-mix(in srgb, var(--color-accent) 8%, transparent),
      transparent 34%
    ),
    var(--color-bg-page, var(--color-bg));
}

.sv-tab-bar {
  flex-shrink: 0;
  display: flex;
  align-items: flex-end;
  gap: 0;
  padding: 0 var(--space-6);
  background: var(--color-surface, var(--color-bg));
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}

.sv-tab-bar::-webkit-scrollbar {
  display: none;
}

.sv-tab {
  flex-shrink: 0;
  padding: var(--space-3) var(--space-4);
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--color-text-soft);
  font-size: var(--fs-14);
  font-weight: var(--fw-medium);
  font-family: var(--font-ui);
  cursor: pointer;
  white-space: nowrap;
  transition:
    color var(--dur-fast) var(--ease-standard),
    border-color var(--dur-fast) var(--ease-standard);
  outline: none;
  position: relative;
  top: 1px;
}

@media (hover: hover) and (pointer: fine) {
  .sv-tab:hover {
    color: var(--color-text);
    background: var(--color-hover);
  }
}

.sv-tab--active {
  color: var(--color-accent);
  border-bottom-color: var(--color-accent);
  font-weight: var(--fw-semibold);
}

.sv-tab:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: -2px;
  border-radius: var(--radius-1);
}

.sv-panel {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: 28px;
  max-width: 860px;
}

.sv-mobile-menu-page,
.sv-mobile-detail-page {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.sv-mobile-list {
  margin-top: 30px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 var(--space-4) var(--space-4);
  overflow-y: auto;
}

.sv-mobile-list__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  width: 100%;
  min-height: 56px;
  padding: 0 var(--space-4);
  border: 1px solid color-mix(in srgb, var(--color-border) 82%, transparent);
  border-radius: 18px;
  background: color-mix(in srgb, var(--color-surface) 92%, transparent);
  color: var(--color-text);
  font-size: var(--fs-15);
  font-weight: var(--fw-medium);
  text-align: left;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.04);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  transition:
    transform var(--dur-fast) var(--ease-standard),
    background var(--dur-fast) var(--ease-standard),
    border-color var(--dur-fast) var(--ease-standard);
}

.sv-mobile-list__item:active {
  transform: scale(0.985);
  background: color-mix(in srgb, var(--color-accent-soft) 72%, var(--color-surface));
  border-color: color-mix(in srgb, var(--color-accent) 28%, var(--color-border));
}

.sv-mobile-list__label {
  min-width: 0;
}

.sv-mobile-list__arrow {
  flex-shrink: 0;
  color: var(--color-text-soft);
}

.sv-mobile-detail-header {
  position: sticky;
  top: 0;
  z-index: 2;
  display: grid;
  grid-template-columns: minmax(72px, auto) 1fr minmax(72px, auto);
  align-items: center;
  gap: var(--space-2);
  min-height: 52px;
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface) 94%, transparent);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.sv-mobile-detail-header__back {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-height: 40px;
  padding: 0 var(--space-2);
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--color-accent);
  font-size: var(--fs-14);
  font-weight: var(--fw-semibold);
  justify-self: start;
}

.sv-mobile-detail-header__title {
  min-width: 0;
  text-align: center;
  font-size: var(--fs-15);
  font-weight: var(--fw-semibold);
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sv-mobile-detail-header__placeholder {
  min-height: 40px;
}

.sv-panel--mobile {
  max-width: none;
  width: 100%;
  padding: var(--space-4);
}
</style>
