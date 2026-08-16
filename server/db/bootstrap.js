import bcrypt from 'bcrypt'
import { prisma } from './prisma.js'
import { env } from '../config/env.js'

export async function bootstrapDatabase() {
  try {
    // 1. Ensure sessions table exists
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
        expires INT(11) UNSIGNED NOT NULL,
        data MEDIUMTEXT COLLATE utf8mb4_bin,
        PRIMARY KEY (session_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(() => {})

    // 2. Ensure subscriptions table exists
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id VARCHAR(191) NOT NULL,
        user_id VARCHAR(191) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        payment_date DATETIME(3) NOT NULL,
        transaction_ref VARCHAR(120) NOT NULL,
        payment_method VARCHAR(60) NULL,
        receipt_image LONGTEXT NULL,
        status ENUM('PENDING', 'ACTIVE', 'EXPIRED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
        submitted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        verified_by VARCHAR(191) NULL,
        verified_at DATETIME(3) NULL,
        rejection_reason VARCHAR(500) NULL,
        expires_at DATETIME(3) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX subscriptions_user_id_idx (user_id),
        INDEX subscriptions_status_idx (status),
        INDEX subscriptions_expires_at_idx (expires_at),
        CONSTRAINT fk_subscriptions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `).catch(() => {})

    // 3. Provision President account if environment credentials provided
    const presidentMemberId = process.env.PRESIDENT_MEMBER_ID?.toUpperCase()
    const presidentPassword = process.env.PRESIDENT_INITIAL_PASSWORD

    if (!presidentMemberId || !presidentPassword) {
      const existingPresident = await prisma.user.findFirst({
        where: { isPrimaryAdmin: true },
      })
      if (!existingPresident) {
        console.warn('[BOOTSTRAP NOTICE] No Primary President exists. Set PRESIDENT_MEMBER_ID and PRESIDENT_INITIAL_PASSWORD in your environment to provision the Primary President.')
      }
      return
    }

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
            name: process.env.PRESIDENT_NAME || 'Primary President',
            email: process.env.PRESIDENT_EMAIL || 'president@cybersecurity.club',
          },
        },
      },
    })
  } catch (error) {
    console.warn('[BOOTSTRAP WARNING] Database bootstrap check skipped:', error.message)
  }
}
