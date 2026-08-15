import 'dotenv/config'
import { prisma } from '../server/db/prisma.js'

async function run() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE users 
    MODIFY COLUMN role ENUM('PRESIDENT', 'VICE_PRESIDENT', 'TREASURER', 'EVENT_MANAGEMENT', 'MEDIA_LEAD', 'TECH_TEAM', 'PR_TEAM', 'CULTURAL', 'SECRETARY', 'ADMIN', 'STUDENT') NOT NULL
  `)
  await prisma.$executeRawUnsafe(`
    ALTER TABLE permission_assignments 
    MODIFY COLUMN permission ENUM('ACCOUNT_MANAGEMENT', 'DASHBOARD_VIEW', 'EVENTS_VIEW', 'EVENT_REGISTER', 'REGISTRATIONS_VIEW', 'QR_PASSES_VIEW', 'GALLERY_VIEW', 'CHAT_USE', 'SUGGESTIONS_CREATE', 'FEEDBACK_CREATE', 'NOTIFICATIONS_VIEW', 'PROFILE_EDIT', 'EVENT_MANAGE', 'PAYMENTS_VIEW', 'PAYMENTS_VERIFY', 'GALLERY_MANAGE', 'TEAM_MANAGE', 'SETTINGS_MANAGE', 'AUDIT_VIEW') NOT NULL
  `)
  console.log('Role and Permission ENUMs updated successfully in MariaDB database.')
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
