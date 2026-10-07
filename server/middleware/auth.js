import { prisma } from '../db/prisma.js'
import { canManageReels, hasPermission, isAdmin, isPresident, isPrimaryPresident } from '../utils/safe-user.js'
import { getActivePlatformMode, resolveUserPlatformRole } from '../services/platform-role.service.js'
import { authUserCache } from '../services/auth-cache.service.js'

export async function requireAuth(request, response, next) {
  const userId = request.session?.userId
  if (!userId) return response.status(401).json({ message: 'Session expired. Please log in again.' })

  try {
    let user = authUserCache.get(userId)
    if (!user) {
      user = await prisma.user.findUnique({ where: { id: userId }, include: { profile: true, permissions: true } })
      if (user && user.accountStatus === 'ACTIVE') {
        authUserCache.set(userId, user)
      }
    }
    if (!user || user.accountStatus !== 'ACTIVE') {
      authUserCache.invalidate(userId)
      request.session.destroy(() => {})
      return response.status(401).json({ message: 'Session expired. Please log in again.' })
    }
    if (user.lastLogoutAllDevicesAt && (!request.session.authenticatedAt || user.lastLogoutAllDevicesAt.getTime() >= request.session.authenticatedAt)) {
      request.session.destroy(() => {})
      return response.status(401).json({ message: 'Session expired. Please log in again.' })
    }

    const platformMode = await getActivePlatformMode()
    const { role: effectiveRole, cscRole, mrduRole } = resolveUserPlatformRole(user, platformMode)
    user.effectiveRole = effectiveRole
    user.role = effectiveRole
    user.cscRole = cscRole
    user.mrduRole = mrduRole

    request.user = user
    request.platformMode = platformMode
    return next()
  } catch (error) {
    return next(error)
  }
}

export function requirePrimaryPresident(request, response, next) {
  if (!isPrimaryPresident(request.user)) return response.status(403).json({ message: 'Only the Primary President can perform this action.' })
  return next()
}

export function requirePresident(request, response, next) {
  if (!isPresident(request.user)) return response.status(403).json({ message: 'Access denied: President role required.' })
  return next()
}

export function requirePermission(permission) {
  return (request, response, next) => {
    if (hasPermission(request.user, permission)) return next()
    return response.status(403).json({ message: 'Access denied: You do not have permission for this action.' })
  }
}

export function requireAnyPermission(...permissions) {
  return (request, response, next) => {
    if (permissions.some(p => hasPermission(request.user, p))) return next()
    return response.status(403).json({ message: 'Access denied: You do not have permission for this action.' })
  }
}

export function requireAdmin(request, response, next) {
  if (!isAdmin(request.user)) return response.status(403).json({ message: 'Access denied: Club admin privileges required.' })
  return next()
}

export function requireRole(...allowedRoles) {
  return (request, response, next) => {
    if (isPrimaryPresident(request.user) || allowedRoles.includes(request.user?.role)) return next()
    return response.status(403).json({ message: 'Access denied: Unauthorized role.' })
  }
}

export function requireReelsManager(request, response, next) {
  if (canManageReels(request.user)) return next()
  return response.status(403).json({ message: 'Access denied: President, Vice President, PR Team, Event Management, Media Lead, or Admin role required to manage reels.' })
}
