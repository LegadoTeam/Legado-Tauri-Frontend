import type { BookItem } from '@/stores';

/** 单条搜索结果 + 来源信息 */
export interface TaggedBookItem {
  book: BookItem;
  fileName: string;
  sourceName: string;
  sourceLogo?: string;
}

/** 聚合后的书籍组 */
export interface AggregatedBook {
  /** 用于展示的主书籍（取第一条或封面最全的） */
  primary: TaggedBookItem;
  /** 同名书来自不同书源 */
  sources: TaggedBookItem[];
  /** 与关键词的相似度（0~1） */
  similarity: number;
}
