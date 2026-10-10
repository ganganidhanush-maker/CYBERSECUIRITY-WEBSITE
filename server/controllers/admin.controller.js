import bcrypt from 'bcrypt'
import { Prisma } from '@prisma/client'
import { prisma } from '../db/prisma.js'
import { tryWriteAuditLog } from '../services/audit.service.js'
import { decryptSecret } from '../services/secret-crypto.service.js'
import { verifyTotp } from '../services/totp.service.js'
import { toSafeUser } from '../utils/safe-user.js'
import { env } from '../config/env.js'
import { getRolePermissions } from '../config/permissions.js'
import { createUserNotification } from '../services/notification.service.js'
import { getActivePlatformMode, getCachedClubSetting, getCachedClubSettingsDictionary, invalidatePlatformModeCache } from '../services/platform-role.service.js'
import { authUserCache } from '../services/auth-cache.service.js'
import { generateFullDatabaseSqlDump, restoreFullDatabaseSqlDump } from '../services/database-dump.service.js'
import { sendEventPassEmail } from '../services/mailer.service.js'
import { formatCsvValue as fmt } from '../../shared/csv.js'
import QRCode from 'qrcode'
import { hasActiveEventPass, isDraftRegistration, isPaymentAwaitingReview, isRejectedPayment, resolveEventRegistrationMode, submittedRegistrationWhere } from '../utils/event-registration.js'
import {
  accountStatusSchema,
  adminResetPasswordSchema,
  createMemberSchema,
  memberPermissionsSchema,
  transferPresidentSchema,
} from '../validators/auth.validator.js'
import {
  bulkCreateMembersSchema,
  bulkIssuePassesSchema,
  clubSettingsSchema,
  clubTeamMemberSchema,
  deleteProtectedAccountSchema,
  eventInputSchema,
  galleryAlbumSchema,
  galleryPhotoSchema,
  galleryPhotosBatchSchema,
  paymentVerificationSchema,
  newId,
} from '../validators/member.validator.js'

const userInclude = { profile: true, permissions: true }

function auditRequest(request) {
  return { ipAddress: request.ip, userAgent: request.get('user-agent') || null }
}

function flattenMember(user, platformMode = 'CYBER_SECURITY_CLUB', { omitHeavyImages = false } = {}) {
  const safe = toSafeUser(user, platformMode)
  let profileImage = safe.profile?.profileImage || null
  if (omitHeavyImages && typeof profileImage === 'string' && profileImage.startsWith('data:image/') && profileImage.length > 40000) {
    profileImage = null // Strip multi-megabyte base64 images from batch listings to ensure instant responses
  }
  return {
    ...safe,
    isPrimaryAdmin: Boolean(user.isPrimaryAdmin),
    cscRole: user.cscRole || user.role || 'STUDENT',
    mrduRole: user.mrduRole || (user.isPrimaryAdmin ? 'PRESIDENT' : 'STUDENT'),
    name: safe.profile?.name || null,
    email: safe.profile?.email || null,
    phone: safe.profile?.phone || null,
    profileImage,
  }
}

async function verifyPresidentActionCode(target, authenticationCode) {
  if (!target.totpEnabled || !target.totpSecretEncrypted) {
    return { ok: false, message: 'Enable two-factor authentication on your Primary President account to perform this protected action.' }
  }
  const secret = decryptSecret(target.totpSecretEncrypted)
  if (!verifyTotp(secret, authenticationCode)) {
    return { ok: false, message: 'Invalid authentication code for the Primary President account.' }
  }
  return { ok: true }
}

export async function listMembers(request, response) {
  const platformMode = request.platformMode || await getActivePlatformMode()
  const users = await prisma.user.findMany({ include: userInclude, orderBy: { createdAt: 'desc' } })
  const mapped = users.map(u => flattenMember(u, platformMode, { omitHeavyImages: true }))
  return response.status(200).json({ users: mapped, members: mapped })
}

export async function createMember(request, response) {
  const parsed = createMemberSchema.safeParse(request.body)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message || 'Please enter valid account details.'
    return response.status(400).json({ message })
  }

  const platformMode = request.platformMode || await getActivePlatformMode()
  const isMrdu = platformMode === 'MRDU_EVENTS'
  const data = parsed.data
  const assignedPermissions = data.permissions && data.permissions.length
    ? data.permissions
    : getRolePermissions(data.role)

  try {
    const passwordHash = await bcrypt.hash(data.password, env.bcryptRounds)
    const user = await prisma.user.create({
      data: {
        memberId: data.memberId.toUpperCase(),
        passwordHash,
        role: data.role,
        cscRole: isMrdu ? 'STUDENT' : data.role,
        mrduRole: isMrdu ? data.role : 'STUDENT',
        isPrimaryAdmin: false,
        accountStatus: 'ACTIVE',
        profile: { create: data.profile },
        permissions: { create: assignedPermissions.map(permission => ({ permission })) },
      },
      include: userInclude,
    })
    await tryWriteAuditLog({
      actorUserId: request.user.id,
      action: 'ACCOUNT_CREATED',
      targetUserId: user.id,
      metadata: { memberId: user.memberId, role: data.role, permissions: assignedPermissions },
      ...auditRequest(request),
    })
    return response.status(201).json({ user: flattenMember(user, platformMode) })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return response.status(409).json({ message: 'That Member ID or email is already assigned.' })
    }
    throw error
  }
}

export async function bulkCreateMembers(request, response) {
  const parsed = bulkCreateMembersSchema.safeParse(request.body)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message || 'Please provide a valid list of student accounts.'
    return response.status(400).json({ message })
  }

  const { students } = parsed.data
  const studentPermissions = getRolePermissions('STUDENT')

  const rawMemberIds = students.map(s => s.memberId.toUpperCase())
  const existingUsers = await prisma.user.findMany({
    where: { memberId: { in: rawMemberIds } },
    select: { memberId: true },
  })
  const existingSet = new Set(existingUsers.map(u => u.memberId))

  const emailsToCheck = students.map(s => s.email).filter(Boolean)
  const existingProfiles = emailsToCheck.length > 0
    ? await prisma.profile.findMany({
      where: { email: { in: emailsToCheck } },
      select: { email: true },
    })
    : []
  const existingEmailSet = new Set(existingProfiles.map(p => p.email))

  const seenInBatch = new Set()
  const seenEmailInBatch = new Set()

  const successList = []
  const failedItems = []

  for (let i = 0; i < students.length; i++) {
    const s = students[i]
    const rowNum = i + 1
    const memId = s.memberId.toUpperCase()

    if (existingSet.has(memId)) {
      failedItems.push({
        row: rowNum,
        memberId: memId,
        name: s.name,
        reason: 'Member ID already exists in the system.',
      })
      continue
    }

    if (seenInBatch.has(memId)) {
      failedItems.push({
        row: rowNum,
        memberId: memId,
        name: s.name,
        reason: 'Duplicate Member ID within the uploaded batch.',
      })
      continue
    }

    if (s.email) {
      if (existingEmailSet.has(s.email)) {
        failedItems.push({
          row: rowNum,
          memberId: memId,
          name: s.name,
          reason: `Email ${s.email} is already associated with an account.`,
        })
        continue
      }
      if (seenEmailInBatch.has(s.email)) {
        failedItems.push({
          row: rowNum,
          memberId: memId,
          name: s.name,
          reason: `Duplicate email ${s.email} within the uploaded batch.`,
        })
        continue
      }
    }

    seenInBatch.add(memId)
    if (s.email) seenEmailInBatch.add(s.email)

    try {
      const platformMode = request.platformMode || await getActivePlatformMode()
      const isMrdu = platformMode === 'MRDU_EVENTS'
      const assignedRole = s.role || 'STUDENT'
      const assignedPermissions = getRolePermissions(assignedRole)
      const passwordHash = await bcrypt.hash(s.password, env.bcryptRounds)
      const user = await prisma.user.create({
        data: {
          memberId: memId,
          passwordHash,
          role: assignedRole,
          cscRole: isMrdu ? 'STUDENT' : assignedRole,
          mrduRole: isMrdu ? assignedRole : 'STUDENT',
          isPrimaryAdmin: false,
          accountStatus: 'ACTIVE',
          profile: {
            create: {
              name: s.name,
              gender: s.gender || 'MALE',
              age: s.age ? Number(s.age) : null,
              rollNumber: s.rollNumber || memId,
              department: s.department || null,
              year: s.year ? Number(s.year) : null,
              email: s.email || null,
              phone: s.phone || null,
            },
          },
          permissions: {
            create: assignedPermissions.map(permission => ({ permission })),
          },
        },
        include: userInclude,
      })

      successList.push(flattenMember(user, platformMode))
    } catch (err) {
      failedItems.push({
        row: rowNum,
        memberId: memId,
        name: s.name,
        reason: err.message || 'Database error creating account.',
      })
    }
  }

  if (successList.length > 0) {
    await tryWriteAuditLog({
      actorUserId: request.user.id,
      action: 'BULK_ACCOUNTS_CREATED',
      metadata: {
        totalSubmitted: students.length,
        successCount: successList.length,
        failedCount: failedItems.length,
      },
      ...auditRequest(request),
    })
  }

  return response.status(200).json({
    message: `Processed ${students.length} accounts. Successfully created: ${successList.length}, Failed: ${failedItems.length}`,
    successCount: successList.length,
    failedCount: failedItems.length,
    failedItems,
    createdUsers: successList,
  })
}

export async function changeAccountStatus(request, response) {
  const parsed = accountStatusSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ message: 'Invalid account status' })

  const target = await prisma.user.findUnique({ where: { id: request.params.id }, include: userInclude })
  if (!target) return response.status(404).json({ message: 'Resource not found' })
  if (target.isPrimaryAdmin) return response.status(400).json({ message: 'The Primary President account cannot be disabled.' })

  const platformMode = request.platformMode || await getActivePlatformMode()
  const user = await prisma.user.update({ where: { id: target.id }, data: { accountStatus: parsed.data.accountStatus }, include: userInclude })
  authUserCache.invalidate(target.id)
  await tryWriteAuditLog({ actorUserId: request.user.id, action: 'ACCOUNT_STATUS_CHANGED', targetUserId: target.id, metadata: { from: target.accountStatus, to: parsed.data.accountStatus }, ...auditRequest(request) })
  return response.status(200).json({ user: flattenMember(user, platformMode) })
}

export async function activateAllAccounts(request, response) {
  const result = await prisma.user.updateMany({
    where: { accountStatus: { not: 'ACTIVE' } },
    data: { accountStatus: 'ACTIVE' },
  })
  authUserCache.clear()

  await tryWriteAuditLog({
    actorUserId: request.user.id,
    action: 'ALL_ACCOUNTS_ACTIVATED',
    metadata: {
      activatedCount: result.count,
      activatedBy: request.user.memberId,
      role: request.user.role,
    },
    ...auditRequest(request),
  })

  return response.status(200).json({
    success: true,
    message: result.count > 0
      ? `Successfully activated ${result.count} account(s). All member accounts are now ACTIVE.`
      : 'All member accounts are already ACTIVE.',
    activatedCount: result.count,
  })
}

export async function changeMemberPermissions(request, response) {
  const parsed = memberPermissionsSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ message: 'Please provide valid permission settings.' })

  const target = await prisma.user.findUnique({ where: { id: request.params.id }, include: userInclude })
  if (!target) return response.status(404).json({ message: 'Resource not found' })
  if (target.isPrimaryAdmin) return response.status(400).json({ message: 'Primary President permissions cannot be customized.' })

  const permsToSave = parsed.data.permissions && parsed.data.permissions.length > 0
    ? parsed.data.permissions
    : ['DASHBOARD_VIEW']

  const platformMode = request.platformMode || await getActivePlatformMode()
  const user = await prisma.user.update({
    where: { id: target.id },
    data: { permissions: { deleteMany: {}, create: permsToSave.map(permission => ({ permission })) } },
    include: userInclude,
  })
  authUserCache.invalidate(target.id)
  await tryWriteAuditLog({ actorUserId: request.user.id, action: 'ACCOUNT_PERMISSIONS_CHANGED', targetUserId: target.id, metadata: { from: target.permissions.map(entry => entry.permission), to: permsToSave }, ...auditRequest(request) })
  return response.status(200).json({ user: flattenMember(user, platformMode) })
}

export async function editMember(request, response) {
  const target = await prisma.user.findUnique({ where: { id: request.params.id }, include: userInclude })
  if (!target) return response.status(404).json({ message: 'Resource not found' })
  if (target.isPrimaryAdmin && target.id !== request.user.id) {
    return response.status(400).json({ message: 'Primary President account cannot be modified by other users.' })
  }

  const platformMode = request.platformMode || await getActivePlatformMode()
  const isMrdu = platformMode === 'MRDU_EVENTS'

  const { name, email, phone, rollNumber, department, year, role, profileImage, memberId, userId } = request.body
  const currentModeRole = isMrdu ? (target.mrduRole || 'STUDENT') : (target.cscRole || target.role)
  const newRole = role || currentModeRole
  const permissionsUpdate = role && role !== currentModeRole ? getRolePermissions(role) : null

  // 1. Process User ID / Member ID update
  const rawMemberId = memberId !== undefined ? memberId : userId
  let newMemberId = undefined
  if (rawMemberId !== undefined) {
    const trimmed = String(rawMemberId).trim().toUpperCase()
    if (!trimmed) {
      return response.status(400).json({ message: 'User ID cannot be empty.' })
    }
    if (trimmed.length < 3 || trimmed.length > 32) {
      return response.status(400).json({ message: 'User ID must be between 3 and 32 characters.' })
    }
    if (!/^[A-Z0-9_.-]+$/.test(trimmed)) {
      return response.status(400).json({ message: 'User ID can only contain letters, numbers, hyphens, dots, and underscores.' })
    }
    newMemberId = trimmed
  }

  if (newMemberId && newMemberId !== target.memberId) {
    if (target.isPrimaryAdmin && target.id !== request.user.id) {
      return response.status(400).json({ message: 'Primary President User ID cannot be modified by other users.' })
    }
    const existing = await prisma.user.findUnique({
      where: { memberId: newMemberId },
      include: { profile: { select: { name: true } } },
    })
    if (existing && existing.id !== target.id) {
      return response.status(409).json({
        message: `User ID "${newMemberId}" is already assigned to another user (${existing.profile?.name || existing.memberId}). Please choose a unique User ID.`,
      })
    }
  }

  // 2. Synchronize Roll Number if applicable
  const targetRollNumber = rollNumber !== undefined
    ? (rollNumber ? String(rollNumber).trim().toUpperCase() : null)
    : (newMemberId && (!target.profile?.rollNumber || target.profile.rollNumber === target.memberId) ? newMemberId : undefined)

  try {
    const user = await prisma.user.update({
      where: { id: target.id },
      data: {
        ...(newMemberId && { memberId: newMemberId }),
        role: target.isPrimaryAdmin ? 'PRESIDENT' : newRole,
        ...(target.isPrimaryAdmin ? {
          cscRole: 'PRESIDENT',
          mrduRole: 'PRESIDENT',
        } : (isMrdu ? { mrduRole: newRole } : { cscRole: newRole })),
        ...(permissionsUpdate ? {
          permissions: {
            deleteMany: {},
            create: permissionsUpdate.map(permission => ({ permission })),
          },
        } : {}),
        profile: {
          upsert: {
            create: {
              name: name || null,
              email: email || null,
              phone: phone || null,
              rollNumber: targetRollNumber || null,
              department: department || null,
              year: year ? Number(year) : null,
              profileImage: profileImage || null,
            },
            update: {
              ...(name !== undefined && { name }),
              ...(email !== undefined && { email }),
              ...(phone !== undefined && { phone }),
              ...(targetRollNumber !== undefined && { rollNumber: targetRollNumber }),
              ...(department !== undefined && { department }),
              ...(year !== undefined && { year: year ? Number(year) : null }),
              ...(profileImage !== undefined && { profileImage }),
            },
          },
        },
      },
      include: userInclude,
    })
    authUserCache.invalidate(target.id)
    await tryWriteAuditLog({
      actorUserId: request.user.id,
      action: 'ACCOUNT_UPDATED',
      targetUserId: target.id,
      metadata: {
        previousMemberId: target.memberId,
        newMemberId: newMemberId || target.memberId,
        updatedFields: Object.keys(request.body),
      },
      ...auditRequest(request),
    })
    return response.status(200).json({ user: flattenMember(user, platformMode) })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const field = error.meta?.target?.[0]
      if (field === 'member_id') {
        return response.status(409).json({ message: `User ID "${newMemberId || request.body.memberId}" is already in use by another user.` })
      }
      return response.status(409).json({ message: 'Email or Roll number is already in use.' })
    }
    throw error
  }
}

export async function adminResetPassword(request, response) {
  const target = await prisma.user.findUnique({ where: { id: request.params.id }, include: { profile: true } })
  if (!target) return response.status(404).json({ message: 'Resource not found' })

  // Strict Primary President Shield: Primary President credentials can NEVER be reset by other accounts
  if (target.isPrimaryAdmin && target.id !== request.user.id) {
    await tryWriteAuditLog({
      actorUserId: request.user.id,
      action: 'UNAUTHORIZED_PRIMARY_PRESIDENT_MODIFICATION_BLOCKED',
      targetUserId: target.id,
      metadata: { targetMemberId: target.memberId, attemptedAction: 'ADMIN_RESET_PASSWORD' },
      ...auditRequest(request),
    })
    return response.status(403).json({ message: 'Access Denied: The Primary President account is immutable and protected from password resets by other users.' })
  }

  const parsed = adminResetPasswordSchema.safeParse(request.body)
  if (!parsed.success) {
    return response.status(400).json({ message: parsed.error.issues[0]?.message || 'Provide a valid new password (12+ chars, upper, lower, number, symbol).' })
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, env.bcryptRounds)
  await prisma.user.update({
    where: { id: target.id },
    data: {
      passwordHash,
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLogoutAllDevicesAt: new Date(),
    },
  })
  authUserCache.invalidate(target.id)

  await tryWriteAuditLog({
    actorUserId: request.user.id,
    action: 'ADMIN_PASSWORD_RESET',
    targetUserId: target.id,
    metadata: { memberId: target.memberId, name: target.profile?.name },
    ...auditRequest(request),
  })

  return response.status(200).json({ message: `Password reset successfully for Member ID ${target.memberId} (${target.profile?.name || 'Member'}).` })
}

export async function deleteMember(request, response) {
  const target = await prisma.user.findUnique({ where: { id: request.params.id } })
  if (!target) return response.status(404).json({ message: 'Resource not found' })
  if (target.id === request.user.id) return response.status(400).json({ message: 'You cannot delete your own account.' })

  if (target.isPrimaryAdmin || target.role === 'PRESIDENT') {
    return response.status(403).json({ message: 'The Primary President account cannot be deleted. Primary President status must first be transferred to another administrator.' })
  }

  await prisma.user.delete({ where: { id: target.id } })
  await tryWriteAuditLog({
    actorUserId: request.user.id,
    action: target.isPrimaryAdmin ? 'PRIMARY_ADMIN_DELETED' : 'ACCOUNT_DELETED',
    targetUserId: target.id,
    metadata: { memberId: target.memberId },
    ...auditRequest(request),
  })
  return response.status(204).end()
}

