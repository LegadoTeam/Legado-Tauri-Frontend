import type { ReaderPluginSlot, ReaderSlotMount } from './pluginTypes';
export type { ReaderPluginSlot } from './types';

export const SUPPORTED_READER_PLUGIN_SLOTS: ReaderPluginSlot[] = [
  'background',
  'overlay-top-left',
  'overlay-top-right',
  'overlay-bottom-left',
  'overlay-bottom-right',
];

export function createEmptySlotMap(): Record<ReaderPluginSlot, ReaderSlotMount[]> {
  return {
    background: [],
    'overlay-top-left': [],
    'overlay-top-right': [],
    'overlay-bottom-left': [],
    'overlay-bottom-right': [],
  };
}
