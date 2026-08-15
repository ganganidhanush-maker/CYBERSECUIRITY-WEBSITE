import crypto from 'node:crypto'
import { prisma } from '../db/prisma.js'

function hashUserAgent(userAgent) {
  return userAgent ? crypto.createHash('sha256').update(userAgent).digest('hex') : null
}

export async function writeAuditLog({ actorUserId = null, action, targetUserId = null, ipAddress = null, userAgent = null, metadata = null }) {
  return prisma.auditLog.create({
    data: { actorUserId, action, targetUserId, ipAddress, userAgent: hashUserAgent(userAgent), metadata },
  })
}

export async function tryWriteAuditLog(entry) {
  try {
    await writeAuditLog(entry)
  } catch (error) {
    console.error('Audit log write failed', error)
  }
}
