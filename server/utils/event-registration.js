export function resolveEventRegistrationMode(event, requestedType = 'INDIVIDUAL') {
  const configuredType = String(event?.registrationType || '').trim().toUpperCase()
  const isBothMode = configuredType === 'BOTH'
  const legacyTeamMode = !isBothMode && Boolean(event?.isTeamEvent)
  const supportsTeams = isBothMode || configuredType === 'TEAM' || legacyTeamMode
  const isTeam = isBothMode
    ? String(requestedType || 'INDIVIDUAL').trim().toUpperCase() === 'TEAM'
    : configuredType === 'TEAM' || legacyTeamMode

  return { supportsTeams, isTeam }
}

const ACTIVE_REGISTRATION_STATUSES = new Set([
  'REGISTERED',
  'CONFIRMED',
  'COMPLETED',
  'PROJECT_SUBMITTED',
])

const UNCONFIRMED_PAYMENT_STATUSES = new Set(['PENDING', 'SUBMITTED', 'UNDER_VERIFICATION'])
const UNREGISTERED_PAYMENT_REGISTRATION_STATUSES = new Set(['PAYMENT_PENDING', 'PENDING_PAYMENT', 'PENDING', 'UNDER_VERIFICATION'])

export function isDraftRegistration(registration) {
  const status = String(registration?.status || '').trim().toUpperCase()
  if (status === 'DRAFT') return true

  // Older versions persisted a paid registration even when no UTR had been
  // entered. Treat those orphaned claims like drafts until the student submits
  // a reference; they must not inflate analytics or appear as passes.
  const amount = Number(registration?.totalAmount)
  const paymentReference = String(registration?.paymentReference || '').trim()
  const paymentStatus = String(registration?.paymentStatus || '').trim().toUpperCase()
  return Number.isFinite(amount)
    && amount > 0
    && !paymentReference
    && UNREGISTERED_PAYMENT_REGISTRATION_STATUSES.has(status)
    && UNCONFIRMED_PAYMENT_STATUSES.has(paymentStatus)
}

export function submittedRegistrationWhere(where = {}) {
  const conditions = []
  if (Object.keys(where).length > 0) conditions.push(where)
  conditions.push(
    { status: { not: 'DRAFT' } },
    {
      NOT: {
        AND: [
          { totalAmount: { gt: 0 } },
          { OR: [{ paymentReference: null }, { paymentReference: '' }] },
          { status: { in: [...UNREGISTERED_PAYMENT_REGISTRATION_STATUSES] } },
          { paymentStatus: { in: [...UNCONFIRMED_PAYMENT_STATUSES] } },
        ],
      },
    },
  )
  return { AND: conditions }
}

export function hasActiveEventPass(registration) {
  if (!registration) return false
  const status = String(registration.status || '').trim().toUpperCase()
  const paymentStatus = String(registration.paymentStatus || '').trim().toUpperCase()
  const amount = registration.totalAmount === null || registration.totalAmount === undefined
    ? 0
    : Number(registration.totalAmount)
  const isFreeRegistration = paymentStatus === 'FREE' && Number.isFinite(amount) && amount <= 0
  return ACTIVE_REGISTRATION_STATUSES.has(status) && (paymentStatus === 'VERIFIED' || isFreeRegistration)
}

export function isPaymentAwaitingReview(registration) {
  const amount = Number(registration?.totalAmount)
  const paymentStatus = String(registration?.paymentStatus || '').trim().toUpperCase()
  return !isDraftRegistration(registration)
    && Number.isFinite(amount)
    && amount > 0
    && Boolean(String(registration?.paymentReference || '').trim())
    && UNCONFIRMED_PAYMENT_STATUSES.has(paymentStatus)
}

export function isRejectedPayment(registration) {
  const amount = Number(registration?.totalAmount)
  const paymentStatus = String(registration?.paymentStatus || '').trim().toUpperCase()
  const status = String(registration?.status || '').trim().toUpperCase()
  return !isDraftRegistration(registration)
    && Number.isFinite(amount)
    && amount > 0
    && Boolean(String(registration?.paymentReference || '').trim())
    && (paymentStatus === 'REJECTED' || paymentStatus === 'PAYMENT_REJECTED' || status === 'PAYMENT_REJECTED')
}

