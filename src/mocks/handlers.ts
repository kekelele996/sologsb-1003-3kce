import { http, HttpResponse } from 'msw'
import { analyzeDocument } from '@/lib/markdown'
import { seedConflicts, seedDocument, seedHistory } from '@/lib/seed'
import type { GlossaryTerm, Segment } from '@/lib/types'
import {
  isRegisterAvailable, isTermFailing, publishTermRevision, readManifest, readTerm,
  setRegisterAvailable, setTermFailing,
} from './glossary-store'

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

export const handlers = [
  http.get('/api/document', () => HttpResponse.json(clone(seedDocument))),
  http.get('/api/history', () => HttpResponse.json(clone(seedHistory))),
  http.get('/api/conflicts', () => HttpResponse.json(clone(seedConflicts))),
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

  // 服务端术语登记册：只返回术语负责人维护的最新版本，工作台不会被整体覆盖。
  http.get('/api/glossary/manifest', async () => {
    await new Promise((resolve) => setTimeout(resolve, 300))
    if (!isRegisterAvailable()) return HttpResponse.json({ message: 'glossary register unavailable' }, { status: 503 })
    return HttpResponse.json(readManifest())
  }),
  // 逐项取回某个术语；工作台按术语逐条应用，失败的条目保留标记稍后重试。
  http.get('/api/glossary/terms/:termId', async ({ params }) => {
    await new Promise((resolve) => setTimeout(resolve, 220))
    if (!isRegisterAvailable()) return HttpResponse.json({ message: 'glossary register unavailable' }, { status: 503 })
    const termId = String(params.termId)
    if (isTermFailing(termId)) return HttpResponse.json({ message: `term ${termId} temporarily unavailable` }, { status: 503 })
    const term = readTerm(termId)
    if (!term) return HttpResponse.json({ message: `term ${termId} not found` }, { status: 404 })
    return HttpResponse.json(term)
  }),
  // 演示用：术语负责人发布一次术语改版。
  http.post('/api/glossary/demo/revise', async ({ request }) => {
    const { termId } = await request.json() as { termId: string }
    if (!readTerm(termId)) return HttpResponse.json({ message: 'term not found' }, { status: 404 })
    return HttpResponse.json(publishTermRevision(termId))
  }),
  // 演示用：切换登记册整体可用性（在线 / 断连）。
  http.post('/api/glossary/demo/availability', async ({ request }) => {
    const { available } = await request.json() as { available: boolean }
    return HttpResponse.json({ available: setRegisterAvailable(available) })
  }),
  // 演示用：让某个术语的逐项取回失败或恢复。
  http.post('/api/glossary/demo/term-fault', async ({ request }) => {
    const { termId, failing } = await request.json() as { termId: string; failing: boolean }
    return HttpResponse.json({ termId, failing: setTermFailing(termId, failing) })
  }),
]
