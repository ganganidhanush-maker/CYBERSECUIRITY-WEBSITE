import crypto from 'node:crypto'
import { env } from '../config/env.js'

const CIPHER = 'aes-256-gcm'

export function encryptSecret(value) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(CIPHER, env.sessionEncryptionKey, iv)
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${ciphertext.toString('base64url')}`
}

export function decryptSecret(value) {
  if (!value) return ''
  const str = String(value)
  if (!str.startsWith('v1.')) {
    return str // Raw secret if unencrypted
  }
  const [version, encodedIv, encodedTag, encodedPayload] = str.split('.')
  if (version !== 'v1' || !encodedIv || !encodedTag || !encodedPayload) return str

  // Primary key from environment + fallback known keys
  const candidateKeys = [
    env.sessionEncryptionKey,
    Buffer.from('a9x8FwU6Zk4h7Lm0P2rTtYv1X3c5B7N9J1q3S5v7X9A=', 'base64'),
    crypto.createHash('sha256').update('cyber-security-club-mrdu-production-seed-2026').digest(),
  ]

  for (const key of candidateKeys) {
    try {
      const decipher = crypto.createDecipheriv(CIPHER, key, Buffer.from(encodedIv, 'base64url'))
      decipher.setAuthTag(Buffer.from(encodedTag, 'base64url'))
      const decrypted = Buffer.concat([decipher.update(Buffer.from(encodedPayload, 'base64url')), decipher.final()]).toString('utf8')
      if (decrypted) return decrypted
    } catch {
      // Continue trying next candidate key
    }
  }

  throw new Error('Unable to decrypt secret. The encryption key may have changed.')
}
