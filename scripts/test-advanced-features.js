import 'dotenv/config'
import assert from 'node:assert/strict'
import { createApp } from '../server/app.js'

const app = createApp()
const server = app.listen(0, async () => {
  const { port } = server.address()
  const base = `http://127.0.0.1:${port}/api/v1`

  try {
    console.log('--- STARTING COMPLETE FEATURE UPGRADE SUITE ---')

    // 1. President Login & 2FA
    const csrfRes = await fetch(`${base}/auth/csrf`)
    const { csrfToken } = await csrfRes.json()
    const cookies = csrfRes.headers.getSetCookie?.() || []

    const loginRes = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken, Cookie: cookies.join('; ') },
      body: JSON.stringify({ memberId: process.env.PRESIDENT_MEMBER_ID, password: process.env.PRESIDENT_INITIAL_PASSWORD }),
    })
    const loginBody = await loginRes.json()
    assert.equal(loginRes.status, 200)

    let sessionCookies = loginRes.headers.getSetCookie?.() || cookies
    let presCsrf = loginBody.csrfToken || csrfToken

    if (loginBody.requiresTwoFactor) {
      const { prisma } = await import('../server/db/prisma.js')
      const { decryptSecret } = await import('../server/services/secret-crypto.service.js')
      const { generateTotp } = await import('../server/services/totp.service.js')
      const pres = await prisma.user.findUnique({ where: { memberId: process.env.PRESIDENT_MEMBER_ID.toUpperCase() } })
      const secret = decryptSecret(pres.totpSecretEncrypted)
      const code = generateTotp(secret)
      const verifyRes = await fetch(`${base}/auth/verify-2fa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': presCsrf, Cookie: sessionCookies.join('; ') },
        body: JSON.stringify({ code }),
      })
      const verifyBody = await verifyRes.json()
      sessionCookies = verifyRes.headers.getSetCookie?.() || sessionCookies
      presCsrf = verifyBody.csrfToken || presCsrf
      console.log('✓ 1. Primary President authenticated with 2FA.')
    }

    // 2. Role-Based Account Creation (Treasurer, Event Management, Student)
    const treasurerId = `TREAS${Date.now().toString().slice(-4)}`
    const createTreasurerRes = await fetch(`${base}/admin/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': presCsrf, Cookie: sessionCookies.join('; ') },
      body: JSON.stringify({
        memberId: treasurerId,
        password: 'TreasPass123!@#',
        role: 'TREASURER',
        profile: { name: 'Club Treasurer', email: `treasurer_${Date.now()}@example.com` },
      }),
    })
    const createTreasurerBody = await createTreasurerRes.json()
    assert.equal(createTreasurerRes.status, 201)
    assert.ok(createTreasurerBody.user.permissions.includes('PAYMENTS_VIEW'))
    assert.ok(createTreasurerBody.user.permissions.includes('PAYMENTS_VERIFY'))
    console.log('✓ 2. Role-Based Permissions: TREASURER created with automatic payment permissions.')

    const studentId = `STUD${Date.now().toString().slice(-4)}`
    const createStudentRes = await fetch(`${base}/admin/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': presCsrf, Cookie: sessionCookies.join('; ') },
      body: JSON.stringify({
        memberId: studentId,
        password: 'StudentPass123!@#',
        role: 'STUDENT',
        profile: { name: 'Cyber Student', email: `student_${Date.now()}@example.com`, rollNumber: studentId },
      }),
    })
    const createStudentBody = await createStudentRes.json()
    assert.equal(createStudentRes.status, 201)
    assert.equal(createStudentBody.user.memberId, studentId)
    console.log('✓ 3. STUDENT created with automatic member permissions.')

    // 3. Configurable Event Creation with Multiple Activities and Custom Questions
    const eventRes = await fetch(`${base}/admin/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': presCsrf, Cookie: sessionCookies.join('; ') },
      body: JSON.stringify({
        title: `CTF & Workshop Grand Prix ${Date.now()}`,
        eventType: 'Competition',
        dateTime: new Date(Date.now() + 86400000).toISOString(),
        startTime: '09:30 AM',
        endTime: '05:00 PM',
        venue: 'Department Auditorium',
        speakerName: 'Dr. Cyber Defense',
        speakerDesignation: 'Senior Vulnerability Researcher',
        requiresPayment: true,
        allowMultipleActivities: true,
        paymentUpiId: 'cyberclub@upi',
        paymentInstructions: 'Send fee via UPI and upload UTR',
        paymentQrUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b',
        activities: [
          { name: 'Workshop Track', price: 100, capacity: 50 },
          { name: 'CTF Solo', price: 150, capacity: 50 },
        ],
        formFields: [
          { fieldName: 'GitHub Handle', fieldType: 'text', isRequired: true },
        ],
      }),
    })
    const eventBody = await eventRes.json()
    assert.equal(eventRes.status, 201)
    const eventId = eventBody.event.id
    const act1Id = eventBody.event.activities[0].id
    const act2Id = eventBody.event.activities[1].id
    console.log(`✓ 4. Multi-Activity Paid Event published: "${eventBody.event.title}" with 2 activities.`)

    // 4. Student Authentication & Session Status
    const studentCsrfRes = await fetch(`${base}/auth/csrf`)
    const { csrfToken: studentCsrfInit } = await studentCsrfRes.json()
    const studentInitCookies = studentCsrfRes.headers.getSetCookie?.() || []

    const studentLoginRes = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': studentCsrfInit, Cookie: studentInitCookies.join('; ') },
      body: JSON.stringify({ memberId: studentId, password: 'StudentPass123!@#' }),
    })
    const studentLoginBody = await studentLoginRes.json()
    assert.equal(studentLoginRes.status, 200)
    let studentCookies = studentLoginRes.headers.getSetCookie?.() || studentInitCookies
    let studentCsrf = studentLoginBody.csrfToken || studentCsrfInit

    // 5. Intro Video Session Check & Completion
    const sessionStatusRes = await fetch(`${base}/member/session-status`, {
      headers: { Cookie: studentCookies.join('; ') },
    })
    const sessionStatusBody = await sessionStatusRes.json()
    assert.equal(sessionStatusBody.introVideoCompleted, false)
    console.log('✓ 5. Student Intro Video state correctly detected as pending on initial login.')

    const completeVideoRes = await fetch(`${base}/member/intro-video/complete`, {
      method: 'POST',
      headers: { 'X-CSRF-Token': studentCsrf, Cookie: studentCookies.join('; ') },
    })
    assert.equal(completeVideoRes.status, 200)
    console.log('✓ 6. Student completed mandatory intro video.')

    // 6. Student Multi-Activity Registration & Server-Side Price Verification
    const registerRes = await fetch(`${base}/member/events/${eventId}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': studentCsrf, Cookie: studentCookies.join('; ') },
      body: JSON.stringify({
        selectedActivityIds: [act1Id, act2Id], // ₹100 + ₹150 = ₹250
        paymentReference: 'UTR123456789012',
        paymentProofUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b',
        formData: { 'GitHub Handle': 'cyber_student_2026' },
      }),
    })
    const registerBody = await registerRes.json()
    assert.equal(registerRes.status, 201)
    assert.equal(registerBody.registration.totalAmount, 250) // verified server-side
    assert.equal(registerBody.registration.paymentStatus, 'SUBMITTED')
    const registrationId = registerBody.registration.id
    console.log(`✓ 7. Student registered for 2 activities. Total amount calculated server-side: ₹${registerBody.registration.totalAmount}.`)

    // 7. Treasurer / Admin Payment Verification
    const verifyRes = await fetch(`${base}/admin/payments/${registrationId}/verify`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': presCsrf, Cookie: sessionCookies.join('; ') },
      body: JSON.stringify({ paymentStatus: 'VERIFIED', paymentNotes: 'Payment confirmed in bank statement' }),
    })
    const verifyBody = await verifyRes.json()
    assert.equal(verifyRes.status, 200)
    assert.equal(verifyBody.registration.paymentStatus, 'VERIFIED')
    assert.equal(verifyBody.registration.status, 'CONFIRMED')
    console.log('✓ 8. Payment verified and registration status updated to CONFIRMED.')

    // 8. Event Analytics & CSV Export
    const analyticsRes = await fetch(`${base}/admin/events/${eventId}/details`, {
      headers: { Cookie: sessionCookies.join('; ') },
    })
    const analyticsBody = await analyticsRes.json()
    assert.equal(analyticsBody.stats.totalRegistrations, 1)
    assert.equal(analyticsBody.stats.confirmed, 1)
    assert.equal(analyticsBody.stats.totalVerifiedRevenue, 250)
    console.log(`✓ 9. Event Analytics: Verified Revenue ₹${analyticsBody.stats.totalVerifiedRevenue}, Confirmed count ${analyticsBody.stats.confirmed}.`)

    const csvRes = await fetch(`${base}/admin/events/${eventId}/export-csv`, {
      headers: { Cookie: sessionCookies.join('; ') },
    })
    assert.equal(csvRes.status, 200)
    const csvContent = await csvRes.text()
    assert.ok(csvContent.includes('Registration ID,Member ID,Full Name'))
    assert.ok(csvContent.includes('UTR123456789012'))
    console.log('✓ 10. CSV Export successfully generated registration roster.')

    // 9. Team Member Showcase
    const teamRes = await fetch(`${base}/admin/team`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': presCsrf, Cookie: sessionCookies.join('; ') },
      body: JSON.stringify({
        name: 'Alex Lead',
        roleTitle: 'Technical Operations Head',
        bio: 'Offensive security and CTF team captain',
        collegeEmail: 'alex@college.edu',
        githubUrl: 'https://github.com/alexlead',
      }),
    })
    assert.equal(teamRes.status, 201)
    console.log('✓ 11. Club Leader Profile created and active in public showcase.')

    // 10. Central Club Settings & Social Media Links
    const settingsRes = await fetch(`${base}/admin/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': presCsrf, Cookie: sessionCookies.join('; ') },
      body: JSON.stringify({
        instagramUrl: 'https://instagram.com/mrdu_cybersec',
        githubUrl: 'https://github.com/mrdu-cybersec',
        introVideoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      }),
    })
    assert.equal(settingsRes.status, 200)
    console.log('✓ 12. Central Club Settings and social links updated.')

    console.log('==================================================')
    console.log('ALL 12 ADVANCED FEATURE UPGRADE TESTS PASSED WITH 100% SUCCESS!')
    console.log('==================================================')
  } catch (error) {
    console.error('Test failed:', error)
    process.exit(1)
  } finally {
    server.close()
    await app.locals.closeSessionStore?.()
    process.exit(0)
  }
})
