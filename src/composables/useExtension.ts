import { invokeWithTimeout } from './useInvoke';

// ── 类型定义 ──────────────────────────────────────────────────────────────

export interface ExtensionMeta {
  fileName: string;
  name: string;
  namespace: string;
  version: string;
  description: string;
  author: string;
  /** @match / @include 条目 */
  matchPatterns: string[];
  /** @grant 条目 */
  grants: string[];
  /** @run-at 值 */
  runAt: string;
  /** @category 自定义字段 */
  category: string;
  enabled: boolean;
  fileSize: number;
  modifiedAt: number;
}

// ── API 封装 ──────────────────────────────────────────────────────────────

export async function getExtensionDir(): Promise<string> {
  return invokeWithTimeout<string>('extension_get_dir');
}

export async function listExtensions(): Promise<ExtensionMeta[]> {
  return invokeWithTimeout<ExtensionMeta[]>('extension_list');
}

export async function readExtension(fileName: string): Promise<string> {
  return invokeWithTimeout<string>('extension_read', { fileName });
}

export async function saveExtension(fileName: string, content: string): Promise<void> {
  return invokeWithTimeout<void>('extension_save', { fileName, content });
}

export async function deleteExtension(fileName: string): Promise<void> {
  return invokeWithTimeout<void>('extension_delete', { fileName });
}

export async function toggleExtension(fileName: string, enabled: boolean): Promise<void> {
  return invokeWithTimeout<void>('extension_toggle', { fileName, enabled });
}

export async function openExtensionInVscode(fileName: string): Promise<void> {
  return invokeWithTimeout<void>('extension_open_in_vscode', { fileName });
}

// ── 工具函数 ──────────────────────────────────────────────────────────────

/** 将任意字符串转为合法 JS 文件名 */
export function toExtSafeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_') + '.js';
}

/**
 * 在前端解析 UserScript 头部元数据。
 * 用于示例脚本展示，不通过 Rust 命令。
 */
export function parseUserScriptMeta(source: string): Partial<ExtensionMeta> {
  const meta: Partial<ExtensionMeta> = { matchPatterns: [], grants: [] };
  let inHeader = false;

  for (const line of source.split('\n').slice(0, 100)) {
    const t = line.trim();
    if (t === '// ==UserScript==') {
      inHeader = true;
      continue;
    }
    if (t === '// ==/UserScript==') {
      break;
    }
    if (!inHeader) {
      continue;
    }

    const m = t.match(/^\/\/ @(\S+)\s*(.*)$/);
    if (!m) {
      continue;
    }
    const [, key, rawVal] = m;
    const val = rawVal.trim();

    switch (key) {
      case 'name':
        meta.name = val;
        break;
      case 'namespace':
        meta.namespace = val;
        break;
      case 'version':
        meta.version = val;
        break;
      case 'description':
        meta.description = val;
        break;
      case 'author':
        meta.author = val;
        break;
      case 'match':
      case 'include':
        meta.matchPatterns!.push(val);
        break;
      case 'grant':
        if (val && val !== 'none') {
          meta.grants!.push(val);
        }
        break;
      case 'run-at':
        meta.runAt = val;
        break;
      case 'category':
        meta.category = val;
        break;
      case 'enabled':
        meta.enabled = val !== 'false';
        break;
    }
  }
  return meta;
}

