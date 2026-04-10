<script setup lang="ts">
import { ref, computed, defineAsyncComponent, watch, reactive, onMounted, onUnmounted } from 'vue'
import { darkTheme, type GlobalTheme, type GlobalThemeOverrides } from 'naive-ui'
import { isMobile, setLayoutMode, isTauri, platform } from './composables/useEnv'
import { useAppConfig } from './composables/useAppConfig'
import { usePrivacyMode } from './composables/usePrivacyMode'
import { activeView } from './composables/useNavigation'
import TitleBar from './components/layout/TitleBar.vue'
import SideBar, { type NavItem } from './components/layout/SideBar.vue'
import TaskBar from './components/layout/TaskBar.vue'
import BottomNav from './components/layout/BottomNav.vue'
import MobileDebugFloat from './components/layout/MobileDebugFloat.vue'
import MainContent from './components/layout/MainContent.vue'
import ScriptDialog from './components/ScriptDialog.vue'

// ── 独立窗口模式检测 ──────────────────────────────────────────────────────
const urlParams = new URLSearchParams(window.location.search)
const windowView = urlParams.get('view')

const LogView = windowView === 'logs'
  ? defineAsyncComponent(() => import('./views/LogView.vue'))
  : null

// ── 主窗口视图 ───────────────────────────────────────────────────────────

const BookshelfView = defineAsyncComponent(() => import('./views/BookshelfView.vue'))
const ExploreView = defineAsyncComponent(() => import('./views/ExploreView.vue'))
const SearchView = defineAsyncComponent(() => import('./views/SearchView.vue'))
const BookSourceView = defineAsyncComponent(() => import('./views/BookSourceView.vue'))
const ExtensionsView = defineAsyncComponent(() => import('./views/ExtensionsView.vue'))
const SettingsView = defineAsyncComponent(() => import('./views/SettingsView.vue'))

const viewMap: Record<string, ReturnType<typeof defineAsyncComponent>> = {
  bookshelf: BookshelfView,
  explore: ExploreView,
  search: SearchView,
  booksource: BookSourceView,
  extensions: ExtensionsView,
  settings: SettingsView,
}

const sidebarCollapsed = ref(false)

/** 桌面端导航项 */
const desktopNavItems: NavItem[] = [
  { id: 'bookshelf', icon: 'bookshelf', label: '书架' },
  { id: 'explore', icon: 'explore', label: '发现' },
  { id: 'search', icon: 'search', label: '搜索' },
  { id: 'booksource', icon: 'booksource', label: '书源管理' },
  { id: 'extensions', icon: 'extensions', label: '插件管理' },
  { id: 'settings', icon: 'settings', label: '设置' },
]

/** 移动端底部导航项（精简六项） */
const mobileNavItems: NavItem[] = [
  { id: 'bookshelf', icon: 'bookshelf', label: '书架' },
  { id: 'explore', icon: 'explore', label: '发现' },
  { id: 'search', icon: 'search', label: '搜索' },
  { id: 'booksource', icon: 'booksource', label: '书源' },
  { id: 'extensions', icon: 'extensions', label: '扩展' },
  { id: 'settings', icon: 'settings', label: '设置' },
]

const navItems = computed(() => isMobile.value ? mobileNavItems : desktopNavItems)
const activeNavLabel = computed(() => navItems.value.find(n => n.id === activeView.value)?.label ?? '')

const currentView = computed(() => viewMap[activeView.value] ?? BookshelfView)

// ── 移动端视图缓存（惰性加载 + 保持挂载）──────────────────────────────────
const ALL_VIEW_IDS = Object.keys(viewMap)

/** 已被激活过的视图（v-if 为 true 后永不移除，实现 keep-alive） */
const mountedViews = reactive(new Set<string>([activeView.value]))

/** Suspense 已 resolve 的视图 */
const resolvedViews = reactive(new Set<string>())

/** 移动端加载遮罩状态 */
const showLoadingMask = ref(false)
let _maskMinElapsed = false
let _pendingViewId = ''
let _maskTimer: ReturnType<typeof setTimeout> | null = null

function onSuspenseResolve(viewId: string) {
  resolvedViews.add(viewId)
  if (showLoadingMask.value && viewId === _pendingViewId) {
    _pendingViewId = ''
    if (_maskMinElapsed) {
      showLoadingMask.value = false
    }
  }
}

