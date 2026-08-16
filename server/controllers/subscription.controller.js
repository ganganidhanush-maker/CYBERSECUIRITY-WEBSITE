import { z } from 'zod'
import { prisma } from '../db/prisma.js'
import { calculateMonthEndExpiry, isSubscriptionActive } from '../utils/expiry.js'
import { tryWriteAuditLog } from '../services/audit.service.js'

function auditRequest(request) {
  return { ipAddress: request.ip, userAgent: request.get('user-agent') || null }
}

const submitSubscriptionSchema = z.object({
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  transactionRef: z.string().trim().min(3, 'Transaction reference is required').max(120),
  paymentMethod: z.string().trim().max(60).optional(),
  receiptImage: z.string().optional(),
  paymentDate: z.string().optional(),
})

export async function getStudentSubscriptionStatus(request, response) {
  const user = request.user
  const isExempt = user.role !== 'STUDENT' || Boolean(user.isPrimaryAdmin)

  const settings = await prisma.clubSetting.findMany({
    where: {
      key: {
        in: [
          'subscriptionEnabled',
          'subscriptionMonthlyAmount',
          'subscriptionUpiId',
          'subscriptionQrUrl',
        ],
      },
    },
  })

  const settingsMap = {}
  for (const s of settings) {
    try { settingsMap[s.key] = JSON.parse(s.value) } catch { settingsMap[s.key] = s.value }
  }

  const subscriptionEnabled = settingsMap.subscriptionEnabled === true || settingsMap.subscriptionEnabled === 'true'
  const monthlyAmount = Number(settingsMap.subscriptionMonthlyAmount || 100)
  const upiId = settingsMap.subscriptionUpiId || ''
  const qrUrl = settingsMap.subscriptionQrUrl || ''

  if (isExempt) {
    return response.status(200).json({
      isExempt: true,
      subscriptionEnabled,
      monthlyAmount,
      upiId,
      qrUrl,
      hasActiveSubscription: true,
      activeSubscription: null,
      history: [],
    })
  }

  const subscriptions = await prisma.subscription.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  })

  const activeSubscription = subscriptions.find(s => isSubscriptionActive(s)) || null
  const pendingSubscription = subscriptions.find(s => s.status === 'PENDING') || null

  return response.status(200).json({
    isExempt: false,
    subscriptionEnabled,
    monthlyAmount,
    upiId,
    qrUrl,
    hasActiveSubscription: !subscriptionEnabled || Boolean(activeSubscription),
    activeSubscription,
    pendingSubscription,
    history: subscriptions,
  })
}

export async function submitStudentSubscription(request, response) {
  const user = request.user
  if (user.role !== 'STUDENT') {
    return response.status(400).json({ message: 'Only student members submit membership subscriptions.' })
  }

  const parsed = submitSubscriptionSchema.safeParse(request.body)
  if (!parsed.success) {
    return response.status(400).json({ message: parsed.error.issues[0]?.message || 'Please provide valid payment details.' })
  }

  const { amount, transactionRef, paymentMethod, receiptImage, paymentDate } = parsed.data

  const date = paymentDate ? new Date(paymentDate) : new Date()

  const subscription = await prisma.subscription.create({
    data: {
      userId: user.id,
      amount,
      transactionRef,
      paymentMethod: paymentMethod || 'UPI',
      receiptImage: receiptImage || null,
      paymentDate: Number.isNaN(date.getTime()) ? new Date() : date,
      status: 'PENDING',
    },
  })

  await tryWriteAuditLog({
    actorUserId: user.id,
    action: 'SUBSCRIPTION_SUBMITTED',
    metadata: {
      subscriptionId: subscription.id,
      amount: String(amount),
      transactionRef,
    },
    ...auditRequest(request),
  })

  return response.status(201).json({
    message: 'Subscription payment submitted successfully. An administrator will review and verify your membership.',
    subscription,
  })
}

