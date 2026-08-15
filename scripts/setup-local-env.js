import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const target = path.join(projectRoot, '.env')
const password = process.env.CSC_INITIAL_PASSWORD

if (fs.existsSync(target)) throw new Error('.env already exists. Update it manually instead of overwriting existing configuration.')
if (!password || password.length < 12) throw new Error('Set CSC_INITIAL_PASSWORD to the intended President password before running this command.')

const escapeValue = value => `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, '')}"`
const sessionSecret = crypto.randomBytes(48).toString('base64url')
const encryptionKey = crypto.randomBytes(32).toString('base64')
const databaseUrl = process.env.CSC_DATABASE_URL || 'mysql://club_portal:replace-with-db-password@localhost:3306/cyber_security_club'
const presidentName = process.env.CSC_PRESIDENT_NAME || 'Dhanush'

const content = [
  `DATABASE_URL=${escapeValue(databaseUrl)}`,
  `SESSION_SECRET=${escapeValue(sessionSecret)}`,
  `SESSION_ENCRYPTION_KEY=${escapeValue(encryptionKey)}`,
  'SESSION_MAX_AGE_MS=28800000',
  'PORT=3000',
  'NODE_ENV=development',
  'CORS_ORIGIN=http://localhost:5173',
  'PUBLIC_APP_URL=http://localhost:5173',
  'BCRYPT_ROUNDS=12',
  'LOGIN_MAX_ATTEMPTS=5',
  'LOGIN_LOCK_MINUTES=15',
  'AUDIT_LOG_RETENTION_DAYS=365',
  'PRESIDENT_MEMBER_ID=25EU07R0015',
  `PRESIDENT_INITIAL_PASSWORD=${escapeValue(password)}`,
  `PRESIDENT_NAME=${escapeValue(presidentName)}`,
  'VITE_API_BASE_URL=/api/v1',
  '',
].join('\n')

fs.writeFileSync(target, content, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
console.log('Created untracked .env with unique session keys and the configured President account. Set DATABASE_URL to your local MySQL credentials before starting the API.')
