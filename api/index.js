import { createApp } from '../server/app.js'
import { assertRuntimeConfiguration, env } from '../server/config/env.js'
import { prisma } from '../server/db/prisma.js'

let app
let ready

async function ensureReady() {
  if (ready) return ready
  ready = (async () => {
    assertRuntimeConfiguration()
    await prisma.$queryRaw`SELECT 1`
    app = createApp()
  })()
  return ready
}

export default async function handler(request, response) {
  await ensureReady()
  return app(request, response)
}

if (!env.isProduction) {
  ensureReady().catch(error => {
    console.error('Serverless bootstrap failed:', error.message)
  })
}
