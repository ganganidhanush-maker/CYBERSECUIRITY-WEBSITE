import crypto from 'node:crypto'
import QRCode from 'qrcode'
import { prisma } from '../db/prisma.js'
import { tryWriteAuditLog } from '../services/audit.service.js'
import { createUserNotification } from '../services/notification.service.js'
import { toSafeUser } from '../utils/safe-user.js'
import { authUserCache } from '../services/auth-cache.service.js'
import { eventRegistrationSchema, profileUpdateSchema } from '../validators/member.validator.js'

function auditRequest(request) {
  return { ipAddress: request.ip, userAgent: request.get('user-agent') || null }
}

function serializeEventForStudent(event, userId) {
  const userRegistration = event.registrations?.find(r => r.userId === userId) || event.registrations?.[0] || null
  const userTeam = event.teams?.find(t => t.leaderId === userId || t.members?.some(m => m.userId === userId)) || null

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
    isTeamEvent: Boolean(event.isTeamEvent),
    minTeamSize: event.minTeamSize || 1,
    maxTeamSize: event.maxTeamSize || 1,
    teamRules: event.teamRules || null,
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
      teamName: userRegistration.teamName,
      isTeamLeader: userRegistration.isTeamLeader,
      formData: userRegistration.formData,
      github: userRegistration.github,
    } : null,
    userTeam: userTeam ? {
      id: userTeam.id,
      teamName: userTeam.teamName,
      status: userTeam.status,
      isLeader: userTeam.leaderId === userId,
      leaderId: userTeam.leaderId,
      members: (userTeam.members || []).map(m => ({
        id: m.id,
        userId: m.userId,
        memberId: m.user?.memberId,
        name: m.user?.profile?.name || m.user?.memberId,
        gender: m.user?.profile?.gender || null,
        status: m.status,
        invitedAt: m.invitedAt,
        respondedAt: m.respondedAt,
      })),
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
      teams: {
        where: {
          OR: [
            { leaderId: request.user.id },
            { members: { some: { userId: request.user.id } } },
          ],
        },
        include: {
          members: {
            include: {
              user: { include: { profile: true } },
            },
          },
        },
      },
      _count: { select: { registrations: true } },
    },
    orderBy: [
      { dateTime: 'desc' },
      { createdAt: 'desc' },
    ],
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
      teams: {
        where: {
          OR: [
            { leaderId: request.user.id },
            { members: { some: { userId: request.user.id } } },
          ],
        },
        include: {
          members: {
            include: {
              user: { include: { profile: true } },
            },
          },
        },
      },
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

  // Auto-accept form & auto-verify payment: no manual reverification needed
  let paymentStatus = totalAmount > 0 ? 'VERIFIED' : 'FREE'
  let registrationStatus = 'REGISTERED'
  const paymentVerifiedAt = totalAmount > 0 ? new Date() : null
  const paymentVerifiedBy = totalAmount > 0 ? 'SYSTEM_AUTO_VERIFIED' : null

  // Update gender & age in profile if provided and not set
  if (data.gender || data.age) {
    prisma.profile.update({
      where: { userId: request.user.id },
      data: {
        ...(data.gender ? { gender: data.gender } : {}),
        ...(data.age ? { age: data.age } : {}),
      },
    }).catch(() => {})
  }

  const regId = crypto.randomUUID()
  const qrPassPayload = `EVENT_PASS:${regId}`
  let qrCodeData = null
  try {
    qrCodeData = await QRCode.toDataURL(qrPassPayload, { margin: 2, width: 300, color: { dark: '#000000', light: '#ffffff' } })
  } catch {}

  const effectiveGender = data.gender || request.user.profile?.gender || null
  const effectiveAge = data.age || request.user.profile?.age || null

  const registration = await prisma.eventRegistration.create({
    data: {
      id: regId,
      eventId: event.id,
      userId: request.user.id,
      selectedActivities: selectedActivitiesList.length ? selectedActivitiesList : undefined,
      totalAmount,
      paymentStatus,
      paymentReference: data.paymentReference || (totalAmount > 0 ? 'AUTO_VERIFIED' : null),
      paymentProofUrl: data.paymentProofUrl || null,
      paymentVerifiedAt,
      paymentVerifiedBy,
      branch: data.branch || request.user.profile?.department || null,
      section: data.section || null,
      year: data.year || request.user.profile?.year || null,
      gender: effectiveGender,
      age: effectiveAge,
      residencyType: data.residencyType || null,
      transportMode: data.transportMode || null,
      hostelType: data.hostelType || null,
      emergencyContact: data.emergencyContact || null,
      teamName: data.teamName || null,
      teamId: data.teamId || null,
      isTeamLeader: Boolean(data.isTeamLeader || (event.isTeamEvent && data.teamName)),
      github: data.github || null,
      formData: data.formData || null,
      status: registrationStatus,
      attendanceMarked: false,
      qrCodeData,
    },
  })

  // If team event and teamId is provided, also generate registrations for accepted team members!
  if (event.isTeamEvent && data.teamId) {
    try {
      const team = await prisma.eventTeam.findUnique({
        where: { id: data.teamId },
        include: {
          members: {
            where: { status: 'ACCEPTED', userId: { not: request.user.id } },
            include: { user: { include: { profile: true } } },
          },
        },
      })

      if (team) {
        await prisma.eventTeam.update({
          where: { id: team.id },
          data: { status: 'REGISTERED' },
        })

        for (const member of team.members) {
          const mExisting = await prisma.eventRegistration.findUnique({
            where: { eventId_userId: { eventId: event.id, userId: member.userId } },
          })
          if (!mExisting) {
            const mRegId = crypto.randomUUID()
            let mQrCode = null
            try {
              mQrCode = await QRCode.toDataURL(`EVENT_PASS:${mRegId}`, { margin: 2, width: 300, color: { dark: '#000000', light: '#ffffff' } })
            } catch {}

            await prisma.eventRegistration.create({
              data: {
                id: mRegId,
                eventId: event.id,
                userId: member.userId,
                selectedActivities: selectedActivitiesList.length ? selectedActivitiesList : undefined,
                totalAmount: 0,
                paymentStatus,
                paymentReference: data.paymentReference || (totalAmount > 0 ? 'AUTO_VERIFIED' : null),
                paymentProofUrl: data.paymentProofUrl || null,
                paymentVerifiedAt,
                paymentVerifiedBy,
                branch: member.user?.profile?.department || null,
                year: member.user?.profile?.year || null,
                gender: member.user?.profile?.gender || null,
                age: member.user?.profile?.age || null,
                residencyType: data.residencyType || null,
                transportMode: data.transportMode || null,
                hostelType: data.hostelType || null,
                teamName: team.teamName,
                teamId: team.id,
                isTeamLeader: false,
                status: registrationStatus,
                attendanceMarked: false,
                qrCodeData: mQrCode,
              },
            })

            // Notify member that team pass is ready
            createUserNotification({
              userId: member.userId,
              type: 'EVENT_REGISTRATION',
              title: `Team Pass Generated: ${event.title}`,
              message: `Your team "${team.teamName}" has been successfully registered for "${event.title}" by team leader ${request.user.name}. Your digital pass is now ready in your pass wallet!`,
              linkUrl: '/student-passes',
            }).catch(() => {})
          }
        }
      }
    } catch (teamErr) {
      console.error('[TEAM REGISTRATION PROPAGATION ERROR]:', teamErr.message)
    }
  }

  await tryWriteAuditLog({
    actorUserId: request.user.id,
    action: 'EVENT_REGISTERED',
    metadata: {
      eventId: event.id,
      title: event.title,
      totalAmount,
      paymentStatus,
      teamName: data.teamName || null,
      selectedActivities: selectedActivitiesList,
    },
    ...auditRequest(request),
  })

  return response.status(201).json({
    registration: {
      ...registration,
      totalAmount: Number(registration.totalAmount),
      qrCodeData: registration.qrCodeData || qrCodeData,
    },
  })
}

