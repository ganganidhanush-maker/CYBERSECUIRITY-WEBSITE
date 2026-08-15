import { Router } from 'express'
import {
  completeIntroVideo,
  completeWaitingQueue,
  createComplaint,
  getEventDetails,
  getPublicClubSettings,
  getSessionStatus,
  listClubTeam,
  listGallery,
  listMyRegistrations,
  listPublishedEvents,
  registerForEvent,
  updateProfile,
} from '../controllers/member.controller.js'
import { requireAuth, requirePermission } from '../middleware/auth.js'
import { authenticatedRateLimiter } from '../middleware/rate-limit.js'
import { toSafeUser } from '../utils/safe-user.js'

export const memberRouter = Router()
memberRouter.use(requireAuth, authenticatedRateLimiter)

memberRouter.get('/dashboard', requirePermission('DASHBOARD_VIEW'), (request, response) => {
  response.status(200).json({ user: toSafeUser(request.user) })
})

// Session & Experience status (intro video, queue)
memberRouter.get('/session-status', getSessionStatus)
memberRouter.post('/intro-video/complete', completeIntroVideo)
memberRouter.post('/waiting-queue/complete', completeWaitingQueue)

// Public & Member Club Settings
memberRouter.get('/settings', getPublicClubSettings)

// Events & Registration
memberRouter.get('/events', requirePermission('EVENTS_VIEW'), listPublishedEvents)
memberRouter.get('/events/:eventId', requirePermission('EVENTS_VIEW'), getEventDetails)
memberRouter.post('/events/:eventId/register', requirePermission('EVENT_REGISTER'), registerForEvent)
memberRouter.get('/registrations', requirePermission('REGISTRATIONS_VIEW'), listMyRegistrations)

// Member Profile & Feedback
memberRouter.put('/profile', requirePermission('PROFILE_EDIT'), updateProfile)
memberRouter.post('/complaints', requirePermission('FEEDBACK_CREATE'), createComplaint)

// Gallery & Team Showcases
memberRouter.get('/gallery', requirePermission('GALLERY_VIEW'), listGallery)
memberRouter.get('/team', listClubTeam)