export async function transferPresidentRole(request, response) {
  const parsed = transferPresidentSchema.safeParse(request.body)
  if (!parsed.success) {
    return response.status(400).json({ message: parsed.error.issues[0]?.message || 'Select the new President and enter your 2FA code.' })
  }

  const currentPresident = await prisma.user.findUnique({ where: { id: request.user.id } })
  if (!currentPresident || !currentPresident.isPrimaryAdmin) {
    return response.status(403).json({ message: 'Only the current Primary President can initiate leadership transfer.' })
  }

  const verification = await verifyPresidentActionCode(currentPresident, parsed.data.authenticationCode)
  if (!verification.ok) return response.status(403).json({ message: verification.message })

  const target = await prisma.user.findUnique({ where: { id: parsed.data.targetUserId } })
  if (!target) return response.status(404).json({ message: 'Target user not found.' })
  if (target.id === currentPresident.id) return response.status(400).json({ message: 'You are already the Primary President.' })

  const presidentPerms = getRolePermissions('PRESIDENT')

  await prisma.$transaction([
    prisma.user.update({
      where: { id: currentPresident.id },
      data: { isPrimaryAdmin: false, role: 'PRESIDENT' },
    }),
    prisma.user.update({
      where: { id: target.id },
      data: {
        role: 'PRESIDENT',
        isPrimaryAdmin: true,
        permissions: {
          deleteMany: {},
          create: presidentPerms.map(permission => ({ permission })),
        },
      },
    }),
  ])

  await tryWriteAuditLog({
    actorUserId: currentPresident.id,
    action: 'PRIMARY_PRESIDENT_TRANSFERRED',
    targetUserId: target.id,
    metadata: { from: currentPresident.memberId, to: target.memberId },
    ...auditRequest(request),
  })

  return response.status(200).json({ message: `Leadership transferred successfully. Member ${target.memberId} is now the Primary President.` })
}

function serializeEvent(event) {
  return {
    ...event,
    paymentAmount: event.paymentAmount ? Number(event.paymentAmount) : null,
    isTeamEvent: Boolean(event.isTeamEvent),
    minTeamSize: event.minTeamSize || 1,
    maxTeamSize: event.maxTeamSize || 1,
    teamRules: event.teamRules || null,
    registrationCount: event.registrations?.filter(r => !isDraftRegistration(r)).length ?? event._count?.registrations ?? 0,
    activities: event.activities?.map(a => ({ ...a, price: Number(a.price) })) || [],
    formFields: event.formFields || [],
  }
}

export async function listEvents(request, response) {
  const events = await prisma.event.findMany({
    include: {
      formFields: true,
      activities: { orderBy: { sortOrder: 'asc' } },
      registrations: { where: submittedRegistrationWhere(), select: { id: true, userId: true, paymentStatus: true, totalAmount: true } },
    },
    orderBy: { dateTime: 'desc' },
  })
  return response.status(200).json({ events: events.map(serializeEvent) })
}

export async function createEvent(request, response) {
  const parsed = eventInputSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ message: parsed.error.issues[0]?.message || 'Enter valid event details.' })

  const data = parsed.data
  const isPaidEvent = Boolean(
    data.requiresPayment
    || (data.paymentAmount && Number(data.paymentAmount) > 0)
    || ['FIXED', 'TIERS', 'PAID'].includes(String(data.paymentConfig?.type || '').toUpperCase())
  )
  if (isPaidEvent) {
    data.requiresPayment = true
    if (!data.paymentAmount && data.paymentConfig?.tiers?.[0]?.price) {
      data.paymentAmount = Number(data.paymentConfig.tiers[0].price)
    } else if (!data.paymentAmount && data.paymentConfig?.price) {
      data.paymentAmount = Number(data.paymentConfig.price)
    }
  }

  if (data.requiresPayment && !data.activities?.length) {
    if (!data.paymentQrUrl && data.paymentUpiId && data.paymentAmount) {
      data.paymentQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`upi://pay?pa=${data.paymentUpiId}&pn=CyberSecurityClub&am=${data.paymentAmount}&cu=INR`)}`
    }
    if (!data.paymentAmount || !data.paymentQrUrl) {
      return response.status(400).json({ message: 'Paid events require a registration fee and a payment QR image or Club UPI ID.' })
    }
  }

  const event = await prisma.event.create({
    data: {
      id: newId(),
      title: data.title,
      shortDescription: data.shortDescription,
      description: data.description,
      eventType: data.eventType,
      dateTime: new Date(data.dateTime),
      startTime: data.startTime,
      endTime: data.endTime,
      venue: data.venue,
      location: data.location,
      capacity: data.capacity,
      photoUrl: data.photoUrl,
      status: data.status || 'UPCOMING',
      coordinatorName: data.coordinatorName,
      coordinatorContact: data.coordinatorContact,
      organizingTeam: data.organizingTeam,
      speakerName: data.speakerName,
      speakerPhoto: data.speakerPhoto,
      speakerDesignation: data.speakerDesignation,
      registrationDeadline: data.registrationDeadline,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      socialLinks: data.socialLinks,
      rules: data.rules,
      eligibility: data.eligibility,
      requiredMaterials: data.requiredMaterials,
      agenda: data.agenda,
      faq: data.faq,
      notes: data.notes,
      requiresPayment: data.requiresPayment,
      paymentAmount: data.paymentAmount,
      paymentQrUrl: data.paymentQrUrl,
      paymentUpiId: data.paymentUpiId,
      paymentInstructions: data.paymentInstructions,
      paymentDeadline: data.paymentDeadline,
      requirePaymentProof: data.requirePaymentProof,
      allowMultipleActivities: data.allowMultipleActivities,
      isTeamEvent: Boolean(data.isTeamEvent),
      minTeamSize: data.minTeamSize || 1,
      maxTeamSize: data.maxTeamSize || 1,
      teamRules: data.teamRules || null,
      registrationType: data.registrationType || (data.isTeamEvent ? 'TEAM' : 'INDIVIDUAL'),
      externalFormUrl: data.externalFormUrl || null,
      workflowConfig: data.workflowConfig || null,
      teamConfig: data.teamConfig || null,
      paymentConfig: data.paymentConfig || null,
      submissionConfig: data.submissionConfig || null,
      eligibilityConfig: data.eligibilityConfig || null,
      customQuestions: data.customQuestions || null,
      createdBy: request.user.id,
      activities: data.activities?.length ? {
        create: data.activities.map((act, index) => ({
          id: newId(),
          name: act.name,
          description: act.description,
          price: act.price,
          capacity: act.capacity,
          isAvailable: act.isAvailable !== false,
          instructions: act.instructions,
          sortOrder: act.sortOrder ?? index,
        })),
      } : undefined,
      formFields: data.formFields?.length ? {
        create: data.formFields.map(field => ({
          id: newId(),
          fieldName: field.fieldName,
          fieldType: field.fieldType,
          isRequired: field.isRequired || false,
          options: field.options ? JSON.stringify(field.options) : null,
        })),
      } : undefined,
    },
    include: {
      formFields: true,
      activities: { orderBy: { sortOrder: 'asc' } },
      registrations: { where: submittedRegistrationWhere(), select: { id: true, userId: true } },
    },
  })
  await tryWriteAuditLog({ actorUserId: request.user.id, action: 'EVENT_CREATED', metadata: { eventId: event.id, title: event.title, requiresPayment: event.requiresPayment }, ...auditRequest(request) })
  return response.status(201).json({ event: serializeEvent(event) })
}

export async function updateEvent(request, response) {
  const event = await prisma.event.findUnique({ where: { id: request.params.eventId } })
  if (!event) return response.status(404).json({ message: 'Event not found' })

  const parsed = eventInputSchema.partial().safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ message: parsed.error.issues[0]?.message || 'Enter valid event details.' })

  const data = parsed.data
  const isPaidEvent = Boolean(
    (data.requiresPayment !== undefined ? data.requiresPayment : event.requiresPayment)
    || (data.paymentAmount && Number(data.paymentAmount) > 0)
    || ['FIXED', 'TIERS', 'PAID'].includes(String(data.paymentConfig?.type || (event.paymentConfig && typeof event.paymentConfig === 'object' ? event.paymentConfig.type : '')).toUpperCase())
  )

  if (isPaidEvent && data.requiresPayment === undefined) {
    data.requiresPayment = true
  }

  let effectiveAmount = data.paymentAmount !== undefined
    ? data.paymentAmount
    : (event.paymentAmount ? Number(event.paymentAmount) : null)

  if (isPaidEvent && !effectiveAmount) {
    if (data.paymentConfig?.tiers?.[0]?.price) {
      effectiveAmount = Number(data.paymentConfig.tiers[0].price)
    } else if (data.paymentConfig?.price) {
      effectiveAmount = Number(data.paymentConfig.price)
    } else if (event.paymentConfig?.tiers?.[0]?.price) {
      effectiveAmount = Number(event.paymentConfig.tiers[0].price)
    } else if (event.paymentConfig?.price) {
      effectiveAmount = Number(event.paymentConfig.price)
    }
  }

  const effectiveUpiId = data.paymentUpiId !== undefined ? data.paymentUpiId : event.paymentUpiId
  let effectiveQrUrl = data.paymentQrUrl !== undefined ? data.paymentQrUrl : event.paymentQrUrl

  if (isPaidEvent && !effectiveQrUrl && effectiveUpiId && effectiveAmount) {
    effectiveQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`upi://pay?pa=${effectiveUpiId}&pn=CyberSecurityClub&am=${effectiveAmount}&cu=INR`)}`
  }

  const updated = await prisma.event.update({
    where: { id: request.params.eventId },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.shortDescription !== undefined && { shortDescription: data.shortDescription }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.eventType !== undefined && { eventType: data.eventType }),
      ...(data.dateTime !== undefined && { dateTime: new Date(data.dateTime) }),
      ...(data.startTime !== undefined && { startTime: data.startTime }),
      ...(data.endTime !== undefined && { endTime: data.endTime }),
      ...(data.venue !== undefined && { venue: data.venue }),
      ...(data.location !== undefined && { location: data.location }),
      ...(data.capacity !== undefined && { capacity: data.capacity }),
      ...(data.photoUrl !== undefined && { photoUrl: data.photoUrl }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.coordinatorName !== undefined && { coordinatorName: data.coordinatorName }),
      ...(data.coordinatorContact !== undefined && { coordinatorContact: data.coordinatorContact }),
      ...(data.organizingTeam !== undefined && { organizingTeam: data.organizingTeam }),
      ...(data.speakerName !== undefined && { speakerName: data.speakerName }),
      ...(data.speakerPhoto !== undefined && { speakerPhoto: data.speakerPhoto }),
      ...(data.speakerDesignation !== undefined && { speakerDesignation: data.speakerDesignation }),
      ...(data.registrationDeadline !== undefined && { registrationDeadline: data.registrationDeadline }),
      ...(data.contactEmail !== undefined && { contactEmail: data.contactEmail }),
      ...(data.contactPhone !== undefined && { contactPhone: data.contactPhone }),
      ...(data.socialLinks !== undefined && { socialLinks: data.socialLinks }),
      ...(data.rules !== undefined && { rules: data.rules }),
      ...(data.eligibility !== undefined && { eligibility: data.eligibility }),
      ...(data.requiredMaterials !== undefined && { requiredMaterials: data.requiredMaterials }),
      ...(data.agenda !== undefined && { agenda: data.agenda }),
      ...(data.faq !== undefined && { faq: data.faq }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.requiresPayment !== undefined && { requiresPayment: data.requiresPayment }),
      ...(effectiveAmount !== undefined && { paymentAmount: effectiveAmount }),
      ...(effectiveQrUrl !== undefined && { paymentQrUrl: effectiveQrUrl }),
      ...(data.paymentUpiId !== undefined && { paymentUpiId: data.paymentUpiId }),
      ...(data.paymentInstructions !== undefined && { paymentInstructions: data.paymentInstructions }),
      ...(data.paymentDeadline !== undefined && { paymentDeadline: data.paymentDeadline }),
      ...(data.requirePaymentProof !== undefined && { requirePaymentProof: data.requirePaymentProof }),
      ...(data.allowMultipleActivities !== undefined && { allowMultipleActivities: data.allowMultipleActivities }),
      ...(data.isTeamEvent !== undefined && { isTeamEvent: Boolean(data.isTeamEvent) }),
      ...(data.minTeamSize !== undefined && { minTeamSize: data.minTeamSize }),
      ...(data.maxTeamSize !== undefined && { maxTeamSize: data.maxTeamSize }),
      ...(data.teamRules !== undefined && { teamRules: data.teamRules }),
      ...(data.registrationType !== undefined && { registrationType: data.registrationType }),
      ...(data.externalFormUrl !== undefined && { externalFormUrl: data.externalFormUrl }),
      ...(data.workflowConfig !== undefined && { workflowConfig: data.workflowConfig }),
      ...(data.teamConfig !== undefined && { teamConfig: data.teamConfig }),
      ...(data.paymentConfig !== undefined && { paymentConfig: data.paymentConfig }),
      ...(data.submissionConfig !== undefined && { submissionConfig: data.submissionConfig }),
      ...(data.eligibilityConfig !== undefined && { eligibilityConfig: data.eligibilityConfig }),
      ...(data.customQuestions !== undefined && { customQuestions: data.customQuestions }),
      ...(data.activities !== undefined && {
        activities: {
          deleteMany: {},
          create: data.activities.map((act, index) => ({
            id: newId(),
            name: act.name,
            description: act.description,
            price: act.price,
            capacity: act.capacity,
            isAvailable: act.isAvailable !== false,
            instructions: act.instructions,
            sortOrder: act.sortOrder ?? index,
          })),
        },
      }),
      ...(data.formFields !== undefined && {
        formFields: {
          deleteMany: {},
          create: data.formFields.map(field => ({
            id: newId(),
            fieldName: field.fieldName,
            fieldType: field.fieldType,
            isRequired: field.isRequired || false,
            options: field.options ? JSON.stringify(field.options) : null,
          })),
        },
      }),
    },
    include: {
      formFields: true,
      activities: { orderBy: { sortOrder: 'asc' } },
      registrations: { where: submittedRegistrationWhere(), select: { id: true, userId: true } },
    },
  })
  await tryWriteAuditLog({ actorUserId: request.user.id, action: 'EVENT_UPDATED', metadata: { eventId: event.id, title: event.title }, ...auditRequest(request) })
  return response.status(200).json({ event: serializeEvent(updated) })
}

export async function listAllEventPasses(request, response) {
  const { eventId, paymentStatus, attendanceStatus, query } = request.query

  const whereClause = { ...submittedRegistrationWhere() }
  if (eventId && eventId !== 'ALL') {
    whereClause.eventId = eventId
  }
  if (paymentStatus && paymentStatus !== 'ALL') {
    if (paymentStatus === 'PAID') {
      whereClause.paymentStatus = 'VERIFIED'
    } else if (paymentStatus === 'PENDING') {
      whereClause.paymentStatus = { in: ['PENDING', 'SUBMITTED', 'UNDER_VERIFICATION'] }
    } else {
      whereClause.paymentStatus = paymentStatus
    }
  }
  if (attendanceStatus && attendanceStatus !== 'ALL') {
    whereClause.attendanceMarked = attendanceStatus === 'ATTENDED'
  }

  const registrations = await prisma.eventRegistration.findMany({
    where: whereClause,
    include: {
      event: {
        select: {
          id: true,
          title: true,
          eventType: true,
          dateTime: true,
          venue: true,
          isTeamEvent: true,
        },
      },
    },
    orderBy: { registeredAt: 'desc' },
  })

  const userIds = [...new Set(registrations.map(r => r.userId))]
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      memberId: true,
      role: true,
      profile: {
        select: {
          name: true,
          rollNumber: true,
          email: true,
          phone: true,
          department: true,
          year: true,
          gender: true,
          age: true,
        },
      },
    },
  })
  const userMap = new Map(users.map(u => [u.id, u]))

  let passList = registrations.map(reg => {
    const u = userMap.get(reg.userId)
    return {
      id: reg.id,
      eventId: reg.eventId,
      eventTitle: reg.event?.title || 'Event',
      eventType: reg.event?.eventType || 'Summit',
      eventDate: reg.event?.dateTime,
      venue: reg.event?.venue,
      isTeamEvent: reg.event?.isTeamEvent || Boolean(reg.teamName),
      userId: reg.userId,
      memberId: u?.memberId,
      name: u?.profile?.name || reg.formData?.fullName || reg.formData?.name || u?.memberId || 'Student',
      memberName: u?.profile?.name || reg.formData?.fullName || reg.formData?.name || u?.memberId || 'Student',
      email: u?.profile?.email || reg.formData?.email || null,
      phone: u?.profile?.phone || null,
      rollNumber: u?.profile?.rollNumber || reg.formData?.rollNumber || u?.memberId,
      department: u?.profile?.department || reg.branch || 'CSE',
      year: u?.profile?.year || reg.year,
      gender: reg.gender || u?.profile?.gender || 'UNSPECIFIED',
      age: reg.age || u?.profile?.age || null,
      residencyType: reg.residencyType || 'DAY_SCHOLAR',
      transportMode: reg.transportMode || 'OWN_TRANSPORT',
      hostelType: reg.hostelType || null,
      emergencyContact: reg.emergencyContact || null,
      teamName: reg.teamName || null,
      teamId: reg.teamId || null,
      isTeamLeader: Boolean(reg.isTeamLeader),
      selectedActivities: reg.selectedActivities || [],
      formData: reg.formData || null,
      passEmailSent: Boolean(reg.formData?.passEmailSentAt),
      passEmailSentAt: reg.formData?.passEmailSentAt || null,
      passEmailSentTo: reg.formData?.passEmailSentTo || null,
      passEmailCustomMessage: reg.formData?.passEmailCustomMessage || null,
      paymentStatus: reg.paymentStatus,
      paymentReference: reg.paymentReference,
      paymentProofUrl: reg.paymentProofUrl,
      paymentOption: reg.paymentOption || null,
      paymentRejectionReason: reg.paymentRejectionReason || null,
      github: reg.github || null,
      projectSubmission: reg.projectSubmission || null,
      totalAmount: Number(reg.totalAmount),
      status: reg.status,
      attendanceMarked: Boolean(reg.attendanceMarked),
      attendedAt: reg.attendedAt,
      registeredAt: reg.registeredAt,
      qrCodeData: hasActiveEventPass(reg) ? reg.qrCodeData : null,
      user: u ? {
        id: u.id,
        memberId: u.memberId,
        role: u.role,
        profile: u.profile,
      } : null,
    }
  })

  if (query && query.trim()) {
    const q = query.trim().toLowerCase()
    passList = passList.filter(p =>
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.memberId && p.memberId.toLowerCase().includes(q)) ||
      (p.id && p.id.toLowerCase().includes(q)) ||
      (p.eventTitle && p.eventTitle.toLowerCase().includes(q)) ||
      (p.teamName && p.teamName.toLowerCase().includes(q)) ||
      (p.paymentReference && p.paymentReference.toLowerCase().includes(q)) ||
      (p.email && p.email.toLowerCase().includes(q)) ||
      (p.phone && p.phone.toLowerCase().includes(q)) ||
      (p.department && p.department.toLowerCase().includes(q))
    )
  }

  return response.status(200).json({ passes: passList })
}

