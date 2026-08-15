import 'dotenv/config'
import { prisma } from '../server/db/prisma.js'

try {
  await prisma.$queryRaw`SELECT 1`
  const profileCols = await prisma.$queryRaw`DESCRIBE profiles`
  console.log('profiles columns', profileCols)
} catch (error) {
  console.log('DB FAIL:', error.message)
} finally {
  await prisma.$disconnect()
}
