import { Router } from 'express'
import {
  addGalleryPhoto,
  adminResetPassword,
  changeAccountStatus,
  changeMemberPermissions,
  createClubTeamMember,
  createEvent,
  createGalleryAlbum,
  createMember,
  deleteClubTeamMember,
  deleteEvent,
  deleteGalleryAlbum,
  deleteGalleryPhoto,
  deleteMember,
  editMember,
  exportEventRegistrationsCsv,
  getClubSettings,
  getEventDetailsWithStats,
  listAuditLogs,
  listClubTeam,
  listComplaints,
  listEventRegistrations,
  listEvents,
  listGalleryAlbums,
  listMembers,
  listPayments,
  transferPresidentRole,
  updateClubSettings,
  updateClubTeamMember,
  updateComplaintStatus,
  updateEvent,
  verifyPayment,
} from '../controllers/admin.controller.js'
import {
  requireAdmin,
  requireAuth,
  requirePermission,
  requirePresident,
  requirePrimaryPresident,
} from '../middleware/auth.js'
import { adminWriteRateLimiter, authenticatedRateLimiter } from '../middleware/rate-limit.js'
import { validateUserIdParam } from '../middleware/validate.js'
import { asyncHandler } from '../utils/async-handler.js'

export const adminRouter = Router()
adminRouter.use(requireAuth, requireAdmin)
adminRouter.use(authenticatedRateLimiter)

// Member & Account Management
adminRouter.get('/members', requirePermission('ACCOUNT_MANAGEMENT'), asyncHandler(listMembers))
adminRouter.post('/members', requirePermission('ACCOUNT_MANAGEMENT'), adminWriteRateLimiter, asyncHandler(createMember))
adminRouter.put('/members/:id', requirePermission('ACCOUNT_MANAGEMENT'), adminWriteRateLimiter, validateUserIdParam, asyncHandler(editMember))
adminRouter.delete('/members/:id', requirePermission('ACCOUNT_MANAGEMENT'), adminWriteRateLimiter, validateUserIdParam, asyncHandler(deleteMember))
adminRouter.put('/members/:id/status', requirePermission('ACCOUNT_MANAGEMENT'), adminWriteRateLimiter, validateUserIdParam, asyncHandler(changeAccountStatus))
adminRouter.put('/members/:id/permissions', requirePresident, adminWriteRateLimiter, validateUserIdParam, asyncHandler(changeMemberPermissions))
adminRouter.post('/members/:id/reset-password', requirePermission('ACCOUNT_MANAGEMENT'), adminWriteRateLimiter, validateUserIdParam, asyncHandler(adminResetPassword))
adminRouter.post('/members/transfer-president', requirePrimaryPresident, adminWriteRateLimiter, asyncHandler(transferPresidentRole))

// Event Management & Studio
adminRouter.get('/events', requirePermission('EVENTS_VIEW'), asyncHandler(listEvents))
adminRouter.post('/events', requirePermission('EVENT_MANAGE'), adminWriteRateLimiter, asyncHandler(createEvent))
adminRouter.put('/events/:eventId', requirePermission('EVENT_MANAGE'), adminWriteRateLimiter, asyncHandler(updateEvent))
adminRouter.delete('/events/:eventId', requirePermission('EVENT_MANAGE'), adminWriteRateLimiter, asyncHandler(deleteEvent))
adminRouter.get('/events/:eventId/details', requirePermission('EVENT_MANAGE'), asyncHandler(getEventDetailsWithStats))
adminRouter.get('/events/:eventId/export-csv', requirePermission('EVENT_MANAGE'), asyncHandler(exportEventRegistrationsCsv))
adminRouter.get('/events/:eventId/registrations', requirePermission('REGISTRATIONS_VIEW'), asyncHandler(listEventRegistrations))

// Payment Management
adminRouter.get('/payments', requirePermission('PAYMENTS_VIEW'), asyncHandler(listPayments))
adminRouter.put('/payments/:registrationId/verify', requirePermission('PAYMENTS_VERIFY'), adminWriteRateLimiter, asyncHandler(verifyPayment))

// Gallery Studio
adminRouter.get('/gallery/albums', requirePermission('GALLERY_VIEW'), asyncHandler(listGalleryAlbums))
adminRouter.post('/gallery/albums', requirePermission('GALLERY_MANAGE'), adminWriteRateLimiter, asyncHandler(createGalleryAlbum))
adminRouter.post('/gallery/albums/:albumId/photos', requirePermission('GALLERY_MANAGE'), adminWriteRateLimiter, asyncHandler(addGalleryPhoto))
adminRouter.delete('/gallery/albums/:albumId/photos/:photoId', requirePermission('GALLERY_MANAGE'), adminWriteRateLimiter, asyncHandler(deleteGalleryPhoto))
adminRouter.delete('/gallery/albums/:albumId', requirePermission('GALLERY_MANAGE'), adminWriteRateLimiter, asyncHandler(deleteGalleryAlbum))

// Club Team & Leadership Management
adminRouter.get('/team', requirePermission('TEAM_MANAGE'), asyncHandler(listClubTeam))
adminRouter.post('/team', requirePermission('TEAM_MANAGE'), adminWriteRateLimiter, asyncHandler(createClubTeamMember))
adminRouter.put('/team/:memberId', requirePermission('TEAM_MANAGE'), adminWriteRateLimiter, asyncHandler(updateClubTeamMember))
adminRouter.delete('/team/:memberId', requirePermission('TEAM_MANAGE'), adminWriteRateLimiter, asyncHandler(deleteClubTeamMember))

// Club Settings & Social Links
adminRouter.get('/settings', requirePermission('SETTINGS_MANAGE'), asyncHandler(getClubSettings))
adminRouter.put('/settings', requirePermission('SETTINGS_MANAGE'), adminWriteRateLimiter, asyncHandler(updateClubSettings))

// Complaints / Feedback
adminRouter.get('/complaints', asyncHandler(listComplaints))
adminRouter.put('/complaints/:complaintId/status', adminWriteRateLimiter, asyncHandler(updateComplaintStatus))

// Security Audit Logs
adminRouter.get('/audit-logs', requirePermission('AUDIT_VIEW'), asyncHandler(listAuditLogs))
