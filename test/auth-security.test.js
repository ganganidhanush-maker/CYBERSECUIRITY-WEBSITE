import test from 'node:test'
import assert from 'node:assert/strict'
import { requirePermission, requirePresident } from '../server/middleware/auth.js'
import { isPresident, toSafeUser } from '../server/utils/safe-user.js'
import { loginSchema } from '../server/validators/auth.validator.js'

const databaseUser = {
  id: 'user_1',
  memberId: '25EU07R0015',
  passwordHash: '$2b$12$not-for-client-use',
  role: 'PRESIDENT',
  accountStatus: 'ACTIVE',
  profile: { name: 'Dhanush', rollNumber: null, department: null, year: null, email: null, phone: null, profileImage: null },
}

test('safe user responses never expose a password hash', () => {
  const safeUser = toSafeUser(databaseUser)
  assert.equal('passwordHash' in safeUser, false)
  assert.equal(safeUser.memberId, '25EU07R0015')
})

test('only PRESIDENT receives the president authorization predicate', () => {
  assert.equal(isPresident(databaseUser), true)
  assert.equal(isPresident({ role: 'STUDENT' }), false)
})

test('president middleware returns 403 before an admin controller executes for students', () => {
  let nextCalled = false
  let statusCode
  let payload
  const response = { status: code => { statusCode = code; return response }, json: body => { payload = body } }
  requirePresident({ user: { role: 'STUDENT' } }, response, () => { nextCalled = true })
  assert.equal(statusCode, 403)
  assert.deepEqual(payload, { message: 'Access denied: President role required.' })
  assert.equal(nextCalled, false)
})

test('member permissions are independently enforced on the server', () => {
  let nextCalled = false
  const deniedResponse = { status: () => deniedResponse, json: () => {} }
  requirePermission('GALLERY_VIEW')({ user: { role: 'STUDENT', permissions: [{ permission: 'EVENTS_VIEW' }] } }, deniedResponse, () => { nextCalled = true })
  assert.equal(nextCalled, false)

  requirePermission('EVENTS_VIEW')({ user: { role: 'STUDENT', permissions: [{ permission: 'EVENTS_VIEW' }] } }, deniedResponse, () => { nextCalled = true })
  assert.equal(nextCalled, true)
})

test('login validation rejects malformed identifiers, empty passwords, and oversized passwords', () => {
  assert.equal(loginSchema.safeParse({ memberId: '../../admin', password: 'x' }).success, false)
  assert.equal(loginSchema.safeParse({ memberId: 'MEMBER001', password: '' }).success, false)
  assert.equal(loginSchema.safeParse({ memberId: 'MEMBER001', password: 'StrongPassword1!' }).success, true)
  assert.equal(loginSchema.safeParse({ memberId: 'MEMBER001', password: 'a'.repeat(129) }).success, false)
})

test('createMemberSchema enforces strong passwords and allows full permission set', async () => {
  const { createMemberSchema } = await import('../server/validators/auth.validator.js')
  const valid = createMemberSchema.safeParse({
    memberId: 'STUDENT2026',
    password: 'SecurePass2026!@#',
    role: 'STUDENT',
    profile: { name: 'Alex Defender', email: 'alex@example.com' },
    permissions: ['DASHBOARD_VIEW', 'EVENTS_VIEW', 'EVENT_REGISTER', 'REGISTRATIONS_VIEW', 'QR_PASSES_VIEW', 'GALLERY_VIEW', 'CHAT_USE', 'SUGGESTIONS_CREATE', 'FEEDBACK_CREATE', 'NOTIFICATIONS_VIEW', 'PROFILE_EDIT'],
  })
  assert.equal(valid.success, true)

  const weak = createMemberSchema.safeParse({
    memberId: 'STUDENT2026',
    password: 'weakpassword',
    role: 'STUDENT',
    profile: { name: 'Alex Defender' },
    permissions: ['EVENTS_VIEW'],
  })
  assert.equal(weak.success, false)
  assert.match(weak.error.issues[0]?.message, /Password must include/i)
})

test('eventInputSchema accepts valid events and normalizes cover photos', async () => {
  const { eventInputSchema } = await import('../server/validators/member.validator.js')
  const valid = eventInputSchema.safeParse({
    title: 'Advanced Web Pentesting Workshop',
    eventType: 'Workshop',
    dateTime: new Date(Date.now() + 86400000).toISOString(),
    location: 'Cyber Lab 02',
    capacity: 40,
    photoUrl: 'https://example.com/banner.jpg',
  })
  assert.equal(valid.success, true)
  assert.equal(valid.data.title, 'Advanced Web Pentesting Workshop')
  assert.equal(valid.data.capacity, 40)
})

test('galleryAlbumSchema validates album creation', async () => {
  const { galleryAlbumSchema } = await import('../server/validators/member.validator.js')
  const valid = galleryAlbumSchema.safeParse({
    name: 'Hackathon 2026',
    description: 'Annual college ethical hacking sprint',
  })
  assert.equal(valid.success, true)
  assert.equal(valid.data.name, 'Hackathon 2026')
})
