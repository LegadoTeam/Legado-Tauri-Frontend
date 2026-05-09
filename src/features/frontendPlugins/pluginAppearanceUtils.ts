import type { ReaderAppearancePatch } from './pluginTypes';

export function applyAppearancePatchVars(
  target: Record<string, string>,
  patch: ReaderAppearancePatch | null | undefined,
): void {
  if (!patch || typeof patch !== 'object') {
    return;
  }
  if (patch.backgroundColor) {
    target['--reader-bg-color'] = patch.backgroundColor;
  }
  if (patch.backgroundImage) {
    target['--reader-bg-image'] = patch.backgroundImage;
  }
  if (patch.backgroundSize) {
    target['--reader-bg-size'] = patch.backgroundSize;
  }
  if (patch.backgroundPosition) {
    target['--reader-bg-position'] = patch.backgroundPosition;
  }
  if (patch.backgroundRepeat) {
    target['--reader-bg-repeat'] = patch.backgroundRepeat;
  }
  if (patch.backgroundAttachment) {
    target['--reader-bg-attachment'] = patch.backgroundAttachment;
  }
  if (patch.backgroundBlendMode) {
    target['--reader-bg-blend-mode'] = patch.backgroundBlendMode;
  }
  if (patch.textColor) {
    target['--reader-text-color'] = patch.textColor;
  }
  if (patch.selectionColor) {
    target['--reader-selection-color'] = patch.selectionColor;
  }
  Object.assign(target, patch.styleVars ?? {});
}
