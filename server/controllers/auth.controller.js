import crypto from 'node:crypto'
import bcrypt from 'bcrypt'
import QRCode from 'qrcode'
import { env } from '../config/env.js'
import { sessionCookieOptions } from '../config/session.js'
import { prisma } from '../db/prisma.js'
import { tryWriteAuditLog } from '../services/audit.service.js'
import { sendPasswordResetEmail } from '../services/mailer.service.js'
import { decryptSecret, encryptSecret } from '../services/secret-crypto.service.js'
import { createTotpSecret, createTotpUri, verifyTotp } from '../services/totp.service.js'
import { toSafeUser } from '../utils/safe-user.js'
import { issueCsrfToken } from '../middleware/csrf.js'
import { getActivePlatformMode } from '../services/platform-role.service.js'
import { loginSchema, passwordConfirmationSchema, passwordResetRequestSchema, passwordResetSchema, totpCodeSchema } from '../validators/auth.validator.js'

const invalidCredentials = { message: 'Invalid Member ID or password.' }
const genericPasswordResetResponse = { message: 'If that account has a verified email address, reset instructions have been sent.' }
const userInclude = { profile: true, permissions: true }

function auditRequest(request) {
  return { ipAddress: request.ip, userAgent: request.get('user-agent') || null }
}

function regenerateSession(request) {
  return new Promise((resolve, reject) => request.session.regenerate(error => error ? reject(error) : resolve()))
}

function saveSession(request) {
  return new Promise((resolve, reject) => request.session.save(error => error ? reject(error) : resolve()))
}

function destroySession(request) {
  return new Promise(resolve => request.session?.destroy(() => resolve()))
}

async function establishAuthenticatedSession(request, user) {
  await regenerateSession(request)
  request.session.userId = user.id
  request.session.authenticatedAt = Date.now()
  const csrfToken = issueCsrfToken(request)
  await saveSession(request)
  return csrfToken
}

async function establishTwoFactorChallenge(request, user) {
  await regenerateSession(request)
  request.session.pendingTwoFactorUserId = user.id
  request.session.pendingTwoFactorAt = Date.now()
  const csrfToken = issueCsrfToken(request)
  await saveSession(request)
  return csrfToken
}

async function recordFailedLogin(user, request) {
  const incremented = await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: { increment: 1 } },
    select: { failedLoginAttempts: true },
  })
  const lockedUntil = incremented.failedLoginAttempts >= env.loginMaxAttempts
    ? new Date(Date.now() + env.loginLockMinutes * 60_000)
    : null
  if (lockedUntil) {
    await prisma.user.update({ where: { id: user.id }, data: { lockedUntil, failedLoginAttempts: 0 } })
  }
  await tryWriteAuditLog({
    actorUserId: user.id,
    action: lockedUntil ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILED',
    metadata: lockedUntil ? { lockMinutes: env.loginLockMinutes } : { attemptsRemaining: Math.max(0, env.loginMaxAttempts - incremented.failedLoginAttempts) },
    ...auditRequest(request),
  })
}

