import crypto from 'node:crypto'
import { prisma } from '../db/prisma.js'
import { tryWriteAuditLog } from '../services/audit.service.js'
import { toSafeUser } from '../utils/safe-user.js'
import { eventRegistrationSchema, profileUpdateSchema } from '../validators/member.validator.js'

function auditRequest(request) {
  return { ipAddress: request.ip, userAgent: request.get('user-agent') || null }
}

function serializeEventForStudent(event, userId) {
  const userRegistration = event.registrations?.find(r => r.userId === userId) || event.registrations?.[0] || null
  return {
    id: event.id,
    title: event.title,
    shortDescription: event.shortDescription,
    description: event.description,
    eventType: event.eventType,
    dateTime: event.dateTime,
    startTime: event.startTime,
    endTime: event.endTime,
    venue: event.venue,
    location: event.location,
    capacity: event.capacity,
    photoUrl: event.photoUrl,
    status: event.status,
    coordinatorName: event.coordinatorName,
    coordinatorContact: event.coordinatorContact,
    organizingTeam: event.organizingTeam,
    speakerName: event.speakerName,
    speakerPhoto: event.speakerPhoto,
    speakerDesignation: event.speakerDesignation,
    registrationDeadline: event.registrationDeadline,
    contactEmail: event.contactEmail,
    contactPhone: event.contactPhone,
    socialLinks: event.socialLinks,
    rules: event.rules,
    eligibility: event.eligibility,
    requiredMaterials: event.requiredMaterials,
    agenda: event.agenda,
    faq: event.faq,
    notes: event.notes,
    requiresPayment: event.requiresPayment,
    paymentAmount: event.paymentAmount ? Number(event.paymentAmount) : null,
    paymentQrUrl: event.paymentQrUrl,
    paymentUpiId: event.paymentUpiId,
    paymentInstructions: event.paymentInstructions,
    paymentDeadline: event.paymentDeadline,
    requirePaymentProof: event.requirePaymentProof,
    allowMultipleActivities: event.allowMultipleActivities,
    registrationCount: event._count?.registrations ?? event.registrations?.length ?? 0,
    isRegistered: Boolean(userRegistration),
    registrationStatus: userRegistration?.status || null,
    paymentStatus: userRegistration?.paymentStatus || null,
    userRegistration: userRegistration ? {
      id: userRegistration.id,
      status: userRegistration.status,
      paymentStatus: userRegistration.paymentStatus,
      totalAmount: Number(userRegistration.totalAmount),
      selectedActivities: userRegistration.selectedActivities,
      paymentReference: userRegistration.paymentReference,
    } : null,
    activities: event.activities?.map(a => ({
      id: a.id,
      name: a.name,
      description: a.description,
      price: Number(a.price),
      capacity: a.capacity,
      isAvailable: a.isAvailable,
      instructions: a.instructions,
    })) || [],
    formFields: event.formFields || [],
  }
}

export async function listPublishedEvents(request, response) {
  const events = await prisma.event.findMany({
    where: { status: { in: ['UPCOMING', 'OPEN', 'LIVE'] } },
    include: {
      activities: { where: { isAvailable: true }, orderBy: { sortOrder: 'asc' } },
      formFields: true,
      registrations: { where: { userId: request.user.id } },
      _count: { select: { registrations: true } },
    },
    orderBy: { dateTime: 'asc' },
  })

  return response.status(200).json({
    events: events.map(e => serializeEventForStudent(e, request.user.id)),
  })
}

export async function getEventDetails(request, response) {
  const event = await prisma.event.findUnique({
    where: { id: request.params.eventId },
    include: {
      activities: { orderBy: { sortOrder: 'asc' } },
      formFields: true,
      registrations: { where: { userId: request.user.id } },
      _count: { select: { registrations: true } },
    },
  })
  if (!event) return response.status(404).json({ message: 'Event not found.' })

  return response.status(200).json({
    event: serializeEventForStudent(event, request.user.id),
  })
}

