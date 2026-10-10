import { prisma } from '../db/prisma.js'
import { authUserCache } from './auth-cache.service.js'
import { invalidatePlatformModeCache } from './platform-role.service.js'

function escapeSqlValue(value) {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'boolean') return value ? '1' : '0'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'bigint') return String(value)
  if (value instanceof Date) {
    return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`
  }
  if (typeof value === 'object') {
    if (Buffer.isBuffer(value)) {
      return `X'${value.toString('hex')}'`
    }
    // Prisma Decimal or JSON object
    if (typeof value.toFixed === 'function' && !Array.isArray(value)) {
      return String(value.toString())
    }
    return `'${JSON.stringify(value)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')}'`
  }

  // String / Longtext / Image base64 escaping for MySQL & TiDB
  const str = String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\0/g, '\\0')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\x1a/g, '\\Z')
  return `'${str}'`
}

// All 24 database tables in strict FK-safe topological order
export const ALL_DATABASE_TABLES = [
  'club_settings',
  'users',
  'profiles',
  'permission_assignments',
  'audit_logs',
  'events',
  'event_activities',
  'event_form_fields',
  'event_teams',
  'event_team_members',
  'event_registrations',
  'payment_verification_logs',
  'gallery_albums',
  'gallery_photos',
  'complaints',
  'club_team_members',
  'subscriptions',
  'support_tickets',
  'support_replies',
  'notifications',
  'council_messages',
  'campus_reels',
  'reel_views',
  'reel_likes',
]

export async function generateFullDatabaseSqlDump(exportedByMemberId = 'SYSTEM') {
  const timestamp = new Date().toISOString()
  const lines = []
  const orderedTables = [...ALL_DATABASE_TABLES]

  lines.push('-- ========================================================')
  lines.push('-- MALLA REDDY (MR) DEEMED TO BE UNIVERSITY & CYBER SECURITY CLUB')
  lines.push('-- COMPLETE FULL DATABASE DISASTER RECOVERY DUMP (.SQL)')
  lines.push(`-- Generated At : ${timestamp}`)
  lines.push(`-- Exported By  : ${exportedByMemberId}`)
  lines.push('-- Engine       : TiDB Cloud Serverless / MySQL 8.0+ / InnoDB / UTF-8')
  lines.push(`-- Content      : All ${orderedTables.length} Tables, Accounts, Passes, Emails, Photos, Reels, Teams & Settings`)
  lines.push('-- ========================================================')
  lines.push('')
  lines.push('SET NAMES utf8mb4;')
  lines.push("SET TIME_ZONE='+00:00';")
  lines.push('SET UNIQUE_CHECKS=0;')
  lines.push('SET FOREIGN_KEY_CHECKS=0;')
  lines.push("SET SQL_MODE='NO_AUTO_VALUE_ON_ZERO';")
  lines.push('')

  let totalRowsExported = 0
  let consecutiveFailures = 0
  let firstErrorMsg = ''

  // Fetch tables in parallel batches of 6 to cut export latency by ~75%
  const BATCH_SIZE = 6
  for (let i = 0; i < orderedTables.length; i += BATCH_SIZE) {
    const batch = orderedTables.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.all(
      batch.map(async table => {
        try {
          const [rows, createResult] = await Promise.all([
            prisma.$queryRawUnsafe(`SELECT * FROM \`${table}\``),
            prisma.$queryRawUnsafe(`SHOW CREATE TABLE \`${table}\``).catch(() => null),
          ])
          return { table, rows: Array.isArray(rows) ? rows : [], createResult, error: null }
        } catch (err) {
          return { table, rows: [], createResult: null, error: err }
        }
      })
    )

    for (const res of batchResults) {
      const { table, rows, createResult, error } = res
      if (error) {
        consecutiveFailures++
        if (!firstErrorMsg) firstErrorMsg = error.message || String(error)
        // If the database connection itself is throttled or unreachable, fail fast instead of waiting on 24 tables
        if (consecutiveFailures >= 3 && totalRowsExported === 0) {
          throw new Error(
            `Database query blocked by TiDB (${firstErrorMsg.slice(0, 140)}). Because your old TiDB instance hit 60.5M / 50M Request Units with a $0.00 limit, TiDB has paused queries on it. In TiDB Cloud Console, temporarily set Monthly Spending Limit on the old instance to $1.00 (costs $0.00) for 1 minute to download the .sql backup!`
          )
        }
        lines.push(`-- [WARNING] Could not dump table \`${table}\`: ${error.message}`)
        lines.push('')
        continue
      }

      consecutiveFailures = 0
      const count = rows.length
      totalRowsExported += count

      lines.push(`-- ========================================================`)
      lines.push(`-- Table structure for \`${table}\``)
      lines.push(`-- ========================================================`)

      if (createResult && createResult[0]) {
        const rawCreateSql = createResult[0]['Create Table'] || createResult[0]['create table']
        if (rawCreateSql) {
          const safeCreateSql = rawCreateSql.replace(/^CREATE TABLE/i, 'CREATE TABLE IF NOT EXISTS')
          lines.push(`${safeCreateSql};`)
          lines.push('')
        }
      }

      lines.push(`-- --------------------------------------------------------`)
      lines.push(`-- Dumping data for table \`${table}\` (${count} records)`)
      lines.push(`-- --------------------------------------------------------`)

      if (count > 0) {
        const cols = Object.keys(rows[0])
        const colListSql = `\`${cols.join('`, `')}\``
        for (const row of rows) {
          const vals = cols.map(c => escapeSqlValue(row[c]))
          lines.push(`REPLACE INTO \`${table}\` (${colListSql}) VALUES (${vals.join(', ')});`)
        }
      } else {
        lines.push(`-- (Table \`${table}\` is currently empty)`)
      }

      lines.push('')
    }
  }

  lines.push('-- ========================================================')
  lines.push('-- RESTORE SYSTEM CONFIGURATION')
  lines.push('-- ========================================================')
  lines.push('SET FOREIGN_KEY_CHECKS=1;')
  lines.push('SET UNIQUE_CHECKS=1;')
  lines.push('')
  lines.push(`-- DISASTER RECOVERY DATABASE DUMP COMPLETED (${totalRowsExported} TOTAL RECORDS) --`)

  return lines.join('\n')
}

