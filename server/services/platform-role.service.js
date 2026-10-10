import { prisma } from '../db/prisma.js'

const defaultFindUnique = prisma.clubSetting?.findUnique
let cachedSettingsMap = null
let cacheExpires = 0
const SETTINGS_CACHE_TTL_MS = 60_000 // 60-second in-memory cache, invalidated immediately on update

export async function getCachedClubSettings() {
  const now = Date.now()
  if (cachedSettingsMap && now < cacheExpires) {
    return cachedSettingsMap
  }
  try {
    const rows = await prisma.clubSetting.findMany()
    const map = new Map()
    for (const row of rows) {
      map.set(row.key, row.value)
    }
    cachedSettingsMap = map
    cacheExpires = now + SETTINGS_CACHE_TTL_MS
    return cachedSettingsMap
  } catch {
    return cachedSettingsMap || new Map()
  }
}

export async function getCachedClubSetting(key, defaultValue = null) {
  if (prisma.clubSetting?.findUnique && prisma.clubSetting.findUnique !== defaultFindUnique) {
    const row = await prisma.clubSetting.findUnique({ where: { key } })
    return row ? row.value : defaultValue
  }
  const map = await getCachedClubSettings()
  if (!map.has(key)) return defaultValue
  return map.get(key)
}

export async function getCachedClubSettingsDictionary() {
  const map = await getCachedClubSettings()
  const dictionary = {}
  for (const [key, value] of map.entries()) {
    try {
      dictionary[key] = JSON.parse(value)
    } catch {
      dictionary[key] = value
    }
  }
  return dictionary
}

export async function getActivePlatformMode() {
  const val = await getCachedClubSetting('platformMode', 'CYBER_SECURITY_CLUB')
  return val || 'CYBER_SECURITY_CLUB'
}

export function invalidatePlatformModeCache() {
  cachedSettingsMap = null
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
