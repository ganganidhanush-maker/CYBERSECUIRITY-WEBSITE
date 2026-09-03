import { Router } from 'express'
import {
  activateAllAccounts,
  addGalleryPhoto,
  adminResetPassword,
  bulkCreateMembers,
  changeAccountStatus,
  changeMemberPermissions,
  clearAuditLogs,
  createClubTeamMember,
  createEvent,
  createGalleryAlbum,
  createMember,
  deleteClubTeamMember,
  deleteCouncilMessage,
  deleteEvent,
  deleteGalleryAlbum,
  deleteGalleryPhoto,
  deleteMember,
  disableMemberTwoFactor,
  editMember,
  exportDatabaseSql,
  exportEventRegistrationsCsv,
  exportMembersCsv,
  getClubSettings,
  getEventDetailsWithStats,
  listAdminSupportTickets,
  listAuditLogs,
  listClubTeam,
  syncClubTeamFromAccounts,
  listComplaints,
  listCouncilMessages,
  listEventRegistrations,
  listEvents,
  listGalleryAlbums,
  listMembers,
  listPayments,
  listReelsAdmin,
  createReel,
  importProfileReels,
  updateReel,
  deleteReel,
  reorderClubTeam,
  replyAdminSupportTicket,
  scanQrCode,
  grantEventEntry,
  sendCouncilMessage,
  setPresidentMasterPin,
  transferPresidentRole,
  updateClubSettings,
  updateClubTeamMember,
  updateComplaintStatus,
  updateEvent,
  updateSupportTicketStatus,
  verifyPayment,
  listAllEventPasses,
  verifyRegistrationPaymentFast,
  getPresidentDirectives,
  updatePresidentDirectives,
  togglePresidentDirectiveTodo,
} from '../controllers/admin.controller.js'
import {
  listAdminSubscriptions,
  rejectAdminSubscription,
  verifyAdminSubscription,
} from '../controllers/subscription.controller.js'
import {
  requireAdmin,
  requireAuth,
  requirePermission,
  requirePresident,
  requirePrimaryPresident,
  requireReelsManager,
  requireRole,
} from '../middleware/auth.js'
import { adminWriteRateLimiter, authenticatedRateLimiter } from '../middleware/rate-limit.js'
import { validateUserIdParam } from '../middleware/validate.js'
import { asyncHandler } from '../utils/async-handler.js'

export const adminRouter = Router()

// Member directory & accounts
adminRouter.use(requireAuth)
adminRouter.use(requireAdmin)
adminRouter.use(authenticatedRateLimiter)

adminRouter.get('/members', requirePermission('ACCOUNT_MANAGEMENT'), asyncHandler(listMembers))
adminRouter.get('/members/export-csv', requirePermission('ACCOUNT_MANAGEMENT'), asyncHandler(exportMembersCsv))
adminRouter.post('/members', requirePermission('ACCOUNT_MANAGEMENT'), adminWriteRateLimiter, asyncHandler(createMember))
adminRouter.post('/members/bulk', requirePermission('ACCOUNT_MANAGEMENT'), adminWriteRateLimiter, asyncHandler(bulkCreateMembers))
adminRouter.put('/members/:id', requirePermission('ACCOUNT_MANAGEMENT'), adminWriteRateLimiter, validateUserIdParam, asyncHandler(editMember))
adminRouter.delete('/members/:id', requirePermission('ACCOUNT_MANAGEMENT'), adminWriteRateLimiter, validateUserIdParam, asyncHandler(deleteMember))
adminRouter.put('/members/:id/status', requirePermission('ACCOUNT_MANAGEMENT'), adminWriteRateLimiter, validateUserIdParam, asyncHandler(changeAccountStatus))
adminRouter.post('/members/activate-all', requireRole('PRESIDENT', 'STUDENT_COORDINATOR', 'ADMIN'), adminWriteRateLimiter, asyncHandler(activateAllAccounts))
adminRouter.put('/members/:id/permissions', requireRole('PRESIDENT', 'STUDENT_COORDINATOR', 'ADMIN'), adminWriteRateLimiter, validateUserIdParam, asyncHandler(changeMemberPermissions))
adminRouter.post('/members/:id/reset-password', requirePermission('ACCOUNT_MANAGEMENT'), adminWriteRateLimiter, validateUserIdParam, asyncHandler(adminResetPassword))
adminRouter.post('/members/:id/disable-2fa', requirePermission('ACCOUNT_MANAGEMENT'), adminWriteRateLimiter, validateUserIdParam, asyncHandler(disableMemberTwoFactor))
adminRouter.post('/members/transfer-president', requirePrimaryPresident, adminWriteRateLimiter, asyncHandler(transferPresidentRole))
adminRouter.post('/president/master-pin', requirePrimaryPresident, adminWriteRateLimiter, asyncHandler(setPresidentMasterPin))