export async function getEventDetailsWithStats(request, response) {
  const event = await prisma.event.findUnique({
    where: { id: request.params.eventId },
    include: {
      activities: { orderBy: { sortOrder: 'asc' } },
      formFields: true,
      registrations: {
        where: submittedRegistrationWhere(),
        orderBy: { registeredAt: 'desc' },
      },
    },
  })
  if (!event) return response.status(404).json({ message: 'Event not found' })

  // Fetch lightweight student profiles for registrations (omit heavy Base64 images)
  const userIds = event.registrations.map(r => r.userId)
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      memberId: true,
      role: true,
      profile: {
        select: {
          name: true,
          rollNumber: true,
          email: true,
          phone: true,
          department: true,
          year: true,
          gender: true,
          age: true,
        },
      },
    },
  })
  const userMap = new Map(users.map(u => [u.id, u]))

  const populatedRegistrations = event.registrations.map(reg => {
    const u = userMap.get(reg.userId)
    return {
      ...reg,
      totalAmount: Number(reg.totalAmount),
      qrCodeData: hasActiveEventPass(reg) ? reg.qrCodeData : null,
      memberName: u?.profile?.name || reg.formData?.fullName || reg.formData?.name || u?.memberId || 'Student',
      memberId: u?.memberId,
      name: u?.profile?.name || reg.formData?.fullName || reg.formData?.name || u?.memberId || 'Student',
      email: u?.profile?.email || reg.formData?.email || null,
      passEmailSent: Boolean(reg.formData?.passEmailSentAt),
      passEmailSentAt: reg.formData?.passEmailSentAt || null,
      passEmailSentTo: reg.formData?.passEmailSentTo || null,
      passEmailCustomMessage: reg.formData?.passEmailCustomMessage || null,
      phone: u?.profile?.phone || null,
      rollNumber: u?.profile?.rollNumber || reg.formData?.rollNumber || null,
      department: u?.profile?.department || reg.branch || null,
      year: u?.profile?.year || reg.year || null,
      gender: reg.gender || u?.profile?.gender || 'UNSPECIFIED',
      age: reg.age || u?.profile?.age || null,
      residencyType: reg.residencyType || 'DAY_SCHOLAR',
      transportMode: reg.transportMode || 'OWN_TRANSPORT',
      hostelType: reg.hostelType || null,
      emergencyContact: reg.emergencyContact || null,
      user: u ? {
        id: u.id,
        memberId: u.memberId,
        role: u.role,
        profile: u.profile,
      } : null,
    }
  })

  const totalRegistrations = populatedRegistrations.length
  const confirmed = populatedRegistrations.filter(r => hasActiveEventPass(r)).length
  const pending = populatedRegistrations.filter(r =>
    ['PAYMENT_PENDING', 'PENDING_PAYMENT', 'UNDER_VERIFICATION'].includes(String(r.status || '').toUpperCase())
    || ['PENDING', 'SUBMITTED', 'UNDER_VERIFICATION'].includes(String(r.paymentStatus || '').toUpperCase()),
  ).length
  const rejected = populatedRegistrations.filter(r =>
    ['REJECTED', 'PAYMENT_REJECTED'].includes(String(r.status || '').toUpperCase())
    || ['REJECTED', 'PAYMENT_REJECTED'].includes(String(r.paymentStatus || '').toUpperCase()),
  ).length
  const totalVerifiedRevenue = populatedRegistrations
    .filter(r => r.paymentStatus === 'VERIFIED')
    .reduce((sum, r) => sum + (Number(r.totalAmount) || 0), 0)

  // Revenue & participants per activity
  const activityStats = (event.activities || []).map(act => {
    const participants = populatedRegistrations.filter(r => {
      const selected = Array.isArray(r.selectedActivities) ? r.selectedActivities : []
      return selected.some(s => s.id === act.id || s.name === act.name)
    })
    return {
      id: act.id,
      name: act.name,
      price: Number(act.price),
      participantCount: participants.length,
      revenue: participants.filter(p => p.paymentStatus === 'VERIFIED').length * Number(act.price),
    }
  })

  return response.status(200).json({
    event: serializeEvent(event),
    stats: {
      totalRegistrations,
      confirmed,
      pending,
      rejected,
      totalVerifiedRevenue,
      seatsRemaining: event.capacity ? Math.max(0, event.capacity - totalRegistrations) : null,
      activityStats,
    },
    registrations: populatedRegistrations,
  })
}

export async function verifyRegistrationPaymentFast(request, response) {
  const { registrationId } = request.params

  const registration = await prisma.eventRegistration.findUnique({
    where: { id: registrationId },
    include: { event: true },
  })
  if (!registration) return response.status(404).json({ message: 'Pass / Registration not found.' })
  if (!isPaymentAwaitingReview(registration)) {
    return response.status(409).json({ message: 'Only a paid registration currently awaiting UTR review can be verified.' })
  }

  const transition = await prisma.$transaction(async tx => {
    const verifiedAt = new Date()
    const changed = await tx.eventRegistration.updateMany({
      where: {
        id: registrationId,
        paymentStatus: { in: ['PENDING', 'SUBMITTED', 'UNDER_VERIFICATION'] },
        totalAmount: { gt: 0 },
        paymentReference: { not: '' },
        status: { not: 'DRAFT' },
      },
      data: {
        paymentStatus: 'VERIFIED',
        status: 'REGISTERED',
        amountPaid: registration.totalAmount,
        paymentVerifiedAt: verifiedAt,
        paymentVerifiedBy: request.user.id,
      },
    })
    if (changed.count !== 1) return { conflict: true }

    if (registration.teamId) {
      await tx.eventRegistration.updateMany({
        where: { teamId: registration.teamId, status: { not: 'DRAFT' } },
        data: {
          paymentStatus: 'VERIFIED',
          status: 'REGISTERED',
          paymentVerifiedAt: verifiedAt,
          paymentVerifiedBy: request.user.id,
        },
      })
    }

    return { registration: await tx.eventRegistration.findUnique({ where: { id: registrationId } }) }
  })
  if (transition.conflict) {
    return response.status(409).json({ message: 'This payment was already reviewed. Refresh the roster before taking another action.' })
  }
  const updated = transition.registration

  // Notify student that payment is verified & pass is active
  createUserNotification({
    userId: registration.userId,
    type: 'PAYMENT_VERIFIED',
    title: `Payment Verified: ${registration.event?.title}`,
    message: `Your payment of ₹${Number(registration.totalAmount)} (Ref: ${registration.paymentReference || 'UTR Verified'}) has been verified. Your digital event pass is active!`,
    linkUrl: '/student-passes',
  }).catch(() => {})

  await tryWriteAuditLog({
    actorUserId: request.user.id,
    action: 'REGISTRATION_PAYMENT_VERIFIED',
    targetUserId: registration.userId,
    metadata: { registrationId, amount: Number(registration.totalAmount), paymentReference: registration.paymentReference },
    ...auditRequest(request),
  })

  await prisma.paymentVerificationLog.create({
    data: {
      id: newId(),
      registrationId,
      adminId: request.user.id,
      adminName: request.user.profile?.name || request.user.memberId,
      action: 'VERIFIED',
      amount: registration.totalAmount,
      utr: registration.paymentReference,
      reason: 'Payment verified and pass marked as ACTIVE',
    },
  }).catch(() => {})

  return response.status(200).json({
    success: true,
    message: 'Payment verified and pass marked as ACTIVE!',
    registration: updated,
  })
}

export async function rejectRegistrationPayment(request, response) {
  const { registrationId } = request.params
  const { rejectionReason } = request.body || {}
  const reason = (rejectionReason && String(rejectionReason).trim()) || 'Transaction ID / UTR could not be verified in club bank statement.'

  const registration = await prisma.eventRegistration.findUnique({
    where: { id: registrationId },
    include: { event: true },
  })
  if (!registration) return response.status(404).json({ message: 'Pass / Registration not found.' })
  if (!isPaymentAwaitingReview(registration)) {
    return response.status(409).json({ message: 'Only a paid registration currently awaiting UTR review can be rejected.' })
  }

  const transition = await prisma.$transaction(async tx => {
    const changed = await tx.eventRegistration.updateMany({
      where: {
        id: registrationId,
        paymentStatus: { in: ['PENDING', 'SUBMITTED', 'UNDER_VERIFICATION'] },
        totalAmount: { gt: 0 },
        paymentReference: { not: '' },
        status: { not: 'DRAFT' },
      },
      data: {
        paymentStatus: 'REJECTED',
        status: 'PAYMENT_REJECTED',
        amountPaid: null,
        paymentRejectionReason: reason,
        qrCodeData: null,
        paymentVerifiedAt: null,
        paymentVerifiedBy: null,
      },
    })
    if (changed.count !== 1) return { conflict: true }

    if (registration.teamId) {
      await tx.eventRegistration.updateMany({
        where: { teamId: registration.teamId, status: { not: 'DRAFT' } },
        data: {
          paymentStatus: 'REJECTED',
          status: 'PAYMENT_REJECTED',
          amountPaid: null,
          paymentRejectionReason: reason,
          qrCodeData: null,
          paymentVerifiedAt: null,
          paymentVerifiedBy: null,
        },
      })
    }

    return { registration: await tx.eventRegistration.findUnique({ where: { id: registrationId } }) }
  })
  if (transition.conflict) {
    return response.status(409).json({ message: 'This payment was already reviewed. Refresh the roster before taking another action.' })
  }
  const updated = transition.registration

  // Notify student with reason
  createUserNotification({
    userId: registration.userId,
    type: 'PAYMENT_REJECTED',
    title: `Payment Update: ${registration.event?.title || 'Event Pass'}`,
    message: `Your payment could not be verified. Reason: "${reason}". Please open your passes dashboard to resubmit your transaction details.`,
    linkUrl: '/student-passes',
  }).catch(() => {})

  await tryWriteAuditLog({
    actorUserId: request.user.id,
    action: 'REGISTRATION_PAYMENT_REJECTED',
    targetUserId: registration.userId,
    metadata: { registrationId, reason, paymentReference: registration.paymentReference },
    ...auditRequest(request),
  })

  await prisma.paymentVerificationLog.create({
    data: {
      id: newId(),
      registrationId,
      adminId: request.user.id,
      adminName: request.user.profile?.name || request.user.memberId,
      action: 'REJECTED',
      amount: registration.totalAmount,
      utr: registration.paymentReference,
      reason,
    },
  }).catch(() => {})

  return response.status(200).json({
    success: true,
    message: 'Payment marked as rejected. Participant has been notified.',
    registration: updated,
  })
}

export async function markRegistrationPaymentPending(request, response) {
  const { registrationId } = request.params

  const registration = await prisma.eventRegistration.findUnique({
    where: { id: registrationId },
    include: { event: true },
  })
  if (!registration) return response.status(404).json({ message: 'Pass / Registration not found.' })
  if (!isRejectedPayment(registration)) {
    return response.status(409).json({ message: 'Only a rejected paid registration can be returned to UTR review.' })
  }

  const transition = await prisma.$transaction(async tx => {
    const changed = await tx.eventRegistration.updateMany({
      where: {
        id: registrationId,
        paymentStatus: { in: ['REJECTED', 'PAYMENT_REJECTED'] },
        totalAmount: { gt: 0 },
        paymentReference: { not: '' },
        status: { not: 'DRAFT' },
      },
      data: {
        paymentStatus: 'UNDER_VERIFICATION',
        status: 'UNDER_VERIFICATION',
        amountPaid: null,
        paymentVerifiedAt: null,
        paymentVerifiedBy: null,
        paymentRejectionReason: null,
        qrCodeData: null,
      },
    })
    if (changed.count !== 1) return { conflict: true }

    if (registration.teamId) {
      await tx.eventRegistration.updateMany({
        where: { teamId: registration.teamId, status: { not: 'DRAFT' } },
        data: {
          paymentStatus: 'UNDER_VERIFICATION',
          status: 'UNDER_VERIFICATION',
          amountPaid: null,
          paymentVerifiedAt: null,
          paymentVerifiedBy: null,
          paymentRejectionReason: null,
          qrCodeData: null,
        },
      })
    }

    return { registration: await tx.eventRegistration.findUnique({ where: { id: registrationId } }) }
  })
  if (transition.conflict) {
    return response.status(409).json({ message: 'Only a rejected payment can be returned to review.' })
  }
  const updated = transition.registration

  createUserNotification({
    userId: registration.userId,
    type: 'PAYMENT_UNDER_REVIEW',
    title: `Payment Reopened: ${registration.event?.title || 'Event Pass'}`,
    message: 'Your rejected payment was returned to the organizer review queue.',
    linkUrl: '/student-passes',
  }).catch(() => {})
  await tryWriteAuditLog({
    actorUserId: request.user.id,
    action: 'REGISTRATION_PAYMENT_RETURNED_TO_REVIEW',
    targetUserId: registration.userId,
    metadata: { registrationId, paymentReference: registration.paymentReference },
    ...auditRequest(request),
  })
  await prisma.paymentVerificationLog.create({
    data: {
      id: newId(),
      registrationId,
      adminId: request.user.id,
      adminName: request.user.profile?.name || request.user.memberId,
      action: 'PENDING',
      amount: registration.totalAmount,
      utr: registration.paymentReference,
      reason: 'Payment returned to the organizer review queue',
    },
  }).catch(() => {})

  return response.status(200).json({
    success: true,
    message: 'Payment status marked as Under Verification / Pending.',
    registration: updated,
  })
}