// ----------------------------------------------------
// Team Formation & Invite Flow
// ----------------------------------------------------
export async function lookupMemberForTeam(request, response) {
  const query = String(request.params.memberId || request.query.q || '').trim().toUpperCase()
  if (!query || query.length < 3) {
    return response.status(400).json({ message: 'Enter at least 3 characters of Member ID or Roll Number.' })
  }

  const user = await prisma.user.findFirst({
    where: {
      memberId: query,
      accountStatus: 'ACTIVE',
    },
    include: {
      profile: true,
    },
  })

  if (!user) {
    return response.status(404).json({ message: `No active student found with Member ID "${query}".` })
  }

  if (user.id === request.user.id) {
    return response.status(400).json({ message: 'You cannot invite yourself to your team.' })
  }

  return response.status(200).json({
    member: {
      id: user.id,
      memberId: user.memberId,
      name: user.profile?.name || user.memberId,
      rollNumber: user.profile?.rollNumber || user.memberId,
      department: user.profile?.department || 'CSE',
      year: user.profile?.year || 1,
      gender: user.profile?.gender || 'UNSPECIFIED',
      age: user.profile?.age || null,
      profileImage: user.profile?.profileImage || null,
    },
  })
}

export async function createEventTeam(request, response) {
  const { eventId } = request.params
  const { teamName, invitedMemberIds = [] } = request.body

  if (!teamName || !teamName.trim()) {
    return response.status(400).json({ message: 'Team name is required.' })
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
  })
  if (!event || !event.isTeamEvent) {
    return response.status(400).json({ message: 'This event is not configured for team participation.' })
  }

  // Check if leader already has a team for this event
  const existingTeam = await prisma.eventTeam.findFirst({
    where: {
      eventId,
      OR: [
        { leaderId: request.user.id },
        { members: { some: { userId: request.user.id } } },
      ],
    },
  })
  if (existingTeam) {
    return response.status(409).json({ message: 'You are already in or leading a team for this event.' })
  }

  // Verify unique member IDs
  const cleanInvitedIds = [...new Set(invitedMemberIds.filter(id => id && id !== request.user.id))]

  // Create team & leader record
  const team = await prisma.eventTeam.create({
    data: {
      id: crypto.randomUUID(),
      eventId,
      leaderId: request.user.id,
      teamName: teamName.trim(),
      status: 'FORMING',
      members: {
        create: [
          {
            userId: request.user.id,
            status: 'ACCEPTED',
            respondedAt: new Date(),
          },
          ...cleanInvitedIds.map(uid => ({
            userId: uid,
            status: 'INVITED',
          })),
        ],
      },
    },
    include: {
      members: {
        include: {
          user: { include: { profile: true } },
        },
      },
    },
  })

  // Send notifications to all invited members
  for (const uid of cleanInvitedIds) {
    createUserNotification({
      userId: uid,
      type: 'TEAM_INVITE',
      title: `Team Invitation: ${event.title}`,
      message: `${request.user.name} has invited you to join Team "${teamName.trim()}" for ${event.title}. Open your portal to Accept or Decline.`,
      linkUrl: `/event-detail/${eventId}`,
    }).catch(() => {})
  }

  return response.status(201).json({
    team: {
      id: team.id,
      teamName: team.teamName,
      status: team.status,
      isLeader: true,
      members: team.members.map(m => ({
        id: m.id,
        userId: m.userId,
        memberId: m.user?.memberId,
        name: m.user?.profile?.name || m.user?.memberId,
        gender: m.user?.profile?.gender || null,
        status: m.status,
        invitedAt: m.invitedAt,
        respondedAt: m.respondedAt,
      })),
    },
  })
}

