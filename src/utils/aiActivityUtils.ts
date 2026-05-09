import type { ActivityType, AgentActivity } from '@/composables/useAiAgent';
import type { AiSession } from '@/stores';

export const ACTIVITY_LABEL: Record<ActivityType, string> = {
  thinking: '思考',
  tool_call: '调用',
  message: '回复',
  error: '错误',
  info: '信息',
};

export function getActivityClass(type: ActivityType): string {
  return `log-item--${type.replace('_', '-')}`;
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => n.toString().padStart(2, '0'))
    .join(':');
}

export function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return formatTime(ts);
  }
  return `${d.getMonth() + 1}/${d.getDate()} ${formatTime(ts)}`;
}

export function getDisplayContent(a: AgentActivity): string {
  const MAX = 1500;
  const c = a.content;
  return c.length > MAX ? c.slice(0, MAX) + `\n…(已截断 ${c.length} 字)` : c;
}

export function truncateResult(s: string | undefined): string {
  if (!s) {
    return '';
  }
  const MAX = 2000;
  return s.length > MAX ? s.slice(0, MAX) + `\n…(已截断 ${s.length} 字)` : s;
}

export function sessionStatusLabel(s: AiSession): string {
  if (s.status === 'saved') {
    return '已保存';
  }
  if (s.status === 'tested_ok') {
    return '测试通过';
  }
  if (s.status === 'tested_fail') {
    return '测试失败';
  }
  if (s.currentSourceCode) {
    return '有草稿';
  }
  return '空';
}

export function sessionStatusType(s: AiSession): 'success' | 'error' | 'warning' | 'default' {
  if (s.status === 'saved') {
    return 'success';
  }
  if (s.status === 'tested_ok') {
    return 'success';
  }
  if (s.status === 'tested_fail') {
    return 'error';
  }
  if (s.currentSourceCode) {
    return 'warning';
  }
  return 'default';
}
