import { describe, expect, it } from 'vitest'
import { blobKeys } from './keys'

describe('blobKeys', () => {
  it('builds stable record keys for idempotent overwrites', () => {
    const first = blobKeys.record('google_123', 'weight', '2026-09-21', 'record_abc')
    const second = blobKeys.record('google_123', 'weight', '2026-09-21', 'record_abc')

    expect(first).toBe(second)
    expect(first).toBe('users/google_123/records/weight/2026/09/record_abc.json')
  })

  it('builds a month prefix without exposing arbitrary paths', () => {
    expect(blobKeys.dailyMonthPrefix('google_123', '2026-09')).toBe(
      'users/google_123/daily/2026/09/',
    )
  })

  it('rejects path traversal segments', () => {
    expect(() => blobKeys.profile('../other-user')).toThrow('Invalid userId')
    expect(() => blobKeys.record('owner', 'steps', '2026-09-21', '../record')).toThrow(
      'Invalid recordId',
    )
  })
})