export async function bulkIssueEventPasses(request, response) {
  const { eventId } = request.params
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      registrationType: true,
      isTeamEvent: true,
      paymentAmount: true,
      requiresPayment: true,
      paymentConfig: true,
      status: true,
      capacity: true,
    },
  })

  if (!event || event.status === 'ARCHIVED') {
    return response.status(404).json({ message: 'Event not found or archived.' })
  }

  // Solo Event restriction: bulk direct pass issuance is restricted to Solo / Individual events
  const configuredType = String(event.registrationType || '').trim().toUpperCase()
  const { supportsTeams } = resolveEventRegistrationMode(event, 'INDIVIDUAL')
  if (configuredType === 'TEAM' || (!supportsTeams && event.isTeamEvent)) {
    return response.status(400).json({
      message: 'Bulk pass issuance only works for Solo / Individual events. Team events require team formation and squad leader linking.',
    })
  }

  const parsed = bulkIssuePassesSchema.safeParse(request.body)
  if (!parsed.success) {
    return response.status(400).json({
      message: parsed.error.issues[0]?.message || 'Invalid input data.',
      errors: parsed.error.issues,
    })
  }

  const { memberIds, assumePaid = true, autoCreateMissingAccounts = false, notes } = parsed.data
  const isPreview = Boolean(request.body.previewOnly || request.query.preview === 'true')

  // Deduplicate and trim input IDs / roll numbers, splitting any nested delimiters
  const rawTokens = Array.from(new Set(
    memberIds
      .flatMap(t => String(t || '').split(/[\r\n,\t;]+/))
      .map(t => t.trim().replace(/^["']|["']$/g, ''))
      .filter(t => t.length >= 2 && t.length <= 64)
  ))
  if (rawTokens.length === 0) {
    return response.status(400).json({ message: 'No valid student IDs provided.' })
  }

  // Generate multi-format search tokens (exact, uppercase, lowercase, and clean alphanumeric)
  const allSearchTokens = new Set()
  for (const t of rawTokens) {
    allSearchTokens.add(t)
    allSearchTokens.add(t.toUpperCase())
    allSearchTokens.add(t.toLowerCase())
    const cleanAlpha = t.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (cleanAlpha) allSearchTokens.add(cleanAlpha)
  }
  const searchTokenArray = Array.from(allSearchTokens)

  // 1. Fetch matching active students by memberId, profile.rollNumber, or profile.email
  const foundUsers = await prisma.user.findMany({
    where: {
      accountStatus: 'ACTIVE',
      OR: [
        { memberId: { in: searchTokenArray } },
        { profile: { rollNumber: { in: searchTokenArray } } },
        { profile: { email: { in: searchTokenArray } } },
      ],
    },
    include: {
      profile: true,
    },
  })

  // 2. Build fast direct lookup dictionary
  const userByExactKey = new Map()
  for (const u of foundUsers) {
    if (u.memberId) {
      userByExactKey.set(u.memberId.trim().toLowerCase(), u)
      const uMemberAlpha = u.memberId.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
      if (uMemberAlpha) userByExactKey.set(uMemberAlpha, u)
    }
    if (u.profile?.rollNumber) {
      userByExactKey.set(u.profile.rollNumber.trim().toLowerCase(), u)
      const uRollAlpha = u.profile.rollNumber.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
      if (uRollAlpha) userByExactKey.set(uRollAlpha, u)
    }
    if (u.profile?.email) userByExactKey.set(u.profile.email.trim().toLowerCase(), u)
  }

  // 3. For any tokens not found by direct lookup, run partial/suffix match for short vs full roll numbers
  const unmatchedTokens = []
  for (const token of rawTokens) {
    const tLower = token.toLowerCase()
    const tClean = token.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!userByExactKey.has(tLower) && !userByExactKey.has(tClean)) {
      unmatchedTokens.push(token)
    }
  }

  if (unmatchedTokens.length > 0) {
    const partialFilters = []
    for (const ut of unmatchedTokens) {
      const clean = ut.toUpperCase().replace(/[^A-Z0-9]/g, '')
      if (clean.length >= 4) {
        partialFilters.push(
          { memberId: { contains: clean } },
          { profile: { rollNumber: { contains: clean } } }
        )
      }
    }
    if (partialFilters.length > 0) {
      const partialMatchedUsers = await prisma.user.findMany({
        where: {
          accountStatus: 'ACTIVE',
          OR: partialFilters,
        },
        include: { profile: true },
      })
      for (const pUser of partialMatchedUsers) {
        if (!foundUsers.some(u => u.id === pUser.id)) {
          foundUsers.push(pUser)
        }
      }
    }
  }

  // 4. Resolve each token to an individual student or categorize error
  const tokenResolution = []
  const matchedUsers = []
  const seenMatchedUserIds = new Set()

  for (const token of rawTokens) {
    const tLower = token.toLowerCase()
    const tClean = token.toUpperCase().replace(/[^A-Z0-9]/g, '')

    let user = userByExactKey.get(tLower) || userByExactKey.get(tClean)

    // Suffix/partial resolution if not matched directly
    if (!user && tClean.length >= 4) {
      const candidates = foundUsers.filter(u => {
        const uMemberClean = (u.memberId || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
        const uRollClean = (u.profile?.rollNumber || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
        return (
          uMemberClean.endsWith(tClean) ||
          tClean.endsWith(uMemberClean) ||
          uRollClean.endsWith(tClean) ||
          tClean.endsWith(uRollClean) ||
          uMemberClean.includes(tClean) ||
          uRollClean.includes(tClean)
        )
      })

      if (candidates.length === 1) {
        user = candidates[0]
      } else if (candidates.length > 1) {
        tokenResolution.push({
          token,
          user: null,
          errorReason: 'AMBIGUOUS_ROLL_NUMBER',
          errorMessage: `Roll number "${token}" matches multiple accounts (${candidates.map(c => c.profile?.name || c.memberId).join(', ')}). Enter the full unique roll number.`,
        })
        continue
      }
    }

    if (user) {
      if (!seenMatchedUserIds.has(user.id)) {
        seenMatchedUserIds.add(user.id)
        matchedUsers.push(user)
      }
      tokenResolution.push({ token, user, errorReason: null })
    } else {
      tokenResolution.push({
        token,
        user: null,
        errorReason: 'STUDENT_NOT_FOUND',
        errorMessage: `No registered student account found for Roll Number / ID "${token}". Make sure the student has created their account on the portal.`,
      })
    }
  }

  // 5. Query existing registrations for all matched students for THIS event
  const matchedUserIds = matchedUsers.map(u => u.id)
  const existingRegistrations = await prisma.eventRegistration.findMany({
    where: {
      eventId: event.id,
      userId: { in: matchedUserIds },
    },
    include: {
      event: { select: { id: true, title: true, paymentAmount: true } },
    },
  })
  const existingRegistrationByUserId = new Map(existingRegistrations.map(r => [r.userId, r]))

  // 6. Partition students:
  //    - newPassUsers: No prior registration for this event -> will create registration & pass
  //    - waitingUpgradeUsers: Prior registration exists, BUT is WAITING / UNVERIFIED -> will approve & activate pass
  //    - alreadyHadPassList: Prior registration ALREADY has an active verified pass -> skipped safely
  const newPassUsers = []
  const waitingUpgradeUsers = []
  const alreadyHadPassList = []

  for (const user of matchedUsers) {
    const existingReg = existingRegistrationByUserId.get(user.id)
    if (!existingReg) {
      newPassUsers.push(user)
    } else if (hasActiveEventPass(existingReg)) {
      alreadyHadPassList.push({
        memberId: user.memberId,
        rollNumber: user.profile?.rollNumber || user.memberId,
        name: user.profile?.name || user.memberId,
        registrationId: existingReg.id,
        reason: 'ALREADY_ACTIVE_PASS',
        message: 'Student already holds an active verified pass for this event. Skipped to prevent duplicates.',
      })
    } else {
      // Student is already registered and waiting for pass / pending payment!
      waitingUpgradeUsers.push({ user, existingReg })
    }
  }

  const autoCreateCandidates = []
  const notFoundList = []

  for (const tr of tokenResolution) {
    if (tr.errorReason) {
      if (autoCreateMissingAccounts && tr.errorReason === 'STUDENT_NOT_FOUND') {
        const cleanRoll = tr.token.toUpperCase().replace(/[^A-Z0-9]/g, '')
        if (cleanRoll.length >= 2) {
          autoCreateCandidates.push({
            token: tr.token,
            rollNumber: cleanRoll,
          })
          continue
        }
      }
      notFoundList.push({
        input: tr.token,
        reason: tr.errorReason,
        message: tr.errorMessage,
      })
    }
  }

  // Pre-flight validation preview
  if (isPreview) {
    const eligibleCount = newPassUsers.length + waitingUpgradeUsers.length + autoCreateCandidates.length
    return response.status(200).json({
      preview: true,
      totalSubmitted: rawTokens.length,
      eligibleCount,
      newPassesCount: newPassUsers.length,
      waitingApprovedCount: waitingUpgradeUsers.length,
      autoCreateCount: autoCreateCandidates.length,
      alreadyHadPassCount: alreadyHadPassList.length,
      skippedCount: alreadyHadPassList.length,
      notFoundCount: notFoundList.length,
      autoCreateMissingAccounts,
      eligible: [
        ...newPassUsers.map(u => ({
          id: u.id,
          memberId: u.memberId,
          rollNumber: u.profile?.rollNumber || u.memberId,
          name: u.profile?.name || u.memberId,
          email: u.profile?.email || null,
          department: u.profile?.department || 'CSE',
          year: u.profile?.year || 1,
          action: 'CREATE_NEW_PASS',
          statusDescription: 'New Pass to be Issued',
        })),
        ...waitingUpgradeUsers.map(({ user: u, existingReg: r }) => ({
          id: u.id,
          memberId: u.memberId,
          rollNumber: u.profile?.rollNumber || u.memberId,
          name: u.profile?.name || u.memberId,
          email: u.profile?.email || null,
          department: u.profile?.department || 'CSE',
          year: u.profile?.year || 1,
          action: 'APPROVE_WAITING',
          statusDescription: `Waiting (${r.paymentStatus || r.status}) -> Will be Approved & Pass Activated`,
        })),
        ...autoCreateCandidates.map(c => ({
          id: 'temp_' + c.rollNumber,
          memberId: c.rollNumber,
          rollNumber: c.rollNumber,
          name: `Student (${c.rollNumber})`,
          email: null,
          department: 'CSE',
          year: 1,
          action: 'AUTO_CREATE_ACCOUNT_AND_PASS',
          statusDescription: `Account Missing -> Will Auto-Create Account (Password: ${c.rollNumber}) & Issue Pass`,
        })),
      ],
      skipped: alreadyHadPassList,
      notFound: notFoundList,
    })
  }

  if (newPassUsers.length === 0 && waitingUpgradeUsers.length === 0 && autoCreateCandidates.length === 0) {
    if (!isPreview) {
      if (alreadyHadPassList.length === 0 && notFoundList.length > 0) {
        return response.status(400).json({
          success: false,
          message: `Cannot issue pass: Student account(s) not found (${notFoundList.map(n => n.input).slice(0, 3).join(', ')}). You can enable "Auto-Create Student Accounts" to automatically create their accounts, or have students register first.`,
          notFoundCount: notFoundList.length,
          notFound: notFoundList,
        })
      }
      if (alreadyHadPassList.length > 0 && notFoundList.length === 0) {
        return response.status(400).json({
          success: false,
          message: `All entered student(s) already hold active verified passes for this event. No new passes were issued.`,
          alreadyHadPassCount: alreadyHadPassList.length,
          skipped: alreadyHadPassList,
        })
      }
      return response.status(400).json({
        success: false,
        message: `No passes issued: ${alreadyHadPassList.length} already hold active passes, and ${notFoundList.length} student account(s) do not exist.`,
        notFound: notFoundList,
        skipped: alreadyHadPassList,
      })
    }

    return response.status(200).json({
      preview: true,
      success: true,
      message: 'No passes needed. All matched students already hold active verified passes, or student accounts were not found.',
      issuedCount: 0,
      newPassesCount: 0,
      waitingApprovedCount: 0,
      autoCreateCount: 0,
      alreadyHadPassCount: alreadyHadPassList.length,
      skippedCount: alreadyHadPassList.length,
      notFoundCount: notFoundList.length,
      issued: [],
      skipped: alreadyHadPassList,
      notFound: notFoundList,
    })
  }

  // Auto-create missing student accounts if Option 3 enabled
  const autoCreatedUsers = []
  if (autoCreateCandidates.length > 0) {
    const studentPermissions = getRolePermissions('STUDENT')
    for (const c of autoCreateCandidates) {
      const cleanRoll = c.rollNumber
      let user = await prisma.user.findFirst({
        where: {
          OR: [
            { memberId: cleanRoll },
            { profile: { rollNumber: cleanRoll } },
          ],
        },
        include: { profile: true },
      })
      if (!user) {
        const passwordHash = await bcrypt.hash(cleanRoll, env.bcryptRounds)
        user = await prisma.user.create({
          data: {
            memberId: cleanRoll,
            role: 'STUDENT',
            accountStatus: 'ACTIVE',
            passwordHash,
            profile: {
              create: {
                rollNumber: cleanRoll,
                name: `Student (${cleanRoll})`,
                department: 'CSE',
                year: 1,
              },
            },
            permissions: {
              create: studentPermissions.map(p => ({ permission: p })),
            },
          },
          include: { profile: true },
        })
        autoCreatedUsers.push(user)
      }
      newPassUsers.push(user)
    }
  }

  // Determine pricing & payment status
  const eventFee = Number(event.paymentAmount ?? event.paymentConfig?.price ?? 0) || 0
  const isFree = eventFee <= 0
  const shouldVerify = Boolean(assumePaid) || isFree
  const paymentStatus = shouldVerify ? (isFree ? 'FREE' : 'VERIFIED') : 'PENDING'
  const amountPaid = shouldVerify ? eventFee : null
  const paymentMethod = shouldVerify ? 'OFFLINE_BULK_ORGANIZER' : null
  const paymentVerifiedAt = shouldVerify ? new Date() : null
  const paymentVerifiedBy = shouldVerify ? request.user.id : null
  const auditOrganizerName = request.user.profile?.name || request.user.memberId || 'Organizer'

  // Prepare database transactions:
  // 1. Creates for newPassUsers (generate QR codes concurrently)
  const newPassRegistrationsData = await Promise.all(
    newPassUsers.map(async student => {
      const regId = 'reg_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9)
      let qrCode = null
      try {
        qrCode = await QRCode.toDataURL(`EVENT_PASS:${regId}`, {
          margin: 2,
          width: 300,
          color: { dark: '#000000', light: '#ffffff' },
        })
      } catch {}
      return {
        id: regId,
        eventId: event.id,
        userId: student.id,
        registrationType: 'INDIVIDUAL',
        totalAmount: eventFee,
        amountPaid,
        paymentStatus,
        paymentMethod,
        paymentVerifiedAt,
        paymentVerifiedBy,
        paymentNotes: notes || `Bulk pass issued by ${auditOrganizerName}`,
        branch: student.profile?.department || null,
        year: student.profile?.year ? Number(student.profile.year) : null,
        gender: student.profile?.gender || null,
        status: 'REGISTERED',
        attendanceMarked: false,
        qrCodeData: qrCode,
      }
    })
  )
  const createOperations = newPassRegistrationsData.map(data => prisma.eventRegistration.create({ data }))

  // 2. Updates for waitingUpgradeUsers: approving and activating their registration
  const waitingUpgradesData = await Promise.all(
    waitingUpgradeUsers.map(async ({ user: student, existingReg }) => {
      let qrCode = existingReg.qrCodeData
      if (!qrCode) {
        try {
          qrCode = await QRCode.toDataURL(`EVENT_PASS:${existingReg.id}`, {
            margin: 2,
            width: 300,
            color: { dark: '#000000', light: '#ffffff' },
          })
        } catch {}
      }
      return {
        existingRegId: existingReg.id,
        data: {
          status: 'REGISTERED',
          paymentStatus,
          amountPaid: amountPaid ?? existingReg.amountPaid,
          paymentMethod: existingReg.paymentMethod || paymentMethod,
          paymentVerifiedAt,
          paymentVerifiedBy,
          paymentNotes: notes || (existingReg.paymentNotes ? `${existingReg.paymentNotes} · Pass activated by ${auditOrganizerName}` : `Pass activated by ${auditOrganizerName}`),
          paymentRejectionReason: null,
          qrCodeData: qrCode,
        },
      }
    })
  )
  const updateOperations = waitingUpgradesData.map(({ existingRegId, data }) =>
    prisma.eventRegistration.update({
      where: { id: existingRegId },
      data,
    })
  )

  // Execute database batch inside an atomic transaction
  if (createOperations.length > 0 || updateOperations.length > 0) {
    await prisma.$transaction([...createOperations, ...updateOperations])
  }

  const totalProcessed = newPassUsers.length + waitingUpgradeUsers.length

  await tryWriteAuditLog({
    actorUserId: request.user.id,
    action: 'EVENT_BULK_PASSES_ISSUED',
    metadata: {
      eventId: event.id,
      eventTitle: event.title,
      totalIssued: totalProcessed,
      newPassesCount: newPassUsers.length - autoCreatedUsers.length,
      autoCreatedAccountsCount: autoCreatedUsers.length,
      waitingApprovedCount: waitingUpgradeUsers.length,
      alreadyHadPassCount: alreadyHadPassList.length,
      notFoundCount: notFoundList.length,
      assumePaid,
      autoCreateMissingAccounts,
    },
    ...auditRequest(request),
  })

  let successMessage = `Batch admission complete: `
  const summaryParts = []
  const pureNewPasses = newPassUsers.length - autoCreatedUsers.length
  if (pureNewPasses > 0) summaryParts.push(`${pureNewPasses} new pass(es) issued`)
  if (waitingUpgradeUsers.length > 0) summaryParts.push(`${waitingUpgradeUsers.length} waiting registration(s) approved and pass activated`)
  if (autoCreatedUsers.length > 0) summaryParts.push(`${autoCreatedUsers.length} student account(s) auto-created and pass issued`)
  if (alreadyHadPassList.length > 0) summaryParts.push(`${alreadyHadPassList.length} student(s) skipped (already had active pass)`)
  successMessage += (summaryParts.length > 0 ? summaryParts.join(', ') : `${totalProcessed} pass(es) processed`) + '.'

  return response.status(200).json({
    success: true,
    message: successMessage,
    issuedCount: totalProcessed,
    newPassesCount: pureNewPasses,
    autoCreatedAccountsCount: autoCreatedUsers.length,
    waitingApprovedCount: waitingUpgradeUsers.length,
    alreadyHadPassCount: alreadyHadPassList.length,
    skippedCount: alreadyHadPassList.length,
    notFoundCount: notFoundList.length,
    issued: [
      ...newPassUsers.map(u => ({
        memberId: u.memberId,
        rollNumber: u.profile?.rollNumber || u.memberId,
        name: u.profile?.name || u.memberId,
        type: autoCreatedUsers.some(a => a.id === u.id) ? 'AUTO_CREATED_ACCOUNT_AND_PASS' : 'NEW_PASS',
        status: autoCreatedUsers.some(a => a.id === u.id) ? 'Account Created & Pass Issued' : 'Pass Issued',
      })),
      ...waitingUpgradeUsers.map(({ user: u }) => ({
        memberId: u.memberId,
        rollNumber: u.profile?.rollNumber || u.memberId,
        name: u.profile?.name || u.memberId,
        type: 'APPROVED_WAITING',
        status: 'Waiting Registration Approved & Pass Activated',
      })),
    ],
    skipped: alreadyHadPassList,
    notFound: notFoundList,
  })
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function resolveEventPassEmails(request, response) {
  const { eventId } = request.params
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      eventType: true,
      dateTime: true,
      venue: true,
      location: true,
      status: true,
    },
  })
  if (!event) {
    return response.status(404).json({ message: 'Event not found.' })
  }

  const mode = String(request.body?.mode || request.query?.mode || 'EVENT_ROSTER').trim().toUpperCase()
  const rawEntries = Array.isArray(request.body?.entries)
    ? request.body.entries
    : Array.isArray(request.body?.rollNumbers)
      ? request.body.rollNumbers.map(r => ({ rollNumber: r }))
      : []

  // MODE 1: ZERO UPLOAD (Automatic Event Pass Roster)
  if (mode === 'EVENT_ROSTER') {
    const registrations = await prisma.eventRegistration.findMany({
      where: {
        eventId: event.id,
        ...submittedRegistrationWhere(),
      },
      orderBy: { registeredAt: 'desc' },
    })

    const userIds = [...new Set(registrations.map(r => r.userId))]
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      include: { profile: true },
    })
    const userMap = new Map(users.map(u => [u.id, u]))

    const recipients = registrations.map(reg => {
      const u = userMap.get(reg.userId)
      const isPassActive = hasActiveEventPass(reg)
      const formObj = (reg.formData && typeof reg.formData === 'object') ? reg.formData : {}
      const effectiveEmail = (u?.profile?.email || formObj.email || '').trim() || null
      const isAlreadySent = Boolean(formObj.passEmailSentAt)
      const rollNumber = u?.profile?.rollNumber || formObj.rollNumber || u?.memberId || 'UNKNOWN'
      const name = u?.profile?.name || formObj.fullName || formObj.name || u?.memberId || 'Student'

      let dispatchStatus = 'READY'
      let statusMessage = 'Ready to Send'
      if (isAlreadySent) {
        dispatchStatus = 'ALREADY_SENT'
        statusMessage = `SENT / DONE (${formObj.passEmailSentTo || effectiveEmail || 'Sent'})`
      } else if (!isPassActive) {
        dispatchStatus = 'PASS_WAITING_VERIFICATION'
        statusMessage = 'Pass Not Issued / Waiting Verification'
      } else if (!effectiveEmail) {
        dispatchStatus = 'EMAIL_NOT_GIVEN'
        statusMessage = 'EMAIL NOT GIVEN'
      }

      return {
        registrationId: reg.id,
        userId: u?.id || reg.userId,
        memberId: u?.memberId || rollNumber,
        rollNumber,
        name,
        department: u?.profile?.department || reg.branch || 'CSE',
        year: u?.profile?.year || reg.year || 1,
        email: effectiveEmail,
        hasActivePass: isPassActive,
        passStatus: isPassActive ? 'ISSUED' : (reg.paymentStatus || reg.status),
        emailSent: isAlreadySent,
        emailSentAt: formObj.passEmailSentAt || null,
        emailSentTo: formObj.passEmailSentTo || null,
        emailCustomMessage: formObj.passEmailCustomMessage || null,
        dispatchStatus,
        statusMessage,
      }
    })

    return response.status(200).json({
      mode: 'EVENT_ROSTER',
      event,
      senderEmail: env.smtpUser || 'cyberclubmrdu2025@gmail.com',
      totalCount: recipients.length,
      readyCount: recipients.filter(r => r.dispatchStatus === 'READY').length,
      emailNotGivenCount: recipients.filter(r => r.dispatchStatus === 'EMAIL_NOT_GIVEN').length,
      alreadySentCount: recipients.filter(r => r.dispatchStatus === 'ALREADY_SENT').length,
      waitingCount: recipients.filter(r => r.dispatchStatus === 'PASS_WAITING_VERIFICATION').length,
      noPassCount: 0,
      notFoundCount: 0,
      emailsLinkedCount: 0,
      recipients,
    })
  }

  // MODE 2 (ROLL NUMBERS) & MODE 3 (EXCEL / CSV WITH OPTIONAL EMAILS)
  const normalizedEntries = []
  const seenKeys = new Set()
  for (const item of rawEntries) {
    const rawRoll = String(typeof item === 'string' ? item : (item?.rollNumber || item?.memberId || '')).trim().replace(/^["']|["']$/g, '')
    if (!rawRoll || rawRoll.length < 2) continue
    const dedupeKey = rawRoll.toUpperCase()
    if (seenKeys.has(dedupeKey)) continue
    seenKeys.add(dedupeKey)

    const rawEmail = typeof item === 'object' && item?.email ? String(item.email).trim().toLowerCase().replace(/^["']|["']$/g, '') : ''
    const validProvidedEmail = EMAIL_REGEX.test(rawEmail) ? rawEmail : null
    const rowCustomMessage = typeof item === 'object' && item?.customMessage ? String(item.customMessage).trim() : null

    normalizedEntries.push({
      rawRoll,
      cleanAlpha: rawRoll.toUpperCase().replace(/[^A-Z0-9]/g, ''),
      providedEmail: validProvidedEmail,
      rawInvalidEmail: rawEmail && !validProvidedEmail ? rawEmail : null,
      customMessage: rowCustomMessage,
    })
  }

  if (normalizedEntries.length === 0) {
    return response.status(400).json({ message: 'Please provide at least one valid Roll Number.' })
  }

  const searchTokens = new Set()
  for (const entry of normalizedEntries) {
    searchTokens.add(entry.rawRoll)
    searchTokens.add(entry.rawRoll.toUpperCase())
    searchTokens.add(entry.rawRoll.toLowerCase())
    if (entry.cleanAlpha) searchTokens.add(entry.cleanAlpha)
  }
  const searchTokenArray = Array.from(searchTokens)

  const foundUsers = await prisma.user.findMany({
    where: {
      accountStatus: 'ACTIVE',
      OR: [
        { memberId: { in: searchTokenArray } },
        { profile: { rollNumber: { in: searchTokenArray } } },
        { profile: { email: { in: searchTokenArray } } },
      ],
    },
    include: { profile: true },
  })

  const userByExactKey = new Map()
  for (const u of foundUsers) {
    if (u.memberId) {
      userByExactKey.set(u.memberId.trim().toLowerCase(), u)
      const alpha = u.memberId.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
      if (alpha) userByExactKey.set(alpha, u)
    }
    if (u.profile?.rollNumber) {
      userByExactKey.set(u.profile.rollNumber.trim().toLowerCase(), u)
      const alpha = u.profile.rollNumber.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
      if (alpha) userByExactKey.set(alpha, u)
    }
    if (u.profile?.email) {
      userByExactKey.set(u.profile.email.trim().toLowerCase(), u)
    }
  }

  // Partial / suffix fallback for any unmatched roll numbers
  const unmatchedEntries = normalizedEntries.filter(
    e => !userByExactKey.has(e.rawRoll.toLowerCase()) && !userByExactKey.has(e.cleanAlpha)
  )
  if (unmatchedEntries.length > 0) {
    const partialFilters = []
    for (const ue of unmatchedEntries) {
      if (ue.cleanAlpha.length >= 4) {
        partialFilters.push(
          { memberId: { contains: ue.cleanAlpha } },
          { profile: { rollNumber: { contains: ue.cleanAlpha } } }
        )
      }
    }
    if (partialFilters.length > 0) {
      const partialUsers = await prisma.user.findMany({
        where: { accountStatus: 'ACTIVE', OR: partialFilters },
        include: { profile: true },
      })
      for (const pu of partialUsers) {
        if (!foundUsers.some(u => u.id === pu.id)) foundUsers.push(pu)
      }
    }
  }

  // Fetch all registrations for matched users for this event
  const allFoundUserIds = foundUsers.map(u => u.id)
  const existingRegs = await prisma.eventRegistration.findMany({
    where: {
      eventId: event.id,
      userId: { in: allFoundUserIds },
      ...submittedRegistrationWhere(),
    },
  })
  const regByUserId = new Map(existingRegs.map(r => [r.userId, r]))

  let emailsLinkedCount = 0
  const recipients = []

  for (const entry of normalizedEntries) {
    let user = userByExactKey.get(entry.rawRoll.toLowerCase()) || userByExactKey.get(entry.cleanAlpha)
    if (!user && entry.cleanAlpha.length >= 4) {
      const candidates = foundUsers.filter(u => {
        const mClean = (u.memberId || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
        const rClean = (u.profile?.rollNumber || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
        return (
          mClean.endsWith(entry.cleanAlpha) ||
          entry.cleanAlpha.endsWith(mClean) ||
          rClean.endsWith(entry.cleanAlpha) ||
          entry.cleanAlpha.endsWith(rClean) ||
          mClean.includes(entry.cleanAlpha) ||
          rClean.includes(entry.cleanAlpha)
        )
      })
      if (candidates.length === 1) {
        user = candidates[0]
      } else if (candidates.length > 1) {
        recipients.push({
          registrationId: null,
          userId: null,
          memberId: entry.rawRoll,
          rollNumber: entry.rawRoll,
          name: 'Ambiguous Roll Number',
          department: '---',
          year: null,
          email: entry.providedEmail || null,
          hasActivePass: false,
          passStatus: 'AMBIGUOUS',
          emailSent: false,
          emailSentAt: null,
          emailSentTo: null,
          customMessage: entry.customMessage || null,
          dispatchStatus: 'AMBIGUOUS_ROLL_NUMBER',
          statusMessage: `Matches multiple accounts (${candidates.map(c => c.memberId).join(', ')}). Enter full roll number.`,
        })
        continue
      }
    }

    if (!user) {
      recipients.push({
        registrationId: null,
        userId: null,
        memberId: entry.rawRoll,
        rollNumber: entry.rawRoll,
        name: 'Account Not Found',
        department: '---',
        year: null,
        email: entry.providedEmail || null,
        hasActivePass: false,
        passStatus: 'NOT_FOUND',
        emailSent: false,
        emailSentAt: null,
        emailSentTo: null,
        customMessage: entry.customMessage || null,
        dispatchStatus: 'ACCOUNT_NOT_FOUND',
        statusMessage: `Account does not exist for "${entry.rawRoll}"`,
      })
      continue
    }

    // If Excel/CSV provided a valid email, automatically link it to the student's profile if missing or updated
    let currentProfileEmail = (user.profile?.email || '').trim() || null
    if (entry.providedEmail && request.body?.linkEmails !== false) {
      if (!currentProfileEmail || currentProfileEmail.toLowerCase() !== entry.providedEmail.toLowerCase()) {
        try {
          await prisma.profile.upsert({
            where: { userId: user.id },
            update: { email: entry.providedEmail },
            create: {
              userId: user.id,
              rollNumber: user.profile?.rollNumber || user.memberId,
              name: user.profile?.name || `Student (${user.memberId})`,
              email: entry.providedEmail,
              department: 'CSE',
              year: 1,
            },
          })
          currentProfileEmail = entry.providedEmail
          if (user.profile) user.profile.email = entry.providedEmail
          authUserCache.invalidate(user.id)
          emailsLinkedCount++
        } catch {
          // If email is already bound to another profile, still use it for this pass dispatch
          currentProfileEmail = entry.providedEmail
        }
      }
    }

    const reg = regByUserId.get(user.id)
    const rollNumber = user.profile?.rollNumber || user.memberId || entry.rawRoll
    const name = user.profile?.name || `Student (${rollNumber})`

    if (!reg) {
      recipients.push({
        registrationId: null,
        userId: user.id,
        memberId: user.memberId,
        rollNumber,
        name,
        department: user.profile?.department || 'CSE',
        year: user.profile?.year || 1,
        email: currentProfileEmail,
        hasActivePass: false,
        passStatus: 'NO_PASS',
        emailSent: false,
        emailSentAt: null,
        emailSentTo: null,
        customMessage: entry.customMessage || null,
        dispatchStatus: 'NO_PASS_ISSUED',
        statusMessage: 'No pass issued for this event yet',
      })
      continue
    }

    const formObj = (reg.formData && typeof reg.formData === 'object') ? reg.formData : {}
    // Also persist providedEmail onto registration formData if not already there
    if (entry.providedEmail && formObj.email !== entry.providedEmail) {
      try {
        await prisma.eventRegistration.update({
          where: { id: reg.id },
          data: {
            formData: { ...formObj, email: entry.providedEmail },
          },
        })
        formObj.email = entry.providedEmail
      } catch {}
    }

    const effectiveEmail = (entry.providedEmail || currentProfileEmail || formObj.email || '').trim() || null
    const isPassActive = hasActiveEventPass(reg)
    const isAlreadySent = Boolean(formObj.passEmailSentAt)

    let dispatchStatus = 'READY'
    let statusMessage = 'Ready to Send'
    if (isAlreadySent) {
      dispatchStatus = 'ALREADY_SENT'
      statusMessage = `SENT / DONE (${formObj.passEmailSentTo || effectiveEmail || 'Sent'})`
    } else if (!isPassActive) {
      dispatchStatus = 'PASS_WAITING_VERIFICATION'
      statusMessage = 'Pass Not Active / Waiting Verification'
    } else if (!effectiveEmail) {
      dispatchStatus = 'EMAIL_NOT_GIVEN'
      statusMessage = 'EMAIL NOT GIVEN'
    }

    recipients.push({
      registrationId: reg.id,
      userId: user.id,
      memberId: user.memberId,
      rollNumber,
      name: user.profile?.name || formObj.fullName || formObj.name || name,
      department: user.profile?.department || reg.branch || 'CSE',
      year: user.profile?.year || reg.year || 1,
      email: effectiveEmail,
      hasActivePass: isPassActive,
      passStatus: isPassActive ? 'ISSUED' : (reg.paymentStatus || reg.status),
      emailSent: isAlreadySent,
      emailSentAt: formObj.passEmailSentAt || null,
      emailSentTo: formObj.passEmailSentTo || null,
      emailCustomMessage: formObj.passEmailCustomMessage || entry.customMessage || null,
      customMessage: entry.customMessage || null,
      dispatchStatus,
      statusMessage,
    })
  }

  const currentRelayUrl = (await getCachedClubSetting('gmailRelayUrl', '')) || process.env.GMAIL_RELAY_URL || ''

  return response.status(200).json({
    mode,
    event,
    senderEmail: env.smtpUser || 'cyberclubmrdu2025@gmail.com',
    gmailRelayUrl: currentRelayUrl,
    totalCount: recipients.length,
    readyCount: recipients.filter(r => r.dispatchStatus === 'READY').length,
    emailNotGivenCount: recipients.filter(r => r.dispatchStatus === 'EMAIL_NOT_GIVEN').length,
    alreadySentCount: recipients.filter(r => r.dispatchStatus === 'ALREADY_SENT').length,
    waitingCount: recipients.filter(r => r.dispatchStatus === 'PASS_WAITING_VERIFICATION').length,
    noPassCount: recipients.filter(r => r.dispatchStatus === 'NO_PASS_ISSUED').length,
    notFoundCount: recipients.filter(r => ['ACCOUNT_NOT_FOUND', 'AMBIGUOUS_ROLL_NUMBER'].includes(r.dispatchStatus)).length,
    emailsLinkedCount,
    recipients,
  })
}

export async function sendEventPassEmails(request, response) {
  const { eventId } = request.params
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      eventType: true,
      dateTime: true,
      venue: true,
      location: true,
    },
  })
  if (!event) {
    return response.status(404).json({ message: 'Event not found.' })
  }

  // Allow saving/updating the HTTPS Gmail Relay URL right from the dispatch modal
  if (request.body?.gmailRelayUrl !== undefined) {
    const cleanRelay = String(request.body.gmailRelayUrl || '').trim()
    await prisma.clubSetting.upsert({
      where: { key: 'gmailRelayUrl' },
      create: { key: 'gmailRelayUrl', value: cleanRelay },
      update: { value: cleanRelay },
    })
    invalidatePlatformModeCache()
    if (request.body?.saveRelayOnly) {
      return response.status(200).json({
        success: true,
        gmailRelayUrl: cleanRelay,
        message: cleanRelay
          ? 'HTTPS Gmail Bridge URL saved and activated! All pass emails will now send over Port 443.'
          : 'HTTPS Gmail Bridge URL cleared.',
      })
    }
  }

  const globalCustomMessage = String(request.body?.customMessage || '').trim()
  const requestedRecipients = Array.isArray(request.body?.recipients) ? request.body.recipients : []

  if (requestedRecipients.length === 0) {
    return response.status(400).json({ message: 'No student recipients specified for email dispatch.' })
  }

  const regIds = requestedRecipients.map(r => r?.registrationId).filter(Boolean)
  const registrations = await prisma.eventRegistration.findMany({
    where: {
      eventId: event.id,
      ...(regIds.length > 0 ? { id: { in: regIds } } : {}),
      ...submittedRegistrationWhere(),
    },
  })
  const regById = new Map(registrations.map(r => [r.id, r]))

  const userIds = [...new Set(registrations.map(r => r.userId))]
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      memberId: true,
      role: true,
      profile: {
        select: {
          name: true,
          rollNumber: true,
          email: true,
          phone: true,
          department: true,
          year: true,
          gender: true,
          age: true,
        },
      },
    },
  })
  const userById = new Map(users.map(u => [u.id, u]))

  const sentList = []
  const alreadySentList = []
  const missingEmailList = []
  const skippedList = []
  const failedList = []

  for (const item of requestedRecipients) {
    const reg = item?.registrationId ? regById.get(item.registrationId) : null
    if (!reg) {
      skippedList.push({
        registrationId: item?.registrationId || null,
        rollNumber: item?.rollNumber || 'UNKNOWN',
        name: item?.name || 'Student',
        status: 'NO_PASS_ISSUED',
        message: 'No active event pass registration found for this student.',
      })
      continue
    }

    const u = userById.get(reg.userId)
    const formObj = (reg.formData && typeof reg.formData === 'object') ? reg.formData : {}
    const resolvedRoll = u?.profile?.rollNumber || formObj.rollNumber || u?.memberId || item?.rollNumber || 'STUDENT'
    const resolvedName = u?.profile?.name || formObj.fullName || formObj.name || item?.name || u?.memberId || 'Student'

    // 1. Duplicate Guard: blocked unless forceResend is explicitly requested
    const allowResend = Boolean(request.body?.forceResend || item?.forceResend)
    if (formObj.passEmailSentAt && !allowResend) {
      alreadySentList.push({
        registrationId: reg.id,
        rollNumber: resolvedRoll,
        name: resolvedName,
        email: formObj.passEmailSentTo || u?.profile?.email || formObj.email || null,
        emailSentAt: formObj.passEmailSentAt,
        status: 'ALREADY_SENT',
        message: `Already sent on ${new Date(formObj.passEmailSentAt).toLocaleString()} — duplicate email blocked (enable Re-send to send again).`,
      })
      continue
    }

    // 2. Must hold an active issued pass
    if (!hasActiveEventPass(reg)) {
      skippedList.push({
        registrationId: reg.id,
        rollNumber: resolvedRoll,
        name: resolvedName,
        status: 'PASS_NOT_ACTIVE',
        message: 'Student pass is not active/verified yet.',
      })
      continue
    }

    // 3. Resolve email (inline provided email > profile.email > formData.email)
    const inlineEmail = item?.email ? String(item.email).trim().toLowerCase() : ''
    const effectiveEmail = inlineEmail || (u?.profile?.email || formObj.email || '').trim().toLowerCase()

    if (!effectiveEmail) {
      missingEmailList.push({
        registrationId: reg.id,
        rollNumber: resolvedRoll,
        name: resolvedName,
        email: null,
        status: 'EMAIL_NOT_GIVEN',
        message: 'EMAIL NOT GIVEN — Student has not provided an email address.',
      })
      continue
    }

    if (!EMAIL_REGEX.test(effectiveEmail)) {
      failedList.push({
        registrationId: reg.id,
        rollNumber: resolvedRoll,
        name: resolvedName,
        email: effectiveEmail,
        status: 'INVALID_EMAIL',
        message: `Invalid email format: "${effectiveEmail}".`,
      })
      continue
    }

    // 4. If admin provided/updated the email inline or via Excel/CSV, link it to the student's profile
    if (inlineEmail && u && u.profile?.email !== inlineEmail) {
      try {
        await prisma.profile.upsert({
          where: { userId: u.id },
          update: { email: inlineEmail },
          create: {
            userId: u.id,
            rollNumber: resolvedRoll,
            name: resolvedName,
            email: inlineEmail,
            department: 'CSE',
            year: 1,
          },
        })
        if (u.profile) u.profile.email = inlineEmail
        authUserCache.invalidate(u.id)
      } catch {}
    }

    // 5. Ensure QR Code image exists on the active pass
    let qrCodeData = reg.qrCodeData
    if (!qrCodeData) {
      try {
        qrCodeData = await QRCode.toDataURL(`EVENT_PASS:${reg.id}`, {
          margin: 2,
          width: 300,
          color: { dark: '#000000', light: '#ffffff' },
        })
      } catch {}
    }

    const customMsgForStudent = (item?.customMessage && String(item.customMessage).trim()) || globalCustomMessage
    const isManualConfirm = Boolean(request.body?.manualConfirmOnly || item?.manualConfirmOnly)

    // 6. Dispatch email from cyberclubmrdu2025@gmail.com (or record manual Gmail web dispatch)
    try {
      if (!isManualConfirm) {
        await sendEventPassEmail({
          recipient: effectiveEmail,
          studentName: resolvedName,
          rollNumber: resolvedRoll,
          memberId: u?.memberId || resolvedRoll,
          eventTitle: event.title,
          eventType: event.eventType,
          eventDate: event.dateTime,
          venue: event.venue || event.location || 'MRDU Campus',
          passId: reg.id,
          qrCodeData,
          customMessage: customMsgForStudent,
        })
      }

      const sentAtIso = new Date().toISOString()
      const updatedFormObj = {
        ...formObj,
        email: effectiveEmail,
        passEmailSent: true,
        passEmailSentAt: sentAtIso,
        passEmailSentTo: effectiveEmail,
        passEmailSentBy: request.user.memberId,
        passEmailCustomMessage: customMsgForStudent || null,
      }

      await prisma.eventRegistration.update({
        where: { id: reg.id },
        data: {
          qrCodeData,
          formData: updatedFormObj,
        },
      })

      // Update local map so even if duplicate registrationId was passed in same array, it's blocked
      reg.formData = updatedFormObj

      createUserNotification({
        userId: reg.userId,
        type: 'PASS_EMAIL_SENT',
        title: `Pass Sent to Email: ${event.title}`,
        message: customMsgForStudent
          ? `${customMsgForStudent} (Sent to ${effectiveEmail})`
          : `Your official event pass for ${event.title} has been sent to ${effectiveEmail}.`,
        linkUrl: '/student-passes',
      }).catch(() => {})

      sentList.push({
        registrationId: reg.id,
        rollNumber: resolvedRoll,
        name: resolvedName,
        email: effectiveEmail,
        emailSentAt: sentAtIso,
        emailSentTo: effectiveEmail,
        status: 'SENT',
        message: `Pass email sent to ${effectiveEmail}.`,
      })
    } catch (mailErr) {
      failedList.push({
        registrationId: reg.id,
        rollNumber: resolvedRoll,
        name: resolvedName,
        email: effectiveEmail,
        status: 'SEND_ERROR',
        message: mailErr?.message || 'Failed to send email via SMTP server.',
      })
    }
  }

  await tryWriteAuditLog({
    actorUserId: request.user.id,
    action: 'EVENT_PASS_EMAILS_DISPATCHED',
    metadata: {
      eventId: event.id,
      eventTitle: event.title,
      sentCount: sentList.length,
      alreadySentCount: alreadySentList.length,
      missingEmailCount: missingEmailList.length,
      failedCount: failedList.length,
    },
    ...auditRequest(request),
  })

  // Build clear human-readable summary message without hiding any status
  const summaryParts = []
  if (sentList.length > 0) summaryParts.push(`${sentList.length} pass email(s) sent from ${env.smtpUser || 'cyberclubmrdu2025@gmail.com'}`)
  if (missingEmailList.length > 0) summaryParts.push(`${missingEmailList.length} student(s) skipped (EMAIL NOT GIVEN)`)
  if (alreadySentList.length > 0) summaryParts.push(`${alreadySentList.length} student(s) skipped (ALREADY SENT — no duplicate)`)
  if (skippedList.length > 0) summaryParts.push(`${skippedList.length} student(s) skipped (no active pass)`)
  if (failedList.length > 0) summaryParts.push(`${failedList.length} failed (${failedList[0]?.message || 'SMTP error'})`)

  const isSingle = requestedRecipients.length === 1
  if (isSingle && sentList.length === 0) {
    const singleIssue =
      missingEmailList[0]?.message ||
      alreadySentList[0]?.message ||
      failedList[0]?.message ||
      skippedList[0]?.message ||
      'Could not send pass email.'
    return response.status(400).json({
      success: false,
      message: singleIssue,
      sentCount: 0,
      alreadySentCount: alreadySentList.length,
      missingEmailCount: missingEmailList.length,
      failedCount: failedList.length,
      sent: sentList,
      alreadySent: alreadySentList,
      missingEmail: missingEmailList,
      skipped: skippedList,
      failed: failedList,
    })
  }

  return response.status(200).json({
    success: sentList.length > 0 || (failedList.length === 0 && missingEmailList.length === 0),
    message: summaryParts.join(' · ') || 'No emails were dispatched.',
    senderEmail: env.smtpUser || 'cyberclubmrdu2025@gmail.com',
    sentCount: sentList.length,
    alreadySentCount: alreadySentList.length,
    missingEmailCount: missingEmailList.length,
    skippedCount: skippedList.length,
    failedCount: failedList.length,
    sent: sentList,
    alreadySent: alreadySentList,
    missingEmail: missingEmailList,
    skipped: skippedList,
    failed: failedList,
  })
}

