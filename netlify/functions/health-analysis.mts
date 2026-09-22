import type { Config } from '@netlify/functions'
import { DEFAULT_DAILY_STEP_GOAL, DEFAULT_WEEKLY_EXERCISE_MINUTES_GOAL, mean, type HealthAnalysisData, type HealthInsight, type TimelineEvent, type WeeklyHealthSummary } from '@health/shared'
import { createBlobStore } from '../lib/blobs'
import { getServerEnvironment } from '../lib/env'
import { healthDate, shiftHealthDate } from '../lib/health-day'
import { blobKeys } from '../lib/keys'
import { jsonFailure, jsonSuccess } from '../lib/response'
import { readSession } from '../lib/session'
import { createNetlifyHandler } from '../lib/netlify-handler'
import { DashboardSummaryRepository } from '../lib/repositories/dashboard-summary-repository'
import { SettingsRepository } from '../lib/repositories/settings-repository'

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
  const previousWeekStart = shiftHealthDate(weekStart(today), -7)
  const scoreDates = Array.from({ length: 30 }, (_, index) => shiftHealthDate(today, -index - 1))
  const timelineMonths = Array.from({ length: 4 }, (_, index) => {
    const date = new Date(`${today}T00:00:00Z`)
    date.setUTCDate(1)
    date.setUTCMonth(date.getUTCMonth() - index)
    return date.toISOString().slice(0, 7)
  })
  const trendDates = Array.from({ length: 90 }, (_, index) => shiftHealthDate(today, -89 + index))
  const activityWeekDates = Array.from({ length: 7 }, (_, index) => shiftHealthDate(previousWeekStart, index))
  const summaryRepository = new DashboardSummaryRepository()
  const [insightDocuments, timelineValues, weeklySummary, settings, trendDays, activityWeekDays] = await Promise.all([
    Promise.all(scoreDates.map((date) => store.getJson(blobKeys.insight(user.id, date), 'strong'))),
    Promise.all(timelineMonths.map((month) => store.getJson(blobKeys.timelineMonth(user.id, month), 'strong'))),
    store.getJson(blobKeys.weeklySummary(user.id, previousWeekStart), 'strong'),
    new SettingsRepository().get(user.id),
    summaryRepository.getMany(user.id, trendDates),
    summaryRepository.getMany(user.id, activityWeekDates),
  ])
  const typedWeeklySummary = weeklySummary as WeeklyHealthSummary | null

  const insights: HealthInsight[] = insightDocuments.flatMap((value) => {
    if (typeof value !== 'object' || value === null) return []
    const dayInsights = (value as { insights?: unknown }).insights
    return Array.isArray(dayInsights) ? dayInsights as HealthInsight[] : []
  })
  const uniqueInsights = [...new Map(insights.map((insight) => [insight.id, insight])).values()]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))

  const timeline: TimelineEvent[] = timelineValues.flatMap((value) => Array.isArray(value) ? value as TimelineEvent[] : [])
    .sort((left, right) => right.date.localeCompare(left.date))

  const weightPoints = trendDays.flatMap((day, index) => day?.summary.weightKg === null || !day?.hasRecords
    ? []
    : [{ date: trendDates[index]!, weightKg: day.summary.weightKg }])
  const latestWeight = weightPoints[weightPoints.length - 1] ?? null
  const firstWeight = weightPoints[0] ?? null
  const changeDays = firstWeight && latestWeight
    ? Math.floor((Date.parse(`${latestWeight.date}T00:00:00Z`) - Date.parse(`${firstWeight.date}T00:00:00Z`)) / 86_400_000)
    : null
  const changeKg = weightPoints.length >= 3 && changeDays !== null && changeDays >= 14
    ? latestWeight!.weightKg - firstWeight!.weightKg
    : null
  const activityWeekStart = previousWeekStart
  const activitySummaries = activityWeekDays.map((day) => day?.hasRecords ? day.summary : null)
  const trackedStepDays = activitySummaries.filter((day) => day?.steps !== null && day !== null)
  const exerciseDays = activitySummaries.filter((day) => day?.exerciseMinutes !== null && day !== null)
  const recordedExerciseMinutes = exerciseDays.length
    ? exerciseDays.reduce((sum, day) => sum + (day?.exerciseMinutes ?? 0), 0)
    : null
  const data: HealthAnalysisData = {
    weeklySummary: typedWeeklySummary, insights: uniqueInsights, timeline,
    weightLoss: {
      latestKg: latestWeight?.weightKg ?? null,
      latestDate: latestWeight?.date ?? null,
      targetKg: settings?.weightGoalKg ?? null,
      kgToGoal: latestWeight && settings?.weightGoalKg !== null && settings?.weightGoalKg !== undefined
        ? latestWeight.weightKg - settings.weightGoalKg
        : null,
      changeKg,
      changeDays,
      sampleCount90d: weightPoints.length,
      points: weightPoints,
    },
    activityWeek: {
      weekStart: activityWeekStart,
      averageSteps: mean(trackedStepDays.map((day) => day!.steps)),
      stepGoal: settings?.dailyStepGoal ?? DEFAULT_DAILY_STEP_GOAL,
      stepGoalDays: trackedStepDays.filter((day) => (day?.steps ?? 0) >= (settings?.dailyStepGoal ?? DEFAULT_DAILY_STEP_GOAL)).length,
      stepTrackedDays: trackedStepDays.length,
      recordedExerciseMinutes,
      exerciseTrackedDays: exerciseDays.length,
      exerciseGoalMinutes: settings?.weeklyExerciseMinutesGoal ?? DEFAULT_WEEKLY_EXERCISE_MINUTES_GOAL,
    },
  }
  return jsonSuccess(data)
}

export const handler = createNetlifyHandler(fetchHandler)
export const config: Config = { method: 'GET' }
