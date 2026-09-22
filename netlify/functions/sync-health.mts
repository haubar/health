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

const fetchHandler = async (request: Request): Promise<Response> => {
  const env = getServerEnvironment()
  const user = await readSession(request, env.SESSION_SECRET)
  if (!user) return jsonFailure(401, 'unauthenticated', '請先使用 Google 登入。')

  const auth = await new AuthRepository().get(user.id)
  if (!auth || auth.status !== 'connected') return jsonFailure(409, 'health_not_connected', '尚未連結 Google Health。')

  const startedAt = new Date().toISOString()
  const syncRepository = new SyncRepository()
  await syncRepository.set(user.id, { userId: user.id, lastStartedAt: startedAt, lastCompletedAt: null, status: 'running', recordCount: 0, errorCode: null })

  try {
    const end = new Date()
    const start = new Date(end)
    start.setUTCDate(start.getUTCDate() - DEFAULT_LOOKBACK_DAYS)
    const provider = new GoogleHealthProvider(user.id, decryptSecret(auth.encryptedRefreshToken, env.HEALTH_TOKEN_ENCRYPTION_KEY), env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET)
    const [activity, weight, bodyFat, workouts] = await Promise.all([provider.getActivity({ start, end }), provider.getWeight({ start, end }), provider.getBodyFat({ start, end }), provider.getWorkouts({ start, end })])
    const records = [...activity, ...weight, ...bodyFat, ...workouts]
    const recordCounts = { activity: activity.length, weight: weight.length, bodyFat: bodyFat.length, workouts: workouts.length }
    console.log('sync-health records fetched', recordCounts)
    const repository = new HealthRecordRepository()
    await repository.setMany(records)
    const completedAt = new Date().toISOString()
    await syncRepository.set(user.id, { userId: user.id, lastStartedAt: startedAt, lastCompletedAt: completedAt, status: 'idle', recordCount: records.length, errorCode: null })
    return jsonSuccess({ lastCompletedAt: completedAt, recordCount: records.length, recordCounts })
  } catch (error) {
    const errorCode = error instanceof Error ? error.constructor.name : 'sync_failed'
    console.error('sync-health failed', error instanceof Error ? { name: error.name, message: error.message } : { error: 'unknown_error' })
    await syncRepository.set(user.id, { userId: user.id, lastStartedAt: startedAt, lastCompletedAt: null, status: 'error', recordCount: 0, errorCode })
    return jsonFailure(502, 'sync_failed', 'Google Health 同步失敗。')
  }
}

export const handler = createNetlifyHandler(fetchHandler)

export const config: Config = { method: 'POST', background: true }
