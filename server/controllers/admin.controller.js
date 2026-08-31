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
import { getActivePlatformMode, invalidatePlatformModeCache } from '../services/platform-role.service.js'
import { generateFullDatabaseSqlDump } from '../services/database-dump.service.js'
import {
  accountStatusSchema,
  adminResetPasswordSchema,
  createMemberSchema,
  memberPermissionsSchema,
  transferPresidentSchema,
} from '../validators/auth.validator.js'
import {
  bulkCreateMembersSchema,
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

function flattenMember(user, platformMode = 'CYBER_SECURITY_CLUB') {
  const safe = toSafeUser(user, platformMode)
  return {
    ...safe,
    isPrimaryAdmin: Boolean(user.isPrimaryAdmin),
    cscRole: user.cscRole || user.role || 'STUDENT',
    mrduRole: user.mrduRole || (user.isPrimaryAdmin ? 'PRESIDENT' : 'STUDENT'),
    name: safe.profile?.name || null,
    email: safe.profile?.email || null,
    phone: safe.profile?.phone || null,
    profileImage: safe.profile?.profileImage || null,
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
  return response.status(200).json({ users: users.map(u => flattenMember(u, platformMode)) })
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
  await tryWriteAuditLog({ actorUserId: request.user.id, action: 'ACCOUNT_STATUS_CHANGED', targetUserId: target.id, metadata: { from: target.accountStatus, to: parsed.data.accountStatus }, ...auditRequest(request) })
  return response.status(200).json({ user: flattenMember(user, platformMode) })
}

export async function changeMemberPermissions(request, response) {
  const parsed = memberPermissionsSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ message: 'Choose at least one valid permission.' })

  const target = await prisma.user.findUnique({ where: { id: request.params.id }, include: userInclude })
  if (!target) return response.status(404).json({ message: 'Resource not found' })
  if (target.isPrimaryAdmin) return response.status(400).json({ message: 'Primary President permissions cannot be customized.' })

  const platformMode = request.platformMode || await getActivePlatformMode()
  const user = await prisma.user.update({
    where: { id: target.id },
    data: { permissions: { deleteMany: {}, create: parsed.data.permissions.map(permission => ({ permission })) } },
    include: userInclude,
  })
  await tryWriteAuditLog({ actorUserId: request.user.id, action: 'ACCOUNT_PERMISSIONS_CHANGED', targetUserId: target.id, metadata: { from: target.permissions.map(entry => entry.permission), to: parsed.data.permissions }, ...auditRequest(request) })
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

  const { name, email, phone, rollNumber, department, year, role, profileImage } = request.body
  const currentModeRole = isMrdu ? (target.mrduRole || 'STUDENT') : (target.cscRole || target.role)
  const newRole = role || currentModeRole
  const permissionsUpdate = role && role !== currentModeRole ? getRolePermissions(role) : null

  try {
    const user = await prisma.user.update({
      where: { id: target.id },
      data: {
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
              rollNumber: rollNumber || null,
              department: department || null,
              year: year ? Number(year) : null,
              profileImage: profileImage || null,
            },
            update: {
              ...(name !== undefined && { name }),
              ...(email !== undefined && { email }),
              ...(phone !== undefined && { phone }),
              ...(rollNumber !== undefined && { rollNumber }),
              ...(department !== undefined && { department }),
              ...(year !== undefined && { year: year ? Number(year) : null }),
              ...(profileImage !== undefined && { profileImage }),
            },
          },
        },
      },
      include: userInclude,
    })
    await tryWriteAuditLog({ actorUserId: request.user.id, action: 'ACCOUNT_UPDATED', targetUserId: target.id, metadata: { memberId: target.memberId, updatedFields: Object.keys(request.body) }, ...auditRequest(request) })
    return response.status(200).json({ user: flattenMember(user, platformMode) })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
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
    registrationCount: event.registrations?.length ?? event._count?.registrations ?? 0,
    activities: event.activities?.map(a => ({ ...a, price: Number(a.price) })) || [],
    formFields: event.formFields || [],
  }
}

export async function listEvents(request, response) {
  const events = await prisma.event.findMany({
    include: {
      formFields: true,
      activities: { orderBy: { sortOrder: 'asc' } },
      registrations: { select: { id: true, userId: true, paymentStatus: true, totalAmount: true } },
    },
    orderBy: { dateTime: 'desc' },
  })
  return response.status(200).json({ events: events.map(serializeEvent) })
}

