/**
 * useUserFonts — 用户上传字体管理
 *
 * 提供用户自定义字体的增删改查功能，并自动向文档注入 @font-face CSS。
 * - Tauri 端：通过 asset:// 协议访问字体文件；使用 invoke 上传字节
 * - 浏览器端：通过 HTTP /api/user-fonts/data?id= 访问；使用 fetch POST 上传
 */

import { ref, type Ref } from 'vue';
import { isTauri } from './useEnv';
import { toFileSrcSync } from './useFileSrc';
import { invokeWithTimeout } from './useInvoke';

export interface UserFontMeta {
  id: string;
  filePath: string;
  familyName: string;
  displayName: string;
  uploadedAt: number;
}

const userFonts = ref<UserFontMeta[]>([]);
const userFontsLoaded = ref(false);
const uploading = ref(false);
const uploadError = ref('');

function buildFontUrl(meta: UserFontMeta): string {
  if (isTauri) {
    return toFileSrcSync(meta.filePath);
  }
  return `/api/user-fonts/data?id=${encodeURIComponent(meta.id)}`;
}

/** 注入/更新文档中的 @font-face CSS（针对用户上传字体） */
function injectUserFontFaces(fonts: UserFontMeta[]) {
  const styleId = 'legado-user-font-faces';
  let el = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = styleId;
    document.head.appendChild(el);
  }
  el.textContent = fonts
    .map(
      (f) =>
        `@font-face { font-family: "${f.displayName.replace(/"/g, '\\"')}"; src: url("${buildFontUrl(f)}"); font-display: block; }`,
    )
    .join('\n');
}

export function useUserFonts() {
  /** 加载用户上传字体列表并注入 @font-face */
  async function loadUserFonts() {
    const result = await invokeWithTimeout<UserFontMeta[]>('list_user_fonts', {}, 10000);
    userFonts.value = result;
    userFontsLoaded.value = true;
    injectUserFontFaces(result);
  }

  /**
   * 上传字体文件
   * - Tauri：将 File 读为 Uint8Array 后通过 invoke 传字节
   * - 浏览器：使用 fetch POST 二进制流，避免 WS JSON 开销
   */
  async function uploadFont(file: File): Promise<UserFontMeta> {
    uploading.value = true;
    uploadError.value = '';
    try {
      let meta: UserFontMeta;
      if (isTauri) {
        const buffer = await file.arrayBuffer();
        const data = Array.from(new Uint8Array(buffer));
        meta = await invokeWithTimeout<UserFontMeta>(
          'upload_user_font',
          { fileName: file.name, data },
          30000,
        );
      } else {
        const resp = await fetch(
          `/api/user-fonts/upload?name=${encodeURIComponent(file.name)}`,
          { method: 'POST', body: file },
        );
        if (!resp.ok) {
          throw new Error(await resp.text());
        }
        meta = (await resp.json()) as UserFontMeta;
      }
      // 更新本地列表（去重后追加）
      userFonts.value = [...userFonts.value.filter((f) => f.id !== meta.id), meta];
      injectUserFontFaces(userFonts.value);
      return meta;
    } catch (e) {
      uploadError.value = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
      uploading.value = false;
    }
  }

  /** 删除用户字体 */
  async function deleteUserFont(id: string): Promise<void> {
    await invokeWithTimeout<void>('delete_user_font', { id }, 10000);
    userFonts.value = userFonts.value.filter((f) => f.id !== id);
    injectUserFontFaces(userFonts.value);
  }

  /** 修改字体显示名称 */
  async function renameUserFont(id: string, displayName: string): Promise<void> {
    await invokeWithTimeout<void>('rename_user_font', { id, displayName }, 10000);
    const idx = userFonts.value.findIndex((f) => f.id === id);
    if (idx !== -1) {
      userFonts.value[idx] = { ...userFonts.value[idx], displayName };
      injectUserFontFaces(userFonts.value);
    }
  }

  return {
    userFonts: userFonts as Ref<UserFontMeta[]>,
    userFontsLoaded,
    uploading,
    uploadError,
    loadUserFonts,
    uploadFont,
    deleteUserFont,
    renameUserFont,
  };
}
