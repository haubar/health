import type { Config } from '@netlify/functions'
import type { HealthAnalysisData, HealthInsight, TimelineEvent, WeeklyHealthSummary } from '@health/shared'
import { createBlobStore } from '../lib/blobs'
import { getServerEnvironment } from '../lib/env'
import { healthDate, shiftHealthDate } from '../lib/health-day'
import { blobKeys } from '../lib/keys'
import { jsonFailure, jsonSuccess } from '../lib/response'
import { readSession } from '../lib/session'
import { createNetlifyHandler } from '../lib/netlify-handler'

function weekStart(date: string): string {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() - ((value.getUTCDay() + 6) % 7))
  return value.toISOString().slice(0, 10)
}

const fetchHandler = async (request: Request): Promise<Response> => {
  const env = getServerEnvironment()
  const user = await readSession(request, env.SESSION_SECRET)
  if (!user) return jsonFailure(401, 'unauthenticated', '請先使用 Google 登入。')

  const store = createBlobStore('health-analytics')
  const today = healthDate(new Date())
  const scoreDates = Array.from({ length: 30 }, (_, index) => shiftHealthDate(today, -index - 1))
  const [scoreDocuments, insightDocuments] = await Promise.all([
    Promise.all(scoreDates.map((date) => store.getJson(blobKeys.score(user.id, date), 'strong'))),
    Promise.all(scoreDates.map((date) => store.getJson(blobKeys.insight(user.id, date), 'strong'))),
  ])
  let score: HealthAnalysisData['score'] = null
  let scoreDate: string | null = null
  for (const [index, document] of scoreDocuments.entries()) {
    if (typeof document !== 'object' || document === null) continue
    const overall = (document as { overallScore?: HealthAnalysisData['score'] }).overallScore
    if (overall?.calculable && overall.score !== null) {
      score = overall
      scoreDate = scoreDates[index]!
      break
    }
  }

  const insights: HealthInsight[] = insightDocuments.flatMap((value) => {
    if (typeof value !== 'object' || value === null) return []
    const dayInsights = (value as { insights?: unknown }).insights
    return Array.isArray(dayInsights) ? dayInsights as HealthInsight[] : []
  })
  const uniqueInsights = [...new Map(insights.map((insight) => [insight.id, insight])).values()]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))

  const timelineMonths = Array.from({ length: 4 }, (_, index) => {
    const date = new Date(`${today}T00:00:00Z`)
    date.setUTCDate(1)
    date.setUTCMonth(date.getUTCMonth() - index)
    return date.toISOString().slice(0, 7)
  })
  const timelineValues = await Promise.all(timelineMonths.map((month) => store.getJson(blobKeys.timelineMonth(user.id, month), 'strong')))
  const timeline: TimelineEvent[] = timelineValues.flatMap((value) => Array.isArray(value) ? value as TimelineEvent[] : [])
    .sort((left, right) => right.date.localeCompare(left.date))

  const previousWeekStart = shiftHealthDate(weekStart(today), -7)
  const weeklySummary = await store.getJson(blobKeys.weeklySummary(user.id, previousWeekStart), 'strong') as WeeklyHealthSummary | null
  const data: HealthAnalysisData = { score, scoreDate, weeklySummary, insights: uniqueInsights, timeline }
  return jsonSuccess(data)
}

export const handler = createNetlifyHandler(fetchHandler)
export const config: Config = { method: 'GET' }
