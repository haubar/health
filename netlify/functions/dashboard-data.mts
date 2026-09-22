import type { Config } from '@netlify/functions'
import { aggregateDailyHealthRecords, dashboardDataSchema } from '@health/shared'
import { z } from 'zod'
import { createBlobStore } from '../lib/blobs'
import { getServerEnvironment } from '../lib/env'
import { blobKeys } from '../lib/keys'
import { healthDate, healthDatesInRange, healthDayStart, shiftHealthDate } from '../lib/health-day'
import { jsonFailure, jsonSuccess } from '../lib/response'
import { DashboardSummaryRepository, emptyDashboardSummary, type DashboardSummary } from '../lib/repositories/dashboard-summary-repository'
import { HealthRecordRepository } from '../lib/repositories/health-record-repository'
import { JsonRepository } from '../lib/repositories/json-repository'
import { readSession } from '../lib/session'
import { SyncRepository } from '../lib/repositories/sync-repository'
import { createNetlifyHandler } from '../lib/netlify-handler'

const RANGE_DAYS: Record<string, number> = { '7D': 7, '30D': 30 }
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
  const url = new URL(request.url)
  const month = url.searchParams.get('month')
  let range = month ?? url.searchParams.get('range') ?? '7D'
  let start: Date
  let end: Date
  if (month !== null) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return jsonFailure(400, 'invalid_month', '月份格式無效。')
    const [year, monthNumber] = month.split('-').map(Number)
    start = new Date(Date.UTC(year!, monthNumber! - 1, 1, -8))
    end = new Date(Date.UTC(year!, monthNumber!, 1, -8))
  } else {
    const days = RANGE_DAYS[range]
    if (!days) return jsonFailure(400, 'invalid_range', '查詢範圍最多 30 天，較早資料請逐月切換。')
    end = new Date()
    start = new Date(end)
    start.setUTCDate(start.getUTCDate() - days)
  }
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
  const allDates = healthDatesInRange(start, end)
  const fullDateSet = new Set(allDates.filter((date) => healthDayStart(date) >= start && healthDayStart(shiftHealthDate(date, 1)) <= end))
  const summaryRepository = new DashboardSummaryRepository()
  const cachedDays = await summaryRepository.getMany(userId, allDates)
  const byDate = new Map<string, DashboardSummary>()
  const missingDates: string[] = []
  for (const [index, date] of allDates.entries()) {
    const cachedDay = cachedDays[index]
    if (cachedDay && fullDateSet.has(date)) byDate.set(date, cachedDay)
    else missingDates.push(date)
  }

  let recordCount = 0
  if (missingDates.length) {
    const fallbackStart = new Date(Math.max(start.getTime(), healthDayStart(missingDates[0]!).getTime()))
    const fallbackEnd = new Date(Math.min(end.getTime(), healthDayStart(shiftHealthDate(missingDates[missingDates.length - 1]!, 1)).getTime()))
    const records = await new HealthRecordRepository().list(userId, fallbackStart, fallbackEnd)
    recordCount = records.length
    const summariesByDate = new Map(aggregateDailyHealthRecords(records).map((summary) => [summary.date, summary]))
    const latestByDate = new Map<string, number>()
    const recordCountsByDate = new Map<string, number>()
    for (const record of records) {
      const date = healthDate(new Date(record.startTime))
      latestByDate.set(date, Math.max(latestByDate.get(date) ?? Number.NEGATIVE_INFINITY, Date.parse(record.startTime)))
      recordCountsByDate.set(date, (recordCountsByDate.get(date) ?? 0) + 1)
    }
    await summaryRepository.setMany(userId, missingDates.filter((date) => fullDateSet.has(date)).map((date) => ({
      date,
      value: {
        summary: summariesByDate.get(date) ?? emptyDashboardSummary(date),
        lastUpdatedAt: Number.isFinite(latestByDate.get(date)) ? new Date(latestByDate.get(date)!).toISOString() : null,
        hasRecords: (recordCountsByDate.get(date) ?? 0) > 0,
      },
    })))
    for (const date of missingDates) {
      const summary = summariesByDate.get(date)
      byDate.set(date, {
        summary: summary ?? emptyDashboardSummary(date),
        lastUpdatedAt: Number.isFinite(latestByDate.get(date)) ? new Date(latestByDate.get(date)!).toISOString() : null,
        hasRecords: (recordCountsByDate.get(date) ?? 0) > 0,
      })
    }
  }
  const dayValues = [...byDate.values()]
  const summaries = dayValues.filter((day) => day.hasRecords).map((day) => day.summary).sort((left, right) => left.date.localeCompare(right.date))
  const latestRecordTime = dayValues.reduce((latest, day) => Math.max(latest, day.lastUpdatedAt ? Date.parse(day.lastUpdatedAt) : Number.NEGATIVE_INFINITY), Number.NEGATIVE_INFINITY)
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
  console.log('dashboard-data cache miss', { range, cachedDayCount: allDates.length - missingDates.length, missingDayCount: missingDates.length, recordCount, durationMs: Date.now() - requestStartedAt })
  return jsonSuccess(data)
}

export const handler = createNetlifyHandler(fetchHandler)

export const config: Config = { method: 'GET' }
