import type { Config } from '@netlify/functions'
import { decryptSecret } from '../lib/crypto'
import { getServerEnvironment } from '../lib/env'
import { GoogleHealthProvider } from '../lib/google-health'
import { jsonFailure, jsonSuccess } from '../lib/response'
import { AuthRepository } from '../lib/repositories/auth-repository'
import { HealthRecordRepository } from '../lib/repositories/health-record-repository'
import { SyncRepository } from '../lib/repositories/sync-repository'
import { readSession } from '../lib/session'
import { createNetlifyHandler } from '../lib/netlify-handler'

const DEFAULT_LOOKBACK_DAYS = 30
const BATCH_DAYS = 5
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
  const previousState = batch === 0 ? null : await syncRepository.get(user.id)
  if (batch > 0 && (previousState?.status !== 'running' || typeof payload.runStartedAt !== 'string' || payload.runStartedAt !== previousState.lastStartedAt)) {
    return jsonFailure(409, 'sync_batch_out_of_order', '同步批次已失效，請重新開始同步。')
  }
  const startedAt = batch === 0 ? new Date().toISOString() : previousState!.lastStartedAt!
  const previousCount = batch === 0 ? 0 : previousState!.recordCount
  await syncRepository.set(user.id, { userId: user.id, lastStartedAt: startedAt, lastCompletedAt: null, status: 'running', recordCount: previousCount, errorCode: null })

  try {
    const end = new Date(Date.parse(startedAt))
    end.setUTCDate(end.getUTCDate() - batch * BATCH_DAYS)
    const start = new Date(end)
    start.setUTCDate(start.getUTCDate() - BATCH_DAYS)
    const provider = new GoogleHealthProvider(user.id, decryptSecret(auth.encryptedRefreshToken, env.HEALTH_TOKEN_ENCRYPTION_KEY), env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET)
    const [activity, weight, bodyFat, workouts] = await Promise.all([provider.getActivity({ start, end }), provider.getWeight({ start, end }), provider.getBodyFat({ start, end }), provider.getWorkouts({ start, end })])
    const records = [...activity, ...weight, ...bodyFat, ...workouts]
    const recordCounts = { activity: activity.length, weight: weight.length, bodyFat: bodyFat.length, workouts: workouts.length }
    console.log('sync-health records fetched', recordCounts)
    const repository = new HealthRecordRepository()
    await repository.setMany(records)
    const totalRecordCount = previousCount + records.length
    const done = batch === BATCH_COUNT - 1
    const completedAt = done ? new Date().toISOString() : null
    await syncRepository.set(user.id, { userId: user.id, lastStartedAt: startedAt, lastCompletedAt: completedAt, status: done ? 'idle' : 'running', recordCount: totalRecordCount, errorCode: null })
    return jsonSuccess({ runStartedAt: startedAt, lastCompletedAt: completedAt, recordCount: records.length, totalRecordCount, done, recordCounts })
  } catch (error) {
    const errorCode = error instanceof Error ? error.constructor.name : 'sync_failed'
    console.error('sync-health failed', error instanceof Error ? { name: error.name, message: error.message } : { error: 'unknown_error' })
    await syncRepository.set(user.id, { userId: user.id, lastStartedAt: startedAt, lastCompletedAt: null, status: 'error', recordCount: previousCount, errorCode })
    return jsonFailure(502, 'sync_failed', 'Google Health 同步失敗。')
  }
}

export const handler = createNetlifyHandler(fetchHandler)

export const config: Config = { method: 'POST' }
