import type { Config } from '@netlify/functions'
import { safeRedirect } from '../lib/response'
import { clearSessionCookie } from '../lib/session'

export default async (): Promise<Response> =>
  safeRedirect('/', {
    headers: { 'Set-Cookie': clearSessionCookie(), 'Clear-Site-Data': '"cache", "storage"' },
  })

export const config: Config = {
  method: 'GET',
}