// Primary President Command Instructions & Directives (To-Dos)
adminRouter.get('/president-directives', asyncHandler(getPresidentDirectives))
adminRouter.put('/president-directives', requirePresident, adminWriteRateLimiter, asyncHandler(updatePresidentDirectives))
adminRouter.patch('/president-directives/todos/:todoId/toggle', adminWriteRateLimiter, asyncHandler(togglePresidentDirectiveTodo))

// Event Management & Studio
adminRouter.get('/events', requirePermission('EVENTS_VIEW'), asyncHandler(listEvents))
adminRouter.post('/events', requirePermission('EVENT_MANAGE'), adminWriteRateLimiter, asyncHandler(createEvent))
adminRouter.put('/events/:eventId', requirePermission('EVENT_MANAGE'), adminWriteRateLimiter, asyncHandler(updateEvent))
adminRouter.delete('/events/:eventId', requirePermission('EVENT_MANAGE'), adminWriteRateLimiter, asyncHandler(deleteEvent))
adminRouter.get('/events/:eventId/details', requirePermission('EVENT_MANAGE'), asyncHandler(getEventDetailsWithStats))
adminRouter.get('/events/:eventId/export-csv', requirePermission('EVENT_MANAGE'), asyncHandler(exportEventRegistrationsCsv))
adminRouter.get('/events/:eventId/registrations', requirePermission('REGISTRATIONS_VIEW'), asyncHandler(listEventRegistrations))

// Event Passes & Attendance Roster
adminRouter.get('/passes', requirePermission('REGISTRATIONS_VIEW'), asyncHandler(listAllEventPasses))
adminRouter.post('/passes/:registrationId/verify-payment', requirePermission('PAYMENTS_VERIFY'), adminWriteRateLimiter, asyncHandler(verifyRegistrationPaymentFast))

// Payment & Subscription Management
adminRouter.get('/payments', requirePermission('PAYMENTS_VIEW'), asyncHandler(listPayments))
adminRouter.put('/payments/:registrationId/verify', requirePermission('PAYMENTS_VERIFY'), adminWriteRateLimiter, asyncHandler(verifyPayment))
adminRouter.get('/subscriptions', requirePermission('PAYMENTS_VIEW'), asyncHandler(listAdminSubscriptions))
adminRouter.put('/subscriptions/:id/verify', requirePermission('PAYMENTS_VERIFY'), adminWriteRateLimiter, asyncHandler(verifyAdminSubscription))
adminRouter.put('/subscriptions/:id/reject', requirePermission('PAYMENTS_VERIFY'), adminWriteRateLimiter, asyncHandler(rejectAdminSubscription))

// Gallery Studio
adminRouter.get('/gallery/albums', requirePermission('GALLERY_VIEW'), asyncHandler(listGalleryAlbums))
adminRouter.post('/gallery/albums', requirePermission('GALLERY_MANAGE'), adminWriteRateLimiter, asyncHandler(createGalleryAlbum))
adminRouter.post('/gallery/albums/:albumId/photos', requirePermission('GALLERY_MANAGE'), adminWriteRateLimiter, asyncHandler(addGalleryPhoto))
adminRouter.delete('/gallery/albums/:albumId/photos/:photoId', requirePermission('GALLERY_MANAGE'), adminWriteRateLimiter, asyncHandler(deleteGalleryPhoto))
adminRouter.delete('/gallery/albums/:albumId', requirePermission('GALLERY_MANAGE'), adminWriteRateLimiter, asyncHandler(deleteGalleryAlbum))

