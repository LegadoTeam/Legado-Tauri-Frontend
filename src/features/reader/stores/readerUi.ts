import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useReaderUiStore = defineStore('readerUi', () => {
  const showMenu = ref(false);
  const showToc = ref(false);
  const settingsVisible = ref(false);
  const showTtsBar = ref(false);
  const showSourceSwitchDialog = ref(false);
  const sourceSwitchMode = ref<'whole-book' | 'chapter-temp'>('whole-book');
  const menuOpenTime = ref(0);

  function resetLayers() {
    showMenu.value = false;
    showToc.value = false;
    settingsVisible.value = false;
    showSourceSwitchDialog.value = false;
    sourceSwitchMode.value = 'whole-book';
    menuOpenTime.value = 0;
  }

  function openMenu() {
    showMenu.value = true;
    menuOpenTime.value = Date.now();
  }

  function closeMenu() {
    showMenu.value = false;
    settingsVisible.value = false;
  }

  function openToc() {
    settingsVisible.value = false;
    showToc.value = true;
    showMenu.value = false;
  }

  function closeToc() {
    showToc.value = false;
  }

  function openSourceSwitch(mode: 'whole-book' | 'chapter-temp') {
    sourceSwitchMode.value = mode;
    showSourceSwitchDialog.value = true;
  }

  return {
    showMenu,
    showToc,
    settingsVisible,
    showTtsBar,
    showSourceSwitchDialog,
    sourceSwitchMode,
    menuOpenTime,
    resetLayers,
    openMenu,
    closeMenu,
    openToc,
    closeToc,
    openSourceSwitch,
  };
});
