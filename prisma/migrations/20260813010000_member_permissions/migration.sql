CREATE TABLE `permission_assignments` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `permission` ENUM(
    'DASHBOARD_VIEW',
    'EVENTS_VIEW',
    'EVENT_REGISTER',
    'REGISTRATIONS_VIEW',
    'QR_PASSES_VIEW',
    'GALLERY_VIEW',
    'CHAT_USE',
    'SUGGESTIONS_CREATE',
    'FEEDBACK_CREATE',
    'NOTIFICATIONS_VIEW',
    'PROFILE_EDIT'
  ) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `permission_assignments_user_id_permission_key`(`user_id`, `permission`),
  INDEX `permission_assignments_permission_idx`(`permission`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `permission_assignments` ADD CONSTRAINT `permission_assignments_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
