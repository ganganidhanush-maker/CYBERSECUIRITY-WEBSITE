import { createApp } from './app.js'
import { assertRuntimeConfiguration, env } from './config/env.js'
import { prisma } from './db/prisma.js'
import { verifyMailConfiguration } from './services/mailer.service.js'
import { startAuditRetentionJob } from './services/audit-retention.service.js'

assertRuntimeConfiguration()

try {
  await prisma.$queryRaw`SELECT 1`
  if (env.isProduction) await verifyMailConfiguration()
} catch (error) {
  console.error('Startup validation failed: required local services are unavailable.', error.message)
  await prisma.$disconnect()
  process.exitCode = 1
  throw error
}

const app = createApp()
const auditRetentionTimer = startAuditRetentionJob()
const server = app.listen(env.port, () => console.log(`CSC API listening on port ${env.port}`))
const sockets = new Set()
let shuttingDown = false

server.on('connection', socket => {
  sockets.add(socket)
  socket.once('close', () => sockets.delete(socket))
})

async function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  console.info(`Received ${signal}; draining active connections.`)
  clearInterval(auditRetentionTimer)
  const forcedShutdown = setTimeout(() => {
    for (const socket of sockets) socket.destroy()
  }, 30_000)
  forcedShutdown.unref()
  server.close(async () => {
    clearTimeout(forcedShutdown)
    await app.locals.closeSessionStore?.()
    await prisma.$disconnect()
    process.exitCode = 0
  })
}

process.once('SIGINT', () => shutdown('SIGINT'))
process.once('SIGTERM', () => shutdown('SIGTERM'))
