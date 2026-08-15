import 'dotenv/config'
import { z } from 'zod'

const nodeEnvSchema = z.enum(['development', 'test', 'staging', 'production'])
const integer = (fallback, min, max) => z.coerce.number().int().min(min).max(max).default(fallback)

const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null

const optionalUrlList = z.string().trim().optional().transform(value => {
  if (value) return value.split(',').map(origin => origin.trim()).filter(Boolean)
  if (railwayDomain) return [railwayDomain]
  return []
})

const rawEnvironment = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT,
  databaseUrl: process.env.DATABASE_URL,
  sessionSecret: process.env.SESSION_SECRET,
  sessionEncryptionKey: process.env.SESSION_ENCRYPTION_KEY,
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
  databaseUrl: z.string().url().refine(value => ['mysql:', 'mariadb:'].includes(new URL(value).protocol), 'DATABASE_URL must use mysql or mariadb'),
  sessionSecret: z.string().min(32),
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
  if (env.isProduction && env.corsOrigin.length === 0) {
    console.warn('[CONFIG INFO] CORS_ORIGIN is not explicitly configured. Single-origin production mode is active.')
  }
  if (env.isProduction && !env.hasSmtp) {
    console.warn('[CONFIG INFO] SMTP is not configured. Password recovery emails will be disabled until SMTP credentials are provided.')
  }
}