export async function listAdminSubscriptions(request, response) {
  const subscriptions = await prisma.subscription.findMany({
    include: {
      user: {
        include: { profile: true },
      },
    },
    orderBy: { submittedAt: 'desc' },
  })

  const totalStudents = await prisma.user.count({
    where: { role: 'STUDENT', accountStatus: 'ACTIVE' },
  })

  const now = new Date()
  let activeCount = 0
  let pendingCount = 0
  let expiredCount = 0
  let rejectedCount = 0

  const mapped = subscriptions.map(sub => {
    const isCurrentlyActive = isSubscriptionActive(sub, now)
    const isExpired = sub.status === 'ACTIVE' && !isCurrentlyActive

    if (sub.status === 'PENDING') pendingCount++
    else if (isCurrentlyActive) activeCount++
    else if (isExpired || sub.status === 'EXPIRED') expiredCount++
    else if (sub.status === 'REJECTED') rejectedCount++

    return {
      id: sub.id,
      userId: sub.userId,
      memberId: sub.user?.memberId || 'UNKNOWN',
      name: sub.user?.profile?.name || sub.user?.memberId || 'Student',
      email: sub.user?.profile?.email || null,
      phone: sub.user?.profile?.phone || null,
      amount: Number(sub.amount),
      paymentDate: sub.paymentDate,
      transactionRef: sub.transactionRef,
      paymentMethod: sub.paymentMethod,
      receiptImage: sub.receiptImage,
      status: isExpired ? 'EXPIRED' : sub.status,
      submittedAt: sub.submittedAt,
      verifiedBy: sub.verifiedBy,
      verifiedAt: sub.verifiedAt,
      rejectionReason: sub.rejectionReason,
      expiresAt: sub.expiresAt,
    }
  })

  return response.status(200).json({
    subscriptions: mapped,
    stats: {
      totalStudents,
      activeSubscriptions: activeCount,
      pendingVerification: pendingCount,
      expiredSubscriptions: expiredCount,
      rejectedPayments: rejectedCount,
    },
  })
}

export async function verifyAdminSubscription(request, response) {
  const { id } = request.params
  const subscription = await prisma.subscription.findUnique({
    where: { id },
    include: { user: { include: { profile: true } } },
  })

  if (!subscription) {
    return response.status(404).json({ message: 'Subscription record not found.' })
  }

  // Calculate expiry to last day of current month (per requirement 12)
  const expiresAt = calculateMonthEndExpiry(new Date())
  const verifiedBy = request.user.memberId || request.user.id

  const updated = await prisma.subscription.update({
    where: { id },
    data: {
      status: 'ACTIVE',
      verifiedBy,
      verifiedAt: new Date(),
      expiresAt,
      rejectionReason: null,
    },
    include: { user: { include: { profile: true } } },
  })

  await tryWriteAuditLog({
    actorUserId: request.user.id,
    action: 'SUBSCRIPTION_VERIFIED',
    targetUserId: subscription.userId,
    metadata: {
      subscriptionId: id,
      memberId: subscription.user?.memberId,
      expiresAt: expiresAt.toISOString(),
    },
    ...auditRequest(request),
  })

  return response.status(200).json({
    message: 'Subscription successfully verified and activated.',
    subscription: {
      ...updated,
      amount: Number(updated.amount),
    },
  })
}

export async function rejectAdminSubscription(request, response) {
  const { id } = request.params
  const rejectionReason = request.body.rejectionReason?.trim() || 'Payment receipt or reference could not be verified.'

  const subscription = await prisma.subscription.findUnique({
    where: { id },
    include: { user: true },
  })

  if (!subscription) {
    return response.status(404).json({ message: 'Subscription record not found.' })
  }

  const verifiedBy = request.user.memberId || request.user.id

  const updated = await prisma.subscription.update({
    where: { id },
    data: {
      status: 'REJECTED',
      rejectionReason,
      verifiedBy,
      verifiedAt: new Date(),
      expiresAt: null,
    },
  })

  await tryWriteAuditLog({
    actorUserId: request.user.id,
    action: 'SUBSCRIPTION_REJECTED',
    targetUserId: subscription.userId,
    metadata: {
      subscriptionId: id,
      memberId: subscription.user?.memberId,
      rejectionReason,
    },
    ...auditRequest(request),
  })

  return response.status(200).json({
    message: 'Subscription payment rejected.',
    subscription: updated,
  })
}
