import type { DailyHealthSummary, WorkoutSummary } from './dashboard'
import {
  DEFAULT_DAILY_STEP_GOAL,
  DEFAULT_WEEKLY_EXERCISE_MINUTES_GOAL,
  HEALTH_TIMEZONE,
  type GoalSettings,
} from './settings'
import type { HealthRecord } from './health'

export type NullableNumber = number | null

export type ScoreDimension = {
  score: number | null
  completeness: number
  calculable: boolean
  details: Record<string, number | null>
}

export type OverallScore = {
  score: number | null
  completeness: number
  calculable: boolean
  activity: ScoreDimension
  body: ScoreDimension
  algorithmVersion: 'health-score-v1'
}

export type HealthInsight = {
  id: string
  type: 'activity' | 'body'
  severity: 'info' | 'positive' | 'attention'
  title: string
  description: string
  metric?: string
  baseline?: number
  currentValue?: number
  createdAt: string
}

export type TimelineEvent = {
  id: string
  type: 'activity_streak' | 'weight_milestone' | 'exercise_milestone'
  date: string
  title: string
  description: string
}

export type WeeklyHealthSummary = {
  weekStart: string
  weekEndExclusive: string
  averageSteps: number | null
  totalExerciseMinutes: number | null
  weightTrendKg: number | null
  averageHealthScore: number | null
  weekOverWeek: {
    averageSteps: number | null
    exerciseMinutes: number | null
    healthScore: number | null
  }
  generatedAt: string
}

export type HealthAnalysisData = {
  weeklySummary: WeeklyHealthSummary | null
  insights: HealthInsight[]
  timeline: TimelineEvent[]
  weightLoss: {
    latestKg: number | null
    latestDate: string | null
    targetKg: number | null
    kgToGoal: number | null
    changeKg: number | null
    changeDays: number | null
    sampleCount90d: number
    points: Array<{ date: string; weightKg: number }>
  }
  activityWeek: {
    weekStart: string
    averageSteps: number | null
    stepGoal: number
    stepGoalDays: number
    stepTrackedDays: number
    recordedExerciseMinutes: number | null
    exerciseTrackedDays: number
    exerciseGoalMinutes: number
  }
}

type NumericRecord = HealthRecord & { value: number }

const DEFAULT_SETTINGS: GoalSettings = {
  dailyStepGoal: DEFAULT_DAILY_STEP_GOAL,
  weeklyExerciseMinutesGoal: DEFAULT_WEEKLY_EXERCISE_MINUTES_GOAL,
  weightGoalKg: null,
  units: 'metric',
  updatedAt: '1970-01-01T00:00:00.000Z',
}

function isNumericRecord(record: HealthRecord): record is NumericRecord {
  return typeof record.value === 'number' && Number.isFinite(record.value)
}

function timezoneDate(instant: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(instant))
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function emptyDay(date: string): DailyHealthSummary {
  return {
    date,
    steps: null,
    distanceKm: null,
    activeMinutes: null,
    exerciseMinutes: null,
    activeCalories: null,
    totalCalories: null,
    weightKg: null,
    bodyFatPercentage: null,
  }
}

function add(current: NullableNumber, value: number): number {
  return (current ?? 0) + value
}

function normalizedDistance(record: NumericRecord): number {
  if (record.unit === 'm' || record.unit === 'meter' || record.unit === 'meters') {
    return record.value / 1000
  }
  return record.value
}

function durationMinutes(record: HealthRecord): number | null {
  if (record.endTime) {
    const duration = (Date.parse(record.endTime) - Date.parse(record.startTime)) / 60_000
    if (Number.isFinite(duration) && duration >= 0) return duration
  }
  return isNumericRecord(record) ? record.value : null
}

