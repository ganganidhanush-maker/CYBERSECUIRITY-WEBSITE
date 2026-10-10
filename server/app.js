import cors from 'cors'
import compression from 'compression'
import express from 'express'
import helmet from 'helmet'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { env } from './config/env.js'
import { createSessionManager } from './config/session.js'
import { prisma } from './db/prisma.js'
import { errorHandler, notFoundHandler } from './middleware/error-handler.js'
import { csrfProtection } from './middleware/csrf.js'
import { requestContext } from './middleware/request-context.js'
import { globalRateLimiter } from './middleware/rate-limit.js'
import { adminRouter } from './routes/admin.routes.js'
import { authRouter } from './routes/auth.routes.js'
import { memberRouter } from './routes/member.routes.js'
import { getOpenApiDocument } from './openapi.js'

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function corsOptions() {
  const allowedOrigins = new Set(env.corsOrigin)
  return {
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
    origin(origin, callback) {
      if (!origin || allowedOrigins.size === 0 || allowedOrigins.has(origin)) return callback(null, true)
      return callback(null, true) // Permissive for production single-origin reverse proxies
    },
  }
}

export function createApp() {
  const app = express()
  if (env.isProduction) app.set('trust proxy', 1)
  app.set('etag', 'weak')
  app.disable('x-powered-by')
  app.use(compression({ threshold: 1024 }))
  app.use(requestContext)
  // Prevent connection hanging on slow networks: 30s timeout guard for APIs
  app.use('/api', (request, response, next) => {
    if (request.method === 'GET') {
      response.set('Cache-Control', 'private, no-cache, must-revalidate')
    }
    request.setTimeout(30_000, () => {
      if (!response.headersSent) {
        response.status(504).json({ error: 'GATEWAY_TIMEOUT', message: 'Request timed out due to slow network.' })
      }
    })
    next()
  })
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        fontSrc: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        frameSrc: ["'self'", 'https://www.youtube.com', 'https://www.youtube-nocookie.com', 'https://www.instagram.com', 'https://instagram.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://img.youtube.com', 'https://i.ytimg.com', 'https://*.cdninstagram.com', 'https://*.instagram.com', 'https://api.qrserver.com'],
        objectSrc: ["'none'"],
        scriptSrc: [
          "'self'",
          "'wasm-unsafe-eval'",
          'blob:',
          'https://www.youtube.com',
          'https://s.ytimg.com',
          'https://www.instagram.com',
          'https://platform.instagram.com',
          'https://cdn.jsdelivr.net',
          'https://unpkg.com',
        ],
        styleSrc: ["'self'", "'unsafe-inline'"],
        workerSrc: ["'self'", 'blob:'],
        childSrc: ["'self'", 'blob:'],
        connectSrc: env.isProduction
          ? ["'self'", 'blob:', 'data:', 'https://tessdata.projectnaptha.com', 'https://cdn.jsdelivr.net', 'https://unpkg.com', 'https://api.qrserver.com']
          : ["'self'", 'blob:', 'data:', 'ws://localhost:5173', 'http://localhost:3000', 'https://tessdata.projectnaptha.com', 'https://cdn.jsdelivr.net', 'https://unpkg.com', 'https://api.qrserver.com'],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    strictTransportSecurity: env.isProduction ? { maxAge: 31_536_000, includeSubDomains: true, preload: true } : false,
  }))
  app.use((request, response, next) => {
    response.set('Permissions-Policy', 'camera=(self), geolocation=(), microphone=(), payment=(), usb=()')
    return next()
  })
  app.use(cors(corsOptions()))
  app.use(express.json({ limit: '100mb' }))
  app.use(express.urlencoded({ extended: true, limit: '100mb' }))
  const sessionManager = createSessionManager()
  app.locals.closeSessionStore = sessionManager.close
  app.use(sessionManager.middleware)
  app.use(csrfProtection)

  let lastDbCheck = 0
  let dbHealthy = true

  app.get(['/api/v1/health', '/api/health'], async (request, response) => {
    const now = Date.now()
    if (now - lastDbCheck > 60_000) {
      try {
        await prisma.$queryRaw`SELECT 1`
        dbHealthy = true
      } catch {
        dbHealthy = false
      }
      lastDbCheck = now
    }
    if (dbHealthy) {
      return response.status(200).json({ status: 'ok', uptime: Math.floor(process.uptime()), timestamp: Date.now() })
    }
    return response.status(503).json({ status: 'unavailable', timestamp: Date.now() })
  })
  app.get(['/api/v1/docs', '/api/docs'], (request, response) => response.status(200).json(getOpenApiDocument()))
  app.use(['/api/v1/auth', '/api/auth'], authRouter)
  app.use(['/api/v1/admin', '/api/admin'], adminRouter)
  app.use(['/api/v1/member', '/api/member'], memberRouter)

  if (env.isProduction) {
    const distDirectory = path.join(workspaceRoot, 'dist')
    // Immutable 1-year caching for hashed JS/CSS assets (loads instantly on slow internet from browser cache)
    app.use('/assets', express.static(path.join(distDirectory, 'assets'), {
      maxAge: '1y',
      immutable: true,
      etag: true,
    }))
    app.use(express.static(distDirectory, {
      index: false,
      maxAge: '1h',
      etag: true,
      setHeaders(response, filePath) {
        if (filePath.endsWith('.html')) {
          response.setHeader('Cache-Control', 'no-cache, must-revalidate')
        }
      },
    }))
    app.use((request, response, next) => {
      if (request.method !== 'GET' || request.path.startsWith('/api/')) return next()
      response.sendFile(path.join(distDirectory, 'index.html'))
    })
  }
  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
