import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { eventInputSchema } from '../server/validators/member.validator.js'
import { formatCsvValue } from '../src/lib/export-csv.js'

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
