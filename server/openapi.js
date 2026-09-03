export function getOpenApiDocument() {
  return {
    openapi: '3.0.3',
    info: { title: 'Cyber Security Club MRDU API', version: '1.0.0', description: 'Production API. Browser clients use an HTTP-only session cookie and X-CSRF-Token on every state-changing request.' },
    servers: [{ url: '/api/v1' }],
    components: {
      securitySchemes: { sessionAuth: { type: 'apiKey', in: 'cookie', name: 'csc.sid' }, csrfToken: { type: 'apiKey', in: 'header', name: 'X-CSRF-Token' } },
      schemas: { Error: { type: 'object', properties: { message: { type: 'string' }, errorId: { type: 'string' } } } },
    },
    paths: {
      '/health': { get: { summary: 'Service health status', responses: { 200: { description: 'Healthy' }, 503: { description: 'Service unavailable' } } } },
      '/auth/csrf': { get: { summary: 'Issue a CSRF token', responses: { 200: { description: 'CSRF token' } } } },
      '/auth/login': { post: { summary: 'Password login', responses: { 200: { description: 'Authenticated or MFA required' }, 401: { description: 'Invalid credentials' }, 429: { description: 'Rate limited' } } } },
      '/auth/verify-2fa': { post: { summary: 'Complete MFA login', responses: { 200: { description: 'Authenticated' }, 401: { description: 'Invalid code' } } } },
      '/auth/forgot-password': { post: { summary: 'Request a password-reset email', responses: { 202: { description: 'Request accepted' } } } },
      '/auth/reset-password': { post: { summary: 'Set a password with a valid one-time reset token', responses: { 204: { description: 'Password updated' } } } },
      '/auth/me': { get: { summary: 'Current session user', security: [{ sessionAuth: [] }], responses: { 200: { description: 'Current user' }, 401: { description: 'No active session' } } } },
      '/admin/members': { get: { summary: 'List members', security: [{ sessionAuth: [] }], responses: { 200: { description: 'Members' }, 403: { description: 'President only' } } }, post: { summary: 'Create a regular member', security: [{ sessionAuth: [], csrfToken: [] }], responses: { 201: { description: 'Member created' } } } },
      '/member/dashboard': { get: { summary: 'Member dashboard authorization boundary', security: [{ sessionAuth: [] }], responses: { 200: { description: 'Allowed' }, 403: { description: 'Permission denied' } } } },
    },
  }
}
