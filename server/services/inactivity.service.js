import { prisma } from '../db/prisma.js'
import { tryWriteAuditLog } from './audit.service.js'

/**
 * Automatically disables accounts that have not logged in or have been inactive for > 3 days (72 hours).
 * Primary President accounts are protected and excluded.
 */
export async function autoDisableInactiveAccounts() {
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000
  const cutoff = new Date(Date.now() - THREE_DAYS_MS)

  try {
    const inactiveUsers = await prisma.user.findMany({
      where: {
        isPrimaryAdmin: false,
        accountStatus: 'ACTIVE',
        OR: [
          { lastLogin: { lt: cutoff } },
          { lastLogin: null, createdAt: { lt: cutoff } },
        ],
      },
      select: {
        id: true,
        memberId: true,
        profile: { select: { name: true } },
        lastLogin: true,
        createdAt: true,
        role: true,
      },
    })

    if (inactiveUsers.length > 0) {
      console.info(`[INACTIVITY] Found ${inactiveUsers.length} inactive account(s) (>3 days). Disabling...`)
      for (const u of inactiveUsers) {
        await prisma.user.update({
          where: { id: u.id },
          data: { accountStatus: 'DISABLED' },
        })
        const lastActive = u.lastLogin || u.createdAt
        const daysInactive = Math.floor((Date.now() - new Date(lastActive).getTime()) / (24 * 60 * 60 * 1000))
        await tryWriteAuditLog({
          actorUserId: u.id,
          action: 'ACCOUNT_AUTO_DISABLED_INACTIVITY',
          metadata: {
            memberId: u.memberId,
            name: u.profile?.name || u.memberId,
            role: u.role,
            reason: 'INACTIVE_OVER_3_DAYS',
            daysInactive,
            lastActiveAt: lastActive,
          },
        })
      }
      console.info(`[INACTIVITY] Successfully auto-disabled ${inactiveUsers.length} inactive account(s).`)
    }
  } catch (error) {
    console.error('[INACTIVITY] Failed to auto-disable inactive accounts:', error.message)
  }
}

export function startInactivityMonitorJob() {
  const run = () => autoDisableInactiveAccounts().catch(err => console.error('[INACTIVITY JOB ERROR]:', err))
  run()
  // Run check every 1 hour
  return setInterval(run, 60 * 60 * 1000).unref()
}
