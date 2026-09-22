import type { Config } from '@netlify/functions'
import { goalSettingsSchema, DEFAULT_DAILY_STEP_GOAL, DEFAULT_WEEKLY_EXERCISE_MINUTES_GOAL } from '@health/shared'
import { z } from 'zod'
import { getServerEnvironment } from '../lib/env'
import { jsonFailure, jsonSuccess } from '../lib/response'
import { SettingsRepository } from '../lib/repositories/settings-repository'
import { readSession } from '../lib/session'
import { createNetlifyHandler } from '../lib/netlify-handler'

const updateSchema = z.object({
  dailyStepGoal: z.number().int().min(500).max(60_000),
  weeklyExerciseMinutesGoal: z.number().int().min(30).max(1_000),
  weightGoalKg: z.number().min(25).max(400).nullable(),
})

const fetchHandler = async (request: Request): Promise<Response> => {
  const env = getServerEnvironment()
  const user = await readSession(request, env.SESSION_SECRET)
  if (!user) return jsonFailure(401, 'unauthenticated', '請先使用 Google 登入。')
  const repository = new SettingsRepository()
  if (request.method === 'GET') {
    const existing = await repository.get(user.id)
    const settings = existing ?? goalSettingsSchema.parse({
      dailyStepGoal: DEFAULT_DAILY_STEP_GOAL,
      weeklyExerciseMinutesGoal: DEFAULT_WEEKLY_EXERCISE_MINUTES_GOAL,
      weightGoalKg: null,
      units: 'metric',
      updatedAt: new Date().toISOString(),
    })
    return jsonSuccess(settings)
  }
  let payload: unknown
  try { payload = await request.json() } catch { return jsonFailure(400, 'invalid_settings', '目標設定格式無效。') }
  const parsed = updateSchema.safeParse(payload)
  if (!parsed.success) return jsonFailure(400, 'invalid_settings', '請檢查步數、運動時間與目標體重範圍。')
  const settings = goalSettingsSchema.parse({ ...parsed.data, units: 'metric', updatedAt: new Date().toISOString() })
  await repository.set(user.id, settings)
  return jsonSuccess(settings)
}

export const handler = createNetlifyHandler(fetchHandler)
export const config: Config = { method: ['GET', 'PUT'] }