export async function deleteEvent(request, response) {
  const event = await prisma.event.findUnique({ where: { id: request.params.eventId } })
  if (!event) return response.status(404).json({ message: 'Event not found' })

  await prisma.event.delete({ where: { id: request.params.eventId } })
  await tryWriteAuditLog({ actorUserId: request.user.id, action: 'EVENT_DELETED', metadata: { eventId: event.id, title: event.title }, ...auditRequest(request) })
  return response.status(204).end()
}



export async function listEventRegistrations(request, response) {
  return getEventDetailsWithStats(request, response)
}

export async function exportEventRegistrationsCsv(request, response) {
  const event = await prisma.event.findUnique({
    where: { id: request.params.eventId },
    include: { registrations: { where: submittedRegistrationWhere(), orderBy: { registeredAt: 'desc' } } },
  })
  if (!event) return response.status(404).json({ message: 'Event not found' })

  const userIds = event.registrations.map(r => r.userId)
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    include: { profile: true },
  })
  const userMap = new Map(users.map(u => [u.id, u]))

  const rows = [
    [
      'Registration ID',
      'Member ID',
      'Full Name',
      'Roll Number',
      'College / Institution',
      'Department / Branch',
      'Academic Year',
      'Gender',
      'Age',
      'Official Email',
      'Phone Number',
      'Emergency Contact',
      'Residency Type',
      'Commute / Hostel Mode',
      'Participation Mode',
      'Team Name',
      'Is Team Leader',
      'Selected Activities',
      'Payment Option / Tier',
      'Expected Fee (₹)',
      'Amount Paid (₹)',
      'Payment Status',
      'Payment UTR Reference',
      'Payment Rejection Reason',
      'Payment Proof URL',
      'GitHub Project Link',
      'Live Website Demo',
      'Google Drive Link',
      'Project Submission Notes',
      'Custom Question Answers',
      'Gate Attendance',
      'Check-in Timestamp',
      'Registration Date',
    ].map(fmt),
  ]

  event.registrations.forEach(reg => {
    const u = userMap.get(reg.userId)
    const activitiesStr = Array.isArray(reg.selectedActivities) ? reg.selectedActivities.map(a => a.name).join('; ') : ''
    const paymentTierStr = reg.paymentOption?.name || (typeof reg.paymentOption === 'string' ? reg.paymentOption : '')
    const projectSub = (typeof reg.projectSubmission === 'object' && reg.projectSubmission) || {}
    const customAnswersStr = reg.formData?.customAnswers ? JSON.stringify(reg.formData.customAnswers) : ''

    rows.push([
      reg.id,
      u?.memberId,
      u?.profile?.name || u?.memberId,
      u?.profile?.rollNumber || reg.formData?.rollNumber,
      u?.profile?.department,
      reg.branch || u?.profile?.department,
      reg.year || u?.profile?.year,
      reg.gender || u?.profile?.gender,
      reg.age || u?.profile?.age,
      u?.profile?.email,
      u?.profile?.phone,
      reg.emergencyContact,
      reg.residencyType,
      reg.residencyType === 'HOSTELLER' ? reg.hostelType : reg.transportMode,
      reg.teamName ? 'Team' : 'Individual',
      reg.teamName,
      reg.isTeamLeader ? 'Yes' : 'No',
      activitiesStr,
      paymentTierStr,
      Number(reg.totalAmount) || 0,
      reg.amountPaid !== null ? Number(reg.amountPaid) : '',
      reg.paymentStatus,
      reg.paymentReference,
      reg.paymentRejectionReason,
      reg.paymentProofUrl,
      projectSub.githubUrl || reg.github,
      projectSub.websiteUrl,
      projectSub.driveUrl,
      projectSub.notes,
      customAnswersStr,
      reg.attendanceMarked ? 'Admitted / Present' : 'Not Admitted',
      reg.attendedAt ? new Date(reg.attendedAt).toLocaleString() : null,
      new Date(reg.registeredAt).toLocaleString(),
    ].map(fmt))
  })

  const csvContent = '\uFEFF' + rows.map(r => r.join(',')).join('\r\n')
  response.setHeader('Content-Type', 'text/csv; charset=utf-8')
  response.setHeader('Content-Disposition', `attachment; filename="event_${event.id}_registrations.csv"`)
  return response.status(200).send(csvContent)
}

