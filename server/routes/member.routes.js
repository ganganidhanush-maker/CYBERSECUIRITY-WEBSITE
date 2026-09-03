import { Router } from 'express'
import {
  completeIntroVideo,
  completeWaitingQueue,
  createComplaint,
  createSupportTicket,
  getEventDetails,
  getGalleryAlbum,
  getPublicClubSettings,
  getSessionStatus,
  listClubTeam,
  listGallery,
  listMyRegistrations,
  listNotifications,
  listPublicReels,
  likeReel,
  recordReelView,
  listPublishedEvents,
  listStudentSupportTickets,
  markAllNotificationsRead,
  markNotificationRead,
  registerForEvent,
  replyStudentSupportTicket,
  updateProfile,
  lookupMemberForTeam,
  createEventTeam,
  respondTeamInvite,
  removeTeamMember,
  listMyTeamInvites,
  submitEventCompletion,
  searchStudentsForTeam,
  resubmitPayment,
  submitProject,
  saveRegistrationDraft,
} from '../controllers/member.controller.js'
import {
  scanQrCode,
  grantEventEntry,
} from '../controllers/admin.controller.js'
import {
  getStudentSubscriptionStatus,
  submitStudentSubscription,
} from '../controllers/subscription.controller.js'
import { requireAuth, requirePermission } from '../middleware/auth.js'
import { authenticatedRateLimiter } from '../middleware/rate-limit.js'
import { requireActiveSubscription } from '../middleware/subscription.js'
import { requireActiveSite } from '../middleware/hibernation.js'
import { toSafeUser } from '../utils/safe-user.js'

export const memberRouter = Router()
memberRouter.use(requireAuth, requireActiveSite, authenticatedRateLimiter)

memberRouter.get('/dashboard', requirePermission('DASHBOARD_VIEW'), (request, response) => {
  response.status(200).json({ user: toSafeUser(request.user) })
})

// Session & Experience status (intro video, queue)
memberRouter.get('/session-status', getSessionStatus)
memberRouter.post('/intro-video/complete', completeIntroVideo)
memberRouter.post('/waiting-queue/complete', completeWaitingQueue)

// Public & Member Club Settings
memberRouter.get('/settings', getPublicClubSettings)

// Student Subscription
memberRouter.get('/subscription/status', getStudentSubscriptionStatus)
memberRouter.post('/subscription/submit', submitStudentSubscription)

// Events & Registration (Registration requires active subscription when enabled)
memberRouter.get('/events', requirePermission('EVENTS_VIEW'), listPublishedEvents)
memberRouter.get('/events/:eventId', requirePermission('EVENTS_VIEW'), getEventDetails)
memberRouter.post('/events/:eventId/draft', requirePermission('EVENT_REGISTER'), saveRegistrationDraft)
memberRouter.post('/events/:eventId/register', requirePermission('EVENT_REGISTER'), requireActiveSubscription, registerForEvent)
memberRouter.post('/events/:eventId/submit-completion', requirePermission('EVENT_REGISTER'), submitEventCompletion)
memberRouter.post('/events/:eventId/submit-project', requirePermission('EVENT_REGISTER'), submitProject)
memberRouter.post('/registrations/:registrationId/resubmit-payment', requirePermission('EVENT_REGISTER'), resubmitPayment)
memberRouter.get('/registrations', requirePermission('REGISTRATIONS_VIEW'), listMyRegistrations)

// Team Participation & Formation
memberRouter.get('/members/search', searchStudentsForTeam)
memberRouter.get('/members/lookup/:memberId', lookupMemberForTeam)
memberRouter.post('/events/:eventId/teams', requirePermission('EVENT_REGISTER'), createEventTeam)
memberRouter.post('/teams/invites/:inviteId/respond', respondTeamInvite)
memberRouter.delete('/teams/:teamId/members/:memberId', removeTeamMember)
memberRouter.get('/teams/my-invites', listMyTeamInvites)

// Member Profile (Universal for all authenticated roles)
memberRouter.put('/profile', updateProfile)
memberRouter.post('/complaints', requirePermission('FEEDBACK_CREATE'), requireActiveSubscription, createComplaint)

// Student Helpdesk & Doubts
memberRouter.get('/support', listStudentSupportTickets)
memberRouter.post('/support', createSupportTicket)
memberRouter.post('/support/:id/reply', replyStudentSupportTicket)

// In-App Notifications
memberRouter.get('/notifications', listNotifications)
memberRouter.post('/notifications/:id/read', markNotificationRead)
memberRouter.post('/notifications/read-all', markAllNotificationsRead)

// Gallery & Team Showcases
memberRouter.get('/gallery', requirePermission('GALLERY_VIEW'), listGallery)
memberRouter.get('/gallery/:albumId', requirePermission('GALLERY_VIEW'), getGalleryAlbum)
memberRouter.get('/team', listClubTeam)

// Campus & Event Reels Stream
memberRouter.get('/reels', listPublicReels)
memberRouter.post('/reels/:id/like', likeReel)
memberRouter.post('/reels/:id/view', recordReelView)

// QR Event Pass Scanner & Gate Entry
memberRouter.get('/qr/scan', scanQrCode)
memberRouter.post('/qr/scan', scanQrCode)
memberRouter.post('/qr/grant-entry', grantEventEntry)

