import type { Config } from '@netlify/functions'
import { aggregateDailyHealthRecords } from '@health/shared'
import { getServerEnvironment } from '../lib/env'
import { jsonFailure, jsonSuccess } from '../lib/response'
import { HealthRecordRepository } from '../lib/repositories/health-record-repository'
import { readSession } from '../lib/session'

const RANGE_DAYS: Record<string, number> = { '7D': 7, '30D': 30, '90D': 90, '1Y': 365 }

export default async (request: Request): Promise<Response> => {
  const env = getServerEnvironment()
  const user = await readSession(request, env.SESSION_SECRET)
  if (!user) return jsonFailure(401, 'unauthenticated', '請先使用 Google 登入。')
  const range = new URL(request.url).searchParams.get('range') ?? '7D'
  const days = RANGE_DAYS[range]
  if (!days) return jsonFailure(400, 'invalid_range', '不支援的日期範圍。')
  const end = new Date()
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - days)
  const records = await new HealthRecordRepository().list(user.id, start, end)
  const summaries = aggregateDailyHealthRecords(records)
  return jsonSuccess({ availability: summaries.length ? 'ready' : 'empty', lastUpdatedAt: records.length ? new Date(Math.max(...records.map((record) => Date.parse(record.startTime)))).toISOString() : null, summaries })
}

export const config: Config = { method: 'GET' }