export async function exportMembersCsv(request, response) {
  const members = await prisma.user.findMany({
    include: { profile: true },
    orderBy: [{ role: 'asc' }, { memberId: 'asc' }],
  })

  const rows = [
    ['Member ID', 'Full Name', 'Role', 'Roll Number', 'Department / Branch', 'Academic Year', 'Email', 'Phone', 'Account Status', 'Two Factor Enabled', 'Joined Date'].map(fmt),
  ]

  members.forEach(m => {
    rows.push([
      m.memberId,
      m.profile?.name || m.name,
      m.role,
      m.profile?.rollNumber,
      m.profile?.department,
      m.profile?.year,
      m.profile?.email || m.email,
      m.profile?.phone || m.phone,
      m.accountStatus,
      m.twoFactorEnabled ? 'Enabled' : 'Disabled',
      m.createdAt ? new Date(m.createdAt).toLocaleDateString() : '---',
    ].map(fmt))
  })

  const csvContent = '\uFEFF' + rows.map(r => r.join(',')).join('\r\n')
  response.setHeader('Content-Type', 'text/csv; charset=utf-8')
  response.setHeader('Content-Disposition', 'attachment; filename="club_members_roster.csv"')
  return response.status(200).send(csvContent)
}

export async function listPayments(request, response) {
  const registrations = await prisma.eventRegistration.findMany({
    where: submittedRegistrationWhere({
      paymentStatus: { in: ['SUBMITTED', 'PENDING', 'UNDER_VERIFICATION', 'VERIFIED', 'REJECTED', 'PAYMENT_REJECTED', 'REFUNDED'] },
    }),
    include: { event: true },
    orderBy: { registeredAt: 'desc' },
  })

  const userIds = registrations.map(r => r.userId)
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    include: { profile: true },
  })
  const userMap = new Map(users.map(u => [u.id, u]))

  const list = registrations.map(reg => {
    const u = userMap.get(reg.userId)
    return {
      ...reg,
      totalAmount: Number(reg.totalAmount),
      memberName: u?.profile?.name || u?.memberId,
      memberId: u?.memberId,
      email: u?.profile?.email,
      phone: u?.profile?.phone,
    }
  })

  return response.status(200).json({ payments: list })
}

export async function verifyPayment(request, response) {
  const registration = await prisma.eventRegistration.findUnique({
    where: { id: request.params.registrationId },
    include: { event: true },
  })
  if (!registration) return response.status(404).json({ message: 'Registration not found' })

  const parsed = paymentVerificationSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ message: 'Invalid payment verification payload.' })
  const paymentStatus = parsed.data.paymentStatus
  const paymentNotes = parsed.data.paymentNotes || null
  const isSubmittingForReview = ['PENDING', 'SUBMITTED'].includes(paymentStatus)

  if (paymentStatus === 'VERIFIED' || paymentStatus === 'REJECTED') {
    if (!isPaymentAwaitingReview(registration)) {
      return response.status(409).json({ message: 'Only a paid registration currently awaiting UTR review can be verified or rejected.' })
    }
  } else if (isSubmittingForReview) {
    if (!isRejectedPayment(registration)) {
      return response.status(409).json({ message: 'Only a rejected paid registration can be returned to UTR review.' })
    }
  } else if (paymentStatus === 'REFUNDED' && String(registration.paymentStatus || '').toUpperCase() !== 'VERIFIED') {
    return response.status(409).json({ message: 'Only a verified payment can be marked as refunded.' })
  }

  const nextPaymentStatus = isSubmittingForReview ? 'UNDER_VERIFICATION' : paymentStatus
  const nextRegistrationStatus = nextPaymentStatus === 'VERIFIED'
    ? 'REGISTERED'
    : nextPaymentStatus === 'REJECTED'
      ? 'PAYMENT_REJECTED'
      : nextPaymentStatus === 'REFUNDED'
        ? 'REFUNDED'
        : 'UNDER_VERIFICATION'
  const updatedAt = new Date()
  const transition = await prisma.$transaction(async tx => {
    const allowedPaymentStatuses = paymentStatus === 'VERIFIED' || paymentStatus === 'REJECTED'
      ? ['PENDING', 'SUBMITTED', 'UNDER_VERIFICATION']
      : isSubmittingForReview
        ? ['REJECTED', 'PAYMENT_REJECTED']
        : ['VERIFIED']

    const changed = await tx.eventRegistration.updateMany({
      where: {
        id: registration.id,
        paymentStatus: { in: allowedPaymentStatuses },
        totalAmount: { gt: 0 },
        paymentReference: { not: '' },
        status: { not: 'DRAFT' },
      },
      data: {
        paymentStatus: nextPaymentStatus,
        status: nextRegistrationStatus,
        amountPaid: nextPaymentStatus === 'VERIFIED' ? registration.totalAmount : null,
        paymentVerifiedAt: nextPaymentStatus === 'VERIFIED' ? updatedAt : null,
        paymentVerifiedBy: nextPaymentStatus === 'VERIFIED' ? request.user.id : null,
        paymentNotes,
        paymentRejectionReason: nextPaymentStatus === 'REJECTED' ? paymentNotes : null,
        ...(nextPaymentStatus !== 'VERIFIED' ? { qrCodeData: null } : {}),
      },
    })
    if (changed.count !== 1) return { conflict: true }

    if (registration.teamId) {
      await tx.eventRegistration.updateMany({
        where: {
          teamId: registration.teamId,
          id: { not: registration.id },
          status: { not: 'DRAFT' },
        },
        data: {
          paymentStatus: nextPaymentStatus,
          status: nextRegistrationStatus,
          amountPaid: null,
          paymentVerifiedAt: nextPaymentStatus === 'VERIFIED' ? updatedAt : null,
          paymentVerifiedBy: nextPaymentStatus === 'VERIFIED' ? request.user.id : null,
          paymentNotes,
          paymentRejectionReason: nextPaymentStatus === 'REJECTED' ? paymentNotes : null,
          ...(nextPaymentStatus !== 'VERIFIED' ? { qrCodeData: null } : {}),
        },
      })
    }

    return { registration: await tx.eventRegistration.findUnique({ where: { id: registration.id } }) }
  })
  if (transition.conflict) {
    return response.status(409).json({ message: 'This payment was already reviewed. Refresh the roster before taking another action.' })
  }

  const updated = transition.registration
  createUserNotification({
    userId: registration.userId,
    type: `PAYMENT_${nextPaymentStatus}`,
    title: `${nextPaymentStatus === 'VERIFIED' ? 'Payment Verified' : nextPaymentStatus === 'REJECTED' ? 'Payment Rejected' : nextPaymentStatus === 'REFUNDED' ? 'Payment Refunded' : 'Payment Returned to Review'}: ${registration.event?.title || 'Event Pass'}`,
    message: nextPaymentStatus === 'VERIFIED'
      ? `Your payment of ₹${Number(registration.totalAmount)} (Ref: ${registration.paymentReference}) was verified. Your digital event pass is active.`
      : nextPaymentStatus === 'REJECTED'
        ? `Your payment could not be verified. ${paymentNotes || 'Please contact the event organizer.'}`
        : nextPaymentStatus === 'REFUNDED'
          ? 'Your event payment has been marked as refunded.'
          : 'Your rejected payment was returned to the organizer review queue.',
    linkUrl: '/student-passes',
  }).catch(() => {})

  await tryWriteAuditLog({
    actorUserId: request.user.id,
    action: `PAYMENT_${nextPaymentStatus}`,
    targetUserId: registration.userId,
    metadata: { registrationId: registration.id, eventId: registration.eventId, paymentStatus: nextPaymentStatus },
    ...auditRequest(request),
  })

  await prisma.paymentVerificationLog.create({
    data: {
      id: newId(),
      registrationId: registration.id,
      adminId: request.user.id,
      adminName: request.user.profile?.name || request.user.memberId,
      action: nextPaymentStatus,
      amount: registration.totalAmount,
      utr: registration.paymentReference,
      reason: paymentNotes,
    },
  }).catch(() => {})

  return response.status(200).json({ registration: { ...updated, totalAmount: Number(updated.totalAmount) } })
}

export async function listAuditLogs(request, response) {
  const auditLogs = await prisma.auditLog.findMany({
    take: 200,
    orderBy: { createdAt: 'desc' },
    include: {
      actor: {
        select: {
          id: true,
          memberId: true,
          role: true,
          isPrimaryAdmin: true,
          profile: {
            select: {
              name: true,
              rollNumber: true,
              department: true,
              year: true,
            },
          },
        },
      },
      target: {
        select: {
          id: true,
          memberId: true,
          role: true,
          isPrimaryAdmin: true,
          profile: {
            select: {
              name: true,
              rollNumber: true,
              department: true,
              year: true,
            },
          },
        },
      },
    },
  })
  return response.status(200).json({ auditLogs })
}

export async function listComplaints(request, response) {
  const complaints = await prisma.complaint.findMany({
    include: { user: { include: { profile: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return response.status(200).json({ complaints })
}

export async function updateComplaintStatus(request, response) {
  const status = String(request.body?.status || '').trim().toUpperCase()
  if (!['OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED'].includes(status)) {
    return response.status(400).json({ message: 'Invalid complaint status.' })
  }
  const complaint = await prisma.complaint.update({
    where: { id: request.params.complaintId },
    data: { status },
  })
  await tryWriteAuditLog({ actorUserId: request.user.id, action: 'COMPLAINT_STATUS_UPDATED', metadata: { complaintId: complaint.id, status }, ...auditRequest(request) })
  return response.status(200).json({ complaint })
}

export async function listGalleryAlbums(request, response) {
  const albums = await prisma.galleryAlbum.findMany({ include: { photos: true }, orderBy: { createdAt: 'desc' } })
  return response.status(200).json({ albums })
}

export async function createGalleryAlbum(request, response) {
  const parsed = galleryAlbumSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ message: parsed.error.issues[0]?.message || 'Enter valid album details.' })
  const album = await prisma.galleryAlbum.create({ data: { id: newId(), ...parsed.data }, include: { photos: true } })
  await tryWriteAuditLog({ actorUserId: request.user.id, action: 'GALLERY_ALBUM_CREATED', metadata: { albumId: album.id, name: album.name }, ...auditRequest(request) })
  return response.status(201).json({ album })
}

export async function addGalleryPhoto(request, response) {
  const album = await prisma.galleryAlbum.findUnique({ where: { id: request.params.albumId } })
  if (!album) return response.status(404).json({ message: 'Album not found.' })

  // Handle batch photos upload: { photos: [{ imageUrl, caption }, ...] }
  if (Array.isArray(request.body.photos)) {
    const parsed = galleryPhotosBatchSchema.safeParse(request.body)
    if (!parsed.success) {
      return response.status(400).json({ message: parsed.error.issues[0]?.message || 'Upload valid photos.' })
    }

    const createdPhotos = []
    for (const photoItem of parsed.data.photos) {
      const created = await prisma.galleryPhoto.create({
        data: {
          id: newId(),
          albumId: album.id,
          imageUrl: photoItem.imageUrl,
          caption: photoItem.caption || null,
        },
      })
      createdPhotos.push(created)
    }

    if (!album.coverImage && createdPhotos.length > 0) {
      await prisma.galleryAlbum.update({
        where: { id: album.id },
        data: { coverImage: createdPhotos[0].imageUrl },
      })
    }

    await tryWriteAuditLog({
      actorUserId: request.user.id,
      action: 'GALLERY_PHOTOS_BATCH_ADDED',
      metadata: { albumId: album.id, count: createdPhotos.length },
      ...auditRequest(request),
    })

    return response.status(201).json({ photos: createdPhotos, count: createdPhotos.length, photo: createdPhotos[0] })
  }

  // Handle single photo upload: { imageUrl, caption }
  const parsed = galleryPhotoSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ message: parsed.error.issues[0]?.message || 'Upload a valid photo.' })

  const photo = await prisma.galleryPhoto.create({
    data: { id: newId(), albumId: album.id, ...parsed.data },
  })
  if (!album.coverImage) {
    await prisma.galleryAlbum.update({ where: { id: album.id }, data: { coverImage: photo.imageUrl } })
  }
  await tryWriteAuditLog({ actorUserId: request.user.id, action: 'GALLERY_PHOTO_ADDED', metadata: { albumId: album.id, photoId: photo.id }, ...auditRequest(request) })
  return response.status(201).json({ photo, photos: [photo], count: 1 })
}

export async function deleteGalleryAlbum(request, response) {
  const album = await prisma.galleryAlbum.findUnique({ where: { id: request.params.albumId } })
  if (!album) return response.status(404).json({ message: 'Album not found.' })
  await prisma.galleryAlbum.delete({ where: { id: album.id } })
  await tryWriteAuditLog({ actorUserId: request.user.id, action: 'GALLERY_ALBUM_DELETED', metadata: { albumId: album.id, name: album.name }, ...auditRequest(request) })
  return response.status(204).end()
}

export async function deleteGalleryPhoto(request, response) {
  const { albumId, photoId } = request.params
  const photo = await prisma.galleryPhoto.findFirst({
    where: { id: photoId, albumId },
  })
  if (!photo) return response.status(404).json({ message: 'Photo not found.' })

  await prisma.galleryPhoto.delete({ where: { id: photo.id } })

  const album = await prisma.galleryAlbum.findUnique({
    where: { id: albumId },
    include: { photos: { take: 1 } },
  })
  if (album && album.coverImage === photo.imageUrl) {
    const nextCover = album.photos[0]?.imageUrl || null
    await prisma.galleryAlbum.update({
      where: { id: album.id },
      data: { coverImage: nextCover },
    })
  }

  await tryWriteAuditLog({
    actorUserId: request.user.id,
    action: 'GALLERY_PHOTO_DELETED',
    metadata: { albumId, photoId },
    ...auditRequest(request),
  })

  return response.status(204).end()
}

const ROLE_PRIORITY_MAP = {
  FACULTY: 1,
  CONVENER: 2,
  CO_CONVENER: 3,
  PRESIDENT: 4,
  VICE_PRESIDENT: 5,
  STUDENT_COORDINATOR: 6,
  TECH_TEAM: 7,
  EVENT_MANAGEMENT: 8,
  TREASURER: 9,
  SECRETARY: 10,
  MEDIA_LEAD: 11,
  SOCIAL_MEDIA_LEAD: 12,
  PR_TEAM: 13,
  CULTURAL: 14,
  ADMIN: 15,
}

const ROLE_DISPLAY_TITLES = {
  FACULTY: 'Faculty Coordinator',
  CONVENER: 'Convener',
  CO_CONVENER: 'Co-Convener',
  PRESIDENT: 'President',
  VICE_PRESIDENT: 'Vice President',
  STUDENT_COORDINATOR: 'Student Coordinator',
  TECH_TEAM: 'Tech Team Lead',
  EVENT_MANAGEMENT: 'Event Management Lead',
  TREASURER: 'Treasurer Lead',
  SECRETARY: 'Secretary Lead',
  MEDIA_LEAD: 'Media Lead',
  SOCIAL_MEDIA_LEAD: 'Social Media Lead',
  PR_TEAM: 'PR Team Lead',
  CULTURAL: 'Cultural Lead',
  ADMIN: 'Platform Administrator',
}

export async function syncLeadersFromAccounts() {
  try {
    const leaders = await prisma.user.findMany({
      where: {
        role: { not: 'STUDENT' },
        accountStatus: 'ACTIVE',
      },
      include: { profile: true },
      orderBy: { createdAt: 'asc' },
    })

    for (const leader of leaders) {
      const priority = ROLE_PRIORITY_MAP[leader.role] || 99
      const roleTitle = ROLE_DISPLAY_TITLES[leader.role] || leader.role
      const name = leader.profile?.name || leader.memberId
      const collegeEmail = leader.profile?.email || null
      const bio = leader.profile?.bio || `Council leadership member · ${roleTitle}`
      const photoUrl = leader.profile?.profileImage || null
      const instagramUrl = leader.profile?.instagramUrl || null
      const linkedinUrl = leader.profile?.linkedinUrl || null
      const githubUrl = leader.profile?.githubUrl || null

      const existing = await prisma.clubTeamMember.findFirst({
        where: {
          OR: [
            collegeEmail ? { collegeEmail } : undefined,
            { name },
          ].filter(Boolean),
        },
      })

      if (existing) {
        await prisma.clubTeamMember.update({
          where: { id: existing.id },
          data: {
            name,
            roleTitle: existing.roleTitle || roleTitle,
            sortOrder: priority,
            bio: leader.profile?.bio || existing.bio || bio,
            photoUrl: photoUrl || existing.photoUrl,
            instagramUrl: instagramUrl || existing.instagramUrl,
            linkedinUrl: linkedinUrl || existing.linkedinUrl,
            githubUrl: githubUrl || existing.githubUrl,
          },
        })
      } else {
        await prisma.clubTeamMember.create({
          data: {
            id: newId(),
            name,
            roleTitle,
            sortOrder: priority,
            collegeEmail,
            bio,
            photoUrl,
            instagramUrl,
            linkedinUrl,
            githubUrl,
          },
        })
      }
    }
  } catch (err) {
    console.error('Error syncing leaders from accounts:', err)
  }
}

export async function listClubTeam(request, response) {
  let team = await prisma.clubTeamMember.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] })
  if (team.length === 0) {
    await syncLeadersFromAccounts()
    team = await prisma.clubTeamMember.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] })
  }
  return response.status(200).json({ team })
}

export async function syncClubTeamFromAccounts(request, response) {
  await syncLeadersFromAccounts()
  const team = await prisma.clubTeamMember.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] })
  return response.status(200).json({ message: 'Leadership team synced successfully from account directory.', team })
}

export async function createClubTeamMember(request, response) {
  const parsed = clubTeamMemberSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ message: parsed.error.issues[0]?.message || 'Enter valid team member details.' })
  const member = await prisma.clubTeamMember.create({ data: { id: newId(), sortOrder: parsed.data.sortOrder ?? 0, ...parsed.data } })
  await tryWriteAuditLog({ actorUserId: request.user.id, action: 'CLUB_TEAM_MEMBER_ADDED', metadata: { memberId: member.id, name: member.name }, ...auditRequest(request) })
  return response.status(201).json({ member })
}

export async function updateClubTeamMember(request, response) {
  const parsed = clubTeamMemberSchema.partial().safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ message: parsed.error.issues[0]?.message || 'Enter valid team member details.' })
  const member = await prisma.clubTeamMember.findUnique({ where: { id: request.params.memberId } })
  if (!member) return response.status(404).json({ message: 'Team member not found.' })

  const updated = await prisma.clubTeamMember.update({
    where: { id: member.id },
    data: parsed.data,
  })
  return response.status(200).json({ member: updated })
}

