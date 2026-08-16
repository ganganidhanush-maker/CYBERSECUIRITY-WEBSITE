import cors from 'cors'
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
      if (!origin || allowedOrigins.has(origin)) return callback(null, true)
      return callback(new Error('Origin is not allowed by CORS policy'))
    },
  }
}

export function createApp() {
  const app = express()
  if (env.isProduction) app.set('trust proxy', 1)
  app.disable('x-powered-by')
  app.use(requestContext)
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        fontSrc: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        frameSrc: ["'self'", 'https://www.youtube.com', 'https://www.youtube-nocookie.com'],
        imgSrc: ["'self'", 'data:', 'https://img.youtube.com', 'https://i.ytimg.com'],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'", 'https://www.youtube.com', 'https://s.ytimg.com'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: env.isProduction ? ["'self'"] : ["'self'", 'ws://localhost:5173', 'http://localhost:3000'],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    strictTransportSecurity: env.isProduction ? { maxAge: 31_536_000, includeSubDomains: true, preload: true } : false,
  }))
  app.use((request, response, next) => {
    response.set('Permissions-Policy', 'camera=(), geolocation=(), microphone=(), payment=(), usb=()')
    return next()
  })
  app.use(cors(corsOptions()))
  app.use(globalRateLimiter)
  app.use(express.json({ limit: '4mb' }))
  const sessionManager = createSessionManager()
  app.locals.closeSessionStore = sessionManager.close
  app.use(sessionManager.middleware)
  app.use(csrfProtection)

  app.get(['/api/v1/health', '/api/health'], async (request, response) => {
    try {
      await prisma.$queryRaw`SELECT 1`
      response.status(200).json({ status: 'ok', database: 'connected', requestId: request.id })
    } catch {
      response.status(503).json({ status: 'unavailable', database: 'unavailable', requestId: request.id })
    }
  })
  app.get(['/api/v1/docs', '/api/docs'], (request, response) => response.status(200).json(getOpenApiDocument()))
  app.use(['/api/v1/auth', '/api/auth'], authRouter)
  app.use(['/api/v1/admin', '/api/admin'], adminRouter)
  app.use(['/api/v1/member', '/api/member'], memberRouter)

  if (env.isProduction) {
    const distDirectory = path.join(workspaceRoot, 'dist')
    app.use(express.static(distDirectory, { index: false, maxAge: '1h', etag: true }))
    app.use((request, response, next) => {
      if (request.method !== 'GET' || request.path.startsWith('/api/')) return next()
      response.sendFile(path.join(distDirectory, 'index.html'))
    })
  }
  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
