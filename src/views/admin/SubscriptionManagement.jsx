import React, { useEffect, useState } from 'react'
import { Icon8, IconAlertTriangle, IconDownload } from '../../components/icons'
import { LivePortal } from '../../components/layout/LivePortal'
import { adminApi } from '../../lib/api'
import { downloadCsv } from '../../lib/export-csv'

export function SubscriptionManagement({ user, logout, onNavigate }) {
  const [subscriptions, setSubscriptions] = useState([])
  const [stats, setStats] = useState({ totalStudents: 0, activeSubscriptions: 0, pendingVerification: 0, expiredSubscriptions: 0, rejectedPayments: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [filter, setFilter] = useState('ALL')
  const [searchTerm, setSearchTerm] = useState('')
  const [viewingReceipt, setViewingReceipt] = useState(null)
  const [rejectingSub, setRejectingSub] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')

  function loadData() {
    setLoading(true)
    adminApi.listSubscriptions()
      .then(res => {
        setSubscriptions(res.subscriptions || [])
        setStats(res.stats || {})
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleVerify(id) {
    setError('')
    setMessage('')
    try {
      await adminApi.verifySubscription(id)
      setMessage('Subscription verified and activated successfully until the end of the month.')
      loadData()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleReject() {
    if (!rejectingSub) return
    setError('')
    setMessage('')
    try {
      await adminApi.rejectSubscription(rejectingSub.id, rejectionReason)
      setMessage('Subscription payment rejected.')
      setRejectingSub(null)
      setRejectionReason('')
      loadData()
    } catch (err) {
      setError(err.message)
    }
  }

  const filtered = subscriptions.filter(sub => {
    if (filter === 'PENDING' && sub.status !== 'PENDING') return false
    if (filter === 'ACTIVE' && sub.status !== 'ACTIVE') return false
    if (filter === 'EXPIRED' && sub.status !== 'EXPIRED') return false
    if (filter === 'REJECTED' && sub.status !== 'REJECTED') return false
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      const matchId = sub.memberId.toLowerCase().includes(term)
      const matchName = sub.name.toLowerCase().includes(term)
      const matchRef = sub.transactionRef.toLowerCase().includes(term)
      if (!matchId && !matchName && !matchRef) return false
    }
    return true
  })

  function handleDownloadSubscriptionsCsv() {
    const headers = [
      'Subscription ID',
      'Member ID',
      'Student Name',
      'Roll Number',
      'Department / Branch',
      'Academic Year',
      'Official Email',
      'Phone Number',
      'Amount (₹)',
      'Status',
      'Transaction UTR / Ref',
      'Submission Date',
      'Verification Date',
      'Expiry Date',
      'Rejection Reason',
    ]
    const rows = filtered.map(s => [
      s.id,
      s.memberId,
      s.name,
      s.rollNumber || s.memberId,
      s.department,
      s.year,
      s.email,
      s.phone,
      Number(s.amount || 0),
      s.status,
      s.transactionRef,
      s.submittedAt ? new Date(s.submittedAt).toLocaleString() : null,
      s.verifiedAt ? new Date(s.verifiedAt).toLocaleString() : null,
      s.expiresAt ? new Date(s.expiresAt).toLocaleDateString() : null,
      s.rejectionReason,
    ])
    downloadCsv('student_subscriptions_export.csv', headers, rows)
  }

  return (
    <LivePortal user={user} logout={logout} activeTab="admin-subscriptions" onNavigate={onNavigate} title="STUDENT SUBSCRIPTIONS">
      <section className="member-management">
        <div className="member-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('admin-dashboard')}>
              ← COMMAND CENTER
            </button>
            <p className="eyebrow">STUDENT MEMBERSHIP FEE</p>
            <h1>Subscription Management</h1>
            <p>Review, verify, and track monthly student membership payments.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className="outline"
              onClick={handleDownloadSubscriptionsCsv}
              disabled={filtered.length === 0}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '6px 12px' }}
              title="Download subscriptions list as CSV"
            >
              <IconDownload size={14} /> DOWNLOAD SUBSCRIPTIONS CSV
            </button>
            <button className="outline" type="button" onClick={() => onNavigate('admin-settings')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
              <Icon8 name="keySecurity" size={14} /> SUBSCRIPTION SETTINGS
            </button>
          </div>
        </div>

        {message && <p className="member-form-success">{message}</p>}
        {error && <p className="member-form-error">{error}</p>}

        {/* Top Statistics Cards */}
        <div className="sub-stats-grid">
          <div className="sub-stat-card blue">
            <i><Icon8 name="idDocs" size={22} /></i>
            <div>
              <p>TOTAL STUDENTS</p>
              <b>{stats.totalStudents || 0}</b>
            </div>
          </div>
          <div className="sub-stat-card green">
            <i><Icon8 name="authentication" size={22} /></i>
            <div>
              <p>ACTIVE SUBSCRIPTIONS</p>
              <b>{stats.activeSubscriptions || 0}</b>
            </div>
          </div>
          <div className="sub-stat-card amber">
            <i><Icon8 name="realtime" size={22} /></i>
            <div>
              <p>PENDING VERIFICATION</p>
              <b>{stats.pendingVerification || 0}</b>
            </div>
          </div>
          <div className="sub-stat-card purple">
            <i><Icon8 name="protect" size={22} /></i>
            <div>
              <p>EXPIRED SUBSCRIPTIONS</p>
              <b>{stats.expiredSubscriptions || 0}</b>
            </div>
          </div>
          <div className="sub-stat-card red">
            <i><Icon8 name="captcha" size={22} /></i>
            <div>
              <p>REJECTED PAYMENTS</p>
              <b>{stats.rejectedPayments || stats.rejectedCount || 0}</b>
            </div>
          </div>
        </div>

        {/* Pending Indicator Banner */}
        {stats.pendingVerification > 0 && (
          <div className="pending-alert-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <IconAlertTriangle size={20} />
              <div>
                <b>{stats.pendingVerification} payments waiting for verification</b>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#ffecb3' }}>
                  Student members are waiting for membership activation.
                </p>
              </div>
            </div>
            <button type="button" onClick={() => setFilter('PENDING')}>
              REVIEW PAYMENTS →
            </button>
          </div>
        )}

        {/* Filter Controls & Submissions Table */}
        <article className="member-list-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div className="audit-tabs" style={{ borderBottom: 0, margin: 0, padding: 0 }}>
              {['ALL', 'PENDING', 'ACTIVE', 'EXPIRED', 'REJECTED'].map(f => (
                <button
                  key={f}
                  type="button"
                  className={`audit-tab-btn ${filter === f ? 'active' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f} {f === 'PENDING' && stats.pendingVerification > 0 ? `(${stats.pendingVerification})` : ''}
                </button>
              ))}
            </div>
            <input
              style={{ height: '36px', padding: '0 12px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', fontSize: '11px', minWidth: '240px' }}
              placeholder="Search by ID, Name, or UTR Ref..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          {loading ? (
            <p className="directory-state">Loading subscription submissions...</p>
          ) : filtered.length === 0 ? (
            <p className="directory-state">No subscription records match your criteria.</p>
          ) : (
            <div className="table-scroll-container">
              <div className="sub-table">
                <div className="sub-table-header">
                  <span>STUDENT</span>
                  <span>AMOUNT / REF</span>
                  <span>SUBMITTED</span>
                  <span>RECEIPT</span>
                  <span>STATUS / EXPIRY</span>
                  <span>ACTIONS</span>
                </div>
                {filtered.map(sub => (
                  <div className="sub-table-row" key={sub.id}>
                    <div>
                      <b>{sub.name}</b>
                      <small style={{ color: 'var(--brand-primary)', display: 'block' }}>{sub.memberId}</small>
                    </div>
                    <div>
                      <strong style={{ color: '#059669' }}>₹{sub.amount.toFixed(2)}</strong>
                      <small style={{ color: 'var(--text-muted)', display: 'block' }}>Ref: {sub.transactionRef}</small>
                    </div>
                    <div>
                      <small>{new Date(sub.submittedAt).toLocaleDateString()}</small>
                      <small style={{ color: 'var(--text-dim)', display: 'block' }}>{new Date(sub.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                    </div>
                    <div>
                      {sub.receiptImage ? (
                        <img
                          className="receipt-thumb"
                          src={sub.receiptImage}
                          alt="Payment Receipt"
                          onClick={() => setViewingReceipt(sub.receiptImage)}
                          title="Click to view full receipt"
                        />
                      ) : (
                        <small style={{ color: 'var(--text-dim)' }}>No receipt</small>
                      )}
                    </div>
                    <div>
                      <span className={`badge badge-${sub.status.toLowerCase()}`}>
                        {sub.status}
                      </span>
                      {sub.expiresAt && sub.status === 'ACTIVE' && (
                        <small style={{ display: 'block', marginTop: '3px', color: 'var(--brand-primary)' }}>
                          Expires: {new Date(sub.expiresAt).toLocaleDateString()}
                        </small>
                      )}
                      {sub.rejectionReason && sub.status === 'REJECTED' && (
                        <small style={{ display: 'block', marginTop: '3px', color: '#b91c1c' }}>
                          {sub.rejectionReason}
                        </small>
                      )}
                    </div>
                    <div className="action-buttons">
                      {sub.status === 'PENDING' && (
                        <>
                          <button className="action-btn save-btn" onClick={() => handleVerify(sub.id)}>
                            ✓ Verify / Activate
                          </button>
                          <button className="action-btn delete-btn" onClick={() => setRejectingSub(sub)}>
                            ✕ Reject
                          </button>
                        </>
                      )}
                      {sub.status === 'REJECTED' && (
                        <button className="action-btn save-btn" onClick={() => handleVerify(sub.id)}>
                          Re-Activate
                        </button>
                      )}
                      {sub.status === 'ACTIVE' && (
                        <small style={{ color: '#059669' }}>Verified by {sub.verifiedBy}</small>
                      )}
                      {sub.status === 'EXPIRED' && (
                        <small style={{ color: 'var(--text-muted)' }}>Expired on {new Date(sub.expiresAt).toLocaleDateString()}</small>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </article>

        {/* Receipt Image Lightbox Modal */}
        {viewingReceipt && (
          <div className="photo-lightbox" onClick={() => setViewingReceipt(null)}>
            <div className="photo-lightbox-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', background: 'var(--bg-modal)', padding: '20px', borderRadius: '12px', border: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <b style={{ color: 'var(--brand-primary)', fontSize: '13px' }}>PAYMENT RECEIPT PROOF</b>
                <button className="lightbox-close" onClick={() => setViewingReceipt(null)} style={{ position: 'static' }}>✕</button>
              </div>
              <img src={viewingReceipt} alt="Receipt Full" style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: '8px' }} />
            </div>
          </div>
        )}

        {/* Rejection Modal */}
        {rejectingSub && (
          <div className="photo-lightbox" onClick={() => setRejectingSub(null)}>
            <div className="photo-lightbox-content" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-modal)', padding: '28px', borderRadius: '12px', border: '1px solid #f8717155', maxWidth: '420px' }}>
              <h3 style={{ margin: '0 0 8px', font: '700 18px Syne', color: '#dc2626' }}>Reject Payment</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '0 0 16px' }}>
                Reject payment for: <b style={{ color: 'var(--text-main)' }}>{rejectingSub.name} ({rejectingSub.memberId})</b>
              </p>
              <textarea
                placeholder="Reason for rejection (e.g. Invalid UTR reference ID / Screenshot unreadable)"
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                style={{ width: '100%', height: '80px', padding: '10px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', marginBottom: '14px', resize: 'none' }}
              />
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="action-btn cancel-btn" onClick={() => setRejectingSub(null)}>Cancel</button>
                <button type="button" className="action-btn delete-btn" onClick={handleReject}>CONFIRM REJECTION</button>
              </div>
            </div>
          </div>
        )}
      </section>
    </LivePortal>
  )
}
