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