export async function login(request, response) {
  const parsed = loginSchema.safeParse(request.body)
  if (!parsed.success) return response.status(401).json(invalidCredentials)

  const memberId = parsed.data.memberId.toUpperCase()
  const user = await prisma.user.findUnique({ where: { memberId }, include: userInclude })
  if (!user) {
    return response.status(401).json(invalidCredentials)
  }

  // Account Disabled Check (manual admin disables only - no auto-disabling for inactivity)
  if (user.accountStatus !== 'ACTIVE') {
    await tryWriteAuditLog({
      actorUserId: user.id,
      action: 'LOGIN_BLOCKED',
      metadata: { reason: 'ACCOUNT_DISABLED', accountStatus: user.accountStatus, memberId: user.memberId },
      ...auditRequest(request),
    })
    return response.status(403).json({
      error: 'ACCOUNT_DISABLED',
      code: 'ACCOUNT_DISABLED',
      message: 'Account Disabled: Your account is currently disabled. Please contact the Cyber Security Club Coordinator or President to reactivate your account.',
    })
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await tryWriteAuditLog({ actorUserId: user.id, action: 'LOGIN_BLOCKED', metadata: { reason: 'ACCOUNT_LOCKED' }, ...auditRequest(request) })
    return response.status(401).json({
      error: 'ACCOUNT_LOCKED',
      code: 'ACCOUNT_LOCKED',
      message: 'Account is temporarily locked due to repeated failed login attempts. Please try again later or reset your password.',
    })
  }

  const validPassword = await bcrypt.compare(parsed.data.password, user.passwordHash)
  if (!validPassword) {
    await recordFailedLogin(user, request)
    return response.status(401).json(invalidCredentials)
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date(), failedLoginAttempts: 0, lockedUntil: null },
  })

  // Primary President: Bypasses standard TOTP; uses 6-digit Master PIN if configured
  if (user.isPrimaryAdmin) {
    if (user.masterSecurityPinHash) {
      const csrfToken = await establishTwoFactorChallenge(request, user)
      return response.status(200).json({ requiresTwoFactor: true, isMasterPin: true, csrfToken })
    }
    const platformMode = await getActivePlatformMode()
    const csrfToken = await establishAuthenticatedSession(request, user)
    await tryWriteAuditLog({
      actorUserId: user.id,
      action: 'PRIMARY_PRESIDENT_LOGIN_SUCCESS',
      metadata: { memberId: user.memberId, name: user.profile?.name || user.name, role: user.role, isPrimaryAdmin: true },
      ...auditRequest(request),
    })
    return response.status(200).json({ user: toSafeUser(user, platformMode), csrfToken })
  }

  if (user.totpEnabled) {
    if (!user.totpSecretEncrypted) {
      await tryWriteAuditLog({ actorUserId: user.id, action: 'LOGIN_BLOCKED', metadata: { reason: 'MFA_CONFIGURATION_INVALID', memberId: user.memberId }, ...auditRequest(request) })
      return response.status(401).json(invalidCredentials)
    }
    const csrfToken = await establishTwoFactorChallenge(request, user)
    return response.status(200).json({ requiresTwoFactor: true, csrfToken })
  }

  const platformMode = await getActivePlatformMode()
  const csrfToken = await establishAuthenticatedSession(request, user)
  await tryWriteAuditLog({
    actorUserId: user.id,
    action: user.role === 'PRESIDENT' ? 'PRESIDENT_LOGIN_SUCCESS' : 'LOGIN_SUCCESS',
    metadata: { memberId: user.memberId, name: user.profile?.name || user.name, role: user.role },
    ...auditRequest(request),
  })
  return response.status(200).json({ user: toSafeUser(user, platformMode), csrfToken })
}