/** Groups normalized records by the Asia/Taipei civil date without turning missing data into zero. */
export function aggregateDailyHealthRecords(
  records: HealthRecord[],
  timezone = HEALTH_TIMEZONE,
): DailyHealthSummary[] {
  const days = new Map<string, DailyHealthSummary>()
  const sorted = [...records].sort((a, b) => a.startTime.localeCompare(b.startTime))

  for (const record of sorted) {
    const date = timezoneDate(record.startTime, timezone)
    const day = days.get(date) ?? emptyDay(date)
    if (record.type === 'exercise') {
      const duration = durationMinutes(record)
      if (duration !== null) day.exerciseMinutes = add(day.exerciseMinutes, duration)
    } else if (isNumericRecord(record)) {
      switch (record.type) {
        case 'steps': day.steps = add(day.steps, record.value); break
        case 'distance': day.distanceKm = add(day.distanceKm, normalizedDistance(record)); break
        case 'active_calories': day.activeCalories = add(day.activeCalories, record.value); break
        case 'total_calories': day.totalCalories = add(day.totalCalories, record.value); break
        case 'active_minutes':
          day.activeMinutes = add(day.activeMinutes, record.value)
          break
        case 'weight': day.weightKg = record.value; break
        case 'body_fat': day.bodyFatPercentage = record.value; break
        default: break
      }
    }
    days.set(date, day)
  }

  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export function movingAverage(values: NullableNumber[], windowSize: number): NullableNumber[] {
  if (!Number.isInteger(windowSize) || windowSize < 1) throw new Error('windowSize must be positive')
  return values.map((_, index) => {
    const window = values.slice(Math.max(0, index - windowSize + 1), index + 1).filter(
      (value): value is number => value !== null && Number.isFinite(value),
    )
    return window.length ? window.reduce((sum, value) => sum + value, 0) / window.length : null
  })
}

export function mean(values: NullableNumber[]): number | null {
  const available = values.filter((value): value is number => value !== null && Number.isFinite(value))
  return available.length ? available.reduce((sum, value) => sum + value, 0) / available.length : null
}

export function personalBaseline(
  summaries: DailyHealthSummary[],
  metric: keyof Pick<DailyHealthSummary, 'steps' | 'activeMinutes' | 'exerciseMinutes' | 'weightKg'>,
  days = 30,
): number | null {
  return mean(summaries.slice(-days).map((summary) => summary[metric]))
}

function boundedScore(value: number): number {
  return Math.round(Math.max(0, Math.min(100, value)))
}

function goalAttainment(value: number | null, goal: number): number | null {
  return value === null ? null : boundedScore((value / goal) * 100)
}

function availableWeightedScore(
  components: Array<{ name: string; weight: number; score: number | null }>,
): ScoreDimension {
  const available = components.filter((component) => component.score !== null)
  const totalWeight = components.reduce((sum, component) => sum + component.weight, 0)
  const availableWeight = available.reduce((sum, component) => sum + component.weight, 0)
  const score = availableWeight
    ? boundedScore(available.reduce((sum, component) => sum + (component.score ?? 0) * component.weight, 0) / availableWeight)
    : null
  const completeness = totalWeight ? availableWeight / totalWeight : 0
  return {
    score,
    completeness,
    calculable: score !== null && completeness >= 0.5,
    details: Object.fromEntries(components.map((component) => [component.name, component.score])),
  }
}

export function calculateActivityScore(
  summaries: DailyHealthSummary[],
  settings: Partial<GoalSettings> = {},
): ScoreDimension {
  const resolved = { ...DEFAULT_SETTINGS, ...settings }
  const stepScores = summaries.map((summary) => goalAttainment(summary.steps, resolved.dailyStepGoal))
  const exerciseScores = summaries.map((summary) =>
    goalAttainment(summary.exerciseMinutes, resolved.weeklyExerciseMinutesGoal / 7),
  )
  const activeBaseline = personalBaseline(summaries, 'activeMinutes')
  const activeScores = summaries.map((summary) =>
    summary.activeMinutes === null || activeBaseline === null || activeBaseline <= 0
      ? null
      : boundedScore((summary.activeMinutes / activeBaseline) * 100),
  )
  const stepDays = summaries.filter((summary) => summary.steps !== null)
  const consistency = stepDays.length
    ? (stepDays.filter((summary) => (summary.steps ?? 0) >= resolved.dailyStepGoal).length / stepDays.length) * 100
    : null

  return availableWeightedScore([
    { name: 'steps', weight: 35, score: mean(stepScores) },
    { name: 'exerciseMinutes', weight: 30, score: mean(exerciseScores) },
    { name: 'activeMinutes', weight: 20, score: mean(activeScores) },
    { name: 'consistency', weight: 15, score: consistency },
  ])
}

function trendScore(values: NullableNumber[]): number | null {
  const available = values.filter((value): value is number => value !== null)
  if (available.length < 2) return null
  const midpoint = Math.max(1, Math.floor(available.length / 2))
  const prior = mean(available.slice(0, midpoint)) ?? 0
  const recent = mean(available.slice(midpoint)) ?? 0
  if (prior === 0) return recent === 0 ? 100 : null
  return boundedScore(100 - (Math.abs(recent - prior) / prior) * 100)
}

export function calculateBodyScore(
  summaries: DailyHealthSummary[],
  settings: Partial<GoalSettings> = {},
): ScoreDimension {
  const resolved = { ...DEFAULT_SETTINGS, ...settings }
  const weightTrend = trendScore(summaries.map((summary) => summary.weightKg))
  const bodyFatTrend = trendScore(summaries.map((summary) => summary.bodyFatPercentage))
  const latestWeight = [...summaries].reverse().find((summary) => summary.weightKg !== null)?.weightKg ?? null
  const goalProgress = resolved.weightGoalKg === null || latestWeight === null
    ? null
    : boundedScore(100 - (Math.abs(latestWeight - resolved.weightGoalKg) / resolved.weightGoalKg) * 100)

  return availableWeightedScore([
    { name: 'weightTrend', weight: 50, score: weightTrend },
    { name: 'bodyFatTrend', weight: 30, score: bodyFatTrend },
    { name: 'goalProgress', weight: 20, score: goalProgress },
  ])
}

export function calculateOverallScore(
  activity: ScoreDimension,
  body: ScoreDimension,
): OverallScore {
  const completeness = (activity.completeness * 2 + body.completeness) / 3
  const calculable = activity.calculable && body.calculable && completeness >= 0.5
  return {
    score: calculable ? boundedScore((activity.score! * 2 + body.score!) / 3) : null,
    completeness,
    calculable,
    activity,
    body,
    algorithmVersion: 'health-score-v1',
  }
}

export function generateInsights(
  summaries: DailyHealthSummary[],
  settings: Partial<GoalSettings> = {},
  createdAt = new Date().toISOString(),
): HealthInsight[] {
  const resolved = { ...DEFAULT_SETTINGS, ...settings }
  const recent = summaries.slice(-7)
  const baselineDays = summaries.slice(0, -7).slice(-30)
  const baselineValues = baselineDays.flatMap((summary) => summary.steps === null ? [] : [summary.steps])
  const recentValues = recent.flatMap((summary) => summary.steps === null ? [] : [summary.steps])
  const baseline = baselineValues.length >= 14 ? mean(baselineValues) : null
  const current = recentValues.length >= 4 ? mean(recentValues) : null
  const insights: HealthInsight[] = []

  if (baseline !== null && current !== null && current > baseline * 1.1) {
    insights.push({
      id: `activity-steps-above-baseline-${summaries[summaries.length - 1]?.date ?? 'unknown'}`,
      type: 'activity',
      severity: 'positive',
      title: '最近一週步數高於個人基準',
      description: '最近 7 天平均步數比最近 30 天個人平均高出超過 10%。',
      metric: 'steps',
      baseline,
      currentValue: current,
      createdAt,
    })
  }

  const achievedStreak = [...summaries].reverse().findIndex(
    (summary) => summary.steps === null || summary.steps < resolved.dailyStepGoal,
  )
  if (achievedStreak >= 3) {
    insights.push({
      id: `activity-streak-${summaries[summaries.length - 1]?.date ?? 'unknown'}`,
      type: 'activity',
      severity: 'positive',
      title: `已連續 ${achievedStreak} 天達成步數目標`,
      description: '依照目前可用的每日步數紀錄計算。',
      metric: 'steps',
      currentValue: achievedStreak,
      createdAt,
    })
  }

  return insights
}

export function generateTimeline(
  summaries: DailyHealthSummary[],
  settings: Partial<GoalSettings> = {},
): TimelineEvent[] {
  const resolved = { ...DEFAULT_SETTINGS, ...settings }
  const events: TimelineEvent[] = []
  let streak = 0
  let exerciseStreak = 0
  for (const summary of summaries) {
    if (summary.steps !== null && summary.steps >= resolved.dailyStepGoal) streak += 1
    else streak = 0
    if (streak === 7 || (streak > 7 && streak % 7 === 0)) {
      events.push({
        id: `activity-streak-${summary.date}-${streak}`,
        type: 'activity_streak',
        date: summary.date,
        title: `連續 ${streak} 天達成活動目標`,
        description: '依照每日步數目標與實際紀錄產生。',
      })
    }
    if ((summary.exerciseMinutes ?? 0) > 0) exerciseStreak += 1
    else exerciseStreak = 0
    if (exerciseStreak === 7 || (exerciseStreak > 7 && exerciseStreak % 7 === 0)) {
      events.push({
        id: `exercise-streak-${summary.date}-${exerciseStreak}`,
        type: 'exercise_milestone',
        date: summary.date,
        title: `連續 ${exerciseStreak} 天有運動紀錄`,
        description: '依照每日實際同步的運動紀錄計算。',
      })
    }
  }

  const weighted = summaries.flatMap((summary) => summary.weightKg === null ? [] : [{ date: summary.date, value: summary.weightKg }])
  for (let index = 6; index < weighted.length; index += 1) {
    const recent = weighted.slice(index - 6, index + 1)
    const baseline = weighted.slice(Math.max(0, index - 89), index)
    if (baseline.length < 7) continue
    const recentAverage = mean(recent.map((item) => item.value))!
    if (recentAverage < Math.min(...baseline.map((item) => item.value))) {
      events.push({
        id: `weight-milestone-${recent[6]!.date}`,
        type: 'weight_milestone',
        date: recent[6]!.date,
        title: '7 次量測平均體重創近期新低',
        description: '最近 7 次體重量測的平均值低於此前可用量測紀錄。',
      })
    }
  }
  return events
}

export function summarizeWorkouts(records: HealthRecord[]): WorkoutSummary[] {
  return records
    .filter((record) => record.type === 'exercise')
    .map((record) => ({
      id: record.id,
      type: typeof record.metadata?.workoutType === 'string' ? record.metadata.workoutType : 'Other',
      startTime: record.startTime,
      durationMinutes: durationMinutes(record) ?? 0,
      calories: typeof record.metadata?.calories === 'number' ? record.metadata.calories : null,
    }))
    .sort((a, b) => b.startTime.localeCompare(a.startTime))
}
