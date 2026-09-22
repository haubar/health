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
import { GoogleHealthApiError, GoogleHealthProvider } from '../../lib/google-health'
import { blobKeys } from '../../lib/keys'
import { createBlobStore } from '../../lib/blobs'
import { AuthRepository } from '../../lib/repositories/auth-repository'
import { DashboardSummaryRepository, emptyDashboardSummary } from '../../lib/repositories/dashboard-summary-repository'
import { HealthRecordRepository } from '../../lib/repositories/health-record-repository'
import { SettingsRepository } from '../../lib/repositories/settings-repository'
import { SyncRepository } from '../../lib/repositories/sync-repository'
import { ScheduledSyncRepository } from '../../lib/repositories/scheduled-sync-repository'

const BACKFILL_EMPTY_DAY_LIMIT = 90

async function fetchRecords(provider: GoogleHealthProvider, start: Date, end: Date) {
  const [activity, weight, bodyFat, workouts] = await Promise.all([
    provider.getActivity({ start, end }), provider.getWeight({ start, end }),
    provider.getBodyFat({ start, end }), provider.getWorkouts({ start, end }),
  ])
  return [...activity, ...weight, ...bodyFat, ...workouts]
}

function retryDelayMs(error: unknown, attempt: number): number {
  const base = error instanceof GoogleHealthApiError && error.status === 429 ? 30 * 60_000 : 5 * 60_000
  return Math.min(base * (2 ** Math.max(0, attempt - 1)), 12 * 60 * 60_000)
}

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
    const start = healthDayStart(shiftHealthDate(today, -1))
    const end = now
    const provider = new GoogleHealthProvider(userId, decryptSecret(auth.encryptedRefreshToken, env.HEALTH_TOKEN_ENCRYPTION_KEY), env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET)
    let records: Awaited<ReturnType<typeof fetchRecords>>
    let write: Awaited<ReturnType<HealthRecordRepository['setMany']>>
    try {
      records = await fetchRecords(provider, start, end)
      write = await new HealthRecordRepository().setMany(records)
    } catch (error) {
      console.error('daily-health-analysis recent sync failed', {
        userId,
        name: error instanceof Error ? error.name : 'unknown_error',
        status: error instanceof GoogleHealthApiError ? error.status : undefined,
        apiRequests: provider.requestCount,
      })
      continue
    }
    let backfillStart: Date | null = null
    let backfillEnd: Date | null = null
    let backfillStatus: string = 'paused_manual_sync'
    const scheduledRepository = new ScheduledSyncRepository()
    const syncRepository = new SyncRepository()
    let scheduledState = await scheduledRepository.get(userId)
    const manualState = await syncRepository.get(userId)
    const manualCursor = manualState?.nextEndTime ? Date.parse(manualState.nextEndTime) : Number.POSITIVE_INFINITY
    const scheduledCursor = scheduledState?.nextEndTime ? Date.parse(scheduledState.nextEndTime) : Number.POSITIVE_INFINITY
    const hasOlderManualCursor = manualCursor < scheduledCursor
    if ((scheduledState?.status !== 'complete' || hasOlderManualCursor) && manualState?.status !== 'running') {
      const cutoff = healthDayStart(shiftHealthDate(today, -7))
      const cursorTime = Math.min(manualCursor, scheduledCursor, cutoff.getTime())
      backfillEnd = new Date(cursorTime)
      backfillStart = new Date(cursorTime - 24 * 60 * 60 * 1000)
      if (scheduledState?.retryAt && Date.parse(scheduledState.retryAt) > now.getTime()) {
        backfillStatus = 'retry_deferred'
        console.log('daily-health-analysis backfill deferred', { userId, retryAt: scheduledState.retryAt, attemptCount: scheduledState.attemptCount })
        backfillStart = null
        backfillEnd = null
      } else {
        try {
          const backfillRecords = await fetchRecords(provider, backfillStart, backfillEnd)
          const backfillWrite = await new HealthRecordRepository().setMany(backfillRecords)
          records = [...records, ...backfillRecords]
          write = {
            fetchedCount: write.fetchedCount + backfillWrite.fetchedCount,
            uniqueBlobCount: write.uniqueBlobCount + backfillWrite.uniqueBlobCount,
            verifiedBlobCount: write.verifiedBlobCount + backfillWrite.verifiedBlobCount,
          }
          const consecutiveEmptyDays = backfillRecords.length ? 0 : (scheduledState?.consecutiveEmptyDays ?? 0) + 1
          scheduledState = {
            userId,
            status: consecutiveEmptyDays >= BACKFILL_EMPTY_DAY_LIMIT ? 'complete' : 'backfilling',
            nextEndTime: backfillStart.toISOString(),
            consecutiveEmptyDays,
            attemptCount: 0,
            retryAt: null,
            lastSuccessfulAt: new Date().toISOString(),
            lastErrorCode: null,
          }
          await scheduledRepository.set(userId, scheduledState)
          backfillStatus = scheduledState.status
          console.log('daily-health-analysis backfill completed', {
            userId, start: backfillStart.toISOString(), end: backfillEnd.toISOString(),
            records: backfillWrite.fetchedCount, consecutiveEmptyDays, status: scheduledState.status,
          })
        } catch (error) {
          const attemptCount = (scheduledState?.attemptCount ?? 0) + 1
          const retryAt = new Date(Date.now() + retryDelayMs(error, attemptCount)).toISOString()
          const errorCode = error instanceof GoogleHealthApiError ? `google_health_${error.status}` : error instanceof Error ? error.name : 'backfill_failed'
          scheduledState = {
            userId,
            status: 'backfilling',
            nextEndTime: backfillEnd.toISOString(),
            consecutiveEmptyDays: scheduledState?.consecutiveEmptyDays ?? 0,
            attemptCount,
            retryAt,
            lastSuccessfulAt: scheduledState?.lastSuccessfulAt ?? null,
            lastErrorCode: errorCode,
          }
          await scheduledRepository.set(userId, scheduledState)
          backfillStatus = 'retry_scheduled'
          console.error('daily-health-analysis backfill failed', {
            userId, start: backfillStart.toISOString(), end: backfillEnd.toISOString(),
            name: error instanceof Error ? error.name : 'unknown_error',
            status: error instanceof GoogleHealthApiError ? error.status : undefined,
            attemptCount, retryAt,
          })
          backfillStart = null
          backfillEnd = null
        }
      }
    } else if (scheduledState?.status === 'complete' && !hasOlderManualCursor) {
      backfillStatus = 'complete'
    }
    const summaries = aggregateDailyHealthRecords(records)
    const summaryByDate = new Map(summaries.map((summary) => [summary.date, summary]))
    const summaryRepository = new DashboardSummaryRepository()
    const affectedDates = [...new Set([
      ...healthDatesInRange(start, end),
      ...(backfillStart && backfillEnd ? healthDatesInRange(backfillStart, backfillEnd) : []),
    ])].sort()
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
    console.log('daily-health-analysis completed', {
      userId, start: start.toISOString(), end: end.toISOString(), records: write.fetchedCount,
      verified: write.verifiedBlobCount, affectedDates: affectedDates.length,
      apiRequests: provider.requestCount, backfillStatus,
    })
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
