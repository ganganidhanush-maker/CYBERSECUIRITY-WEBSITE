import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateMonthEndExpiry, isSubscriptionActive } from '../server/utils/expiry.js'
import { parseYouTubeVideoId, getYouTubeEmbedUrl } from '../src/lib/video.js'

test('calculateMonthEndExpiry accurately computes last millisecond across leap and non-leap years', () => {
  // 1. Leap Year February (2024) -> Feb 29 23:59:59.999
  const feb2024 = new Date(2024, 1, 10, 14, 30) // Feb 10, 2024
  const expiryFeb2024 = calculateMonthEndExpiry(feb2024)
  assert.equal(expiryFeb2024.getFullYear(), 2024)
  assert.equal(expiryFeb2024.getMonth(), 1) // February (0-indexed)
  assert.equal(expiryFeb2024.getDate(), 29) // 29 days in leap year
  assert.equal(expiryFeb2024.getHours(), 23)
  assert.equal(expiryFeb2024.getMinutes(), 59)
  assert.equal(expiryFeb2024.getSeconds(), 59)
  assert.equal(expiryFeb2024.getMilliseconds(), 999)

  // 2. Non-Leap Year February (2025) -> Feb 28 23:59:59.999
  const feb2025 = new Date(2025, 1, 15) // Feb 15, 2025
  const expiryFeb2025 = calculateMonthEndExpiry(feb2025)
  assert.equal(expiryFeb2025.getFullYear(), 2025)
  assert.equal(expiryFeb2025.getMonth(), 1)
  assert.equal(expiryFeb2025.getDate(), 28) // 28 days in non-leap year

  // 3. 30-Day Months (April) -> April 30 23:59:59.999
  const apr2026 = new Date(2026, 3, 5) // Apr 5, 2026
  const expiryApr2026 = calculateMonthEndExpiry(apr2026)
  assert.equal(expiryApr2026.getMonth(), 3)
  assert.equal(expiryApr2026.getDate(), 30)

  // 4. 31-Day Months (August) -> August 31 23:59:59.999
  const aug2026 = new Date(2026, 7, 16) // Aug 16, 2026
  const expiryAug2026 = calculateMonthEndExpiry(aug2026)
  assert.equal(expiryAug2026.getMonth(), 7)
  assert.equal(expiryAug2026.getDate(), 31)

  // 5. Year rollover (December) -> December 31 23:59:59.999
  const dec2026 = new Date(2026, 11, 1) // Dec 1, 2026
  const expiryDec2026 = calculateMonthEndExpiry(dec2026)
  assert.equal(expiryDec2026.getFullYear(), 2026)
  assert.equal(expiryDec2026.getMonth(), 11)
  assert.equal(expiryDec2026.getDate(), 31)
})

test('isSubscriptionActive accurately verifies active state and expiration timestamp', () => {
  const futureDate = new Date(Date.now() + 10000000)
  const pastDate = new Date(Date.now() - 10000000)

  // Active subscription with future expiry
  assert.equal(isSubscriptionActive({ status: 'ACTIVE', expiresAt: futureDate }), true)

  // Expired date
  assert.equal(isSubscriptionActive({ status: 'ACTIVE', expiresAt: pastDate }), false)

  // Status not ACTIVE
  assert.equal(isSubscriptionActive({ status: 'PENDING', expiresAt: futureDate }), false)
  assert.equal(isSubscriptionActive({ status: 'REJECTED', expiresAt: futureDate }), false)
  assert.equal(isSubscriptionActive({ status: 'EXPIRED', expiresAt: futureDate }), false)
  assert.equal(isSubscriptionActive(null), false)
})

test('parseYouTubeVideoId parses watch URLs, youtu.be, shorts, and embed links', () => {
  assert.equal(parseYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ')
  assert.equal(parseYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ?t=10'), 'dQw4w9WgXcQ')
  assert.equal(parseYouTubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ'), 'dQw4w9WgXcQ')
  assert.equal(parseYouTubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ')
  assert.equal(parseYouTubeVideoId('dQw4w9WgXcQ'), 'dQw4w9WgXcQ')
  assert.equal(parseYouTubeVideoId(''), null)
  assert.equal(parseYouTubeVideoId('not-a-youtube-url'), null)
})

test('getYouTubeEmbedUrl correctly generates sandbox embed URLs', () => {
  const embed = getYouTubeEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', { autoplay: true })
  assert.match(embed, /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?/)
  assert.match(embed, /autoplay=1/)
  assert.match(embed, /enablejsapi=1/)
})

test('requireActiveSubscription allows leadership and active student subscriptions', async () => {
  const { requireActiveSubscription } = await import('../server/middleware/subscription.js')

  // Leadership accounts are always exempt
  let nextCalled = false
  const adminReq = { user: { role: 'PRESIDENT', isPrimaryAdmin: true } }
  const res = { status: () => res, json: () => {} }
  await requireActiveSubscription(adminReq, res, () => { nextCalled = true })
  assert.equal(nextCalled, true)

  nextCalled = false
  const treasurerReq = { user: { role: 'TREASURER' } }
  await requireActiveSubscription(treasurerReq, res, () => { nextCalled = true })
  assert.equal(nextCalled, true)
})

test('requireActiveSite blocks non-admin requests during hibernation with 503', async () => {
  const { requireActiveSite } = await import('../server/middleware/hibernation.js')
  const { prisma } = await import('../server/db/prisma.js')

  // Authentication routes always pass through
  let authNextCalled = false
  const authReq = { path: '/auth/login' }
  const authRes = { status: () => authRes, json: () => {} }
  await requireActiveSite(authReq, authRes, () => { authNextCalled = true })
  assert.equal(authNextCalled, true)

  // Admin access during hibernation is allowed
  let adminNextCalled = false
  const adminReq = { user: { role: 'PRESIDENT', isPrimaryAdmin: true }, path: '/api/v1/admin/members' }
  const res = { status: () => res, json: () => {} }
  await requireActiveSite(adminReq, res, () => { adminNextCalled = true })
  assert.equal(adminNextCalled, true)

  // Student access during hibernation returns 503
  let capturedStatus = null
  let capturedJson = null
  const studentReq = { user: { role: 'STUDENT', isPrimaryAdmin: false }, path: '/api/v1/member/events' }
  const studentRes = {
    status: (s) => {
      capturedStatus = s
      return studentRes
    },
    json: (data) => {
      capturedJson = data
      return studentRes
    },
  }

  // Temporarily set siteStatus to HIBERNATING
  await prisma.clubSetting.upsert({
    where: { key: 'siteStatus' },
    create: { key: 'siteStatus', value: 'HIBERNATING' },
    update: { value: 'HIBERNATING' },
  })

  let studentNextCalled = false
  await requireActiveSite(studentReq, studentRes, () => { studentNextCalled = true })
  assert.equal(studentNextCalled, false)
  assert.equal(capturedStatus, 503)
  assert.equal(capturedJson?.hibernating, true)
  assert.equal(capturedJson?.siteStatus, 'HIBERNATING')

  // Restore siteStatus to ACTIVE
  await prisma.clubSetting.upsert({
    where: { key: 'siteStatus' },
    create: { key: 'siteStatus', value: 'ACTIVE' },
    update: { value: 'ACTIVE' },
  })
})

test.after(async () => {
  const { prisma } = await import('../server/db/prisma.js')
  await prisma.$disconnect()
})
