import React, { useEffect, useState } from 'react'
import { IconCrown, IconDownload } from '../../components/icons'
import { LivePortal } from '../../components/layout/LivePortal'
import { adminApi, memberApi } from '../../lib/api'
import { getRoleLabel } from '../../lib/constants'
import { downloadCsv } from '../../lib/export-csv'

export function SupportDeskView({ user, logout, onNavigate }) {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [submittingReply, setSubmittingReply] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTaggedRole, setNewTaggedRole] = useState('PRESIDENT')
  const [newSubject, setNewSubject] = useState('')
  const [newMessage, setNewMessage] = useState('')
  const [submittingTicket, setSubmittingTicket] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const isStudent = user.role === 'STUDENT'
  const isPresident = user.isPrimaryAdmin || user.role === 'PRESIDENT'

  function loadTickets() {
    setLoading(true)
    const apiCall = isStudent ? memberApi.listSupportTickets() : adminApi.listSupportTickets()
    apiCall
      .then(res => setTickets(res.tickets || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadTickets()
  }, [])

  async function handleCreateTicket(e) {
    e.preventDefault()
    setSubmittingTicket(true)
    setError('')
    setMessage('')
    try {
      const res = await memberApi.createSupportTicket({
        taggedRole: newTaggedRole,
        subject: newSubject,
        message: newMessage,
      })
      setTickets(c => [res.ticket, ...c])
      setShowCreateModal(false)
      setNewSubject('')
      setNewMessage('')
      setMessage(`Doubt submitted for @${newTaggedRole}. Leadership will respond shortly.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmittingTicket(false)
    }
  }

  async function handleSendReply(e) {
    e.preventDefault()
    if (!selectedTicket || !replyText.trim()) return
    setSubmittingReply(true)
    setError('')
    try {
      const apiCall = isStudent
        ? memberApi.replySupportTicket(selectedTicket.id, replyText)
        : adminApi.replySupportTicket(selectedTicket.id, replyText)

      const res = await apiCall
      const updatedTicket = {
        ...selectedTicket,
        status: res.status || selectedTicket.status,
        replies: [...(selectedTicket.replies || []), res.reply],
      }
      setSelectedTicket(updatedTicket)
      setTickets(c => c.map(t => (t.id === selectedTicket.id ? updatedTicket : t)))
      setReplyText('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmittingReply(false)
    }
  }

  async function handleToggleStatus(ticket, newStatus) {
    try {
      await adminApi.updateSupportTicketStatus(ticket.id, newStatus)
      const updated = { ...ticket, status: newStatus }
      setSelectedTicket(s => (s?.id === ticket.id ? updated : s))
      setTickets(c => c.map(t => (t.id === ticket.id ? updated : t)))
    } catch (err) {
      setError(err.message)
    }
  }

  // Permission to reply: Student can reply to own ticket; Admin can reply ONLY if President or matching taggedRole
  const canReply = isStudent
    ? selectedTicket?.userId === user.id
    : isPresident || user.role === selectedTicket?.taggedRole

  function handleDownloadSupportCsv() {
    const headers = [
      'Ticket ID',
      'Created Date',
      'Student Name',
      'Member ID',
      'Tagged Role',
      'Subject / Topic',
      'Status',
      'Initial Message',
      'Replies Count',
    ]
    const rows = tickets.map(t => [
      t.id,
      t.createdAt ? new Date(t.createdAt).toLocaleString() : null,
      t.user?.profile?.name || t.user?.name,
      t.user?.memberId,
      getRoleLabel(t.taggedRole),
      t.subject,
      t.status,
      t.message,
      t.replies?.length || 0,
    ])
    downloadCsv('support_inquiries_report.csv', headers, rows)
  }

  return (
    <LivePortal user={user} logout={logout} activeTab={isStudent ? 'student-support' : 'admin-support'} onNavigate={onNavigate} title="HELPDESK & DOUBTS">
      <section className="member-management">
        <div className="member-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate(isStudent ? 'student-dashboard' : 'admin-dashboard')}>
              ← COMMAND CENTER
            </button>
            <p className="eyebrow">COMMUNITY SERVICE & QUERIES</p>
            <h1>Student Helpdesk & Query Desk</h1>
            <p>Direct question & answer channel between student members and specialized club council leads.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {!isStudent && (
              <button
                type="button"
                className="outline"
                onClick={handleDownloadSupportCsv}
                disabled={tickets.length === 0}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '6px 12px' }}
                title="Download support inquiries as CSV"
              >
                <IconDownload size={14} /> DOWNLOAD QUERIES CSV
              </button>
            )}
            {isStudent && (
              <button className="primary" type="button" onClick={() => setShowCreateModal(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '14px', lineHeight: 1 }}>+</span> ASK A DOUBT / QUERY
              </button>
            )}
          </div>
        </div>

        {message && <p className="member-form-success">{message}</p>}
        {error && <p className="member-form-error">{error}</p>}

        <div className="member-management-grid">
          {/* Tickets List */}
          <article className="member-list-card">
            <div className="card-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <p className="eyebrow">INQUIRY QUEUE</p>
                <h2>{isStudent ? 'My Support Queries' : isPresident ? 'All Student Inquiries' : `@${user.role} Inquiries`} ({tickets.length})</h2>
              </div>
            </div>

            {loading ? (
              <p className="directory-state">Loading support inquiries...</p>
            ) : tickets.length === 0 ? (
              <p className="directory-state">No inquiries recorded. {isStudent ? 'Have a doubt? Click "Ask a Doubt" above.' : 'No doubts pending for your role.'}</p>
            ) : (
              <div className="ticket-list" style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {tickets.map(t => {
                  const isSelected = selectedTicket?.id === t.id
                  return (
                    <div
                      key={t.id}
                      className={`ticket-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedTicket(t)}
                      style={{
                        padding: '14px',
                        borderRadius: '10px',
                        background: isSelected ? 'var(--brand-badge-bg)' : 'var(--panel-subtle)',
                        border: isSelected ? '1px solid var(--brand-primary)' : '1px solid var(--line)',
                        cursor: 'pointer',
                        transition: 'border-color 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div>
                          <span className="badge" style={{ background: 'var(--brand-badge-bg)', color: 'var(--brand-badge-color)', border: '1px solid var(--brand-border-subtle)', fontSize: '9px', marginRight: '6px' }}>
                            @{t.taggedRole}
                          </span>
                          <span className={`badge badge-${t.status.toLowerCase()}`}>
                            {t.status}
                          </span>
                        </div>
                        <small style={{ color: 'var(--text-dim)', font: '500 9px "DM Mono", monospace' }}>
                          {new Date(t.createdAt).toLocaleDateString()}
                        </small>
                      </div>
                      <h4 style={{ margin: '8px 0 4px', font: '700 14px Syne', color: 'var(--text-main)' }}>{t.subject}</h4>
                      <p style={{ color: 'var(--text-muted)', fontSize: '11px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.message}
                      </p>
                      <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <small style={{ color: 'var(--text-dim)' }}>From: {t.user?.profile?.name || t.user?.memberId}</small>
                        <small style={{ color: 'var(--brand-primary)' }}>{t.replies?.length || 0} replies →</small>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </article>

          {/* Ticket Conversation Thread */}
          <article className="account-form-card" style={{ display: 'flex', flexDirection: 'column', minHeight: '480px' }}>
            {selectedTicket ? (
              <>
                <div style={{ borderBottom: '1px solid var(--line)', paddingBottom: '14px', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                    <div>
                      <span className="badge" style={{ background: 'var(--brand-badge-bg)', color: 'var(--brand-badge-color)', border: '1px solid var(--brand-border-subtle)', fontSize: '10px', marginRight: '8px' }}>
                        TAGGED: @{selectedTicket.taggedRole}
                      </span>
                      <span className={`badge badge-${selectedTicket.status.toLowerCase()}`}>
                        {selectedTicket.status}
                      </span>
                      <h3 style={{ margin: '8px 0 4px', font: '700 18px Syne', color: 'var(--text-main)' }}>{selectedTicket.subject}</h3>
                      <small style={{ color: 'var(--text-dim)' }}>
                        Asked by: <b style={{ color: 'var(--brand-primary)' }}>{selectedTicket.user?.profile?.name || selectedTicket.user?.memberId}</b> on {new Date(selectedTicket.createdAt).toLocaleString()}
                      </small>
                    </div>
                    {!isStudent && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {selectedTicket.status !== 'RESOLVED' ? (
                          <button type="button" className="action-btn save-btn" onClick={() => handleToggleStatus(selectedTicket, 'RESOLVED')}>
                            Mark Resolved
                          </button>
                        ) : (
                          <button type="button" className="action-btn cancel-btn" onClick={() => handleToggleStatus(selectedTicket, 'OPEN')}>
                            Re-Open
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <p style={{ color: 'var(--text-main)', fontSize: '13px', lineHeight: '1.6', margin: '12px 0 0', padding: '12px', background: 'var(--panel-subtle)', borderRadius: '8px', border: '1px solid var(--line)' }}>
                    {selectedTicket.message}
                  </p>
                </div>

                {/* Conversation Chat Bubbles */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px', marginBottom: '14px' }}>
                  {(!selectedTicket.replies || selectedTicket.replies.length === 0) ? (
                    <p className="directory-state" style={{ margin: 'auto' }}>No responses yet. Awaiting leader response.</p>
                  ) : (
                    selectedTicket.replies.map(r => {
                      const isMe = r.userId === user.id
                      const replierRole = r.user?.role
                      const isReplierPresident = r.user?.isPrimaryAdmin || replierRole === 'PRESIDENT'
                      return (
                        <div
                          key={r.id}
                          style={{
                            alignSelf: isMe ? 'flex-end' : 'flex-start',
                            maxWidth: '85%',
                            padding: '12px 16px',
                            borderRadius: '12px',
                            background: isMe ? 'var(--brand-badge-bg)' : 'var(--panel-elevated)',
                            border: isReplierPresident ? '1px solid #f59e0b' : isMe ? '1px solid var(--brand-border-subtle)' : '1px solid var(--line)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <b style={{ color: isReplierPresident ? '#d97706' : 'var(--brand-primary)', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              {isReplierPresident && <IconCrown size={12} />}
                              {r.user?.profile?.name || r.user?.name || r.user?.memberId}
                            </b>
                            <span className="badge" style={{ fontSize: '8px', padding: '2px 6px' }}>
                              {isReplierPresident ? 'PRESIDENT' : getRoleLabel(replierRole)}
                            </span>
                            <small style={{ color: 'var(--text-dim)', fontSize: '9px', marginLeft: 'auto' }}>
                              {new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </small>
                          </div>
                          <p style={{ color: 'var(--text-main)', fontSize: '12px', margin: 0, lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                            {r.message}
                          </p>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Reply Box */}
                {canReply ? (
                  <form onSubmit={handleSendReply} style={{ display: 'flex', gap: '10px' }}>
                    <input
                      placeholder={`Type response as ${user.name} (${getRoleLabel(user.role)})...`}
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      style={{ flex: 1, height: '42px', padding: '0 14px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)', fontSize: '12px' }}
                    />
                    <button className="primary" disabled={submittingReply || !replyText.trim()} style={{ minHeight: '42px', padding: '0 18px' }}>
                      {submittingReply ? 'SENDING…' : 'REPLY →'}
                    </button>
                  </form>
                ) : (
                  <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', fontSize: '11px', textAlign: 'center' }}>
                    Role Restriction: Only members of <b>@{selectedTicket.taggedRole}</b> or the President are authorized to reply to this query.
                  </div>
                )}
              </>
            ) : (
              <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)' }}>
                <p>Select any doubt inquiry from the left to view the thread and respond.</p>
              </div>
            )}
          </article>
        </div>

        {/* Ask a Doubt Modal (Student) */}
        {showCreateModal && (
          <div className="photo-lightbox" onClick={() => setShowCreateModal(false)}>
            <div className="photo-lightbox-content" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-modal)', padding: '28px', borderRadius: '14px', border: '1px solid var(--line)', maxWidth: '520px', width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: 0, font: '700 20px Syne', color: 'var(--text-main)' }}>Ask a Doubt / Query</h3>
                  <small style={{ color: 'var(--text-muted)' }}>Tag a specific club leadership council team</small>
                </div>
                <button className="lightbox-close" onClick={() => setShowCreateModal(false)} style={{ position: 'static' }}>✕</button>
              </div>

              <form onSubmit={handleCreateTicket}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Tag Club Council Role *
                  <select
                    className="member-select"
                    value={newTaggedRole}
                    onChange={e => setNewTaggedRole(e.target.value)}
                    style={{ marginBottom: '14px' }}
                  >
                    <option value="PRESIDENT">@PRESIDENT (Executive Leadership)</option>
                    <option value="VICE_PRESIDENT">@VICE_PRESIDENT (Operations)</option>
                    <option value="TECH_TEAM">@TECH_TEAM (Labs, CTF, Hacking Tools)</option>
                    <option value="EVENT_MANAGEMENT">@EVENT_MANAGEMENT (Passes, Workshops)</option>
                    <option value="TREASURER">@TREASURER (Payments & Membership)</option>
                    <option value="MEDIA_LEAD">@MEDIA_LEAD (Gallery & Creative)</option>
                    <option value="PR_TEAM">@PR_TEAM (Outreach & Communication)</option>
                    <option value="CULTURAL">@CULTURAL (Events & Festivities)</option>
                    <option value="SECRETARY">@SECRETARY (Documentation & Notices)</option>
                  </select>
                </label>

                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Subject / Question Topic *
                  <input
                    required
                    placeholder="e.g. Query regarding upcoming Wireshark lab requirements"
                    value={newSubject}
                    onChange={e => setNewSubject(e.target.value)}
                    style={{ width: '100%', height: '40px', padding: '0 12px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', marginBottom: '14px' }}
                  />
                </label>

                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Description / Details *
                  <textarea
                    required
                    placeholder="Explain your doubt in detail..."
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    style={{ width: '100%', height: '90px', padding: '10px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', marginBottom: '16px', resize: 'none' }}
                  />
                </label>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" className="action-btn cancel-btn" onClick={() => setShowCreateModal(false)}>Cancel</button>
                  <button type="submit" className="primary" disabled={submittingTicket}>
                    {submittingTicket ? 'SUBMITTING…' : 'SUBMIT DOUBT INQUIRY'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </section>
    </LivePortal>
  )
}