export async function respondTeamInvite(request, response) {
  const { inviteId } = request.params
  const { accept } = request.body

  const memberRecord = await prisma.eventTeamMember.findUnique({
    where: { id: inviteId },
    include: {
      team: {
        include: {
          event: true,
          leader: { include: { profile: true } },
        },
      },
    },
  })

  if (!memberRecord || memberRecord.userId !== request.user.id) {
    return response.status(404).json({ message: 'Team invitation not found.' })
  }

  const newStatus = accept ? 'ACCEPTED' : 'REJECTED'
  const updated = await prisma.eventTeamMember.update({
    where: { id: inviteId },
    data: {
      status: newStatus,
      respondedAt: new Date(),
    },
  })

  // Notify team leader of member's decision
  createUserNotification({
    userId: memberRecord.team.leaderId,
    type: 'TEAM_RESPONSE',
    title: `Team Invite ${accept ? 'Accepted' : 'Declined'}`,
    message: `${request.user.name} has ${accept ? 'ACCEPTED' : 'DECLINED'} your invitation to join Team "${memberRecord.team.teamName}".`,
    linkUrl: `/event-detail/${memberRecord.team.eventId}`,
  }).catch(() => {})

  return response.status(200).json({
    success: true,
    status: newStatus,
    message: accept ? `You joined Team "${memberRecord.team.teamName}"!` : `You declined the invitation to Team "${memberRecord.team.teamName}".`,
  })
}

