import bcrypt from 'bcrypt'
import { Prisma } from '@prisma/client'
import { prisma } from '../db/prisma.js'
import { env } from '../config/env.js'
import { getRolePermissions } from '../config/permissions.js'
import { tryWriteAuditLog } from '../services/audit.service.js'
import { guestRegisterSchema } from '../validators/member.validator.js'
import { generateStrongPassword, getNextGuestMemberId } from '../utils/guest-generator.js'

function auditRequest(request) {
  return { ipAddress: request.ip, userAgent: request.get('user-agent') || null }
}

export async function registerGuestAccount(request, response) {
  const parsed = guestRegisterSchema.safeParse(request.body)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message || 'Please provide all required registration details.'
    return response.status(400).json({ message })
  }

  const data = parsed.data

  // Check if an account with this email already exists
  const existingEmail = await prisma.profile.findUnique({
    where: { email: data.email },
    select: { id: true },
  })
  if (existingEmail) {
    return response.status(409).json({ message: 'An account with this email address already exists. Please sign in or use a different email.' })
  }

  const generatedPassword = generateStrongPassword()
  const passwordHash = await bcrypt.hash(generatedPassword, env.bcryptRounds)

  const studentPermissions = getRolePermissions('STUDENT')
  const specText = data.specialization ? ` - ${data.specialization}` : ''
  const departmentFormatted = `${data.branch}${specText} (${data.college})`

  // Concurrency-safe creation with retry in case of racing IDs
  let createdUser = null
  let assignedMemberId = ''
  let attempts = 0

  while (!createdUser && attempts < 5) {
    attempts++
    assignedMemberId = await getNextGuestMemberId(prisma)

    try {
      createdUser = await prisma.user.create({
        data: {
          memberId: assignedMemberId,
          passwordHash,
          role: 'STUDENT',
          isPrimaryAdmin: false,
          accountStatus: 'ACTIVE',
          profile: {
            create: {
              name: data.name,
              email: data.email,
              phone: data.phone || null,
              department: departmentFormatted,
              rollNumber: assignedMemberId,
              gender: data.gender || null,
              age: data.age || null,
              year: data.year || null,
            },
          },
          permissions: {
            create: studentPermissions.map(permission => ({ permission })),
          },
        },
        include: {
          profile: true,
          permissions: true,
        },
      })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // ID collision on concurrent insert, retry
        createdUser = null
      } else {
        throw err
      }
    }
  }

  if (!createdUser) {
    return response.status(500).json({ message: 'Failed to generate a unique Guest Member ID. Please try again.' })
  }

  await tryWriteAuditLog({
    actorUserId: createdUser.id,
    action: 'GUEST_ACCOUNT_REGISTERED',
    targetUserId: createdUser.id,
    metadata: {
      memberId: assignedMemberId,
      name: data.name,
      college: data.college,
      branch: data.branch,
      year: data.year || null,
      specialization: data.specialization || null,
    },
    ...auditRequest(request),
  })

  return response.status(201).json({
    message: 'Guest student account created successfully.',
    memberId: assignedMemberId,
    password: generatedPassword,
    user: {
      id: createdUser.id,
      memberId: assignedMemberId,
      name: createdUser.profile.name,
      email: createdUser.profile.email,
      college: data.college,
      branch: data.branch,
      specialization: data.specialization || null,
      role: createdUser.role,
    },
  })
}
