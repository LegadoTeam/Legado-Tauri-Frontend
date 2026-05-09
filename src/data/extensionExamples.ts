import { parseUserScriptMeta, type ExtensionMeta } from '../composables/useExtension';
import wordCounterSource from './pluginExamples/reader-word-counter.js?raw';
import autoThemeSource from './pluginExamples/reader-auto-theme.js?raw';
import exportNotesSource from './pluginExamples/bookshelf-export-notes.js?raw';
import customInjectSource from './pluginExamples/reader-custom-inject.js?raw';
import communityCoverPackSource from './pluginExamples/bookshelf-community-cover-pack.js?raw';
import coverStudioSource from './pluginExamples/bookshelf-cover-studio.js?raw';
import openLibraryEnricherSource from './pluginExamples/bookshelf-openlibrary-enricher.js?raw';
import adCleanerSource from './pluginExamples/reader-ad-cleaner.js?raw';
import nightPackSource from './pluginExamples/reader-background-night-pack.js?raw';
import paperPackSource from './pluginExamples/reader-background-paper-pack.js?raw';
import chineseConverterSource from './pluginExamples/reader-chinese-converter.js?raw';
import customBackgroundSource from './pluginExamples/reader-custom-backgrounds.js?raw';
import customThemeSource from './pluginExamples/reader-custom-color-theme.js?raw';
import disguiseSkinsSource from './pluginExamples/reader-disguise-skins.js?raw';
import splitterSource from './pluginExamples/reader-paragraph-splitter.js?raw';
import progressSource from './pluginExamples/reader-progress-badge.js?raw';
import topProgressBarSource from './pluginExamples/reader-top-progress-bar.js?raw';
import textReplacerSource from './pluginExamples/reader-text-replacer.js?raw';
import selectionToolsSource from './pluginExamples/reader-selection-tools.js?raw';
import blueThemeSource from './pluginExamples/reader-theme-blue-ocean.js?raw';
import timerSource from './pluginExamples/reader-timer.js?raw';

export interface ExampleScript {
  id: string;
  source: string;
  meta: Partial<ExtensionMeta>;
}

function make(id: string, source: string): ExampleScript {
  return { id, source, meta: parseUserScriptMeta(source) };
}

export const EXAMPLE_SCRIPTS: ExampleScript[] = [
  make('filter', adCleanerSource),
  make('replace', textReplacerSource),
  make('selection-tools', selectionToolsSource),
  make('timer', timerSource),
  make('progress', progressSource),
  make('top-progress-bar', topProgressBarSource),
  make('split', splitterSource),
  make('custom-theme', customThemeSource),
  make('custom-background', customBackgroundSource),
  make('disguise-skins', disguiseSkinsSource),
  make('blue-theme', blueThemeSource),
  make('paper-pack', paperPackSource),
  make('night-pack', nightPackSource),
  make('chinese-converter', chineseConverterSource),
  make('bookshelf-openlibrary', openLibraryEnricherSource),
  make('bookshelf-cover-studio', coverStudioSource),
  make('community-cover-pack', communityCoverPackSource),
  make('word-counter', wordCounterSource),
  make('auto-theme', autoThemeSource),
  make('export-notes', exportNotesSource),
  make('custom-inject', customInjectSource),
];
