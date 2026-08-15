import 'dotenv/config'
import { prisma } from '../server/db/prisma.js'

async function run() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE profiles 
      ADD COLUMN IF NOT EXISTS bio VARCHAR(500) NULL,
      ADD COLUMN IF NOT EXISTS instagram_url VARCHAR(255) NULL,
      ADD COLUMN IF NOT EXISTS github_url VARCHAR(255) NULL,
      ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR(255) NULL,
      ADD COLUMN IF NOT EXISTS portfolio_url VARCHAR(255) NULL,
      ADD COLUMN IF NOT EXISTS skills VARCHAR(500) NULL,
      ADD COLUMN IF NOT EXISTS achievements LONGTEXT NULL
  `)
  console.log('✓ profiles table schema updated successfully with bio, socials, and skills.')
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
