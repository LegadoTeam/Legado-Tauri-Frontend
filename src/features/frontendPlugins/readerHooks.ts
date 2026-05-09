import type {
  FrontendPluginHookName,
  PluginHookHandler,
} from './pluginTypes';
export type {
  FrontendPluginHookName,
  ReaderContentHookStage,
  ReaderContentPayload,
  ReaderLifecycleHook,
  ReaderSessionSnapshot,
} from './types';

export const SUPPORTED_FRONTEND_PLUGIN_HOOKS: FrontendPluginHookName[] = [
  'reader.content.raw',
  'reader.content.cleaned',
  'reader.content.beforePaginate',
  'reader.content.beforeRender',
  'reader.session.enter',
  'reader.session.exit',
  'reader.session.pause',
  'reader.session.resume',
  'reader.chapter.change',
];

export function createEmptyHookMap(): Record<FrontendPluginHookName, PluginHookHandler[]> {
  return {
    'reader.content.raw': [],
    'reader.content.cleaned': [],
    'reader.content.beforePaginate': [],
    'reader.content.beforeRender': [],
    'reader.session.enter': [],
    'reader.session.exit': [],
    'reader.session.pause': [],
    'reader.session.resume': [],
    'reader.chapter.change': [],
  };
}
