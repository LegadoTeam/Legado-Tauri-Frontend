<script setup lang="ts">
import { computed } from 'vue'
import type { BookItem } from '../../composables/useScriptBridge'
import StackedBookCard from './StackedBookCard.vue'

/** 单条搜索结果 + 来源信息 */
export interface TaggedBookItem {
  book: BookItem
  fileName: string
  sourceName: string
  sourceLogo?: string
}

/** 聚合后的书籍组 */
export interface AggregatedBook {
  /** 用于展示的主书籍（取第一条或封面最全的） */
  primary: TaggedBookItem
  /** 同名书来自不同书源 */
  sources: TaggedBookItem[]
  /** 与关键词的相似度（0~1） */
  similarity: number
}

const props = defineProps<{
  keyword: string
  results: TaggedBookItem[]
  showCovers?: boolean
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'select', book: BookItem, fileName: string): void
}>()

// ── 文字相似度（Dice 系数，基于 bigram） ─────────────────────────────────
function bigrams(str: string): Set<string> {
  const s = str.toLowerCase().replace(/\s+/g, '')
  const set = new Set<string>()
  for (let i = 0; i < s.length - 1; i++) {
    set.add(s.substring(i, i + 2))
  }
  return set
}

function diceSimilarity(a: string, b: string): number {
  if (!a || !b) return 0
  const na = a.toLowerCase().replace(/\s+/g, '')
  const nb = b.toLowerCase().replace(/\s+/g, '')
  if (na === nb) return 1
  if (na.length < 2 || nb.length < 2) {
    // 单字符退化为包含判断
    return na.includes(nb) || nb.includes(na) ? 0.8 : 0
  }
  const bg1 = bigrams(a)
  const bg2 = bigrams(b)
  let intersection = 0
  bg1.forEach(g => { if (bg2.has(g)) intersection++ })
  return (2 * intersection) / (bg1.size + bg2.size)
}

/** 判断两本书是否为同一本（名称相似度高） */
function isSameBook(a: BookItem, b: BookItem): boolean {
  const nameA = a.name.toLowerCase().replace(/\s+/g, '')
  const nameB = b.name.toLowerCase().replace(/\s+/g, '')
  if (nameA === nameB) return true
  // 名称相似度 >= 0.8 且 作者相同(如果都有) → 视为同一本书
  const sim = diceSimilarity(a.name, b.name)
  if (sim >= 0.85) return true
  if (sim >= 0.7 && a.author && b.author && a.author.trim() === b.author.trim()) return true
  return false
}

/** 聚合 & 排序 */
const aggregatedBooks = computed<AggregatedBook[]>(() => {
  const kw = props.keyword.trim()
  if (!kw || !props.results.length) return []

  // 1. 按名称聚合
  const groups: AggregatedBook[] = []
  for (const item of props.results) {
    let matched = false
    for (const group of groups) {
      if (isSameBook(group.primary.book, item.book)) {
        group.sources.push(item)
        // 如果新条目封面更全，替换主条目
        if (!group.primary.book.coverUrl && item.book.coverUrl) {
          group.primary = item
        }
        matched = true
        break
      }
    }
    if (!matched) {
      groups.push({
        primary: item,
        sources: [item],
        similarity: diceSimilarity(item.book.name, kw),
      })
    }
  }

  // 2. 重新计算每组的最高相似度
  for (const g of groups) {
    let maxSim = 0
    for (const s of g.sources) {
      const sim = diceSimilarity(s.book.name, kw)
      if (sim > maxSim) maxSim = sim
    }
    g.similarity = maxSim
  }

  // 3. 按相似度降序排列
  groups.sort((a, b) => b.similarity - a.similarity)
  return groups
})
</script>

<template>
  <div class="agg-results">
    <!-- 加载中提示 -->
    <div v-if="loading" class="agg-results__loading">
      <n-spin size="small" />
      <span>搜索中…</span>
    </div>

    <!-- 结果网格 -->
    <div v-if="aggregatedBooks.length" class="agg-results__grid">
      <StackedBookCard
        v-for="(group, idx) in aggregatedBooks"
        :key="idx"
        :group="group"
        :show-cover="showCovers ?? true"
        @select="(book, fileName) => emit('select', book, fileName)"
      />
    </div>

    <!-- 空状态 -->
    <n-empty
      v-else-if="!loading"
      description="输入关键词后点击搜索，将聚合所有书源结果"
      style="padding: 64px 0"
    />
  </div>
</template>

<style scoped>
.agg-results {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.agg-results__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}
.agg-results__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}
</style>
