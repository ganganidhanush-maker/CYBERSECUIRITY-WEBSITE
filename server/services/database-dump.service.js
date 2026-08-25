import { prisma } from '../db/prisma.js'

function escapeSqlValue(value) {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'boolean') return value ? '1' : '0'
  if (typeof value === 'number') return String(value)
  if (value instanceof Date) {
    return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`
  }
  if (typeof value === 'object') {
    if (Buffer.isBuffer(value)) {
      return `X'${value.toString('hex')}'`
    }
    return `'${JSON.stringify(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
  }

  // String / Longtext / Image base64 escaping for MySQL
  const str = String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\0/g, '\\0')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\x1a/g, '\\Z')
  return `'${str}'`
}

export async function generateFullDatabaseSqlDump(exportedByMemberId = 'SYSTEM') {
  const timestamp = new Date().toISOString()
  const lines = []

  lines.push('-- ========================================================')
  lines.push('-- MALLA REDDY (MR) DEEMED TO BE UNIVERSITY & CYBER SECURITY CLUB')
  lines.push('-- COMPLETE FULL DATABASE DISASTER RECOVERY DUMP (.SQL)')
  lines.push(`-- Generated At : ${timestamp}`)
  lines.push(`-- Exported By  : ${exportedByMemberId}`)
  lines.push('-- Engine       : MySQL 8.0+ / InnoDB / UTF-8 Unicode')
  lines.push('-- Content      : All 18 Tables, Accounts, Photos, Videos, Settings & Logs')
  lines.push('-- ========================================================')
  lines.push('')
  lines.push('SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT;')
  lines.push('SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS;')
  lines.push('SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION;')
  lines.push('SET NAMES utf8mb4;')
  lines.push('SET @OLD_TIME_ZONE=@@TIME_ZONE;')
  lines.push("SET TIME_ZONE='+00:00';")
  lines.push('SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;')
  lines.push('SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;')
  lines.push("SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO';")
  lines.push('')

  // 18 database tables in FK-safe topological order
  const tableNames = [
    'club_settings',
    'users',
    'profiles',
    'permission_assignments',
    'audit_logs',
    'events',
    'event_activities',
    'event_form_fields',
    'event_registrations',
    'gallery_albums',
    'gallery_photos',
    'complaints',
    'club_team_members',
    'subscriptions',
    'support_tickets',
    'support_replies',
    'notifications',
    'council_messages',
  ]

  for (const table of tableNames) {
    try {
      // 1. Fetch raw table rows from database
      const rows = await prisma.$queryRawUnsafe(`SELECT * FROM \`${table}\``)

      lines.push(`-- ========================================================`)
      lines.push(`-- Table structure for \`${table}\``)
      lines.push(`-- ========================================================`)

      // Attempt to get exact CREATE TABLE statement from MySQL
      try {
        const createResult = await prisma.$queryRawUnsafe(`SHOW CREATE TABLE \`${table}\``)
        if (createResult && createResult[0]) {
          const createSql = createResult[0]['Create Table'] || createResult[0]['create table']
          if (createSql) {
            lines.push(`DROP TABLE IF EXISTS \`${table}\`;`)
            lines.push(`${createSql};`)
            lines.push('')
          }
        }
      } catch {
        // Table create statement skipped if not supported
      }

      lines.push(`-- --------------------------------------------------------`)
      lines.push(`-- Dumping data for table \`${table}\` (${rows.length} records)`)
      lines.push(`-- --------------------------------------------------------`)
      lines.push(`LOCK TABLES \`${table}\` WRITE;`)

      if (rows && rows.length > 0) {
        const cols = Object.keys(rows[0])
        lines.push(`INSERT INTO \`${table}\` (\`${cols.join('`, `')}\`) VALUES`)

        const valueChunks = rows.map((row, idx) => {
          const vals = Object.values(row).map(v => escapeSqlValue(v))
          const isLast = idx === rows.length - 1
          return `  (${vals.join(', ')})${isLast ? ';' : ','}`
        })

        lines.push(valueChunks.join('\n'))
      } else {
        lines.push(`-- (Table \`${table}\` is currently empty)`)
      }

      lines.push(`UNLOCK TABLES;`)
      lines.push('')
    } catch (err) {
      lines.push(`-- [WARNING] Could not dump table \`${table}\`: ${err.message}`)
      lines.push('')
    }
  }

  lines.push('-- ========================================================')
  lines.push('-- RESTORE SYSTEM CONFIGURATION')
  lines.push('-- ========================================================')
  lines.push('SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;')
  lines.push('SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;')
  lines.push('SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT;')
  lines.push('SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS;')
  lines.push('SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION;')
  lines.push('SET SQL_MODE=@OLD_SQL_MODE;')
  lines.push('SET TIME_ZONE=@OLD_TIME_ZONE;')
  lines.push('')
  lines.push('-- DISASTER RECOVERY DATABASE DUMP COMPLETED SUCCESSFULLY --')

  return lines.join('\n')
}
