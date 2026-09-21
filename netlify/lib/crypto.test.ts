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
    parts[2] = `${parts[2]!.startsWith('a') ? 'b' : 'a'}${parts[2]!.slice(1)}`
    const tampered = parts.join('.')
    expect(() => decryptSecret(tampered, key)).toThrow()
  })
})
