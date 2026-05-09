/**
 * 书源版本字符串工具函数（纯函数，无副作用）
 */

/** 将版本字符串格式化为显示文本，如 "1.2.3" → "v1.2.3" */
export function formatVersion(version: string): string {
  return version ? `v${version}` : '未标注版本';
}

function _cleanVersion(v: string): string {
  return v.trim().replace(/^v/i, '');
}

function _parseVersion(v: string): number[] {
  return v.split('.').map((n) => parseInt(n, 10) || 0);
}

/**
 * 比较两个版本字符串（支持 semver 格式，如 1.0.0 / v2.3.1）。
 * 返回 1（a > b），-1（a < b），0（相等），null（无法比较）。
 */
export function compareVersions(a: string, b: string): 1 | -1 | 0 | null {
  const ca = _cleanVersion(a);
  const cb = _cleanVersion(b);
  if (!ca || !cb) {
    return null;
  }
  const pa = _parseVersion(ca);
  const pb = _parseVersion(cb);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na > nb) {
      return 1;
    }
    if (na < nb) {
      return -1;
    }
  }
  return 0;
}
