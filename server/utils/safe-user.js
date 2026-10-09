const READ_ONLY_OBSERVER_PERMISSIONS = [
  'DASHBOARD_VIEW', 'EVENTS_VIEW', 'REGISTRATIONS_VIEW', 'PAYMENTS_VIEW',
  'QR_PASSES_VIEW', 'GALLERY_VIEW', 'AUDIT_VIEW', 'CHAT_USE',
  'NOTIFICATIONS_VIEW', 'PROFILE_EDIT',
]

export const READ_ONLY_CLUB_ROLES = ['FACULTY', 'CONVENER', 'CO_CONVENER']

export function isReadOnlyClubRole(role) {
  return READ_ONLY_CLUB_ROLES.includes(String(role || '').toUpperCase())
}

export const ROLE_DEFAULT_PERMISSIONS = {
  FACULTY: READ_ONLY_OBSERVER_PERMISSIONS,
  CONVENER: READ_ONLY_OBSERVER_PERMISSIONS,
  CO_CONVENER: READ_ONLY_OBSERVER_PERMISSIONS,
  PRESIDENT: [
    'ACCOUNT_MANAGEMENT', 'DASHBOARD_VIEW', 'EVENTS_VIEW', 'EVENT_MANAGE',
    'EVENT_REGISTER', 'REGISTRATIONS_VIEW', 'PAYMENTS_VIEW', 'PAYMENTS_VERIFY',
    'QR_PASSES_VIEW', 'GALLERY_VIEW', 'GALLERY_MANAGE', 'REELS_MANAGE',
    'TEAM_MANAGE', 'SETTINGS_MANAGE', 'AUDIT_VIEW', 'CHAT_USE',
    'SUGGESTIONS_CREATE', 'FEEDBACK_CREATE', 'NOTIFICATIONS_VIEW', 'PROFILE_EDIT',
  ],
  STUDENT_COORDINATOR: [
    'ACCOUNT_MANAGEMENT', 'DASHBOARD_VIEW', 'EVENTS_VIEW', 'EVENT_MANAGE',
    'EVENT_REGISTER', 'REGISTRATIONS_VIEW', 'PAYMENTS_VIEW', 'PAYMENTS_VERIFY',
    'QR_PASSES_VIEW', 'GALLERY_VIEW', 'GALLERY_MANAGE', 'REELS_MANAGE',
    'TEAM_MANAGE', 'SETTINGS_MANAGE', 'AUDIT_VIEW', 'CHAT_USE',
    'SUGGESTIONS_CREATE', 'FEEDBACK_CREATE', 'NOTIFICATIONS_VIEW', 'PROFILE_EDIT',
  ],
  ADMIN: [
    'ACCOUNT_MANAGEMENT', 'DASHBOARD_VIEW', 'EVENTS_VIEW', 'EVENT_MANAGE',
    'EVENT_REGISTER', 'REGISTRATIONS_VIEW', 'PAYMENTS_VIEW', 'PAYMENTS_VERIFY',
    'QR_PASSES_VIEW', 'GALLERY_VIEW', 'GALLERY_MANAGE', 'REELS_MANAGE',
    'TEAM_MANAGE', 'SETTINGS_MANAGE', 'AUDIT_VIEW', 'CHAT_USE',
    'SUGGESTIONS_CREATE', 'FEEDBACK_CREATE', 'NOTIFICATIONS_VIEW', 'PROFILE_EDIT',
  ],
  VICE_PRESIDENT: [
    'ACCOUNT_MANAGEMENT', 'DASHBOARD_VIEW', 'EVENTS_VIEW', 'EVENT_MANAGE',
    'EVENT_REGISTER', 'REGISTRATIONS_VIEW', 'QR_PASSES_VIEW', 'GALLERY_VIEW',
    'GALLERY_MANAGE', 'REELS_MANAGE', 'TEAM_MANAGE', 'CHAT_USE',
    'NOTIFICATIONS_VIEW', 'PROFILE_EDIT',
  ],
  EVENT_MANAGEMENT: [
    'DASHBOARD_VIEW', 'EVENTS_VIEW', 'EVENT_MANAGE', 'EVENT_REGISTER',
    'REGISTRATIONS_VIEW', 'QR_PASSES_VIEW', 'REELS_MANAGE', 'CHAT_USE',
    'NOTIFICATIONS_VIEW', 'PROFILE_EDIT',
  ],
  MEDIA_LEAD: [
    'DASHBOARD_VIEW', 'GALLERY_VIEW', 'GALLERY_MANAGE', 'REELS_MANAGE',
    'EVENTS_VIEW', 'CHAT_USE', 'NOTIFICATIONS_VIEW', 'PROFILE_EDIT',
  ],
  PR_TEAM: [
    'DASHBOARD_VIEW', 'REELS_MANAGE', 'GALLERY_VIEW', 'EVENTS_VIEW',
    'CHAT_USE', 'NOTIFICATIONS_VIEW', 'PROFILE_EDIT',
  ],
  TREASURER: [
    'DASHBOARD_VIEW', 'PAYMENTS_VIEW', 'PAYMENTS_VERIFY', 'REGISTRATIONS_VIEW',
    'EVENTS_VIEW', 'CHAT_USE', 'NOTIFICATIONS_VIEW', 'PROFILE_EDIT',
  ],
  TECH_TEAM: [
    'DASHBOARD_VIEW', 'EVENTS_VIEW', 'EVENT_MANAGE', 'SETTINGS_MANAGE',
    'AUDIT_VIEW', 'CHAT_USE', 'NOTIFICATIONS_VIEW', 'PROFILE_EDIT',
  ],
  CULTURAL: [
    'DASHBOARD_VIEW', 'EVENTS_VIEW', 'EVENT_MANAGE', 'GALLERY_VIEW',
    'REELS_MANAGE', 'CHAT_USE', 'NOTIFICATIONS_VIEW', 'PROFILE_EDIT',
  ],
  SECRETARY: [
    'DASHBOARD_VIEW', 'EVENTS_VIEW', 'REGISTRATIONS_VIEW', 'ACCOUNT_MANAGEMENT',
    'CHAT_USE', 'NOTIFICATIONS_VIEW', 'PROFILE_EDIT',
  ],
  STUDENT: [
    'DASHBOARD_VIEW', 'EVENTS_VIEW', 'EVENT_REGISTER', 'REGISTRATIONS_VIEW', 'QR_PASSES_VIEW',
    'GALLERY_VIEW', 'SUGGESTIONS_CREATE', 'FEEDBACK_CREATE', 'NOTIFICATIONS_VIEW',
    'PROFILE_EDIT',
  ],
}

