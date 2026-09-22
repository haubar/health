import type { Config } from '@netlify/functions'
import { getServerEnvironment } from '../lib/env'
import { jsonFailure, jsonSuccess } from '../lib/response'
import { SyncRepository } from '../lib/repositories/sync-repository'
import { readSession } from '../lib/session'
import { createNetlifyHandler } from '../lib/netlify-handler'

const fetchHandler = async (request: Request): Promise<Response> => {
  const env = getServerEnvironment()
  const user = await readSession(request, env.SESSION_SECRET)
  if (!user) return jsonFailure(401, 'unauthenticated', '請先使用 Google 登入。')
  const state = await new SyncRepository().get(user.id)
  return jsonSuccess({ state })
}

export const handler = createNetlifyHandler(fetchHandler)

export const config: Config = { method: 'GET' }
