export function sanitizeErrorMessage(msg) {
  if (!msg || typeof msg !== 'string') return 'An error occurred. Please try again.'
  const lower = msg.toLowerCase()
  if (
    lower.includes('prisma') ||
    lower.includes('mysql') ||
    lower.includes('tidb') ||
    lower.includes('database') ||
    lower.includes('table') ||
    lower.includes('column') ||
    lower.includes('connection') ||
    lower.includes('econnrefused') ||
    lower.includes('select ') ||
    lower.includes('insert ') ||
    lower.includes('update ') ||
    lower.includes('delete from') ||
    lower.includes('sql')
  ) {
    return 'Service temporarily unavailable. Please try again later.'
  }
  return msg
}

export function notFoundHandler(request, response) {
  response.status(404).json({ message: 'Resource not found' })
}

export function errorHandler(error, request, response, next) {
  const errorId = request.id || 'unknown'
  console.error(JSON.stringify({ errorId, method: request.method, path: request.originalUrl, error: error.message, stack: error.stack }))
  if (response.headersSent) return next(error)
  return response.status(500).json({ message: 'An unexpected error occurred. Please try again later.', errorId })
}
