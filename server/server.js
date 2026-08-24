import { createApp } from './app.js'
import { assertRuntimeConfiguration, env } from './config/env.js'
import { prisma } from './db/prisma.js'
import { bootstrapDatabase } from './db/bootstrap.js'
import { verifyMailConfiguration } from './services/mailer.service.js'
import { startAuditRetentionJob } from './services/audit-retention.service.js'

assertRuntimeConfiguration()

async function verifyDatabaseConnection(maxRetries = 5, delayMs = 3000) {
  let dbHost = 'unknown'
  let dbPort = 3306
  let dbName = ''
  try {
    const url = new URL(env.databaseUrl)
    dbHost = url.hostname
    dbPort = Number(url.port || 3306)
    dbName = url.pathname.slice(1)
  } catch {}

  console.info(`[DB INFO] Verifying connection to ${dbHost}:${dbPort}/${dbName}...`)

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await prisma.$queryRaw`SELECT 1`
      console.info(`[DB INFO] Database connected successfully to ${dbHost}:${dbPort}/${dbName}.`)
      return
    } catch (error) {
      if (attempt < maxRetries) {
        console.warn(`[DB WARN] Database connection attempt ${attempt}/${maxRetries} failed: ${error.message}. Retrying in ${delayMs / 1000}s...`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
      } else {
        throw error
      }
    }
  }
}

try {
  await verifyDatabaseConnection(5, 3000)
  await bootstrapDatabase()
  if (env.isProduction) await verifyMailConfiguration()
} catch (error) {
  console.error('Startup validation failed: required database service is unreachable.', error.message)
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
