import React, { useEffect, useState } from 'react'
import { Icon8, IconDownload } from '../../components/icons'
import { LivePortal } from '../../components/layout/LivePortal'
import { adminApi } from '../../lib/api'
import { downloadCsv } from '../../lib/export-csv'

export function PaymentManagement({ user, logout, onNavigate }) {
  const [passes, setPasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Filter States
  const [searchQuery, setSearchQuery] = useState('')
  const [eventFilter, setEventFilter] = useState('ALL')
  const [paymentFilter, setPaymentFilter] = useState('ALL')
  const [attendanceFilter, setAttendanceFilter] = useState('ALL')
  const [modeFilter, setModeFilter] = useState('ALL')

  // Selected Pass for Full Detail Modal
  const [selectedPass, setSelectedPass] = useState(null)

  function loadPasses() {
    let mounted = true
    setLoading(true)
    Promise.all([
      adminApi.listAllPasses({
        eventId: eventFilter,
        paymentStatus: paymentFilter,
        attendanceStatus: attendanceFilter,
      }),
      adminApi.listEvents().catch(() => ({ events: [] })),
    ])
      .then(([passRes, evRes]) => {
        if (!mounted) return
        setPasses(passRes.passes || [])
        setEvents(evRes.events || [])
      })
      .catch(err => { if (mounted) setError(err.message) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }

  useEffect(() => {
    return loadPasses()
  }, [eventFilter, paymentFilter, attendanceFilter])

  async function handleVerifyUTR(passId) {
    setError('')
    setMessage('')
    try {
      await adminApi.verifyPassPayment(passId)
      setPasses(c => c.map(p => (p.id === passId ? { ...p, paymentStatus: 'VERIFIED', status: 'REGISTERED' } : p)))
      setMessage('Payment verified! Digital pass activated.')
    } catch (err) {
      setError(err.message || 'Failed to verify payment.')
    }
  }

  async function handleGrantGateEntry(regId) {
    setError('')
    setMessage('')
    try {
      await adminApi.grantEventEntry(regId)
      setPasses(c => c.map(p => (p.id === regId ? { ...p, attendanceMarked: true, attendedAt: new Date().toISOString() } : p)))
      setMessage('Attendee admitted and attendance recorded.')
    } catch (err) {
      setError(err.message || 'Failed to record attendance.')
    }
  }

  const filteredPasses = passes.filter(p => {
    if (modeFilter === 'TEAM' && !p.isTeamEvent && !p.teamName) return false
    if (modeFilter === 'INDIVIDUAL' && (p.isTeamEvent || p.teamName)) return false

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      const match =
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.memberId && p.memberId.toLowerCase().includes(q)) ||
        (p.rollNumber && p.rollNumber.toLowerCase().includes(q)) ||
        (p.id && p.id.toLowerCase().includes(q)) ||
        (p.eventTitle && p.eventTitle.toLowerCase().includes(q)) ||
        (p.teamName && p.teamName.toLowerCase().includes(q)) ||
        (p.paymentReference && p.paymentReference.toLowerCase().includes(q))
      if (!match) return false
    }
    return true
  })

  function handleDownloadPassesCsv() {
    const headers = [
      'Pass ID',
      'Student Name',
      'Member ID',
      'College / Institution',
      'Department / Branch',
      'Academic Year',
      'College Roll Number',
      'Gender',
      'Age',
      'Official Email',
      'Phone Number',
      'Emergency Contact',
      'Residency Type',
      'Commute / Hostel Mode',
      'Event Title',
      'Event Date',
      'Participation Mode',
      'Team Name',
      'Team Leader',
      'Registration Fee (₹)',
      'Payment Status',
      'UPI UTR Reference',
      'Attendance Marked',
      'Check-in Timestamp',
      'Registered At',
    ]
    const rows = filteredPasses.map(p => [
      p.id,
      p.name || p.memberName || p.user?.profile?.name || p.memberId,
      p.memberId || p.user?.memberId,
      p.department || p.user?.profile?.department,
      p.department || p.user?.profile?.department,
      p.year || p.user?.profile?.year,
      p.rollNumber || p.user?.profile?.rollNumber,
      p.gender || p.user?.profile?.gender || 'UNSPECIFIED',
      p.age || p.user?.profile?.age || null,
      p.email || p.user?.profile?.email,
      p.phone || p.user?.profile?.phone,
      p.emergencyContact,
      p.residencyType,
      p.residencyType === 'HOSTELLER' ? p.hostelType : p.transportMode,
      p.eventTitle,
      p.eventDate ? new Date(p.eventDate).toLocaleDateString() : null,
      p.teamName ? 'Team' : 'Individual',
      p.teamName || 'N/A',
      p.isTeamLeader ? 'Yes' : 'No',
      p.totalAmount,
      p.paymentStatus,
      p.paymentReference || 'N/A',
      p.attendanceMarked ? 'Yes' : 'No',
      p.attendedAt ? new Date(p.attendedAt).toLocaleString() : 'N/A',
      p.registeredAt ? new Date(p.registeredAt).toLocaleString() : null,
    ])
    downloadCsv('event_passes_roster.csv', headers, rows)
  }

  return (
    <LivePortal user={user} logout={logout} activeTab="admin-payments" onNavigate={onNavigate} title="EVENT PASSES & GATE ROSTER">
      <section className="member-management">
        <div className="member-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('admin-dashboard')}>
              ← COMMAND CENTER
            </button>
            <p className="eyebrow">ATTENDEE ROSTER & PASS VERIFICATION</p>
            <h1>Event Passes & Attendee Roster</h1>
            <p>Inspect student passes, verify UPI UTR transactions, check residency & commute logistics, and track gate attendance.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="primary"
              onClick={() => onNavigate('admin-qr-scanner')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '6px 14px' }}
            >
              <Icon8 name="irisScan" size={16} /> GATE QR SCANNER
            </button>
            <button
              type="button"
              className="outline"
              onClick={handleDownloadPassesCsv}
              disabled={filteredPasses.length === 0}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '6px 12px' }}
              title="Download event passes as CSV"
            >
              <IconDownload size={14} /> DOWNLOAD PASSES CSV
            </button>
          </div>
        </div>

        {message && <p className="member-form-success">{message}</p>}
        {error && <p className="member-form-error">{error}</p>}

        {/* Search & Filter Command Strip */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1fr', gap: '10px', margin: '16px 0', alignItems: 'center' }}>
          <div>
            <input
              placeholder="Search by student, member ID, pass ID, UTR, team..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%', height: '38px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)', padding: '0 12px', fontSize: '12px' }}
            />
          </div>
          <div>
            <select
              value={eventFilter}
              onChange={e => setEventFilter(e.target.value)}
              className="member-select"
              style={{ width: '100%', height: '38px', marginTop: 0 }}
            >
              <option value="ALL">All Events ({events.length})</option>
              {events.map(ev => (
                <option key={ev.id} value={ev.id}>{ev.title}</option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={paymentFilter}
              onChange={e => setPaymentFilter(e.target.value)}
              className="member-select"
              style={{ width: '100%', height: '38px', marginTop: 0 }}
            >
              <option value="ALL">All Payments</option>
              <option value="PAID">Verified / Paid</option>
              <option value="PENDING">Pending UTR</option>
              <option value="FREE">Free Passes</option>
            </select>
          </div>
          <div>
            <select
              value={attendanceFilter}
              onChange={e => setAttendanceFilter(e.target.value)}
              className="member-select"
              style={{ width: '100%', height: '38px', marginTop: 0 }}
            >
              <option value="ALL">All Attendance</option>
              <option value="ATTENDED">Admitted / Present</option>
              <option value="ABSENT">Not Yet Admitted</option>
            </select>
          </div>
          <div>
            <select
              value={modeFilter}
              onChange={e => setModeFilter(e.target.value)}
              className="member-select"
              style={{ width: '100%', height: '38px', marginTop: 0 }}
            >
              <option value="ALL">All Modes</option>
              <option value="INDIVIDUAL">Individual</option>
              <option value="TEAM">Teams</option>
            </select>
          </div>
        </div>

        {/* Pass Roster Table */}
        <article className="member-list-card">
          {loading ? (
            <p className="directory-state">Loading passes & attendee records...</p>
          ) : filteredPasses.length === 0 ? (
            <p className="directory-state">No matching passes found.</p>
          ) : (
            <div className="table-scroll-container">
              <div className="sub-table">
                <div className="sub-table-header" style={{ gridTemplateColumns: '1.4fr 1.3fr 1.1fr 1.2fr 1fr 1fr' }}>
                  <span>STUDENT & DEMOGRAPHICS</span>
                  <span>EVENT & TEAM</span>
                  <span>RESIDENCY / COMMUTE</span>
                  <span>PAYMENT & UTR</span>
                  <span>GATE ENTRY</span>
                  <span>ACTIONS</span>
                </div>
                {filteredPasses.map(p => (
                  <div className="sub-table-row" key={p.id} style={{ gridTemplateColumns: '1.4fr 1.3fr 1.1fr 1.2fr 1fr 1fr', alignItems: 'center' }}>
                    {/* Student Info */}
                    <div>
                      <b style={{ color: 'var(--text-main)', fontSize: '13px' }}>{p.name}</b>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                        <small style={{ color: 'var(--brand-primary)', fontFamily: 'monospace' }}>{p.memberId}</small>
                        <span className="badge" style={{ fontSize: '9px', padding: '1px 6px', background: 'var(--panel-subtle)', color: 'var(--text-muted)' }}>
                          {p.gender} {p.age ? `· ${p.age}y` : ''}
                        </span>
                      </div>
                      <small style={{ color: 'var(--text-dim)', display: 'block' }}>{p.department} {p.year ? `· Y${p.year}` : ''}</small>
                    </div>

                    {/* Event & Team */}
                    <div>
                      <b style={{ color: 'var(--text-main)', fontSize: '12px' }}>{p.eventTitle}</b>
                      {p.teamName ? (
                        <span className="badge" style={{ display: 'inline-block', marginTop: '4px', fontSize: '10px', background: p.isTeamLeader ? 'var(--brand-glow)' : 'var(--panel-subtle)', color: p.isTeamLeader ? 'var(--brand-primary)' : 'var(--text-main)', border: '1px solid var(--line)' }}>
                          {p.teamName} {p.isTeamLeader ? '(Leader)' : '(Member)'}
                        </span>
                      ) : (
                        <small style={{ color: 'var(--text-muted)', display: 'block' }}>Individual Participant</small>
                      )}
                    </div>

                    {/* Residency & Commute */}
                    <div>
                      <b style={{ color: 'var(--text-main)', fontSize: '11px', display: 'block' }}>
                        {p.residencyType === 'HOSTELLER' ? 'Hosteller' : 'Day Scholar'}
                      </b>
                      <small style={{ color: 'var(--brand-primary)', display: 'block' }}>
                        {p.residencyType === 'HOSTELLER'
                          ? (p.hostelType === 'PRIVATE_HOSTEL' ? 'Private PG' : 'College Hostel')
                          : (p.transportMode === 'COLLEGE_BUS' ? 'College Bus' : p.transportMode === 'PUBLIC_BUS' ? 'Public Bus' : 'Own Transport')}
                      </small>
                    </div>

                    {/* Payment & UTR */}
                    <div>
                      <strong style={{ color: '#70ddb4', fontSize: '13px' }}>
                        {p.totalAmount > 0 ? `₹${p.totalAmount}` : 'Free Entry'}
                      </strong>
                      {p.paymentReference && (
                        <small style={{ color: 'var(--text-dim)', display: 'block', fontFamily: 'monospace' }}>
                          UTR: {p.paymentReference}
                        </small>
                      )}
                      <span className={`badge badge-${(p.paymentStatus || 'free').toLowerCase()}`} style={{ marginTop: '3px', display: 'inline-block', fontSize: '9px' }}>
                        {p.paymentStatus}
                      </span>
                    </div>

                    {/* Gate Attendance */}
                    <div>
                      {p.attendanceMarked ? (
                        <span className="badge" style={{ background: '#064e3b', color: '#6ee7b7', border: '1px solid #10b981', fontSize: '10px' }}>
                          ✓ PRESENT
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="action-btn"
                          onClick={() => handleGrantGateEntry(p.id)}
                          style={{ fontSize: '10px', padding: '4px 8px', background: 'var(--panel-subtle)', color: 'var(--text-main)', border: '1px solid var(--line)' }}
                        >
                          Check-in
                        </button>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="action-buttons" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {p.paymentStatus === 'SUBMITTED' && (
                        <button className="action-btn save-btn" onClick={() => handleVerifyUTR(p.id)} style={{ fontSize: '10px', padding: '4px 8px' }}>
                          Verify UTR
                        </button>
                      )}
                      <button className="action-btn" onClick={() => setSelectedPass(p)} style={{ fontSize: '10px', padding: '4px 8px', background: 'var(--brand-glow)', color: 'var(--brand-primary)', border: '1px solid var(--line)' }}>
                        Pass QR
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </article>

        {/* Selected Pass Details & QR Modal */}
        {selectedPass && (
          <div className="photo-lightbox" onClick={() => setSelectedPass(null)}>
            <div className="photo-lightbox-content" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-modal)', padding: '28px', borderRadius: '16px', border: '1px solid var(--line)', maxWidth: '620px', width: '95vw', maxHeight: '88vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span className="badge badge-president">{selectedPass.eventType || 'EVENT PASS'}</span>
                <button className="lightbox-close" onClick={() => setSelectedPass(null)} style={{ position: 'static' }}>✕</button>
              </div>

              {selectedPass.qrCodeData && (
                <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                  <div style={{ background: '#fff', padding: '12px', borderRadius: '12px', display: 'inline-block' }}>
                    <img src={selectedPass.qrCodeData} alt="Pass QR" style={{ width: '150px', height: '150px', imageRendering: 'pixelated' }} />
                  </div>
                </div>
              )}

              <h2 style={{ font: '700 20px Syne', color: 'var(--text-main)', margin: '0 0 4px', textAlign: 'center' }}>
                {selectedPass.name || selectedPass.memberName || selectedPass.user?.profile?.name || selectedPass.memberId}
              </h2>
              <p style={{ color: 'var(--brand-primary)', fontFamily: 'monospace', fontSize: '12px', margin: '0 0 16px', textAlign: 'center' }}>
                PASS ID: {selectedPass.id} · MEMBER: {selectedPass.memberId || selectedPass.user?.memberId}
              </p>

              <div style={{ background: 'var(--panel-subtle)', borderRadius: '12px', padding: '16px', fontSize: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', color: 'var(--text-muted)', border: '1px solid var(--line)' }}>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>COLLEGE / INSTITUTION</span>
                  <b style={{ color: 'var(--text-main)', display: 'block', marginTop: '2px' }}>
                    {selectedPass.department || selectedPass.user?.profile?.department || 'Malla Reddy (MR) Deemed to be University'}
                  </b>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ACADEMIC YEAR & ROLL</span>
                  <b style={{ color: 'var(--text-main)', display: 'block', marginTop: '2px' }}>
                    Year {selectedPass.year || selectedPass.user?.profile?.year || '1'} · Roll: {selectedPass.rollNumber || selectedPass.user?.profile?.rollNumber || '---'}
                  </b>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>EMAIL ADDRESS</span>
                  <b style={{ color: 'var(--text-main)', display: 'block', marginTop: '2px', wordBreak: 'break-all' }}>
                    {selectedPass.email || selectedPass.user?.profile?.email || '---'}
                  </b>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PHONE & EMERGENCY</span>
                  <b style={{ color: 'var(--text-main)', display: 'block', marginTop: '2px' }}>
                    {selectedPass.phone || selectedPass.user?.profile?.phone || '---'} {selectedPass.emergencyContact ? `(Emerg: ${selectedPass.emergencyContact})` : ''}
                  </b>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>GENDER & AGE</span>
                  <b style={{ color: 'var(--text-main)', display: 'block', marginTop: '2px' }}>
                    {selectedPass.gender || selectedPass.user?.profile?.gender || 'MALE'} · {selectedPass.age || selectedPass.user?.profile?.age || '---'} yrs
                  </b>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>RESIDENCY & COMMUTE</span>
                  <b style={{ color: 'var(--text-main)', display: 'block', marginTop: '2px' }}>
                    {selectedPass.residencyType === 'HOSTELLER'
                      ? (selectedPass.hostelType === 'PRIVATE_HOSTEL' ? 'Private PG / Hostel' : 'College Hostel')
                      : (selectedPass.transportMode === 'COLLEGE_BUS' ? 'College Bus Commuter' : selectedPass.transportMode === 'PUBLIC_BUS' ? 'Public Bus' : 'Day Scholar')}
                  </b>
                </div>
                {selectedPass.teamName && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>TEAM SQUAD</span>
                    <b style={{ color: 'var(--brand-primary)', display: 'block', marginTop: '2px' }}>
                      {selectedPass.teamName} {selectedPass.isTeamLeader ? '★ Squad Leader' : '· Squad Member'}
                    </b>
                  </div>
                )}
                <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--line)', paddingTop: '10px', marginTop: '4px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PAYMENT & UTR</span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <strong style={{ color: '#70ddb4', fontSize: '14px' }}>
                        {selectedPass.totalAmount > 0 ? `₹${selectedPass.totalAmount}` : 'Free Entry'}
                      </strong>
                      <span className={`badge badge-${(selectedPass.paymentStatus || 'free').toLowerCase()}`} style={{ marginLeft: '8px' }}>
                        {selectedPass.paymentStatus}
                      </span>
                      {selectedPass.paymentReference && (
                        <span style={{ display: 'block', color: 'var(--brand-primary)', fontFamily: 'monospace', fontSize: '11px', marginTop: '2px' }}>
                          UTR: {selectedPass.paymentReference}
                        </span>
                      )}
                    </div>
                    {selectedPass.paymentProofUrl && (
                      <a
                        href={selectedPass.paymentProofUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="action-btn"
                        style={{ fontSize: '10px', padding: '4px 10px', background: 'var(--panel-elevated)', color: 'var(--brand-primary)', border: '1px solid var(--line)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        VIEW PAYMENT PROOF ↗
                      </a>
                    )}
                  </div>
                </div>

                {/* Custom Form Data (if any) */}
                {selectedPass.formData && typeof selectedPass.formData === 'object' && Object.keys(selectedPass.formData).length > 0 && (
                  <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--line)', paddingTop: '10px', marginTop: '4px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>CUSTOM FORM RESPONSES</span>
                    <div style={{ marginTop: '6px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      {Object.entries(selectedPass.formData).map(([k, v]) => (
                        <div key={k} style={{ background: 'var(--bg-input)', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--line)' }}>
                          <small style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px' }}>{k}</small>
                          <span style={{ color: 'var(--text-main)', fontSize: '11px', fontWeight: 600 }}>{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginTop: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {(selectedPass.paymentStatus === 'SUBMITTED' || selectedPass.paymentStatus === 'PENDING') && selectedPass.totalAmount > 0 && (
                  <button
                    type="button"
                    className="primary"
                    onClick={() => { handleVerifyUTR(selectedPass.id); setSelectedPass(null) }}
                    style={{ flex: 1, height: '38px', fontSize: '11px' }}
                  >
                    VERIFY UTR & ACTIVATE
                  </button>
                )}
                {!selectedPass.attendanceMarked && (
                  <button
                    type="button"
                    className="action-btn save-btn"
                    onClick={() => { handleGrantGateEntry(selectedPass.id); setSelectedPass(null) }}
                    style={{ flex: 1, height: '38px', fontSize: '11px' }}
                  >
                    RECORD GATE ENTRY
                  </button>
                )}
                <button
                  type="button"
                  className="action-btn"
                  onClick={() => setSelectedPass(null)}
                  style={{ height: '38px', padding: '0 16px', background: 'var(--panel-elevated)', color: 'var(--text-main)', border: '1px solid var(--line)', fontSize: '11px' }}
                >
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </LivePortal>
  )
}
