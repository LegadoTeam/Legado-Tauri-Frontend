/**
 * 书架分组类型定义
 */

export interface ShelfGroup {
  /** 分组唯一 ID */
  id: string;
  /** 分组名称 */
  name: string;
  /** 分组创建时间 */
  createdAt: number;
  /** 是否启用（可见/隐藏） */
  enabled: boolean;
  /** 分组顺序 */
  order: number;
}

/** 默认分组 */
export const DEFAULT_GROUP: ShelfGroup = {
  id: 'all',
  name: '全部书籍',
  createdAt: 0,
  enabled: true,
  order: -1,
};

export interface ShelfGroupWithCount extends ShelfGroup {
  /** 该分组中的书籍数量 */
  bookCount: number;
}
