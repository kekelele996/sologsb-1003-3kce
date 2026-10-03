import { http, HttpResponse } from 'msw'
import { analyzeDocument } from '@/lib/markdown'
import { seedConflicts, seedDocument, seedGlossary, seedHistory } from '@/lib/seed'
import type { GlossaryRegistrySnapshot, GlossaryTerm, GlossaryTermChange, Segment } from '@/lib/types'

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

// 术语登记册由术语负责人在服务端维护，与工作台本地术语表各自持有自己那份。
// 工作台只能通过拉取接口按版本号同步，服务端改动不会直接写进工作台。
const registry = {
  version: 1,
  updatedAt: Date.now(),
  terms: clone(seedGlossary) as GlossaryTerm[],
  changes: [] as GlossaryTermChange[],
  down: false,
}

const registrySnapshot = (since: number): GlossaryRegistrySnapshot => ({
  version: registry.version,
  updatedAt: registry.updatedAt,
  terms: clone(registry.terms),
  changes: clone(registry.changes.filter((change) => change.version > since)),
})

const registryUnavailable = () => HttpResponse.json({ error: 'glossary registry unavailable' }, { status: 503 })

export const handlers = [
  http.get('/api/document', () => HttpResponse.json(clone(seedDocument))),
  http.get('/api/history', () => HttpResponse.json(clone(seedHistory))),
  http.get('/api/conflicts', () => HttpResponse.json(clone(seedConflicts))),

  // 拉取登记册：?since=N 返回 N 之后的逐条术语变更，客户端按术语逐项应用。
  http.get('/api/glossary/registry', ({ request }) => {
    if (registry.down) return registryUnavailable()
    const since = Number(new URL(request.url).searchParams.get('since') ?? '0') || 0
    return HttpResponse.json(registrySnapshot(since))
  }),

  // 术语负责人改动某条术语的译名，登记册版本号递增并记录变更。
  http.post('/api/glossary/registry/term', async ({ request }) => {
    if (registry.down) return registryUnavailable()
    const body = await request.json() as { id: string; target: string; note?: string }
    const term = registry.terms.find((item) => item.id === body.id)
    if (!term || typeof body.target !== 'string' || !body.target.trim()) {
      return HttpResponse.json({ error: 'term not found or target empty' }, { status: 400 })
    }
    if (term.target === body.target) return HttpResponse.json(registrySnapshot(registry.version))
    registry.version += 1
    registry.updatedAt = Date.now()
    registry.changes.push({
      id: `chg-v${registry.version}-${term.id}`,
      termId: term.id,
      source: term.source,
      from: term.target,
      to: body.target,
      caseSensitive: term.caseSensitive,
      version: registry.version,
      changedAt: registry.updatedAt,
    })
    term.target = body.target
    if (body.note) term.note = body.note
    return HttpResponse.json(registrySnapshot(registry.version))
  }),

  // 模拟登记册故障 / 恢复，用于验证拉取失败后的标记保留与逐项重试。
  http.post('/api/glossary/registry/status', async ({ request }) => {
    const body = await request.json() as { down: boolean }
    registry.down = Boolean(body.down)
    return HttpResponse.json({ down: registry.down })
  }),

  http.post('/api/check', async ({ request }) => {
    const body = await request.json() as { segments: Segment[]; glossary: GlossaryTerm[] }
    await new Promise((resolve) => setTimeout(resolve, 320))
    return HttpResponse.json({ checkedAt: Date.now(), issues: analyzeDocument(body.segments, body.glossary) })
  }),
  http.post('/api/draft', async ({ request }) => {
    const body = await request.json() as { documentId: string; segments: Segment[]; discussions: unknown[] }
    await new Promise((resolve) => setTimeout(resolve, 240))
    return HttpResponse.json({ saved: true, documentId: body.documentId, segmentCount: body.segments.length, savedAt: Date.now() })
  }),
  http.post('/api/review', async ({ request }) => {
    const body = await request.json() as { action: string; segmentIds: string[]; reason?: string }
    await new Promise((resolve) => setTimeout(resolve, 280))
    return HttpResponse.json({ accepted: true, ...body, reviewedAt: Date.now() })
  }),
]
