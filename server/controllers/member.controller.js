import crypto from 'node:crypto'
import QRCode from 'qrcode'
import { prisma } from '../db/prisma.js'
import { tryWriteAuditLog } from '../services/audit.service.js'
import { createUserNotification } from '../services/notification.service.js'
import { toSafeUser } from '../utils/safe-user.js'
import { authUserCache } from '../services/auth-cache.service.js'
import { eventRegistrationSchema, profileUpdateSchema, projectSubmissionSchema, resubmitPaymentSchema } from '../validators/member.validator.js'
import { hasActiveEventPass, isDraftRegistration, resolveEventPricing, resolveEventRegistrationMode, submittedRegistrationWhere } from '../utils/event-registration.js'
import { acquirePaymentReferenceLock, findActivePaymentReferenceDuplicate, releasePaymentReferenceLock } from '../utils/payment-reference-lock.js'

function auditRequest(request) {
  return { ipAddress: request.ip, userAgent: request.get('user-agent') || null }
}

function serializeEventForStudent(event, userId) {
  const userRows = event.registrations?.filter(r => r.userId === userId) || []
  const userRegistration = userRows.find(r => !isDraftRegistration(r)) || null
  const registrationDraft = userRows.find(isDraftRegistration) || null
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
    registrationType: event.registrationType || (event.isTeamEvent ? 'TEAM' : 'INDIVIDUAL'),
    externalFormUrl: event.externalFormUrl || null,
    workflowConfig: event.workflowConfig || null,
    teamConfig: event.teamConfig || null,
    paymentConfig: event.paymentConfig || null,
    submissionConfig: event.submissionConfig || null,
    eligibilityConfig: event.eligibilityConfig || null,
    customQuestions: event.customQuestions || null,
    registrationCount: event._count?.registrations ?? event.registrations?.filter(r => !isDraftRegistration(r)).length ?? 0,
    isRegistered: Boolean(userRegistration),
    hasActivePass: hasActiveEventPass(userRegistration),
    registrationStatus: userRegistration?.status || null,
    paymentStatus: userRegistration?.paymentStatus || null,
    registrationDraft: registrationDraft ? {
      registrationType: registrationDraft.registrationType,
      teamName: registrationDraft.teamName,
      teamId: registrationDraft.teamId,
      formData: registrationDraft.formData,
      selectedActivities: registrationDraft.selectedActivities,
      paymentOption: registrationDraft.paymentOption,
    } : null,
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
      paymentOption: userRegistration.paymentOption,
      amountPaid: userRegistration.amountPaid !== null && userRegistration.amountPaid !== undefined ? Number(userRegistration.amountPaid) : null,
      paymentMethod: userRegistration.paymentMethod,
      paymentSubmittedAt: userRegistration.paymentSubmittedAt,
      paymentRejectionReason: userRegistration.paymentRejectionReason,
      projectSubmission: userRegistration.projectSubmission,
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
        department: m.user?.profile?.department || null,
        year: m.user?.profile?.year || null,
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
      _count: { select: { registrations: { where: submittedRegistrationWhere() } } },
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
      _count: { select: { registrations: { where: submittedRegistrationWhere() } } },
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
      _count: { select: { registrations: { where: submittedRegistrationWhere() } } },
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
  if (existing && !isDraftRegistration(existing)) {
    return response.status(409).json({ message: 'You are already registered for this event.' })
  }

  const parsed = eventRegistrationSchema.safeParse(request.body)
  if (!parsed.success) {
    return response.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid registration details.' })
  }

  const data = parsed.data

  // Team mode must be enabled by the event itself; client-supplied names/IDs
  // cannot turn an individual event into a team event or bypass team checks.
  const { supportsTeams: eventAllowsTeams, isTeam } = resolveEventRegistrationMode(event, data.registrationType)
  if (data.registrationType === 'TEAM' && !eventAllowsTeams) {
    return response.status(400).json({ message: 'This event is not configured for team registration.' })
  }
  const rawMembers = Array.isArray(data.teamMembers) ? data.teamMembers : []
  if (rawMembers.length > 0) {
    return response.status(400).json({ message: 'Team members must accept an invitation before the team leader submits registration.' })
  }
  if (!isTeam && (data.teamName || data.teamId)) {
    return response.status(400).json({ message: 'Team details are not allowed for an individual registration.' })
  }

  const teamConfig = (typeof event.teamConfig === 'object' && event.teamConfig) || {}
  const minTeamSize = Number(teamConfig.minTeamSize || teamConfig.minSize || event.minTeamSize || 1)
  const maxTeamSize = Number(teamConfig.maxTeamSize || teamConfig.maxSize || event.maxTeamSize || 1)

  let teamUserIds = [request.user.id]
  let existingTeam = null
  if (isTeam) {
    if (!data.teamId) {
      return response.status(400).json({ message: 'Create a team and wait for invited members to accept before registering.' })
    }
    existingTeam = await prisma.eventTeam.findFirst({
      where: { id: data.teamId, eventId: event.id, leaderId: request.user.id },
      include: {
        members: {
          where: { status: 'ACCEPTED' },
          include: { user: { include: { profile: true } } },
        },
      },
    })
    if (!existingTeam) {
      return response.status(403).json({ message: 'Only the leader of this event’s team can submit its registration.' })
    }
    if (existingTeam.status === 'REGISTERED') {
      return response.status(409).json({ message: 'This team has already been submitted for registration.' })
    }
    for (const member of existingTeam.members || []) {
      if (!teamUserIds.includes(member.userId)) teamUserIds.push(member.userId)
    }
  }

  // 2. Validate team size and membership for all team registrations.
  if (isTeam) {
    if (teamUserIds.length < minTeamSize) {
      return response.status(400).json({
        message: `Team requirement not met: Minimum ${minTeamSize} member(s) required for this event (current team size: ${teamUserIds.length}).`,
      })
    }
    if (teamUserIds.length > maxTeamSize) {
      return response.status(400).json({
        message: `Team requirement not met: Maximum ${maxTeamSize} member(s) allowed for this event (current team size: ${teamUserIds.length}).`,
      })
    }

    const dbMembers = await prisma.user.findMany({
      where: { id: { in: teamUserIds }, accountStatus: 'ACTIVE' },
      include: { profile: true },
    })
    if (dbMembers.length !== teamUserIds.length) {
      return response.status(400).json({ message: 'Every accepted team member must have an active account.' })
    }

    // Prevent duplicate registrations
    const registeredTeammates = await prisma.eventRegistration.findMany({
      where: submittedRegistrationWhere({
        eventId: event.id,
        userId: { in: teamUserIds },
      }),
      include: { event: true },
    })
    if (registeredTeammates.length > 0) {
      const existingUser = dbMembers.find(m => m.id === registeredTeammates[0].userId)
      const name = existingUser?.profile?.name || existingUser?.memberId || 'A team member'
      return response.status(409).json({
        message: `Duplicate registration: ${name} is already registered for this event.`,
      })
    }

    // Gender rules enforcement
    const minFemale = Number(teamConfig.minFemale ?? (teamConfig.requireFemale ? 1 : 0))
    const maxFemale = teamConfig.maxFemale !== null && teamConfig.maxFemale !== undefined && teamConfig.maxFemale !== '' ? Number(teamConfig.maxFemale) : null
    const minMale = teamConfig.minMale !== null && teamConfig.minMale !== undefined && teamConfig.minMale !== '' ? Number(teamConfig.minMale) : null
    const maxMale = teamConfig.maxMale !== null && teamConfig.maxMale !== undefined && teamConfig.maxMale !== '' ? Number(teamConfig.maxMale) : null

    let femaleCount = 0
    let maleCount = 0

    dbMembers.forEach(m => {
      const g = (m.profile?.gender || '').toUpperCase()
      const effectiveG = (m.id === request.user.id && data.gender) ? data.gender.toUpperCase() : g
      if (effectiveG === 'FEMALE') femaleCount++
      else if (effectiveG === 'MALE') maleCount++
    })

    if (minFemale > 0 && femaleCount < minFemale) {
      return response.status(400).json({
        message: `Special Team Rule Violation: At least ${minFemale} female participant(s) required on the team (current female members: ${femaleCount}).`,
      })
    }
    if (maxFemale !== null && femaleCount > maxFemale) {
      return response.status(400).json({
        message: `Special Team Rule Violation: Maximum ${maxFemale} female participant(s) allowed on the team (current: ${femaleCount}).`,
      })
    }
    if (minMale !== null && maleCount < minMale) {
      return response.status(400).json({
        message: `Special Team Rule Violation: At least ${minMale} male participant(s) required on the team (current: ${maleCount}).`,
      })
    }
    if (maxMale !== null && maleCount > maxMale) {
      return response.status(400).json({
        message: `Special Team Rule Violation: Maximum ${maxMale} male participant(s) allowed on the team (current: ${maleCount}).`,
      })
    }

    // Department & Year rules
    if (Array.isArray(teamConfig.allowedDepartments) && teamConfig.allowedDepartments.length > 0) {
      const invalidDept = dbMembers.find(m => {
        const dept = m.profile?.department || (m.id === request.user.id ? data.branch : null)
        return dept && !teamConfig.allowedDepartments.includes(dept)
      })
      if (invalidDept) {
        return response.status(400).json({
          message: `Department Restriction: ${invalidDept.profile?.name || invalidDept.memberId} (${invalidDept.profile?.department}) is not eligible for this event.`,
        })
      }
    }
    if (Array.isArray(teamConfig.allowedYears) && teamConfig.allowedYears.length > 0) {
      const invalidYear = dbMembers.find(m => {
        const yr = m.profile?.year || (m.id === request.user.id ? data.year : null)
        return yr && !teamConfig.allowedYears.includes(Number(yr))
      })
      if (invalidYear) {
        return response.status(400).json({
          message: `Year Restriction: ${invalidYear.profile?.name || invalidYear.memberId} (Year ${invalidYear.profile?.year}) is not eligible for this event.`,
        })
      }
    }
  }

  // 3. Resolve fees from saved event configuration; never accept a client-supplied price.
  let pricing
  try {
    pricing = resolveEventPricing(event, data)
  } catch (pricingError) {
    return response.status(400).json({ message: pricingError.message || 'Unable to resolve this event fee.' })
  }
  const { totalAmount, paymentOption: paymentOptionObj, selectedActivities: selectedActivitiesList } = pricing
  const paymentReference = String(data.paymentReference || '').trim().toUpperCase()

  // Paid event claims must include a transaction reference. Payment is still not
  // considered confirmed until an organizer verifies the UTR.
  if (totalAmount > 0 && !paymentReference) {
    return response.status(400).json({ message: 'Pay the event fee and submit your UPI UTR before completing registration.' })
  }

  // Status mapping. Only a free registration or verified payment gets an active pass.
  let paymentStatus = totalAmount > 0 ? 'UNDER_VERIFICATION' : 'FREE'
  let registrationStatus = totalAmount > 0 ? 'UNDER_VERIFICATION' : 'REGISTERED'
  let paymentVerifiedAt = totalAmount > 0 ? null : new Date()
  let paymentVerifiedBy = totalAmount > 0 ? null : 'SYSTEM_FREE'
  const paymentSubmittedAt = totalAmount > 0 ? new Date() : null

  // Update gender & age in profile if provided
  if (data.gender || data.age) {
    prisma.profile.update({
      where: { userId: request.user.id },
      data: {
        ...(data.gender ? { gender: data.gender } : {}),
        ...(data.age ? { age: data.age } : {}),
      },
    }).catch(() => {})
  }

  // A payment QR is not an entrance pass. Create entrance QR data only for
  // free registrations; paid passes are issued lazily after organizer verification.
  const regId = existing?.id || crypto.randomUUID()
  let qrCodeData = null
  if (hasActiveEventPass({ status: registrationStatus, paymentStatus })) {
    try {
      qrCodeData = await QRCode.toDataURL(`EVENT_PASS:${regId}`, { margin: 2, width: 300, color: { dark: '#000000', light: '#ffffff' } })
    } catch {}
  }

  const effectiveGender = data.gender || request.user.profile?.gender || null
  const effectiveAge = data.age || request.user.profile?.age || null

  // Team registrations must be linked to the validated, leader-owned event team.
  const resolvedTeamId = existingTeam?.id || null
  const resolvedTeamName = existingTeam?.teamName || null

  const registrationData = {
    eventId: event.id,
    userId: request.user.id,
    registrationType: isTeam ? 'TEAM' : 'INDIVIDUAL',
    selectedActivities: selectedActivitiesList,
    paymentOption: paymentOptionObj,
    totalAmount,
    amountPaid: totalAmount > 0 ? null : 0,
    paymentMethod: totalAmount > 0 ? (data.paymentMethod || 'UPI') : null,
    paymentStatus,
    paymentReference: totalAmount > 0 ? paymentReference : null,
    paymentProofUrl: totalAmount > 0 ? data.paymentProofUrl || null : null,
    paymentVerifiedAt,
    paymentVerifiedBy,
    paymentSubmittedAt,
    registeredAt: new Date(),
    branch: data.branch || request.user.profile?.department || null,
    section: data.section || null,
    year: data.year || request.user.profile?.year || null,
    gender: effectiveGender,
    age: effectiveAge,
    residencyType: data.residencyType || null,
    transportMode: data.transportMode || null,
    hostelType: data.hostelType || null,
    emergencyContact: data.emergencyContact || null,
    teamName: resolvedTeamName,
    teamId: resolvedTeamId,
    isTeamLeader: isTeam,
    github: data.github || null,
    formData: data.formData || null,
    projectSubmission: data.projectSubmission || null,
    status: registrationStatus,
    attendanceMarked: false,
    qrCodeData,
  }
  const memberRecordsToCreate = (existingTeam?.members || [])
    .filter(member => member.userId !== request.user.id)
    .map(member => ({
      userId: member.userId,
      department: member.user?.profile?.department,
      year: member.user?.profile?.year,
      gender: member.user?.profile?.gender,
    }))
  const memberNotificationUserIds = []

  // Serialize event registration writes so capacity and attendee-level activity
  // limits cannot be exceeded by concurrent submissions. The leader and every
  // accepted member are persisted together, so partial team registrations fail.
  const transactionResult = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM events WHERE id = ${event.id} FOR UPDATE`
    const latestEvent = await tx.event.findUnique({
      where: { id: event.id },
      include: { activities: true },
    })
    if (!latestEvent || !['UPCOMING', 'OPEN', 'LIVE'].includes(latestEvent.status)) {
      return { conflict: 'EVENT_CLOSED' }
    }
    if (latestEvent.registrationDeadline && new Date() > new Date(latestEvent.registrationDeadline)) {
      return { conflict: 'DEADLINE' }
    }

    let latestPricing
    try {
      latestPricing = resolveEventPricing(latestEvent, data)
    } catch {
      return { conflict: 'PRICING_CHANGED' }
    }
    if (latestPricing.totalAmount !== totalAmount
      || JSON.stringify(latestPricing.selectedActivities) !== JSON.stringify(selectedActivitiesList)
      || JSON.stringify(latestPricing.paymentOption) !== JSON.stringify(paymentOptionObj)) {
      return { conflict: 'PRICING_CHANGED' }
    }

    if (existingTeam) {
      const latestTeam = await tx.eventTeam.findUnique({
        where: { id: existingTeam.id },
        include: { members: { where: { status: 'ACCEPTED' }, select: { userId: true } } },
      })
      if (!latestTeam || latestTeam.eventId !== event.id || latestTeam.leaderId !== request.user.id) {
        return { conflict: 'TEAM_INVALID' }
      }
      if (latestTeam.status === 'REGISTERED') return { conflict: 'TEAM_REGISTERED' }
      const latestMemberIds = new Set([request.user.id, ...(latestTeam.members || []).map(member => member.userId)])
      if (latestMemberIds.size !== teamUserIds.length || teamUserIds.some(userId => !latestMemberIds.has(userId))) {
        return { conflict: 'TEAM_CHANGED' }
      }
    }

    const activeTeamRegistration = await tx.eventRegistration.findFirst({
      where: submittedRegistrationWhere({ eventId: event.id, userId: { in: teamUserIds } }),
      select: { userId: true },
    })
    if (activeTeamRegistration) return { conflict: 'DUPLICATE_MEMBER' }

    const activeRegistrationCount = await tx.eventRegistration.count({
      where: submittedRegistrationWhere({ eventId: event.id }),
    })
    const newAttendeeCount = teamUserIds.length
    if (latestEvent.capacity && activeRegistrationCount + newAttendeeCount > latestEvent.capacity) {
      return { conflict: 'CAPACITY' }
    }

    const activityCapacities = new Map(
      (latestEvent.activities || [])
        .filter(activity => Number(activity.capacity) > 0)
        .map(activity => [activity.id, Number(activity.capacity)]),
    )
    const selectedCappedActivities = selectedActivitiesList.filter(activity => activityCapacities.has(activity.id))
    if (selectedCappedActivities.length > 0) {
      const currentRegistrations = await tx.eventRegistration.findMany({
        where: submittedRegistrationWhere({ eventId: event.id }),
        select: { selectedActivities: true },
      })
      const activityCounts = new Map()
      for (const current of currentRegistrations) {
        const currentIds = new Set((Array.isArray(current.selectedActivities) ? current.selectedActivities : [])
          .map(activity => typeof activity === 'string' ? activity : activity?.id)
          .filter(Boolean))
        for (const activityId of currentIds) {
          activityCounts.set(activityId, (activityCounts.get(activityId) || 0) + 1)
        }
      }
      const fullActivity = selectedCappedActivities.find(activity =>
        (activityCounts.get(activity.id) || 0) + newAttendeeCount > activityCapacities.get(activity.id),
      )
      if (fullActivity) return { conflict: 'ACTIVITY_CAPACITY', activityName: fullActivity.name }
    }

    let utrLockName = null
    try {
      if (totalAmount > 0) {
        utrLockName = await acquirePaymentReferenceLock(tx, paymentReference)
        if (!utrLockName) return { conflict: 'UTR_BUSY' }

        const duplicateUtr = await findActivePaymentReferenceDuplicate(tx, paymentReference, existing?.id || null)
        if (duplicateUtr) return { conflict: 'DUPLICATE_UTR' }
      }

      if (existingTeam) {
        await tx.eventTeam.update({
          where: { id: existingTeam.id },
          data: { status: 'REGISTERED' },
        })
      }

      const savedLeader = existing
        ? await tx.eventRegistration.update({ where: { id: existing.id }, data: registrationData })
        : await tx.eventRegistration.create({ data: { id: regId, ...registrationData } })

      for (const member of memberRecordsToCreate) {
        const mExisting = await tx.eventRegistration.findUnique({
          where: { eventId_userId: { eventId: event.id, userId: member.userId } },
        })
        if (mExisting && !isDraftRegistration(mExisting)) {
          throw new Error('An accepted team member already has a submitted registration.')
        }

        const mRegId = mExisting?.id || crypto.randomUUID()
        let mQrCode = null
        if (hasActiveEventPass({ status: registrationStatus, paymentStatus })) {
          try {
            mQrCode = await QRCode.toDataURL(`EVENT_PASS:${mRegId}`, { margin: 2, width: 300, color: { dark: '#000000', light: '#ffffff' } })
          } catch {}
        }

        const memberRegistrationData = {
          eventId: event.id,
          userId: member.userId,
          registrationType: 'TEAM',
          selectedActivities: selectedActivitiesList,
          paymentOption: paymentOptionObj,
          totalAmount: totalAmount,
          amountPaid: totalAmount > 0 ? null : 0,
          paymentStatus,
          paymentReference: totalAmount > 0 ? paymentReference : null,
          paymentProofUrl: totalAmount > 0 ? data.paymentProofUrl || null : null,
          paymentVerifiedAt,
          paymentVerifiedBy,
          paymentSubmittedAt,
          branch: member.department || null,
          year: member.year ? Number(member.year) : null,
          gender: member.gender || null,
          residencyType: data.residencyType || null,
          transportMode: data.transportMode || null,
          hostelType: data.hostelType || null,
          teamName: resolvedTeamName,
          teamId: resolvedTeamId,
          isTeamLeader: false,
          status: registrationStatus,
          attendanceMarked: false,
          qrCodeData: mQrCode,
        }
        if (mExisting) {
          await tx.eventRegistration.update({ where: { id: mExisting.id }, data: memberRegistrationData })
        } else {
          await tx.eventRegistration.create({ data: { id: mRegId, ...memberRegistrationData } })
        }
        memberNotificationUserIds.push(member.userId)
      }

      return { registration: savedLeader }
    } finally {
      await releasePaymentReferenceLock(tx, utrLockName)
    }
  })

  if (transactionResult.conflict) {
    if (transactionResult.conflict === 'EVENT_CLOSED') {
      return response.status(404).json({ message: 'Event is not open for registration.' })
    }
    if (transactionResult.conflict === 'DEADLINE') {
      return response.status(400).json({ message: 'Registration deadline for this event has passed.' })
    }
    if (transactionResult.conflict === 'TEAM_INVALID') {
      return response.status(403).json({ message: 'Only the leader of this event’s team can submit its registration.' })
    }
    if (transactionResult.conflict === 'TEAM_REGISTERED') {
      return response.status(409).json({ message: 'This team has already been submitted for registration.' })
    }
    if (transactionResult.conflict === 'TEAM_CHANGED') {
      return response.status(409).json({ message: 'The accepted team roster changed. Refresh the event and try again.' })
    }
    if (transactionResult.conflict === 'DUPLICATE_MEMBER') {
      return response.status(409).json({ message: 'A team member is already registered for this event.' })
    }
    if (transactionResult.conflict === 'CAPACITY') {
      return response.status(409).json({ message: 'There are not enough remaining event places for this registration.' })
    }
    if (transactionResult.conflict === 'ACTIVITY_CAPACITY') {
      return response.status(409).json({ message: `The selected activity “${transactionResult.activityName}” has reached capacity.` })
    }
    if (transactionResult.conflict === 'UTR_BUSY') {
      return response.status(409).json({ message: 'Another payment submission with this UTR is being processed. Please retry shortly.' })
    }
    if (transactionResult.conflict === 'DUPLICATE_UTR') {
      return response.status(409).json({ message: 'This UPI UTR has already been submitted for another registration.' })
    }
    if (transactionResult.conflict === 'PRICING_CHANGED') {
      return response.status(409).json({ message: 'Event pricing or activity availability changed. Refresh the event and review the current fee.' })
    }
  }
  const registration = transactionResult.registration

  for (const userId of memberNotificationUserIds) {
    createUserNotification({
      userId,
      type: 'EVENT_REGISTRATION',
      title: hasActiveEventPass({ status: registrationStatus, paymentStatus }) ? `Team Pass Ready: ${event.title}` : `Payment Submitted: ${event.title}`,
      message: hasActiveEventPass({ status: registrationStatus, paymentStatus })
        ? `Your team "${resolvedTeamName}" is registered for "${event.title}". Your entrance pass is available in your Pass Wallet.`
        : `Your team payment reference for "${event.title}" is awaiting organizer verification. The entrance pass will be issued after approval.`,
      linkUrl: '/student-passes',
    }).catch(() => {})
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
  if (!event || !resolveEventRegistrationMode(event, 'TEAM').supportsTeams) {
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
        department: m.user?.profile?.department || null,
        year: m.user?.profile?.year || null,
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
  if (memberRecord.team.status === 'REGISTERED') {
    return response.status(409).json({ message: 'This team has already been registered and cannot be changed.' })
  }
  if (memberRecord.status !== 'INVITED') {
    return response.status(409).json({ message: 'This team invitation has already been answered.' })
  }

  const newStatus = accept ? 'ACCEPTED' : 'REJECTED'
  const inviteTransition = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM events WHERE id = ${memberRecord.team.eventId} FOR UPDATE`
    const latestTeam = await tx.eventTeam.findUnique({
      where: { id: memberRecord.team.id },
      select: { status: true },
    })
    if (!latestTeam || latestTeam.status === 'REGISTERED') return { conflict: true }

    const changed = await tx.eventTeamMember.updateMany({
      where: { id: inviteId, userId: request.user.id, status: 'INVITED' },
      data: { status: newStatus, respondedAt: new Date() },
    })
    if (changed.count !== 1) return { conflict: true }
    return { success: true }
  })
  if (inviteTransition.conflict) {
    return response.status(409).json({ message: 'This team invitation can no longer be changed.' })
  }

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

  if (memberId === request.user.id) {
    return response.status(400).json({ message: 'Leader cannot remove themselves from the team.' })
  }

  const removal = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM events WHERE id = ${team.eventId} FOR UPDATE`
    const latestTeam = await tx.eventTeam.findUnique({
      where: { id: teamId },
      select: { eventId: true, leaderId: true, status: true },
    })
    if (!latestTeam || latestTeam.leaderId !== request.user.id) return { conflict: 'FORBIDDEN' }
    if (latestTeam.status === 'REGISTERED') return { conflict: 'REGISTERED' }

    const deleted = await tx.eventTeamMember.deleteMany({ where: { teamId, userId: memberId } })
    if (deleted.count !== 1) return { conflict: 'MEMBER_NOT_FOUND' }
    return { success: true }
  })
  if (removal.conflict === 'FORBIDDEN') return response.status(403).json({ message: 'Only the team leader can remove team members.' })
  if (removal.conflict === 'REGISTERED') return response.status(409).json({ message: 'Cannot modify team members after registration and pass issuance.' })
  if (removal.conflict === 'MEMBER_NOT_FOUND') return response.status(404).json({ message: 'Team member not found.' })

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
    where: submittedRegistrationWhere({ userId: request.user.id }),
    include: {
      event: {
        include: { activities: true },
      },
    },
    orderBy: { registeredAt: 'desc' },
  })

  const enrichedRegistrations = await Promise.all(
    registrations.map(async reg => {
      let qrCode = hasActiveEventPass(reg) ? reg.qrCodeData : null
      if (hasActiveEventPass(reg) && !qrCode) {
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
    'FACULTY',
    'CONVENER',
    'CO_CONVENER',
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

  if (!registration || !hasActiveEventPass(registration)) {
    return response.status(404).json({ message: 'No active event pass found for this user.' })
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

export async function searchStudentsForTeam(request, response) {
  const q = String(request.query.q || request.query.query || '').trim()
  if (!q || q.length < 2) {
    return response.status(200).json({ students: [] })
  }

  const users = await prisma.user.findMany({
    where: {
      accountStatus: 'ACTIVE',
      id: { not: request.user.id },
      OR: [
        { memberId: { contains: q } },
        { profile: { name: { contains: q } } },
        { profile: { rollNumber: { contains: q } } },
      ],
    },
    include: { profile: true },
    take: 15,
  })

  return response.status(200).json({
    students: users.map(u => ({
      id: u.id,
      memberId: u.memberId,
      name: u.profile?.name || u.memberId,
      rollNumber: u.profile?.rollNumber || u.memberId,
      department: u.profile?.department || 'CSE',
      year: u.profile?.year || 1,
      gender: u.profile?.gender || 'UNSPECIFIED',
      profileImage: u.profile?.profileImage || null,
    })),
  })
}

export async function resubmitPayment(request, response) {
  const { registrationId } = request.params
  const parsed = resubmitPaymentSchema.safeParse(request.body)
  if (!parsed.success) {
    return response.status(400).json({ message: parsed.error.issues[0]?.message || 'Enter valid payment details.' })
  }
  const data = parsed.data

  const registration = await prisma.eventRegistration.findFirst({
    where: {
      id: registrationId,
      userId: request.user.id,
    },
    include: { event: true },
  })
  if (!registration) {
    return response.status(404).json({ message: 'Registration not found or unauthorized.' })
  }
  if (isDraftRegistration(registration) || Number(registration.totalAmount) <= 0 || (registration.teamId && !registration.isTeamLeader) || !['REJECTED', 'PAYMENT_REJECTED'].includes(String(registration.paymentStatus || '').toUpperCase())) {
    return response.status(409).json({ message: 'Only the paid registration owner or team leader can resubmit a rejected payment.' })
  }

  const cleanUtr = String(data.paymentReference).trim().toUpperCase()
  const submittedAt = new Date()
  const paymentProofUrl = data.paymentProofUrl || registration.paymentProofUrl || null
  const paymentMethod = data.paymentMethod || 'UPI'
  const transition = await prisma.$transaction(async tx => {
    const lockName = await acquirePaymentReferenceLock(tx, cleanUtr)
    if (!lockName) return { conflict: 'UTR_BUSY' }

    try {
      const duplicateUtr = await findActivePaymentReferenceDuplicate(tx, cleanUtr, registrationId)
      if (duplicateUtr) return { conflict: 'DUPLICATE_UTR' }

      const changed = await tx.eventRegistration.updateMany({
        where: {
          id: registrationId,
          userId: request.user.id,
          totalAmount: { gt: 0 },
          paymentStatus: { in: ['REJECTED', 'PAYMENT_REJECTED'] },
          status: { not: 'DRAFT' },
        },
        data: {
          paymentReference: cleanUtr,
          amountPaid: null,
          paymentProofUrl,
          paymentMethod,
          paymentStatus: 'UNDER_VERIFICATION',
          status: 'UNDER_VERIFICATION',
          paymentSubmittedAt: submittedAt,
          paymentVerifiedAt: null,
          paymentVerifiedBy: null,
          paymentRejectionReason: null,
          qrCodeData: null,
        },
      })
      if (changed.count !== 1) return { conflict: 'PAYMENT_STATE_CHANGED' }

      if (registration.teamId && registration.isTeamLeader) {
        await tx.eventRegistration.updateMany({
          where: {
            teamId: registration.teamId,
            id: { not: registrationId },
            status: { not: 'DRAFT' },
          },
          data: {
            paymentReference: cleanUtr,
            amountPaid: null,
            paymentProofUrl,
            paymentMethod,
            paymentStatus: 'UNDER_VERIFICATION',
            status: 'UNDER_VERIFICATION',
            paymentSubmittedAt: submittedAt,
            paymentVerifiedAt: null,
            paymentVerifiedBy: null,
            paymentRejectionReason: null,
            qrCodeData: null,
          },
        })
      }

      return { registration: await tx.eventRegistration.findUnique({ where: { id: registrationId } }) }
    } finally {
      await releasePaymentReferenceLock(tx, lockName)
    }
  })

  if (transition.conflict === 'UTR_BUSY') {
    return response.status(409).json({ message: 'Another payment submission with this UTR is being processed. Please retry shortly.' })
  }
  if (transition.conflict === 'DUPLICATE_UTR') {
    return response.status(409).json({
      message: `Transaction ID / UTR "${cleanUtr}" has already been submitted for another registration. Please enter your own unique payment UTR.`,
    })
  }
  if (transition.conflict === 'PAYMENT_STATE_CHANGED') {
    return response.status(409).json({ message: 'This payment is no longer rejected. Refresh the registration and try again.' })
  }
  const updated = transition.registration

  return response.status(200).json({
    message: '✓ Payment details re-submitted. Your transaction is now Under Verification by organizers.',
    registration: updated,
  })
}

export async function submitProject(request, response) {
  const { eventId } = request.params
  const parsed = projectSubmissionSchema.safeParse(request.body)
  if (!parsed.success) {
    return response.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid project submission details.' })
  }
  const data = parsed.data

  const registration = await prisma.eventRegistration.findUnique({
    where: { eventId_userId: { eventId, userId: request.user.id } },
    include: { event: true },
  })
  if (!registration || !hasActiveEventPass(registration)) {
    return response.status(404).json({ message: 'No active event pass found for this event.' })
  }

  const submissionData = {
    githubUrl: data.githubUrl || null,
    websiteUrl: data.websiteUrl || null,
    driveUrl: data.driveUrl || null,
    zipUrl: data.zipUrl || null,
    notes: data.notes || null,
    submittedAt: new Date().toISOString(),
    submittedBy: request.user.id,
    submittedByName: request.user.profile?.name || request.user.memberId,
  }

  const projectTransition = await prisma.$transaction(async tx => {
    const latestRegistration = await tx.eventRegistration.findUnique({
      where: { id: registration.id },
    })
    if (!latestRegistration || !hasActiveEventPass(latestRegistration)) return { conflict: true }

    const changed = await tx.eventRegistration.updateMany({
      where: {
        id: registration.id,
        status: latestRegistration.status,
        paymentStatus: latestRegistration.paymentStatus,
      },
      data: {
        projectSubmission: submissionData,
        status: 'PROJECT_SUBMITTED',
        ...(data.githubUrl ? { github: data.githubUrl } : {}),
      },
    })
    if (changed.count !== 1) return { conflict: true }

    if (registration.teamId) {
      await tx.eventTeam.update({
        where: { id: registration.teamId },
        data: { projectSubmission: submissionData },
      })
      await tx.eventRegistration.updateMany({
        where: { teamId: registration.teamId, status: { not: 'DRAFT' } },
        data: {
          projectSubmission: submissionData,
          status: 'PROJECT_SUBMITTED',
          ...(data.githubUrl ? { github: data.githubUrl } : {}),
        },
      })
    }

    return { registration: await tx.eventRegistration.findUnique({ where: { id: registration.id } }) }
  })
  if (projectTransition.conflict) {
    return response.status(409).json({ message: 'An active verified event pass is required to submit a project.' })
  }
  const updated = projectTransition.registration

  return response.status(200).json({
    message: '✓ Hackathon project submitted successfully for the entire team!',
    projectSubmission: submissionData,
    registration: updated,
  })
}

export async function saveRegistrationDraft(request, response) {
  const { eventId } = request.params
  const { registrationType, teamName, teamId, formData, selectedActivityIds, paymentOption } = request.body || {}

  const draftResult = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM events WHERE id = ${eventId} FOR UPDATE`
    const event = await tx.event.findUnique({
      where: { id: eventId },
      select: { id: true, registrationType: true, isTeamEvent: true },
    })
    if (!event) return { conflict: 'EVENT_NOT_FOUND' }

    const { supportsTeams, isTeam } = resolveEventRegistrationMode(event, registrationType)
    if (registrationType === 'TEAM' && !supportsTeams) return { conflict: 'TEAM_MODE_DISABLED' }
    if (!isTeam && (teamName || teamId)) return { conflict: 'INDIVIDUAL_HAS_TEAM' }

    const existingRegistration = await tx.eventRegistration.findUnique({
      where: { eventId_userId: { eventId, userId: request.user.id } },
    })
    if (existingRegistration && !isDraftRegistration(existingRegistration)) {
      return { registration: existingRegistration, message: 'Existing submitted registration found.' }
    }

    let draftTeam = null
    if (isTeam && teamId) {
      draftTeam = await tx.eventTeam.findFirst({
        where: { id: teamId, eventId, leaderId: request.user.id },
        select: { id: true, teamName: true, status: true },
      })
      if (!draftTeam) return { conflict: 'TEAM_INVALID' }
      if (draftTeam.status === 'REGISTERED') return { conflict: 'TEAM_REGISTERED' }
    }

    const teamFields = {
      teamName: draftTeam?.teamName || null,
      teamId: draftTeam?.id || null,
      isTeamLeader: Boolean(isTeam && draftTeam),
    }
    const registrationData = {
      registrationType: isTeam ? 'TEAM' : 'INDIVIDUAL',
      ...teamFields,
      formData: formData || existingRegistration?.formData || null,
      paymentOption: paymentOption || existingRegistration?.paymentOption || null,
      selectedActivities: selectedActivityIds || existingRegistration?.selectedActivities || null,
      status: 'DRAFT',
      paymentStatus: 'PENDING',
      totalAmount: 0,
      amountPaid: null,
      paymentReference: null,
      paymentProofUrl: null,
      paymentMethod: null,
      paymentSubmittedAt: null,
      paymentVerifiedAt: null,
      paymentVerifiedBy: null,
      paymentRejectionReason: null,
      qrCodeData: null,
    }

    const registration = existingRegistration
      ? await tx.eventRegistration.update({ where: { id: existingRegistration.id }, data: registrationData })
      : await tx.eventRegistration.create({
        data: {
          id: crypto.randomUUID(),
          eventId,
          userId: request.user.id,
          ...registrationData,
        },
      })
    return { registration, message: 'Draft registration saved.' }
  })

  if (draftResult.conflict === 'EVENT_NOT_FOUND') return response.status(404).json({ message: 'Event not found.' })
  if (draftResult.conflict === 'TEAM_MODE_DISABLED') return response.status(400).json({ message: 'This event is not configured for team registration.' })
  if (draftResult.conflict === 'INDIVIDUAL_HAS_TEAM') return response.status(400).json({ message: 'Team details are not allowed for an individual registration.' })
  if (draftResult.conflict === 'TEAM_INVALID') return response.status(403).json({ message: 'Only the leader of this event’s team can save a team registration draft.' })
  if (draftResult.conflict === 'TEAM_REGISTERED') return response.status(409).json({ message: 'This team has already been submitted for registration.' })

  return response.status(200).json({ registration: draftResult.registration, message: draftResult.message })
}


