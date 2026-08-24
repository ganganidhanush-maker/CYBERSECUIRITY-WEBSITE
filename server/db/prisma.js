import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaClient } from '@prisma/client'
import { env } from '../config/env.js'

function parseSslOption(url) {
  const sslParam = url.searchParams.get('ssl') || url.searchParams.get('sslmode') || url.searchParams.get('sslaccept')
  if (!sslParam) return undefined
  const lower = sslParam.toLowerCase()
  if (lower === 'true' || lower === 'require' || lower === 'strict') {
    return true
  }
  if (lower === 'accept-invalid-certs' || lower === 'prefer' || lower === 'no-verify') {
    return { rejectUnauthorized: false }
  }
  if (lower === 'false' || lower === 'disable') {
    return false
  }
  try {
    return JSON.parse(sslParam)
  } catch {
    return true
  }
}

// Runtime configuration is asserted before the HTTP server starts. The inert fallback
// keeps isolated authorization tests importable without opening a database connection.
const databaseUrl = new URL(env.databaseUrl || 'mysql://placeholder:placeholder@localhost:3306/placeholder')
const ssl = parseSslOption(databaseUrl)

const adapter = new PrismaMariaDb({
  host: databaseUrl.hostname,
  port: Number(databaseUrl.port || 3306),
  user: decodeURIComponent(databaseUrl.username),
  password: decodeURIComponent(databaseUrl.password),
  database: databaseUrl.pathname.slice(1),
  connectionLimit: 10,
  connectTimeout: 30000,
  acquireTimeout: 30000,
  allowPublicKeyRetrieval: true,
  ...(ssl !== undefined ? { ssl } : {}),
})

export const prisma = new PrismaClient({ adapter })
