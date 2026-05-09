import type { PluginDialogOptions, PluginDialogState, PluginSettingValue } from './pluginTypes';

export function buildPluginDialogState(options: PluginDialogOptions): PluginDialogState {
  const values: Record<string, PluginSettingValue> = { ...(options.initialValues ?? {}) };
  for (const field of options.fields) {
    if (!field.key || values[field.key] !== undefined) {
      continue;
    }
    if (field.type === 'switch') {
      values[field.key] = false;
    } else if (field.type === 'string-list') {
      values[field.key] = [];
    } else if (field.type === 'number' || field.type === 'slider') {
      values[field.key] = field.min ?? 0;
    } else {
      values[field.key] = '';
    }
  }
  return {
    title: options.title.trim(),
    message: options.message?.trim() ?? '',
    submitText: options.submitText?.trim() || '确定',
    cancelText: options.cancelText?.trim() || '取消',
    width: options.width ?? 560,
    fields: options.fields,
    values,
  };
}

export function isEntryVisible(
  entry: { visible?: boolean | ((context: any) => boolean) },
  context: unknown,
): boolean {
  if (typeof entry.visible === 'function') {
    return entry.visible(context);
  }
  return entry.visible ?? true;
}
