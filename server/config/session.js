import crypto from 'node:crypto'
import session from 'express-session'
import MySQLStoreFactory from 'express-mysql-session'
import { env } from './env.js'

const CIPHER = 'aes-256-gcm'

function sessionDatabaseOptions() {
  const connection = new URL(env.databaseUrl)
  const sslParam = connection.searchParams.get('ssl') || connection.searchParams.get('sslmode') || connection.searchParams.get('sslaccept')
  let ssl = undefined
  if (sslParam) {
    const lower = sslParam.toLowerCase()
    if (lower === 'true' || lower === 'require' || lower === 'strict') ssl = true
    else if (lower === 'accept-invalid-certs' || lower === 'prefer' || lower === 'no-verify') ssl = { rejectUnauthorized: false }
    else if (lower === 'false' || lower === 'disable') ssl = false
    else {
      try { ssl = JSON.parse(sslParam) } catch { ssl = true }
    }
  }

  return {
    host: connection.hostname,
    port: Number(connection.port || 3306),
    user: decodeURIComponent(connection.username),
    password: decodeURIComponent(connection.password),
    database: connection.pathname.slice(1),
    ...(ssl !== undefined ? { ssl } : {}),
  }
}

function encrypt(value) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(CIPHER, env.sessionEncryptionKey, iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`
}

function decrypt(value) {
  if (typeof value !== 'string') throw new Error('Invalid encrypted session payload')
  const [version, encodedIv, encodedTag, encodedPayload] = value.split('.')
  if (version !== 'v1' || !encodedIv || !encodedTag || !encodedPayload) throw new Error('Unsupported session payload')
  const decipher = crypto.createDecipheriv(CIPHER, env.sessionEncryptionKey, Buffer.from(encodedIv, 'base64url'))
  decipher.setAuthTag(Buffer.from(encodedTag, 'base64url'))
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encodedPayload, 'base64url')), decipher.final()])
  return JSON.parse(decrypted.toString('utf8'))
}

class EncryptedSessionStore extends session.Store {
  constructor(store) {
    super()
    this.store = store
  }

  get(sessionId, callback) {
    this.store.get(sessionId, (error, encryptedSession) => {
      if (error || !encryptedSession) return callback(error, encryptedSession)
      try { return callback(null, decrypt(encryptedSession)) } catch { return callback(null, null) }
    })
  }

  set(sessionId, sessionData, callback) {
    return this.store.set(sessionId, encrypt(sessionData), callback)
  }

  touch(sessionId, sessionData, callback) {
    return this.set(sessionId, sessionData, callback)
  }

  destroy(sessionId, callback) { return this.store.destroy(sessionId, callback) }
  close(callback) { return this.store.close(callback) }
}

export const sessionCookieOptions = Object.freeze({
  httpOnly: true,
  secure: env.isProduction ? 'auto' : false,
  sameSite: 'lax',
  maxAge: env.sessionMaxAgeMs,
  path: '/',
})

export function createSessionManager() {
  const MySQLStore = MySQLStoreFactory(session)
  const mysqlStore = new MySQLStore({
    ...sessionDatabaseOptions(),
    clearExpired: true,
    checkExpirationInterval: 900_000,
    expiration: env.sessionMaxAgeMs,
    createDatabaseTable: true,
    schema: { tableName: 'sessions', columnNames: { session_id: 'session_id', expires: 'expires', data: 'data' } },
  })
  const store = new EncryptedSessionStore(mysqlStore)

  const middleware = session({
    name: 'csc.sid',
    secret: env.sessionSecret,
    store,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    rolling: true,
    cookie: sessionCookieOptions,
  })

  return {
    middleware,
    close: () => new Promise(resolve => store.close(() => resolve())),
  }
}
