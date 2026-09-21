import type { Config } from '@netlify/functions'
import { OAuth2Client } from 'google-auth-library'
import { getServerEnvironment } from '../lib/env'
import { GOOGLE_HEALTH_SCOPE_LIST } from '../lib/google-health'
import { safeRedirect } from '../lib/response'
import { createOAuthState, oauthStateCookie } from '../lib/session'

export default async (): Promise<Response> => {
  try {
    const env = getServerEnvironment()
    const state = await createOAuthState(env.SESSION_SECRET)
    const client = new OAuth2Client({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri: env.GOOGLE_REDIRECT_URI,
    })
    const authorizationUrl = client.generateAuthUrl({
      scope: ['openid', 'email', 'profile', ...GOOGLE_HEALTH_SCOPE_LIST],
      state,
      access_type: 'offline',
      prompt: 'consent select_account',
    })

    return safeRedirect(authorizationUrl, {
      headers: { 'Set-Cookie': oauthStateCookie(state), 'Cache-Control': 'no-store' },
    })
  } catch {
    return safeRedirect('/?auth_error=configuration')
  }
}

export const config: Config = {
  method: 'GET',
}
