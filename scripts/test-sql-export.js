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
    console.log('Login status:', loginRes.status)

    let sessionCookies = loginRes.headers.getSetCookie?.() || cookies
    let csrf2 = loginBody.csrfToken || csrfToken

    const exportRes = await fetch(`${base}/admin/database/export-sql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf2, Cookie: sessionCookies.join('; ') },
      body: JSON.stringify({ password: process.env.PRESIDENT_INITIAL_PASSWORD }),
    })
    const exportBody = await exportRes.json()
    console.log('SQL Export status:', exportRes.status)
    console.log('Filename:', exportBody.filename)
    console.log('SQL Size (bytes):', exportBody.sqlContent?.length)
    console.log('SQL Dump Preview:\n', exportBody.sqlContent?.slice(0, 300))
  } catch (err) {
    console.error('Test error:', err)
  } finally {
    server.close()
    process.exit(0)
  }
})
