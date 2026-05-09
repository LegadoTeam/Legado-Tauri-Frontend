export type {
  PluginDialogOptions,
  PluginDialogState,
  PluginSettingField,
  PluginSettingsContext,
  PluginSettingValue,
  ResolvedPluginSettingField,
} from './types';

import type {
  PluginDynamicText,
  PluginSettingField,
  PluginSettingsContext,
  ResolvedPluginSettingField,
} from './types';

function resolveDynamicText(
  value: PluginDynamicText | undefined,
  context: PluginSettingsContext,
): string {
  if (!value) {
    return '';
  }
  return typeof value === 'function' ? value(context) : value;
}

function resolveDynamicBoolean(
  value: boolean | ((context: PluginSettingsContext) => boolean) | undefined,
  context: PluginSettingsContext,
): boolean {
  if (typeof value === 'function') {
    return value(context);
  }
  return value ?? false;
}

export async function resolvePluginSettingFields(
  rawSchema: PluginSettingField[] | ((context: PluginSettingsContext) => PluginSettingField[] | Promise<PluginSettingField[]>),
  context: PluginSettingsContext,
): Promise<ResolvedPluginSettingField[]> {
  const rawFields = typeof rawSchema === 'function' ? await rawSchema(context) : rawSchema;
  return rawFields
    .filter((field) => !resolveDynamicBoolean(field.hidden, context))
    .map((field) => {
      const options =
        typeof field.options === 'function' ? field.options(context) : (field.options ?? []);
      return {
        type: field.type,
        key: field.key,
        label: resolveDynamicText(field.label, context),
        description: resolveDynamicText(field.description, context),
        placeholder: resolveDynamicText(field.placeholder, context),
        disabled: resolveDynamicBoolean(field.disabled, context),
        min: field.min,
        max: field.max,
        step: field.step,
        rows: field.rows,
        options: options.map((option) => ({
          label: resolveDynamicText(option.label, context),
          value: option.value,
          description: resolveDynamicText(option.description, context),
        })),
      } satisfies ResolvedPluginSettingField;
    });
}
