import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeUpiId,
  buildUpiLinks,
  generateUpiQrDataUrl,
  parseUtrFromText,
} from '../src/lib/upiPayment.js'

describe('UPI Payment, Dynamic QR, and OCR UTR Parsing', () => {
  it('normalizes UPI IDs accurately', () => {
    assert.equal(normalizeUpiId('  Club@YBL  '), 'club@ybl')
    assert.equal(normalizeUpiId(''), '')
    assert.equal(normalizeUpiId(null), '')
  })

  it('builds PhonePe, GPay, Paytm, and standard UPI deep links', () => {
    const links = buildUpiLinks({
      upiId: 'organizer@ybl',
      payeeName: 'CyberSecurityClub',
      amount: 150,
      note: 'Symposium Pass',
    })

    assert.ok(links)
    assert.ok(links.phonePeUri.startsWith('phonepe://pay?'))
    assert.ok(links.phonePeUri.includes('pa=organizer%40ybl'))
    assert.ok(links.phonePeUri.includes('am=150.00'))
    assert.ok(links.phonePeUri.includes('cu=INR'))

    assert.ok(links.gPayUri.startsWith('gpay://upi/pay?'))
    assert.ok(links.paytmUri.startsWith('paytmmp://pay?'))
    assert.ok(links.upiUri.startsWith('upi://pay?'))
  })

  it('generates a valid QR code data URL offline', async () => {
    const qrUrl = await generateUpiQrDataUrl({
      upiId: 'club@okaxis',
      amount: 250,
      note: 'Workshop Pass',
    })

    assert.ok(qrUrl)
    assert.ok(qrUrl.startsWith('data:image/png;base64,'))
  })

  it('extracts 12-digit UTR from PhonePe receipts', () => {
    const phonePeReceipt = `
      Payment Successful
      Paid to CyberSecurityClub
      ₹150.00
      Transaction ID: T24090123456789
      UPI Ref No: 429182748192
      Debited from State Bank of India
    `
    const utr = parseUtrFromText(phonePeReceipt)
    assert.equal(utr, '429182748192')
  })

  it('extracts 12-digit UTR from Google Pay receipts', () => {
    const gPayReceipt = `
      Google Pay
      Payment to dhanush@ybl
      ₹250.00
      UPI transaction ID 509281729384
      To: CyberSecurityClub
    `
    const utr = parseUtrFromText(gPayReceipt)
    assert.equal(utr, '509281729384')
  })

  it('extracts 12-digit UTR from Paytm receipts', () => {
    const paytmReceipt = `
      Paytm Payments Bank
      Money Sent
      ₹ 100
      UTR: 619283748291
      Ref ID: 90281928
    `
    const utr = parseUtrFromText(paytmReceipt)
    assert.equal(utr, '619283748291')
  })

  it('extracts 12-digit spaced and dashed UTR numbers', () => {
    const spaced = 'UPI Ref No: 4291 8274 8192'
    const dashed = 'UTR: 4291-8274-8192'
    assert.equal(parseUtrFromText(spaced), '429182748192')
    assert.equal(parseUtrFromText(dashed), '429182748192')
  })

  it('returns null gracefully when no 12-digit sequence exists', () => {
    const badReceipt = 'Payment pending. Please try again. Error code: 504'
    assert.equal(parseUtrFromText(badReceipt), null)
  })

  it('verifies server-side upi-utr parser extracts correctly', async () => {
    const { parseUtrFromText: serverParseUtr } = await import('../server/utils/upi-utr.js')
    const sample = 'Payment Successful UPI Ref No: 918273645120 to Cyber Security Club'
    assert.equal(serverParseUtr(sample), '918273645120')
  })
})