watch(activeView, (newId) => {
  const alreadyMounted = mountedViews.has(newId)
  mountedViews.add(newId)

  // 移动端：首次加载该视图时显示全屏遮罩，强制最少显示 300ms
  if (isMobile.value && !alreadyMounted) {
    showLoadingMask.value = true
    _maskMinElapsed = false
    _pendingViewId = newId
    if (_maskTimer) clearTimeout(_maskTimer)
    _maskTimer = setTimeout(() => {
      _maskMinElapsed = true
      // 如果 Suspense 已经 resolve，现在才真正隐藏遮罩
      if (!_pendingViewId) {
        showLoadingMask.value = false
      }
    }, 300)
  }
})

/** Windows 桌面端即使强制手机布局，也保留完整标题栏（拖拽 + 窗口控制） */
const forceDesktopBar = computed(() => isTauri && platform === 'Windows')

// ── 布局模式同步 ─────────────────────────────────────────────────────────
const { config: appConfig, ensureLoaded: ensureAppConfig } = useAppConfig()
const { setupPrivacyModeAutoExit } = usePrivacyMode()
// ── 主题系统 ─────────────────────────────────────────────────────────────────
// 监听系统静态主题偏好
// 初始化时尝试读取，不支持的环境则回落false
const systemPrefersDark = ref(
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false
)

let _mq: MediaQueryList | null = null
function _onMqChange(e: MediaQueryListEvent) {
  systemPrefersDark.value = e.matches
}
onMounted(() => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    _mq = window.matchMedia('(prefers-color-scheme: dark)')
    _mq.addEventListener('change', _onMqChange)
  }
  setupPrivacyModeAutoExit()
})
onUnmounted(() => {
  _mq?.removeEventListener('change', _onMqChange)
})

/** 当前实际生效的暗/亮状态 */
const effectiveDark = computed(() => {
  const mode = appConfig.value.ui_theme ?? 'auto'
  if (mode === 'dark') return true
  if (mode === 'light') return false
  return systemPrefersDark.value
})

/** Naive UI 主题（null = 亮色） */
const naiveTheme = computed<GlobalTheme | null>(() =>
  effectiveDark.value ? darkTheme : null
)

const naiveThemeOverrides = computed<GlobalThemeOverrides>(() => {
  if (effectiveDark.value) {
    return {
      common: {
        primaryColor: '#818cf8',
        primaryColorHover: '#96a0ff',
        primaryColorPressed: '#707af1',
        primaryColorSuppl: '#818cf8',
        infoColor: '#818cf8',
        successColor: '#4ade80',
        warningColor: '#fbbf24',
        errorColor: '#f87171',
        bodyColor: '#18181b',
        cardColor: '#27272a',
        modalColor: '#27272a',
        popoverColor: '#27272a',
        tableColor: '#27272a',
        dividerColor: '#3f3f46',
        borderColor: '#3f3f46',
        inputColor: '#27272a',
        actionColor: '#3f3f46',
        hoverColor: 'rgba(255, 255, 255, 0.06)',
        textColorBase: '#fafafa',
        textColor1: '#fafafa',
        textColor2: '#a1a1aa',
        textColor3: '#71717a',
      },
    }
  }

  return {
    common: {
      primaryColor: '#6366f1',
      primaryColorHover: '#5558ee',
      primaryColorPressed: '#4f46e5',
      primaryColorSuppl: '#6366f1',
      infoColor: '#6366f1',
      successColor: '#22c55e',
      warningColor: '#f59e0b',
      errorColor: '#ef4444',
      bodyColor: '#f4f4f5',
      cardColor: '#ffffff',
      modalColor: '#ffffff',
      popoverColor: '#ffffff',
      tableColor: '#ffffff',
      dividerColor: '#e4e4e7',
      borderColor: '#e4e4e7',
      inputColor: '#ffffff',
      actionColor: '#eef2ff',
      hoverColor: 'rgba(99, 102, 241, 0.08)',
      textColorBase: '#18181b',
      textColor1: '#18181b',
      textColor2: '#52525b',
      textColor3: '#71717a',
    },
  }
})

// 将 data-theme 属性同步到 <html>️元素，驱动 CSS 变量
watch(
  () => appConfig.value.ui_theme,
  (mode) => {
    document.documentElement.setAttribute('data-theme', mode ?? 'auto')
  },
  { immediate: true }
)
ensureAppConfig().then(() => setLayoutMode(appConfig.value.ui_layout_mode))
watch(() => appConfig.value.ui_layout_mode, (mode) => setLayoutMode(mode))

