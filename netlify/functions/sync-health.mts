import type { Config } from '@netlify/functions'
import { aggregateDailyHealthRecords } from '@health/shared'
import { decryptSecret } from '../lib/crypto'
import { getServerEnvironment } from '../lib/env'
import { floorToHealthDay, healthDate, nextHealthDayStart } from '../lib/health-day'
import { GoogleHealthProvider } from '../lib/google-health'
import { jsonFailure, jsonSuccess } from '../lib/response'
import { AuthRepository } from '../lib/repositories/auth-repository'
import { DashboardSummaryRepository, emptyDashboardSummary } from '../lib/repositories/dashboard-summary-repository'
import { HealthRecordRepository } from '../lib/repositories/health-record-repository'
import { SyncRepository } from '../lib/repositories/sync-repository'
import { readSession } from '../lib/session'
import { createNetlifyHandler } from '../lib/netlify-handler'

const DEFAULT_LOOKBACK_DAYS = 30
const BATCH_DAYS = 1
const BATCH_COUNT = DEFAULT_LOOKBACK_DAYS / BATCH_DAYS

const fetchHandler = async (request: Request): Promise<Response> => {
  const env = getServerEnvironment()
  const user = await readSession(request, env.SESSION_SECRET)
  if (!user) return jsonFailure(401, 'unauthenticated', '請先使用 Google 登入。')

  const auth = await new AuthRepository().get(user.id)
  if (!auth || auth.status !== 'connected') return jsonFailure(409, 'health_not_connected', '尚未連結 Google Health。')

  let payload: { batch?: unknown; runStartedAt?: unknown }
  try {
    payload = await request.json() as { batch?: unknown; runStartedAt?: unknown }
  } catch {
    return jsonFailure(400, 'invalid_sync_batch', '同步批次參數無效。')
  }
  const batch = payload.batch
  if (typeof batch !== 'number' || !Number.isInteger(batch) || batch < 0 || batch >= BATCH_COUNT) {
    return jsonFailure(400, 'invalid_sync_batch', '同步批次參數無效。')
  }

  const syncRepository = new SyncRepository()
  const previousState = await syncRepository.get(user.id)
  if (batch > 0 && (previousState?.status !== 'running' || typeof payload.runStartedAt !== 'string' || payload.runStartedAt !== previousState.lastStartedAt)) {
    return jsonFailure(409, 'sync_batch_out_of_order', '同步批次已失效，請重新開始同步。')
  }
  const startedAt = batch === 0 ? new Date().toISOString() : previousState!.lastStartedAt!
  const legacyNextEndTime = previousState?.lastCompletedAt && previousState.lastStartedAt
    ? new Date(Date.parse(previousState.lastStartedAt) - BATCH_COUNT * BATCH_DAYS * 24 * 60 * 60 * 1000).toISOString()
    : null
  const cursorEndTime = previousState?.nextEndTime ?? previousState?.runEndTime ?? legacyNextEndTime
  const runEndTime = batch === 0
    ? cursorEndTime ? floorToHealthDay(new Date(cursorEndTime)).toISOString() : nextHealthDayStart(new Date(startedAt)).toISOString()
    : previousState!.runEndTime ?? startedAt
  const nextEndTime = batch === 0 ? previousState?.nextEndTime ?? legacyNextEndTime : previousState!.nextEndTime ?? null
  const previousCount = batch === 0 ? 0 : previousState!.recordCount
  await syncRepository.set(user.id, { userId: user.id, lastStartedAt: startedAt, runEndTime, nextEndTime, lastCompletedAt: null, status: 'running', recordCount: previousCount, errorCode: null })

  try {
    const end = new Date(Date.parse(runEndTime))
    end.setUTCDate(end.getUTCDate() - batch * BATCH_DAYS)
    const start = new Date(end)
    start.setUTCDate(start.getUTCDate() - BATCH_DAYS)
    const provider = new GoogleHealthProvider(user.id, decryptSecret(auth.encryptedRefreshToken, env.HEALTH_TOKEN_ENCRYPTION_KEY), env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET)
    const [activity, weight, bodyFat, workouts] = await Promise.all([provider.getActivity({ start, end }), provider.getWeight({ start, end }), provider.getBodyFat({ start, end }), provider.getWorkouts({ start, end })])
    const records = [...activity, ...weight, ...bodyFat, ...workouts]
    const recordCounts = { activity: activity.length, weight: weight.length, bodyFat: bodyFat.length, workouts: workouts.length }
    console.log('sync-health batch fetched', {
      batch,
      batchCount: BATCH_COUNT,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      recordCounts,
      recordCount: records.length,
    })
    const repository = new HealthRecordRepository()
    const writeResult = await repository.setMany(records)
    console.log('sync-health batch blobs verified', {
      batch,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      ...writeResult,
    })
    const summaryRepository = new DashboardSummaryRepository()
    const summaryDate = healthDate(start)
    const summary = aggregateDailyHealthRecords(records).find((item) => item.date === summaryDate)
    let latestRecordTime = Number.NEGATIVE_INFINITY
    for (const record of records) latestRecordTime = Math.max(latestRecordTime, Date.parse(record.startTime))
    await summaryRepository.set(user.id, summaryDate, {
      summary: summary ?? emptyDashboardSummary(summaryDate),
      lastUpdatedAt: Number.isFinite(latestRecordTime) ? new Date(latestRecordTime).toISOString() : null,
      hasRecords: records.length > 0,
      synced: true,
    })
    const totalRecordCount = previousCount + records.length
    const done = batch === BATCH_COUNT - 1
    const completedAt = done ? new Date().toISOString() : null
    await syncRepository.set(user.id, { userId: user.id, lastStartedAt: startedAt, runEndTime, nextEndTime: done ? start.toISOString() : nextEndTime, lastCompletedAt: completedAt, status: done ? 'idle' : 'running', recordCount: totalRecordCount, errorCode: null })
    return jsonSuccess({ batch, batchCount: BATCH_COUNT, runStartedAt: startedAt, runEndTime, startTime: start.toISOString(), endTime: end.toISOString(), lastCompletedAt: completedAt, recordCount: records.length, totalRecordCount, done, recordCounts })
  } catch (error) {
    const errorCode = error instanceof Error ? error.constructor.name : 'sync_failed'
    console.error('sync-health failed', error instanceof Error ? { name: error.name, message: error.message } : { error: 'unknown_error' })
    await syncRepository.set(user.id, { userId: user.id, lastStartedAt: startedAt, runEndTime, nextEndTime, lastCompletedAt: null, status: 'error', recordCount: previousCount, errorCode })
    return jsonFailure(502, 'sync_failed', 'Google Health 同步失敗。')
  }
}

export const handler = createNetlifyHandler(fetchHandler)

export const config: Config = { method: 'POST' }
