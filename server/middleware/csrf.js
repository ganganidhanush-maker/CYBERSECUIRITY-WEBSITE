import crypto from 'node:crypto'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

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
  if (SAFE_METHODS.has(request.method) || request.path === '/api/v1/auth/csrf') return next()
  const expected = request.session?.csrfSecret ? tokenFor(request.session.csrfSecret) : null
  if (!equal(request.get('x-csrf-token'), expected)) {
    return response.status(403).json({ message: 'Invalid request security token. Refresh the page and try again.' })
  }
  return next()
}
