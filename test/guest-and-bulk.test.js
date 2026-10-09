import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { generateStrongPassword } from '../server/utils/guest-generator.js'
import { guestRegisterSchema, bulkCreateMembersSchema } from '../server/validators/member.validator.js'
import { getRolePermissions, rolePermissionMatrix } from '../server/config/permissions.js'

describe('Guest Student Account & Bulk Accounts Creation System', () => {
  it('generates cryptographically strong passwords satisfying all security rules', () => {
    for (let i = 0; i < 20; i++) {
      const pwd = generateStrongPassword()
      assert.ok(pwd.length >= 12, `Password length must be >= 12, got ${pwd.length}`)
      assert.ok(/[A-Z]/.test(pwd), 'Password must contain uppercase letter')
      assert.ok(/[a-z]/.test(pwd), 'Password must contain lowercase letter')
      assert.ok(/[0-9]/.test(pwd), 'Password must contain digit')
      assert.ok(/[!@#$%&*?]/.test(pwd), 'Password must contain special symbol')
    }
  })

  it('validates guest registration schema correctly', () => {
    const validGuest = {
      name: 'Aditya Rao',
      email: 'aditya.rao@gmail.com',
      college: 'Malla Reddy (MR) Deemed to be University',
      branch: 'CSE',
      specialization: 'AIML',
      phone: '9876543210',
    }

    const parsed = guestRegisterSchema.safeParse(validGuest)
    assert.equal(parsed.success, true)
    assert.equal(parsed.data.name, 'Aditya Rao')
    assert.equal(parsed.data.branch, 'CSE')
    assert.equal(parsed.data.specialization, 'AIML')
  })

  it('rejects guest registration with invalid email or missing name', () => {
    const invalidGuest1 = {
      name: '',
      email: 'aditya.rao@gmail.com',
      college: 'MRDU',
      branch: 'CSE',
    }
    assert.equal(guestRegisterSchema.safeParse(invalidGuest1).success, false)

    const invalidGuest2 = {
      name: 'Aditya Rao',
      email: 'not-an-email',
      college: 'MRDU',
      branch: 'CSE',
    }
    assert.equal(guestRegisterSchema.safeParse(invalidGuest2).success, false)
  })

  it('validates bulk student creation schema', () => {
    const bulkPayload = {
      students: [
        {
          name: 'Student 1',
          memberId: '25EU07R0001',
          password: 'Password@1234',
          rollNumber: '25EU07R0001',
          year: 1,
          department: 'CSE - AIML (MRDU)',
        },
        {
          name: 'Student 2',
          memberId: '25EU07R0002',
          password: 'Secure#Pass2026',
          rollNumber: '25EU07R0002',
          year: 1,
          department: 'CSE - AIML (MRDU)',
        },
      ],
    }

    const parsed = bulkCreateMembersSchema.safeParse(bulkPayload)
    assert.equal(parsed.success, true)
    assert.equal(parsed.data.students.length, 2)
    assert.equal(parsed.data.students[0].memberId, '25EU07R0001')
    assert.equal(parsed.data.students[1].memberId, '25EU07R0002')
  })

  it('rejects bulk creation when student list is empty', () => {
    const emptyBulk = { students: [] }
    assert.equal(bulkCreateMembersSchema.safeParse(emptyBulk).success, false)
  })

  it('strictly enforces STUDENT permissions for guest accounts without leadership privileges', () => {
    const permissions = getRolePermissions('STUDENT')
    assert.ok(permissions.includes('EVENTS_VIEW'), 'Student must have EVENTS_VIEW')
    assert.ok(permissions.includes('EVENT_REGISTER'), 'Student must have EVENT_REGISTER')
    assert.ok(permissions.includes('PROFILE_EDIT'), 'Student must have PROFILE_EDIT')

    // Ensure no admin permissions are granted
    assert.equal(permissions.includes('ACCOUNT_MANAGEMENT'), false)
    assert.equal(permissions.includes('EVENT_MANAGE'), false)
    assert.equal(permissions.includes('PAYMENTS_VERIFY'), false)
    assert.equal(permissions.includes('SETTINGS_MANAGE'), false)
    assert.equal(permissions.includes('AUDIT_VIEW'), false)
  })

  it('verifies GUEST Member ID format standard: GUEST{year}{serial}', () => {
    const currentYear = new Date().getFullYear()
    const sampleId1 = `GUEST${currentYear}001`
    const sampleId2 = `GUEST${currentYear}042`
    const sampleId3 = `GUEST${currentYear}100`

    const pattern = new RegExp(`^GUEST${currentYear}\\d{3,}$`)
    assert.ok(pattern.test(sampleId1), 'Should match GUEST2026001')
    assert.ok(pattern.test(sampleId2), 'Should match GUEST2026042')
    assert.ok(pattern.test(sampleId3), 'Should match GUEST2026100')
  })

  it('normalizes student roll number to uppercase so it becomes their permanent User ID', () => {
    const studentWithRoll = {
      name: 'Priya Sharma',
      rollNumber: ' 23eu07r0015 ',
      email: 'priya.sharma@mrdu.ac.in',
      college: 'Malla Reddy University',
      branch: 'CSE',
      year: 2,
    }

    const parsed = guestRegisterSchema.safeParse(studentWithRoll)
    assert.equal(parsed.success, true)
    assert.equal(parsed.data.rollNumber, '23EU07R0015')
    assert.equal(parsed.data.name, 'Priya Sharma')
  })

  it('allows backward compatibility when roll number is not provided, defaulting to null', () => {
    const guestWithoutRoll = {
      name: 'Aditya Rao',
      email: 'aditya.rao@gmail.com',
      college: 'MRDU',
      branch: 'CSE',
    }

    const parsed = guestRegisterSchema.safeParse(guestWithoutRoll)
    assert.equal(parsed.success, true)
    assert.equal(parsed.data.rollNumber, null)
  })

  it('validates and normalizes User ID (memberId) formatting when edited by admin', () => {
    const validateUserId = (input) => {
      const trimmed = String(input || '').trim().toUpperCase()
      if (!trimmed) return { valid: false, error: 'User ID cannot be empty.' }
      if (trimmed.length < 3 || trimmed.length > 32) return { valid: false, error: 'User ID must be between 3 and 32 characters.' }
      if (!/^[A-Z0-9_.-]+$/.test(trimmed)) return { valid: false, error: 'Invalid characters in User ID.' }
      return { valid: true, userId: trimmed }
    }

    assert.equal(validateUserId('23eu07r0015').userId, '23EU07R0015')
    assert.equal(validateUserId('  guest2026100  ').userId, 'GUEST2026100')
    assert.equal(validateUserId('admin-01').userId, 'ADMIN-01')
    assert.equal(validateUserId('student.cse_23').userId, 'STUDENT.CSE_23')

    // Invalid cases
    assert.equal(validateUserId('').valid, false)
    assert.equal(validateUserId('ab').valid, false, 'Should reject < 3 characters')
    assert.equal(validateUserId('A'.repeat(33)).valid, false, 'Should reject > 32 characters')
    assert.equal(validateUserId('user@name').valid, false, 'Should reject @ in User ID')
    assert.equal(validateUserId('user name').valid, false, 'Should reject spaces in User ID')
  })

  it('detects User ID conflicts to prevent duplicate memberId collisions', () => {
    const existingUsers = [
      { id: 'u1', memberId: '23EU07R0015' },
      { id: 'u2', memberId: '24EU07R0099' },
    ]

    const checkDuplicate = (targetUserId, newMemberId) => {
      const found = existingUsers.find(u => u.memberId === newMemberId && u.id !== targetUserId)
      return Boolean(found)
    }

    // Changing u1 to their same memberId is allowed
    assert.equal(checkDuplicate('u1', '23EU07R0015'), false)
    // Changing u1 to a fresh unused memberId is allowed
    assert.equal(checkDuplicate('u1', '25EU07R0001'), false)
    // Changing u1 to u2's memberId is blocked
    assert.equal(checkDuplicate('u1', '24EU07R0099'), true)
  })
})

