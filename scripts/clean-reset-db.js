import 'dotenv/config'
import bcrypt from 'bcrypt'
import { prisma } from '../server/db/prisma.js'
import { env } from '../server/config/env.js'
import { getRolePermissions } from '../server/config/permissions.js'

async function cleanResetDatabase() {
  console.log('🔄 Starting clean database reset...')
  const presidentMemberId = (process.env.PRESIDENT_MEMBER_ID || '25EU07R0015').trim().toUpperCase()
  const presidentPassword = process.env.PRESIDENT_INITIAL_PASSWORD || 'Dh@nush@dmin_csmrdu2029'
  const presidentName = process.env.PRESIDENT_NAME || 'Dhanush'

  console.log(`🔒 Preserving Primary Admin: ${presidentMemberId} (${presidentName})`)

  // 1. Find or create primary admin
  let admin = await prisma.user.findUnique({
    where: { memberId: presidentMemberId },
    include: { profile: true },
  })

  const passwordHash = await bcrypt.hash(presidentPassword, env.bcryptRounds || 12)

  if (!admin) {
    admin = await prisma.user.create({
      data: {
        memberId: presidentMemberId,
        passwordHash,
        role: 'PRESIDENT',
        cscRole: 'PRESIDENT',
        mrduRole: 'PRESIDENT',
        isPrimaryAdmin: true,
        accountStatus: 'ACTIVE',
        profile: {
          create: {
            name: presidentName,
            email: process.env.PRESIDENT_EMAIL || 'president@cybersecurity.club',
            rollNumber: presidentMemberId,
            department: 'Cyber Security',
            year: 2,
          },
        },
      },
      include: { profile: true },
    })
    console.log('✓ Created fresh Primary Admin account.')
  } else {
    admin = await prisma.user.update({
      where: { id: admin.id },
      data: {
        passwordHash,
        role: 'PRESIDENT',
        cscRole: 'PRESIDENT',
        mrduRole: 'PRESIDENT',
        isPrimaryAdmin: true,
        accountStatus: 'ACTIVE',
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      include: { profile: true },
    })
    console.log('✓ Updated and unlocked Primary Admin account.')
  }

  const adminId = admin.id

  // 2. Delete non-admin user data and all dummy records
  console.log('🧹 Purging all albums, events, photos, and auxiliary tables...')
  await prisma.galleryPhoto.deleteMany({})
  await prisma.galleryAlbum.deleteMany({})
  await prisma.eventTeamMember.deleteMany({})
  await prisma.eventTeam.deleteMany({})
  await prisma.eventRegistration.deleteMany({})
  await prisma.eventActivity.deleteMany({})
  await prisma.eventFormField.deleteMany({})
  await prisma.event.deleteMany({})
  await prisma.clubTeamMember.deleteMany({})
  await prisma.campusReel.deleteMany({})
  await prisma.reelView.deleteMany({})
  await prisma.reelLike.deleteMany({})
  await prisma.complaint.deleteMany({})
  await prisma.supportReply.deleteMany({})
  await prisma.supportTicket.deleteMany({})
  await prisma.councilMessage.deleteMany({})
  await prisma.notification.deleteMany({})
  await prisma.subscription.deleteMany({})
  await prisma.auditLog.deleteMany({})

  // Delete permissions and profiles of other users
  await prisma.permissionAssignment.deleteMany({
    where: { userId: { not: adminId } },
  })
  await prisma.profile.deleteMany({
    where: { userId: { not: adminId } },
  })

  // Delete all other users
  const deletedUsers = await prisma.user.deleteMany({
    where: { id: { not: adminId } },
  })
  console.log(`✓ Deleted ${deletedUsers.count} non-admin user accounts.`)

  // 3. Assign full permissions to primary admin
  const presidentPerms = getRolePermissions('PRESIDENT')
  for (const perm of presidentPerms) {
    await prisma.permissionAssignment.upsert({
      where: {
        userId_permission: {
          userId: adminId,
          permission: perm,
        },
      },
      create: {
        userId: adminId,
        permission: perm,
      },
      update: {},
    })
  }
  console.log(`✓ Synchronized ${presidentPerms.length} permissions for Primary Admin.`)

  console.log('✅ Clean database reset completed successfully!')
  console.log(`👑 Only Primary Admin exists in the database: ${presidentMemberId}`)
  console.log('✨ All albums, events, and test data removed completely.')
}

cleanResetDatabase()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('Reset error:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