export async function verifyTwoFactorLogin(request, response) {
  const parsed = totpCodeSchema.safeParse(request.body)
  const pendingUserId = request.session?.pendingTwoFactorUserId
  const pendingAt = request.session?.pendingTwoFactorAt
  if (!parsed.success || !pendingUserId || !pendingAt || Date.now() - pendingAt > 10 * 60_000) {
    await destroySession(request)
    response.clearCookie('csc.sid', sessionCookieOptions)
    return response.status(401).json({ message: 'Two-factor verification expired. Please log in again.' })
  }

  const user = await prisma.user.findUnique({ where: { id: pendingUserId }, include: userInclude })
  if (!user || user.accountStatus !== 'ACTIVE') {
    await destroySession(request)
    response.clearCookie('csc.sid', sessionCookieOptions)
    return response.status(401).json({ message: 'Two-factor verification expired. Please log in again.' })
  }

  let validCode = false

  // Check 1: Primary President Master Security PIN (Two Locks)
  if (user.isPrimaryAdmin && user.masterSecurityPinHash) {
    validCode = await bcrypt.compare(String(parsed.data.code), user.masterSecurityPinHash)
  }

  // Check 2: Standard TOTP code from authenticator app
  if (!validCode && user.totpSecretEncrypted) {
    try {
      const rawSecret = decryptSecret(user.totpSecretEncrypted)
      validCode = verifyTotp(rawSecret, parsed.data.code)
    } catch (err) {
      console.error('[2FA VERIFICATION ERROR]:', err.message)
      validCode = false
    }
  }

  if (!validCode) {
    await tryWriteAuditLog({
      actorUserId: user.id,
      action: 'TWO_FACTOR_LOGIN_FAILED',
      metadata: { memberId: user.memberId, name: user.profile?.name || user.name, role: user.role },
      ...auditRequest(request),
    })
    return response.status(401).json({
      message: user.isPrimaryAdmin && user.masterSecurityPinHash
        ? 'Invalid 6-digit Master Security PIN.'
        : 'Invalid authentication code. Please check your authenticator app.',
    })
  }

  const platformMode = await getActivePlatformMode()
  const csrfToken = await establishAuthenticatedSession(request, user)
  await tryWriteAuditLog({
    actorUserId: user.id,
    action: user.isPrimaryAdmin ? 'PRIMARY_PRESIDENT_LOGIN_SUCCESS' : 'TWO_FACTOR_LOGIN_SUCCESS',
    metadata: { memberId: user.memberId, name: user.profile?.name || user.name, role: user.role, isPrimaryAdmin: user.isPrimaryAdmin },
    ...auditRequest(request),
  })
  return response.status(200).json({ user: toSafeUser(user, platformMode), csrfToken })
}

export async function me(request, response) {
  const platformMode = request.platformMode || await getActivePlatformMode()
  return response.status(200).json({ user: toSafeUser(request.user, platformMode) })
}

export async function logout(request, response) {
  const userId = request.session?.userId
  await destroySession(request)
  response.clearCookie('csc.sid', sessionCookieOptions)
  if (userId) await tryWriteAuditLog({ actorUserId: userId, action: 'LOGOUT', ...auditRequest(request) })
  return response.status(204).end()
}

export async function logoutAllDevices(request, response) {
  await prisma.user.update({ where: { id: request.user.id }, data: { lastLogoutAllDevicesAt: new Date() } })
  await destroySession(request)
  response.clearCookie('csc.sid', sessionCookieOptions)
  await tryWriteAuditLog({ actorUserId: request.user.id, action: 'LOGOUT_ALL_DEVICES', ...auditRequest(request) })
  return response.status(204).end()
}

export async function requestPasswordReset(request, response) {
  const parsed = passwordResetRequestSchema.safeParse(request.body)
  if (!parsed.success) return response.status(202).json(genericPasswordResetResponse)
  const user = await prisma.user.findUnique({ where: { memberId: parsed.data.memberId.toUpperCase() }, include: { profile: true } })
  if (user?.accountStatus === 'ACTIVE' && user.profile?.email) {
    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    await prisma.user.update({ where: { id: user.id }, data: { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: new Date(Date.now() + 15 * 60_000) } })
    try {
      const delivered = await sendPasswordResetEmail({ recipient: user.profile.email, memberId: user.memberId, token })
      await tryWriteAuditLog({ actorUserId: user.id, action: delivered ? 'PASSWORD_RESET_REQUESTED' : 'PASSWORD_RESET_DELIVERY_UNAVAILABLE', ...auditRequest(request) })
    } catch (error) {
      console.error('Password reset email delivery failed', error)
      await tryWriteAuditLog({ actorUserId: user.id, action: 'PASSWORD_RESET_DELIVERY_FAILED', ...auditRequest(request) })
    }
  }
  return response.status(202).json(genericPasswordResetResponse)
}

