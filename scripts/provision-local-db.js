import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const envPath = path.join(projectRoot, '.env')

if (!fs.existsSync(envPath)) throw new Error('Missing .env. Run npm run setup:local-env first.')
const content = fs.readFileSync(envPath, 'utf8')
const databaseUrlMatch = content.match(/^DATABASE_URL="?([^"\r\n]+)"?$/m)
if (!databaseUrlMatch) throw new Error('DATABASE_URL is missing from .env.')
if (!databaseUrlMatch[1].includes('replace-with-db-password')) {
  console.log('DATABASE_URL already uses custom credentials; leaving it unchanged.')
  process.exit(0)
}

const password = crypto.randomBytes(30).toString('base64url')
const databaseUrl = `mysql://club_portal:${encodeURIComponent(password)}@localhost:3306/cyber_security_club`
const withDatabaseUrl = content.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL="${databaseUrl}"`)
const output = /^LOCAL_DB_PASSWORD=/m.test(withDatabaseUrl)
  ? withDatabaseUrl.replace(/^LOCAL_DB_PASSWORD=.*$/m, `LOCAL_DB_PASSWORD="${password}"`)
  : `${withDatabaseUrl.trimEnd()}\nLOCAL_DB_PASSWORD="${password}"\n`

fs.writeFileSync(envPath, output, { encoding: 'utf8', mode: 0o600 })
console.log('Created unique local MariaDB credentials in the ignored .env file.')
