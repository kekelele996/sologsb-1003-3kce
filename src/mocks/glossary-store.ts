import type { GlossaryManifest, GlossaryTerm } from '@/lib/types'
import { seedGlossary } from '@/lib/seed'

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

/** 服务端登记册：由术语负责人维护，与翻译工作台持有的本地副本互不影响。 */
const serverTerms: GlossaryTerm[] = clone(seedGlossary)
/** 演示用：登记册是否可用；关闭后拉取清单与逐项取回都会失败。 */
let registerAvailable = true
/** 演示用：登记册整体可达，但单个术语条目取回失败（恢复后可逐项重试）。 */
const failingTerms = new Set<string>()

let registerVersion = 1

const operatorTargets = ['操作器', '运维代理']
const podTargets = ['容器组', 'Pod 实例']

export const readManifest = (): GlossaryManifest => ({
  version: registerVersion,
  pulledAt: Date.now(),
  terms: serverTerms.map((term) => clone(term)),
})

export const readTerm = (termId: string): GlossaryTerm | undefined => {
  const term = serverTerms.find((item) => item.id === termId)
  return term ? clone(term) : undefined
}

export const isRegisterAvailable = () => registerAvailable
export const isTermFailing = (termId: string) => failingTerms.has(termId)

export const setRegisterAvailable = (available: boolean) => {
  registerAvailable = available
  return registerAvailable
}

/** 演示用：让某个术语条目在逐项取回时失败或恢复。 */
export const setTermFailing = (termId: string, failing: boolean) => {
  if (failing) failingTerms.add(termId)
  else failingTerms.delete(termId)
  return failing
}

/**
 * 演示用：术语负责人发布一次改版。
 * operator 在 操作器 / 运维代理 之间轮换，pod 在 容器组 / Pod 实例 之间轮换。
 */
export const publishTermRevision = (termId: string): GlossaryTerm => {
  const term = serverTerms.find((item) => item.id === termId)
  if (!term) throw new Error(`unknown term ${termId}`)
  const cycle = termId === 'term-01' ? operatorTargets : termId === 'term-04' ? podTargets : [term.target]
  const revisionIndex = Math.max(0, term.revision - 1)
  term.target = cycle[revisionIndex % cycle.length]
  term.revision += 1
  term.updatedAt = Date.now()
  registerVersion += 1
  return clone(term)
}
