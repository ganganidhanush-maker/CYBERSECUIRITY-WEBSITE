import 'dotenv/config'
import { createApp } from '../server/app.js'

const app = createApp()
const server = app.listen(0, async () => {
  const { port } = server.address()
  const base = `http://127.0.0.1:${port}/api/v1`

  try {
    const csrfRes = await fetch(`${base}/auth/csrf`)
    const { csrfToken } = await csrfRes.json()
    const cookies = csrfRes.headers.getSetCookie?.() || []

    const loginRes = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken, Cookie: cookies.join('; ') },
      body: JSON.stringify({ memberId: process.env.PRESIDENT_MEMBER_ID, password: process.env.PRESIDENT_INITIAL_PASSWORD }),
    })
    const loginBody = await loginRes.json()
    console.log('login', loginRes.status, loginBody.message || loginBody.user?.memberId || loginBody.requiresTwoFactor)

    if (!loginRes.ok) process.exit(1)

    let sessionCookies = loginRes.headers.getSetCookie?.() || cookies
    let csrf2 = loginBody.csrfToken || csrfToken

    if (loginBody.requiresTwoFactor) {
      const { prisma } = await import('../server/db/prisma.js')
      const { decryptSecret } = await import('../server/services/secret-crypto.service.js')
      const { generateTotp } = await import('../server/services/totp.service.js')
      const pres = await prisma.user.findUnique({ where: { memberId: process.env.PRESIDENT_MEMBER_ID.toUpperCase() } })
      if (pres && pres.totpSecretEncrypted) {
        const secret = decryptSecret(pres.totpSecretEncrypted)
        const code = generateTotp(secret)
        const verifyRes = await fetch(`${base}/auth/verify-2fa`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf2, Cookie: sessionCookies.join('; ') },
          body: JSON.stringify({ code }),
        })
        const verifyBody = await verifyRes.json()
        sessionCookies = verifyRes.headers.getSetCookie?.() || sessionCookies
        csrf2 = verifyBody.csrfToken || csrf2
        console.log('2fa verify', verifyRes.status, verifyBody.user?.memberId)
      }
    }

    const testMemberId = `TESTUSER${Date.now().toString().slice(-4)}`
    const createRes = await fetch(`${base}/admin/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf2, Cookie: sessionCookies.join('; ') },
      body: JSON.stringify({
        memberId: testMemberId,
        password: 'TestPass123!@#',
        role: 'STUDENT',
        permissions: ['DASHBOARD_VIEW', 'EVENTS_VIEW', 'EVENT_REGISTER', 'GALLERY_VIEW'],
        profile: { name: 'Test User', email: `test${Date.now()}@example.com` },
      }),
    })
    const createBody = await createRes.json().catch(() => ({}))
    console.log('create member', createRes.status, createBody.message || createBody.user?.memberId)

    const eventRes = await fetch(`${base}/admin/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf2, Cookie: sessionCookies.join('; ') },
      body: JSON.stringify({
        title: `Test Event ${Date.now()}`,
        eventType: 'Workshop',
        dateTime: new Date(Date.now() + 86400000).toISOString(),
        location: 'Lab 01',
      }),
    })
    const eventBody = await eventRes.json().catch(() => ({}))
    console.log('create event', eventRes.status, eventBody.message || eventBody.event?.title)

    // Test Gallery Album & Photo creation
    const albumRes = await fetch(`${base}/admin/gallery/albums`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf2, Cookie: sessionCookies.join('; ') },
      body: JSON.stringify({
        name: `Test Album ${Date.now()}`,
        description: 'Test album description',
      }),
    })
    const albumBody = await albumRes.json().catch(() => ({}))
    console.log('create album', albumRes.status, albumBody.album?.name)

    const photoRes = await fetch(`${base}/admin/gallery/albums/${albumBody.album.id}/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf2, Cookie: sessionCookies.join('; ') },
      body: JSON.stringify({
        imageUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b',
        caption: 'Campus Cybersecurity Lab',
      }),
    })
    const photoBody = await photoRes.json().catch(() => ({}))
    console.log('add photo', photoRes.status, photoBody.photo?.id)

    // Test Student Login & Event Registration
    const studentCsrfRes = await fetch(`${base}/auth/csrf`)
    const { csrfToken: studentCsrf } = await studentCsrfRes.json()
    const studentCookiesInit = studentCsrfRes.headers.getSetCookie?.() || []

    const studentLoginRes = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': studentCsrf, Cookie: studentCookiesInit.join('; ') },
      body: JSON.stringify({ memberId: testMemberId, password: 'TestPass123!@#' }),
    })
    const studentLoginBody = await studentLoginRes.json()
    const studentCookies = studentLoginRes.headers.getSetCookie?.() || studentCookiesInit
    const studentCsrf2 = studentLoginBody.csrfToken || studentCsrf
    console.log('student login', studentLoginRes.status, studentLoginBody.user?.memberId)

    const studentEventsRes = await fetch(`${base}/member/events`, {
      headers: { Cookie: studentCookies.join('; ') },
    })
    const studentEventsBody = await studentEventsRes.json()
    console.log('student list events', studentEventsRes.status, `${studentEventsBody.events?.length} events available`)

    const registerRes = await fetch(`${base}/member/events/${eventBody.event.id}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': studentCsrf2, Cookie: studentCookies.join('; ') },
      body: JSON.stringify({}),
    })
    const registerBody = await registerRes.json().catch(() => ({}))
    console.log('student register for event', registerRes.status, registerBody.registration?.id)

    const studentGalleryRes = await fetch(`${base}/member/gallery`, {
      headers: { Cookie: studentCookies.join('; ') },
    })
    const studentGalleryBody = await studentGalleryRes.json()
    console.log('student view gallery', studentGalleryRes.status, `${studentGalleryBody.albums?.length} albums visible`)
  } catch (error) {
    console.error(error)
  } finally {
    server.close()
    await app.locals.closeSessionStore?.()
    process.exit(0)
  }
})
