import type { Config } from '@netlify/functions'
import { aggregateDailyHealthRecords } from '@health/shared'
import { decryptSecret } from '../lib/crypto'
import { getServerEnvironment } from '../lib/env'
import { healthDate, healthDayStart, nextHealthDayStart, shiftHealthDate } from '../lib/health-day'
import { GoogleHealthProvider } from '../lib/google-health'
import { jsonFailure, jsonSuccess } from '../lib/response'
import { AuthRepository } from '../lib/repositories/auth-repository'
import { DashboardSummaryRepository, emptyDashboardSummary } from '../lib/repositories/dashboard-summary-repository'
import { HealthRecordRepository } from '../lib/repositories/health-record-repository'
import { SyncRepository } from '../lib/repositories/sync-repository'
import { readSession } from '../lib/session'
import { createNetlifyHandler } from '../lib/netlify-handler'

const DEFAULT_LOOKBACK_DAYS = 10
const BATCH_DAYS = 1
const BATCH_COUNT = DEFAULT_LOOKBACK_DAYS / BATCH_DAYS

const fetchHandler = async (request: Request): Promise<Response> => {
  const env = getServerEnvironment()
  const user = await readSession(request, env.SESSION_SECRET)
  if (!user) return jsonFailure(401, 'unauthenticated', '請先使用 Google 登入。')

  const auth = await new AuthRepository().get(user.id)
  if (!auth || auth.status !== 'connected') return jsonFailure(409, 'health_not_connected', '尚未連結 Google Health。')

  let payload: { batch?: unknown; runStartedAt?: unknown; forceDate?: unknown }
  try {
    payload = await request.json() as { batch?: unknown; runStartedAt?: unknown; forceDate?: unknown }
  } catch {
    return jsonFailure(400, 'invalid_sync_batch', '同步批次參數無效。')
  }
  const batch = payload.batch
  if (typeof batch !== 'number' || !Number.isInteger(batch) || batch < 0 || batch >= BATCH_COUNT) {
    return jsonFailure(400, 'invalid_sync_batch', '同步批次參數無效。')
  }

  // One-day forced refresh is isolated from the ten-day backfill cursor.
  // Only dates visible in the private seven-day report may be refreshed.
  if (payload.forceDate !== undefined) {
    const today = healthDate(new Date())
    const oldest = shiftHealthDate(today, -6)
    if (batch !== 0 || typeof payload.forceDate !== 'string' || !/^\\d{4}-\\d{2}-\\d{2}$/.test(payload.forceDate)
      || payload.forceDate < oldest || payload.forceDate > today) {
      return jsonFailure(400, 'invalid_force_date', '僅可重新同步最近七天的單一日期。')
    }
    const start = healthDayStart(payload.forceDate)
    const end = healthDayStart(shiftHealthDate(payload.forceDate, 1))
    try {
      const provider = new GoogleHealthProvider(user.id, decryptSecret(auth.encryptedRefreshToken, env.HEALTH_TOKEN_ENCRYPTION_KEY), env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET)
      const [activity, weight, bodyFat, workouts, totalCalories] = await Promise.all([
        provider.getActivity({ start, end }), provider.getWeight({ start, end }),
        provider.getBodyFat({ start, end }), provider.getWorkouts({ start, end }),
        provider.getTotalCalories({ start, end }),
      ])
      const records = [...activity, ...weight, ...bodyFat, ...workouts, ...totalCalories]
      await new HealthRecordRepository().setMany(records)
      const summary = aggregateDailyHealthRecords(records).find((item) => item.date === payload.forceDate)
      let latestRecordTime = Number.NEGATIVE_INFINITY
      for (const record of records) latestRecordTime = Math.max(latestRecordTime, Date.parse(record.startTime))
      await new DashboardSummaryRepository().set(user.id, payload.forceDate, {
        summary: summary ?? emptyDashboardSummary(payload.forceDate),
        lastUpdatedAt: Number.isFinite(latestRecordTime) ? new Date(latestRecordTime).toISOString() : null,
        hasRecords: records.length > 0,
        synced: true,
      })
      return jsonSuccess({ date: payload.forceDate, recordCount: records.length, synced: true })
    } catch (error) {
      console.error('sync-health forced daily refresh failed', { date: payload.forceDate, name: error instanceof Error ? error.name : 'unknown_error' })
      return jsonFailure(502, 'daily_sync_failed', '指定日期重新同步失敗。')
    }
  }

  const syncRepository = new SyncRepository()
  const previousState = await syncRepository.get(user.id)
  if (batch > 0 && (previousState?.status !== 'running' || typeof payload.runStartedAt !== 'string' || payload.runStartedAt !== previousState.lastStartedAt)) {
    return jsonFailure(409, 'sync_batch_out_of_order', '同步批次已失效，請重新開始同步。')
  }
  const startedAt = batch === 0 ? new Date().toISOString() : previousState!.lastStartedAt!
  // Every click starts at the latest Taipei day; skip days already synced,
  // and move backwards until ten previously unsynced days have been filled.
  const runEndTime = batch === 0
    ? nextHealthDayStart(new Date(startedAt)).toISOString()
    : previousState!.runEndTime!
  const nextEndTime = batch === 0 ? runEndTime : previousState!.nextEndTime!
  const previousCount = batch === 0 ? 0 : previousState!.recordCount
  await syncRepository.set(user.id, { userId: user.id, lastStartedAt: startedAt, runEndTime, nextEndTime, lastCompletedAt: null, status: 'running', recordCount: previousCount, errorCode: null })

  try {
    const summaryRepository = new DashboardSummaryRepository()
    // Cursor is persisted after every batch so existing dates are skipped without
    // consuming one of the ten requested backfill slots.
    let end = new Date(nextEndTime)
    let start = new Date(end)
    let existing = null
    let scanned = 0
    do {
      start = new Date(end)
      start.setUTCDate(start.getUTCDate() - BATCH_DAYS)
      existing = await summaryRepository.get(user.id, healthDate(start))
      scanned++
      if (!existing?.synced) break
      end = start
    } while (scanned < 730)
    if (existing?.synced) throw new Error('sync_history_limit_reached')
    const provider = new GoogleHealthProvider(user.id, decryptSecret(auth.encryptedRefreshToken, env.HEALTH_TOKEN_ENCRYPTION_KEY), env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET)
    const [activity, weight, bodyFat, workouts, totalCalories] = await Promise.all([provider.getActivity({ start, end }), provider.getWeight({ start, end }), provider.getBodyFat({ start, end }), provider.getWorkouts({ start, end }), provider.getTotalCalories({ start, end })])
    const records = [...activity, ...weight, ...bodyFat, ...workouts, ...totalCalories]
    const recordCounts = { activity: activity.length, weight: weight.length, bodyFat: bodyFat.length, workouts: workouts.length, totalCalories: totalCalories.length }
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
    await syncRepository.set(user.id, { userId: user.id, lastStartedAt: startedAt, runEndTime, nextEndTime: start.toISOString(), lastCompletedAt: completedAt, status: done ? 'idle' : 'running', recordCount: totalRecordCount, errorCode: null })
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
