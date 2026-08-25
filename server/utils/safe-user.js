export function toSafeUser(user, platformMode = 'CYBER_SECURITY_CLUB') {
  const isMrdu = platformMode === 'MRDU_EVENTS'
  const isPrimary = Boolean(user?.isPrimaryAdmin)
  const cscRole = user?.cscRole || user?.role || 'STUDENT'
  const mrduRole = user?.mrduRole || (isPrimary ? 'PRESIDENT' : 'STUDENT')
  const effectiveRole = isPrimary ? 'PRESIDENT' : (isMrdu ? mrduRole : cscRole)

  return {
    id: user.id,
    memberId: user.memberId,
    role: effectiveRole,
    cscRole,
    mrduRole,
    isPrimaryAdmin: isPrimary,
    accountStatus: user.accountStatus,
    twoFactorEnabled: user.totpEnabled || false,
    permissions: user.permissions?.map(({ permission }) => permission) || [],
    profile: user.profile ? {
      name: user.profile.name,
      rollNumber: user.profile.rollNumber,
      department: user.profile.department,
      year: user.profile.year,
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

export function hasPermission(user, permission) {
  if (isPrimaryPresident(user)) return true
  return Boolean(user?.permissions?.some(assignment => assignment.permission === permission))
}
