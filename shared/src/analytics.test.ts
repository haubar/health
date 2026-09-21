import { describe, expect, it } from 'vitest'
import type { DailyHealthSummary } from './dashboard'
import type { HealthRecord } from './health'
import {
  aggregateDailyHealthRecords,
  calculateActivityScore,
  calculateBodyScore,
  calculateOverallScore,
  generateInsights,
  generateTimeline,
  movingAverage,
  personalBaseline,
} from './analytics'

const record = (overrides: Partial<HealthRecord>): HealthRecord => ({
  id: 'record-1',
  userId: 'owner',
  provider: 'google_health',
  sourceRecordId: 'source-1',
  type: 'steps',
  startTime: '2026-09-20T16:30:00.000Z',
  resolution: 'daily_rollup',
  value: 8000,
  unit: 'count',
  ...overrides,
})

const day = (date: string, values: Partial<DailyHealthSummary> = {}): DailyHealthSummary => ({
  date,
  steps: null,
  distanceKm: null,
  activeMinutes: null,
  exerciseMinutes: null,
  activeCalories: null,
  totalCalories: null,
  weightKg: null,
  bodyFatPercentage: null,
  ...values,
})

describe('daily aggregation', () => {
  it('groups UTC records by the Taiwan civil date and keeps missing metrics null', () => {
    const result = aggregateDailyHealthRecords([
      record({ id: 'steps', value: 8000 }),
      record({ id: 'distance', type: 'distance', value: 2500, unit: 'm' }),
      record({ id: 'exercise', type: 'exercise', value: undefined, endTime: '2026-09-20T17:00:00.000Z' }),
    ])

    expect(result).toEqual([
      expect.objectContaining({
        date: '2026-09-21',
        steps: 8000,
        distanceKm: 2.5,
        exerciseMinutes: 30,
        activeMinutes: null,
      }),
    ])
  })
})

describe('analytics primitives', () => {
  it('calculates trailing moving averages without treating null as zero', () => {
    expect(movingAverage([null, 10, null, 20], 2)).toEqual([null, 10, 10, 20])
  })

  it('uses the latest available window for a personal baseline', () => {
    const summaries = [1, 2, 3, 4].map((steps, index) => day(`2026-09-${String(index + 1).padStart(2, '0')}`, { steps }))
    expect(personalBaseline(summaries, 'steps', 2)).toBe(3.5)
  })
})

describe('scores and derived content', () => {
  it('re-normalizes available activity components and exposes completeness', () => {
    const score = calculateActivityScore([
      day('2026-09-20', { steps: 8000, exerciseMinutes: null, activeMinutes: null }),
      day('2026-09-21', { steps: 4000, exerciseMinutes: null, activeMinutes: null }),
    ])
    expect(score.score).toBe(68)
    expect(score.completeness).toBe(0.5)
    expect(score.calculable).toBe(true)
  })

  it('hides overall score when a dimension is not calculable', () => {
    const activity = calculateActivityScore([day('2026-09-21', { steps: 8000 })])
    const body = calculateBodyScore([day('2026-09-21', { weightKg: 70 })])
    const overall = calculateOverallScore(activity, body)
    expect(overall.score).toBeNull()
    expect(overall.calculable).toBe(false)
  })

  it('generates deterministic insight and timeline events only from sufficient data', () => {
    const summaries = Array.from({ length: 30 }, (_, index) =>
      day(`2026-08-${String(index + 1).padStart(2, '0')}`, { steps: 5000 }),
    )
    summaries.push(
      ...Array.from({ length: 7 }, (_, index) =>
        day(`2026-09-${String(index + 1).padStart(2, '0')}`, { steps: 9000 }),
      ),
    )
    expect(generateInsights(summaries, { dailyStepGoal: 8000 })).toHaveLength(2)
    expect(generateTimeline(summaries, { dailyStepGoal: 8000 })).toHaveLength(1)
  })
})
