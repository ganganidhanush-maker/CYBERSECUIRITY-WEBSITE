import crypto from 'node:crypto'

const LOCK_TIMEOUT_SECONDS = 10

export function paymentReferenceLockName(reference) {
  const normalizedReference = String(reference || '').trim().toUpperCase()
  if (!normalizedReference) return null
  // MySQL/MariaDB lock names are limited to 64 characters.
  const digest = crypto.createHash('sha256').update(normalizedReference).digest('hex')
  return `utr:${digest.slice(0, 60)}`
}

export async function acquirePaymentReferenceLock(transaction, reference) {
  const lockName = paymentReferenceLockName(reference)
  if (!lockName) return null

  const rows = await transaction.$queryRaw`SELECT GET_LOCK(${lockName}, ${LOCK_TIMEOUT_SECONDS}) AS acquired`
  if (Number(rows?.[0]?.acquired) !== 1) return null
  return lockName
}

export async function findActivePaymentReferenceDuplicate(transaction, reference, exceptRegistrationId = null) {
  const normalizedReference = String(reference || '').trim().toUpperCase()
  if (!normalizedReference) return null

  const rows = exceptRegistrationId
    ? await transaction.$queryRaw`
      SELECT id
      FROM event_registrations
      WHERE UPPER(TRIM(payment_reference)) = ${normalizedReference}
        AND payment_status IN ('PENDING', 'UNDER_VERIFICATION', 'VERIFIED', 'SUBMITTED')
        AND id <> ${exceptRegistrationId}
      LIMIT 1
      FOR UPDATE
    `
    : await transaction.$queryRaw`
      SELECT id
      FROM event_registrations
      WHERE UPPER(TRIM(payment_reference)) = ${normalizedReference}
        AND payment_status IN ('PENDING', 'UNDER_VERIFICATION', 'VERIFIED', 'SUBMITTED')
      LIMIT 1
      FOR UPDATE
    `
  return rows?.[0] || null
}

export async function releasePaymentReferenceLock(transaction, lockName) {
  if (!lockName) return
  const rows = await transaction.$queryRaw`SELECT RELEASE_LOCK(${lockName}) AS released`
  if (Number(rows?.[0]?.released) !== 1) {
    throw new Error('Unable to release the payment reference transaction lock.')
  }
}
