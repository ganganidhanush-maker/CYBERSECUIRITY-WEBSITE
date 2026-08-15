ALTER TABLE `users`
  ADD COLUMN `failed_login_attempts` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `locked_until` DATETIME(3) NULL,
  ADD COLUMN `password_reset_token_hash` VARCHAR(64) NULL,
  ADD COLUMN `password_reset_expires_at` DATETIME(3) NULL,
  ADD COLUMN `totp_secret_encrypted` VARCHAR(512) NULL,
  ADD COLUMN `totp_enabled` BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN `last_logout_all_devices_at` DATETIME(3) NULL;

CREATE UNIQUE INDEX `users_password_reset_token_hash_key` ON `users`(`password_reset_token_hash`);