export async function deleteClubTeamMember(request, response) {
  const member = await prisma.clubTeamMember.findUnique({ where: { id: request.params.memberId } })
  if (!member) return response.status(404).json({ message: 'Team member not found.' })
  await prisma.clubTeamMember.delete({ where: { id: member.id } })
  await tryWriteAuditLog({ actorUserId: request.user.id, action: 'CLUB_TEAM_MEMBER_REMOVED', metadata: { memberId: member.id, name: member.name }, ...auditRequest(request) })
  return response.status(204).end()
}

export async function reorderClubTeam(request, response) {
  const { orderedIds } = request.body
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return response.status(400).json({ message: 'Invalid orderedIds array.' })
  }

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.clubTeamMember.update({
        where: { id },
        data: { sortOrder: index + 1 },
      })
    )
  )

  const updatedTeam = await prisma.clubTeamMember.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })

  await tryWriteAuditLog({
    actorUserId: request.user.id,
    action: 'CLUB_TEAM_REORDERED',
    metadata: { count: orderedIds.length },
    ...auditRequest(request),
  })

  return response.status(200).json({ team: updatedTeam })
}

export async function getClubSettings(request, response) {
  const dictionary = await getCachedClubSettingsDictionary()
  return response.status(200).json({ settings: dictionary })
}

export async function updateClubSettings(request, response) {
  const parsed = clubSettingsSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ message: 'Invalid settings payload.' })

  const globalPresidentKeys = [
    'platformMode',
    'siteStatus',
    'hibernationStartedAt',
    'subscriptionEnabled',
    'subscriptionMonthlyAmount',
    'subscriptionUpiId',
    'subscriptionQrUrl',
    'reelsEnabled',
    'introVideoEnabled',
    'introVideoUrl',
    'introVideoRequireTwoMinutes',
    'onboardingBriefingMode',
    'introBriefingMode',
    'queueEnabled',
    'queueMaxConcurrent',
    'queueWaitTimeSeconds',
  ]

  const hasGlobalKey = Object.keys(parsed.data).some(k => globalPresidentKeys.includes(k) && parsed.data[k] !== undefined)
  if (hasGlobalKey && !request.user.isPrimaryAdmin) {
    return response.status(403).json({ message: 'Only the Primary President can modify global site, platform mode, subscription, or video settings.' })
  }

  // If site status is being changed to HIBERNATING, record the timestamp if not already provided; clear if waking up
  if (parsed.data.siteStatus === 'HIBERNATING' && !parsed.data.hibernationStartedAt) {
    parsed.data.hibernationStartedAt = new Date().toISOString()
  } else if (parsed.data.siteStatus === 'ACTIVE') {
    parsed.data.hibernationStartedAt = ''
  }

  const entries = Object.entries(parsed.data)
  for (const [key, val] of entries) {
    if (val !== undefined) {
      const stringValue = typeof val === 'object' ? JSON.stringify(val) : String(val ?? '')
      await prisma.clubSetting.upsert({
        where: { key },
        create: { key, value: stringValue },
        update: { value: stringValue },
      })
    }
  }

  invalidatePlatformModeCache()

  await tryWriteAuditLog({ actorUserId: request.user.id, action: 'CLUB_SETTINGS_UPDATED', metadata: { keys: Object.keys(parsed.data) }, ...auditRequest(request) })
  return response.status(200).json({ message: 'Club settings updated successfully.', settings: parsed.data })
}

