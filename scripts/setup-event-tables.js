import 'dotenv/config'
import { prisma } from '../server/db/prisma.js'

async function setupEventTables() {
  try {
    console.log('Creating event tables...')
    
    // Create events table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS events (
        id VARCHAR(191) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description LONGTEXT,
        event_type VARCHAR(100) NOT NULL,
        date_time DATETIME NOT NULL,
        location VARCHAR(255),
        capacity INT,
        photo_url VARCHAR(512),
        status VARCHAR(50) DEFAULT 'UPCOMING',
        created_by VARCHAR(191) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_created_by (created_by),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    console.log('✓ events table created')
    
    // Create event_form_fields table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS event_form_fields (
        id VARCHAR(191) PRIMARY KEY,
        event_id VARCHAR(191) NOT NULL,
        field_name VARCHAR(255) NOT NULL,
        field_type VARCHAR(50) NOT NULL,
        is_required BOOLEAN DEFAULT FALSE,
        options LONGTEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
        INDEX idx_event_id (event_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    console.log('✓ event_form_fields table created')
    
    // Create event_registrations table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS event_registrations (
        id VARCHAR(191) PRIMARY KEY,
        event_id VARCHAR(191) NOT NULL,
        user_id VARCHAR(191) NOT NULL,
        registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        form_data JSON,
        status VARCHAR(50) DEFAULT 'REGISTERED',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_event_user (event_id, user_id),
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
        INDEX idx_event_id (event_id),
        INDEX idx_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    console.log('✓ event_registrations table created')
    
    console.log('✓ All event tables created successfully!')
    await prisma.$disconnect()
  } catch (error) {
    console.error('Error setting up event tables:', error.message)
    await prisma.$disconnect()
    process.exit(1)
  }
}

setupEventTables()
