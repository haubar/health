import { describe, expect, it } from 'vitest'
import { makePublicSteps } from './public-steps'

describe('makePublicSteps', () => {
  it('exposes only approved step fields', () => {
    const result = makePublicSteps('2026-10-09', 6520, 8000, true, '2026-10-09T11:50:00Z')
    expect(result.stepsRemaining).toBe(1480)
    expect(result.completionRate).toBe(82)
    expect(Object.keys(result).sort()).toEqual([
      'date', 'timezone', 'steps', 'stepGoal', 'stepsRemaining',
      'completionRate', 'synced', 'lastSyncedAt', 'websiteUrl',
    ].sort())
  })
  it('never invents missing or unsynced measurements', () => {
    const result = makePublicSteps('2026-10-09', 5000, 8000, false, null)
    expect(result.steps).toBeNull()
    expect(result.completionRate).toBeNull()
  })
})
