import type { SessionUser } from '@health/shared'
import { jwtVerify, SignJWT } from 'jose'
import { readCookie, serializeCookie } from './cookies'

export const SESSION_COOKIE = '__Host-health_session'
export const OAUTH_STATE_COOKIE = '__Host-health_oauth_state'
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30
const STATE_MAX_AGE_SECONDS = 60 * 10

type SessionClaims = {
  email: string
  displayName: string | null
}

function signingKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret)
}

export async function createSessionToken(user: SessionUser, secret: string): Promise<string> {
  return new SignJWT({ email: user.email, displayName: user.displayName } satisfies SessionClaims)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(signingKey(secret))
}

export async function readSession(request: Request, secret: string): Promise<SessionUser | null> {
  const token = readCookie(request, SESSION_COOKIE)
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, signingKey(secret), { algorithms: ['HS256'] })
    if (!payload.sub || typeof payload.email !== 'string') return null
    return {
      id: payload.sub,
      email: payload.email,
      displayName: typeof payload.displayName === 'string' ? payload.displayName : null,
    }
  } catch {
    return null
  }
}

export async function createOAuthState(secret: string): Promise<string> {
  return new SignJWT({ purpose: 'google-oauth' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${STATE_MAX_AGE_SECONDS}s`)
    .sign(signingKey(secret))
}

export async function verifyOAuthState(state: string, secret: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(state, signingKey(secret), { algorithms: ['HS256'] })
    return payload.purpose === 'google-oauth' && typeof payload.jti === 'string'
  } catch {
    return false
  }
}

export function sessionCookie(token: string): string {
  return serializeCookie(SESSION_COOKIE, token, {
    maxAge: SESSION_MAX_AGE_SECONDS,
    secure: true,
  })
}

export function clearSessionCookie(): string {
  return serializeCookie(SESSION_COOKIE, '', { maxAge: 0, secure: true })
}

export function oauthStateCookie(state: string): string {
  return serializeCookie(OAUTH_STATE_COOKIE, state, {
    maxAge: STATE_MAX_AGE_SECONDS,
    secure: true,
  })
}

export function clearOAuthStateCookie(): string {
  return serializeCookie(OAUTH_STATE_COOKIE, '', { maxAge: 0, secure: true })
}
