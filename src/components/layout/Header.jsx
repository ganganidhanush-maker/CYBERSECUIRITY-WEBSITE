import React from 'react'
import { usePlatformTheme } from '../../context/PlatformThemeContext'
import { getRoleLabel } from '../../lib/constants'
import { IconBell } from '../icons'

export function Header({ user, title, onProfile, onToggleNav, onOpenNotifications, unreadCount }) {
  const { platformMode } = usePlatformTheme()
  const isMrdu = platformMode === 'MRDU_EVENTS'

  return (
    <header className="header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <button type="button" className="mobile-nav-toggle" onClick={onToggleNav} aria-label="Toggle navigation menu">
          ☰
        </button>
        <div>
          <b>{title || (user.isAdminUser ? getRoleLabel(user.role).toUpperCase() : (isMrdu ? 'MRDU PARTICIPANT PORTAL' : 'STUDENT MEMBER PORTAL'))}</b>
          <small>{isMrdu ? 'MALLA REDDY (DEEMED TO BE UNIVERSITY) · CENTRAL EVENTS' : 'CYBER SECURITY CLUB · MRDU'}</small>
        </div>
      </div>
      <div className="header-tools" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* In-App Notifications Bell */}
        <button
          type="button"
          className="notification-bell-btn"
          onClick={onOpenNotifications}
          aria-label="View notifications"
          title="Notifications & Updates"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <IconBell size={16} />
          {unreadCount > 0 && <span className="notification-badge-count">{unreadCount}</span>}
        </button>

        {/* Profile Pill */}
        {onProfile && (
          <button
            type="button"
            className="profile profile-button"
            onClick={onProfile}
            aria-label="Open profile"
            style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-input)', padding: '5px 12px', borderRadius: '8px', border: '1px solid var(--line)', cursor: 'pointer' }}
          >
            {user.profile?.profileImage ? (
              <img
                src={user.profile.profileImage}
                alt={user.name}
                style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--brand-border-subtle)' }}
              />
            ) : (
              <span style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'var(--brand-gradient)', display: 'grid', placeItems: 'center', color: 'var(--brand-text)', font: '700 11px Syne' }}>
                {user.initials}
              </span>
            )}
            <div style={{ textAlign: 'left' }}>
              <b style={{ color: 'var(--text-main)', fontSize: '11px', display: 'block' }}>{user.name}</b>
              <small style={{ color: 'var(--brand-eyebrow)', font: '500 9px "DM Mono", monospace', display: 'block' }}>
                {user.isPrimaryAdmin ? 'Primary President' : `${getRoleLabel(user.role)} · ${user.memberId}`}
              </small>
            </div>
          </button>
        )}
      </div>
    </header>
  )
}
