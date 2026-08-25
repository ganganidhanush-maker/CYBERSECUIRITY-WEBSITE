import { prisma } from '../db/prisma.js'

let cachedPlatformMode = null
let cacheExpires = 0

export async function getActivePlatformMode() {
  const now = Date.now()
  if (cachedPlatformMode && now < cacheExpires) return cachedPlatformMode
  try {
    const setting = await prisma.clubSetting.findUnique({ where: { key: 'platformMode' } })
    cachedPlatformMode = setting?.value || 'CYBER_SECURITY_CLUB'
    cacheExpires = now + 5000 // 5-second in-memory cache
    return cachedPlatformMode
  } catch {
    return 'CYBER_SECURITY_CLUB'
  }
}

export function invalidatePlatformModeCache() {
  cachedPlatformMode = null
  cacheExpires = 0
}

/**
 * Resolves the effective role and permissions based on platform mode.
 * - Primary President is ALWAYS 'PRESIDENT' in both modes.
 * - In MRDU mode: default is 'STUDENT' unless explicitly assigned an MRDU role.
 * - In CSC mode: original CSC leader role is restored.
 */
export function resolveUserPlatformRole(user, platformMode) {
  if (!user) return { role: 'STUDENT', isPrimaryAdmin: false }
  if (user.isPrimaryAdmin) {
    return {
      role: 'PRESIDENT',
      isPrimaryAdmin: true,
      cscRole: 'PRESIDENT',
      mrduRole: 'PRESIDENT',
    }
  }

  const isMrdu = platformMode === 'MRDU_EVENTS'
  const cscRole = user.cscRole || user.role || 'STUDENT'
  const mrduRole = user.mrduRole || 'STUDENT'
  const effectiveRole = isMrdu ? mrduRole : cscRole

  return {
    role: effectiveRole,
    isPrimaryAdmin: false,
    cscRole,
    mrduRole,
  }
}
