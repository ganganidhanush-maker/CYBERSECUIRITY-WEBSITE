import { rateLimit } from 'express-rate-limit'

const standard = { standardHeaders: 'draft-8', legacyHeaders: false }

export const globalRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 300,
  ...standard,
  message: { message: 'Too many requests. Please try again shortly.' },
})

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  skipSuccessfulRequests: true,
  ...standard,
  message: { message: 'Too many login attempts. Please try again later.' },
})

export const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: 5,
  ...standard,
  message: { message: 'Too many password reset requests. Please try again later.' },
})

export const twoFactorRateLimiter = rateLimit({
  windowMs: 5 * 60_000,
  limit: 8,
  ...standard,
  message: { message: 'Too many authentication code attempts. Please log in again.' },
})

export const authenticatedRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  keyGenerator: request => request.user?.id || request.ip,
  ...standard,
  message: { message: 'Too many requests. Please try again shortly.' },
})

export const adminWriteRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  keyGenerator: request => request.user?.id || request.ip,
  ...standard,
  message: { message: 'Too many administrative changes. Please try again shortly.' },
})

export const scannerRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 600, // 10 scans per second for high-traffic gate entry with no hanging
  keyGenerator: request => request.user?.id || request.ip,
  ...standard,
  message: { message: 'High scanner traffic detected. Please wait a moment.' },
})
