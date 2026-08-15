import 'dotenv/config'
import bcrypt from 'bcrypt'
import { env } from '../server/config/env.js'
import { prisma } from '../server/db/prisma.js'

function required(name) {
  const value = process.env[name]?.trim()
  if (!value || value.startsWith('set-')) throw new Error(`${name} must be set in the untracked .env file before first-run provisioning.`)
  return value
}

async function main() {
  const memberId = required('PRESIDENT_MEMBER_ID').toUpperCase()
  const existing = await prisma.user.findUnique({ where: { memberId } })
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { role: 'PRESIDENT', accountStatus: 'ACTIVE', profile: { upsert: { update: { name: process.env.PRESIDENT_NAME || 'President' }, create: { name: process.env.PRESIDENT_NAME || 'President' } } } },
    })
    console.log('President account already exists; its password was left unchanged.')
    return
  }

  const passwordHash = await bcrypt.hash(required('PRESIDENT_INITIAL_PASSWORD'), env.bcryptRounds)
  await prisma.user.create({
    data: {
      memberId,
      passwordHash,
      role: 'PRESIDENT',
      accountStatus: 'ACTIVE',
      profile: { create: { name: process.env.PRESIDENT_NAME || 'President' } },
    },
  })
  console.log('President account provisioned successfully.')
}

main().then(() => prisma.$disconnect()).catch(async error => {
  console.error('Seed failed', error)
  await prisma.$disconnect()
  process.exitCode = 1
})
