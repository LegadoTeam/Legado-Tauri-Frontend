<script setup lang="ts">
// 主内容区域容器，预留 router-view 接入点
</script>

<template>
  <main id="main-content" class="main-content">
    <slot />
  </main>
</template>

<style scoped>
.main-content {
  grid-area: main;
  overflow: hidden;
  background-color: var(--color-content-bg, var(--color-surface));
  background-image: var(--content-bg-texture);
  /* background-color: #00000094; */
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-radius: 0;
  position: relative;
  /* 加入外阴用试试 */
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  /* margin-right: 2px; */
}

@media (min-width: 768px) {
  .main-content {
    border-radius: 20px;
  }
}
</style>