/** 生成新扩展的 UserScript 模板内容 */
export function newExtensionTemplate(name = '新扩展', category = '其他'): string {
  return `// ==UserScript==
// @name         ${name}
// @namespace    com.legado.extensions
// @version      0.1.0
// @description  在此填写前端插件描述
// @author
// @category     ${category}
// @match        *
// @grant        none
// @run-at       document-idle
// @enabled      true
// ==/UserScript==

/**
 * 前端插件主逻辑
 * 插件全部运行在前端页面内，通过 legado.registerPlugin 注册能力。
 * 可注册阅读器 hooks / slots / themes / backgrounds / skins，
 * 也可注册书架右键动作 bookshelfActions、阅读器选中文本菜单 readerContextActions、封面生成器 coverGenerators，
 * 并通过 api.http / api.ui.prompt / api.bookshelf.patchBook / api.text.convertChinese 组合复杂交互。
 */

legado.registerPlugin({
  id: '${name.replace(/\s+/g, '-').toLowerCase()}',
  setup(api) {
    return {
      settings: {
        defaults: {
          enabled: true,
          label: '${name}',
          rules: [],
          opacity: 80,
        },
        schema(context) {
          return [
            {
              type: 'switch',
              key: 'enabled',
              label: '启用插件功能',
            },
            {
              type: 'text',
              key: 'label',
              label: '显示文字',
            },
            {
              type: 'string-list',
              key: 'rules',
              label: '规则列表（' + (context.values.rules || []).length + '）',
            },
            {
              type: 'slider',
              key: 'opacity',
              label: '透明度',
              min: 0,
              max: 100,
              step: 5,
            },
          ];
        },
      },
      hooks: {
        'reader.content.beforeRender': async (payload) => {
          return api.settings.get('enabled', true) ? payload.content : payload.content;
        },
      },
      readerContextActions: [
        {
          id: 'selected-text-demo',
          name: '查看选中文字',
          when(context) {
            return context.sourceType === 'novel' && !!context.text;
          },
          async run(context) {
            await api.ui.prompt({
              title: '选中文字',
              message: context.text,
              fields: [],
              submitText: '关闭',
              cancelText: '取消',
            });
          },
        },
      ],
      themes: [
        {
          id: 'sample-theme',
          name: '示例主题',
          preview: {
            backgroundColor: '#f5efe2',
            textColor: '#3b2d1f',
            selectionColor: '#d7b98a',
          },
          resolve() {
            return {
              backgroundColor: '#f5efe2',
              textColor: '#3b2d1f',
              selectionColor: '#d7b98a',
            };
          },
        },
      ],
      backgrounds: [
        {
          id: 'sample-background',
          name: '示例背景',
          preview: {
            backgroundColor: '#f5efe2',
            backgroundImage: 'linear-gradient(135deg, rgba(120,85,45,0.12) 0%, transparent 48%)',
          },
          resolve() {
            return {
              backgroundColor: '#f5efe2',
              textColor: '#3b2d1f',
              backgroundImage:
                'linear-gradient(135deg, rgba(120,85,45,0.08) 0%, transparent 48%)',
              backgroundRepeat: 'no-repeat',
              backgroundSize: 'cover',
            };
          },
        },
      ],
      skins: [
        {
          id: 'sample-skin',
          name: '示例皮肤',
          preview: {
            backgroundColor: '#dbeafe',
            textColor: '#1e3a8a',
            styleVars: {
              '--reader-top-bar-bg': 'linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%)',
              '--reader-body-surface': '#ffffff',
            },
          },
          resolve() {
            return {
              backgroundColor: '#dbeafe',
              textColor: '#1e293b',
              styleVars: {
                '--reader-body-top': '72px',
                '--reader-body-right': '96px',
                '--reader-body-bottom': '40px',
                '--reader-body-left': '96px',
                '--reader-body-max-width': '960px',
                '--reader-body-margin': '0 auto',
                '--reader-body-surface': '#ffffff',
                '--reader-body-radius': '16px',
                '--reader-body-shadow': '0 24px 60px rgba(37, 99, 235, 0.18)',
                '--reader-top-top': '16px',
                '--reader-top-left': '96px',
                '--reader-top-right': '96px',
                '--reader-top-max-width': '960px',
                '--reader-top-margin': '0 auto',
                '--reader-top-bar-bg': 'linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%)',
              },
            };
          },
        },
      ],
    };
  },
});
`;
}
