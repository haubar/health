import { z } from 'zod'

export const healthRecordTypeSchema = z.enum([
  'steps',
  'distance',
  'weight',
  'body_fat',
  'lean_mass',
  'height',
  'exercise',
  'active_minutes',
  'active_calories',
  'total_calories',
])

export type HealthRecordType = z.infer<typeof healthRecordTypeSchema>

export const healthRecordSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  provider: z.literal('google_health'),
  sourceRecordId: z.string().min(1),
  sourceApp: z.string().min(1).optional(),
  type: healthRecordTypeSchema,
  startTime: z.iso.datetime(),
  endTime: z.iso.datetime().optional(),
  value: z.number().finite().optional(),
  unit: z.string().min(1).optional(),
  resolution: z.enum(['daily_rollup', 'sample', 'session']),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type HealthRecord = z.infer<typeof healthRecordSchema>

export type DateRange = {
  start: Date
  end: Date
}

export interface HealthProvider {
  getSteps(range: DateRange): Promise<HealthRecord[]>
  getWeight(range: DateRange): Promise<HealthRecord[]>
  getBodyFat(range: DateRange): Promise<HealthRecord[]>
  getWorkouts(range: DateRange): Promise<HealthRecord[]>
}
