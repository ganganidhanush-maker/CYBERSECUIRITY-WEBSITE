import { prisma } from '../db/prisma.js'
import { isSubscriptionActive } from '../utils/expiry.js'

/**
 * Middleware ensuring students have an active verified subscription when the subscription system is enabled.
 * Leadership and admin roles are automatically exempt.
 */
export async function requireActiveSubscription(request, response, next) {
  const user = request.user
  if (!user) return response.status(401).json({ message: 'Authentication required.' })

  // Leadership and Admin roles are always exempt from student subscriptions
  if (user.role !== 'STUDENT' || user.isPrimaryAdmin) {
    return next()
  }

  try {
    // Check if subscription system is globally enabled
    const setting = await prisma.clubSetting.findUnique({
      where: { key: 'subscriptionEnabled' },
    })

    const isEnabled = setting?.value === 'true' || setting?.value === true || (setting?.value && JSON.parse(setting.value) === true)
    if (!isEnabled) {
      return next()
    }

    // Free events are open to all students and guest students without subscription requirement
    if (request.params.eventId) {
      const event = await prisma.event.findUnique({
        where: { id: request.params.eventId },
        select: { requiresPayment: true, paymentAmount: true },
      })
      if (event && !event.requiresPayment) {
        return next()
      }
    }

    // Check if student has an active subscription that has not expired
    const activeSubscription = await prisma.subscription.findFirst({
      where: {
        userId: user.id,
        status: 'ACTIVE',
        expiresAt: { gte: new Date() },
      },
      orderBy: { expiresAt: 'desc' },
    })

    if (activeSubscription && isSubscriptionActive(activeSubscription)) {
      request.activeSubscription = activeSubscription
      return next()
    }

    return response.status(403).json({
      message: 'Your membership is inactive. Subscribe to unlock event registrations, technical support, and member-only features.',
      code: 'SUBSCRIPTION_REQUIRED',
    })
  } catch (error) {
    return next(error)
  }
}
