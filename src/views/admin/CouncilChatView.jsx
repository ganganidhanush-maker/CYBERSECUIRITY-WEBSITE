import React, { useEffect, useRef, useState } from 'react'
import { IconCrown } from '../../components/icons'
import { LivePortal } from '../../components/layout/LivePortal'
import { adminApi } from '../../lib/api'
import { getRoleLabel } from '../../lib/constants'

export function CouncilChatView({ user, logout, onNavigate }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)

  function loadMessages() {
    adminApi.listCouncilMessages()
      .then(res => setMessages(res.messages || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadMessages()
    const interval = setInterval(loadMessages, 3500)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e) {
    e.preventDefault()
    if (!text.trim() || sending) return
    setSending(true)
    try {
      const res = await adminApi.sendCouncilMessage(text.trim())
      setMessages(c => [...c, res.message])
      setText('')
    } catch (err) {
      alert(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <LivePortal user={user} logout={logout} activeTab="admin-chat" onNavigate={onNavigate} title="COUNCIL ROOM">
      <section className="member-management" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
        <div className="member-heading" style={{ marginBottom: '14px' }}>
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('admin-dashboard')}>
              ← COMMAND CENTER
            </button>
            <p className="eyebrow">RESTRICTED LEADERSHIP CHANNEL</p>
            <h1>Executive Council Room</h1>
            <p>Exclusive internal communications room for club leads, coordinators, and the President.</p>
          </div>
          <span className="president-lock" style={{ background: '#1c182d', color: '#d5baff', borderColor: '#d5baff44' }}>
            LEADS ONLY
          </span>
        </div>

        <article className="account-form-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: '16px' }}>
          {/* Chat Feed */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '6px', marginBottom: '14px' }}>
            {loading ? (
              <p className="directory-state" style={{ margin: 'auto' }}>Loading council communications...</p>
            ) : messages.length === 0 ? (
              <p className="directory-state" style={{ margin: 'auto' }}>No messages yet. Start the council discussion below!</p>
            ) : (
              messages.map(m => {
                const isMe = m.userId === user.id
                const isPresident = m.user?.isPrimaryAdmin || m.user?.role === 'PRESIDENT'
                return (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      gap: '12px',
                      alignSelf: isMe ? 'flex-end' : 'flex-start',
                      maxWidth: '80%',
                      flexDirection: isMe ? 'row-reverse' : 'row',
                    }}
                  >
                    {m.user?.profile?.profileImage ? (
                      <img src={m.user.profile.profileImage} alt={m.user.name} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: isPresident ? '2px solid #ffb74d' : '1px solid #52bbf555', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: isPresident ? '#78350f' : '#1c2e42', color: isPresident ? '#ffd54f' : '#85d7ff', display: 'grid', placeItems: 'center', font: '700 11px Syne', flexShrink: 0 }}>
                        {m.user?.profile?.name?.slice(0, 2).toUpperCase() || m.user?.memberId?.slice(0, 2) || 'CS'}
                      </div>
                    )}
                    <div style={{ background: isMe ? 'var(--brand-badge-bg)' : 'var(--panel-elevated)', border: isPresident ? '1px solid #f59e0b' : isMe ? '1px solid var(--brand-border-subtle)' : '1px solid var(--line)', padding: '10px 14px', borderRadius: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <b style={{ color: isPresident ? '#d97706' : 'var(--brand-primary)', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          {isPresident && <IconCrown size={12} />}
                          {m.user?.profile?.name || m.user?.memberId}
                        </b>
                        <span className="badge" style={{ fontSize: '8px', padding: '1px 5px' }}>
                          {isPresident ? 'PRESIDENT' : getRoleLabel(m.user?.role)}
                        </span>
                        <small style={{ color: 'var(--text-dim)', fontSize: '9px', marginLeft: 'auto' }}>
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </small>
                      </div>
                      <p style={{ color: 'var(--text-main)', fontSize: '12px', margin: 0, lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                        {m.message}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <form onSubmit={handleSend} style={{ display: 'flex', gap: '10px' }}>
            <input
              placeholder={`Send message to Executive Council as ${user.name} (${getRoleLabel(user.role)})...`}
              value={text}
              onChange={e => setText(e.target.value)}
              style={{ flex: 1, height: '44px', padding: '0 16px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)', fontSize: '12px' }}
            />
            <button className="primary" disabled={sending || !text.trim()} style={{ minHeight: '44px', padding: '0 20px' }}>
              {sending ? 'SENDING…' : 'SEND ➔'}
            </button>
          </form>
        </article>
      </section>
    </LivePortal>
  )
}
