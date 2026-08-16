import { prisma } from '../db/prisma.js'
import { isAdmin, isPrimaryPresident } from '../utils/safe-user.js'

/**
 * Middleware enforcing site hibernation.
 * When siteStatus is 'HIBERNATING', public and student access is blocked,
 * while Primary President / Admins retain access to log in and toggle the site back on.
 */
export async function requireActiveSite(request, response, next) {
  // Always permit authentication routes so Primary President can sign in
  const path = request.path || ''
  if (
    path.startsWith('/auth/login') ||
    path.startsWith('/auth/csrf') ||
    path.startsWith('/auth/me') ||
    path.startsWith('/health') ||
    path.startsWith('/docs')
  ) {
    return next()
  }

  try {
    const statusSetting = await prisma.clubSetting.findUnique({ where: { key: 'siteStatus' } })
    const siteStatus = statusSetting?.value || 'ACTIVE'

    if (siteStatus !== 'HIBERNATING') {
      return next()
    }

    // Site is in HIBERNATION mode: allow Primary President / Admins to proceed
    if (request.user && (isPrimaryPresident(request.user) || isAdmin(request.user))) {
      return next()
    }

    const startedSetting = await prisma.clubSetting.findUnique({ where: { key: 'hibernationStartedAt' } })
    return response.status(503).json({
      hibernating: true,
      siteStatus: 'HIBERNATING',
      hibernationStartedAt: startedSetting?.value || null,
      message: 'The website is temporarily in hibernation.',
    })
  } catch (error) {
    return next(error)
  }
}
