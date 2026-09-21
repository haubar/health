import type { Config } from '@netlify/functions'
import type { SessionStatus } from '@health/shared'
import { getServerEnvironment } from '../lib/env'
import { jsonSuccess } from '../lib/response'
import { readSession } from '../lib/session'

export default async (request: Request): Promise<Response> => {
  let user = null
  try {
    user = await readSession(request, getServerEnvironment().SESSION_SECRET)
  } catch {
    // A missing runtime configuration is indistinguishable from a signed-out session to the browser.
  }
  return jsonSuccess<SessionStatus>({ authenticated: user !== null, user })
}

export const config: Config = {
  method: 'GET',
}

