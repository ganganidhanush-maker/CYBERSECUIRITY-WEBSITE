import { tryWriteAuditLog } from '../services/audit.service.js'
import { userIdParamSchema } from '../validators/auth.validator.js'

export function validateUserIdParam(request, response, next) {
  if (userIdParamSchema.safeParse(request.params).success) return next()
  tryWriteAuditLog({ actorUserId: request.user?.id, action: 'INVALID_RESOURCE_IDENTIFIER', metadata: { route: request.route?.path || request.path }, ipAddress: request.ip, userAgent: request.get('user-agent') || null })
  return response.status(404).json({ message: 'Resource not found' })
}