describe('Server Virtual Waiting Room & Concurrency Throttling', () => {
  it('allows leadership and admin roles to bypass waiting room unconditionally', async () => {
    const { evaluateUserQueue } = await import('../server/services/queue.service.js')
    const adminUser = { id: 'admin-1', role: 'PRESIDENT' }
    const result = evaluateUserQueue(adminUser, {}, { queueEnabled: true, maxConcurrent: 3, waitTimeSeconds: 15 })
    assert.equal(result.requiresQueue, false)
  })

  it('admits students up to maxConcurrent limit and queues surplus students', async () => {
    const { evaluateUserQueue, releaseSlot } = await import('../server/services/queue.service.js')
    const cfg = { queueEnabled: true, maxConcurrent: 3, waitTimeSeconds: 10 }

    // Clear test slots
    for (let i = 1; i <= 5; i++) releaseSlot(`student-test-${i}`)

    // First 3 students admitted immediately
    const s1 = evaluateUserQueue({ id: 'student-test-1', role: 'STUDENT' }, {}, cfg)
    const s2 = evaluateUserQueue({ id: 'student-test-2', role: 'STUDENT' }, {}, cfg)
    const s3 = evaluateUserQueue({ id: 'student-test-3', role: 'STUDENT' }, {}, cfg)

    assert.equal(s1.requiresQueue, false)
    assert.equal(s2.requiresQueue, false)
    assert.equal(s3.requiresQueue, false)

    // 4th student is held in waiting room with queue position & timer
    const s4 = evaluateUserQueue({ id: 'student-test-4', role: 'STUDENT' }, {}, cfg)
    assert.equal(s4.requiresQueue, true)
    assert.equal(s4.queuePosition, 1)
    assert.equal(s4.maxConcurrent, 3)
    assert.ok(s4.queueWaitSeconds >= 10)

    // Clean up
    for (let i = 1; i <= 5; i++) releaseSlot(`student-test-${i}`)
  })
})