export async function registerForEvent(request, response) {
  const event = await prisma.event.findUnique({
    where: { id: request.params.eventId },
    include: {
      activities: true,
      _count: { select: { registrations: true } },
    },
  })
  if (!event || !['UPCOMING', 'OPEN', 'LIVE'].includes(event.status)) {
    return response.status(404).json({ message: 'Event is not open for registration.' })
  }
  if (event.registrationDeadline && new Date() > new Date(event.registrationDeadline)) {
    return response.status(400).json({ message: 'Registration deadline for this event has passed.' })
  }
  if (event.capacity && event._count.registrations >= event.capacity) {
    return response.status(409).json({ message: 'This event has reached full capacity.' })
  }

  const existing = await prisma.eventRegistration.findUnique({
    where: { eventId_userId: { eventId: event.id, userId: request.user.id } },
  })
  if (existing) return response.status(409).json({ message: 'You are already registered for this event.' })

  const parsed = eventRegistrationSchema.safeParse(request.body)
  if (!parsed.success) {
    return response.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid registration details.' })
  }

  const data = parsed.data

  // Calculate total price server-side based on selected activities or base event fee
  let totalAmount = 0
  const selectedActivitiesList = []

  if (event.activities && event.activities.length > 0 && data.selectedActivityIds && data.selectedActivityIds.length > 0) {
    const activityMap = new Map(event.activities.map(a => [a.id, a]))
    const chosenIds = event.allowMultipleActivities ? data.selectedActivityIds : data.selectedActivityIds.slice(0, 1)

    for (const actId of chosenIds) {
      const act = activityMap.get(actId)
      if (act && act.isAvailable) {
        totalAmount += Number(act.price)
        selectedActivitiesList.push({ id: act.id, name: act.name, price: Number(act.price) })
      }
    }
  } else if (event.requiresPayment && event.paymentAmount) {
    totalAmount = Number(event.paymentAmount)
  }

  let paymentStatus = 'FREE'
  let registrationStatus = 'REGISTERED'

  if (totalAmount > 0) {
    if (data.paymentProofUrl || data.paymentReference) {
      paymentStatus = 'SUBMITTED'
      registrationStatus = 'PENDING'
    } else {
      paymentStatus = 'PENDING'
      registrationStatus = 'PENDING_PAYMENT'
    }
  }

  const registration = await prisma.eventRegistration.create({
    data: {
      id: crypto.randomUUID(),
      eventId: event.id,
      userId: request.user.id,
      selectedActivities: selectedActivitiesList.length ? selectedActivitiesList : undefined,
      totalAmount,
      paymentStatus,
      paymentReference: data.paymentReference || null,
      paymentProofUrl: data.paymentProofUrl || null,
      branch: data.branch || request.user.profile?.department || null,
      section: data.section || null,
      year: data.year || request.user.profile?.year || null,
      emergencyContact: data.emergencyContact || null,
      teamName: data.teamName || null,
      github: data.github || null,
      formData: data.formData || null,
      status: registrationStatus,
    },
  })

  await tryWriteAuditLog({
    actorUserId: request.user.id,
    action: 'EVENT_REGISTERED',
    metadata: {
      eventId: event.id,
      title: event.title,
      totalAmount,
      paymentStatus,
      selectedActivities: selectedActivitiesList,
    },
    ...auditRequest(request),
  })

  return response.status(201).json({
    registration: { ...registration, totalAmount: Number(registration.totalAmount) },
  })
}

export async function listMyRegistrations(request, response) {
  const registrations = await prisma.eventRegistration.findMany({
    where: { userId: request.user.id },
    include: {
      event: {
        include: { activities: true },
      },
    },
    orderBy: { registeredAt: 'desc' },
  })

  return response.status(200).json({
    registrations: registrations.map(reg => ({
      ...reg,
      totalAmount: Number(reg.totalAmount),
      event: reg.event ? {
        ...reg.event,
        paymentAmount: reg.event.paymentAmount ? Number(reg.event.paymentAmount) : null,
      } : null,
    })),
  })
}

export async function updateProfile(request, response) {
  const parsed = profileUpdateSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid profile details.' })

  const data = parsed.data
  const user = await prisma.user.update({
    where: { id: request.user.id },
    data: {
      profile: {
        upsert: {
          create: data,
          update: data,
        },
      },
    },
    include: { profile: true, permissions: true },
  })

  await tryWriteAuditLog({
    actorUserId: request.user.id,
    action: 'PROFILE_UPDATED',
    targetUserId: request.user.id,
    metadata: { updatedFields: Object.keys(data) },
    ...auditRequest(request),
  })

  return response.status(200).json({ user: toSafeUser(user) })
}

export async function createComplaint(request, response) {
  const { complaintSchema } = await import('../validators/member.validator.js')
  const parsed = complaintSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ message: parsed.error.issues[0]?.message || 'Please provide a subject and description.' })

  const complaint = await prisma.complaint.create({
    data: {
      id: crypto.randomUUID(),
      userId: request.user.id,
      subject: parsed.data.subject,
      message: parsed.data.message,
    },
  })
  return response.status(201).json({ complaint })
}

export async function listGallery(request, response) {
  const albums = await prisma.galleryAlbum.findMany({
    include: { photos: { orderBy: { createdAt: 'desc' } } },
    orderBy: { createdAt: 'desc' },
  })
  return response.status(200).json({ albums })
}

export async function listClubTeam(request, response) {
  const team = await prisma.clubTeamMember.findMany({
    where: { isActive: true, approvalStatus: { in: ['APPROVED', 'PUBLISHED'] } },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })
  return response.status(200).json({ team })
}

export async function getPublicClubSettings(request, response) {
  const settings = await prisma.clubSetting.findMany()
  const dictionary = {}
  settings.forEach(s => {
    try { dictionary[s.key] = JSON.parse(s.value) } catch { dictionary[s.key] = s.value }
  })
  return response.status(200).json({ settings: dictionary })
}

export async function completeIntroVideo(request, response) {
  if (request.session) {
    request.session.introVideoCompleted = true
  }
  return response.status(200).json({ success: true, introVideoCompleted: true })
}

export async function getSessionStatus(request, response) {
  const isStudent = request.user.role === 'STUDENT'
  const isPrimary = Boolean(request.user.isPrimaryAdmin)
  const introVideoCompleted = isPrimary || !isStudent || Boolean(request.session?.introVideoCompleted)

  let activeStudentCount = 1
  try {
    const rawCount = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT session_id) as activeCount 
      FROM sessions 
      WHERE expires > UNIX_TIMESTAMP()
    `
    activeStudentCount = Number(rawCount?.[0]?.activeCount || 1)
  } catch {
    activeStudentCount = 1
  }

  const requiresWaitingQueue = isStudent && activeStudentCount > 20 && !request.session?.queueCompleted

  return response.status(200).json({
    user: toSafeUser(request.user),
    introVideoCompleted,
    activeStudentCount,
    requiresWaitingQueue,
  })
}

export async function completeWaitingQueue(request, response) {
  if (request.session) {
    request.session.queueCompleted = true
  }
  return response.status(200).json({ success: true })
}
