import type { Config } from '@netlify/functions'
import { decryptSecret } from '../lib/crypto'
import { getServerEnvironment } from '../lib/env'
import { GoogleFitProvider } from '../lib/google-fit'
import { jsonFailure, jsonSuccess } from '../lib/response'
import { AuthRepository } from '../lib/repositories/auth-repository'
import { readSession } from '../lib/session'
import { createNetlifyHandler } from '../lib/netlify-handler'

const LOOKBACK_DAYS = 30

const fetchHandler = async (request: Request): Promise<Response> => {
  const env = getServerEnvironment()
  const user = await readSession(request, env.SESSION_SECRET)
  if (!user) return jsonFailure(401, 'unauthenticated', '請先使用 Google 登入。')
  const auth = await new AuthRepository().get(user.id)
  if (!auth || auth.status !== 'connected') return jsonFailure(409, 'health_not_connected', '尚未連結 Google 帳號。')

  try {
    const end = new Date()
    const start = new Date(end)
    start.setUTCDate(start.getUTCDate() - LOOKBACK_DAYS)
    const provider = new GoogleFitProvider(decryptSecret(auth.encryptedRefreshToken, env.HEALTH_TOKEN_ENCRYPTION_KEY), env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET)
    const data = await provider.inspect({ start, end })
    console.log('inspect-google-fit completed', Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value.points])))
    return jsonSuccess({ start: start.toISOString(), end: end.toISOString(), data })
  } catch (error) {
    console.error('inspect-google-fit failed', error instanceof Error ? { name: error.name, message: error.message } : { error: 'unknown_error' })
    return jsonFailure(502, 'google_fit_check_failed', 'Google Fit 檢查失敗，請確認已重新授權 Google Fit 讀取權限。')
  }
}

export const handler = createNetlifyHandler(fetchHandler)
export const config: Config = { method: 'POST' }
