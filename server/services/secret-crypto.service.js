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
  const [version, encodedIv, encodedTag, encodedPayload] = String(value).split('.')
  if (version !== 'v1' || !encodedIv || !encodedTag || !encodedPayload) throw new Error('Invalid encrypted secret')
  const decipher = crypto.createDecipheriv(CIPHER, env.sessionEncryptionKey, Buffer.from(encodedIv, 'base64url'))
  decipher.setAuthTag(Buffer.from(encodedTag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(encodedPayload, 'base64url')), decipher.final()]).toString('utf8')
}
