import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { eventInputSchema, resubmitPaymentSchema } from '../server/validators/member.validator.js'
import { formatCsvValue } from '../src/lib/export-csv.js'
import { hasActiveEventPass, isDraftRegistration, isPaymentAwaitingReview, isRejectedPayment, resolveEventPricing, resolveEventRegistrationMode } from '../server/utils/event-registration.js'
import { paymentReferenceLockName } from '../server/utils/payment-reference-lock.js'
import { resolvePublicAppUrl } from '../server/config/public-url.js'

describe('Event Studio & Registrations Management', () => {
  it('validates comprehensive event studio payload with pricing, tracks, and custom questions', () => {
    const payload = {
      title: 'Advanced Threat Hunting & Forensics Workshop',
      eventType: 'Workshop',
      dateTime: '2026-04-10T10:00:00.000Z',
      venue: 'Cyber Range Lab 101',
      capacity: 60,
      shortDescription: 'Hands-on packet analysis and memory forensics',
      requiresPayment: true,
      paymentAmount: 150,
      paymentUpiId: 'club@okaxis',
      allowMultipleActivities: true,
      activities: [
        { name: 'Memory Dump Analysis', price: 50, capacity: 30 },
        { name: 'Network PCAP Inspection', price: 50, capacity: 30 },
      ],
      formFields: [
        { fieldName: 'Do you have Kali Linux installed?', fieldType: 'select', isRequired: true, options: ['Yes', 'No'] },
        { fieldName: 'GitHub Handle', fieldType: 'text', isRequired: false },
      ],
    }

    const parsed = eventInputSchema.safeParse(payload)
    assert.equal(parsed.success, true)
    assert.equal(parsed.data.title, 'Advanced Threat Hunting & Forensics Workshop')
    assert.equal(parsed.data.activities.length, 2)
    assert.equal(parsed.data.formFields.length, 2)
  })

  it('keeps drafts and unpaid registrations from qualifying as active event passes', () => {
    assert.equal(isDraftRegistration({ status: 'DRAFT' }), true)
    const legacyUnsubmittedPayment = { status: 'PAYMENT_PENDING', paymentStatus: 'PENDING', totalAmount: 150, paymentReference: null }
    assert.equal(isDraftRegistration(legacyUnsubmittedPayment), true)
    assert.equal(hasActiveEventPass(legacyUnsubmittedPayment), false)
    assert.equal(hasActiveEventPass({ status: 'DRAFT', paymentStatus: 'PENDING' }), false)
    assert.equal(hasActiveEventPass({ status: 'UNDER_VERIFICATION', paymentStatus: 'UNDER_VERIFICATION' }), false)
    assert.equal(hasActiveEventPass({ status: 'PAYMENT_PENDING', paymentStatus: 'FREE' }), false)
    assert.equal(hasActiveEventPass({ status: 'REGISTERED', paymentStatus: 'REJECTED' }), false)
    assert.equal(hasActiveEventPass({ status: 'REGISTERED', paymentStatus: 'FREE', totalAmount: 150 }), false)
    assert.equal(hasActiveEventPass({ status: 'REGISTERED', paymentStatus: 'FREE' }), true)
    assert.equal(hasActiveEventPass({ status: 'PROJECT_SUBMITTED', paymentStatus: 'VERIFIED' }), true)
  })

  it('resolves individual and team modes correctly for BOTH and legacy team events', () => {
    const bothModeEvent = { registrationType: 'BOTH', isTeamEvent: true }
    assert.deepEqual(resolveEventRegistrationMode(bothModeEvent, 'INDIVIDUAL'), { supportsTeams: true, isTeam: false })
    assert.deepEqual(resolveEventRegistrationMode(bothModeEvent, 'TEAM'), { supportsTeams: true, isTeam: true })
    assert.deepEqual(resolveEventRegistrationMode({ registrationType: 'INDIVIDUAL', isTeamEvent: false }, 'TEAM'), { supportsTeams: false, isTeam: false })
    assert.deepEqual(resolveEventRegistrationMode({ isTeamEvent: true }, 'INDIVIDUAL'), { supportsTeams: true, isTeam: true })
  })

  it('only allows organizer review transitions for valid submitted paid registrations', () => {
    const submitted = {
      status: 'UNDER_VERIFICATION',
      paymentStatus: 'UNDER_VERIFICATION',
      totalAmount: 150,
      paymentReference: 'UPI123456789',
    }
    assert.equal(isPaymentAwaitingReview(submitted), true)
    assert.equal(isPaymentAwaitingReview({ ...submitted, paymentReference: null }), false)
    assert.equal(isPaymentAwaitingReview({ ...submitted, totalAmount: 0 }), false)
    assert.equal(isPaymentAwaitingReview({ ...submitted, status: 'DRAFT' }), false)
    assert.equal(isRejectedPayment({ ...submitted, status: 'PAYMENT_REJECTED', paymentStatus: 'REJECTED' }), true)
    assert.equal(isRejectedPayment(submitted), false)
  })

  it('uses Render deployment URLs for password reset links when no explicit public URL is set', () => {
    assert.equal(resolvePublicAppUrl({ RENDER_EXTERNAL_URL: 'https://cyber-portal.onrender.com' }), 'https://cyber-portal.onrender.com')
    assert.equal(resolvePublicAppUrl({ RENDER_EXTERNAL_HOSTNAME: 'cyber-portal.onrender.com' }), 'https://cyber-portal.onrender.com')
    assert.equal(resolvePublicAppUrl({ PUBLIC_APP_URL: 'https://portal.example.edu', RENDER_EXTERNAL_URL: 'https://cyber-portal.onrender.com' }), 'https://portal.example.edu')
  })

  it('creates stable short advisory-lock names for normalized UPI UTR values', () => {
    const first = paymentReferenceLockName(' utr-123456 ')
    assert.equal(first, paymentReferenceLockName('UTR-123456'))
    assert.ok(first.length <= 64)
    assert.equal(paymentReferenceLockName('   '), null)
  })

  it('allows UTR resubmission without trusting a browser-supplied amount', () => {
    const parsed = resubmitPaymentSchema.safeParse({ paymentReference: 'UPI-UTR-123456' })
    assert.equal(parsed.success, true)
    assert.equal(parsed.data.amountPaid, null)
  })

  it('resolves fixed and tiered fees from event configuration instead of trusting browser amounts', () => {
    const fixed = resolveEventPricing({
      requiresPayment: true,
      paymentAmount: 150,
      paymentConfig: { type: 'FIXED', price: 150 },
    }, { paymentOption: { amount: 0 } })
    assert.equal(fixed.totalAmount, 150)

    const legacyPaidConfig = resolveEventPricing({
      requiresPayment: false,
      paymentConfig: { type: 'PAID', price: 90 },
    })
    assert.equal(legacyPaidConfig.totalAmount, 90)

    const tiered = resolveEventPricing({
      requiresPayment: true,
      paymentConfig: {
        type: 'TIERS',
        tiers: [
          { name: 'Student', price: 75 },
          { name: 'Standard', price: 125 },
        ],
      },
    }, { paymentOption: { name: 'Standard', amount: 1 } })
    assert.equal(tiered.totalAmount, 125)
    assert.equal(tiered.paymentOption.name, 'Standard')

    const inferredTiers = resolveEventPricing({
      requiresPayment: false,
      paymentAmount: 150,
      paymentConfig: { tiers: [{ name: 'Student', price: 75 }] },
    }, { paymentOption: 'Student' })
    assert.equal(inferredTiers.totalAmount, 75)
  })

  it('rejects unknown paid tiers and unconfigured paid events', () => {
    assert.throws(() => resolveEventPricing({
      requiresPayment: true,
      paymentConfig: { type: 'TIERS', tiers: [{ name: 'Student', price: 75 }] },
    }, { paymentOption: 'VIP' }), /valid payment tier/)

    assert.throws(() => resolveEventPricing({ requiresPayment: true, paymentAmount: null }), /valid registration fee/)
  })

  it('calculates activity fees from saved prices and rejects unavailable selections', () => {
    const event = {
      allowMultipleActivities: true,
      activities: [
        { id: 'a1', name: 'Workshop A', price: 50, isAvailable: true },
        { id: 'a2', name: 'Workshop B', price: 25, isAvailable: true },
      ],
    }
    const pricing = resolveEventPricing(event, { selectedActivityIds: ['a1', 'a2'] })
    assert.equal(pricing.totalAmount, 75)
    assert.equal(pricing.selectedActivities.length, 2)

    const paidEventWithFreeActivity = resolveEventPricing({
      requiresPayment: true,
      paymentAmount: 150,
      activities: [{ id: 'free', name: 'Free Add-on', price: 0, isAvailable: true }],
    }, { selectedActivityIds: ['free'] })
    assert.equal(paidEventWithFreeActivity.totalAmount, 150, 'A free activity must not bypass the configured event fee')

    const tierWithActivity = resolveEventPricing({
      requiresPayment: true,
      allowMultipleActivities: true,
      paymentConfig: { type: 'TIERS', tiers: [{ name: 'Student', price: 75 }] },
      activities: [{ id: 'a1', name: 'Workshop A', price: 25, isAvailable: true }],
    }, { paymentOption: 'Student', selectedActivityIds: ['a1'] })
    assert.equal(tierWithActivity.totalAmount, 100)
    assert.throws(() => resolveEventPricing(event, { selectedActivityIds: ['unknown'] }), /unavailable/)
  })

  it('verifies CSV download rows format missing event attendee fields as "---"', () => {
    const event = { id: 'evt-101', title: 'Cyber CTF 2026' }
    const reg = {
      id: 'reg-001',
      user: {
        memberId: '23MR01A0501',
        profile: {
          name: 'Alice Student',
          rollNumber: null, // missing -> '---'
          department: 'CSE-AIML',
          year: 2,
          email: 'alice@mrdu.edu',
          phone: null, // missing -> '---'
        },
      },
      branch: null,
      year: null,
      selectedActivities: [{ name: 'Track A' }],
      totalAmount: 100,
      paymentStatus: 'VERIFIED',
      paymentReference: 'UTR123456789',
      registeredAt: new Date('2026-03-01T12:00:00Z'),
    }

    const row = [
      reg.id,
      event.title,
      reg.user?.memberId,
      reg.user?.profile?.name,
      reg.user?.profile?.rollNumber,
      reg.branch || reg.user?.profile?.department,
      reg.year || reg.user?.profile?.year,
      reg.user?.profile?.email,
      reg.user?.profile?.phone,
      Array.isArray(reg.selectedActivities) ? reg.selectedActivities.map(a => a.name).join('; ') : null,
      Number(reg.totalAmount) || 0,
      reg.paymentStatus,
      reg.paymentReference,
      reg.registeredAt ? new Date(reg.registeredAt).toLocaleString() : null,
    ].map(formatCsvValue)

    assert.equal(row[0], 'reg-001')
    assert.equal(row[1], 'Cyber CTF 2026')
    assert.equal(row[2], '23MR01A0501')
    assert.equal(row[3], 'Alice Student')
    assert.equal(row[4], '---', 'Missing roll number must format as "---"')
    assert.equal(row[5], 'CSE-AIML')
    assert.equal(row[6], '2')
    assert.equal(row[7], 'alice@mrdu.edu')
    assert.equal(row[8], '---', 'Missing phone must format as "---"')
    assert.equal(row[9], 'Track A')
    assert.equal(row[10], '100')
    assert.equal(row[11], 'VERIFIED')
    assert.equal(row[12], 'UTR123456789')
  })

  it('guarantees sensitive credentials (password hashes, PINs, tokens) are excluded from export structures', () => {
    const sensitiveUser = {
      id: 'u1',
      memberId: 'PRES001',
      name: 'President',
      role: 'PRESIDENT',
      passwordHash: '$2b$12$secretHashValue123456789',
      masterPinHash: '$2b$12$secretPinHashValue987654',
      twoFactorSecret: 'JBSWY3DPEHPK3PXP',
    }

    // CSV Roster Row definition
    const safeExportRow = [
      sensitiveUser.memberId,
      sensitiveUser.name,
      sensitiveUser.role,
      null, // rollNumber
      'CSE', // department
      null, // year
      'president@mrdu.edu', // email
      null, // phone
      'ACTIVE',
      'Enabled',
      '2026-01-01',
    ].map(formatCsvValue)

    assert.equal(safeExportRow.includes(sensitiveUser.passwordHash), false)
    assert.equal(safeExportRow.includes(sensitiveUser.masterPinHash), false)
    assert.equal(safeExportRow.includes(sensitiveUser.twoFactorSecret), false)
  })
})
