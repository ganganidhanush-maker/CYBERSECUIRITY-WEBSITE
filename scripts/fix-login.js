import 'dotenv/config'
import bcrypt from 'bcrypt'
import { prisma } from '../server/db/prisma.js'

async function fixLogin() {
  const presidentMemberId = (process.env.PRESIDENT_MEMBER_ID || '25EU07R0015').toUpperCase()
  const presidentPassword = process.env.PRESIDENT_INITIAL_PASSWORD || 'Dh@nush@dmin_csmrdu2029'
  const rounds = Number(process.env.BCRYPT_ROUNDS || 12)
  const passwordHash = await bcrypt.hash(presidentPassword, rounds)

  // Ensure President user exists, has correct credentials, and 2FA is reset so they can log in directly
  const president = await prisma.user.upsert({
    where: { memberId: presidentMemberId },
    update: {
      passwordHash,
      role: 'PRESIDENT',
      accountStatus: 'ACTIVE',
      isPrimaryAdmin: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      totpEnabled: false,
      totpSecretEncrypted: null,
    },
    create: {
      memberId: presidentMemberId,
      passwordHash,
      role: 'PRESIDENT',
      accountStatus: 'ACTIVE',
      isPrimaryAdmin: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      totpEnabled: false,
      totpSecretEncrypted: null,
      profile: {
        create: {
          name: process.env.PRESIDENT_NAME || 'Dhanush',
          email: 'president@cybersecurity.club',
        },
      },
    },
    include: { profile: true, permissions: true },
  })

  // Unlock all other users as well
  await prisma.user.updateMany({
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  })

  console.log(`✓ President account ready:`)
  console.log(`  Member ID: ${president.memberId}`)
  console.log(`  Password:  ${presidentPassword}`)
  console.log(`  Role:      ${president.role} (Primary Admin: ${president.isPrimaryAdmin})`)
  console.log(`  2FA:       Disabled (You can enable it in Security settings after logging in)`)
}

fixLogin()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
