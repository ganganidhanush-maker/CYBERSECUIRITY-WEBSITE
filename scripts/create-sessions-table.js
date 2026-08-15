import 'dotenv/config'
import { prisma } from '../server/db/prisma.js'

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS sessions (
      session_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
      expires INT(11) UNSIGNED NOT NULL,
      data MEDIUMTEXT COLLATE utf8mb4_bin,
      PRIMARY KEY (session_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `)
  console.log('✓ Created sessions table successfully!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