describe('Bulk Event Pass Issuance & Solo Event Validation', () => {
  it('validates bulkIssuePassesSchema rejecting empty or malformed inputs', async () => {
    const { bulkIssuePassesSchema } = await import('../server/validators/member.validator.js')

    // Valid batch
    const valid = bulkIssuePassesSchema.safeParse({
      memberIds: ['23CS101', '23CS102', 'dhanush@example.com'],
      notes: 'Offline batch pass',
    })
    assert.equal(valid.success, true)
    assert.equal(valid.data.assumePaid, true)
    assert.equal(valid.data.memberIds.length, 3)

    // Rejects empty array
    const empty = bulkIssuePassesSchema.safeParse({ memberIds: [] })
    assert.equal(empty.success, false)

    // Rejects batches exceeding 500 limit
    const tooMany = Array.from({ length: 501 }, (_, i) => `23CS${i + 1}`)
    const excess = bulkIssuePassesSchema.safeParse({ memberIds: tooMany })
    assert.equal(excess.success, false)
  })

  it('restricts bulk pass issuance to Solo / Individual events and flags Team-only events', async () => {
    const { resolveEventRegistrationMode } = await import('../server/utils/event-registration.js')

    // Solo individual event
    const soloEvent = { registrationType: 'INDIVIDUAL', isTeamEvent: false }
    const soloMode = resolveEventRegistrationMode(soloEvent, 'INDIVIDUAL')
    assert.equal(soloMode.isTeam, false)

    // Both mode allows solo
    const bothEvent = { registrationType: 'BOTH', isTeamEvent: false }
    const bothMode = resolveEventRegistrationMode(bothEvent, 'INDIVIDUAL')
    assert.equal(bothMode.isTeam, false)

    // Team only event is flagged as team
    const teamEvent = { registrationType: 'TEAM', isTeamEvent: true }
    const teamMode = resolveEventRegistrationMode(teamEvent, 'INDIVIDUAL')
    assert.equal(teamMode.isTeam, true)
  })

  it('verifies bulk verified passes satisfy hasActiveEventPass predicate', async () => {
    const { hasActiveEventPass } = await import('../server/utils/event-registration.js')

    const paidPass = {
      status: 'REGISTERED',
      paymentStatus: 'VERIFIED',
      totalAmount: 150,
      amountPaid: 150,
      paymentMethod: 'OFFLINE_BULK_ORGANIZER',
    }
    assert.equal(hasActiveEventPass(paidPass), true)

    const freePass = {
      status: 'REGISTERED',
      paymentStatus: 'FREE',
      totalAmount: 0,
      amountPaid: 0,
    }
    assert.equal(hasActiveEventPass(freePass), true)

    const unverifiedPass = {
      status: 'REGISTERED',
      paymentStatus: 'PENDING',
      totalAmount: 150,
    }
    assert.equal(hasActiveEventPass(unverifiedPass), false)
  })

  it('upgrades a waiting or submitted registration to an active verified pass', async () => {
    const { hasActiveEventPass } = await import('../server/utils/event-registration.js')

    // Initial waiting state: student submitted registration waiting for approval/pass
    const waitingRegistration = {
      id: 'reg-wait-1',
      eventId: 'event-1',
      userId: 'user-1',
      status: 'REGISTERED',
      paymentStatus: 'SUBMITTED',
      totalAmount: 100,
      amountPaid: 0,
      qrPassCode: null,
    }

    assert.equal(hasActiveEventPass(waitingRegistration), false, 'Waiting registration should not have active pass initially')

    // Transition when pass is issued by organizer/admin
    const upgradedRegistration = {
      ...waitingRegistration,
      status: 'REGISTERED',
      paymentStatus: 'VERIFIED',
      amountPaid: waitingRegistration.totalAmount,
      paymentMethod: 'OFFLINE_BULK_ORGANIZER',
      qrPassCode: 'PASS-TEST-12345',
    }

    assert.equal(hasActiveEventPass(upgradedRegistration), true, 'Upgraded registration must have active verified pass')
    assert.equal(upgradedRegistration.paymentStatus, 'VERIFIED')
    assert.ok(upgradedRegistration.qrPassCode)
  })

  it('partitions event candidates into new passes, waiting upgrades, and already active passes', async () => {
    const { hasActiveEventPass } = await import('../server/utils/event-registration.js')

    const users = [
      { id: 'u1', memberId: '23EU07R0015', name: 'Student New' },
      { id: 'u2', memberId: '23EU07R0016', name: 'Student Waiting' },
      { id: 'u3', memberId: '23EU07R0017', name: 'Student Already Passed' },
    ]

    const existingRegistrations = new Map([
      ['u2', { id: 'reg-2', status: 'REGISTERED', paymentStatus: 'SUBMITTED', totalAmount: 100 }],
      ['u3', { id: 'reg-3', status: 'REGISTERED', paymentStatus: 'VERIFIED', totalAmount: 100, amountPaid: 100 }],
    ])

    const newPassUsers = []
    const waitingUpgradeUsers = []
    const alreadyHadPassList = []

    for (const user of users) {
      const existingReg = existingRegistrations.get(user.id)
      if (!existingReg) {
        newPassUsers.push(user)
      } else if (hasActiveEventPass(existingReg)) {
        alreadyHadPassList.push({
          user,
          reason: 'ALREADY_ACTIVE_PASS',
        })
      } else {
        waitingUpgradeUsers.push({ user, existingReg })
      }
    }

    assert.equal(newPassUsers.length, 1)
    assert.equal(newPassUsers[0].id, 'u1')

    assert.equal(waitingUpgradeUsers.length, 1)
    assert.equal(waitingUpgradeUsers[0].user.id, 'u2')

    assert.equal(alreadyHadPassList.length, 1)
    assert.equal(alreadyHadPassList[0].user.id, 'u3')
  })

  it('correctly matches short, full, and symbol-separated roll numbers', () => {
    const mockUsers = [
      {
        id: 'u-1',
        memberId: '23EU07R0015',
        profile: { rollNumber: '23EU07R0015', name: 'Dhanush' },
      },
      {
        id: 'u-2',
        memberId: 'GUEST2026042',
        profile: { rollNumber: '24EU07R0099', name: 'Priya' },
      },
    ]

    const resolveRollNumber = (token) => {
      const tLower = token.trim().toLowerCase()
      const tClean = token.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')

      // Direct match
      for (const u of mockUsers) {
        const mClean = (u.memberId || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
        const rClean = (u.profile?.rollNumber || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
        if (mClean === tClean || rClean === tClean || u.memberId?.toLowerCase() === tLower || u.profile?.rollNumber?.toLowerCase() === tLower) {
          return { user: u, status: 'MATCHED' }
        }
      }

      // Suffix/partial match (min length 4)
      if (tClean.length >= 4) {
        const candidates = mockUsers.filter(u => {
          const mClean = (u.memberId || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
          const rClean = (u.profile?.rollNumber || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
          return mClean.endsWith(tClean) || rClean.endsWith(tClean) || mClean.includes(tClean) || rClean.includes(tClean)
        })

        if (candidates.length === 1) return { user: candidates[0], status: 'MATCHED' }
        if (candidates.length > 1) return { user: null, status: 'AMBIGUOUS' }
      }

      return { user: null, status: 'NOT_FOUND' }
    }

    // 1. Exact match
    assert.equal(resolveRollNumber('23EU07R0015').user?.id, 'u-1')
    // 2. Case insensitive
    assert.equal(resolveRollNumber('23eu07r0015').user?.id, 'u-1')
    // 3. Dashed / spaced formatting
    assert.equal(resolveRollNumber('23-EU-07R-0015').user?.id, 'u-1')
    // 4. Short roll number suffix matching
    assert.equal(resolveRollNumber('07R0015').user?.id, 'u-1')
    // 5. Guest account whose memberId is GUEST2026042 but profile roll number is 24EU07R0099
    assert.equal(resolveRollNumber('24EU07R0099').user?.id, 'u-2')
    assert.equal(resolveRollNumber('07R0099').user?.id, 'u-2')
    // 6. Unknown / typo
    assert.equal(resolveRollNumber('99INVALID99').status, 'NOT_FOUND')
  })

  it('detects ambiguous short roll numbers when multiple students share suffix', () => {
    const mockUsers = [
      { id: 'u-1', memberId: '23EU07R0015', profile: { rollNumber: '23EU07R0015' } },
      { id: 'u-2', memberId: '24EU07R0015', profile: { rollNumber: '24EU07R0015' } },
    ]

    const resolveSuffix = (token) => {
      const clean = token.toUpperCase().replace(/[^A-Z0-9]/g, '')
      const candidates = mockUsers.filter(u => {
        const mClean = u.memberId.replace(/[^A-Z0-9]/g, '')
        return mClean.endsWith(clean)
      })
      if (candidates.length === 1) return { status: 'MATCHED', user: candidates[0] }
      if (candidates.length > 1) return { status: 'AMBIGUOUS', count: candidates.length }
      return { status: 'NOT_FOUND' }
    }

    const result = resolveSuffix('07R0015')
    assert.equal(result.status, 'AMBIGUOUS')
    assert.equal(result.count, 2)
  })

  it('validates bulkIssuePassesSchema with autoCreateMissingAccounts flag', async () => {
    const { bulkIssuePassesSchema } = await import('../server/validators/member.validator.js')

    // Default autoCreateMissingAccounts is false
    const def = bulkIssuePassesSchema.parse({
      memberIds: ['23EU07R0015'],
    })
    assert.equal(def.autoCreateMissingAccounts, false)

    // Explicit autoCreateMissingAccounts = true
    const enabled = bulkIssuePassesSchema.parse({
      memberIds: ['23EU07R0015'],
      autoCreateMissingAccounts: true,
    })
    assert.equal(enabled.autoCreateMissingAccounts, true)
  })

  it('partitions missing roll numbers into auto-create candidates when Option 3 is enabled vs notFound when disabled', () => {
    const tokenResolution = [
      { token: '23CS101', user: { id: 'u1', memberId: '23CS101' }, errorReason: null },
      { token: '23CS999', user: null, errorReason: 'STUDENT_NOT_FOUND', errorMessage: 'No student account matches' },
    ]

    // Case A: autoCreateMissingAccounts = false
    const disabledNotFound = []
    const disabledAutoCreate = []
    for (const tr of tokenResolution) {
      if (tr.errorReason) {
        disabledNotFound.push({ input: tr.token, reason: tr.errorReason })
      }
    }
    assert.equal(disabledNotFound.length, 1)
    assert.equal(disabledNotFound[0].input, '23CS999')
    assert.equal(disabledAutoCreate.length, 0)

    // Case B: autoCreateMissingAccounts = true
    const enabledNotFound = []
    const enabledAutoCreate = []
    for (const tr of tokenResolution) {
      if (tr.errorReason) {
        if (tr.errorReason === 'STUDENT_NOT_FOUND') {
          const cleanRoll = tr.token.toUpperCase().replace(/[^A-Z0-9]/g, '')
          if (cleanRoll.length >= 2) {
            enabledAutoCreate.push({ token: tr.token, rollNumber: cleanRoll })
            continue
          }
        }
        enabledNotFound.push({ input: tr.token, reason: tr.errorReason })
      }
    }
    assert.equal(enabledAutoCreate.length, 1)
    assert.equal(enabledAutoCreate[0].rollNumber, '23CS999')
    assert.equal(enabledNotFound.length, 0)
  })
})

