import crypto from 'node:crypto'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

const EXEMPT_PATHS = new Set([
  '/api/v1/auth/login',
  '/api/v1/auth/register-guest',
  '/api/v1/auth/verify-2fa',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
  '/api/v1/auth/csrf',
  '/api/v1/health',
  '/api/v1/member/intro-video/complete',
  '/api/v1/member/waiting-queue/complete',
  '/api/member/waiting-queue/complete',
  '/api/v1/member/waiting-queue/heartbeat',
  '/api/member/waiting-queue/heartbeat',
  '/api/v1/member/ocr-extract-utr',
  '/api/member/ocr-extract-utr',
])

function tokenFor(secret) {
  return crypto.createHmac('sha256', secret).update('csc-csrf-v1').digest('base64url')
}

function equal(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

export function issueCsrfToken(request) {
  if (!request.session.csrfSecret) request.session.csrfSecret = crypto.randomBytes(32).toString('base64url')
  return tokenFor(request.session.csrfSecret)
}

export function csrfToken(request, response) {
  response.set('Cache-Control', 'no-store')
  return response.status(200).json({ csrfToken: issueCsrfToken(request) })
}

export function csrfProtection(request, response, next) {
  if (
    SAFE_METHODS.has(request.method) ||
    EXEMPT_PATHS.has(request.path) ||
    request.path.endsWith('/auth/login') ||
    request.path.endsWith('/auth/register-guest') ||
    request.path.endsWith('/auth/verify-2fa') ||
    request.path.endsWith('/auth/forgot-password') ||
    request.path.endsWith('/auth/reset-password') ||
    request.path.endsWith('/auth/csrf')
  ) {
    return next()
  }

  const expected = request.session?.csrfSecret ? tokenFor(request.session.csrfSecret) : null
  if (!expected) {
    // If no session secret has been initialized yet, allow request to proceed and initialize session
    return next()
  }

  const incomingToken = request.get('x-csrf-token') || request.body?._csrf
  if (incomingToken && equal(incomingToken, expected)) {
    return next()
  }

  // If request has valid session cookie from same origin (X-Requested-With check)
  if (request.get('x-requested-with') === 'XMLHttpRequest' && request.session?.userId) {
    return next()
  }

  return response.status(403).json({ message: 'Invalid request security token. Refresh the page and try again.' })
}
