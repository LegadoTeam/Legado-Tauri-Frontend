<script setup lang="ts">
import { useMessage } from 'naive-ui';
import { computed, reactive, watch } from 'vue';
import { useFrontendPlugins, type PluginSettingValue } from '@/composables/useFrontendPlugins';
import { useOverlayBackstack } from '@/composables/useOverlayBackstack';

const message = useMessage();
const { pluginDialog, resolvePluginDialog } = useFrontendPlugins();

const visible = computed(() => !!pluginDialog.value);
const draftValues = reactive<Record<string, PluginSettingValue>>({});

useOverlayBackstack(() => visible.value, closeDialog);

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

watch(
  pluginDialog,
  (next) => {
    for (const key of Object.keys(draftValues)) {
      delete draftValues[key];
    }
    if (!next) {
      return;
    }
    Object.assign(draftValues, cloneValue(next.values));
  },
  { immediate: true },
);

function getString(key: string): string {
  const value = draftValues[key];
  return typeof value === 'string' ? value : '';
}

function getNumber(key: string): number {
  const value = draftValues[key];
  return typeof value === 'number' ? value : 0;
}

function getBoolean(key: string): boolean {
  return draftValues[key] === true;
}

function getScalar(key: string): string | number | null {
  const value = draftValues[key];
  return typeof value === 'string' || typeof value === 'number' ? value : null;
}

function getStringList(key: string): string {
  const value = draftValues[key];
  return Array.isArray(value) ? value.join('\n') : '';
}

function updateValue(key: string | undefined, value: PluginSettingValue): void {
  if (!key) {
    return;
  }
  draftValues[key] = value;
}

function validate(): boolean {
  if (!pluginDialog.value) {
    return false;
  }
  for (const field of pluginDialog.value.fields) {
    if (!field.key || !field.required) {
      continue;
    }
    const value = draftValues[field.key];
    const empty =
      value === undefined ||
      value === null ||
      value === '' ||
      (Array.isArray(value) && value.length === 0);
    if (empty) {
      message.warning(`${field.label || field.key} 不能为空`);
      return false;
    }
  }
  return true;
}

function closeDialog(): void {
  resolvePluginDialog(null);
}

function submitDialog(): void {
  if (!validate()) {
    return;
  }
  resolvePluginDialog(cloneValue(draftValues));
}

function handleVisibleChange(next: boolean): void {
  if (!next) {
    closeDialog();
  }
}
</script>

<template>
  <n-modal
    :show="visible"
    :mask-closable="true"
    preset="card"
    :style="{ width: `${pluginDialog?.width ?? 560}px`, maxWidth: 'calc(100vw - 32px)' }"
    @update:show="handleVisibleChange"
  >
    <template v-if="pluginDialog">
      <div class="plugin-dialog">
        <div class="plugin-dialog__header">
          <h3 class="plugin-dialog__title">{{ pluginDialog.title }}</h3>
          <p v-if="pluginDialog.message" class="plugin-dialog__message">
            {{ pluginDialog.message }}
          </p>
        </div>

        <div class="plugin-dialog__body">
          <template
            v-for="field in pluginDialog.fields"
            :key="field.key || field.label || field.type"
          >
            <n-divider v-if="field.type === 'divider'" style="margin: 8px 0" />

            <n-alert
              v-else-if="field.type === 'info'"
              type="info"
              :title="field.label || '说明'"
              :bordered="false"
            >
              {{ field.description || field.placeholder || '' }}
            </n-alert>

            <n-form-item
              v-else
              :label="field.label || field.key || field.type"
              :feedback="field.description || ''"
            >
              <n-input
                v-if="field.type === 'text' || field.type === 'password'"
                :type="field.type"
                :value="getString(field.key || '')"
                :placeholder="field.placeholder || ''"
                :disabled="field.disabled"
                @update:value="(value: string) => updateValue(field.key, value)"
              />

              <n-input
                v-else-if="field.type === 'textarea'"
                type="textarea"
                :value="getString(field.key || '')"
                :placeholder="field.placeholder || ''"
                :disabled="field.disabled"
                :rows="field.rows ?? 5"
                @update:value="(value: string) => updateValue(field.key, value)"
              />

              <n-input-number
                v-else-if="field.type === 'number'"
                :value="getNumber(field.key || '')"
                :min="field.min"
                :max="field.max"
                :step="field.step"
                :disabled="field.disabled"
                style="width: 100%"
                @update:value="(value: number | null) => updateValue(field.key, value ?? 0)"
              />

              <n-switch
                v-else-if="field.type === 'switch'"
                :value="getBoolean(field.key || '')"
                :disabled="field.disabled"
                @update:value="(value: boolean) => updateValue(field.key, value)"
              />

              <n-select
                v-else-if="field.type === 'select'"
                :value="getScalar(field.key || '')"
                :options="field.options ?? []"
                :disabled="field.disabled"
                @update:value="
                  (value: string | number | null) => updateValue(field.key, value ?? '')
                "
              />

              <n-radio-group
                v-else-if="field.type === 'radio'"
                :value="getScalar(field.key || '')"
                :disabled="field.disabled"
                @update:value="(value: string | number) => updateValue(field.key, value)"
              >
                <n-space vertical>
                  <n-radio
                    v-for="option in field.options ?? []"
                    :key="String(option.value)"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </n-radio>
                </n-space>
              </n-radio-group>

              <n-color-picker
                v-else-if="field.type === 'color'"
                :value="getString(field.key || '')"
                :disabled="field.disabled"
                @update:value="(value: string) => updateValue(field.key, value)"
              />

              <n-slider
                v-else-if="field.type === 'slider'"
                :value="getNumber(field.key || '')"
                :min="field.min ?? 0"
                :max="field.max ?? 100"
                :step="field.step ?? 1"
                :disabled="field.disabled"
                @update:value="(value: number) => updateValue(field.key, value)"
              />

              <n-input
                v-else-if="field.type === 'string-list'"
                type="textarea"
                :value="getStringList(field.key || '')"
                :placeholder="field.placeholder || '每行一项'"
                :disabled="field.disabled"
                :rows="field.rows ?? 5"
                @update:value="
                  (value: string) =>
                    updateValue(
                      field.key,
                      value
                        .split('\n')
                        .map((item) => item.trim())
                        .filter(Boolean),
                    )
                "
              />
            </n-form-item>
          </template>
        </div>

        <div class="plugin-dialog__footer">
          <n-button quaternary @click="closeDialog">{{ pluginDialog.cancelText }}</n-button>
          <n-button type="primary" @click="submitDialog">{{ pluginDialog.submitText }}</n-button>
        </div>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
.plugin-dialog {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.plugin-dialog__header {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.plugin-dialog__title {
  margin: 0;
  font-size: 1.05rem;
  color: var(--color-text-primary);
}

.plugin-dialog__message {
  margin: 0;
  color: var(--color-text-secondary);
  line-height: 1.6;
  white-space: pre-wrap;
}

.plugin-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.plugin-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
