export interface DailyProgressPoint {
  date: string
  steps: number | null
  weightKg: number | null
  activeMinutes: number | null
  exerciseMinutes: number | null
}

export interface DailyProgressAssessment {
  date: string
  stepGoal: number
  steps: number | null
  stepsRemaining: number | null
  completionRate: number | null
  latestWeightKg: number | null
  latestWeightDate: string | null
  targetWeightKg: number | null
  remainingWeightKg: number | null
  status: 'on_track' | 'below_goal' | 'missing_data'
}

/** Pure assessment: missing measurements stay missing rather than becoming zero. */
export function assessDailyProgress(
  days: DailyProgressPoint[],
  stepGoal: number,
  targetWeightKg: number | null,
): DailyProgressAssessment {
  const ordered = [...days].sort((a, b) => a.date.localeCompare(b.date))
  const today = ordered[ordered.length - 1]
  if (!today) throw new Error('At least one day is required')
  const validGoal = Number.isFinite(stepGoal) && stepGoal > 0 ? stepGoal : 8000
  const steps = today.steps
  const weightPoint = [...ordered].reverse().find((day) => day.weightKg !== null && Number.isFinite(day.weightKg))
  return {
    date: today.date,
    stepGoal: validGoal,
    steps,
    stepsRemaining: steps === null ? null : Math.max(0, validGoal - steps),
    completionRate: steps === null ? null : Math.round((steps / validGoal) * 100),
    latestWeightKg: weightPoint?.weightKg ?? null,
    latestWeightDate: weightPoint?.date ?? null,
    targetWeightKg,
    remainingWeightKg: weightPoint && targetWeightKg !== null ? Math.max(0, Number((weightPoint.weightKg! - targetWeightKg).toFixed(2))) : null,
    status: steps === null ? 'missing_data' : steps >= validGoal ? 'on_track' : 'below_goal',
  }
}
