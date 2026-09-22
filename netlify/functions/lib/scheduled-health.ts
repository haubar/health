import {
  aggregateDailyHealthRecords,
  calculateActivityScore,
  calculateBodyScore,
  calculateOverallScore,
  generateInsights,
  generateTimeline,
  mean,
} from '@health/shared'
import { decryptSecret } from '../../lib/crypto'
import { getServerEnvironment } from '../../lib/env'
import { healthDate, healthDayStart, healthDatesInRange, shiftHealthDate } from '../../lib/health-day'
import { GoogleHealthProvider } from '../../lib/google-health'
import { blobKeys } from '../../lib/keys'
import { createBlobStore } from '../../lib/blobs'
import { AuthRepository } from '../../lib/repositories/auth-repository'
import { DashboardSummaryRepository, emptyDashboardSummary } from '../../lib/repositories/dashboard-summary-repository'
import { HealthRecordRepository } from '../../lib/repositories/health-record-repository'
import { SettingsRepository } from '../../lib/repositories/settings-repository'
import { SyncRepository } from '../../lib/repositories/sync-repository'

export async function runDailyHealthAnalysis(): Promise<void> {
  const env = getServerEnvironment()
  const authRepository = new AuthRepository()
  const userIds = await authRepository.listConnectedUserIds()
  console.log('daily-health-analysis started', { connectedUsers: userIds.length })

  for (const userId of userIds) {
    const auth = await authRepository.get(userId)
    if (!auth || auth.status !== 'connected') continue
    const now = new Date()
    const today = healthDate(now)
    const firstDate = shiftHealthDate(today, -2)
    const start = healthDayStart(firstDate)
    const end = now
    const provider = new GoogleHealthProvider(userId, decryptSecret(auth.encryptedRefreshToken, env.HEALTH_TOKEN_ENCRYPTION_KEY), env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET)
    const [activity, weight, bodyFat, workouts] = await Promise.all([
      provider.getActivity({ start, end }), provider.getWeight({ start, end }),
      provider.getBodyFat({ start, end }), provider.getWorkouts({ start, end }),
    ])
    const records = [...activity, ...weight, ...bodyFat, ...workouts]
    const write = await new HealthRecordRepository().setMany(records)
    const summaries = aggregateDailyHealthRecords(records)
    const summaryByDate = new Map(summaries.map((summary) => [summary.date, summary]))
    const summaryRepository = new DashboardSummaryRepository()
    const affectedDates = healthDatesInRange(start, end)
    const latestByDate = new Map<string, number>()
    for (const record of records) {
      const date = healthDate(new Date(record.startTime))
      latestByDate.set(date, Math.max(latestByDate.get(date) ?? Number.NEGATIVE_INFINITY, Date.parse(record.startTime)))
    }
    await summaryRepository.setMany(userId, affectedDates.map((date) => ({
      date,
      value: {
        summary: summaryByDate.get(date) ?? emptyDashboardSummary(date),
        lastUpdatedAt: Number.isFinite(latestByDate.get(date)) ? new Date(latestByDate.get(date)!).toISOString() : null,
        hasRecords: summaryByDate.has(date),
      },
    })))

    const timelineDays = healthDatesInRange(healthDayStart(shiftHealthDate(today, -89)), healthDayStart(shiftHealthDate(today, 1)))
    const storedDays = await summaryRepository.getMany(userId, timelineDays)
    const available = storedDays.map((day, index) => day?.summary ?? emptyDashboardSummary(timelineDays[index]!))
      .sort((a, b) => a.date.localeCompare(b.date))
    const scoreSummaries = available.filter((summary) => summary.date >= shiftHealthDate(today, -29))
    const bodySummaries = available.filter((summary) => summary.date >= shiftHealthDate(today, -89))
    const settings = await new SettingsRepository().get(userId)
    const analyticsStore = createBlobStore('health-analytics')
    const runAt = new Date().toISOString()
    for (const date of affectedDates.filter((day) => day < today)) {
      const throughDate = scoreSummaries.filter((summary) => summary.date <= date)
      const rawActivityScore = calculateActivityScore(throughDate, settings ?? undefined)
      const activityDays = throughDate.filter((summary) => summary.steps !== null || summary.exerciseMinutes !== null || summary.activeMinutes !== null).length
      const activityScore = {
        ...rawActivityScore,
        calculable: rawActivityScore.calculable && activityDays >= 7,
        details: { ...rawActivityScore.details, observedDays: activityDays, minimumObservedDays: 7 },
      }
      const throughBodyDate = bodySummaries.filter((summary) => summary.date <= date)
      const bodyObservations = throughBodyDate.filter((summary) => summary.weightKg !== null || summary.bodyFatPercentage !== null).length
      const rawBodyScore = calculateBodyScore(throughBodyDate, settings ?? undefined)
      const bodyScore = {
        ...rawBodyScore,
        calculable: rawBodyScore.calculable && bodyObservations >= 3,
        details: { ...rawBodyScore.details, observedMeasurements: bodyObservations, minimumMeasurements: 3 },
      }
      const overallScore = calculateOverallScore(activityScore, bodyScore)
      await analyticsStore.setJson(blobKeys.score(userId, date), {
        date, activityScore, bodyScore, overallScore,
        dataCompleteness: overallScore.completeness,
        details: { activity: activityScore.details, body: bodyScore.details },
        algorithmVersion: overallScore.algorithmVersion,
      })
      const insightSummaries = available.filter((summary) => summary.date <= date).slice(-37)
      await analyticsStore.setJson(blobKeys.insight(userId, date), { date, insights: generateInsights(insightSummaries, settings ?? undefined, runAt) })
    }
    const events = generateTimeline(available, settings ?? undefined)
    const timelineMonths = [...new Set([...timelineDays.map((date) => date.slice(0, 7)), today.slice(0, 7)])]
    for (const month of timelineMonths) {
      await analyticsStore.setJson(blobKeys.timelineMonth(userId, month), events.filter((event) => event.date.startsWith(month)))
    }
    await authRepository.set(userId, { ...auth, lastSyncAt: runAt, updatedAt: runAt })
    const syncRepository = new SyncRepository()
    const prior = await syncRepository.get(userId)
    await syncRepository.set(userId, {
      userId,
      lastStartedAt: prior?.lastStartedAt ?? null,
      runEndTime: prior?.runEndTime ?? null,
      nextEndTime: prior?.nextEndTime ?? null,
      lastCompletedAt: prior?.lastCompletedAt ?? null,
      status: prior?.status ?? 'idle',
      recordCount: prior?.recordCount ?? 0,
      errorCode: prior?.errorCode ?? null,
      scheduledLastRunAt: runAt,
    })
    console.log('daily-health-analysis completed', { userId, start: start.toISOString(), end: end.toISOString(), records: write.fetchedCount, verified: write.verifiedBlobCount, affectedDates: affectedDates.length })
  }
}