export function toSafeUser(user, platformMode = 'CYBER_SECURITY_CLUB') {
  const isMrdu = platformMode === 'MRDU_EVENTS'
  const isPrimary = Boolean(user?.isPrimaryAdmin)
  const cscRole = user?.cscRole || user?.role || 'STUDENT'
  const mrduRole = user?.mrduRole || (isPrimary ? 'PRESIDENT' : 'STUDENT')
  const effectiveRole = isPrimary ? 'PRESIDENT' : (isMrdu ? mrduRole : cscRole)

  const defaultPerms = ROLE_DEFAULT_PERMISSIONS[effectiveRole] || []
  const hasStored = Boolean(user?.permissions && user.permissions.length > 0)
  const explicitPerms = hasStored
    ? user.permissions.map(p => (typeof p === 'string' ? p : p.permission))
    : defaultPerms
  const allPermissions = isPrimary ? (ROLE_DEFAULT_PERMISSIONS.PRESIDENT || defaultPerms) : explicitPerms

  return {
    id: user.id,
    memberId: user.memberId,
    role: effectiveRole,
    cscRole,
    mrduRole,
    isPrimaryAdmin: isPrimary,
    isReadOnly: isReadOnlyClubRole(effectiveRole),
    accountStatus: user.accountStatus,
    twoFactorEnabled: user.totpEnabled || false,
    permissions: allPermissions,
    profile: user.profile ? {
      name: user.profile.name,
      rollNumber: user.profile.rollNumber,
      department: user.profile.department,
      year: user.profile.year,
      gender: user.profile.gender || null,
      age: user.profile.age || null,
      email: user.profile.email,
      phone: user.profile.phone,
      profileImage: user.profile.profileImage,
      bio: user.profile.bio,
      instagramUrl: user.profile.instagramUrl,
      githubUrl: user.profile.githubUrl,
      linkedinUrl: user.profile.linkedinUrl,
      portfolioUrl: user.profile.portfolioUrl,
      skills: user.profile.skills,
      achievements: user.profile.achievements,
    } : null,
  }
}

export function isPresident(user) {
  return user?.role === 'PRESIDENT'
}

export function isPrimaryPresident(user) {
  return user?.role === 'PRESIDENT' && Boolean(user.isPrimaryAdmin)
}

export function isClubAdmin(user) {
  return Boolean(user?.role && user.role !== 'STUDENT')
}

export function isAdmin(user) {
  return isClubAdmin(user)
}

export function canManageReels(user) {
  if (!user) return false
  if (isPrimaryPresident(user)) return true
  const role = user.role || user.effectiveRole
  if (isReadOnlyClubRole(role)) return false
  return ['PRESIDENT', 'VICE_PRESIDENT', 'STUDENT_COORDINATOR', 'PR_TEAM', 'SOCIAL_MEDIA_LEAD', 'EVENT_MANAGEMENT', 'MEDIA_LEAD', 'ADMIN'].includes(role) || hasPermission(user, 'REELS_MANAGE') || hasPermission(user, 'GALLERY_MANAGE')
}

export function hasPermission(user, permission) {
  if (!user) return false
  if (isPrimaryPresident(user)) return true

  const role = user.role || user.effectiveRole
  const isReadOnly = isReadOnlyClubRole(role)

  // Observer/read-only roles can never receive write/mutation permissions
  const mutationPermissions = ['EVENT_MANAGE', 'PAYMENTS_VERIFY', 'ACCOUNT_MANAGEMENT', 'TEAM_MANAGE', 'SETTINGS_MANAGE', 'GALLERY_MANAGE', 'REELS_MANAGE']
  if (isReadOnly && mutationPermissions.includes(permission)) {
    return false
  }

  // If user has customized stored permissions in DB, honor them directly (allows adding or removing access)
  if (user.permissions && user.permissions.length > 0) {
    return user.permissions.some(p => {
      const name = typeof p === 'string' ? p : p.permission
      return name === permission
    })
  }

  // Fallback to role defaults if user has no stored permissions records
  if (role === 'PRESIDENT' || role === 'ADMIN' || role === 'STUDENT_COORDINATOR') return true
  const defaultPerms = ROLE_DEFAULT_PERMISSIONS[role] || []
  return defaultPerms.includes(permission)
}
