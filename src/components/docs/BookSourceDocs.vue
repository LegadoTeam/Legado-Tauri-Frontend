<script setup lang="ts">
/**
 * BookSourceDocs — 书源开发文档
 *
 * 章节元数据维护在 sections.ts，代码示例单独存于 examples/*.js。
 * 通过 Vite import.meta.glob ?raw 在构建时将 JS 文件内容内联为字符串。
 */

import { ref, computed } from 'vue'
import { sections } from './sections'

// ── 加载所有示例文件（Vite ?raw glob）────────────────────────────
const codeFiles = import.meta.glob('./examples/*.js', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

function getCode(codeFile: string): string {
  return codeFiles[`./examples/${codeFile}`] ?? `// 示例文件 "${codeFile}" 未找到`
}

// ── 响应式状态 ────────────────────────────────────────────────────

const activeSectionId = ref(sections[0].id)

const activeSection = computed(
  () => sections.find(s => s.id === activeSectionId.value) ?? sections[0]
)

const activeCode = computed(() => getCode(activeSection.value.codeFile))

// ── 复制代码 ──────────────────────────────────────────────────────

const copied = ref(false)

async function copyCode() {
  await navigator.clipboard.writeText(activeCode.value)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}
</script>

<template>
  <div class="bsd-root">
    <!-- 左侧章节导航 -->
    <nav class="bsd-nav">
      <div
        v-for="sec in sections"
        :key="sec.id"
        class="bsd-nav__item"
        :class="{ 'bsd-nav__item--active': sec.id === activeSectionId }"
        @click="activeSectionId = sec.id"
      >
        <span class="bsd-nav__title">{{ sec.title }}</span>
        <n-tag
          v-if="sec.badge"
          :type="sec.badgeType ?? 'default'"
          size="tiny"
          :bordered="false"
          class="bsd-nav__badge"
        >{{ sec.badge }}</n-tag>
      </div>
    </nav>

    <!-- 右侧内容 -->
    <div class="bsd-content">
      <!-- 章节标题 + 说明 -->
      <div class="bsd-content__header">
        <div class="bsd-content__title-row">
          <code class="bsd-content__title">{{ activeSection.title }}</code>
          <n-tag
            v-if="activeSection.badge"
            :type="activeSection.badgeType ?? 'default'"
            size="small"
            :bordered="false"
          >{{ activeSection.badge }}</n-tag>
        </div>
        <p
          v-for="(line, i) in activeSection.desc.split('\n')"
          :key="i"
          class="bsd-content__desc"
        >{{ line }}</p>
      </div>

      <!-- 代码展示区 -->
      <div class="bsd-editor-wrap">
        <n-button
          size="tiny"
          class="bsd-copy-btn"
          :type="copied ? 'success' : 'default'"
          @click="copyCode"
        >{{ copied ? '已复制！' : '复制代码' }}</n-button>

        <pre class="bsd-code"><code>{{ activeCode }}</code></pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bsd-root {
  display: flex;
  height: 100%;
  overflow: hidden;
}

/* ── 左侧导航 ── */
.bsd-nav {
  width: 260px;
  flex-shrink: 0;
  overflow-y: auto;
  padding: 8px 6px;
  border-right: 1px solid var(--color-border, #3f3f46);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.bsd-nav__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  padding: 5px 8px;
  border-radius: 5px;
  cursor: pointer;
  user-select: none;
  transition: background var(--transition-fast, 0.15s), color var(--transition-fast, 0.15s);
  color: var(--color-text-muted, #a1a1aa);
}
.bsd-nav__item:hover {
  background: var(--color-surface-raised, #27272a);
  color: var(--color-text-primary, #e4e4e7);
}
.bsd-nav__item--active {
  background: rgba(99, 102, 241, 0.15);
  color: var(--color-accent, #818cf8);
}
.bsd-nav__title {
  font-size: 0.8rem;
  font-family: 'Cascadia Code', Consolas, monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}
.bsd-nav__badge { flex-shrink: 0; }

/* ── 右侧内容 ── */
.bsd-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.bsd-content__header {
  padding: 12px 18px 10px;
  border-bottom: 1px solid var(--color-border, #3f3f46);
  flex-shrink: 0;
}
.bsd-content__title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 5px;
}
.bsd-content__title {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-accent, #818cf8);
  font-family: 'Cascadia Code', Consolas, monospace;
  background: var(--color-surface-raised, #27272a);
  padding: 2px 8px;
  border-radius: 4px;
}
.bsd-content__desc {
  font-size: 0.81rem;
  color: var(--color-text-secondary, #a1a1aa);
  line-height: 1.6;
  margin: 0;
  min-height: 1em;
}

/* ── 代码展示区 ── */
.bsd-editor-wrap {
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: auto;
}
.bsd-code {
  margin: 0;
  padding: 12px 16px;
  font-family: 'Cascadia Code', 'JetBrains Mono', Consolas, monospace;
  font-size: 13px;
  line-height: 1.6;
  tab-size: 2;
  color: #d4d4d8;
  background: #18181b;
  white-space: pre;
  word-wrap: normal;
  min-height: 100%;
}
.bsd-code code {
  font-family: inherit;
  font-size: inherit;
}

.bsd-copy-btn {
  position: absolute;
  top: 10px;
  right: 18px;
  z-index: 10;
  opacity: 0.7;
  transition: opacity 0.15s;
}
.bsd-copy-btn:hover { opacity: 1; }
</style>
