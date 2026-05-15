import { isHarmonyNative, isTauri } from '@/composables/useEnv';
import { invokeWithTimeout } from '@/composables/useInvoke';

export interface ExportFileOptions {
  defaultName: string;
  mime: string;
  text?: string;
  bytes?: Uint8Array;
  filterName?: string;
  extensions?: string[];
}

export interface PickExportPathOptions {
  defaultName: string;
  filterName?: string;
  extensions?: string[];
}

function normalizeExtensions(options: ExportFileOptions | PickExportPathOptions): string[] {
  const fromName = options.defaultName.match(/\.([^.]+)$/)?.[1];
  return (options.extensions?.length ? options.extensions : fromName ? [fromName] : [])
    .map((ext) => ext.replace(/^\./, '').trim())
    .filter(Boolean);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function downloadInBrowser(options: ExportFileOptions): string {
  const blob = new Blob(
    options.bytes ? [options.bytes as unknown as BlobPart] : [options.text ?? ''],
    { type: options.mime },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = options.defaultName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return options.defaultName;
}

export async function saveExportFile(options: ExportFileOptions): Promise<string | null> {
  if (isHarmonyNative) {
    const saved = await invokeWithTimeout<string | null>(
      'export_save_file',
      {
        defaultName: options.defaultName,
        mime: options.mime,
        text: options.text ?? '',
        base64: options.bytes ? bytesToBase64(options.bytes) : '',
        extensions: normalizeExtensions(options),
      },
      60000,
    );
    return saved ?? null;
  }

  if (isTauri) {
    const [{ save }, fs] = await Promise.all([
      import('@tauri-apps/plugin-dialog'),
      import('@tauri-apps/plugin-fs'),
    ]);
    const extensions = normalizeExtensions(options);
    const target = await save({
      defaultPath: options.defaultName,
      filters: extensions.length
        ? [
            {
              name: options.filterName ?? extensions[0].toUpperCase(),
              extensions,
            },
          ]
        : undefined,
    });
    if (!target) {
      return null;
    }
    if (options.bytes) {
      await fs.writeFile(target, options.bytes);
    } else {
      await fs.writeTextFile(target, options.text ?? '');
    }
    return String(target);
  }

  return downloadInBrowser(options);
}

export async function pickExportPath(options: PickExportPathOptions): Promise<string | null> {
  if (isHarmonyNative) {
    const target = await invokeWithTimeout<string | null>(
      'bookshelf_pick_save_path',
      {
        defaultName: options.defaultName,
        filterName: options.filterName ?? '',
        filterExts: normalizeExtensions(options),
      },
      60000,
    );
    return target ?? null;
  }

  if (isTauri) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const extensions = normalizeExtensions(options);
    const target = await save({
      defaultPath: options.defaultName,
      filters: extensions.length
        ? [
            {
              name: options.filterName ?? extensions[0].toUpperCase(),
              extensions,
            },
          ]
        : undefined,
    });
    return target ? String(target) : null;
  }

  return null;
}

export async function writeExportFile(
  target: string,
  options: Pick<ExportFileOptions, 'text' | 'bytes'>,
): Promise<void> {
  if (isTauri) {
    const fs = await import('@tauri-apps/plugin-fs');
    if (options.bytes) {
      await fs.writeFile(target, options.bytes);
    } else {
      await fs.writeTextFile(target, options.text ?? '');
    }
    return;
  }
  throw new Error('当前环境不支持写入已选择的导出路径');
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
