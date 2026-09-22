import type { Config } from '@netlify/functions'
import { aggregateDailyHealthRecords, dashboardDataSchema } from '@health/shared'
import { z } from 'zod'
import { createBlobStore } from '../lib/blobs'
import { getServerEnvironment } from '../lib/env'
import { blobKeys } from '../lib/keys'
import { jsonFailure, jsonSuccess } from '../lib/response'
import { HealthRecordRepository } from '../lib/repositories/health-record-repository'
import { JsonRepository } from '../lib/repositories/json-repository'
import { readSession } from '../lib/session'
import { SyncRepository } from '../lib/repositories/sync-repository'
import { createNetlifyHandler } from '../lib/netlify-handler'

const RANGE_DAYS: Record<string, number> = { '7D': 7, '30D': 30, '90D': 90, '1Y': 365 }
const CACHE_TTL_MS = 60 * 60 * 1000
const dashboardCacheSchema = z.object({
  sourceVersion: z.string(),
  cachedAt: z.iso.datetime(),
  data: dashboardDataSchema,
})

const fetchHandler = async (request: Request): Promise<Response> => {
  const env = getServerEnvironment()
  const user = await readSession(request, env.SESSION_SECRET)
  if (!user) return jsonFailure(401, 'unauthenticated', '請先使用 Google 登入。')
  const range = new URL(request.url).searchParams.get('range') ?? '7D'
  const days = RANGE_DAYS[range]
  if (!days) return jsonFailure(400, 'invalid_range', '不支援的日期範圍。')
  const requestStartedAt = Date.now()
  const userId = user.id
  const cache = new JsonRepository(createBlobStore('health-dashboard-cache'), dashboardCacheSchema, 'strong')
  let cacheable = true
  const [syncState, cached] = await Promise.all([
    new SyncRepository().get(userId).catch((error: unknown) => {
      cacheable = false
      console.warn('dashboard-data sync version unavailable', error instanceof Error ? { name: error.name } : {})
      return null
    }),
    cache.get(blobKeys.dashboardCache(userId, range)).catch((error: unknown) => {
      console.warn('dashboard-data cache read failed', error instanceof Error ? { name: error.name } : {})
      return null
    }),
  ])
  const sourceVersion = syncState
    ? `${syncState.lastStartedAt ?? 'none'}|${syncState.status}|${syncState.recordCount}|${syncState.lastCompletedAt ?? 'none'}`
    : 'no-sync-state'
  if (cacheable && cached?.sourceVersion === sourceVersion && Date.now() - Date.parse(cached.cachedAt) < CACHE_TTL_MS) {
    console.log('dashboard-data cache hit', { range, durationMs: Date.now() - requestStartedAt })
    return jsonSuccess(cached.data)
  }
  const end = new Date()
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - days)
  const records = await new HealthRecordRepository().list(userId, start, end)
  const summaries = aggregateDailyHealthRecords(records)
  let latestRecordTime = Number.NEGATIVE_INFINITY
  for (const record of records) latestRecordTime = Math.max(latestRecordTime, Date.parse(record.startTime))
  const data = {
    availability: summaries.length ? 'ready' as const : 'empty' as const,
    lastUpdatedAt: Number.isFinite(latestRecordTime) ? new Date(latestRecordTime).toISOString() : null,
    summaries,
  }
  if (cacheable) {
    await cache.set(blobKeys.dashboardCache(userId, range), {
      sourceVersion,
      cachedAt: new Date().toISOString(),
      data,
    }).catch((error: unknown) => {
      console.warn('dashboard-data cache write failed', error instanceof Error ? { name: error.name } : {})
    })
  }
  console.log('dashboard-data cache miss', { range, recordCount: records.length, durationMs: Date.now() - requestStartedAt })
  return jsonSuccess(data)
}

export const handler = createNetlifyHandler(fetchHandler)

export const config: Config = { method: 'GET' }
