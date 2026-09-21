import { z } from 'zod'

export const syncStateSchema = z.object({
  userId: z.string().min(1),
  lastStartedAt: z.iso.datetime().nullable(),
  lastCompletedAt: z.iso.datetime().nullable(),
  status: z.enum(['idle', 'running', 'error']),
  recordCount: z.number().int().nonnegative(),
  errorCode: z.string().min(1).nullable(),
})

export type SyncState = z.infer<typeof syncStateSchema>