// ----------------------------------------------------
// 2FA Admin Deactivation Tool
// ----------------------------------------------------
export async function disableMemberTwoFactor(request, response) {
  const { id } = request.params
  const target = await prisma.user.findUnique({ where: { id }, include: { profile: true } })
  if (!target) return response.status(404).json({ message: 'Member not found.' })

  if (target.isPrimaryAdmin && target.id !== request.user.id) {
    return response.status(403).json({ message: 'Access Denied: The Primary President 2FA security cannot be altered by other administrators.' })
  }

  await prisma.user.update({
    where: { id },
    data: {
      totpEnabled: false,
      totpSecretEncrypted: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  })

  await tryWriteAuditLog({
    actorUserId: request.user.id,
    targetUserId: id,
    action: 'MEMBER_2FA_DISABLED_BY_ADMIN',
    metadata: { targetMemberId: target.memberId, targetName: target.profile?.name },
    ...auditRequest(request),
  })

  return response.status(200).json({ message: `Two-factor authentication disabled for ${target.profile?.name || target.memberId}.` })
}

// ----------------------------------------------------
// Primary President Dual 6-Digit Master PIN Lock
// ----------------------------------------------------
export async function setPresidentMasterPin(request, response) {
  if (!request.user.isPrimaryAdmin) {
    return response.status(403).json({ message: 'Only the Primary President can configure the Master Security PIN.' })
  }

  const { pin, password } = request.body || {}
  if (!pin || !/^\d{6}$/.test(String(pin))) {
    return response.status(400).json({ message: 'Master Security PIN must be exactly 6 digits (numbers only).' })
  }

  const president = await prisma.user.findUnique({ where: { id: request.user.id } })
  if (password) {
    const passwordValid = await bcrypt.compare(String(password), president.passwordHash)
    if (!passwordValid) {
      return response.status(401).json({ message: 'Current password verification failed.' })
    }
  }

  const masterPinHash = await bcrypt.hash(String(pin), env.bcryptRounds)
  await prisma.user.update({
    where: { id: request.user.id },
    data: { masterSecurityPinHash: masterPinHash },
  })

  await tryWriteAuditLog({
    actorUserId: request.user.id,
    action: 'PRESIDENT_MASTER_PIN_UPDATED',
    ...auditRequest(request),
  })

  return response.status(200).json({ message: 'Master 6-Digit Security PIN configured successfully.' })
}

// ----------------------------------------------------
// Customer Support / Student Doubts Management
// ----------------------------------------------------
export async function listAdminSupportTickets(request, response) {
  const isPresident = request.user.isPrimaryAdmin || request.user.role === 'PRESIDENT'
  const where = isPresident ? {} : { taggedRole: request.user.role }

  const tickets = await prisma.supportTicket.findMany({
    where,
    include: {
      user: { include: { profile: true } },
      replies: {
        include: {
          user: { include: { profile: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return response.status(200).json({ tickets })
}

export async function replyAdminSupportTicket(request, response) {
  const { id } = request.params
  const { message, status } = request.body || {}

  if (!message || !String(message).trim()) {
    return response.status(400).json({ message: 'Reply message cannot be empty.' })
  }

  const ticket = await prisma.supportTicket.findUnique({ where: { id }, include: { user: true } })
  if (!ticket) return response.status(404).json({ message: 'Support query ticket not found.' })

  // Strict Role-Restricted Answering Rule: Only tagged role and President can reply
  const isPresident = request.user.isPrimaryAdmin || request.user.role === 'PRESIDENT'
  const isTaggedRole = request.user.role === ticket.taggedRole

  if (!isPresident && !isTaggedRole) {
    return response.status(403).json({
      message: `Only authorized members of the tagged role (${ticket.taggedRole}) and the President can respond to this inquiry.`,
    })
  }

  const reply = await prisma.supportReply.create({
    data: {
      ticketId: id,
      userId: request.user.id,
      message: String(message).trim(),
    },
    include: {
      user: { include: { profile: true } },
    },
  })

  const nextStatus = status || (ticket.status === 'OPEN' ? 'IN_PROGRESS' : ticket.status)
  await prisma.supportTicket.update({
    where: { id },
    data: { status: nextStatus },
  })

  // Send in-app notification to the student
  await prisma.notification.create({
    data: {
      userId: ticket.userId,
      type: 'SUPPORT_REPLY',
      title: `💬 New reply on your query: "${ticket.subject}"`,
      message: `${request.user.profile?.name || request.user.memberId} (${request.user.role}) answered your question.`,
      linkUrl: '/student-support',
    },
  }).catch(() => {})

  return response.status(201).json({ reply, status: nextStatus })
}

export async function updateSupportTicketStatus(request, response) {
  const { id } = request.params
  const { status } = request.body || {}

  if (!['OPEN', 'IN_PROGRESS', 'RESOLVED'].includes(status)) {
    return response.status(400).json({ message: 'Invalid status. Must be OPEN, IN_PROGRESS, or RESOLVED.' })
  }

  const updated = await prisma.supportTicket.update({
    where: { id },
    data: { status },
  })

  return response.status(200).json({ ticket: updated })
}

// ----------------------------------------------------
// Clear Audit Logs (Primary President Only)
// ----------------------------------------------------
export async function clearAuditLogs(request, response) {
  if (!request.user.isPrimaryAdmin) {
    return response.status(403).json({ message: 'Only the Primary President is authorized to clear security audit logs.' })
  }

  const { authCode } = request.body || {}
  if (!authCode) {
    return response.status(400).json({ message: 'Please enter your Master Security PIN or Password to confirm.' })
  }

  const president = await prisma.user.findUnique({ where: { id: request.user.id } })
  let valid = false

  if (president.masterSecurityPinHash) {
    valid = await bcrypt.compare(String(authCode), president.masterSecurityPinHash)
  }
  if (!valid && president.passwordHash) {
    valid = await bcrypt.compare(String(authCode), president.passwordHash)
  }

  if (!valid) {
    return response.status(401).json({ message: 'Authentication failed. Invalid Master Security PIN or Password.' })
  }

  // Delete all existing logs
  await prisma.auditLog.deleteMany()

  // Record a single fresh audit log
  await tryWriteAuditLog({
    actorUserId: request.user.id,
    action: 'AUDIT_LOG_PURGED_BY_PRIMARY_PRESIDENT',
    metadata: {
      purgedBy: request.user.memberId,
      timestamp: new Date().toISOString(),
    },
    ...auditRequest(request),
  })

  return response.status(200).json({ message: 'Security audit logs cleared successfully.' })
}

// ----------------------------------------------------
// Executive Council Chat Room (Leads Only)
// ----------------------------------------------------
export async function listCouncilMessages(request, response) {
  const messages = await prisma.councilMessage.findMany({
    include: {
      user: {
        include: { profile: true },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: 100,
  })

  return response.status(200).json({ messages })
}

export async function sendCouncilMessage(request, response) {
  const { message } = request.body || {}
  if (!message || !String(message).trim()) {
    return response.status(400).json({ message: 'Message text cannot be empty.' })
  }

  const created = await prisma.councilMessage.create({
    data: {
      userId: request.user.id,
      message: String(message).trim(),
    },
    include: {
      user: {
        include: { profile: true },
      },
    },
  })

  return response.status(201).json({ message: created })
}

export async function deleteCouncilMessage(request, response) {
  const { id } = request.params
  const message = await prisma.councilMessage.findUnique({ where: { id } })
  if (!message) {
    return response.status(404).json({ message: 'Council message not found.' })
  }

  const isAuthor = message.userId === request.user.id
  const isPresident = request.user.isPrimaryAdmin || request.user.role === 'PRESIDENT'

  if (!isAuthor && !isPresident) {
    return response.status(403).json({ message: 'You can only delete your own council messages.' })
  }

  await prisma.councilMessage.delete({ where: { id } })

  await tryWriteAuditLog({
    actorUserId: request.user.id,
    action: 'COUNCIL_MESSAGE_DELETED',
    metadata: { messageId: id, authorUserId: message.userId, isPresidentModerator: isPresident && !isAuthor },
    ...auditRequest(request),
  })

  return response.status(200).json({ message: 'Message deleted successfully.', id })
}

// ----------------------------------------------------
// One-Click Full Database Backup (.sql)
// ----------------------------------------------------
export async function exportDatabaseSql(request, response) {
  const { password } = request.body || {}

  if (!request.user.isPrimaryAdmin && request.user.role !== 'PRESIDENT' && request.user.role !== 'ADMIN') {
    return response.status(403).json({ message: 'Access Denied: Only the President or Admin can export complete database dumps.' })
  }

  if (password) {
    const president = await prisma.user.findUnique({ where: { id: request.user.id } })
    if (!president) {
      return response.status(403).json({ message: 'Access Denied: Account not found.' })
    }
    let isPasswordValid = await bcrypt.compare(String(password), president.passwordHash)
    if (!isPasswordValid && president.masterSecurityPinHash) {
      isPasswordValid = await bcrypt.compare(String(password), president.masterSecurityPinHash)
    }
    if (!isPasswordValid) {
      await tryWriteAuditLog({
        actorUserId: request.user.id,
        action: 'DATABASE_EXPORT_REJECTED_INVALID_PASSWORD',
        metadata: { memberId: request.user.memberId, ip: request.ip },
        ...auditRequest(request),
      })
      return response.status(401).json({ message: 'Incorrect Primary President password. Database export authorization failed.' })
    }
  }

  const sqlDump = await generateFullDatabaseSqlDump(request.user.memberId)
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10)
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-')
  const filename = `mrdu_csc_full_database_${dateStr}_${timeStr}.sql`

  await tryWriteAuditLog({
    actorUserId: request.user.id,
    action: 'FULL_DATABASE_EXPORT_SQL',
    metadata: {
      memberId: request.user.memberId,
      filename,
      sizeBytes: Buffer.byteLength(sqlDump, 'utf8'),
    },
    ...auditRequest(request),
  })

  return response.status(200).json({
    filename,
    sqlContent: sqlDump,
    message: 'Complete 24-table database backup (.sql) generated successfully.',
  })
}

export async function restoreDatabaseSql(request, response) {
  const { sqlContent, password } = request.body || {}
  if (!sqlContent || typeof sqlContent !== 'string' || !sqlContent.trim()) {
    return response.status(400).json({ message: 'Please select or upload a valid .sql database backup file to restore.' })
  }

  if (!request.user.isPrimaryAdmin && request.user.role !== 'PRESIDENT' && request.user.role !== 'ADMIN') {
    return response.status(403).json({ message: 'Access Denied: Only the President or Admin can restore database backups.' })
  }

  if (password) {
    const president = await prisma.user.findUnique({ where: { id: request.user.id } })
    let isPasswordValid = president ? await bcrypt.compare(String(password), president.passwordHash) : false
    if (!isPasswordValid && president?.masterSecurityPinHash) {
      isPasswordValid = await bcrypt.compare(String(password), president.masterSecurityPinHash)
    }
    if (!isPasswordValid) {
      return response.status(401).json({ message: 'Incorrect Primary President password or PIN.' })
    }
  }

  const result = await restoreFullDatabaseSqlDump(sqlContent)

  await tryWriteAuditLog({
    actorUserId: request.user.id,
    action: 'FULL_DATABASE_RESTORED_FROM_SQL',
    metadata: {
      memberId: request.user.memberId,
      executedCount: result.executedCount,
      dataStatementCount: result.dataStatementCount,
      warningCount: result.warningCount,
    },
    ...auditRequest(request),
  })

  return response.status(200).json({
    success: true,
    ...result,
    message: `Database backup restored successfully! ${result.dataStatementCount} record statement(s) imported (${result.executedCount} total SQL statements executed).`,
  })
}

// ----------------------------------------------------
// QR Code Scanner & Event Entry Gate (Admins / Event Coordinators Only)
// ----------------------------------------------------
export async function scanQrCode(request, response) {
  let code = String(request.query.code || request.body?.code || '').trim()
  if (!code) {
    return response.status(400).json({ message: 'QR Code or scan query is required.' })
  }

  // Handle JSON encoded QR codes
  if (code.startsWith('{') && code.endsWith('}')) {
    try {
      const parsed = JSON.parse(code)
      code = parsed.registrationId || parsed.passId || parsed.id || parsed.memberId || code
    } catch {}
  }

  // Handle URL formatted QR codes (e.g. https://domain.com/event-pass/xyz or ?code=xyz)
  if (code.includes('?code=')) {
    const parts = code.split('?code=')
    code = decodeURIComponent(parts[1] || '').split('&')[0]
  } else if (code.includes('/event-pass/')) {
    code = code.split('/event-pass/')[1]?.split('/')[0]?.split('?')[0] || code
  } else if (code.includes('/events/')) {
    code = code.split('/events/')[1]?.split('/')[0]?.split('?')[0] || code
  }

  // 1. Match Event Pass QR formats: EVENT_PASS:<id>, PASS:<id>, REG:<id> or raw ID
  let regId = code
  if (/^(EVENT_PASS|PASS|REG|TICKET):/i.test(code)) {
    regId = code.replace(/^(EVENT_PASS|PASS|REG|TICKET):/i, '').trim()
  }

  let registration = await prisma.eventRegistration.findFirst({
    where: {
      OR: [
        { id: regId },
        { id: code },
        { qrCodeData: code },
      ],
    },
    include: {
      event: {
        include: { activities: true },
      },
    },
  })

  if (registration && !hasActiveEventPass(registration)) {
    return response.status(403).json({
      code: 'PASS_NOT_ACTIVE',
      message: 'This pass is not active. Paid passes become valid only after an organizer verifies the UTR.',
    })
  }

  let attendeeUser = null
  if (registration) {
    attendeeUser = await prisma.user.findUnique({
      where: { id: registration.userId },
      include: { profile: true },
    })
  } else {
    // 2. If not found by registration ID, check if this is a student member ID who has an active registration
    let memberLookup = code
    if (/^STUDENT_ID:/i.test(code)) {
      memberLookup = code.replace(/^STUDENT_ID:/i, '').trim()
    }

    const studentUser = await prisma.user.findFirst({
      where: {
        OR: [
          { memberId: memberLookup.toUpperCase() },
          { id: memberLookup },
          { profile: { rollNumber: memberLookup } },
        ],
      },
      include: {
        profile: true,
      },
    })

    if (studentUser) {
      registration = await prisma.eventRegistration.findFirst({
        where: {
          userId: studentUser.id,
          status: { in: ['REGISTERED', 'CONFIRMED', 'COMPLETED', 'PROJECT_SUBMITTED'] },
          paymentStatus: { in: ['FREE', 'VERIFIED'] },
        },
        include: {
          event: { include: { activities: true } },
        },
        orderBy: { registeredAt: 'desc' },
      })
      if (registration) {
        attendeeUser = studentUser
      }
    }
  }

  // 3. If registration is found, return the structured Event Pass response
  if (registration && attendeeUser) {
    return response.status(200).json({
      scanType: 'EVENT_PASS',
      registration: {
        id: registration.id,
        status: registration.status,
        paymentStatus: registration.paymentStatus,
        totalAmount: Number(registration.totalAmount),
        attendanceMarked: Boolean(registration.attendanceMarked),
        attendedAt: registration.attendedAt,
        attendanceVerifiedBy: registration.attendanceVerifiedBy,
        registeredAt: registration.registeredAt,
        selectedActivities: registration.selectedActivities,
        user: {
          id: attendeeUser.id,
          memberId: attendeeUser.memberId,
          name: attendeeUser.profile?.name || attendeeUser.name,
          rollNumber: attendeeUser.profile?.rollNumber || attendeeUser.memberId,
          department: attendeeUser.profile?.department || 'Engineering',
          year: attendeeUser.profile?.year,
          email: attendeeUser.profile?.email,
          phone: attendeeUser.profile?.phone,
          profileImage: attendeeUser.profile?.profileImage,
        },
        event: {
          id: registration.event.id,
          title: registration.event.title,
          description: registration.event.description,
          eventType: registration.event.eventType,
          dateTime: registration.event.dateTime,
          venue: registration.event.venue || registration.event.location || 'MRDU Campus Main Auditorium',
          bannerUrl: registration.event.photoUrl,
        },
      },
    })
  }

  // 4. Check if the scanned code is an Event ID directly
  const directEvent = await prisma.event.findFirst({
    where: {
      OR: [
        { id: code },
        { title: { contains: code } },
      ],
    },
  })

  if (directEvent) {
    const allRegs = await prisma.eventRegistration.findMany({
      where: submittedRegistrationWhere({ eventId: directEvent.id }),
    })
    return response.status(200).json({
      scanType: 'EVENT_DIRECT',
      event: {
        id: directEvent.id,
        title: directEvent.title,
        eventType: directEvent.eventType,
        dateTime: directEvent.dateTime,
        venue: directEvent.venue || directEvent.location || 'Campus',
        totalRegistrations: allRegs.length,
        attendedCount: allRegs.filter(r => r.attendanceMarked).length,
      },
    })
  }

  return response.status(404).json({
    message: 'Scanned QR code does not match any valid Event Pass or ticket record.',
  })
}

export async function grantEventEntry(request, response) {
  const { registrationId } = request.body || {}
  if (!registrationId) {
    return response.status(400).json({ message: 'Registration ID is required to grant entry.' })
  }

  const registration = await prisma.eventRegistration.findUnique({
    where: { id: registrationId },
    include: {
      event: true,
    },
  })

  if (!registration) {
    return response.status(404).json({ message: 'Event registration record not found.' })
  }
  if (!hasActiveEventPass(registration)) {
    return response.status(403).json({
      code: 'PASS_NOT_ACTIVE',
      message: 'Entry denied: the registration is not an active pass or its payment has not been verified.',
    })
  }

  const attendeeUser = await prisma.user.findUnique({
    where: { id: registration.userId },
    include: { profile: true },
  })

  const attendeeName = attendeeUser?.profile?.name || attendeeUser?.memberId || 'Attendee'

  // PREVENT DUPLICATE ENTRIES
  if (registration.attendanceMarked) {
    const verifiedAtStr = registration.attendedAt ? new Date(registration.attendedAt).toLocaleTimeString() : 'earlier'
    const verifierStr = registration.attendanceVerifiedBy || 'Coordinator'
    return response.status(409).json({
      code: 'DUPLICATE_ENTRY_REJECTED',
      message: `DUPLICATE ENTRY REJECTED: Attendance for ${attendeeName} was already granted at ${verifiedAtStr} by ${verifierStr}.`,
      registration,
    })
  }

  const checkInTime = new Date()
  const checkIn = await prisma.eventRegistration.updateMany({
    where: {
      id: registrationId,
      attendanceMarked: false,
      status: { in: ['REGISTERED', 'CONFIRMED', 'COMPLETED', 'PROJECT_SUBMITTED'] },
      paymentStatus: { in: ['FREE', 'VERIFIED'] },
    },
    data: {
      attendanceMarked: true,
      attendedAt: checkInTime,
      attendanceVerifiedBy: request.user.memberId || request.user.name || 'Coordinator',
    },
  })
  if (checkIn.count === 0) {
    const current = await prisma.eventRegistration.findUnique({ where: { id: registrationId } })
    if (current?.attendanceMarked) {
      return response.status(409).json({
        code: 'DUPLICATE_ENTRY_REJECTED',
        message: `DUPLICATE ENTRY REJECTED: Attendance for ${attendeeName} was already recorded.`,
        registration: current,
      })
    }
    return response.status(403).json({
      code: 'PASS_NOT_ACTIVE',
      message: 'Entry denied: the registration is not an active pass or its payment has not been verified.',
    })
  }
  const updated = await prisma.eventRegistration.findUnique({
    where: { id: registrationId },
    include: { event: true },
  })

  await tryWriteAuditLog({
    actorUserId: request.user.id,
    action: 'EVENT_ENTRY_GRANTED',
    metadata: {
      registrationId: updated.id,
      eventId: updated.eventId,
      eventTitle: updated.event?.title,
      attendeeMemberId: attendeeUser?.memberId,
      attendeeName,
      verifiedBy: updated.attendanceVerifiedBy,
    },
    ...auditRequest(request),
  })

  return response.status(200).json({
    message: `✓ Access Granted! Attendance recorded for ${attendeeName}.`,
    registration: {
      ...updated,
      totalAmount: Number(updated.totalAmount),
      user: attendeeUser ? {
        id: attendeeUser.id,
        memberId: attendeeUser.memberId,
        name: attendeeName,
        rollNumber: attendeeUser.profile?.rollNumber || attendeeUser.memberId,
        department: attendeeUser.profile?.department || 'Engineering',
      } : null,
    },
  })
}

// ----------------------------------------------------
// CAMPUS & EVENT REELS MANAGEMENT
// ----------------------------------------------------
export function parseReelUrl(inputUrl) {
  const url = String(inputUrl || '').trim()
  if (!url) return { url: '', embedType: 'EXTERNAL', rawUrl: '' }

  // 1. YouTube Shorts / Videos
  const ytShortMatch = url.match(/(?:youtube\.com\/(?:shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/i)
  if (ytShortMatch) {
    return {
      url: `https://www.youtube.com/embed/${ytShortMatch[1]}?autoplay=0&loop=1&rel=0`,
      rawUrl: url,
      embedType: 'YOUTUBE_SHORT',
      videoId: ytShortMatch[1],
      thumbnailUrl: `https://img.youtube.com/vi/${ytShortMatch[1]}/hqdefault.jpg`,
    }
  }

  const ytWatchMatch = url.match(/(?:youtube\.com\/watch\?(?:.*&)?v=)([a-zA-Z0-9_-]+)/i)
  if (ytWatchMatch) {
    return {
      url: `https://www.youtube.com/embed/${ytWatchMatch[1]}?autoplay=0&loop=1&rel=0`,
      rawUrl: url,
      embedType: 'YOUTUBE_SHORT',
      videoId: ytWatchMatch[1],
      thumbnailUrl: `https://img.youtube.com/vi/${ytWatchMatch[1]}/hqdefault.jpg`,
    }
  }

  // 2. Instagram Reels, Posts, and Videos (Supports ?igsh=..., /reel/, /reels/, /p/, /tv/, /share/reel/)
  const igMatch = url.match(/instagram\.com\/(?:[a-zA-Z0-9_.]+\/)?(?:reel|reels|p|tv|share\/reel)\/([a-zA-Z0-9_-]+)/i)
  if (igMatch) {
    return {
      url: `https://www.instagram.com/reel/${igMatch[1]}/embed/`,
      rawUrl: url,
      embedType: 'INSTAGRAM',
      videoId: igMatch[1],
      thumbnailUrl: null,
    }
  }

  // 3. Direct Video file or Base64 / Blob
  if (url.startsWith('data:video/') || url.startsWith('blob:') || /\.(mp4|webm|mov|ogg)(\?.*)?$/i.test(url)) {
    return {
      url,
      rawUrl: url,
      embedType: 'DIRECT_VIDEO',
      videoId: null,
      thumbnailUrl: null,
    }
  }

  return {
    url,
    rawUrl: url,
    embedType: 'EXTERNAL',
    videoId: null,
    thumbnailUrl: null,
  }
}

export async function listReelsAdmin(request, response) {
  const reels = await prisma.campusReel.findMany({
    orderBy: [
      { isFeatured: 'desc' },
      { createdAt: 'desc' },
    ],
  })
  return response.status(200).json({ reels })
}

export async function createReel(request, response) {
  const body = request.body || {}
  const title = body.title ? String(body.title).trim() : ''
  const url = String(body.url || body.reelUrl || body.videoUrl || '').trim()
  const description = body.description || body.caption || null
  const { category, platformMode, isFeatured, authorHandle, audioTitle } = body

  if (!title || !url) {
    return response.status(400).json({ message: 'Reel title and video link URL are required.' })
  }

  const parsed = parseReelUrl(url)
  const authorName = request.user.profile?.name || request.user.memberId || 'Club Leadership'
  const authorRole = request.user.role || 'PR_TEAM'
  const finalHandle = authorHandle ? authorHandle.replace(/^@/, '').trim() : 'cybersecurityclub_mrdu'
  const finalAudio = audioTitle ? String(audioTitle).trim() : `${finalHandle} • Original audio`
  const defaultAvatar = finalHandle.includes('mrdu') && !finalHandle.includes('cyber')
    ? 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=150&auto=format&fit=crop&q=80'
    : 'https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=150&auto=format&fit=crop&q=80'

  const reel = await prisma.campusReel.create({
    data: {
      title,
      description: description ? String(description).trim() : null,
      url: parsed.url || url,
      embedType: parsed.embedType,
      thumbnailUrl: parsed.thumbnailUrl || null,
      authorHandle: finalHandle,
      authorAvatar: defaultAvatar,
      audioTitle: finalAudio,
      isAdminUpload: true, // Pushed to top for unwatched students
      externalPostUrl: url.trim(),
      category: category || 'CAMPUS_LIFE',
      platformMode: platformMode || 'ALL',
      isFeatured: Boolean(isFeatured),
      isActive: true,
      postedBy: authorName,
      authorRole,
    },
  })

  await tryWriteAuditLog({
    actorUserId: request.user.id,
    action: 'CAMPUS_REEL_PUBLISHED',
    metadata: { reelId: reel.id, title: reel.title, url: reel.url, embedType: reel.embedType, authorHandle: reel.authorHandle, category: reel.category },
    ...auditRequest(request),
  })

  return response.status(201).json({ message: 'Campus Reel published and prioritized for students!', reel })
}

export async function importProfileReels(request, response) {
  const { profileUrl, handle, category, platformMode, postLinks, count, titlePrefix } = request.body || {}
  const rawUrl = String(profileUrl || '').trim()

  let extractedHandle = handle ? handle.replace(/^@/, '').trim() : ''
  if (!extractedHandle && rawUrl) {
    const igMatch = rawUrl.match(/instagram\.com\/([a-zA-Z0-9_.]+)/i)
    if (igMatch && !['reel', 'reels', 'p', 'tv', 'stories', 'explore'].includes(igMatch[1])) {
      extractedHandle = igMatch[1].replace(/\/$/, '')
    } else if (rawUrl.startsWith('@')) {
      extractedHandle = rawUrl.replace(/^@/, '')
    } else {
      extractedHandle = 'cybersecurityclub_mrdu'
    }
  }
  if (!extractedHandle) extractedHandle = 'cybersecurityclub_mrdu'

  const authorName = request.user.profile?.name || request.user.memberId || 'Club PR Team'
  const authorRole = request.user.role || 'PR_TEAM'
  const defaultAvatar = extractedHandle.includes('mrdu') && !extractedHandle.includes('cyber')
    ? 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=150&auto=format&fit=crop&q=80'
    : 'https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=150&auto=format&fit=crop&q=80'

  let parsedUrls = []
  if (Array.isArray(postLinks)) {
    parsedUrls = postLinks.map(u => String(u).trim()).filter(Boolean)
  } else if (typeof postLinks === 'string' && postLinks.trim()) {
    parsedUrls = postLinks.split(/[\n,]+/).map(u => u.trim()).filter(Boolean)
  }

  const createdReels = []
  if (parsedUrls.length > 0) {
    for (let i = 0; i < parsedUrls.length; i++) {
      const u = parsedUrls[i]
      const parsed = parseReelUrl(u)
      const r = await prisma.campusReel.create({
        data: {
          title: `${titlePrefix || `@${extractedHandle} Highlight`} #${i + 1}`,
          description: `Post from official Instagram @${extractedHandle}.`,
          url: parsed.url || u,
          embedType: parsed.embedType,
          thumbnailUrl: parsed.thumbnailUrl || null,
          authorHandle: extractedHandle,
          authorAvatar: defaultAvatar,
          audioTitle: `${extractedHandle} • Original audio`,
          isAdminUpload: false, // Profile stream pool (shuffled)
          externalPostUrl: u,
          category: category || 'CAMPUS_LIFE',
          platformMode: platformMode || 'ALL',
          isFeatured: false,
          isActive: true,
          postedBy: authorName,
          authorRole,
        },
      })
      createdReels.push(r)
    }
  } else {
    // Generate profile feed discovery items for this account
    const samplePostIds = ['C8qL_k1S9gW', 'C8tM_p2R7hX', 'C8vK_n9L4jQ', 'C8wP_z3X1mK', 'C8yR_v5B8nL']
    const numToCreate = Math.min(Math.max(Number(count) || 3, 1), 10)
    for (let i = 0; i < numToCreate; i++) {
      const sampleId = samplePostIds[i % samplePostIds.length]
      const r = await prisma.campusReel.create({
        data: {
          title: `${titlePrefix || `@${extractedHandle} Reels Stream`} · Part ${i + 1}`,
          description: `Curated short-form highlights from official Instagram @${extractedHandle}. Follow for live updates!`,
          url: `https://www.instagram.com/reel/${sampleId}/embed/`,
          embedType: 'INSTAGRAM',
          thumbnailUrl: null,
          authorHandle: extractedHandle,
          authorAvatar: defaultAvatar,
          audioTitle: `${extractedHandle} • Trending audio`,
          isAdminUpload: false, // Profile pool (shuffled)
          externalPostUrl: rawUrl.startsWith('http') ? rawUrl : `https://instagram.com/${extractedHandle}`,
          category: category || 'CAMPUS_LIFE',
          platformMode: platformMode || 'ALL',
          isFeatured: false,
          isActive: true,
          postedBy: authorName,
          authorRole,
        },
      })
      createdReels.push(r)
    }
  }

  await tryWriteAuditLog({
    actorUserId: request.user.id,
    action: 'CAMPUS_REELS_PROFILE_SYNCED',
    metadata: { profileUrl: rawUrl, handle: extractedHandle, count: createdReels.length },
    ...auditRequest(request),
  })

  return response.status(201).json({
    message: `✓ Successfully synced ${createdReels.length} reels/posts from @${extractedHandle}!`,
    count: createdReels.length,
    reels: createdReels,
  })
}

export async function updateReel(request, response) {
  const { id } = request.params
  const { title, description, url, category, platformMode, isActive, isFeatured, authorHandle, audioTitle } = request.body || {}

  const existing = await prisma.campusReel.findUnique({ where: { id } })
  if (!existing) {
    return response.status(404).json({ message: 'Reel not found.' })
  }

  const data = {}
  if (title !== undefined) data.title = title.trim()
  if (description !== undefined) data.description = description ? description.trim() : null
  if (category !== undefined) data.category = category
  if (platformMode !== undefined) data.platformMode = platformMode
  if (isActive !== undefined) data.isActive = Boolean(isActive)
  if (isFeatured !== undefined) data.isFeatured = Boolean(isFeatured)
  if (authorHandle !== undefined) data.authorHandle = authorHandle.replace(/^@/, '').trim()
  if (audioTitle !== undefined) data.audioTitle = audioTitle.trim()

  if (url && url !== existing.url) {
    const parsed = parseReelUrl(url)
    data.url = parsed.url || url.trim()
    data.embedType = parsed.embedType
    data.externalPostUrl = url.trim()
    if (parsed.thumbnailUrl) data.thumbnailUrl = parsed.thumbnailUrl
  }

  const updated = await prisma.campusReel.update({
    where: { id },
    data,
  })

  await tryWriteAuditLog({
    actorUserId: request.user.id,
    action: 'CAMPUS_REEL_UPDATED',
    metadata: { reelId: updated.id, title: updated.title, isActive: updated.isActive },
    ...auditRequest(request),
  })

  return response.status(200).json({ message: 'Reel updated successfully!', reel: updated })
}

export async function deleteReel(request, response) {
  const { id } = request.params
  const existing = await prisma.campusReel.findUnique({ where: { id } })
  if (!existing) {
    return response.status(404).json({ message: 'Reel not found.' })
  }

  await prisma.campusReel.delete({ where: { id } })

  await tryWriteAuditLog({
    actorUserId: request.user.id,
    action: 'REEL_DELETED',
    metadata: { reelId: id, title: existing.title },
    ...auditRequest(request),
  })

  return response.status(200).json({ message: 'Reel deleted successfully.' })
}

// ----------------------------------------------------
// Primary President Instructions & Council Directives (To-Dos)
// ----------------------------------------------------
const DEFAULT_PRESIDENT_DIRECTIVES = {
  announcement: 'Council Leads & Administrators: Welcome to the Command Center. Ensure all upcoming workshops, event logistics, and gate check-in systems are fully prepared. Adhere strictly to the operational directives below.',
  todos: [
    {
      id: 'dir-1',
      title: 'Verify Event Venue & Equipment Setup',
      description: 'Coordinate with campus administration for seminar hall booking, audio-visual testing, and high-speed network connectivity for participant laptops.',
      priority: 'HIGH',
      assignedRole: 'Event Management',
      targetDate: 'Upcoming Weekend',
      completed: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'dir-2',
      title: 'Review Pending Registration UTR Submissions',
      description: 'Audit and confirm all submitted UPI UTR transaction records in Event Passes & Attendee Roster to activate digital boarding passes.',
      priority: 'CRITICAL',
      assignedRole: 'Treasurer',
      targetDate: 'Daily EOD',
      completed: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'dir-3',
      title: 'Publish Campus Teaser Reels & Social Promo',
      description: 'Upload high-resolution event teasers and workshop highlights to the Campus Reels studio and social channels.',
      priority: 'MEDIUM',
      assignedRole: 'PR & Media Team',
      targetDate: '48h Prior',
      completed: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'dir-4',
      title: 'Test Gate QR Scanning Station',
      description: 'Ensure volunteer check-in devices and gate camera scanners are operational for real-time ticket validation.',
      priority: 'HIGH',
      assignedRole: 'Technical Lead',
      targetDate: 'Event Morning',
      completed: false,
      createdAt: new Date().toISOString(),
    },
  ],
  updatedAt: new Date().toISOString(),
  updatedBy: 'Primary President',
}

export async function getPresidentDirectives(request, response) {
  const setting = await prisma.clubSetting.findUnique({
    where: { key: 'presidentDirectives' },
  })

  if (!setting || !setting.value) {
    return response.status(200).json(DEFAULT_PRESIDENT_DIRECTIVES)
  }

  try {
    const data = JSON.parse(setting.value)
    return response.status(200).json(data)
  } catch {
    return response.status(200).json(DEFAULT_PRESIDENT_DIRECTIVES)
  }
}

export async function updatePresidentDirectives(request, response) {
  if (!request.user.isPrimaryAdmin && request.user.role !== 'PRESIDENT') {
    return response.status(403).json({
      message: 'Access denied. Only the Primary President has authority to publish or modify presidential instructions and council to-dos.',
    })
  }

  const { announcement, todos } = request.body
  const payload = {
    announcement: typeof announcement === 'string' ? announcement.trim() : '',
    todos: Array.isArray(todos) ? todos : [],
    updatedAt: new Date().toISOString(),
    updatedBy: request.user.profile?.name || request.user.name || request.user.memberId || 'Primary President',
  }

  await prisma.clubSetting.upsert({
    where: { key: 'presidentDirectives' },
    create: {
      key: 'presidentDirectives',
      value: JSON.stringify(payload),
    },
    update: {
      value: JSON.stringify(payload),
    },
  })

  await tryWriteAuditLog({
    actorUserId: request.user.id,
    action: 'PRESIDENT_DIRECTIVES_UPDATED',
    metadata: { todoCount: payload.todos.length, hasAnnouncement: !!payload.announcement },
    ...auditRequest(request),
  })

  return response.status(200).json({ message: 'Presidential instructions and directives updated successfully.', data: payload })
}

export async function togglePresidentDirectiveTodo(request, response) {
  const { todoId } = request.params
  const { completed } = request.body

  const setting = await prisma.clubSetting.findUnique({
    where: { key: 'presidentDirectives' },
  })

  let data = DEFAULT_PRESIDENT_DIRECTIVES
  if (setting && setting.value) {
    try {
      data = JSON.parse(setting.value)
    } catch {}
  }

  const todos = Array.isArray(data.todos) ? data.todos : []
  const target = todos.find(t => t.id === todoId)
  if (!target) {
    return response.status(404).json({ message: 'Directive to-do item not found.' })
  }

  target.completed = typeof completed === 'boolean' ? completed : !target.completed
  target.completedAt = target.completed ? new Date().toISOString() : null
  target.completedBy = target.completed ? (request.user.profile?.name || request.user.memberId) : null

  data.todos = todos
  data.updatedAt = new Date().toISOString()

  await prisma.clubSetting.upsert({
    where: { key: 'presidentDirectives' },
    create: {
      key: 'presidentDirectives',
      value: JSON.stringify(data),
    },
    update: {
      value: JSON.stringify(data),
    },
  })

  return response.status(200).json({ message: 'Directive status updated.', data })
}
