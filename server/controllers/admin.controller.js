import bcrypt from 'bcrypt'
import { Prisma } from '@prisma/client'
import { prisma } from '../db/prisma.js'
import { tryWriteAuditLog } from '../services/audit.service.js'
import { decryptSecret } from '../services/secret-crypto.service.js'
import { verifyTotp } from '../services/totp.service.js'
import { toSafeUser } from '../utils/safe-user.js'
import { env } from '../config/env.js'
import { getRolePermissions } from '../config/permissions.js'
import {
  accountStatusSchema,
  adminResetPasswordSchema,
  createMemberSchema,
  memberPermissionsSchema,
  transferPresidentSchema,
} from '../validators/auth.validator.js'
import {
  clubSettingsSchema,
  clubTeamMemberSchema,
  deleteProtectedAccountSchema,
  eventInputSchema,
  galleryAlbumSchema,
  galleryPhotoSchema,
  paymentVerificationSchema,
  newId,
} from '../validators/member.validator.js'

const userInclude = { profile: true, permissions: true }

function auditRequest(request) {
  return { ipAddress: request.ip, userAgent: request.get('user-agent') || null }
}

function flattenMember(user) {
  const safe = toSafeUser(user)
  return {
    ...safe,
    isPrimaryAdmin: Boolean(user.isPrimaryAdmin),
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
  const users = await prisma.user.findMany({ include: userInclude, orderBy: { createdAt: 'desc' } })
  return response.status(200).json({ users: users.map(flattenMember) })
}

export async function createMember(request, response) {
  const parsed = createMemberSchema.safeParse(request.body)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message || 'Please enter valid account details.'
    return response.status(400).json({ message })
  }

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
    return response.status(201).json({ user: flattenMember(user) })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return response.status(409).json({ message: 'That Member ID or email is already assigned.' })
    }
    throw error
  }
}

export async function changeAccountStatus(request, response) {
  const parsed = accountStatusSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ message: 'Invalid account status' })

  const target = await prisma.user.findUnique({ where: { id: request.params.id }, include: userInclude })
  if (!target) return response.status(404).json({ message: 'Resource not found' })
  if (target.isPrimaryAdmin) return response.status(400).json({ message: 'The Primary President account cannot be disabled.' })

  const user = await prisma.user.update({ where: { id: target.id }, data: { accountStatus: parsed.data.accountStatus }, include: userInclude })
  await tryWriteAuditLog({ actorUserId: request.user.id, action: 'ACCOUNT_STATUS_CHANGED', targetUserId: target.id, metadata: { from: target.accountStatus, to: parsed.data.accountStatus }, ...auditRequest(request) })
  return response.status(200).json({ user: flattenMember(user) })
}

export async function changeMemberPermissions(request, response) {
  const parsed = memberPermissionsSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ message: 'Choose at least one valid permission.' })

  const target = await prisma.user.findUnique({ where: { id: request.params.id }, include: userInclude })
  if (!target) return response.status(404).json({ message: 'Resource not found' })
  if (target.isPrimaryAdmin) return response.status(400).json({ message: 'Primary President permissions cannot be customized.' })

  const user = await prisma.user.update({
    where: { id: target.id },
    data: { permissions: { deleteMany: {}, create: parsed.data.permissions.map(permission => ({ permission })) } },
    include: userInclude,
  })
  await tryWriteAuditLog({ actorUserId: request.user.id, action: 'ACCOUNT_PERMISSIONS_CHANGED', targetUserId: target.id, metadata: { from: target.permissions.map(entry => entry.permission), to: parsed.data.permissions }, ...auditRequest(request) })
  return response.status(200).json({ user: flattenMember(user) })
}

