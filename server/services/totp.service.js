import crypto from 'node:crypto'

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function encodeBase32(bytes) {
  let value = 0
  let bits = 0
  let result = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      result += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) result += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  return result
}

function decodeBase32(value) {
  const normalized = value.replace(/[\s=-]/g, '').toUpperCase()
  let bits = 0
  let accumulator = 0
  const bytes = []
  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character)
    if (index === -1) throw new Error('Invalid TOTP secret')
    accumulator = (accumulator << 5) | index
    bits += 5
    if (bits >= 8) {
      bytes.push((accumulator >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

export function createTotpSecret() {
  return encodeBase32(crypto.randomBytes(20))
}

export function createTotpUri(secret, memberId) {
  const issuer = 'Cyber Security Club MRDU'
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${memberId}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`
}

function generateToken(secret, timestamp) {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(timestamp / 30_000)))
  const digest = crypto.createHmac('sha1', decodeBase32(secret)).update(counter).digest()
  const offset = digest[digest.length - 1] & 15
  const code = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000
  return String(code).padStart(6, '0')
}

export function generateTotp(secret, timestamp = Date.now()) {
  return generateToken(secret, timestamp)
}

export function verifyTotp(secret, code, timestamp = Date.now()) {
  if (!secret || !/^\d{6}$/.test(String(code).trim())) return false
  const cleanCode = String(code).trim()
  // Industry-standard window covering ±60 seconds to tolerate device clock drift
  const timeOffsets = [-60_000, -30_000, 0, 30_000, 60_000]
  return timeOffsets.some(offset => {
    try {
      const expected = generateToken(secret, timestamp + offset)
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(cleanCode))
    } catch {
      return false
    }
  })
}
