import type { Config } from '@netlify/functions'
import { healthDate } from '../lib/health-day'
import { createNetlifyHandler } from '../lib/netlify-handler'
import { makePublicSteps } from '../lib/public-steps'
import { AuthRepository } from '../lib/repositories/auth-repository'
import { DashboardSummaryRepository } from '../lib/repositories/dashboard-summary-repository'
import { SettingsRepository } from '../lib/repositories/settings-repository'
import { jsonFailure, jsonSuccess } from '../lib/response'

const fetchHandler = async (request: Request): Promise<Response> => {
  if (request.method !== 'GET') return jsonFailure(405, 'method_not_allowed', '只支援 GET。')
  const userIds = await new AuthRepository().listConnectedUserIds()
  if (userIds.length !== 1) return jsonFailure(503, 'unavailable', '公開摘要暫時無法提供。')
  const userId = userIds[0]!
  const date = healthDate(new Date())
  const [day, settings] = await Promise.all([
    new DashboardSummaryRepository().get(userId, date),
    new SettingsRepository().get(userId),
  ])
  return jsonSuccess(makePublicSteps(
    date,
    day?.summary.steps ?? null,
    settings?.dailyStepGoal ?? 8000,
    day?.synced ?? false,
    day?.lastUpdatedAt ?? null,
  ))
}

export const handler = createNetlifyHandler(fetchHandler)
export const config: Config = { method: 'GET' }