export async function editMember(request, response) {
  const target = await prisma.user.findUnique({ where: { id: request.params.id }, include: userInclude })
  if (!target) return response.status(404).json({ message: 'Resource not found' })
  if (target.isPrimaryAdmin && target.id !== request.user.id) {
    return response.status(400).json({ message: 'Primary President account cannot be modified by other users.' })
  }

  const { name, email, phone, rollNumber, department, year, role, profileImage } = request.body
  const newRole = role || target.role
  const permissionsUpdate = role && role !== target.role ? getRolePermissions(role) : null

  try {
    const user = await prisma.user.update({
      where: { id: target.id },
      data: {
        role: target.isPrimaryAdmin ? 'PRESIDENT' : newRole,
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
    return response.status(200).json({ user: flattenMember(user) })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return response.status(409).json({ message: 'Email or Roll number is already in use.' })
    }
    throw error
  }
}

export async function adminResetPassword(request, response) {
  const target = await prisma.user.findUnique({ where: { id: request.params.id } })
  if (!target) return response.status(404).json({ message: 'Resource not found' })

  const parsed = adminResetPasswordSchema.safeParse(request.body)
  if (!parsed.success) {
    return response.status(400).json({ message: parsed.error.issues[0]?.message || 'Provide a valid new password (12+ chars, upper, lower, number, symbol).' })
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, env.bcryptRounds)
  await prisma.user.update({
    where: { id: target.id },
    data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
  })

  await tryWriteAuditLog({
    actorUserId: request.user.id,
    action: 'ADMIN_PASSWORD_RESET',
    targetUserId: target.id,
    metadata: { memberId: target.memberId },
    ...auditRequest(request),
  })

  return response.status(200).json({ message: `Password reset successfully for Member ID ${target.memberId}.` })
}

export async function deleteMember(request, response) {
  const target = await prisma.user.findUnique({ where: { id: request.params.id } })
  if (!target) return response.status(404).json({ message: 'Resource not found' })
  if (target.id === request.user.id) return response.status(400).json({ message: 'You cannot delete your own account.' })

  if (target.isPrimaryAdmin) {
    const parsed = deleteProtectedAccountSchema.safeParse(request.body)
    if (!parsed.success) return response.status(400).json({ message: 'The Primary President account requires a valid authentication code to delete.' })
    const verification = await verifyPresidentActionCode(target, parsed.data.authenticationCode)
    if (!verification.ok) return response.status(403).json({ message: verification.message })
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

export async function deleteEvent(request, response) {
  const event = await prisma.event.findUnique({ where: { id: request.params.eventId } })
  if (!event) return response.status(404).json({ message: 'Event not found' })

  await prisma.event.delete({ where: { id: request.params.eventId } })
  await tryWriteAuditLog({ actorUserId: request.user.id, action: 'EVENT_DELETED', metadata: { eventId: event.id, title: event.title }, ...auditRequest(request) })
  return response.status(204).end()
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
      email: u?.profile?.email || null,
      phone: u?.profile?.phone || null,
      rollNumber: u?.profile?.rollNumber || reg.formData?.rollNumber || null,
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

  const rows = [
    ['Registration ID', 'Member ID', 'Full Name', 'Roll Number', 'Email', 'Phone', 'Branch', 'Year', 'Activities', 'Amount', 'Payment Status', 'Payment UTR', 'Registration Date'],
  ]

  event.registrations.forEach(reg => {
    const u = userMap.get(reg.userId)
    const activitiesStr = Array.isArray(reg.selectedActivities) ? reg.selectedActivities.map(a => a.name).join('; ') : ''
    rows.push([
      reg.id,
      u?.memberId || '',
      u?.profile?.name || '',
      u?.profile?.rollNumber || reg.formData?.rollNumber || '',
      u?.profile?.email || '',
      u?.profile?.phone || '',
      reg.branch || u?.profile?.department || '',
      reg.year || u?.profile?.year || '',
      `"${activitiesStr.replaceAll('"', '""')}"`,
      Number(reg.totalAmount) || 0,
      reg.paymentStatus,
      reg.paymentReference || '',
      new Date(reg.registeredAt).toLocaleString(),
    ])
  })

  const csvContent = rows.map(r => r.join(',')).join('\n')
  response.setHeader('Content-Type', 'text/csv')
  response.setHeader('Content-Disposition', `attachment; filename="event_${event.id}_registrations.csv"`)
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
  const auditLogs = await prisma.auditLog.findMany({ take: 100, orderBy: { createdAt: 'desc' }, select: { id: true, action: true, ipAddress: true, createdAt: true, actorUserId: true, targetUserId: true, metadata: true } })
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
  const parsed = galleryPhotoSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ message: parsed.error.issues[0]?.message || 'Upload a valid photo.' })
  const album = await prisma.galleryAlbum.findUnique({ where: { id: request.params.albumId } })
  if (!album) return response.status(404).json({ message: 'Album not found.' })

  const photo = await prisma.galleryPhoto.create({
    data: { id: newId(), albumId: album.id, ...parsed.data },
  })
  if (!album.coverImage) {
    await prisma.galleryAlbum.update({ where: { id: album.id }, data: { coverImage: photo.imageUrl } })
  }
  await tryWriteAuditLog({ actorUserId: request.user.id, action: 'GALLERY_PHOTO_ADDED', metadata: { albumId: album.id, photoId: photo.id }, ...auditRequest(request) })
  return response.status(201).json({ photo })
}

export async function deleteGalleryAlbum(request, response) {
  const album = await prisma.galleryAlbum.findUnique({ where: { id: request.params.albumId } })
  if (!album) return response.status(404).json({ message: 'Album not found.' })
  await prisma.galleryAlbum.delete({ where: { id: album.id } })
  await tryWriteAuditLog({ actorUserId: request.user.id, action: 'GALLERY_ALBUM_DELETED', metadata: { albumId: album.id, name: album.name }, ...auditRequest(request) })
  return response.status(204).end()
}

export async function listClubTeam(request, response) {
  const team = await prisma.clubTeamMember.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] })
  return response.status(200).json({ team })
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

  await tryWriteAuditLog({ actorUserId: request.user.id, action: 'CLUB_SETTINGS_UPDATED', metadata: { keys: Object.keys(parsed.data) }, ...auditRequest(request) })
  return response.status(200).json({ message: 'Club settings updated successfully.' })
}
