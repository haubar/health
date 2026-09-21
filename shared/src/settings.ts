import { z } from 'zod'

export const DEFAULT_DAILY_STEP_GOAL = 8_000
export const DEFAULT_WEEKLY_EXERCISE_MINUTES_GOAL = 150
export const HEALTH_TIMEZONE = 'Asia/Taipei'
export const HEALTH_UNITS = 'metric'

export const goalSettingsSchema = z.object({
  dailyStepGoal: z.number().int().positive().default(DEFAULT_DAILY_STEP_GOAL),
  weeklyExerciseMinutesGoal: z
    .number()
    .int()
    .positive()
    .default(DEFAULT_WEEKLY_EXERCISE_MINUTES_GOAL),
  weightGoalKg: z.number().positive().nullable().default(null),
  units: z.literal(HEALTH_UNITS).default(HEALTH_UNITS),
  updatedAt: z.iso.datetime(),
})

export type GoalSettings = z.infer<typeof goalSettingsSchema>

