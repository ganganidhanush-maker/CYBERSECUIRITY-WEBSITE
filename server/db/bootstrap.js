import bcrypt from 'bcrypt'
import { prisma } from './prisma.js'
import { env } from '../config/env.js'

export async function bootstrapDatabase() {
  try {
    // 1. users table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(191) NOT NULL,
        member_id VARCHAR(32) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('PRESIDENT', 'VICE_PRESIDENT', 'TREASURER', 'EVENT_MANAGEMENT', 'MEDIA_LEAD', 'SOCIAL_MEDIA_LEAD', 'TECH_TEAM', 'PR_TEAM', 'CULTURAL', 'SECRETARY', 'ADMIN', 'STUDENT') NOT NULL,
        csc_role ENUM('PRESIDENT', 'VICE_PRESIDENT', 'TREASURER', 'EVENT_MANAGEMENT', 'MEDIA_LEAD', 'SOCIAL_MEDIA_LEAD', 'TECH_TEAM', 'PR_TEAM', 'CULTURAL', 'SECRETARY', 'ADMIN', 'STUDENT') NULL,
        mrdu_role ENUM('PRESIDENT', 'VICE_PRESIDENT', 'TREASURER', 'EVENT_MANAGEMENT', 'MEDIA_LEAD', 'SOCIAL_MEDIA_LEAD', 'TECH_TEAM', 'PR_TEAM', 'CULTURAL', 'SECRETARY', 'ADMIN', 'STUDENT') NULL,
        is_primary_admin BOOLEAN NOT NULL DEFAULT FALSE,
        account_status ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
        failed_login_attempts INT NOT NULL DEFAULT 0,
        locked_until DATETIME(3) NULL,
        password_reset_token_hash VARCHAR(64) NULL,
        password_reset_expires_at DATETIME(3) NULL,
        totp_secret_encrypted VARCHAR(512) NULL,
        totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        master_security_pin_hash VARCHAR(255) NULL,
        last_logout_all_devices_at DATETIME(3) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        last_login DATETIME(3) NULL,
        PRIMARY KEY (id),
        UNIQUE INDEX users_member_id_key (member_id),
        UNIQUE INDEX users_password_reset_token_hash_key (password_reset_token_hash)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `).catch(() => {})

    // Update ENUM definitions on existing tables
    await prisma.$executeRawUnsafe(`
      ALTER TABLE users MODIFY COLUMN role ENUM('PRESIDENT', 'VICE_PRESIDENT', 'TREASURER', 'EVENT_MANAGEMENT', 'MEDIA_LEAD', 'SOCIAL_MEDIA_LEAD', 'TECH_TEAM', 'PR_TEAM', 'CULTURAL', 'SECRETARY', 'ADMIN', 'STUDENT') NOT NULL;
    `).catch(() => {})
    await prisma.$executeRawUnsafe(`
      ALTER TABLE users MODIFY COLUMN csc_role ENUM('PRESIDENT', 'VICE_PRESIDENT', 'TREASURER', 'EVENT_MANAGEMENT', 'MEDIA_LEAD', 'SOCIAL_MEDIA_LEAD', 'TECH_TEAM', 'PR_TEAM', 'CULTURAL', 'SECRETARY', 'ADMIN', 'STUDENT') NULL;
    `).catch(() => {})
    await prisma.$executeRawUnsafe(`
      ALTER TABLE users MODIFY COLUMN mrdu_role ENUM('PRESIDENT', 'VICE_PRESIDENT', 'TREASURER', 'EVENT_MANAGEMENT', 'MEDIA_LEAD', 'SOCIAL_MEDIA_LEAD', 'TECH_TEAM', 'PR_TEAM', 'CULTURAL', 'SECRETARY', 'ADMIN', 'STUDENT') NULL;
    `).catch(() => {})

    // Seed/sync default platform roles for existing users
    await prisma.$executeRawUnsafe(`
      UPDATE users SET csc_role = role WHERE csc_role IS NULL;
    `).catch(() => {})
    await prisma.$executeRawUnsafe(`
      UPDATE users SET mrdu_role = 'PRESIDENT' WHERE is_primary_admin = TRUE AND mrdu_role IS NULL;
    `).catch(() => {})
    await prisma.$executeRawUnsafe(`
      UPDATE users SET mrdu_role = 'STUDENT' WHERE is_primary_admin = FALSE AND mrdu_role IS NULL;
    `).catch(() => {})

    // 2. profiles table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS profiles (
        id VARCHAR(191) NOT NULL,
        user_id VARCHAR(191) NOT NULL,
        name VARCHAR(120) NULL,
        roll_number VARCHAR(64) NULL,
        department VARCHAR(120) NULL,
        year INT NULL,
        email VARCHAR(191) NULL,
        phone VARCHAR(32) NULL,
        profile_image LONGTEXT NULL,
        bio VARCHAR(500) NULL,
        instagram_url VARCHAR(255) NULL,
        github_url VARCHAR(255) NULL,
        linkedin_url VARCHAR(255) NULL,
        portfolio_url VARCHAR(255) NULL,
        skills VARCHAR(500) NULL,
        achievements LONGTEXT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE INDEX profiles_user_id_key (user_id),
        UNIQUE INDEX profiles_email_key (email),
        CONSTRAINT fk_profiles_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `).catch(() => {})

    // 3. permission_assignments table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS permission_assignments (
        id VARCHAR(191) NOT NULL,
        user_id VARCHAR(191) NOT NULL,
        permission ENUM('ACCOUNT_MANAGEMENT', 'DASHBOARD_VIEW', 'EVENTS_VIEW', 'EVENT_MANAGE', 'EVENT_REGISTER', 'REGISTRATIONS_VIEW', 'PAYMENTS_VIEW', 'PAYMENTS_VERIFY', 'QR_PASSES_VIEW', 'GALLERY_VIEW', 'GALLERY_MANAGE', 'REELS_MANAGE', 'TEAM_MANAGE', 'SETTINGS_MANAGE', 'AUDIT_VIEW', 'CHAT_USE', 'SUGGESTIONS_CREATE', 'FEEDBACK_CREATE', 'NOTIFICATIONS_VIEW', 'PROFILE_EDIT') NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE INDEX permission_assignments_user_id_permission_key (user_id, permission),
        INDEX permission_assignments_permission_idx (permission),
        CONSTRAINT fk_permissions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `).catch(() => {})

    await prisma.$executeRawUnsafe(`
      ALTER TABLE permission_assignments MODIFY COLUMN permission ENUM('ACCOUNT_MANAGEMENT', 'DASHBOARD_VIEW', 'EVENTS_VIEW', 'EVENT_MANAGE', 'EVENT_REGISTER', 'REGISTRATIONS_VIEW', 'PAYMENTS_VIEW', 'PAYMENTS_VERIFY', 'QR_PASSES_VIEW', 'GALLERY_VIEW', 'GALLERY_MANAGE', 'REELS_MANAGE', 'TEAM_MANAGE', 'SETTINGS_MANAGE', 'AUDIT_VIEW', 'CHAT_USE', 'SUGGESTIONS_CREATE', 'FEEDBACK_CREATE', 'NOTIFICATIONS_VIEW', 'PROFILE_EDIT') NOT NULL;
    `).catch(() => {})

    // 4. audit_logs table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(191) NOT NULL,
        actor_user_id VARCHAR(191) NULL,
        action VARCHAR(100) NOT NULL,
        target_user_id VARCHAR(191) NULL,
        ip_address VARCHAR(64) NULL,
        user_agent VARCHAR(512) NULL,
        metadata JSON NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX audit_logs_actor_user_id_idx (actor_user_id),
        INDEX audit_logs_target_user_id_idx (target_user_id),
        INDEX audit_logs_created_at_idx (created_at),
        CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users (id) ON DELETE SET NULL,
        CONSTRAINT fk_audit_target FOREIGN KEY (target_user_id) REFERENCES users (id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `).catch(() => {})

    // 5. events table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS events (
        id VARCHAR(191) NOT NULL,
        title VARCHAR(255) NOT NULL,
        short_description VARCHAR(500) NULL,
        description LONGTEXT NULL,
        event_type VARCHAR(100) NOT NULL,
        date_time DATETIME(3) NOT NULL,
        start_time VARCHAR(50) NULL,
        end_time VARCHAR(50) NULL,
        venue VARCHAR(255) NULL,
        location VARCHAR(255) NULL,
        capacity INT NULL,
        photo_url LONGTEXT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'UPCOMING',
        coordinator_name VARCHAR(120) NULL,
        coordinator_contact VARCHAR(120) NULL,
        organizing_team VARCHAR(255) NULL,
        speaker_name VARCHAR(120) NULL,
        speaker_photo LONGTEXT NULL,
        speaker_designation VARCHAR(120) NULL,
        registration_deadline DATETIME(3) NULL,
        contact_email VARCHAR(191) NULL,
        contact_phone VARCHAR(32) NULL,
        social_links JSON NULL,
        rules LONGTEXT NULL,
        eligibility LONGTEXT NULL,
        required_materials LONGTEXT NULL,
        agenda LONGTEXT NULL,
        faq JSON NULL,
        notes LONGTEXT NULL,
        requires_payment BOOLEAN NOT NULL DEFAULT FALSE,
        payment_amount DECIMAL(10, 2) NULL,
        payment_qr_url LONGTEXT NULL,
        payment_upi_id VARCHAR(120) NULL,
        payment_instructions LONGTEXT NULL,
        payment_deadline DATETIME(3) NULL,
        require_payment_proof BOOLEAN NOT NULL DEFAULT FALSE,
        allow_multiple_activities BOOLEAN NOT NULL DEFAULT FALSE,
        created_by VARCHAR(191) NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `).catch(() => {})

    // 6. event_activities table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS event_activities (
        id VARCHAR(191) NOT NULL,
        event_id VARCHAR(191) NOT NULL,
        name VARCHAR(120) NOT NULL,
        description VARCHAR(500) NULL,
        price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        capacity INT NULL,
        is_available BOOLEAN NOT NULL DEFAULT TRUE,
        instructions LONGTEXT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX event_activities_event_id_idx (event_id),
        CONSTRAINT fk_activities_event FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `).catch(() => {})

    // 7. event_form_fields table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS event_form_fields (
        id VARCHAR(191) NOT NULL,
        event_id VARCHAR(191) NOT NULL,
        field_name VARCHAR(255) NOT NULL,
        field_type VARCHAR(50) NOT NULL,
        is_required BOOLEAN NOT NULL DEFAULT FALSE,
        options LONGTEXT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX event_form_fields_event_id_idx (event_id),
        CONSTRAINT fk_form_fields_event FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `).catch(() => {})

    // 8. event_registrations table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS event_registrations (
        id VARCHAR(191) NOT NULL,
        event_id VARCHAR(191) NOT NULL,
        user_id VARCHAR(191) NOT NULL,
        registered_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        form_data JSON NULL,
        selected_activities JSON NULL,
        total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        payment_status VARCHAR(50) NOT NULL DEFAULT 'FREE',
        payment_reference VARCHAR(120) NULL,
        payment_proof_url LONGTEXT NULL,
        payment_verified_at DATETIME(3) NULL,
        payment_verified_by VARCHAR(191) NULL,
        payment_notes VARCHAR(500) NULL,
        branch VARCHAR(120) NULL,
        section VARCHAR(64) NULL,
        year INT NULL,
        emergency_contact VARCHAR(32) NULL,
        team_name VARCHAR(120) NULL,
        github VARCHAR(120) NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'REGISTERED',
        attendance_marked BOOLEAN NOT NULL DEFAULT FALSE,
        attended_at DATETIME(3) NULL,
        attendance_verified_by VARCHAR(191) NULL,
        qr_code_data LONGTEXT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE INDEX event_registrations_event_id_user_id_key (event_id, user_id),
        INDEX event_registrations_event_id_idx (event_id),
        INDEX event_registrations_user_id_idx (user_id),
        CONSTRAINT fk_registrations_event FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `).catch(() => {})

    // Self-healing column additions for existing profiles, events, and event_registrations tables
    await prisma.$executeRawUnsafe(`ALTER TABLE profiles ADD COLUMN gender VARCHAR(20) NULL`).catch(() => {})
    await prisma.$executeRawUnsafe(`ALTER TABLE profiles ADD COLUMN age INT NULL`).catch(() => {})

    await prisma.$executeRawUnsafe(`ALTER TABLE events ADD COLUMN is_team_event BOOLEAN NOT NULL DEFAULT FALSE`).catch(() => {})
    await prisma.$executeRawUnsafe(`ALTER TABLE events ADD COLUMN min_team_size INT NOT NULL DEFAULT 1`).catch(() => {})
    await prisma.$executeRawUnsafe(`ALTER TABLE events ADD COLUMN max_team_size INT NOT NULL DEFAULT 1`).catch(() => {})
    await prisma.$executeRawUnsafe(`ALTER TABLE events ADD COLUMN team_rules LONGTEXT NULL`).catch(() => {})

    await prisma.$executeRawUnsafe(`ALTER TABLE event_registrations ADD COLUMN gender VARCHAR(20) NULL`).catch(() => {})
    await prisma.$executeRawUnsafe(`ALTER TABLE event_registrations ADD COLUMN age INT NULL`).catch(() => {})
    await prisma.$executeRawUnsafe(`ALTER TABLE event_registrations ADD COLUMN residency_type VARCHAR(32) NULL`).catch(() => {})
    await prisma.$executeRawUnsafe(`ALTER TABLE event_registrations ADD COLUMN transport_mode VARCHAR(32) NULL`).catch(() => {})
    await prisma.$executeRawUnsafe(`ALTER TABLE event_registrations ADD COLUMN hostel_type VARCHAR(32) NULL`).catch(() => {})
    await prisma.$executeRawUnsafe(`ALTER TABLE event_registrations ADD COLUMN team_id VARCHAR(191) NULL`).catch(() => {})
    await prisma.$executeRawUnsafe(`ALTER TABLE event_registrations ADD COLUMN is_team_leader BOOLEAN NOT NULL DEFAULT FALSE`).catch(() => {})
    await prisma.$executeRawUnsafe(`ALTER TABLE event_registrations ADD COLUMN attendance_marked BOOLEAN NOT NULL DEFAULT FALSE`).catch(() => {})
    await prisma.$executeRawUnsafe(`ALTER TABLE event_registrations ADD COLUMN attended_at DATETIME(3) NULL`).catch(() => {})
    await prisma.$executeRawUnsafe(`ALTER TABLE event_registrations ADD COLUMN attendance_verified_by VARCHAR(191) NULL`).catch(() => {})
    await prisma.$executeRawUnsafe(`ALTER TABLE event_registrations ADD COLUMN qr_code_data LONGTEXT NULL`).catch(() => {})

    // 9. event_teams & event_team_members
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS event_teams (
        id VARCHAR(191) NOT NULL,
        event_id VARCHAR(191) NOT NULL,
        leader_id VARCHAR(191) NOT NULL,
        team_name VARCHAR(120) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'FORMING',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX event_teams_event_id_idx (event_id),
        INDEX event_teams_leader_id_idx (leader_id),
        CONSTRAINT fk_teams_event FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE,
        CONSTRAINT fk_teams_leader FOREIGN KEY (leader_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `).catch(() => {})

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS event_team_members (
        id VARCHAR(191) NOT NULL,
        team_id VARCHAR(191) NOT NULL,
        user_id VARCHAR(191) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'INVITED',
        invited_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        responded_at DATETIME(3) NULL,
        PRIMARY KEY (id),
        UNIQUE INDEX event_team_members_team_id_user_id_key (team_id, user_id),
        INDEX event_team_members_team_id_idx (team_id),
        INDEX event_team_members_user_id_idx (user_id),
        CONSTRAINT fk_team_members_team FOREIGN KEY (team_id) REFERENCES event_teams (id) ON DELETE CASCADE,
        CONSTRAINT fk_team_members_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `).catch(() => {})

    // 10. gallery_albums & gallery_photos
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS gallery_albums (
        id VARCHAR(191) NOT NULL,
        name VARCHAR(120) NOT NULL,
        description VARCHAR(500) NULL,
        cover_image LONGTEXT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `).catch(() => {})

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS gallery_photos (
        id VARCHAR(191) NOT NULL,
        album_id VARCHAR(191) NOT NULL,
        image_url LONGTEXT NOT NULL,
        caption VARCHAR(255) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX gallery_photos_album_id_idx (album_id),
        CONSTRAINT fk_photos_album FOREIGN KEY (album_id) REFERENCES gallery_albums (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `).catch(() => {})

    // 10. complaints table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS complaints (
        id VARCHAR(191) NOT NULL,
        user_id VARCHAR(191) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        message LONGTEXT NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'OPEN',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX complaints_user_id_idx (user_id),
        INDEX complaints_status_idx (status),
        INDEX complaints_created_at_idx (created_at),
        CONSTRAINT fk_complaints_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `).catch(() => {})

    // 11. club_team_members table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS club_team_members (
        id VARCHAR(191) NOT NULL,
        name VARCHAR(120) NOT NULL,
        role_title VARCHAR(120) NOT NULL,
        photo_url LONGTEXT NULL,
        bio VARCHAR(500) NULL,
        college_email VARCHAR(191) NULL,
        contact_email VARCHAR(191) NULL,
        instagram_url VARCHAR(255) NULL,
        github_url VARCHAR(255) NULL,
        linkedin_url VARCHAR(255) NULL,
        twitter_url VARCHAR(255) NULL,
        portfolio_url VARCHAR(255) NULL,
        skills VARCHAR(500) NULL,
        year INT NULL,
        branch VARCHAR(120) NULL,
        achievements LONGTEXT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        approval_status VARCHAR(50) NOT NULL DEFAULT 'APPROVED',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX club_team_members_sort_order_idx (sort_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `).catch(() => {})

    // 12. club_settings table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS club_settings (
        \`key\` VARCHAR(100) NOT NULL,
        \`value\` LONGTEXT NULL,
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`key\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `).catch(() => {})

    // 13. sessions table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
        expires INT(11) UNSIGNED NOT NULL,
        data MEDIUMTEXT COLLATE utf8mb4_bin,
        PRIMARY KEY (session_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(() => {})

    // 14. subscriptions table
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

    // 15. support_tickets & support_replies
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS support_tickets (
        id VARCHAR(191) NOT NULL,
        user_id VARCHAR(191) NOT NULL,
        tagged_role VARCHAR(50) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        message LONGTEXT NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'OPEN',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX support_tickets_user_id_idx (user_id),
        INDEX support_tickets_tagged_role_idx (tagged_role),
        INDEX support_tickets_status_idx (status),
        CONSTRAINT fk_support_tickets_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `).catch(() => {})

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS support_replies (
        id VARCHAR(191) NOT NULL,
        ticket_id VARCHAR(191) NOT NULL,
        user_id VARCHAR(191) NOT NULL,
        message LONGTEXT NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX support_replies_ticket_id_idx (ticket_id),
        INDEX support_replies_user_id_idx (user_id),
        CONSTRAINT fk_support_replies_ticket FOREIGN KEY (ticket_id) REFERENCES support_tickets (id) ON DELETE CASCADE,
        CONSTRAINT fk_support_replies_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `).catch(() => {})

    // 16. notifications table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(191) NOT NULL,
        user_id VARCHAR(191) NULL,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message LONGTEXT NOT NULL,
        link_url VARCHAR(255) NULL,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX notifications_user_id_idx (user_id),
        INDEX notifications_type_idx (type),
        INDEX notifications_created_at_idx (created_at),
        CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `).catch(() => {})

    // 17. council_messages table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS council_messages (
        id VARCHAR(191) NOT NULL,
        user_id VARCHAR(191) NOT NULL,
        message LONGTEXT NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX council_messages_user_id_idx (user_id),
        INDEX council_messages_created_at_idx (created_at),
        CONSTRAINT fk_council_messages_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `).catch(() => {})

    // 18. campus_reels table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS campus_reels (
        id VARCHAR(191) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description LONGTEXT NULL,
        url LONGTEXT NOT NULL,
        embed_type VARCHAR(50) NOT NULL DEFAULT 'EXTERNAL',
        thumbnail_url LONGTEXT NULL,
        author_handle VARCHAR(120) NULL,
        author_avatar LONGTEXT NULL,
        audio_title VARCHAR(255) NULL,
        is_admin_upload BOOLEAN NOT NULL DEFAULT FALSE,
        external_post_url LONGTEXT NULL,
        category VARCHAR(100) NOT NULL DEFAULT 'CAMPUS_LIFE',
        platform_mode VARCHAR(50) NOT NULL DEFAULT 'ALL',
        likes_count INT NOT NULL DEFAULT 0,
        views_count INT NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        is_featured BOOLEAN NOT NULL DEFAULT FALSE,
        posted_by VARCHAR(120) NOT NULL,
        author_role VARCHAR(60) NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX campus_reels_category_idx (category),
        INDEX campus_reels_platform_mode_idx (platform_mode),
        INDEX campus_reels_is_active_idx (is_active),
        INDEX campus_reels_is_admin_upload_idx (is_admin_upload),
        INDEX campus_reels_created_at_idx (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `).catch(() => {})

    // Add new columns to campus_reels if not present
    await prisma.$executeRawUnsafe(`ALTER TABLE campus_reels ADD COLUMN author_handle VARCHAR(120) NULL;`).catch(() => {})
    await prisma.$executeRawUnsafe(`ALTER TABLE campus_reels ADD COLUMN author_avatar LONGTEXT NULL;`).catch(() => {})
    await prisma.$executeRawUnsafe(`ALTER TABLE campus_reels ADD COLUMN audio_title VARCHAR(255) NULL;`).catch(() => {})
    await prisma.$executeRawUnsafe(`ALTER TABLE campus_reels ADD COLUMN is_admin_upload BOOLEAN NOT NULL DEFAULT FALSE;`).catch(() => {})
    await prisma.$executeRawUnsafe(`ALTER TABLE campus_reels ADD COLUMN external_post_url LONGTEXT NULL;`).catch(() => {})

    // 18b. reel_views table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS reel_views (
        id VARCHAR(191) NOT NULL,
        reel_id VARCHAR(191) NOT NULL,
        user_id VARCHAR(191) NOT NULL,
        viewed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE INDEX reel_views_reel_id_user_id_key (reel_id, user_id),
        INDEX reel_views_user_id_idx (user_id),
        INDEX reel_views_reel_id_idx (reel_id),
        CONSTRAINT fk_reel_views_reel FOREIGN KEY (reel_id) REFERENCES campus_reels (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `).catch(() => {})

    // 18c. reel_likes table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS reel_likes (
        id VARCHAR(191) NOT NULL,
        reel_id VARCHAR(191) NOT NULL,
        user_id VARCHAR(191) NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE INDEX reel_likes_reel_id_user_id_key (reel_id, user_id),
        INDEX reel_likes_user_id_idx (user_id),
        INDEX reel_likes_reel_id_idx (reel_id),
        CONSTRAINT fk_reel_likes_reel FOREIGN KEY (reel_id) REFERENCES campus_reels (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `).catch(() => {})

    // Seed/refresh authentic MRDU and Cybersecurity Club Instagram Reels
    try {
      const existingReels = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM campus_reels`)
      const count = Number(existingReels?.[0]?.count || 0)
      if (count === 0) {
        await prisma.$executeRawUnsafe(`
          INSERT INTO campus_reels (id, title, description, url, embed_type, author_handle, author_avatar, audio_title, is_admin_upload, external_post_url, category, platform_mode, likes_count, views_count, is_active, is_featured, posted_by, author_role)
          VALUES 
          ('reel-csc-1', 'MRDU Cyber Security Club Grand CTF Defense Battle & Induction 2026', 'Highlights from our annual Cyber Defense Arena & CTF live challenge at Malla Reddy University! #CyberSecurity #MRDU #EthicalHacking #CTF', 'https://www.instagram.com/reel/C8qL_k1S9gW/embed', 'INSTAGRAM', 'cybersecurityclub_mrdu', 'https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=150&auto=format&fit=crop&q=80', 'cybersecurityclub_mrdu • Original audio', TRUE, 'https://www.instagram.com/cybersecurityclub_mrdu', 'HACKATHONS', 'ALL', 184, 890, TRUE, TRUE, 'PR Team Lead', 'PR_TEAM'),
          ('reel-mrdu-1', 'MRDU Campus Vibes & National Hackathon Grand Finals 2026', 'Energy was off the charts at the MRDU Central Auditorium! Top tech innovators battling it out for 24 hours non-stop. #MRDU #CampusLife #TechFest', 'https://www.instagram.com/reel/C8aB1m_P0xz/embed', 'INSTAGRAM', 'mrdu_official', 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=150&auto=format&fit=crop&q=80', 'mrdu_official • Campus Beats Trending', FALSE, 'https://www.instagram.com/mrdu_official', 'CAMPUS_LIFE', 'ALL', 320, 1450, TRUE, TRUE, 'Media Lead', 'MEDIA_LEAD'),
          ('reel-csc-2', 'Live Wi-Fi Packet Sniffing & Network Security Workshop', 'Hands-on hardware security and wireless vulnerability exploitation workshop in Lab 304. #CyberKnights #NetworkSecurity #MRDU', 'https://www.instagram.com/reel/C7zN10xR3mB/embed', 'INSTAGRAM', 'cybersecurityclub_mrdu', 'https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=150&auto=format&fit=crop&q=80', 'cybersecurityclub_mrdu • Tech Audio Mix', TRUE, 'https://www.instagram.com/cybersecurityclub_mrdu', 'WORKSHOPS', 'ALL', 142, 620, TRUE, FALSE, 'Event Management', 'EVENT_MANAGEMENT'),
          ('reel-mrdu-2', 'MRDU Annual Tech & Cultural Extravaganza Highlights', 'A night of electrifying performances, tech showcases, and memorable campus celebrations! #MRDUFest #UniversityVibes', 'https://www.instagram.com/reel/C6yD2v_Q7lZ/embed', 'INSTAGRAM', 'mrdu_events', 'https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=150&auto=format&fit=crop&q=80', 'mrdu_events • Fest Anthem 2026', FALSE, 'https://www.instagram.com/mrdu_events', 'CULTURAL', 'ALL', 415, 2100, TRUE, FALSE, 'President Office', 'PRESIDENT');
        `).catch(() => {})
      }
    } catch {}

    // 19. Provision President Account
    const presidentMemberId = (process.env.PRESIDENT_MEMBER_ID || '25EU07R0015').toUpperCase()
    const presidentPassword = process.env.PRESIDENT_INITIAL_PASSWORD || 'Dh@nush@dmin_csmrdu2029'
    const presidentName = process.env.PRESIDENT_NAME || 'Dhanush'

    const existingPresident = await prisma.user.findUnique({
      where: { memberId: presidentMemberId },
      include: { profile: true },
    })

    if (!existingPresident) {
      const passwordHash = await bcrypt.hash(presidentPassword, env.bcryptRounds)
      await prisma.user.create({
        data: {
          memberId: presidentMemberId,
          passwordHash,
          role: 'PRESIDENT',
          accountStatus: 'ACTIVE',
          isPrimaryAdmin: true,
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
      })
      console.info(`[BOOTSTRAP SUCCESS] Primary President (${presidentMemberId}) provisioned successfully.`)
    }

    // 19. Seed Onboarding Video Settings
    await prisma.clubSetting.upsert({
      where: { key: 'introVideoUrl' },
      create: { key: 'introVideoUrl', value: 'https://www.youtube.com/watch?v=gokPW83s7nA' },
      update: {},
    })

    await prisma.clubSetting.upsert({
      where: { key: 'onboardingBriefingMode' },
      create: { key: 'onboardingBriefingMode', value: 'VIDEO' },
      update: {},
    })
  } catch (error) {
    console.warn('[BOOTSTRAP WARNING] Database bootstrap check warning:', error.message)
  }
}