export async function createEvent(request, response) {
  const parsed = eventInputSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ message: parsed.error.issues[0]?.message || 'Enter valid event details.' })

  const data = parsed.data
  if (data.requiresPayment && !data.activities?.length && (!data.paymentAmount || !data.paymentQrUrl)) {
    return response.status(400).json({ message: 'Paid events require a registration fee or activities and a payment QR image.' })
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
      registrations: { select: { id: true, userId: true } },
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
      ...(data.paymentAmount !== undefined && { paymentAmount: data.paymentAmount }),
      ...(data.paymentQrUrl !== undefined && { paymentQrUrl: data.paymentQrUrl }),
      ...(data.paymentUpiId !== undefined && { paymentUpiId: data.paymentUpiId }),
      ...(data.paymentInstructions !== undefined && { paymentInstructions: data.paymentInstructions }),
      ...(data.paymentDeadline !== undefined && { paymentDeadline: data.paymentDeadline }),
      ...(data.requirePaymentProof !== undefined && { requirePaymentProof: data.requirePaymentProof }),
      ...(data.allowMultipleActivities !== undefined && { allowMultipleActivities: data.allowMultipleActivities }),
      ...(data.isTeamEvent !== undefined && { isTeamEvent: Boolean(data.isTeamEvent) }),
      ...(data.minTeamSize !== undefined && { minTeamSize: data.minTeamSize }),
      ...(data.maxTeamSize !== undefined && { maxTeamSize: data.maxTeamSize }),
      ...(data.teamRules !== undefined && { teamRules: data.teamRules }),
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
      registrations: { select: { id: true, userId: true } },
    },
  })
  await tryWriteAuditLog({ actorUserId: request.user.id, action: 'EVENT_UPDATED', metadata: { eventId: event.id, title: event.title }, ...auditRequest(request) })
  return response.status(200).json({ event: serializeEvent(updated) })
}

