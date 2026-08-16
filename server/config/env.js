import crypto from 'node:crypto'
import 'dotenv/config'
import { z } from 'zod'

const nodeEnvSchema = z.enum(['development', 'test', 'staging', 'production'])
const integer = (fallback, min, max) => z.coerce.number().int().min(min).max(max).default(fallback)

const currentEnv = process.env.NODE_ENV || 'production'

const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null

const optionalUrlList = z.string().trim().optional().transform(value => {
  if (value) return value.split(',').map(origin => origin.trim()).filter(Boolean)
  if (railwayDomain) return [railwayDomain]
  return []
})

// Auto-generated secure cryptographic keys if not explicitly provided in environment
const fallbackSessionSecret = crypto.randomBytes(48).toString('base64url')
const fallbackSessionKey = crypto.randomBytes(32).toString('base64')

const resolvedDatabaseUrl = process.env.DATABASE_URL
  || process.env.MYSQL_URL
  || process.env.MYSQLDATABASE_URL
  || process.env.MYSQL_PUBLIC_URL
  || process.env.MARIADB_URL
  || process.env.DATABASE_PRIVATE_URL

const rawEnvironment = {
  nodeEnv: currentEnv,
  port: process.env.PORT || 3000,
  databaseUrl: resolvedDatabaseUrl,
  sessionSecret: process.env.SESSION_SECRET || fallbackSessionSecret,
  sessionEncryptionKey: process.env.SESSION_ENCRYPTION_KEY || fallbackSessionKey,
  corsOrigin: process.env.CORS_ORIGIN,
  publicAppUrl: process.env.PUBLIC_APP_URL || railwayDomain || undefined,
  sessionMaxAgeMs: process.env.SESSION_MAX_AGE_MS,
  bcryptRounds: process.env.BCRYPT_ROUNDS,
  loginMaxAttempts: process.env.LOGIN_MAX_ATTEMPTS,
  loginLockMinutes: process.env.LOGIN_LOCK_MINUTES,
  auditLogRetentionDays: process.env.AUDIT_LOG_RETENTION_DAYS,
  smtpHost: process.env.SMTP_HOST,
  smtpPort: process.env.SMTP_PORT,
  smtpUser: process.env.SMTP_USER,
  smtpPassword: process.env.SMTP_PASSWORD,
  smtpFrom: process.env.SMTP_FROM,
}

const parsed = z.object({
  nodeEnv: nodeEnvSchema,
  port: integer(3000, 80, 65535),
  databaseUrl: z.string({
    required_error: 'DATABASE_URL is missing. Please set DATABASE_URL or link a MySQL service.',
  }).url().refine(value => ['mysql:', 'mariadb:'].includes(new URL(value).protocol), 'DATABASE_URL must use mysql or mariadb protocol'),
  sessionSecret: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  sessionEncryptionKey: z.string().min(40).refine(value => {
    try { return Buffer.from(value, 'base64').length === 32 } catch { return false }
  }, 'SESSION_ENCRYPTION_KEY must be a base64-encoded 32-byte key'),
  corsOrigin: optionalUrlList,
  publicAppUrl: z.string().url().optional(),
  sessionMaxAgeMs: integer(28_800_000, 3_600_000, 86_400_000),
  bcryptRounds: integer(12, 10, 16),
  loginMaxAttempts: integer(5, 3, 10),
  loginLockMinutes: integer(15, 5, 1440),
  auditLogRetentionDays: integer(365, 30, 3650),
  smtpHost: z.string().trim().min(1).optional(),
  smtpPort: z.coerce.number().int().min(1).max(65535).optional(),
  smtpUser: z.string().trim().min(1).optional(),
  smtpPassword: z.string().min(1).optional(),
  smtpFrom: z.string().email().optional(),
}).safeParse(rawEnvironment)

if (!parsed.success) {
  const details = parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ')
  throw new Error(`Invalid environment configuration: ${details}`)
}

export const env = Object.freeze({
  ...parsed.data,
  sessionEncryptionKey: Buffer.from(parsed.data.sessionEncryptionKey, 'base64'),
  isProduction: parsed.data.nodeEnv === 'production',
  hasSmtp: Boolean(parsed.data.smtpHost && parsed.data.smtpPort && parsed.data.smtpUser && parsed.data.smtpPassword && parsed.data.smtpFrom),
})

export function assertRuntimeConfiguration() {
  if (!process.env.SESSION_SECRET) {
    console.warn('[CONFIG WARN] SESSION_SECRET environment variable was not provided. An in-memory cryptographically secure key was auto-generated.')
  }
  if (!process.env.SESSION_ENCRYPTION_KEY) {
    console.warn('[CONFIG WARN] SESSION_ENCRYPTION_KEY environment variable was not provided. An in-memory cryptographically secure key was auto-generated.')
  }
  if (env.isProduction && env.corsOrigin.length === 0) {
    console.warn('[CONFIG INFO] CORS_ORIGIN is not explicitly configured. Single-origin production mode is active.')
  }
  if (env.isProduction && !env.hasSmtp) {
    console.warn('[CONFIG INFO] SMTP is not configured. Password recovery emails will be disabled until SMTP credentials are provided.')
  }
}