function toValidPrice(value) {
  if (value === null || value === undefined || value === '') return null
  const price = Number(value)
  return Number.isFinite(price) && price >= 0 ? price : null
}

function getRequestedTierName(paymentOption) {
  if (typeof paymentOption === 'string') return paymentOption.trim()
  if (!paymentOption || typeof paymentOption !== 'object') return ''
  return String(paymentOption.name || paymentOption.tierName || paymentOption.tier || '').trim()
}

/**
 * Resolve fees exclusively from the event's saved configuration. Never trust an
 * amount supplied by the browser; the browser may only identify a tier/activity.
 */
export function resolveEventPricing(event, registrationData = {}) {
  const config = event.paymentConfig && typeof event.paymentConfig === 'object' && !Array.isArray(event.paymentConfig)
    ? event.paymentConfig
    : {}
  const configuredType = String(config.type || config.paymentType || '').toUpperCase()
  const tiers = Array.isArray(config.tiers) ? config.tiers : []
  const configuredPrice = toValidPrice(config.price ?? event.paymentAmount)
  const selectedActivityIds = Array.isArray(registrationData.selectedActivityIds)
    ? [...new Set(registrationData.selectedActivityIds.filter(Boolean))]
    : []
  const requestedIds = event.allowMultipleActivities ? selectedActivityIds : selectedActivityIds.slice(0, 1)
  const activityById = new Map((event.activities || []).map(activity => [activity.id, activity]))
  const selectedActivities = []

  for (const activityId of requestedIds) {
    const activity = activityById.get(activityId)
    if (!activity || activity.isAvailable === false) {
      throw new Error('One or more selected event activities are unavailable.')
    }
    const price = toValidPrice(activity.price)
    if (price === null) throw new Error('A selected event activity has an invalid price.')
    selectedActivities.push({ id: activity.id, name: activity.name, price })
  }

  const activityAmount = selectedActivities.reduce((sum, activity) => sum + activity.price, 0)
  const hasTierOptions = tiers.length > 0
  const isConfiguredAsPaid = Boolean(event.requiresPayment)
    || configuredType === 'FIXED'
    || configuredType === 'PAID'
    || configuredType === 'TIERS'
    || (configuredPrice !== null && configuredPrice > 0)
    || (hasTierOptions && tiers.some(t => Number(t.price) > 0))

  const usesTierPricing = configuredType === 'TIERS' || (!configuredType && isConfiguredAsPaid && hasTierOptions)
  let baseAmount = 0
  let paymentOption = null

  if (usesTierPricing) {
    const requestedName = getRequestedTierName(registrationData.paymentOption)
    const tier = tiers.find(option => String(option.name || '').trim() === requestedName)
      || (!requestedName && tiers.length === 1 ? tiers[0] : null)
    if (!tier) throw new Error('Select a valid payment tier for this event.')

    baseAmount = toValidPrice(tier.price)
    if (baseAmount === null) throw new Error('The selected payment tier has an invalid price.')
    paymentOption = { type: 'TIER', name: tier.name || requestedName, price: baseAmount }
  } else {
    const usesFixedPricing = Boolean(event.requiresPayment)
      || configuredType === 'FIXED'
      || configuredType === 'PAID'
      || (configuredPrice !== null && configuredPrice > 0)

    if (usesFixedPricing) {
      if (configuredPrice === null || configuredPrice <= 0) {
        throw new Error('This paid event does not have a valid registration fee configured.')
      }
      baseAmount = configuredPrice
      paymentOption = { type: 'FIXED', name: 'Standard Fixed Fee', price: baseAmount }
    }
  }

  const totalAmount = baseAmount + activityAmount
  if (isConfiguredAsPaid && totalAmount <= 0 && selectedActivities.length === 0) {
    throw new Error('This paid event requires a valid registration fee.')
  }
  if (selectedActivities.length > 0) {
    paymentOption = paymentOption
      ? { ...paymentOption, basePrice: baseAmount, activityAmount, amount: totalAmount, activities: selectedActivities }
      : { type: 'ACTIVITIES', activities: selectedActivities, amount: totalAmount }
  }

  return { totalAmount, paymentOption, selectedActivities }
}
