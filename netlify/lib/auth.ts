import type { SessionUser } from '@health/shared'
import { getServerEnvironment } from './env'
import { readSession } from './session'

export async function requireSession(request: Request): Promise<SessionUser> {
  const { SESSION_SECRET } = getServerEnvironment()
  const user = await readSession(request, SESSION_SECRET)
  if (!user) throw new UnauthorizedError()
  return user
}

export class UnauthorizedError extends Error {
  constructor() {
    super('Authentication required')
    this.name = 'UnauthorizedError'
  }
}