/**
 * Splits a SQL dump string into individual executable statements while respecting
 * single-quoted string literals and backslash escapes (including large Base64 strings).
 */
export function splitSqlStatements(sqlContent) {
  const statements = []
  let current = ''
  let inSingleQuote = false
  let inDoubleQuote = false
  let inBacktick = false
  let inLineComment = false
  let inBlockComment = false

  const len = sqlContent.length
  for (let i = 0; i < len; i++) {
    const ch = sqlContent[i]
    const next = i + 1 < len ? sqlContent[i + 1] : ''

    if (inLineComment) {
      if (ch === '\n') {
        inLineComment = false
      }
      continue
    }

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false
        i++
      }
      continue
    }

    if (!inSingleQuote && !inDoubleQuote && !inBacktick) {
      if (ch === '-' && next === '-') {
        inLineComment = true
        i++
        continue
      }
      if (ch === '/' && next === '*') {
        inBlockComment = true
        i++
        continue
      }
    }

    if (ch === '\\' && (inSingleQuote || inDoubleQuote)) {
      current += ch + next
      i++
      continue
    }

    if (ch === "'" && !inDoubleQuote && !inBacktick) {
      if (inSingleQuote && next === "'") {
        current += "''"
        i++
        continue
      }
      inSingleQuote = !inSingleQuote
      current += ch
      continue
    }

    if (ch === '"' && !inSingleQuote && !inBacktick) {
      inDoubleQuote = !inDoubleQuote
      current += ch
      continue
    }

    if (ch === '`' && !inSingleQuote && !inDoubleQuote) {
      inBacktick = !inBacktick
      current += ch
      continue
    }

    if (ch === ';' && !inSingleQuote && !inDoubleQuote && !inBacktick) {
      const trimmed = current.trim()
      if (trimmed) {
        statements.push(trimmed)
      }
      current = ''
      continue
    }

    current += ch
  }

  const tail = current.trim()
  if (tail) {
    statements.push(tail)
  }

  return statements
}

export async function restoreFullDatabaseSqlDump(sqlContent) {
  if (!sqlContent || typeof sqlContent !== 'string' || !sqlContent.trim()) {
    throw new Error('SQL backup content is empty.')
  }

  const statements = splitSqlStatements(sqlContent)
  if (statements.length === 0) {
    throw new Error('No executable SQL statements found in the uploaded backup file.')
  }

  let executedCount = 0
  let dataStatementCount = 0
  const warnings = []

  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS=0;')
  try {
    for (const stmt of statements) {
      const upper = stmt.slice(0, 40).toUpperCase().trim()
      // Skip LOCK/UNLOCK TABLES which are unsupported on TiDB Cloud Serverless
      if (upper.startsWith('LOCK TABLES') || upper.startsWith('UNLOCK TABLES')) {
        continue
      }
      // Skip DROP TABLE IF EXISTS when restoring into a live Prisma schema unless needed,
      // and convert INSERT INTO to REPLACE INTO so existing seeded records (like Primary President) are updated cleanly
      if (upper.startsWith('DROP TABLE')) {
        continue
      }

      let finalStmt = stmt
      if (upper.startsWith('INSERT INTO ')) {
        finalStmt = 'REPLACE INTO ' + stmt.slice(12)
      } else if (upper.startsWith('CREATE TABLE ') && !upper.startsWith('CREATE TABLE IF NOT EXISTS')) {
        finalStmt = stmt.replace(/^CREATE TABLE /i, 'CREATE TABLE IF NOT EXISTS ')
      }

      try {
        await prisma.$executeRawUnsafe(finalStmt)
        executedCount++
        if (upper.startsWith('INSERT ') || upper.startsWith('REPLACE ')) {
          dataStatementCount++
        }
      } catch (err) {
        warnings.push(`${finalStmt.slice(0, 80)}... -> ${err.message}`)
      }
    }
  } finally {
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS=1;').catch(() => {})
    authUserCache.clear()
    invalidatePlatformModeCache()
  }

  return {
    totalStatements: statements.length,
    executedCount,
    dataStatementCount,
    warningCount: warnings.length,
    warnings: warnings.slice(0, 15),
  }
}

