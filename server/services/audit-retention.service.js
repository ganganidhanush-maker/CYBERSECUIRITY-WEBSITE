import { env } from '../config/env.js'
import { prisma } from '../db/prisma.js'

export async function purgeExpiredAuditLogs() {
  const cutoff = new Date(Date.now() - env.auditLogRetentionDays * 24 * 60 * 60 * 1000)
  const result = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } })
  if (result.count) console.info(JSON.stringify({ event: 'AUDIT_RETENTION_PURGE', deleted: result.count }))
}

export function startAuditRetentionJob() {
  const run = () => purgeExpiredAuditLogs().catch(error => console.error('Audit retention job failed', error))
  run()
  return setInterval(run, 24 * 60 * 60 * 1000).unref()
}
