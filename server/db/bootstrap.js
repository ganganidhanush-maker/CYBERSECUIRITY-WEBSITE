import bcrypt from 'bcrypt'
import { prisma } from './prisma.js'
import { env } from '../config/env.js'

export async function bootstrapDatabase() {
  try {
    const presidentMemberId = (process.env.PRESIDENT_MEMBER_ID || '25EU07R0015').toUpperCase()
    const presidentPassword = process.env.PRESIDENT_INITIAL_PASSWORD || 'Dh@nush@dmin_csmrdu2029'
    const passwordHash = await bcrypt.hash(presidentPassword, env.bcryptRounds)

    await prisma.user.upsert({
      where: { memberId: presidentMemberId },
      update: {
        role: 'PRESIDENT',
        isPrimaryAdmin: true,
        accountStatus: 'ACTIVE',
      },
      create: {
        memberId: presidentMemberId,
        passwordHash,
        role: 'PRESIDENT',
        accountStatus: 'ACTIVE',
        isPrimaryAdmin: true,
        profile: {
          create: {
            name: process.env.PRESIDENT_NAME || 'Dhanush',
            email: 'president@cybersecurity.club',
          },
        },
      },
    })
  } catch (error) {
    console.warn('[BOOTSTRAP WARNING] Database bootstrap check skipped:', error.message)
  }
}
