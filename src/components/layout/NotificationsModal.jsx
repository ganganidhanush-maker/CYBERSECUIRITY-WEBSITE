import React, { useEffect, useState } from 'react'
import { memberApi } from '../../lib/api'
import { formatDate } from '../../lib/formatters'
import { Icon8 } from '../icons'

export function NotificationsModal({ isOpen, onClose, onNavigate }) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    memberApi.listNotifications()
      .then(res => setNotifications(res.notifications || []))
      .finally(() => setLoading(false))
  }, [isOpen])

  async function handleMarkAll() {
    await memberApi.markAllNotificationsRead()
    setNotifications(c => c.map(n => ({ ...n, isRead: true })))
  }

  async function handleClickNotification(n) {
    if (!n.isRead) {
      await memberApi.markNotificationRead(n.id)
    }
    onClose()
    if (n.linkUrl) {
      const cleanPath = n.linkUrl.replace(/^\//, '')
      onNavigate(cleanPath)
    }
  }

  if (!isOpen) return null

  return (
    <div className="photo-lightbox" onClick={onClose}>
      <div className="photo-lightbox-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', width: '100%', background: 'var(--bg-modal)', padding: '24px', borderRadius: '14px', border: '1px solid var(--line)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)', paddingBottom: '12px', marginBottom: '14px' }}>
          <div>
            <h3 style={{ margin: 0, font: '700 18px Syne', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon8 name="idDocs" size={16} /> Notifications & Alerts
            </h3>
            <small style={{ color: 'var(--text-muted)' }}>Updates on events, subscriptions, and support replies</small>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button type="button" className="action-btn edit-btn" onClick={handleMarkAll} style={{ fontSize: '10px' }}>Mark all read</button>
            <button className="lightbox-close" onClick={onClose} style={{ position: 'static' }}>✕</button>
          </div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
          {loading ? (
            <p className="directory-state">Loading messages...</p>
          ) : notifications.length === 0 ? (
            <p className="directory-state">No notifications recorded yet.</p>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                className={`notification-item ${n.isRead ? 'read' : 'unread'}`}
                onClick={() => handleClickNotification(n)}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  marginBottom: '8px',
                  background: n.isRead ? 'var(--bg-input)' : 'var(--brand-badge-bg)',
                  border: n.isRead ? '1px solid var(--line)' : '1px solid var(--brand-border-subtle)',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <b style={{ color: n.isRead ? 'var(--text-main)' : 'var(--brand-primary)', fontSize: '12px' }}>{n.title}</b>
                  <small style={{ color: 'var(--text-dim)', fontSize: '9px', font: '500 "DM Mono", monospace' }}>
                    {formatDate(n.createdAt)}
                  </small>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '11px', margin: '4px 0 0', lineHeight: '1.5' }}>{n.message}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
