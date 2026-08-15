import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaClient } from '@prisma/client'
import { env } from '../config/env.js'

// Runtime configuration is asserted before the HTTP server starts. The inert fallback
// keeps isolated authorization tests importable without opening a database connection.
const databaseUrl = new URL(env.databaseUrl || 'mysql://placeholder:placeholder@localhost:3306/placeholder')
const adapter = new PrismaMariaDb({
  host: databaseUrl.hostname,
  port: Number(databaseUrl.port || 3306),
  user: decodeURIComponent(databaseUrl.username),
  password: decodeURIComponent(databaseUrl.password),
  database: databaseUrl.pathname.slice(1),
  connectionLimit: 10,
  connectTimeout: 30000,
  acquireTimeout: 30000,
})

export const prisma = new PrismaClient({ adapter })
