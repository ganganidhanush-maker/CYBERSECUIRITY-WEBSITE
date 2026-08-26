import React from 'react'
import { usePlatformTheme } from '../../context/PlatformThemeContext'
import { Crest } from '../common/Crest'
import { Icon8 } from '../icons'

export function Sidebar({ user, logout, activeTab, onNavigate, isOpen, onClose }) {
  const { platformMode, reelsEnabled, subEnabled } = usePlatformTheme()
  const isMrdu = platformMode === 'MRDU_EVENTS'
  const perms = user.permissions || []
  const has = perm => user.isPrimaryAdmin || perms.includes(perm)

  const navItems = user.isAdminUser
    ? [
        [<Icon8 name="protect" size={17} />, isMrdu ? 'Portal Home' : 'Dashboard', 'admin-dashboard', true],
        [<Icon8 name="faceId" size={17} />, 'QR Entry Gate', 'admin-qr-scanner', has('EVENTS_VIEW') || has('EVENT_MANAGE') || user.isAdminUser],
        [<Icon8 name="idDocs" size={17} />, isMrdu ? 'Participants' : 'Members', 'admin-members', has('ACCOUNT_MANAGEMENT') || user.isPrimaryAdmin || ['PRESIDENT', 'VICE_PRESIDENT', 'ADMIN', 'SECRETARY'].includes(user.role)],
        [<Icon8 name="realtime" size={17} />, 'Event Studio', 'admin-events', has('EVENTS_VIEW') || has('EVENT_MANAGE')],
        [<Icon8 name="access" size={17} />, isMrdu ? 'Pass Subscriptions' : 'Subscriptions', 'admin-subscriptions', has('PAYMENTS_VIEW') || user.role === 'TREASURER' || user.role === 'PRESIDENT'],
        [<Icon8 name="authentication" size={17} />, isMrdu ? 'Passes & Payments' : 'Passes & Check-in', 'admin-passes', has('PAYMENTS_VIEW') || has('EVENTS_VIEW') || user.isAdminUser],
        [<Icon8 name="captcha" size={17} />, 'Helpdesk & Doubts', 'admin-support', true],
        [<Icon8 name="protect" size={17} />, 'Council Room', 'admin-chat', true],
        [<Icon8 name="irisScan" size={17} />, isMrdu ? 'Event Gallery' : 'Gallery', 'admin-gallery', has('GALLERY_VIEW') || has('GALLERY_MANAGE')],
        [<Icon8 name="realtime" size={17} />, isMrdu ? 'MRDU Reels Studio' : 'Reels Studio', 'admin-reels', has('REELS_MANAGE') || has('GALLERY_MANAGE') || user.isPrimaryAdmin || ['PRESIDENT', 'VICE_PRESIDENT', 'PR_TEAM', 'EVENT_MANAGEMENT', 'MEDIA_LEAD', 'SOCIAL_MEDIA_LEAD', 'ADMIN'].includes(user.role)],
        [<Icon8 name="idDocs" size={17} />, isMrdu ? 'Organizing Team' : 'Team / Leaders', 'admin-team', has('TEAM_MANAGE')],
        [<Icon8 name="keySecurity" size={17} />, 'Settings & Links', 'admin-settings', has('SETTINGS_MANAGE')],
        [<Icon8 name="showPassword" size={17} />, 'Audit Log', 'admin-audit', has('AUDIT_VIEW')],
        [<Icon8 name="fingerprint" size={17} />, 'My Profile', 'admin-profile', true],
        [<Icon8 name="password" size={17} />, 'Security & PIN', 'security', true],
      ].filter(item => item[3])
    : [
        [<Icon8 name="protect" size={17} />, isMrdu ? 'Events Home' : 'Dashboard', 'student-dashboard', true],
        [<Icon8 name="realtime" size={17} />, 'Events Catalog', 'student-events', true],
        [<Icon8 name="faceId" size={17} />, isMrdu ? 'My Event Passes' : 'My Passes', 'student-passes', true],
        [<Icon8 name="realtime" size={17} />, isMrdu ? 'MRDU Reels' : 'Campus Reels', 'student-reels', reelsEnabled],
        [<Icon8 name="access" size={17} />, isMrdu ? 'Student Pass' : 'Membership', 'student-membership', subEnabled],
        [<Icon8 name="captcha" size={17} />, 'Helpdesk & Doubts', 'student-support', true],
        [<Icon8 name="idDocs" size={17} />, isMrdu ? 'Organizing Team' : 'Our Team', 'student-team', true],
        [<Icon8 name="irisScan" size={17} />, isMrdu ? 'Event Gallery' : 'Gallery', 'student-gallery', true],
        [<Icon8 name="fingerprint" size={17} />, 'My Profile', 'student-profile', true],
      ].filter(item => item[3])

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'active' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="side-logo">
          <Crest platformMode={platformMode} small />
          <div>
            <strong>{isMrdu ? 'MRDU' : 'CSC'}</strong>
            <small>{isMrdu ? 'EVENTS' : 'MRDU'}</small>
          </div>
        </div>
        <nav>
          {navItems.map(([icon, label, target]) => (
            <button
              key={target}
              type="button"
              className={activeTab === target ? 'active' : ''}
              onClick={() => {
                onNavigate(target)
                if (onClose) onClose()
              }}
            >
              <span className="nav-icon">{icon}</span>
              <span className="nav-label">{label}</span>
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <button type="button" onClick={logout}>
            <span className="nav-icon"><Icon8 name="access" size={16} /></span>
            <span className="nav-label">Sign out</span>
          </button>
          <small>SECURE SESSION · {user.memberId}</small>
        </div>
      </aside>
    </>
  )
}
