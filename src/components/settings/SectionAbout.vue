<script setup lang="ts">
import { isTauri, isMobile, envLabel, platform } from '@/composables/useEnv'
import SettingSection from './SettingSection.vue'
</script>

<template>
  <SettingSection title="关于" section-id="section-about">
    <div class="about-grid">
      <div class="about-item">
        <span class="about-label">运行环境</span>
        <n-tag size="small" :bordered="false">{{ envLabel }}</n-tag>
      </div>
      <div class="about-item">
        <span class="about-label">操作系统</span>
        <n-tag size="small" :bordered="false">{{ platform || '未知' }}</n-tag>
      </div>
      <div class="about-item">
        <span class="about-label">Tauri 原生壳</span>
        <n-tag size="small" :type="isTauri ? 'success' : 'default'" :bordered="false">
          {{ isTauri ? '是' : '否' }}
        </n-tag>
      </div>
      <div class="about-item">
        <span class="about-label">移动端</span>
        <n-tag size="small" :type="isMobile ? 'warning' : 'default'" :bordered="false">
          {{ isMobile ? '是' : '否' }}
        </n-tag>
      </div>
    </div>
  </SettingSection>
</template>

<style scoped>
.about-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 8px 0;
}

.about-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.about-label {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}
</style>
