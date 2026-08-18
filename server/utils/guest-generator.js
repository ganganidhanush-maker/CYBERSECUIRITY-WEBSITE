import crypto from 'node:crypto'

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const LOWER = 'abcdefghijkmnpqrstuvwxyz'
const DIGITS = '23456789'
const SYMBOLS = '!@#$%&*?'
const ALL_CHARS = UPPER + LOWER + DIGITS + SYMBOLS

/**
 * Generates a cryptographically strong, human-readable 14-character password
 * guaranteed to contain uppercase, lowercase, numbers, and symbols.
 */
export function generateStrongPassword() {
  const guaranteed = [
    UPPER[crypto.randomInt(UPPER.length)],
    LOWER[crypto.randomInt(LOWER.length)],
    DIGITS[crypto.randomInt(DIGITS.length)],
    SYMBOLS[crypto.randomInt(SYMBOLS.length)],
    UPPER[crypto.randomInt(UPPER.length)],
    LOWER[crypto.randomInt(LOWER.length)],
    DIGITS[crypto.randomInt(DIGITS.length)],
    SYMBOLS[crypto.randomInt(SYMBOLS.length)],
  ]

  // Add 6 more random characters for a total of 14
  for (let i = 0; i < 6; i++) {
    guaranteed.push(ALL_CHARS[crypto.randomInt(ALL_CHARS.length)])
  }

  // Cryptographically shuffle the array
  for (let i = guaranteed.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1)
    const temp = guaranteed[i]
    guaranteed[i] = guaranteed[j]
    guaranteed[j] = temp
  }

  return guaranteed.join('')
}

/**
 * Generates the next sequential Guest Member ID in the format GUEST{YYYY}{NNN}
 * e.g. GUEST2026001, GUEST2026002, etc.
 */
export async function getNextGuestMemberId(prismaClient) {
  const year = new Date().getFullYear()
  const prefix = `GUEST${year}`

  const existingGuests = await prismaClient.user.findMany({
    where: {
      memberId: {
        startsWith: prefix,
      },
    },
    select: {
      memberId: true,
    },
    orderBy: {
      memberId: 'desc',
    },
  })

  let maxSerial = 0
  for (const guest of existingGuests) {
    const serialStr = guest.memberId.slice(prefix.length)
    const serialNum = parseInt(serialStr, 10)
    if (!Number.isNaN(serialNum) && serialNum > maxSerial) {
      maxSerial = serialNum
    }
  }

  const nextSerial = maxSerial + 1
  const serialPadded = String(nextSerial).padStart(3, '0')
  return `${prefix}${serialPadded}`
}
