import { z } from 'zod'

export const syncStateSchema = z.object({
  userId: z.string().min(1),
  lastStartedAt: z.iso.datetime().nullable(),
  runEndTime: z.iso.datetime().nullable().optional(),
  nextEndTime: z.iso.datetime().nullable().optional(),
  lastCompletedAt: z.iso.datetime().nullable(),
  status: z.enum(['idle', 'running', 'error']),
  recordCount: z.number().int().nonnegative(),
  errorCode: z.string().min(1).nullable(),
  scheduledLastRunAt: z.iso.datetime().nullable().optional(),
})

export type SyncState = z.infer<typeof syncStateSchema>

export const scheduledSyncStateSchema = z.object({
  userId: z.string().min(1),
  status: z.enum(['backfilling', 'complete']),
  nextEndTime: z.iso.datetime().nullable(),
  consecutiveEmptyDays: z.number().int().nonnegative(),
  attemptCount: z.number().int().nonnegative(),
  retryAt: z.iso.datetime().nullable(),
  lastSuccessfulAt: z.iso.datetime().nullable(),
  lastErrorCode: z.string().min(1).nullable(),
})

export type ScheduledSyncState = z.infer<typeof scheduledSyncStateSchema>
