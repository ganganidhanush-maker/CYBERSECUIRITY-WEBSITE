import crypto from 'node:crypto'

export function requestContext(request, response, next) {
  request.id = crypto.randomUUID()
  response.set('X-Request-Id', request.id)
  return next()
}