export async function resetPassword(request, response) {
  const parsed = passwordResetSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ message: 'The reset link or new password is invalid.' })
  const tokenHash = crypto.createHash('sha256').update(parsed.data.token).digest('hex')
  const user = await prisma.user.findFirst({ where: { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: { gt: new Date() } } })
  if (!user) return response.status(400).json({ message: 'The reset link is invalid or has expired.' })

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(parsed.data.password, env.bcryptRounds),
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLogoutAllDevicesAt: new Date(),
    },
  })
  await tryWriteAuditLog({ actorUserId: user.id, action: 'PASSWORD_RESET_COMPLETED', ...auditRequest(request) })
  return response.status(204).end()
}

export async function startTwoFactorSetup(request, response) {
  const secret = createTotpSecret()
  request.session.pendingTotpSecret = secret
  request.session.pendingTotpUserId = request.user.id
  await saveSession(request)
  const otpauthUrl = createTotpUri(secret, request.user.memberId)
  return response.status(200).json({ otpauthUrl, qrCodeDataUrl: await QRCode.toDataURL(otpauthUrl, { errorCorrectionLevel: 'M', margin: 1, width: 240 }) })
}

export async function confirmTwoFactorSetup(request, response) {
  const parsed = totpCodeSchema.safeParse(request.body)
  const secret = request.session?.pendingTotpSecret
  if (!parsed.success || !secret || request.session.pendingTotpUserId !== request.user.id || !verifyTotp(secret, parsed.data.code)) {
    return response.status(400).json({ message: 'Invalid authentication code. Scan the new QR code and try again.' })
  }
  await prisma.user.update({ where: { id: request.user.id }, data: { totpSecretEncrypted: encryptSecret(secret), totpEnabled: true } })
  delete request.session.pendingTotpSecret
  delete request.session.pendingTotpUserId
  await saveSession(request)
  await tryWriteAuditLog({ actorUserId: request.user.id, action: 'TWO_FACTOR_ENABLED', ...auditRequest(request) })
  return response.status(204).end()
}

export async function disableTwoFactor(request, response) {
  const parsed = passwordConfirmationSchema.safeParse(request.body)
  if (!parsed.success || !request.user.totpEnabled || !request.user.totpSecretEncrypted) return response.status(400).json({ message: 'Invalid password or authentication code.' })
  let validCode = false
  try { validCode = verifyTotp(decryptSecret(request.user.totpSecretEncrypted), parsed.data.code) } catch { validCode = false }
  const validPassword = await bcrypt.compare(parsed.data.password, request.user.passwordHash)
  if (!validCode || !validPassword) return response.status(400).json({ message: 'Invalid password or authentication code.' })
  await prisma.user.update({ where: { id: request.user.id }, data: { totpSecretEncrypted: null, totpEnabled: false } })
  await tryWriteAuditLog({ actorUserId: request.user.id, action: 'TWO_FACTOR_DISABLED', ...auditRequest(request) })
  return response.status(204).end()
}

export async function changePassword(request, response) {
  const { currentPassword, newPassword } = request.body || {}
  if (!currentPassword || !newPassword) {
    return response.status(400).json({ message: 'Current password and new password are required.' })
  }
  if (newPassword.length < 8) {
    return response.status(400).json({ message: 'New password must be at least 8 characters long.' })
  }

  const valid = await bcrypt.compare(currentPassword, request.user.passwordHash)
  if (!valid) {
    return response.status(400).json({ message: 'Incorrect current password. Please try again.' })
  }

  const passwordHash = await bcrypt.hash(newPassword, env.bcryptRounds)
  await prisma.user.update({
    where: { id: request.user.id },
    data: { passwordHash },
  })

  await tryWriteAuditLog({
    actorUserId: request.user.id,
    action: 'PASSWORD_CHANGED',
    ...auditRequest(request),
  })

  return response.status(200).json({ message: 'Password updated successfully!' })
}

