/**
 * Calculates the exact expiry timestamp for a membership verified in a given month.
 * Per specification: Expiry is the final millisecond of the last calendar day of the month in which
 * the payment is verified (e.g. Aug 1 or Aug 28 -> Aug 31 23:59:59.999; Feb non-leap -> Feb 28; Feb leap year -> Feb 29).
 * Uses native JavaScript calendar math (`new Date(year, month + 1, 0, 23, 59, 59, 999)`).
 *
 * @param {Date|string|number} [referenceDate=new Date()] The date of verification
 * @returns {Date} Expiry Date object
 */
export function calculateMonthEndExpiry(referenceDate = new Date()) {
  const date = new Date(referenceDate)
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid reference date provided for expiry calculation')
  }

  const year = date.getFullYear()
  const month = date.getMonth() // 0-indexed: 0 = Jan, 1 = Feb, ..., 11 = Dec

  // Day 0 of the next month (month + 1) is the last day of the current month
  // This automatically computes 28/29 for February, 30 for Apr/Jun/Sep/Nov, 31 for Jan/Mar/May/Jul/Aug/Oct/Dec
  return new Date(year, month + 1, 0, 23, 59, 59, 999)
}

/**
 * Checks if a given subscription is currently active.
 * @param {object} subscription Subscription record with status and expiresAt
 * @param {Date} [now=new Date()] Current reference date
 * @returns {boolean}
 */
export function isSubscriptionActive(subscription, now = new Date()) {
  if (!subscription) return false
  if (subscription.status !== 'ACTIVE') return false
  if (!subscription.expiresAt) return false
  return new Date(subscription.expiresAt).getTime() >= new Date(now).getTime()
}
