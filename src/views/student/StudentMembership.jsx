import React, { useEffect, useState } from 'react'
import { Icon8, IconCrown } from '../../components/icons'
import { LivePortal } from '../../components/layout/LivePortal'
import { usePlatformTheme } from '../../context/PlatformThemeContext'
import { memberApi, readImageFile } from '../../lib/api'
import { getRoleLabel } from '../../lib/constants'

export function StudentMembership({ user, logout, onNavigate }) {
  const { platformMode } = usePlatformTheme()
  const isMrdu = platformMode === 'MRDU_EVENTS'
  const [subStatus, setSubStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [receiptPreview, setReceiptPreview] = useState('')
  const [copiedUpi, setCopiedUpi] = useState(false)

  function loadStatus() {
    setLoading(true)
    memberApi.getSubscriptionStatus()
      .then(res => setSubStatus(res))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadStatus()
  }, [])

  async function handleSubmitPayment(e) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const transactionRef = String(form.get('transactionRef') || '').trim()
    const amount = Number(form.get('amount') || subStatus?.monthlyAmount || 100)

    if (!transactionRef) {
      setError('Please enter your 12-digit UPI transaction / UTR reference number.')
      return
    }

    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      await memberApi.submitSubscription({
        amount,
        transactionRef,
        paymentMethod: 'UPI',
        receiptImage: receiptPreview || null,
        paymentDate: new Date().toISOString(),
      })
      setMessage(isMrdu ? 'Your UPI student pass payment was submitted successfully. Verification in progress.' : 'Your UPI subscription payment was submitted successfully. An administrator will verify your membership shortly.')
      setReceiptPreview('')
      loadStatus()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  function copyUpiId() {
    if (!subStatus?.upiId) return
    navigator.clipboard?.writeText?.(subStatus.upiId)
    setCopiedUpi(true)
    setTimeout(() => setCopiedUpi(false), 2000)
  }

  const isEnabled = subStatus?.subscriptionEnabled
  const activeSub = subStatus?.activeSubscription
  const pendingSub = subStatus?.pendingSubscription
  const isExempt = subStatus?.isExempt

  return (
    <LivePortal user={user} logout={logout} activeTab="student-membership" onNavigate={onNavigate} title={isMrdu ? 'STUDENT PASS SUBSCRIPTION' : 'MEMBERSHIP SUBSCRIPTION'}>
      <section className="member-management">
        <div className="member-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('student-dashboard')}>
              ← BACK TO DASHBOARD
            </button>
            <p className="eyebrow">{isMrdu ? 'MRDU ALL-ACCESS PASS' : 'COMMUNITY MEMBERSHIP'}</p>
            <h1>{isMrdu ? 'Student Event Pass Status' : 'Club Membership Status'}</h1>
            <p>{isMrdu ? 'Subscribe to unlock university event passes, technical symposium access, and workshop badges.' : 'Subscribe to unlock official event passes, hands-on lab access, and technical team support.'}</p>
          </div>
          <span className="president-lock">
            {isMrdu ? 'STUDENT ID' : 'MEMBER ID'}: {user.memberId}
          </span>
        </div>

        {message && <p className="member-form-success">{message}</p>}
        {error && <p className="member-form-error">{error}</p>}

        {loading ? (
          <p className="directory-state">Loading {isMrdu ? 'student pass' : 'membership'} information...</p>
        ) : isExempt ? (
          <div className="membership-status-box active-box">
            <h2 style={{ font: '700 22px Syne', color: '#70ddb4', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IconCrown size={20} /> Leadership Account Active
            </h2>
            <p style={{ color: '#9bb7cc', fontSize: '13px', margin: 0 }}>
              As an authorized leader ({getRoleLabel(user.role)}), you have full unlimited access to all features without a student subscription.
            </p>
          </div>
        ) : !isEnabled ? (
          <div className="membership-status-box active-box">
            <h2 style={{ font: '700 22px Syne', color: '#70ddb4', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon8 name="authentication" size={20} /> Open {isMrdu ? 'Event Pass' : 'Membership'} Access
            </h2>
            <p style={{ color: '#9bb7cc', fontSize: '13px', margin: 0 }}>
              {isMrdu
                ? 'Student event pass access is currently open & free. You have full access to all university events and activities!'
                : 'Student membership subscription is currently open & free. You have full access to all club events and activities!'}
            </p>
          </div>
        ) : (
          <>
            {/* Status Card */}
            {activeSub ? (
              <div className="membership-status-box active-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <span className="badge badge-active" style={{ marginBottom: '8px' }}>{isMrdu ? 'ACTIVE STUDENT PASS' : 'ACTIVE MEMBERSHIP'}</span>
                    <h2 style={{ font: '700 24px Syne', color: 'var(--text-main)', margin: '4px 0' }}>{isMrdu ? 'You have an Active Student Pass' : 'You are an Active Member'}</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0' }}>
                      Your {isMrdu ? 'event pass' : 'membership'} is active and valid until <b style={{ color: 'var(--brand-primary)' }}>{new Date(activeSub.expiresAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })} at 23:59</b>.
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <small style={{ color: 'var(--text-dim)', font: '500 9px "DM Mono", monospace' }}>SUBSCRIPTION FEE</small>
                    <div style={{ font: '700 22px Syne', color: '#059669' }}>₹{Number(activeSub.amount).toFixed(2)}</div>
                  </div>
                </div>

                <div className="membership-benefits-list">
                  <div className="benefit-item"><i>•</i> Official Event Pass Registrations</div>
                  <div className="benefit-item"><i>•</i> Technical Team Support & Queries</div>
                  <div className="benefit-item"><i>•</i> Full Club Gallery Access</div>
                  <div className="benefit-item"><i>•</i> Hands-on CTF Defense Labs</div>
                </div>
              </div>
            ) : pendingSub ? (
              <div className="membership-status-box" style={{ borderColor: '#f59e0b55', background: 'radial-gradient(circle at 100% 0, rgba(245, 158, 11, 0.08), transparent 60%), var(--bg-card)' }}>
                <span className="badge badge-pending" style={{ marginBottom: '8px' }}>VERIFICATION PENDING</span>
                <h2 style={{ font: '700 22px Syne', color: '#d97706', margin: '4px 0 8px' }}>Payment Verification in Progress</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '0 0 14px' }}>
                  Your UPI subscription payment of <b style={{ color: 'var(--text-main)' }}>₹{Number(pendingSub.amount).toFixed(2)}</b> (Ref: {pendingSub.transactionRef}) was submitted on {new Date(pendingSub.submittedAt).toLocaleDateString()}. An administrator will verify and activate your membership shortly.
                </p>
              </div>
            ) : (
              <div className="membership-status-box inactive-box">
                <span className="badge badge-disabled" style={{ marginBottom: '8px' }}>MEMBERSHIP INACTIVE</span>
                <h2 style={{ font: '700 24px Syne', color: 'var(--text-main)', margin: '4px 0 8px' }}>Your membership is inactive.</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '0 0 16px' }}>
                  Subscribe via UPI to unlock official event passes, technical support, and member-only club activities.
                </p>
                <div className="membership-benefits-list">
                  <div className="benefit-item"><i>•</i> Event Pass Registrations (Subscription Required)</div>
                  <div className="benefit-item"><i>•</i> Technical Team Support (Subscription Required)</div>
                  <div className="benefit-item"><i>•</i> Member-Only Gallery (Subscription Required)</div>
                </div>
              </div>
            )}

            {/* UPI Payment Form & QR Display Grid */}
            <div className="member-management-grid" style={{ marginTop: '24px' }}>
              <article className="account-form-card">
                <p className="eyebrow">UPI PAYMENT GATEWAY</p>
                <h2>Submit UPI Membership Fee</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '4px 0 18px' }}>
                  Monthly Membership Fee: <b style={{ color: '#059669', fontSize: '16px' }}>₹{subStatus.monthlyAmount || 100}</b>
                </p>

                <form onSubmit={handleSubmitPayment}>
                  <div className="member-form-grid">
                    <label>
                      Monthly Fee (₹)
                      <input name="amount" type="number" readOnly value={subStatus.monthlyAmount || 100} style={{ opacity: 0.8 }} />
                    </label>
                    <label>
                      Payment Method
                      <input type="text" readOnly value="UPI (GPay / PhonePe / Paytm / BHIM)" style={{ opacity: 0.8, color: '#70ddb4' }} />
                    </label>
                    <label className="form-wide">
                      UPI / UTR Transaction Reference ID (12 Digits) *
                      <input name="transactionRef" required placeholder="e.g. 423984729103 or UPI Ref" />
                    </label>
                    <label className="form-wide">
                      Upload Payment Screenshot / Receipt (Optional)
                      <input
                        type="file"
                        accept="image/*"
                        onChange={e => {
                          const file = e.target.files?.[0]
                          if (file) readImageFile(file, setReceiptPreview)
                        }}
                      />
                    </label>
                  </div>

                  {receiptPreview && (
                    <div style={{ marginTop: '12px', textAlign: 'center' }}>
                      <img src={receiptPreview} alt="Receipt preview" style={{ maxHeight: '140px', borderRadius: '8px', border: '1px solid #52bbf544' }} />
                    </div>
                  )}

                  <button className="primary member-submit" disabled={submitting} style={{ marginTop: '18px', width: '100%' }}>
                    {submitting ? 'SUBMITTING…' : 'SUBMIT UPI PAYMENT FOR VERIFICATION'}
                  </button>
                </form>
              </article>

              {/* Official UPI Gateway Card */}
              <article className="account-form-card" style={{ textAlign: 'center' }}>
                <p className="eyebrow">OFFICIAL UPI GATEWAY</p>
                <h2>Scan & Pay with Any UPI App</h2>

                <div className="payment-qr-display" style={{ marginTop: '16px' }}>
                  {subStatus.qrUrl ? (
                    <img src={subStatus.qrUrl} alt="Club Official QR Code" />
                  ) : (
                    <div style={{ width: '180px', height: '180px', background: 'var(--panel-subtle)', border: '1px dashed var(--brand-border-subtle)', borderRadius: '8px', display: 'grid', placeContent: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
                      UPI QR Code
                    </div>
                  )}
                  {subStatus.upiId && (
                    <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <code style={{ color: 'var(--brand-primary)', background: 'var(--bg-input)', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', border: '1px solid var(--line)' }}>
                        {subStatus.upiId}
                      </code>
                      <button type="button" className="action-btn edit-btn" onClick={copyUpiId}>
                        {copiedUpi ? '✓ Copied' : 'Copy UPI ID'}
                      </button>
                    </div>
                  )}
                </div>
                <small style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>
                  Pay via Google Pay, PhonePe, Paytm, or BHIM, then enter the transaction ID.
                </small>
              </article>
            </div>

            {/* Payment History Table */}
            <article className="member-list-card" style={{ marginTop: '24px' }}>
              <div className="card-heading">
                <div>
                  <p className="eyebrow">TRANSACTION HISTORY</p>
                  <h2>My Past Subscription Payments</h2>
                </div>
              </div>

              {(!subStatus.history || subStatus.history.length === 0) ? (
                <p className="directory-state">No subscription payment history recorded yet.</p>
              ) : (
                <div className="table-scroll-container">
                  <div className="sub-table">
                    <div className="sub-table-header" style={{ gridTemplateColumns: '1fr 1fr 1.4fr 1fr 1fr' }}>
                      <span>DATE</span>
                      <span>AMOUNT</span>
                      <span>TRANSACTION REF</span>
                      <span>STATUS</span>
                      <span>VALID UNTIL</span>
                    </div>
                    {subStatus.history.map(h => (
                      <div className="sub-table-row" key={h.id} style={{ gridTemplateColumns: '1fr 1fr 1.4fr 1fr 1fr' }}>
                        <div>
                          <b>{new Date(h.submittedAt).toLocaleDateString()}</b>
                        </div>
                        <div>
                          <strong style={{ color: '#70ddb4' }}>₹{Number(h.amount).toFixed(2)}</strong>
                        </div>
                        <div>
                          <small style={{ color: '#85d7ff' }}>{h.transactionRef}</small>
                        </div>
                        <div>
                          <span className={`badge badge-${h.status.toLowerCase()}`}>
                            {h.status}
                          </span>
                        </div>
                        <div>
                          <small style={{ color: '#85d7ff' }}>
                            {h.expiresAt ? new Date(h.expiresAt).toLocaleDateString() : '—'}
                          </small>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </article>
          </>
        )}
      </section>
    </LivePortal>
  )
}
