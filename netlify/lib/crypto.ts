import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const VERSION = 'v1'
const ALGORITHM = 'aes-256-gcm'

function keyFromBase64(value: string): Buffer {
  const key = Buffer.from(value, 'base64')
  if (key.length !== 32) throw new Error('HEALTH_TOKEN_ENCRYPTION_KEY must decode to 32 bytes')
  return key
}

function encode(value: Buffer): string {
  return value.toString('base64url')
}

function decode(value: string): Buffer {
  return Buffer.from(value, 'base64url')
}

export function encryptSecret(plaintext: string, encodedKey: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, keyFromBase64(encodedKey), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return [VERSION, encode(iv), encode(cipher.getAuthTag()), encode(ciphertext)].join('.')
}

export function decryptSecret(payload: string, encodedKey: string): string {
  const [version, ivValue, tagValue, ciphertextValue] = payload.split('.')
  if (version !== VERSION || !ivValue || !tagValue || !ciphertextValue) throw new Error('Invalid encrypted secret')
  const decipher = createDecipheriv(ALGORITHM, keyFromBase64(encodedKey), decode(ivValue))
  decipher.setAuthTag(decode(tagValue))
  return Buffer.concat([decipher.update(decode(ciphertextValue)), decipher.final()]).toString('utf8')
}

