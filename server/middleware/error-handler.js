export function notFoundHandler(request, response) {
  response.status(404).json({ message: 'Resource not found' })
}

export function errorHandler(error, request, response, next) {
  const errorId = request.id || 'unknown'
  console.error(JSON.stringify({ errorId, method: request.method, path: request.originalUrl, error: error.message, stack: error.stack }))
  if (response.headersSent) return next(error)
  return response.status(500).json({ message: 'Something went wrong. Please try again.', errorId })
}