export async function removeTeamMember(request, response) {
  const { teamId, memberId } = request.params

  const team = await prisma.eventTeam.findUnique({
    where: { id: teamId },
    include: { members: true },
  })

  if (!team || team.leaderId !== request.user.id) {
    return response.status(403).json({ message: 'Only the team leader can remove team members.' })
  }

  if (team.status === 'REGISTERED') {
    return response.status(400).json({ message: 'Cannot modify team members after registration and pass issuance.' })
  }

  if (memberId === request.user.id) {
    return response.status(400).json({ message: 'Leader cannot remove themselves from the team.' })
  }

  await prisma.eventTeamMember.deleteMany({
    where: {
      teamId,
      userId: memberId,
    },
  })

  return response.status(200).json({ success: true, message: 'Member removed from team.' })
}

export async function listMyTeamInvites(request, response) {
  const invites = await prisma.eventTeamMember.findMany({
    where: {
      userId: request.user.id,
      status: 'INVITED',
    },
    include: {
      team: {
        include: {
          event: true,
          leader: { include: { profile: true } },
          members: {
            include: { user: { include: { profile: true } } },
          },
        },
      },
    },
    orderBy: { invitedAt: 'desc' },
  })

  return response.status(200).json({
    invites: invites.map(inv => ({
      inviteId: inv.id,
      status: inv.status,
      invitedAt: inv.invitedAt,
      teamId: inv.team.id,
      teamName: inv.team.teamName,
      eventId: inv.team.eventId,
      eventTitle: inv.team.event.title,
      eventDate: inv.team.event.dateTime,
      leaderName: inv.team.leader?.profile?.name || inv.team.leader?.memberId,
      leaderMemberId: inv.team.leader?.memberId,
      teamMembersCount: inv.team.members.length,
      acceptedCount: inv.team.members.filter(m => m.status === 'ACCEPTED').length,
    })),
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

  const enrichedRegistrations = await Promise.all(
    registrations.map(async reg => {
      let qrCode = reg.qrCodeData
      if (!qrCode) {
        try {
          qrCode = await QRCode.toDataURL(`EVENT_PASS:${reg.id}`, { margin: 2, width: 300, color: { dark: '#000000', light: '#ffffff' } })
          prisma.eventRegistration.update({ where: { id: reg.id }, data: { qrCodeData: qrCode } }).catch(() => {})
        } catch {}
      }
      return {
        ...reg,
        totalAmount: Number(reg.totalAmount),
        qrCodeData: qrCode,
        event: reg.event ? {
          ...reg.event,
          paymentAmount: reg.event.paymentAmount ? Number(reg.event.paymentAmount) : null,
        } : null,
      }
    })
  )

  return response.status(200).json({
    registrations: enrichedRegistrations,
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

  authUserCache.invalidate(request.user.id)
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

export async function getGalleryAlbum(request, response) {
  const { albumId } = request.params
  const album = await prisma.galleryAlbum.findUnique({
    where: { id: albumId },
    include: { photos: { orderBy: { createdAt: 'desc' } } },
  })
  if (!album) return response.status(404).json({ message: 'Album not found.' })
  return response.status(200).json({ album })
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

  const introVideoSetting = await prisma.clubSetting.findUnique({ where: { key: 'introVideoEnabled' } })
  const isVideoEnabled = introVideoSetting?.value !== 'false' && introVideoSetting?.value !== false

  const introVideoCompleted = isPrimary || !isStudent || !isVideoEnabled || Boolean(request.session?.introVideoCompleted)

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

// ----------------------------------------------------
// Student Helpdesk & Doubts
// ----------------------------------------------------
export async function createSupportTicket(request, response) {
  const { taggedRole, subject, message } = request.body || {}

  const validRoles = [
    'PRESIDENT',
    'VICE_PRESIDENT',
    'STUDENT_COORDINATOR',
    'TREASURER',
    'EVENT_MANAGEMENT',
    'MEDIA_LEAD',
    'SOCIAL_MEDIA_LEAD',
    'TECH_TEAM',
    'PR_TEAM',
    'CULTURAL',
    'SECRETARY',
  ]

  if (!taggedRole || !validRoles.includes(taggedRole)) {
    return response.status(400).json({ message: 'Please select a valid leadership role to tag (e.g. PRESIDENT, TECH_TEAM).' })
  }

  if (!subject || !String(subject).trim() || !message || !String(message).trim()) {
    return response.status(400).json({ message: 'Subject and question description are required.' })
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      userId: request.user.id,
      taggedRole,
      subject: String(subject).trim(),
      message: String(message).trim(),
      status: 'OPEN',
    },
    include: {
      user: { include: { profile: true } },
      replies: true,
    },
  })

  // Notify admins of that role
  await prisma.notification.create({
    data: {
      type: 'SUPPORT_DOUBT',
      title: `❓ New Doubt for @${taggedRole}`,
      message: `${request.user.profile?.name || request.user.memberId} asked: "${ticket.subject}"`,
      linkUrl: '/admin-support',
    },
  }).catch(() => {})

  return response.status(201).json({ ticket })
}

export async function listStudentSupportTickets(request, response) {
  const tickets = await prisma.supportTicket.findMany({
    where: { userId: request.user.id },
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

export async function replyStudentSupportTicket(request, response) {
  const { id } = request.params
  const { message } = request.body || {}

  if (!message || !String(message).trim()) {
    return response.status(400).json({ message: 'Reply message cannot be empty.' })
  }

  const ticket = await prisma.supportTicket.findUnique({ where: { id } })
  if (!ticket || ticket.userId !== request.user.id) {
    return response.status(404).json({ message: 'Support ticket not found.' })
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

  return response.status(201).json({ reply })
}

// ----------------------------------------------------
// In-App Notification Center
// ----------------------------------------------------
export async function listNotifications(request, response) {
  const notifications = await prisma.notification.findMany({
    where: {
      OR: [
        { userId: request.user.id },
        { userId: null },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })

  const unreadCount = notifications.filter(n => !n.isRead).length
  return response.status(200).json({ notifications, unreadCount })
}

export async function markNotificationRead(request, response) {
  const { id } = request.params
  await prisma.notification.updateMany({
    where: {
      id,
      OR: [
        { userId: request.user.id },
        { userId: null },
      ],
    },
    data: { isRead: true },
  }).catch(() => {})

  return response.status(200).json({ success: true })
}

export async function markAllNotificationsRead(request, response) {
  await prisma.notification.updateMany({
    where: {
      OR: [
        { userId: request.user.id },
        { userId: null },
      ],
    },
    data: { isRead: true },
  }).catch(() => {})

  return response.status(200).json({ success: true })
}

// ----------------------------------------------------
// CAMPUS & EVENT REELS (STUDENT / MEMBER STREAM)
// ----------------------------------------------------
function shuffleArray(array) {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export async function listPublicReels(request, response) {
  const { category, search, platformMode } = request.query
  const userId = request.user?.id || null

  const where = {
    isActive: true,
  }

  const andConditions = []

  if (category && category !== 'ALL') {
    andConditions.push({ category })
  }

  if (platformMode && platformMode !== 'ALL') {
    andConditions.push({
      OR: [
        { platformMode },
        { platformMode: 'ALL' },
      ],
    })
  }

  if (search) {
    andConditions.push({
      OR: [
        { title: { contains: search } },
        { description: { contains: search } },
        { postedBy: { contains: search } },
        { authorHandle: { contains: search } },
      ],
    })
  }

  if (andConditions.length > 0) {
    where.AND = andConditions
  }

  const allReels = await prisma.campusReel.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })

  // Per-user watch and like state
  let viewedReelIds = new Set()
  let likedReelIds = new Set()

  if (userId) {
    try {
      const views = await prisma.reelView.findMany({
        where: { userId },
        select: { reelId: true },
      })
      viewedReelIds = new Set(views.map(v => v.reelId))

      const likes = await prisma.reelLike.findMany({
        where: { userId },
        select: { reelId: true },
      })
      likedReelIds = new Set(likes.map(l => l.reelId))
    } catch {}
  }

  // Tag reels with user context
  const taggedReels = allReels.map(reel => ({
    ...reel,
    isWatched: viewedReelIds.has(reel.id),
    isLiked: likedReelIds.has(reel.id),
  }))

  // Smart Priority Push Algorithm:
  // 1. Newly uploaded admin reels that the user HAS NOT watched yet -> TOP PRIORITY (newest first)
  // 2. Freshly uploaded admin posts / featured highlights (newest first)
  // 3. All remaining reels / profile synced stream pool -> Randomized discovery stream
  const now = Date.now()
  const unwatchedAdminReels = taggedReels
    .filter(r => r.isAdminUpload && !r.isWatched)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const freshFeaturedAdminReels = taggedReels
    .filter(r => r.isAdminUpload && r.isWatched && (r.isFeatured || (now - new Date(r.createdAt).getTime() < 48 * 3600 * 1000)))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const remainingReels = taggedReels.filter(r => 
    !(r.isAdminUpload && !r.isWatched) && 
    !(r.isAdminUpload && r.isWatched && (r.isFeatured || (now - new Date(r.createdAt).getTime() < 48 * 3600 * 1000)))
  )

  const shuffledPool = shuffleArray(remainingReels)
  const finalFeed = [...unwatchedAdminReels, ...freshFeaturedAdminReels, ...shuffledPool]

  return response.status(200).json({ reels: finalFeed })
}

export async function likeReel(request, response) {
  const { id } = request.params
  const userId = request.user?.id || null

  const reel = await prisma.campusReel.findUnique({ where: { id } })
  if (!reel) {
    return response.status(404).json({ message: 'Reel not found.' })
  }

  let isLiked = false
  let currentLikes = reel.likesCount

  if (userId) {
    try {
      const existing = await prisma.reelLike.findUnique({
        where: { reelId_userId: { reelId: id, userId } },
      })

      if (existing) {
        await prisma.reelLike.delete({
          where: { reelId_userId: { reelId: id, userId } },
        })
        const updated = await prisma.campusReel.update({
          where: { id },
          data: { likesCount: { decrement: 1 } },
        })
        isLiked = false
        currentLikes = Math.max(0, updated.likesCount)
      } else {
        await prisma.reelLike.create({
          data: { reelId: id, userId },
        })
        const updated = await prisma.campusReel.update({
          where: { id },
          data: { likesCount: { increment: 1 } },
        })
        isLiked = true
        currentLikes = updated.likesCount
      }
    } catch {
      const updated = await prisma.campusReel.update({
        where: { id },
        data: { likesCount: { increment: 1 } },
      })
      isLiked = true
      currentLikes = updated.likesCount
    }
  } else {
    const updated = await prisma.campusReel.update({
      where: { id },
      data: { likesCount: { increment: 1 } },
    })
    isLiked = true
    currentLikes = updated.likesCount
  }

  return response.status(200).json({ likesCount: currentLikes, isLiked })
}

export async function recordReelView(request, response) {
  const { id } = request.params
  const userId = request.user?.id || null

  const reel = await prisma.campusReel.findUnique({ where: { id } })
  if (!reel) {
    return response.status(404).json({ message: 'Reel not found.' })
  }

  let currentViews = reel.viewsCount

  if (userId) {
    try {
      const existing = await prisma.reelView.findUnique({
        where: { reelId_userId: { reelId: id, userId } },
      })

      if (!existing) {
        await prisma.reelView.create({
          data: { reelId: id, userId },
        })
        const updated = await prisma.campusReel.update({
          where: { id },
          data: { viewsCount: { increment: 1 } },
        })
        currentViews = updated.viewsCount
      }
    } catch {
      const updated = await prisma.campusReel.update({
        where: { id },
        data: { viewsCount: { increment: 1 } },
      })
      currentViews = updated.viewsCount
    }
  } else {
    const updated = await prisma.campusReel.update({
      where: { id },
      data: { viewsCount: { increment: 1 } },
    })
    currentViews = updated.viewsCount
  }

  return response.status(200).json({ viewsCount: currentViews, isWatched: true })
}

export async function submitEventCompletion(request, response) {
  const { eventId } = request.params
  const { projectUrl, demoUrl, completionConfirmed, notes } = request.body || {}

  const registration = await prisma.eventRegistration.findUnique({
    where: { eventId_userId: { eventId, userId: request.user.id } },
  })

  if (!registration) {
    return response.status(404).json({ message: 'No active event registration found for this user.' })
  }

  const existingFormData = (typeof registration.formData === 'object' && registration.formData) || {}
  const updatedFormData = {
    ...existingFormData,
    completionConfirmed: Boolean(completionConfirmed ?? true),
    completionSubmittedAt: new Date().toISOString(),
    projectUrl: projectUrl || existingFormData.projectUrl || null,
    demoUrl: demoUrl || existingFormData.demoUrl || null,
    completionNotes: notes || existingFormData.completionNotes || null,
  }

  const updated = await prisma.eventRegistration.update({
    where: { id: registration.id },
    data: {
      formData: updatedFormData,
      status: 'COMPLETED',
      ...(projectUrl ? { github: projectUrl } : {}),
    },
  })

  return response.status(200).json({
    message: '✓ Hackathon project and event completion submitted successfully! Your participation is marked complete.',
    registration: updated,
  })
}