function weekStart(date: string): string {
  const value = new Date(`${date}T00:00:00Z`)
  const day = value.getUTCDay()
  value.setUTCDate(value.getUTCDate() - ((day + 6) % 7))
  return value.toISOString().slice(0, 10)
}

export async function runWeeklyHealthSummary(): Promise<void> {
  const today = healthDate(new Date())
  const currentWeekStart = weekStart(today)
  const previousWeekStart = shiftHealthDate(currentWeekStart, -7)
  const priorWeekStart = shiftHealthDate(currentWeekStart, -14)
  const store = createBlobStore('health-analytics')
  const summaryRepository = new DashboardSummaryRepository()
  const userIds = await new AuthRepository().listConnectedUserIds()
  for (const userId of userIds) {
    const dates = healthDatesInRange(healthDayStart(previousWeekStart), healthDayStart(currentWeekStart))
    const previous = (await summaryRepository.getMany(userId, dates)).flatMap((day) => day?.hasRecords ? [day.summary] : [])
    const priorDates = healthDatesInRange(healthDayStart(priorWeekStart), healthDayStart(previousWeekStart))
    const prior = (await summaryRepository.getMany(userId, priorDates)).flatMap((day) => day?.hasRecords ? [day.summary] : [])
    const averageSteps = mean(previous.map((day) => day.steps))
    const exerciseValues = previous.flatMap((day) => day.exerciseMinutes === null ? [] : [day.exerciseMinutes])
    const totalExerciseMinutes = exerciseValues.length ? exerciseValues.reduce((sum, value) => sum + value, 0) : null
    const weights = previous.flatMap((day) => day.weightKg === null ? [] : [day.weightKg])
    const previousScoreDates = dates.map((date) => blobKeys.score(userId, date))
    const priorScoreDates = priorDates.map((date) => blobKeys.score(userId, date))
    const [previousScores, priorScores] = await Promise.all([
      Promise.all(previousScoreDates.map((key) => store.getJson(key, 'strong'))),
      Promise.all(priorScoreDates.map((key) => store.getJson(key, 'strong'))),
    ])
    const scoreMean = (values: unknown[]) => mean(values.flatMap((value) => {
      if (typeof value !== 'object' || value === null) return []
      const score = (value as { overallScore?: { score?: unknown } }).overallScore?.score
      return typeof score === 'number' ? [score] : []
    }))
    const currentHealthScore = scoreMean(previousScores)
    const priorHealthScore = scoreMean(priorScores)
    await store.setJson(blobKeys.weeklySummary(userId, previousWeekStart), {
      weekStart: previousWeekStart,
      weekEndExclusive: currentWeekStart,
      averageSteps,
      totalExerciseMinutes,
      weightTrendKg: weights.length >= 2 ? weights[weights.length - 1]! - weights[0]! : null,
      averageHealthScore: currentHealthScore,
      weekOverWeek: {
        averageSteps: averageSteps === null || mean(prior.map((day) => day.steps)) === null ? null : averageSteps - mean(prior.map((day) => day.steps))!,
        exerciseMinutes: totalExerciseMinutes === null || !prior.some((day) => day.exerciseMinutes !== null)
          ? null
          : totalExerciseMinutes - prior.reduce((sum, day) => sum + (day.exerciseMinutes ?? 0), 0),
        healthScore: currentHealthScore === null || priorHealthScore === null ? null : currentHealthScore - priorHealthScore,
      },
      generatedAt: new Date().toISOString(),
    })
  }
}