function onNavSelect(id: string) {
  activeView.value = id
}
</script>

<template>
  <n-config-provider :theme="naiveTheme" :theme-overrides="naiveThemeOverrides">
    <n-message-provider>
      <n-dialog-provider>
        <!-- 独立窗口模式：日志查看器 -->
        <template v-if="LogView">
          <Suspense>
            <component :is="LogView" />
            <template #fallback>
              <div class="view-loading">加载中…</div>
            </template>
          </Suspense>
        </template>

        <!-- 主窗口布局 -->
        <template v-else>
          <div class="app-layout"
            :class="{ 'app-layout--mobile': isMobile, 'app-layout--mobile-desktop-bar': isMobile && forceDesktopBar }">
            <TitleBar :title="isMobile ? activeNavLabel : 'Legado'" />
            <SideBar v-if="!isMobile" :items="navItems" :active-id="activeView" v-model:collapsed="sidebarCollapsed"
              @select="onNavSelect" />
            <MainContent>
              <!-- 移动端：惰性加载 + v-show 缓存，首次加载后永不卸载 -->
              <template v-if="isMobile">
                <template v-for="viewId in ALL_VIEW_IDS" :key="viewId">
                  <div v-if="mountedViews.has(viewId)" v-show="activeView === viewId" class="view-cache-wrapper">
                    <Suspense @resolve="onSuspenseResolve(viewId)">
                      <component :is="viewMap[viewId]" />
                      <template #fallback>
                        <div class="view-loading">加载中…</div>
                      </template>
                    </Suspense>
                  </div>
                </template>
              </template>
              <!-- 桌面端：原有行为 -->
              <template v-else>
                <Suspense>
                  <component :is="currentView" />
                  <template #fallback>
                    <div class="view-loading">加载中…</div>
                  </template>
                </Suspense>
              </template>
            </MainContent>
            <TaskBar v-if="!isMobile" :status-text="activeNavLabel" />
            <BottomNav v-if="isMobile" :items="navItems" :active-id="activeView" @select="onNavSelect" />
          </div>
          <MobileDebugFloat v-if="isMobile && appConfig.ui_show_debug_float" />
          <!-- 移动端视图首次加载全屏遮罩（强制最少显示 300ms）-->
          <Transition name="mask-fade">
            <div v-if="showLoadingMask" class="view-loading-mask">
              <n-spin size="large" />
            </div>
          </Transition>
          <!-- 全局脚本交互弹窗：响应 Boa 引擎 legado.ui.emit / script_dialog_open -->
          <ScriptDialog />
        </template>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<style scoped>
/* 移动端视图缓存容器：flex:1 确保占满高度，隐藏时 display:none 不占空间 */
.view-cache-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

/* 全屏加载遮罩 */
.view-loading-mask {
  position: fixed;
  inset: 0;
  z-index: 9000;
  background: var(--color-sidebar-bg);
  display: flex;
  align-items: center;
  justify-content: center;
}

.mask-fade-enter-active,
.mask-fade-leave-active {
  transition: opacity 0.15s ease;
}

.mask-fade-enter-from,
.mask-fade-leave-to {
  opacity: 0;
}

.app-layout {
  display: grid;
  grid-template-areas:
    "title   title"
    "sidebar main"
    "taskbar taskbar";
  grid-template-rows: var(--titlebar-h) 1fr var(--taskbar-h);
  grid-template-columns: var(--sidebar-w) 1fr;
  height: 100vh;
  transition: grid-template-columns var(--transition-base);
}

/* 菜单栏收起时同步收缩 grid 列宽 */
.app-layout:has(.side-bar--collapsed) {
  grid-template-columns: var(--sidebar-collapsed-w) 1fr;
}

/* 移动端：单列布局，顶栏（状态栏避让）+ 内容 + 底部导航 */
.app-layout--mobile {
  grid-template-areas:
    "title"
    "main"
    "bottomnav";
  grid-template-rows: env(safe-area-inset-top, 0px) 1fr calc(var(--bottomnav-h) + env(safe-area-inset-bottom, 0px));
  grid-template-columns: 1fr;
}

/* Windows 强制手机布局时：顶栏行用固定高度（用于拖拽/窗口控制），底部导航保留正常高度 */
.app-layout--mobile-desktop-bar {
  grid-template-rows: var(--titlebar-h) 1fr var(--bottomnav-h);
}

.placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.view-loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  font-size: 0.875rem;
}
</style>
