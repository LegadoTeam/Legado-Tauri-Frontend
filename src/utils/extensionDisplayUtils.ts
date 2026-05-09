export const CATEGORY_TYPE: Record<string, string> = {
  内容处理: 'info',
  统计: 'primary',
  主题: 'success',
  工具: 'warning',
  书源辅助: 'error',
  其他: 'default',
};
export const CATEGORY_DOT: Record<string, string> = {
  内容处理: '#4dabf7',
  统计: '#9775fa',
  主题: '#51cf66',
  工具: '#ffa94d',
  书源辅助: '#ff6b6b',
  其他: '#adb5bd',
};
export const RUN_AT_LABEL: Record<string, string> = {
  'document-start': '初始化时',
  'content-ready': '内容就绪',
  'document-idle': '空闲时',
  'document-end': '渲染后',
};

export function catType(cat: string): string {
  return CATEGORY_TYPE[cat] ?? 'default';
}
export function catDot(cat: string): string {
  return CATEGORY_DOT[cat] ?? '#adb5bd';
}
export function runAtLabel(v: string): string {
  return RUN_AT_LABEL[v] ?? v;
}

export function runtimeStatusType(status?: string): string {
  switch (status) {
    case 'active':
      return 'success';
    case 'error':
      return 'error';
    case 'disabled':
      return 'warning';
    default:
      return 'default';
  }
}

export function runtimeStatusLabel(status?: string): string {
  switch (status) {
    case 'active':
      return '前端运行中';
    case 'error':
      return '运行异常';
    case 'disabled':
      return '已禁用';
    default:
      return '未加载';
  }
}
