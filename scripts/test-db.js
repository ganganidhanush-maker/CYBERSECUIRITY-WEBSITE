import 'dotenv/config'
import { prisma } from '../server/db/prisma.js'

try {
  await prisma.$queryRaw`SELECT 1`
  const userCols = await prisma.$queryRaw`DESCRIBE users`
  const permCols = await prisma.$queryRaw`DESCRIBE permission_assignments`
  console.log('users columns', userCols)
  console.log('permission_assignments columns', permCols)
} catch (error) {
  console.log('DB FAIL:', error.message)
} finally {
  await prisma.$disconnect()
}
