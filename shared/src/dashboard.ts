import { z } from 'zod'

export const dataAvailabilitySchema = z.enum(['loading', 'ready', 'empty', 'offline', 'error'])
export type DataAvailability = z.infer<typeof dataAvailabilitySchema>

export const dashboardRangeSchema = z.enum(['7D', '30D', '90D', '1Y'])
export type DashboardRange = z.infer<typeof dashboardRangeSchema>

export const dailyHealthSummarySchema = z.object({
  date: z.iso.date(),
  steps: z.number().nonnegative().nullable(),
  distanceKm: z.number().nonnegative().nullable(),
  activeMinutes: z.number().nonnegative().nullable(),
  exerciseMinutes: z.number().nonnegative().nullable(),
  activeCalories: z.number().nonnegative().nullable(),
  totalCalories: z.number().nonnegative().nullable(),
  weightKg: z.number().positive().nullable(),
  bodyFatPercentage: z.number().nonnegative().nullable(),
})
export type DailyHealthSummary = z.infer<typeof dailyHealthSummarySchema>

export const workoutSummarySchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  startTime: z.iso.datetime(),
  durationMinutes: z.number().nonnegative(),
  calories: z.number().nonnegative().nullable(),
})
export type WorkoutSummary = z.infer<typeof workoutSummarySchema>

export const dashboardDataSchema = z.object({
  availability: dataAvailabilitySchema,
  lastUpdatedAt: z.iso.datetime().nullable(),
  summaries: z.array(dailyHealthSummarySchema),
})
export type DashboardData = z.infer<typeof dashboardDataSchema>

