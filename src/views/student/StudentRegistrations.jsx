import React, { useEffect, useState } from 'react'
import {
  Icon8,
  IconCalendar,
  IconCopy,
  IconCreditCard,
  IconDownload,
  IconLocationPin,
  IconUserSvg,
} from '../../components/icons'
import { LivePortal } from '../../components/layout/LivePortal'
import { usePlatformTheme } from '../../context/PlatformThemeContext'
import { memberApi } from '../../lib/api'

export function StudentRegistrations({ user, logout, onNavigate }) {
  const { platformMode } = usePlatformTheme()
  const isMrdu = platformMode === 'MRDU_EVENTS'
  const [registrations, setRegistrations] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPass, setSelectedPass] = useState(null)
  const [copiedId, setCopiedId] = useState(false)

  useEffect(() => {
    let mounted = true
    memberApi.listRegistrations()
      .then(({ registrations: list }) => {
        if (!mounted) return
        const regList = list || []
        setRegistrations(regList)
        const params = new URLSearchParams(window.location.search)
        const targetId = params.get('passId') || params.get('id')
        if (targetId) {
          const match = regList.find(p => p.id === targetId || p.event?.id === targetId)
          if (match) setSelectedPass(match)
        }
      })
      .catch(() => { if (mounted) setRegistrations([]) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  function handleCopyPassId(id) {
    if (!id) return
    navigator.clipboard?.writeText(id).then(() => {
      setCopiedId(true)
      setTimeout(() => setCopiedId(false), 2200)
    }).catch(() => {})
  }

  return (
    <LivePortal user={user} logout={logout} activeTab="student-passes" onNavigate={onNavigate} title={isMrdu ? 'MY MRDU EVENT PASSES' : 'MY EVENT PASSES'}>
      <section className="gallery-section">
        <div className="event-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('student-dashboard')}>
              ← BACK TO DASHBOARD
            </button>
            <p className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Icon8 name="idDocs" size={14} /> {isMrdu ? 'CONFIRMED PASSES & BADGES' : 'CONFIRMED PASSES'}
            </p>
            <h1>{isMrdu ? 'My Event Passes & QR Badges' : 'My Event Passes & QR'}</h1>
            <p>{isMrdu ? 'Your confirmed attendance passes and digital entrance verification for all MRDU events.' : 'Your confirmed attendance records and entry passes for all club sessions.'}</p>
          </div>
        </div>

        {loading ? (
          <p className="directory-state">Loading your passes...</p>
        ) : registrations.length === 0 ? (
          <p className="directory-state">You have not registered for any events yet.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: '20px', marginTop: '20px' }}>
            {registrations.map(reg => (
              <article
                key={reg.id}
                className="live-event-card"
                style={{
                  background: 'var(--bg-card)',
                  border: reg.attendanceMarked ? '1px solid #10b98166' : '1px solid var(--brand-border-subtle)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: reg.attendanceMarked ? '0 8px 30px rgba(16, 185, 129, 0.12)' : '0 8px 30px rgba(0,0,0,0.2)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
              >
                {/* Event Top Badge */}
                <div style={{ padding: '16px 20px', background: reg.attendanceMarked ? 'rgba(16, 185, 129, 0.12)' : 'var(--panel-subtle)', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span className="badge" style={{ background: 'var(--brand-badge-bg)', color: 'var(--brand-badge-color)', fontSize: '10px' }}>
                      {reg.event?.eventType || 'EVENT PASS'}
                    </span>
                  </div>
                  {reg.attendanceMarked ? (
                    <span className="badge" style={{ background: '#064e3b', color: '#6ee7b7', border: '1px solid #10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Icon8 name="authentication" size={14} /> ATTENDANCE CONFIRMED
                    </span>
                  ) : (
                    <span className="badge badge-registered" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Icon8 name="faceId" size={14} /> ENTRY VALID · SCAN AT GATE
                    </span>
                  )}
                </div>

                <div className="card-content" style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ margin: '0 0 8px', font: '700 18px Syne', color: 'var(--text-main)' }}>
                    {reg.event?.title || (isMrdu ? 'MRDU Event' : 'Club Event')}
                  </h3>

                  <div className="card-meta" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', margin: '12px 0 16px', fontSize: '11px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><IconCalendar size={13} /> {reg.event?.dateTime ? new Date(reg.event.dateTime).toLocaleDateString() : 'TBA'}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><IconLocationPin size={13} /> {reg.event?.venue || reg.event?.location || 'Campus'}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><IconCreditCard size={13} /> Payment: <b style={{ color: '#70ddb4', marginLeft: 4 }}>{reg.paymentStatus}</b></span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><IconUserSvg size={13} /> Attendee: {user.memberId}</span>
                  </div>

                  {/* QR Code Pass Box */}
                  <div
                    style={{
                      marginTop: 'auto',
                      padding: '16px',
                      borderRadius: '12px',
                      background: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      color: '#000000',
                      boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
                    }}
                  >
                    {reg.qrCodeData ? (
                      <img
                        src={reg.qrCodeData}
                        alt={`QR Pass for ${reg.event?.title}`}
                        onClick={() => setSelectedPass(reg)}
                        style={{ width: '96px', height: '96px', borderRadius: '8px', border: '1px solid #e2e8f0', flexShrink: 0, imageRendering: 'pixelated', cursor: 'pointer' }}
                        title="Click to view full pass"
                      />
                    ) : (
                      <div style={{ width: '96px', height: '96px', background: '#f1f5f9', display: 'grid', placeItems: 'center', borderRadius: '8px', fontSize: '10px', color: '#64748b' }}>
                        QR PASS
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, font: '700 12px Syne', color: '#0f172a' }}>
                        OFFICIAL ENTRANCE QR PASS
                      </p>
                      <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#64748b', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                        PASS ID: {reg.id.slice(0, 16)}...
                      </p>
                      <p style={{ margin: '6px 0 0', fontSize: '10px', color: reg.attendanceMarked ? '#059669' : '#d97706', fontWeight: 600 }}>
                        {reg.attendanceMarked
                          ? `✓ Checked in at ${reg.attendedAt ? new Date(reg.attendedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Gate'}`
                          : 'Show this QR to coordinator at gate'}
                      </p>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="primary"
                          onClick={() => setSelectedPass(reg)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '5px 10px',
                            height: '28px',
                            background: '#0284c7',
                            borderColor: '#0284c7',
                          }}
                        >
                          <Icon8 name="idDocs" size={13} /> VIEW FULL PASS
                        </button>
                        {reg.qrCodeData && (
                          <a
                            href={reg.qrCodeData}
                            download={`event-pass-${reg.event?.title || 'ticket'}.png`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '10px',
                              fontWeight: 700,
                              color: '#0f172a',
                              background: '#f1f5f9',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              textDecoration: 'none',
                              border: '1px solid #cbd5e1',
                              height: '28px',
                              boxSizing: 'border-box',
                            }}
                          >
                            <IconDownload size={12} /> DOWNLOAD
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* FULL DIGITAL PASS MODAL / LIGHTBOX */}
        {selectedPass && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.82)',
              backdropFilter: 'blur(10px)',
              zIndex: 9999,
              display: 'grid',
              placeItems: 'center',
              padding: '20px',
              overflowY: 'auto',
            }}
            onClick={() => setSelectedPass(null)}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '520px',
                background: 'var(--bg-card)',
                borderRadius: '20px',
                border: '2px solid var(--brand-primary)',
                boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
                overflow: 'hidden',
                position: 'relative',
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Top Banner */}
              <div
                style={{
                  padding: '20px 24px',
                  background: selectedPass.attendanceMarked ? 'linear-gradient(135deg, #064e3b, #047857)' : 'linear-gradient(135deg, #0f2744, #1e3a8a)',
                  color: '#ffffff',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <span className="badge" style={{ background: 'rgba(255,255,255,0.2)', color: '#ffffff', fontSize: '10px', textTransform: 'uppercase' }}>
                    {selectedPass.event?.eventType || 'OFFICIAL EVENT PASS'}
                  </span>
                  <h2 style={{ margin: '6px 0 0', font: '700 20px Syne', color: '#ffffff' }}>
                    {selectedPass.event?.title}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPass(null)}
                  style={{
                    background: 'rgba(255,255,255,0.15)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '36px',
                    height: '36px',
                    color: '#ffffff',
                    fontSize: '18px',
                    cursor: 'pointer',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                  title="Close Pass"
                >
                  ✕
                </button>
              </div>

              <div style={{ padding: '24px' }}>
                {/* Large Center QR Pass */}
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <div
                    style={{
                      display: 'inline-block',
                      padding: '16px',
                      background: '#ffffff',
                      borderRadius: '16px',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
                      border: '2px solid #e2e8f0',
                    }}
                  >
                    {selectedPass.qrCodeData ? (
                      <img
                        src={selectedPass.qrCodeData}
                        alt="Event QR Code"
                        style={{ width: '200px', height: '200px', display: 'block', imageRendering: 'pixelated' }}
                      />
                    ) : (
                      <div style={{ width: '200px', height: '200px', background: '#f1f5f9', display: 'grid', placeItems: 'center', color: '#64748b' }}>
                        QR PASS
                      </div>
                    )}
                  </div>
                  <p style={{ margin: '10px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                    Hold this QR code up to the coordinator's scanner at the event entrance
                  </p>
                </div>

                {/* Full Pass ID Box */}
                <div style={{ padding: '14px', background: 'var(--bg-input)', borderRadius: '12px', border: '1px solid var(--line)', marginBottom: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <small style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      FULL PASS ID & VERIFICATION KEY
                    </small>
                    <button
                      type="button"
                      className="outline"
                      onClick={() => handleCopyPassId(selectedPass.id)}
                      style={{ fontSize: '10px', padding: '3px 8px', height: '24px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <IconCopy size={11} /> {copiedId ? 'COPIED!' : 'COPY ID'}
                    </button>
                  </div>
                  <code style={{ display: 'block', fontSize: '12px', color: '#38bdf8', wordBreak: 'break-all', fontFamily: 'monospace', fontWeight: 600 }}>
                    {selectedPass.id}
                  </code>
                </div>

                {/* Ticket Details Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '16px', background: 'var(--panel-subtle)', borderRadius: '12px', border: '1px solid var(--line)', marginBottom: '20px', fontSize: '12px' }}>
                  <div>
                    <span style={{ color: 'var(--text-dim)', fontSize: '11px', display: 'block' }}>Attendee Name</span>
                    <b style={{ color: 'var(--text-main)' }}>{user.profile?.name || user.name || user.memberId}</b>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-dim)', fontSize: '11px', display: 'block' }}>Member ID / Roll No</span>
                    <b style={{ color: 'var(--brand-primary)', fontFamily: 'monospace' }}>{user.profile?.rollNumber || user.memberId}</b>
                  </div>
                  {selectedPass.teamName && (
                    <div>
                      <span style={{ color: 'var(--text-dim)', fontSize: '11px', display: 'block' }}>Team Participation</span>
                      <b style={{ color: 'var(--brand-primary)' }}>{selectedPass.teamName} {selectedPass.isTeamLeader ? '(Leader)' : '(Member)'}</b>
                    </div>
                  )}
                  <div>
                    <span style={{ color: 'var(--text-dim)', fontSize: '11px', display: 'block' }}>Event Date & Time</span>
                    <span style={{ color: 'var(--text-main)' }}>{selectedPass.event?.dateTime ? new Date(selectedPass.event.dateTime).toLocaleString() : 'TBA'}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-dim)', fontSize: '11px', display: 'block' }}>Venue / Location</span>
                    <span style={{ color: 'var(--text-main)' }}>{selectedPass.event?.venue || selectedPass.event?.location || 'Campus Auditorium'}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-dim)', fontSize: '11px', display: 'block' }}>Payment Status</span>
                    <b style={{ color: '#70ddb4' }}>{selectedPass.paymentStatus} {selectedPass.totalAmount > 0 ? `(₹${selectedPass.totalAmount})` : '(Free)'}</b>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-dim)', fontSize: '11px', display: 'block' }}>Gate Attendance Status</span>
                    {selectedPass.attendanceMarked ? (
                      <b style={{ color: '#10b981' }}>CHECKED IN ({selectedPass.attendedAt ? new Date(selectedPass.attendedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Gate'})</b>
                    ) : (
                      <b style={{ color: '#f59e0b' }}>READY FOR ENTRANCE</b>
                    )}
                  </div>
                </div>

                {/* Modal Action Buttons */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  {selectedPass.qrCodeData && (
                    <a
                      href={selectedPass.qrCodeData}
                      download={`event-pass-${selectedPass.event?.title || 'ticket'}.png`}
                      className="primary"
                      style={{
                        flex: 1,
                        height: '42px',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        textDecoration: 'none',
                      }}
                    >
                      <IconDownload size={14} /> DOWNLOAD PASS
                    </a>
                  )}
                  <button
                    type="button"
                    className="outline"
                    onClick={() => window.print()}
                    style={{ flex: 1, height: '42px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    PRINT PASS
                  </button>
                  <button
                    type="button"
                    className="outline"
                    onClick={() => setSelectedPass(null)}
                    style={{ height: '42px', padding: '0 16px', fontSize: '12px' }}
                  >
                    CLOSE
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </LivePortal>
  )
}
