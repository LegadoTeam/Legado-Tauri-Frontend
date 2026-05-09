import { defineStore } from 'pinia';
import { useReaderSettings } from '@/features/reader/settings/useReaderSettings';

export const useReaderSettingsStore = defineStore('readerSettings', () => {
  return useReaderSettings();
});
