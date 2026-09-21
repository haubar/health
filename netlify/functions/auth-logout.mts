import type { Config } from '@netlify/functions'
import { safeRedirect } from '../lib/response'
import { clearSessionCookie } from '../lib/session'
import { createNetlifyHandler } from '../lib/netlify-handler'

const fetchHandler = async (): Promise<Response> =>
  safeRedirect('/', {
    headers: { 'Set-Cookie': clearSessionCookie(), 'Clear-Site-Data': '"cache", "storage"' },
  })

export const handler = createNetlifyHandler(fetchHandler)

export const config: Config = {
  method: 'GET',
}
