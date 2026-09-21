import { describe, expect, it } from 'vitest'
import { decryptSecret, encryptSecret } from './crypto'

const key = Buffer.from('01234567890123456789012345678901').toString('base64')

describe('health token encryption', () => {
  it('round-trips without storing plaintext', () => {
    const encrypted = encryptSecret('refresh-token', key)
    expect(encrypted).not.toContain('refresh-token')
    expect(decryptSecret(encrypted, key)).toBe('refresh-token')
  })

  it('rejects tampered ciphertext', () => {
    const encrypted = encryptSecret('refresh-token', key)
    const parts = encrypted.split('.')
    parts[3] = `${parts[3]!.slice(0, -1)}${parts[3]!.endsWith('a') ? 'b' : 'a'}`
    const tampered = parts.join('.')
    expect(() => decryptSecret(tampered, key)).toThrow()
  })
})
