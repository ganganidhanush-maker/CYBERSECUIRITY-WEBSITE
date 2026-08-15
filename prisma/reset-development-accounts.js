import 'dotenv/config'
import { prisma } from '../server/db/prisma.js'

if (process.env.NODE_ENV === 'production' || process.env.CONFIRM_DELETE_ALL_MEMBER_ACCOUNTS !== 'DELETE_MEMBERS') {
  throw new Error('This development-only reset requires CONFIRM_DELETE_ALL_MEMBER_ACCOUNTS=DELETE_MEMBERS and may not run in production.')
}

async function main() {
  const result = await prisma.user.deleteMany({ where: { role: 'STUDENT' } })
  console.log(`Removed ${result.count} member account(s). The President account was preserved.`)
}

main().then(() => prisma.$disconnect()).catch(async error => {
  console.error('Account reset failed', error)
  await prisma.$disconnect()
  process.exitCode = 1
})
