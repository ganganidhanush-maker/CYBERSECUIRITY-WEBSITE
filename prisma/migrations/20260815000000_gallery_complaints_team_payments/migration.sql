-- Ensure base event tables exist
CREATE TABLE IF NOT EXISTS `events` (
  `id` VARCHAR(191) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` LONGTEXT NULL,
  `event_type` VARCHAR(100) NOT NULL,
  `date_time` DATETIME(3) NOT NULL,
  `location` VARCHAR(255) NULL,
  `capacity` INT NULL,
  `photo_url` LONGTEXT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'UPCOMING',
  `requires_payment` BOOLEAN NOT NULL DEFAULT false,
  `payment_amount` DECIMAL(10, 2) NULL,
  `payment_qr_url` LONGTEXT NULL,
  `created_by` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `events_created_by_idx`(`created_by`),
  INDEX `events_status_idx`(`status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `event_form_fields` (
  `id` VARCHAR(191) NOT NULL,
  `event_id` VARCHAR(191) NOT NULL,
  `field_name` VARCHAR(255) NOT NULL,
  `field_type` VARCHAR(50) NOT NULL,
  `is_required` BOOLEAN NOT NULL DEFAULT false,
  `options` LONGTEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `event_form_fields_event_id_idx`(`event_id`),
  CONSTRAINT `event_form_fields_event_id_fkey` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `event_registrations` (
  `id` VARCHAR(191) NOT NULL,
  `event_id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `registered_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `form_data` JSON NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'REGISTERED',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `event_registrations_event_id_user_id_key`(`event_id`, `user_id`),
  INDEX `event_registrations_event_id_idx`(`event_id`),
  INDEX `event_registrations_user_id_idx`(`user_id`),
  CONSTRAINT `event_registrations_event_id_fkey` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Modify event/profile columns for larger payloads
ALTER TABLE `events` MODIFY `photo_url` LONGTEXT NULL;
ALTER TABLE `profiles` MODIFY `profile_image` LONGTEXT NULL;

-- Gallery albums
CREATE TABLE `gallery_albums` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `description` VARCHAR(500) NULL,
  `cover_image` LONGTEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `gallery_photos` (
  `id` VARCHAR(191) NOT NULL,
  `album_id` VARCHAR(191) NOT NULL,
  `image_url` LONGTEXT NOT NULL,
  `caption` VARCHAR(255) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `gallery_photos_album_id_idx`(`album_id`),
  CONSTRAINT `gallery_photos_album_id_fkey` FOREIGN KEY (`album_id`) REFERENCES `gallery_albums`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Member complaints
CREATE TABLE `complaints` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `subject` VARCHAR(255) NOT NULL,
  `message` LONGTEXT NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'OPEN',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `complaints_user_id_idx`(`user_id`),
  INDEX `complaints_status_idx`(`status`),
  INDEX `complaints_created_at_idx`(`created_at`),
  CONSTRAINT `complaints_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Club leadership / team directory
CREATE TABLE `club_team_members` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `role_title` VARCHAR(120) NOT NULL,
  `photo_url` LONGTEXT NULL,
  `sort_order` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `club_team_members_sort_order_idx`(`sort_order`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
