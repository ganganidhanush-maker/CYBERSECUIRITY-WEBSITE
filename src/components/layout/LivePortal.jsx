import React, { useEffect, useState } from 'react'
import { memberApi } from '../../lib/api'
import { Header } from './Header'
import { NotificationsModal } from './NotificationsModal'
import { Sidebar } from './Sidebar'

export function LivePortal({ user, logout, activeTab, onNavigate, title, onUserUpdated, children }) {
  const [navOpen, setNavOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    let mounted = true
    memberApi.listNotifications()
      .then(res => { if (mounted) setUnreadCount(res.unreadCount || 0) })
      .catch(() => {})
    return () => { mounted = false }
  }, [activeTab])

  return (
    <main className="portal">
      <Sidebar
        user={user}
        logout={logout}
        activeTab={activeTab}
        onNavigate={onNavigate}
        isOpen={navOpen}
        onClose={() => setNavOpen(false)}
      />
      <div className="workspace">
        <Header
          user={user}
          title={title}
          onProfile={() => onNavigate(user.isAdminUser ? 'admin-profile' : 'student-profile')}
          onToggleNav={() => setNavOpen(o => !o)}
          onOpenNotifications={() => setNotifOpen(true)}
          unreadCount={unreadCount}
        />
        <div className="dashboard">{children}</div>
      </div>

      <NotificationsModal
        isOpen={notifOpen}
        onClose={() => {
          setNotifOpen(false)
          memberApi.listNotifications().then(res => setUnreadCount(res.unreadCount || 0)).catch(() => {})
        }}
        onNavigate={onNavigate}
      />
    </main>
  )
}
