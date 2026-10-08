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
