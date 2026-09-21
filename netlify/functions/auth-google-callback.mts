import type { Config } from '@netlify/functions'
import type { SessionUser } from '@health/shared'
import { OAuth2Client } from 'google-auth-library'
import { readCookie } from '../lib/cookies'
import { encryptSecret } from '../lib/crypto'
import { getServerEnvironment } from '../lib/env'
import { GOOGLE_AUTH_SCOPE_LIST, GOOGLE_HEALTH_SCOPE_LIST } from '../lib/google-health'
import { AuthRepository } from '../lib/repositories/auth-repository'
import { safeRedirect } from '../lib/response'
import {
  clearOAuthStateCookie,
  createSessionToken,
  OAUTH_STATE_COOKIE,
  sessionCookie,
  verifyOAuthState,
} from '../lib/session'
import { createNetlifyHandler } from '../lib/netlify-handler'

function failedRedirect(reason: string): Response {
  return safeRedirect(`/?auth_error=${encodeURIComponent(reason)}`, {
    headers: { 'Set-Cookie': clearOAuthStateCookie(), 'Cache-Control': 'no-store' },
  })
}

const fetchHandler = async (request: Request): Promise<Response> => {
  try {
    const env = getServerEnvironment()
    const url = new URL(request.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const stateCookie = readCookie(request, OAUTH_STATE_COOKIE)

    if (!code || !state || !stateCookie || state !== stateCookie) return failedRedirect('invalid_state')
    if (!(await verifyOAuthState(state, env.SESSION_SECRET))) return failedRedirect('invalid_state')

    const client = new OAuth2Client({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri: env.GOOGLE_REDIRECT_URI,
    })
    const { tokens } = await client.getToken(code)
    if (!tokens.id_token) return failedRedirect('missing_identity')
    const grantedScopes = (tokens.scope ?? '').split(' ').filter(Boolean)
    if (!tokens.refresh_token || !GOOGLE_HEALTH_SCOPE_LIST.some((scope) => grantedScopes.includes(scope))) return failedRedirect('missing_health_consent')

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: env.GOOGLE_CLIENT_ID,
    })
    const payload = ticket.getPayload()
    const email = payload?.email?.trim().toLowerCase()
    const ownerEmail = env.OWNER_GOOGLE_EMAIL.trim().toLowerCase()

    if (!payload?.sub || !email || payload.email_verified !== true || email !== ownerEmail) {
      return failedRedirect('account_not_allowed')
    }

    const now = new Date().toISOString()
    await new AuthRepository().set(payload.sub, {
      provider: 'google_health',
      encryptedRefreshToken: encryptSecret(tokens.refresh_token, env.HEALTH_TOKEN_ENCRYPTION_KEY),
      scopes: grantedScopes.filter((scope) => GOOGLE_AUTH_SCOPE_LIST.includes(scope as (typeof GOOGLE_AUTH_SCOPE_LIST)[number])),
      status: 'connected',
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      lastSyncAt: null,
      updatedAt: now,
    })

    const user: SessionUser = {
      id: payload.sub,
      email,
      displayName: payload.name?.trim() || null,
    }
    const token = await createSessionToken(user, env.SESSION_SECRET)
    const response = safeRedirect('/dashboard', { headers: { 'Cache-Control': 'no-store' } })
    response.headers.append('Set-Cookie', sessionCookie(token))
    response.headers.append('Set-Cookie', clearOAuthStateCookie())
    return response
  } catch (error) {
    console.error('auth-google-callback failed', error instanceof Error ? { name: error.name, message: error.message } : { error: 'unknown_error' })
    return failedRedirect('authentication_failed')
  }
}

export const handler = createNetlifyHandler(fetchHandler)

export const config: Config = {
  method: 'GET',
}
