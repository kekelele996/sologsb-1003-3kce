import { replaceTermOutsideProtected } from './markdown'
import type { GlossaryTermChange, HistoryEntry, Segment, TranslationConflict } from './types'

export const REGISTRY_AUTHOR = '术语登记册 · 术语负责人'

// 片段是否引用到被改动的术语：源文含术语原文，或译文含旧译名。
// 代码块保持原样，只有译文里确实写着旧译名时才需要退回。
export const segmentReferencesTerm = (segment: Segment, change: GlossaryTermChange): boolean => {
  const targetHit = change.from ? segment.targetText.includes(change.from) : false
  if (segment.kind === 'code') return targetHit
  const sourceHit = change.caseSensitive
    ? segment.sourceText.includes(change.source)
    : segment.sourceText.toLowerCase().includes(change.source.toLowerCase())
  return sourceHit || targetHit
}

export interface TermChangeApplication {
  segments: Segment[]
  conflicts: TranslationConflict[]
  history: HistoryEntry[]
  appliedChangeIds: string[]
  failedChanges: GlossaryTermChange[]
  returnedSegmentIds: string[]
}

// 按术语逐项应用登记册变更：
// - 只退回引用到改动术语的片段，其余片段不动；
// - 有未保存编辑的片段保留译者文本，登记册建议版写入冲突，两边都留着；
// - 每条变更处理成功后记入 appliedChangeIds，重试时跳过，处理好的片段不再重复变动；
// - 单条变更抛错只进入 failedChanges，不影响其余变更继续处理。
export const applyTermChanges = (args: {
  segments: Segment[]
  changes: GlossaryTermChange[]
  unsavedSegmentIds: Set<string>
  now: number
}): TermChangeApplication => {
  const { segments, changes, unsavedSegmentIds, now } = args
  let current = segments
  const conflicts: TranslationConflict[] = []
  const history: HistoryEntry[] = []
  const appliedChangeIds: string[] = []
  const failedChanges: GlossaryTermChange[] = []
  const returnedSegmentIds = new Set<string>()

  for (const change of changes) {
    try {
      const next: Segment[] = []
      for (const segment of current) {
        if (!segmentReferencesTerm(segment, change)) {
          next.push(segment)
          continue
        }
        returnedSegmentIds.add(segment.id)
        const suggested = replaceTermOutsideProtected(segment.targetText, change.from, change.to, segment.protectedTokens, change.caseSensitive)
        if (unsavedSegmentIds.has(segment.id)) {
          // 译者有未保存编辑：文本不动，建议版进冲突列表，两边都留着。
          if (suggested !== segment.targetText) {
            conflicts.push({
              id: `conflict-glossary-${change.id}-${segment.id}`,
              segmentId: segment.id,
              localText: segment.targetText,
              remoteText: suggested,
              remoteAuthor: REGISTRY_AUTHOR,
              createdAt: now,
            })
          }
          history.push({
            id: `history-${now}-${change.id}-${segment.id}`,
            segmentId: segment.id,
            author: REGISTRY_AUTHOR,
            action: 'glossary-sync',
            before: segment.targetText,
            after: `术语“${change.source}”译名调整为“${change.to}”，片段退回待处理；本地未保存编辑已保留。`,
            createdAt: now,
          })
          next.push({ ...segment, status: 'returned' })
          continue
        }
        history.push({
          id: `history-${now}-${change.id}-${segment.id}`,
          segmentId: segment.id,
          author: REGISTRY_AUTHOR,
          action: 'glossary-sync',
          before: segment.targetText,
          after: suggested,
          createdAt: now,
        })
        next.push({ ...segment, targetText: suggested, status: 'returned' })
      }
      current = next
      appliedChangeIds.push(change.id)
    } catch {
      failedChanges.push(change)
    }
  }

  return { segments: current, conflicts, history, appliedChangeIds, failedChanges, returnedSegmentIds: Array.from(returnedSegmentIds) }
}
