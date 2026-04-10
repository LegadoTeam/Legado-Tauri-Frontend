<script setup lang="ts">
// 主内容区域容器，预留 router-view 接入点
</script>

<template>
  <main class="main-content">
    <slot />
  </main>
</template>

<style scoped>
.main-content {
  grid-area: main;
  overflow: hidden;
  background: var(--color-surface);
  display: flex;
  flex-direction: column;
  min-height: 0;
}
</style>