// Campus & Event Reels Studio (President, VP, PR Team, Event Management, Media Lead, Admin)
adminRouter.get('/reels', requireReelsManager, asyncHandler(listReelsAdmin))
adminRouter.post('/reels', requireReelsManager, adminWriteRateLimiter, asyncHandler(createReel))
adminRouter.post('/reels/import-profile', requireReelsManager, adminWriteRateLimiter, asyncHandler(importProfileReels))
adminRouter.put('/reels/:id', requireReelsManager, adminWriteRateLimiter, asyncHandler(updateReel))
adminRouter.delete('/reels/:id', requireReelsManager, adminWriteRateLimiter, asyncHandler(deleteReel))

// Club Team & Leadership Management
adminRouter.get('/team', requirePermission('TEAM_MANAGE'), asyncHandler(listClubTeam))
adminRouter.post('/team/sync-accounts', requirePermission('TEAM_MANAGE'), asyncHandler(syncClubTeamFromAccounts))
adminRouter.post('/team', requirePermission('TEAM_MANAGE'), adminWriteRateLimiter, asyncHandler(createClubTeamMember))
adminRouter.put('/team/reorder', requirePermission('TEAM_MANAGE'), adminWriteRateLimiter, asyncHandler(reorderClubTeam))
adminRouter.put('/team/:memberId', requirePermission('TEAM_MANAGE'), adminWriteRateLimiter, asyncHandler(updateClubTeamMember))
adminRouter.delete('/team/:memberId', requirePermission('TEAM_MANAGE'), adminWriteRateLimiter, asyncHandler(deleteClubTeamMember))

// Club Settings & Social Links
adminRouter.get('/settings', requirePermission('SETTINGS_MANAGE'), asyncHandler(getClubSettings))
adminRouter.put('/settings', requirePermission('SETTINGS_MANAGE'), adminWriteRateLimiter, asyncHandler(updateClubSettings))

// Support / Doubt Desk (Admin)
adminRouter.get('/support', asyncHandler(listAdminSupportTickets))
adminRouter.post('/support/:id/reply', adminWriteRateLimiter, asyncHandler(replyAdminSupportTicket))
adminRouter.put('/support/:id/status', adminWriteRateLimiter, asyncHandler(updateSupportTicketStatus))

// Executive Council Chat (Leads Only)
adminRouter.get('/chat/messages', asyncHandler(listCouncilMessages))
adminRouter.post('/chat/messages', adminWriteRateLimiter, asyncHandler(sendCouncilMessage))
adminRouter.delete('/chat/messages/:id', adminWriteRateLimiter, asyncHandler(deleteCouncilMessage))

// Complaints / Feedback
adminRouter.get('/complaints', asyncHandler(listComplaints))
adminRouter.put('/complaints/:complaintId/status', adminWriteRateLimiter, asyncHandler(updateComplaintStatus))

// Security Audit Logs
adminRouter.get('/audit-logs', requirePermission('AUDIT_VIEW'), asyncHandler(listAuditLogs))
adminRouter.post('/audit-logs/clear', requirePrimaryPresident, adminWriteRateLimiter, asyncHandler(clearAuditLogs))

// Full Database Backup (.sql) — Primary President Protected Action
adminRouter.post('/database/export-sql', requireAuth, requirePrimaryPresident, adminWriteRateLimiter, asyncHandler(exportDatabaseSql))

// QR Code Scanner & Event Entry Gate (Admins & Coordinators)
adminRouter.get('/qr/scan', asyncHandler(scanQrCode))
adminRouter.post('/qr/scan', asyncHandler(scanQrCode))
adminRouter.post('/qr/grant-entry', adminWriteRateLimiter, asyncHandler(grantEventEntry))
