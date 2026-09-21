import { describe, expect, it } from 'vitest'
import { createSessionToken, readSession, SESSION_COOKIE } from './session'

const secret = 'test-session-secret-that-is-at-least-32-characters'

describe('session', () => {
  it('round-trips a signed owner session', async () => {
    const token = await createSessionToken(
      { id: 'google-owner', email: 'owner@example.com', displayName: 'Owner' },
      secret,
    )
    const request = new Request('https://example.com', {
      headers: { cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}` },
    })

    await expect(readSession(request, secret)).resolves.toEqual({
      id: 'google-owner',
      email: 'owner@example.com',
      displayName: 'Owner',
    })
  })

  it('rejects a session signed by another secret', async () => {
    const token = await createSessionToken(
      { id: 'attacker', email: 'other@example.com', displayName: null },
      'different-secret-that-is-also-more-than-32-characters',
    )
    const request = new Request('https://example.com', {
      headers: { cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}` },
    })

    await expect(readSession(request, secret)).resolves.toBeNull()
  })
})

