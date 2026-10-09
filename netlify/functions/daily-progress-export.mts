import type { Config } from '@netlify/functions'
import { assessDailyProgress } from '../lib/daily-progress'
import { getServerEnvironment } from '../lib/env'
import { healthDate, shiftHealthDate } from '../lib/health-day'
import { createNetlifyHandler } from '../lib/netlify-handler'
import { DashboardSummaryRepository } from '../lib/repositories/dashboard-summary-repository'
import { SettingsRepository } from '../lib/repositories/settings-repository'
import { jsonFailure, jsonSuccess } from '../lib/response'
import { readSession } from '../lib/session'

/**
 * Private, session-authenticated and read-only daily snapshot.
 * No public token, API key in a URL, or raw OAuth credentials are exposed.
 * Intended for the signed-in dashboard and user-initiated export.
 */
const fetchHandler = async (request: Request): Promise<Response> => {
  const user = await readSession(request, getServerEnvironment().SESSION_SECRET)
  if (!user) return jsonFailure(401, 'unauthenticated', '請先使用 Google 登入。')

  const today = healthDate(new Date())
  const dates = Array.from({ length: 7 }, (_, index) => shiftHealthDate(today, index - 6))
  const repository = new DashboardSummaryRepository()
  const [documents, settings] = await Promise.all([
    repository.getMany(user.id, dates),
    new SettingsRepository().get(user.id),
  ])
  const days = dates.map((date, index) => {
    const doc = documents[index]
    return {
      date,
      synced: doc?.synced ?? false,
      hasRecords: doc?.hasRecords ?? false,
      lastUpdatedAt: doc?.lastUpdatedAt ?? null,
      steps: doc?.summary.steps ?? null,
      activeMinutes: doc?.summary.activeMinutes ?? null,
      exerciseMinutes: doc?.summary.exerciseMinutes ?? null,
      weightKg: doc?.summary.weightKg ?? null,
      activeCalories: doc?.summary.activeCalories ?? null,
      totalCalories: doc?.summary.totalCalories ?? null,
    }
  })
  return jsonSuccess({
    timezone: 'Asia/Taipei',
    generatedAt: new Date().toISOString(),
    stepGoal: settings?.dailyStepGoal ?? 8000,
    weightGoalKg: settings?.weightGoalKg ?? null,
    days,
    assessment: assessDailyProgress(days, settings?.dailyStepGoal ?? 8000, settings?.weightGoalKg ?? null),
  })
}

export const handler = createNetlifyHandler(fetchHandler)
export const config: Config = { method: 'GET' }
