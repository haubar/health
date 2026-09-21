import { z } from 'zod'

export const sessionUserSchema = z.object({
  id: z.string().min(1),
  email: z.email(),
  displayName: z.string().min(1).nullable(),
})

export type SessionUser = z.infer<typeof sessionUserSchema>

export type SessionStatus = {
  authenticated: boolean
  user: SessionUser | null
}

export const googleHealthConnectionSchema = z.object({
  provider: z.literal('google_health'),
  encryptedRefreshToken: z.string().min(1),
  scopes: z.array(z.string().url()).min(1),
  status: z.enum(['connected', 'disconnected', 'error']),
  expiresAt: z.iso.datetime().nullable(),
  lastSyncAt: z.iso.datetime().nullable(),
  updatedAt: z.iso.datetime(),
})

export type GoogleHealthConnection = z.infer<typeof googleHealthConnectionSchema>
