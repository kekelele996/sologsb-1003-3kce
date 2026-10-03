export type SegmentKind = 'heading' | 'paragraph' | 'code' | 'link' | 'variable'
export type SegmentStatus = 'draft' | 'needs-work' | 'confirmed' | 'returned'
export type IssueType = 'missing-translation' | 'missing-variable' | 'link-mismatch' | 'glossary' | 'code-format'
export type IssueSeverity = 'error' | 'warning'

export interface Segment {
  id: string
  index: number
  kind: SegmentKind
  sourceText: string
  targetText: string
  status: SegmentStatus
  protectedTokens: string[]
  note: string
  termNotices?: SegmentTermNotice[]
}

export interface GlossaryTerm {
  id: string
  source: string
  target: string
  caseSensitive: boolean
  note: string
  revision: number
  updatedAt?: number
}

/** 片段上已经处理过的术语改版记录，同时充当幂等台账，避免同一版本重复退回。 */
export interface SegmentTermNotice {
  termId: string
  source: string
  previousTarget: string
  nextTarget: string
  revision: number
  appliedAt: number
  /** 应用该改版时片段是否原为“已确认”并因此被退回。 */
  flipped?: boolean
}

/** 拉取到新版本但尚未逐项取回应用的术语标记；失败时原样保留。 */
export interface PendingTermChange {
  termId: string
  source: string
  previousTarget: string
  nextTarget: string
  revision: number
  state: 'pending' | 'failed'
  attempts: number
  lastError?: string
  discoveredAt: number
}

export interface GlossaryManifest {
  version: number
  pulledAt: number
  terms: GlossaryTerm[]
}

export interface Discussion {
  id: string
  segmentId: string
  author: string
  body: string
  resolved: boolean
  createdAt: number
}

export interface TranslationIssue {
  id: string
  segmentId: string
  type: IssueType
  severity: IssueSeverity
  message: string
  expected?: string
}

export interface HistoryEntry {
  id: string
  segmentId: string
  author: string
  action: 'edit' | 'confirm' | 'return' | 'resolve-conflict' | 'import' | 'discussion' | 'term-sync'
  before: string
  after: string
  createdAt: number
}

export interface TranslationConflict {
  id: string
  segmentId: string
  localText: string
  remoteText: string
  remoteAuthor: string
  createdAt: number
}

export interface LocalizationDocument {
  id: string
  title: string
  sourceFile: string
  sourceLanguage: string
  targetLanguage: string
  updatedAt: number
  segments: Segment[]
  glossary: GlossaryTerm[]
  discussions: Discussion[]
}