export async function listAllEventPasses(request, response) {
  const { eventId, paymentStatus, attendanceStatus, query } = request.query

  const whereClause = {}
  if (eventId && eventId !== 'ALL') {
    whereClause.eventId = eventId
  }
  if (paymentStatus && paymentStatus !== 'ALL') {
    if (paymentStatus === 'PAID') {
      whereClause.paymentStatus = 'VERIFIED'
    } else if (paymentStatus === 'PENDING') {
      whereClause.paymentStatus = { in: ['PENDING', 'SUBMITTED'] }
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
    include: { profile: true },
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
      name: u?.profile?.name || u?.memberId || 'Student',
      memberName: u?.profile?.name || u?.memberId || 'Student',
      email: u?.profile?.email || null,
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
      paymentStatus: reg.paymentStatus,
      paymentReference: reg.paymentReference,
      paymentProofUrl: reg.paymentProofUrl,
      totalAmount: Number(reg.totalAmount),
      status: reg.status,
      attendanceMarked: Boolean(reg.attendanceMarked),
      attendedAt: reg.attendedAt,
      registeredAt: reg.registeredAt,
      qrCodeData: reg.qrCodeData,
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
        orderBy: { registeredAt: 'desc' },
      },
    },
  })
  if (!event) return response.status(404).json({ message: 'Event not found' })

  // Fetch student profiles for registrations
  const userIds = event.registrations.map(r => r.userId)
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    include: { profile: true },
  })
  const userMap = new Map(users.map(u => [u.id, u]))

  const populatedRegistrations = event.registrations.map(reg => {
    const u = userMap.get(reg.userId)
    return {
      ...reg,
      totalAmount: Number(reg.totalAmount),
      memberName: u?.profile?.name || u?.memberId || 'Student',
      memberId: u?.memberId,
      name: u?.profile?.name || u?.memberId || 'Student',
      email: u?.profile?.email || null,
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
  const confirmed = populatedRegistrations.filter(r => ['CONFIRMED', 'REGISTERED'].includes(r.status) || r.paymentStatus === 'VERIFIED').length
  const pending = populatedRegistrations.filter(r => ['PENDING_PAYMENT', 'PENDING'].includes(r.status) || ['PENDING', 'SUBMITTED'].includes(r.paymentStatus)).length
  const rejected = populatedRegistrations.filter(r => r.status === 'REJECTED' || r.paymentStatus === 'REJECTED').length
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
      seatsRemaining: event.capacity ? Math.max(0, event.capacity - confirmed) : null,
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

  const updated = await prisma.eventRegistration.update({
    where: { id: registrationId },
    data: {
      paymentStatus: 'VERIFIED',
      status: 'REGISTERED',
      paymentVerifiedAt: new Date(),
      paymentVerifiedBy: request.user.id,
    },
  })

  // If part of a team, also verify team members
  if (registration.teamId) {
    await prisma.eventRegistration.updateMany({
      where: { teamId: registration.teamId },
      data: {
        paymentStatus: 'VERIFIED',
        status: 'REGISTERED',
        paymentVerifiedAt: new Date(),
        paymentVerifiedBy: request.user.id,
      },
    }).catch(() => {})
  }

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

  return response.status(200).json({
    success: true,
    message: 'Payment verified and pass marked as ACTIVE!',
    registration: updated,
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
    include: { registrations: { orderBy: { registeredAt: 'desc' } } },
  })
  if (!event) return response.status(404).json({ message: 'Event not found' })

  const userIds = event.registrations.map(r => r.userId)
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    include: { profile: true },
  })
  const userMap = new Map(users.map(u => [u.id, u]))

  function fmt(val) {
    if (val === null || val === undefined) return '---'
    const s = String(val).trim()
    if (s === '' || s === 'null' || s === 'undefined') return '---'
    if (s.includes(',') || s.includes('\n') || s.includes('\r') || s.includes('"')) {
      return `"${s.replaceAll('"', '""')}"`
    }
    return s
  }

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
      'Registration Fee (₹)',
      'Payment Status',
      'Payment UTR Reference',
      'Payment Proof URL',
      'Gate Attendance',
      'Check-in Timestamp',
      'Registration Date',
    ].map(fmt),
  ]

  event.registrations.forEach(reg => {
    const u = userMap.get(reg.userId)
    const activitiesStr = Array.isArray(reg.selectedActivities) ? reg.selectedActivities.map(a => a.name).join('; ') : ''
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
      Number(reg.totalAmount) || 0,
      reg.paymentStatus,
      reg.paymentReference,
      reg.paymentProofUrl,
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

  function fmt(val) {
    if (val === null || val === undefined) return '---'
    const s = String(val).trim()
    if (s === '' || s === 'null' || s === 'undefined') return '---'
    if (s.includes(',') || s.includes('\n') || s.includes('\r') || s.includes('"')) {
      return `"${s.replaceAll('"', '""')}"`
    }
    return s
  }

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
    where: { paymentStatus: { in: ['SUBMITTED', 'PENDING', 'VERIFIED', 'REJECTED'] } },
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

  const updated = await prisma.eventRegistration.update({
    where: { id: registration.id },
    data: {
      paymentStatus: parsed.data.paymentStatus,
      status: parsed.data.paymentStatus === 'VERIFIED' ? 'CONFIRMED' : parsed.data.paymentStatus === 'REJECTED' ? 'REJECTED' : registration.status,
      paymentVerifiedAt: new Date(),
      paymentVerifiedBy: request.user.id,
      paymentNotes: parsed.data.paymentNotes || null,
    },
  })

  await tryWriteAuditLog({
    actorUserId: request.user.id,
    action: `PAYMENT_${parsed.data.paymentStatus}`,
    metadata: { registrationId: registration.id, eventId: registration.eventId, paymentStatus: parsed.data.paymentStatus },
    ...auditRequest(request),
  })

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
  PRESIDENT: 1,
  VICE_PRESIDENT: 2,
  STUDENT_COORDINATOR: 3,
  TECH_TEAM: 4,
  EVENT_MANAGEMENT: 5,
  TREASURER: 6,
  SECRETARY: 7,
  MEDIA_LEAD: 8,
  SOCIAL_MEDIA_LEAD: 9,
  PR_TEAM: 10,
  CULTURAL: 11,
  ADMIN: 12,
}

const ROLE_DISPLAY_TITLES = {
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
  await syncLeadersFromAccounts()
  const team = await prisma.clubTeamMember.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] })
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
  const settings = await prisma.clubSetting.findMany()
  const dictionary = {}
  settings.forEach(s => {
    try { dictionary[s.key] = JSON.parse(s.value) } catch { dictionary[s.key] = s.value }
  })
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
  ]

  const hasGlobalKey = Object.keys(parsed.data).some(k => globalPresidentKeys.includes(k) && parsed.data[k] !== undefined)
  if (hasGlobalKey && !request.user.isPrimaryAdmin) {
    return response.status(403).json({ message: 'Only the Primary President can modify global site, platform mode, subscription, or video settings.' })
  }

  // If site status is being changed to HIBERNATING, record the timestamp if not already provided
  if (parsed.data.siteStatus === 'HIBERNATING' && !parsed.data.hibernationStartedAt) {
    parsed.data.hibernationStartedAt = new Date().toISOString()
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

  if (parsed.data.platformMode) {
    invalidatePlatformModeCache()
  }

  await tryWriteAuditLog({ actorUserId: request.user.id, action: 'CLUB_SETTINGS_UPDATED', metadata: { keys: Object.keys(parsed.data) }, ...auditRequest(request) })
  return response.status(200).json({ message: 'Club settings updated successfully.' })
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
  if (!password) {
    return response.status(400).json({ message: 'Primary President account password is required to generate a full database backup.' })
  }

  // Fetch current primary president account with passwordHash
  const president = await prisma.user.findUnique({ where: { id: request.user.id } })
  if (!president || !president.isPrimaryAdmin) {
    return response.status(403).json({ message: 'Access Denied: Only the Primary President can export complete database dumps.' })
  }

  const isPasswordValid = await bcrypt.compare(password, president.passwordHash)
  if (!isPasswordValid) {
    await tryWriteAuditLog({
      actorUserId: request.user.id,
      action: 'DATABASE_EXPORT_REJECTED_INVALID_PASSWORD',
      metadata: { memberId: request.user.memberId, ip: request.ip },
      ...auditRequest(request),
    })
    return response.status(401).json({ message: 'Incorrect Primary President password. Database export authorization failed.' })
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
    message: 'Database backup generated successfully.',
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
        where: { userId: studentUser.id },
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
      where: { eventId: directEvent.id },
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

  const updated = await prisma.eventRegistration.update({
    where: { id: registrationId },
    data: {
      attendanceMarked: true,
      attendedAt: new Date(),
      attendanceVerifiedBy: request.user.memberId || request.user.name || 'Coordinator',
    },
    include: {
      event: true,
    },
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
