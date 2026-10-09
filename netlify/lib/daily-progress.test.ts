import { describe, expect, it } from 'vitest'
import { assessDailyProgress } from './daily-progress'

describe('assessDailyProgress', () => {
  it('keeps missing measurements unknown', () => {
    const result = assessDailyProgress([{ date: '2026-10-09', steps: null, weightKg: null, activeMinutes: null, exerciseMinutes: null }], 8000, 75)
    expect(result.status).toBe('missing_data')
    expect(result.stepsRemaining).toBeNull()
    expect(result.remainingWeightKg).toBeNull()
  })

  it('calculates steps remaining and latest recorded weight', () => {
    const result = assessDailyProgress([
      { date: '2026-10-08', steps: 8500, weightKg: 80, activeMinutes: 45, exerciseMinutes: 20 },
      { date: '2026-10-09', steps: 6500, weightKg: null, activeMinutes: 20, exerciseMinutes: 0 },
    ], 8000, 75)
    expect(result.stepsRemaining).toBe(1500)
    expect(result.completionRate).toBe(81)
    expect(result.latestWeightDate).toBe('2026-10-08')
    expect(result.remainingWeightKg).toBe(5)
  })
})
