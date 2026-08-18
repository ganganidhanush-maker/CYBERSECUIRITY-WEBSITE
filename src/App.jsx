import { useEffect, useRef, useState } from 'react'
import clubLogo from './assets/branding/cyber-security-club-logo.jpeg'
import { adminApi, authApi, memberApi, readImageFile, readMultipleImageFiles } from './lib/api'
import { getYouTubeEmbedUrl, parseYouTubeVideoId } from './lib/video'
import './App.css'

/* oxlint-disable no-unused-vars */

const CLUB_ROLES = [
  { id: 'STUDENT', label: 'Student Member', roleType: 'student' },
  { id: 'PRESIDENT', label: 'President', roleType: 'admin' },
  { id: 'VICE_PRESIDENT', label: 'Vice President', roleType: 'admin' },
  { id: 'TREASURER', label: 'Treasurer', roleType: 'admin' },
  { id: 'EVENT_MANAGEMENT', label: 'Event Management', roleType: 'admin' },
  { id: 'MEDIA_LEAD', label: 'Media Lead', roleType: 'admin' },
  { id: 'TECH_TEAM', label: 'Tech Team', roleType: 'admin' },
  { id: 'PR_TEAM', label: 'PR Team', roleType: 'admin' },
  { id: 'CULTURAL', label: 'Cultural', roleType: 'admin' },
  { id: 'SECRETARY', label: 'Secretary', roleType: 'admin' },
]

function getRoleLabel(roleId) {
  const r = CLUB_ROLES.find(item => item.id === roleId)
  return r ? r.label : roleId
}

function Crest({ small = false }) {
  return (
    <div className={`crest official-crest ${small ? 'small' : ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: small ? '10px' : '16px' }}>
      <img
        className="brand-logo"
        src={clubLogo}
        alt="Cyber Security Club official emblem"
        style={{
          width: small ? 38 : 78,
          height: small ? 38 : 78,
          objectFit: 'contain',
          borderRadius: small ? 8 : 12,
          boxShadow: '0 0 16px rgba(61, 165, 255, .2)',
        }}
      />
      {!small && (
        <div className="wordmark">
          <span style={{ font: '600 15px Syne', letterSpacing: '.08em' }}>CYBER SECURITY</span>
          <strong style={{ font: '800 26px Syne', letterSpacing: '.14em', color: '#edf7ff' }}>CLUB</strong>
          <small style={{ color: '#7fb9df', font: '500 9px "DM Mono", monospace', letterSpacing: '.08em', marginTop: '4px' }}>
            MRDU · DEPARTMENT OF CYBER SECURITY
          </small>
        </div>
      )}
    </div>
  )
}

function toPortalUser(user) {
  const isStudentRole = user.role === 'STUDENT'
  const name = user.profile?.name || user.name || 'Member'
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || 'CS'
  return {
    id: user.id,
    role: user.role,
    isPrimaryAdmin: Boolean(user.isPrimaryAdmin),
    isAdminUser: !isStudentRole,
    name,
    initials,
    memberId: user.memberId,
    permissions: user.permissions || [],
    twoFactorEnabled: user.twoFactorEnabled || false,
    profile: user.profile || {},
  }
}

// ----------------------------------------------------
// Intro Video Experience (YouTube API Sync & Fallback Briefing)
// ----------------------------------------------------
function IntroVideoExperience({ onComplete }) {
  const [videoUrl, setVideoUrl] = useState('')
  const [requireTwoMinutes, setRequireTwoMinutes] = useState(false)
  const [secondsWatched, setSecondsWatched] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [useFallback, setUseFallback] = useState(false)
  const [playerReady, setPlayerReady] = useState(false)
  const [canProceed, setCanProceed] = useState(false)
  const [fallbackSlide, setFallbackSlide] = useState(0)
  const playerRef = useRef(null)

  useEffect(() => {
    let mounted = true
    memberApi.getPublicClubSettings()
      .then(({ settings }) => {
        if (!mounted) return
        if (settings?.introVideoUrl) {
          setVideoUrl(settings.introVideoUrl)
        }
        setRequireTwoMinutes(settings?.introVideoRequireTwoMinutes === true || settings?.introVideoRequireTwoMinutes === 'true')
      })
      .catch(() => {})
    return () => { mounted = false }
  }, [])

  const requiredDuration = requireTwoMinutes ? 120 : 5
  const youtubeId = parseYouTubeVideoId(videoUrl)

  useEffect(() => {
    if (!youtubeId || useFallback) return
    let mounted = true

    function initPlayer() {
      if (!window.YT || !window.YT.Player) return
      try {
        playerRef.current = new window.YT.Player('youtube-player-container', {
          videoId: youtubeId,
          playerVars: {
            autoplay: 1,
            controls: 1,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              if (mounted) setPlayerReady(true)
            },
            onStateChange: event => {
              if (event.data === 1) {
                if (mounted) setIsPlaying(true)
              } else {
                if (mounted) setIsPlaying(false)
                if (event.data === 0) {
                  if (mounted) setCanProceed(true)
                }
              }
            },
            onError: () => {
              if (mounted) {
                setUseFallback(true)
                setIsPlaying(true)
              }
            },
          },
        })
      } catch {
        if (mounted) {
          setUseFallback(true)
          setIsPlaying(true)
        }
      }
    }

    if (!window.YT) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      window.onYouTubeIframeAPIReady = () => initPlayer()
      document.body.appendChild(tag)
    } else {
      initPlayer()
    }

    const readyTimeout = setTimeout(() => {
      if (mounted && !playerReady && !useFallback) {
        setUseFallback(true)
        setIsPlaying(true)
      }
    }, 7000)

    return () => {
      mounted = false
      clearTimeout(readyTimeout)
      try { playerRef.current?.destroy?.() } catch {}
    }
  }, [youtubeId, useFallback])

  useEffect(() => {
    if (!isPlaying) return
    const interval = setInterval(() => {
      setSecondsWatched(prev => {
        const next = prev + 1
        if (next >= requiredDuration) {
          setCanProceed(true)
        }
        return next
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [isPlaying, requiredDuration])

  useEffect(() => {
    if (!useFallback || !isPlaying) return
    const slideTimer = setInterval(() => {
      setFallbackSlide(s => (s + 1) % 4)
    }, 5000)
    return () => clearInterval(slideTimer)
  }, [useFallback, isPlaying])

  async function handleFinish() {
    try {
      await memberApi.completeIntroVideo()
    } catch {}
    onComplete()
  }

  const slides = [
    { title: 'Cyber Security Club Core Mission', text: 'Empowering students with hands-on ethical hacking labs, defense simulations, and practical cyber intelligence.' },
    { title: 'Club Ethics & Code of Conduct', text: 'All tools, frameworks, and lab environments must be used responsibly and strictly within authorized academic sandboxes.' },
    { title: 'Event Passes & QR Attendance', text: 'Registered members receive cryptographic QR event passes for attendance, activity slots, and certificate issuance.' },
    { title: 'Community Support & Team', text: 'Reach out to our Tech Support team and leadership council anytime for queries, workshops, or club activities.' },
  ]

  return (
    <div className="intro-video-overlay">
      <div className="intro-video-container">
        <div className="intro-video-header">
          <b>CYBER SECURITY CLUB · MANDATORY COMMUNITY BRIEFING</b>
          <span>
            {canProceed
              ? '✓ BRIEFING REQUIREMENT MET'
              : `WATCHED: ${Math.floor(secondsWatched / 60)}:${String(secondsWatched % 60).padStart(2, '0')} / ${Math.floor(requiredDuration / 60)}:${String(requiredDuration % 60).padStart(2, '0')}`}
          </span>
        </div>

        <div style={{ position: 'relative', background: '#000', aspectRatio: '16/9', overflow: 'hidden' }}>
          {!useFallback && youtubeId ? (
            <div id="youtube-player-container" style={{ width: '100%', height: '100%' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '28px', textAlign: 'center', background: 'radial-gradient(circle at center, #132a42 0%, #070d16 80%)' }}>
              <Crest small />
              <div style={{ marginTop: '16px', maxWidth: '600px' }}>
                <span className="badge badge-president" style={{ marginBottom: '10px' }}>OFFICIAL CLUB BRIEFING</span>
                <h2 style={{ font: '700 24px Syne', color: '#edf7ff', margin: '8px 0 10px' }}>
                  {slides[fallbackSlide].title}
                </h2>
                <p style={{ color: '#9bb7cc', fontSize: '13px', lineHeight: '1.6', margin: '0 0 20px' }}>
                  {slides[fallbackSlide].text}
                </p>
                {useFallback && (
                  <div style={{ padding: '8px 12px', borderRadius: '6px', background: '#1c2c3d', border: '1px solid #52bbf544', color: '#85d7ff', font: '500 11px "DM Mono", monospace' }}>
                    ℹ The selected video could not be loaded. A default club briefing is being played instead.{requireTwoMinutes ? ' The 2-minute viewing requirement still applies.' : ''}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '16px 20px', background: '#050a11', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ color: '#829bb0', fontSize: '11px', font: '500 10px "DM Mono", monospace' }}>
            {!canProceed ? (
              <span>🔒 5-second mandatory delay active ({Math.max(0, requiredDuration - secondsWatched)}s remaining)</span>
            ) : (
              <span style={{ color: '#70ddb4' }}>✓ You have completed the mandatory briefing requirement.</span>
            )}
          </div>
          <button
            className="primary"
            type="button"
            disabled={!canProceed}
            onClick={handleFinish}
            style={{ padding: '0 20px', minHeight: '40px' }}
          >
            CONTINUE TO PORTAL →
          </button>
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------------------
// Concurrent Waiting Queue
// ----------------------------------------------------
function ConcurrentWaitingQueue({ onComplete }) {
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          memberApi.completeWaitingQueue().finally(() => onComplete())
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [onComplete])

  return (
    <div className="queue-overlay">
      <div className="queue-card">
        <Crest small />
        <h2 style={{ font: '700 22px Syne', color: '#edf7ff', margin: '16px 0 6px' }}>High Member Activity</h2>
        <p style={{ color: '#8aa2b4', fontSize: '12px', lineHeight: '1.6' }}>
          More than 20 students are actively connected. Allocating secure session slot...
        </p>
        <div className="queue-timer">{countdown}</div>
        <small style={{ color: '#6f8da1', font: '500 10px "DM Mono", monospace' }}>ENTERING AUTOMATICALLY...</small>
      </div>
    </div>
  )
}

// ----------------------------------------------------
// Hibernation Mode Screen (Dedicated Sleep Mode with Live Timer)
// ----------------------------------------------------
function HibernationScreen({ onAdminLogin }) {
  const [startedAt, setStartedAt] = useState(null)
  const [elapsed, setElapsed] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    let mounted = true
    memberApi.getPublicClubSettings()
      .then(({ settings }) => {
        if (mounted && settings?.hibernationStartedAt) {
          setStartedAt(new Date(settings.hibernationStartedAt))
        }
      })
      .catch(() => {})
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    function calculateElapsed() {
      const start = startedAt ? new Date(startedAt).getTime() : Date.now()
      const diff = Math.max(0, Date.now() - start)

      const seconds = Math.floor((diff / 1000) % 60)
      const minutes = Math.floor((diff / (1000 * 60)) % 60)
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))

      setElapsed({ days, hours, minutes, seconds })
    }

    calculateElapsed()
    const timer = setInterval(calculateElapsed, 1000)
    return () => clearInterval(timer)
  }, [startedAt])

  return (
    <div className="hibernation-page">
      <div className="grid-overlay" />
      <div className="hibernation-card">
        <Crest />
        <span className="hibernation-badge">💤 SITE STATUS · HIBERNATING</span>
        <h1 className="hibernation-title">PORTAL IN HIBERNATION</h1>
        <p className="hibernation-desc">
          The Cyber Security Club website is temporarily in hibernation mode for scheduled community maintenance.
        </p>

        <div className="hibernation-timer-box">
          <div className="hibernation-timer-label">ELAPSED HIBERNATION DURATION</div>
          <div className="hibernation-timer-grid">
            <div className="timer-block">
              <span className="timer-num">{String(elapsed.days).padStart(2, '0')}</span>
              <span className="timer-unit">DAYS</span>
            </div>
            <div className="timer-block">
              <span className="timer-num">{String(elapsed.hours).padStart(2, '0')}</span>
              <span className="timer-unit">HOURS</span>
            </div>
            <div className="timer-block">
              <span className="timer-num">{String(elapsed.minutes).padStart(2, '0')}</span>
              <span className="timer-unit">MINUTES</span>
            </div>
            <div className="timer-block">
              <span className="timer-num">{String(elapsed.seconds).padStart(2, '0')}</span>
              <span className="timer-unit">SECONDS</span>
            </div>
          </div>
        </div>

        <button type="button" className="hibernation-admin-btn" onClick={onAdminLogin}>
          👑 President & Admin Gateway →
        </button>
      </div>
    </div>
  )
}

// ----------------------------------------------------
// Navigation, Header & LivePortal Frame
// ----------------------------------------------------
function Sidebar({ user, logout, activeTab, onNavigate, isOpen, onClose }) {
  const perms = user.permissions || []
  const has = perm => user.isPrimaryAdmin || perms.includes(perm)

  const navItems = user.isAdminUser
    ? [
        ['▦', 'Dashboard', 'admin-dashboard', true],
        ['♙', 'Members', 'admin-members', has('ACCOUNT_MANAGEMENT')],
        ['▢', 'Event Studio', 'admin-events', has('EVENTS_VIEW') || has('EVENT_MANAGE')],
        ['💎', 'Subscriptions', 'admin-subscriptions', has('PAYMENTS_VIEW') || user.role === 'TREASURER' || user.role === 'PRESIDENT'],
        ['💳', 'Event Payments', 'admin-payments', has('PAYMENTS_VIEW')],
        ['💬', 'Helpdesk & Doubts', 'admin-support', true],
        ['🛡️', 'Council Room', 'admin-chat', true],
        ['▧', 'Gallery', 'admin-gallery', has('GALLERY_VIEW') || has('GALLERY_MANAGE')],
        ['👥', 'Team / Leaders', 'admin-team', has('TEAM_MANAGE')],
        ['⚙', 'Settings & Links', 'admin-settings', has('SETTINGS_MANAGE')],
        ['◫', 'Audit Log', 'admin-audit', has('AUDIT_VIEW')],
        ['👤', 'My Profile', 'admin-profile', true],
        ['▣', 'Security', 'security', true],
      ].filter(item => item[3])
    : [
        ['▦', 'Dashboard', 'student-dashboard', true],
        ['▢', 'Events Catalog', 'student-events', true],
        ['▤', 'My Passes', 'student-registrations', true],
        ['💎', 'Membership', 'student-membership', true],
        ['💬', 'Helpdesk & Doubts', 'student-support', true],
        ['👥', 'Our Team', 'student-team', true],
        ['▧', 'Gallery', 'student-gallery', true],
        ['👤', 'My Profile', 'student-profile', true],
        ['▣', 'Security', 'security', true],
      ]

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'active' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="side-logo">
          <Crest small />
          <div>
            <strong>CSC</strong>
            <small>MRDU</small>
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
              <span style={{ fontSize: '15px' }}>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <button type="button" onClick={logout}>
            <span>↪</span>Sign out
          </button>
          <small>SECURE SESSION · {user.memberId}</small>
        </div>
      </aside>
    </>
  )
}

function Header({ user, title, onProfile, onToggleNav, onOpenNotifications, unreadCount }) {
  return (
    <header className="header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <button type="button" className="mobile-nav-toggle" onClick={onToggleNav} aria-label="Toggle navigation menu">
          ☰
        </button>
        <div>
          <b>{title || (user.isAdminUser ? getRoleLabel(user.role).toUpperCase() : 'STUDENT MEMBER PORTAL')}</b>
          <small>CYBER SECURITY CLUB · MRDU</small>
        </div>
      </div>
      <div className="header-tools" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* In-App Notifications Bell */}
        <button
          type="button"
          className="notification-bell-btn"
          onClick={onOpenNotifications}
          aria-label="View notifications"
          title="Notifications & Updates"
        >
          <span style={{ fontSize: '16px' }}>🔔</span>
          {unreadCount > 0 && <span className="notification-badge-count">{unreadCount}</span>}
        </button>

        {/* Profile Pill */}
        {onProfile && (
          <button
            type="button"
            className="profile profile-button"
            onClick={onProfile}
            aria-label="Open profile"
            style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(16, 26, 39, 0.7)', padding: '5px 12px', borderRadius: '8px', border: '1px solid var(--line)', cursor: 'pointer' }}
          >
            {user.profile?.profileImage ? (
              <img
                src={user.profile.profileImage}
                alt={user.name}
                style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'cover', border: '1px solid #52bbf555' }}
              />
            ) : (
              <span style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'linear-gradient(135deg, #2488d8, #18447e)', display: 'grid', placeItems: 'center', color: '#fff', font: '700 11px Syne' }}>
                {user.initials}
              </span>
            )}
            <div style={{ textAlign: 'left' }}>
              <b style={{ color: '#edf7ff', fontSize: '11px', display: 'block' }}>{user.name}</b>
              <small style={{ color: '#7ba2be', font: '500 9px "DM Mono", monospace', display: 'block' }}>
                {user.isPrimaryAdmin ? 'Primary President' : `${getRoleLabel(user.role)} · ${user.memberId}`}
              </small>
            </div>
          </button>
        )}
      </div>
    </header>
  )
}

function NotificationsModal({ isOpen, onClose, onNavigate }) {
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
      <div className="photo-lightbox-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', width: '100%', background: '#0c1522', padding: '24px', borderRadius: '14px', border: '1px solid var(--line)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)', paddingBottom: '12px', marginBottom: '14px' }}>
          <div>
            <h3 style={{ margin: 0, font: '700 18px Syne', color: '#edf7ff' }}>🔔 Notifications & Alerts</h3>
            <small style={{ color: '#7e95a7' }}>Updates on events, subscriptions, and support replies</small>
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
                  background: n.isRead ? '#050a12' : '#101d2c',
                  border: n.isRead ? '1px solid var(--line)' : '1px solid #52bbf555',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <b style={{ color: n.isRead ? '#cbdfe9' : '#85d7ff', fontSize: '12px' }}>{n.title}</b>
                  <small style={{ color: '#688296', fontSize: '9px', font: '500 "DM Mono", monospace' }}>
                    {new Date(n.createdAt).toLocaleDateString()}
                  </small>
                </div>
                <p style={{ color: '#9bb7cc', fontSize: '11px', margin: '4px 0 0', lineHeight: '1.5' }}>{n.message}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function LivePortal({ user, logout, activeTab, onNavigate, title, onUserUpdated, children }) {
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

// ----------------------------------------------------
// Login & Auth Recovery Screens
// ----------------------------------------------------
function FinalLogin({ onSignIn, onForgotPassword }) {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [memberIdVal, setMemberIdVal] = useState('')

  async function submit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const memberId = String(form.get('memberId') || '').trim().toUpperCase()
    const password = String(form.get('password') || '')
    if (!/^[A-Z0-9]{5,32}$/.test(memberId) || password.length < 12) {
      setError('Enter a valid Member ID and password (12+ characters).')
      return
    }
    setError('')
    setLoading(true)
    try {
      await onSignIn(memberId, password)
    } catch (requestError) {
      setError(requestError.message || 'Unable to sign in.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-showcase">
        <div className="grid-overlay" />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#85d7ff', font: '600 10px "DM Mono", monospace', letterSpacing: '.12em', zIndex: 2 }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#70ddb4', boxShadow: '0 0 10px #70ddb4', display: 'inline-block' }} />
          OFFICIAL STUDENT COMMUNITY · MRDU
        </div>

        <div style={{ position: 'relative', zIndex: 2, maxWidth: '560px', margin: '40px 0' }}>
          <Crest />
          <div style={{ marginTop: '28px' }}>
            <p className="eyebrow">DEPARTMENT OF CYBER SECURITY</p>
            <h1 style={{ font: '800 clamp(32px, 4vw, 54px)/1.08 Syne', color: '#edf7ff', margin: '8px 0 16px', letterSpacing: '-.04em' }}>
              Defend the digital frontier.<br />
              <em style={{ color: '#85d7ff', fontStyle: 'normal' }}>Empower tomorrow.</em>
            </h1>
            <p style={{ color: '#9bb7cc', fontSize: '14px', lineHeight: '1.7', margin: 0 }}>
              The official hub for student cybersecurity operations, ethical hacking sandboxes, live CTFs, and certified technical workshops.
            </p>
          </div>
        </div>

        <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', background: 'rgba(5, 10, 18, 0.6)', border: '1px solid rgba(82, 187, 245, 0.2)', borderRadius: '10px', width: 'fit-content' }}>
          <span style={{ color: '#70ddb4', fontSize: '14px' }}>🔒</span>
          <div>
            <b style={{ color: '#edf7ff', fontSize: '11px', display: 'block' }}>CYBER SECURITY CLUB PORTAL</b>
            <small style={{ color: '#728da1', font: '500 9px "DM Mono", monospace' }}>OFFICIAL STUDENT & FACULTY ACCESS · MRDU</small>
          </div>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <Crest small />
            <span className="badge badge-president" style={{ marginTop: '12px', display: 'inline-block' }}>
              SECURE MEMBER ACCESS
            </span>
            <h2 style={{ font: '700 24px Syne', color: '#edf7ff', margin: '10px 0 4px' }}>Sign in to Portal</h2>
            <p style={{ color: '#7e95a7', fontSize: '12px', margin: 0 }}>
              Enter your authorized Member ID and password.
            </p>
          </div>

          <form onSubmit={submit} noValidate>
            <div className="login-field-group">
              <label htmlFor="final-member-id">Member ID</label>
              <div className="login-input-wrapper">
                <span className="login-input-icon">👤</span>
                <input
                  id="final-member-id"
                  name="memberId"
                  required
                  maxLength={32}
                  pattern="[A-Za-z0-9]+"
                  autoComplete="username"
                  placeholder="e.g. CSC2026M01"
                  value={memberIdVal}
                  onChange={e => setMemberIdVal(e.target.value.toUpperCase())}
                />
              </div>
            </div>

            <div className="login-field-group">
              <label htmlFor="final-password">Account Password</label>
              <div className="login-input-wrapper">
                <span className="login-input-icon">🔒</span>
                <input
                  id="final-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="login-pwd-toggle"
                  onClick={() => setShowPassword(p => !p)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid #ef444455', color: '#fca5a5', fontSize: '12px', marginBottom: '16px' }} role="alert">
                ⚠️ {error}
              </div>
            )}

            <button className="primary" disabled={loading} style={{ width: '100%', minHeight: '46px', fontSize: '11px' }}>
              {loading ? 'AUTHENTICATING SECURE SESSION…' : 'AUTHENTICATE & SIGN IN →'}
            </button>
          </form>

          <div className="login-footer-links">
            <button className="back-button" type="button" onClick={onForgotPassword} style={{ margin: 0, fontSize: '11px' }}>
              Forgot password?
            </button>
            <small style={{ color: '#577287', font: '500 9px "DM Mono", monospace' }}>
              MRDU // HYD
            </small>
          </div>
        </div>
      </section>
    </main>
  )
}

function TwoFactorLogin({ onVerify, onBack }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await onVerify(code)
    } catch (requestError) {
      setError(requestError.message || 'Invalid authentication code.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="hibernation-page">
      <div className="grid-overlay" />
      <section className="login-card" style={{ maxWidth: '440px', textAlign: 'center' }}>
        <Crest small />
        <span className="badge badge-president" style={{ margin: '14px 0 8px', display: 'inline-block' }}>
          SECURITY CHALLENGE
        </span>
        <h2 style={{ font: '700 24px Syne', color: '#edf7ff', margin: '4px 0 8px' }}>Security Verification</h2>
        <p style={{ color: '#8aa2b4', fontSize: '13px', margin: '0 0 20px' }}>
          Enter the six-digit verification code from your authenticator app (or President Master PIN).
        </p>

        <form onSubmit={submit}>
          <div className="login-field-group" style={{ textAlign: 'left' }}>
            <label htmlFor="two-factor-code">6-Digit Security Code / PIN</label>
            <div className="login-input-wrapper">
              <span className="login-input-icon">🔑</span>
              <input
                id="two-factor-code"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                required
                style={{ textAlign: 'center', fontSize: '18px', letterSpacing: '0.3em', paddingLeft: '20px' }}
              />
            </div>
          </div>

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid #ef444455', color: '#fca5a5', fontSize: '12px', marginBottom: '16px' }} role="alert">
              ⚠️ {error}
            </div>
          )}

          <button className="primary" disabled={loading || code.length !== 6} style={{ width: '100%', minHeight: '46px' }}>
            {loading ? 'VERIFYING…' : 'VERIFY & CONTINUE →'}
          </button>
        </form>

        <button className="back-button" type="button" onClick={onBack} style={{ marginTop: '20px', display: 'inline-flex' }}>
          ← Back to sign in
        </button>
      </section>
    </main>
  )
}

function PasswordResetRequest({ onBack }) {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event) {
    event.preventDefault()
    const memberId = String(new FormData(event.currentTarget).get('memberId') || '').trim().toUpperCase()
    setError('')
    setLoading(true)
    try {
      const result = await authApi.requestPasswordReset(memberId)
      setMessage(result.message)
    } catch (requestError) {
      setError(requestError.message || 'Unable to request password reset.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="hibernation-page">
      <div className="grid-overlay" />
      <section className="login-card" style={{ maxWidth: '440px' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <Crest small />
          <span className="badge badge-president" style={{ margin: '12px 0 6px', display: 'inline-block' }}>
            PASSWORD RECOVERY
          </span>
          <h2 style={{ font: '700 24px Syne', color: '#edf7ff', margin: '4px 0 6px' }}>Reset Your Password</h2>
          <p style={{ color: '#8aa2b4', fontSize: '12px', margin: 0 }}>
            Enter your Member ID to receive password recovery instructions.
          </p>
        </div>

        <form onSubmit={submit}>
          <div className="login-field-group">
            <label htmlFor="recovery-member-id">Member ID</label>
            <div className="login-input-wrapper">
              <span className="login-input-icon">👤</span>
              <input id="recovery-member-id" name="memberId" required maxLength={32} pattern="[A-Za-z0-9]+" autoComplete="username" placeholder="e.g. CSC2026M01" />
            </div>
          </div>

          {error && <p className="member-form-error">⚠️ {error}</p>}
          {message && <p className="member-form-success">✓ {message}</p>}

          <button className="primary" disabled={loading} style={{ width: '100%', minHeight: '44px', marginTop: '10px' }}>
            {loading ? 'SENDING INSTRUCTIONS…' : 'SEND RESET INSTRUCTIONS'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '18px' }}>
          <button className="back-button" type="button" onClick={onBack}>
            ← Back to sign in
          </button>
        </div>
      </section>
    </main>
  )
}

function PasswordReset({ token, onComplete }) {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password') || '')
    if (password !== String(form.get('confirmPassword') || '')) {
      setError('Passwords do not match.')
      return
    }
    setError('')
    setLoading(true)
    try {
      await authApi.resetPassword(token, password)
      onComplete()
    } catch (requestError) {
      setError(requestError.message || 'Unable to reset password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="hibernation-page">
      <div className="grid-overlay" />
      <section className="login-card" style={{ maxWidth: '440px' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <Crest small />
          <h2 style={{ font: '700 24px Syne', color: '#edf7ff', margin: '10px 0 6px' }}>Set New Password</h2>
          <p style={{ color: '#8aa2b4', fontSize: '12px', margin: 0 }}>
            Must be at least 12 characters with uppercase, lowercase, number, and symbol.
          </p>
        </div>

        <form onSubmit={submit}>
          <div className="login-field-group">
            <label htmlFor="new-password">New Password</label>
            <div className="login-input-wrapper">
              <input id="new-password" name="password" type="password" minLength={12} required autoComplete="new-password" placeholder="At least 12 characters" />
            </div>
          </div>
          <div className="login-field-group">
            <label htmlFor="confirm-password">Confirm New Password</label>
            <div className="login-input-wrapper">
              <input id="confirm-password" name="confirmPassword" type="password" minLength={12} required autoComplete="new-password" placeholder="Repeat password" />
            </div>
          </div>

          {error && <p className="member-form-error">⚠️ {error}</p>}

          <button className="primary" disabled={loading} style={{ width: '100%', minHeight: '44px', marginTop: '10px' }}>
            {loading ? 'UPDATING…' : 'UPDATE PASSWORD & SIGN IN'}
          </button>
        </form>
      </section>
    </main>
  )
}

// ----------------------------------------------------
// Account Security & President Master PIN
// ----------------------------------------------------
function AccountSecurity({ user, logout, onNavigate }) {
  const [setup, setSetup] = useState(null)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Master PIN (Primary President only)
  const [masterPin, setMasterPin] = useState('')
  const [masterPinPassword, setMasterPinPassword] = useState('')
  const [pinMessage, setPinMessage] = useState('')
  const [pinError, setPinError] = useState('')

  async function startSetup() {
    setError('')
    setMessage('')
    setLoading(true)
    try {
      setSetup(await authApi.startTwoFactorSetup())
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  async function confirmSetup(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await authApi.confirmTwoFactorSetup(code)
      setSetup(null)
      setCode('')
      setMessage('Two-factor authentication is now active.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  async function disableSetup(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await authApi.disableTwoFactor(password, code)
      setPassword('')
      setCode('')
      setMessage('Two-factor authentication has been disabled.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSetMasterPin(e) {
    e.preventDefault()
    setPinError('')
    setPinMessage('')
    try {
      const res = await adminApi.setPresidentMasterPin(masterPin, masterPinPassword)
      setPinMessage(res.message)
      setMasterPin('')
      setMasterPinPassword('')
    } catch (err) {
      setPinError(err.message)
    }
  }

  return (
    <LivePortal user={user} logout={logout} activeTab="security" onNavigate={onNavigate} title="ACCOUNT SECURITY">
      <section className="member-management">
        <div className="member-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate(user.isAdminUser ? 'admin-dashboard' : 'student-dashboard')}>
              ← BACK
            </button>
            <p className="eyebrow">AUTHENTICATION PROTECTION</p>
            <h1>Account Security & Locks</h1>
            <p>Configure two-factor protection and manage secondary authorization controls.</p>
          </div>
          <span className="president-lock">
            {user.twoFactorEnabled ? '2FA ACTIVE' : '2FA OPTIONAL'}
          </span>
        </div>

        {/* Primary President Dual Lock Master PIN Card */}
        {user.isPrimaryAdmin && (
          <article className="account-form-card security-card" style={{ maxWidth: '720px', marginBottom: '24px', border: '1px solid #ffb74d55' }}>
            <p className="eyebrow" style={{ color: '#ffb74d' }}>PRIMARY PRESIDENT SECURITY</p>
            <h2 style={{ color: '#ffb74d' }}>👑 Dual 6-Digit Master Security PIN (Two Locks)</h2>
            <p style={{ color: '#9bb7cc', fontSize: '13px', lineHeight: '1.6' }}>
              Set a dedicated 6-digit Master PIN for your Primary President account. When enabled, signing in requires your password + this 6-digit PIN (independent of authenticator apps).
            </p>
            <form onSubmit={handleSetMasterPin} style={{ marginTop: '16px' }}>
              <div className="member-form-grid">
                <label>
                  New 6-Digit Master PIN *
                  <input
                    type="password"
                    maxLength={6}
                    pattern="\d{6}"
                    required
                    placeholder="e.g. 849201"
                    value={masterPin}
                    onChange={e => setMasterPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  />
                </label>
                <label>
                  Current Account Password *
                  <input
                    type="password"
                    required
                    placeholder="Enter current password"
                    value={masterPinPassword}
                    onChange={e => setMasterPinPassword(e.target.value)}
                  />
                </label>
              </div>
              {pinError && <p className="member-form-error">⚠️ {pinError}</p>}
              {pinMessage && <p className="member-form-success">✓ {pinMessage}</p>}
              <button className="primary member-submit" disabled={masterPin.length !== 6 || !masterPinPassword} style={{ marginTop: '14px', background: 'linear-gradient(105deg,#f59e0b,#d97706)' }}>
                SET 6-DIGIT MASTER SECURITY PIN
              </button>
            </form>
          </article>
        )}

        {/* Standard 2FA Authenticator Card */}
        <article className="account-form-card security-card" style={{ maxWidth: '720px' }}>
          {!user.twoFactorEnabled && !setup && (
            <>
              <h2>Set up Authenticator App (2FA)</h2>
              <p>Add two-factor protection using Google Authenticator, Microsoft Authenticator, or Authy.</p>
              <button className="primary member-submit" type="button" onClick={startSetup} disabled={loading}>
                {loading ? 'PREPARING…' : 'START 2FA SETUP'}
              </button>
            </>
          )}
          {!user.twoFactorEnabled && setup && (
            <>
              <h2>Scan QR Code</h2>
              <p>Scan this QR code in your authenticator app, then enter the 6-digit code.</p>
              <img className="mfa-qr" src={setup.qrCodeDataUrl} alt="2FA QR Code" />
              <form onSubmit={confirmSetup}>
                <label>
                  Authentication Code
                  <input
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    placeholder="000000"
                    required
                  />
                </label>
                <button className="primary member-submit" disabled={loading || code.length !== 6}>
                  {loading ? 'VERIFYING…' : 'ENABLE 2FA'}
                </button>
              </form>
            </>
          )}
          {user.twoFactorEnabled && (
            <>
              <h2>Two-Factor Authentication is Enabled</h2>
              <p>Disabling 2FA requires your current password and a live authenticator code.</p>
              <form onSubmit={disableSetup}>
                <label>
                  Current Password
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                </label>
                <label>
                  Authentication Code
                  <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" required />
                </label>
                <button className="outline" disabled={loading || code.length !== 6}>
                  {loading ? 'DISABLING…' : 'DISABLE 2FA'}
                </button>
              </form>
            </>
          )}
          {error && <p className="member-form-error" role="alert">{error}</p>}
          {message && <p className="member-form-success" role="status">{message}</p>}
        </article>
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Member Management & Leadership Directory
// ----------------------------------------------------
function MemberManagement({ user, logout, onNavigate }) {
  const [members, setMembers] = useState([])
  const [role, setRole] = useState('STUDENT')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState({})
  const [passwordInput, setPasswordInput] = useState('')

  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [transferTargetId, setTransferTargetId] = useState('')
  const [transferAuthCode, setTransferAuthCode] = useState('')
  const [transferError, setTransferError] = useState('')

  const [resetModalUser, setResetModalUser] = useState(null)
  const [newPasswordInput, setNewPasswordInput] = useState('')
  const [resetError, setResetError] = useState('')

  const hasLength = passwordInput.length >= 12
  const hasLower = /[a-z]/.test(passwordInput)
  const hasUpper = /[A-Z]/.test(passwordInput)
  const hasNumber = /\d/.test(passwordInput)
  const hasSymbol = /[^A-Za-z0-9]/.test(passwordInput)

  function loadMembers() {
    setLoading(true)
    adminApi.listMembers()
      .then(({ users }) => setMembers(users))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadMembers()
  }, [])

  async function createAccount(e) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setMessage('')
    setError('')

    const rawYear = String(form.get('year') || '').trim()
    const account = {
      memberId: String(form.get('memberId') || '').trim().toUpperCase(),
      password: passwordInput,
      role,
      profile: {
        name: String(form.get('name') || '').trim(),
        rollNumber: String(form.get('rollNumber') || '').trim() || null,
        department: String(form.get('department') || '').trim() || null,
        year: rawYear ? Number(rawYear) : null,
        email: String(form.get('email') || '').trim() || null,
        phone: String(form.get('phone') || '').trim() || null,
      },
    }

    setSubmitting(true)
    try {
      const { user: created } = await adminApi.createMember(account)
      setMembers(c => [created, ...c])
      e.currentTarget.reset()
      setPasswordInput('')
      setRole('STUDENT')
      setMessage(`Account created for ${created.name} (${getRoleLabel(created.role)}) · Member ID: ${created.memberId}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function updateMember(id) {
    setMessage('')
    setError('')
    setSubmitting(true)
    try {
      const { user: updated } = await adminApi.editMember(id, editData)
      setMembers(c => c.map(m => (m.id === id ? updated : m)))
      setEditingId(null)
      setEditData({})
      setMessage('Member details updated.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleStatus(member) {
    if (member.isPrimaryAdmin) return
    const nextStatus = member.accountStatus === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
    try {
      const { user: updated } = await adminApi.updateMemberStatus(member.id, nextStatus)
      setMembers(c => c.map(m => (m.id === member.id ? updated : m)))
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDisable2FA(member) {
    if (!confirm(`Are you sure you want to disable 2FA for ${member.name} (${member.memberId})?`)) return
    try {
      const res = await adminApi.disableMemberTwoFactor(member.id)
      setMessage(res.message)
      loadMembers()
    } catch (err) {
      setError(err.message)
    }
  }

  async function removeMember(member) {
    if (member.isPrimaryAdmin || member.role === 'PRESIDENT') {
      alert('The Primary President account cannot be deleted. Primary President status must first be transferred.')
      return
    }
    if (!confirm(`Are you sure you want to delete member ${member.name} (${member.memberId})?`)) return
    try {
      await adminApi.deleteMember(member.id)
      setMembers(c => c.filter(m => m.id !== member.id))
      setMessage(`Member ${member.memberId} removed.`)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleAdminResetPassword(e) {
    e.preventDefault()
    setResetError('')
    try {
      const res = await adminApi.adminResetPassword(resetModalUser.id, newPasswordInput)
      setMessage(res.message)
      setResetModalUser(null)
      setNewPasswordInput('')
    } catch (err) {
      setResetError(err.message)
    }
  }

  async function handleTransferLeadership(e) {
    e.preventDefault()
    setTransferError('')
    try {
      const res = await adminApi.transferPresidentRole(transferTargetId, transferAuthCode)
      setMessage(res.message)
      setTransferModalOpen(false)
      setTransferAuthCode('')
      loadMembers()
    } catch (err) {
      setTransferError(err.message)
    }
  }

  const filteredMembers = members.filter(m => {
    const q = searchQuery.toLowerCase()
    return (
      m.memberId?.toLowerCase().includes(q) ||
      m.name?.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q) ||
      m.role?.toLowerCase().includes(q)
    )
  })

  return (
    <LivePortal user={user} logout={logout} activeTab="admin-members" onNavigate={onNavigate} title="MEMBER & ROLE DIRECTORY">
      <section className="member-management">
        <div className="member-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('admin-dashboard')}>
              ← COMMAND CENTER
            </button>
            <p className="eyebrow">ROLE-BASED ACCESS CONTROL</p>
            <h1>Club Members & Leaders</h1>
            <p>Add new club members, assign predefined roles, manage 2FA locks, and oversee authorized access.</p>
          </div>
          {user.isPrimaryAdmin && (
            <button className="outline" type="button" onClick={() => setTransferModalOpen(true)}>
              👑 TRANSFER PRIMARY LEADERSHIP
            </button>
          )}
        </div>

        {message && <p className="member-form-success">{message}</p>}
        {error && <p className="member-form-error">{error}</p>}

        <div className="member-management-grid">
          {/* Account Creation Card */}
          <article className="account-form-card">
            <p className="eyebrow">PROVISION MEMBER</p>
            <h2>Create Club Account</h2>
            <p style={{ color: '#7e95a7', fontSize: '11px', margin: '4px 0 16px' }}>
              Provisioning account as: <b style={{ color: '#85d7ff' }}>{user.name} ({user.memberId})</b>
            </p>

            <form onSubmit={createAccount}>
              <div className="member-form-grid">
                <label>
                  Member ID (Unique)
                  <input name="memberId" required placeholder="e.g. CSC2026M01" />
                </label>
                <label>
                  Assigned Club Role
                  <select
                    className="member-select"
                    value={role}
                    onChange={e => setRole(e.target.value)}
                  >
                    {CLUB_ROLES.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.label} ({r.roleType.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Full Name
                  <input name="name" required placeholder="Full Name" />
                </label>
                <label>
                  College Roll Number
                  <input name="rollNumber" placeholder="Roll Number" />
                </label>
                <label>
                  Department
                  <input name="department" placeholder="e.g. Cyber Security" />
                </label>
                <label>
                  Academic Year
                  <input name="year" type="number" min={1} max={5} placeholder="1 - 4" />
                </label>
                <label>
                  Official Email
                  <input name="email" type="email" placeholder="student@college.edu" />
                </label>
                <label>
                  Phone Number
                  <input name="phone" placeholder="Phone number" />
                </label>
                <label className="form-wide">
                  Account Password
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={e => setPasswordInput(e.target.value)}
                    required
                    placeholder="Min 12 chars (Upper, Lower, Number, Symbol)"
                  />
                </label>
              </div>

              <div className="pwd-rules">
                <span className={`pwd-rule ${hasLength ? 'valid' : ''}`}><i>{hasLength ? '✓' : '○'}</i> 12+ Characters</span>
                <span className={`pwd-rule ${hasUpper ? 'valid' : ''}`}><i>{hasUpper ? '✓' : '○'}</i> Uppercase Letter</span>
                <span className={`pwd-rule ${hasLower ? 'valid' : ''}`}><i>{hasLower ? '✓' : '○'}</i> Lowercase Letter</span>
                <span className={`pwd-rule ${hasNumber ? 'valid' : ''}`}><i>{hasNumber ? '✓' : '○'}</i> Number</span>
                <span className={`pwd-rule ${hasSymbol ? 'valid' : ''}`}><i>{hasSymbol ? '✓' : '○'}</i> Symbol (!@#$)</span>
              </div>

              <button className="primary member-submit" disabled={submitting || !hasLength || !hasLower || !hasUpper || !hasNumber || !hasSymbol}>
                {submitting ? 'PROVISIONING…' : '＋ &nbsp; CREATE MEMBER ACCOUNT'}
              </button>
            </form>
          </article>

          {/* Member List Directory Card */}
          <article className="member-list-card">
            <div className="card-heading">
              <div>
                <p className="eyebrow">ROSTER DIRECTORY</p>
                <h2>Active Accounts ({members.length})</h2>
              </div>
            </div>

            <div style={{ marginTop: '14px' }}>
              <input
                style={{ width: '100%', height: '38px', padding: '0 12px', background: '#050a12', border: '1px solid var(--line)', borderRadius: '6px', color: '#fff', fontSize: '11px' }}
                placeholder="Search by Member ID, Name, Role, or Email..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            {loading ? (
              <p className="directory-state">Loading accounts...</p>
            ) : filteredMembers.length === 0 ? (
              <p className="directory-state">No matching members found.</p>
            ) : (
              <div className="table-scroll-container">
                <div className="members-table">
                  <div className="table-header">
                    <span>MEMBER</span>
                    <span>ROLE & 2FA</span>
                    <span>CONTACT INFO</span>
                    <span>ACTIONS</span>
                  </div>
                  {filteredMembers.map(m => {
                    const isEditing = editingId === m.id
                    return (
                      <div className={`table-row ${isEditing ? 'editing' : ''}`} key={m.id}>
                        {isEditing ? (
                          <div>
                            <div className="edit-fields-grid">
                              <input
                                placeholder="Name"
                                defaultValue={m.name}
                                onChange={e => setEditData(d => ({ ...d, name: e.target.value }))}
                              />
                              <input
                                placeholder="Email"
                                defaultValue={m.email || ''}
                                onChange={e => setEditData(d => ({ ...d, email: e.target.value }))}
                              />
                              <input
                                placeholder="Phone"
                                defaultValue={m.phone || ''}
                                onChange={e => setEditData(d => ({ ...d, phone: e.target.value }))}
                              />
                              <select
                                defaultValue={m.role}
                                onChange={e => setEditData(d => ({ ...d, role: e.target.value }))}
                                disabled={m.isPrimaryAdmin}
                              >
                                {CLUB_ROLES.map(r => (
                                  <option key={r.id} value={r.id}>{r.label}</option>
                                ))}
                              </select>
                            </div>
                            <div className="action-buttons" style={{ marginTop: '8px' }}>
                              <button className="action-btn save-btn" onClick={() => updateMember(m.id)}>Save</button>
                              <button className="action-btn cancel-btn" onClick={() => { setEditingId(null); setEditData({}) }}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              {m.profileImage ? (
                                <img src={m.profileImage} alt={m.name} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #52bbf555' }} />
                              ) : (
                                <span style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#1c2e42', display: 'grid', placeItems: 'center', color: '#85d7ff', font: '700 10px Syne' }}>
                                  {m.initials}
                                </span>
                              )}
                              <div>
                                <b>{m.name}</b>
                                <small style={{ color: '#85d7ff', display: 'block' }}>{m.memberId}</small>
                              </div>
                            </div>
                            <div>
                              <span className={`badge ${m.isPrimaryAdmin ? 'badge-president' : m.role === 'STUDENT' ? 'badge-student' : 'badge-admin'}`}>
                                {m.isPrimaryAdmin ? '👑 PRESIDENT' : getRoleLabel(m.role)}
                              </span>
                              {m.twoFactorEnabled && (
                                <span className="badge" style={{ background: '#0a3520', color: '#70ddb4', border: '1px solid #70ddb444', marginLeft: '6px', fontSize: '8px' }}>
                                  🔒 2FA ON
                                </span>
                              )}
                            </div>
                            <div>
                              <small>{m.email || 'No email'}</small>
                              <small>{m.phone || 'No phone'}</small>
                            </div>
                            <div className="action-buttons">
                              <button className="action-btn edit-btn" onClick={() => { setEditingId(m.id); setEditData({}) }}>Edit</button>
                              <button className="action-btn toggle-status-btn" onClick={() => toggleStatus(m)} disabled={m.isPrimaryAdmin}>
                                {m.accountStatus === 'ACTIVE' ? 'Active' : 'Disabled'}
                              </button>
                              <button className="action-btn edit-btn" onClick={() => setResetModalUser(m)}>Password</button>
                              {m.twoFactorEnabled && (
                                <button className="action-btn cancel-btn" onClick={() => handleDisable2FA(m)} title="Disable 2FA if member is locked out">
                                  Reset 2FA
                                </button>
                              )}
                              {!m.isPrimaryAdmin && (
                                <button className="action-btn delete-btn" onClick={() => removeMember(m)}>Delete</button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </article>
        </div>

        {/* Reset Password Modal */}
        {resetModalUser && (
          <div className="photo-lightbox" onClick={() => setResetModalUser(null)}>
            <div className="photo-lightbox-content" onClick={e => e.stopPropagation()} style={{ background: '#0d1522', padding: '28px', borderRadius: '12px', border: '1px solid var(--line)', maxWidth: '420px' }}>
              <h3 style={{ margin: '0 0 8px', font: '700 18px Syne', color: '#fff' }}>Reset Password</h3>
              <p style={{ color: '#829bb0', fontSize: '12px', margin: '0 0 16px' }}>
                Resetting password for: <b style={{ color: '#85d7ff' }}>{resetModalUser.name} ({resetModalUser.memberId})</b>
              </p>
              <form onSubmit={handleAdminResetPassword}>
                <input
                  type="password"
                  required
                  minLength={12}
                  placeholder="New password (12+ chars)"
                  value={newPasswordInput}
                  onChange={e => setNewPasswordInput(e.target.value)}
                  style={{ width: '100%', height: '40px', padding: '0 12px', background: '#050a12', border: '1px solid var(--line)', borderRadius: '6px', color: '#fff', marginBottom: '12px' }}
                />
                {resetError && <p className="member-form-error">{resetError}</p>}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" className="action-btn cancel-btn" onClick={() => setResetModalUser(null)}>Cancel</button>
                  <button type="submit" className="primary" style={{ minHeight: '36px' }}>RESET PASSWORD</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Transfer Leadership Modal */}
        {transferModalOpen && (
          <div className="photo-lightbox" onClick={() => setTransferModalOpen(false)}>
            <div className="photo-lightbox-content" onClick={e => e.stopPropagation()} style={{ background: '#0d1522', padding: '28px', borderRadius: '12px', border: '1px solid #ff980055', maxWidth: '460px' }}>
              <h3 style={{ margin: '0 0 8px', font: '700 18px Syne', color: '#ffb74d' }}>Transfer Primary Leadership</h3>
              <p style={{ color: '#829bb0', fontSize: '12px', margin: '0 0 16px' }}>
                Select the administrator who will become the new Primary President.
              </p>
              <form onSubmit={handleTransferLeadership}>
                <label style={{ display: 'block', color: '#b4c7d5', fontSize: '11px', marginBottom: '6px' }}>
                  Select New Primary President
                  <select
                    className="member-select"
                    required
                    value={transferTargetId}
                    onChange={e => setTransferTargetId(e.target.value)}
                    style={{ marginBottom: '14px' }}
                  >
                    <option value="">-- Choose Administrator --</option>
                    {members.filter(m => !m.isPrimaryAdmin && m.role !== 'STUDENT').map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.memberId} · {getRoleLabel(m.role)})</option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'block', color: '#b4c7d5', fontSize: '11px', marginBottom: '6px' }}>
                  Your 6-Digit Master Security PIN or Password
                  <input
                    required
                    placeholder="Enter Security PIN or Password"
                    value={transferAuthCode}
                    onChange={e => setTransferAuthCode(e.target.value)}
                    style={{ width: '100%', height: '40px', padding: '0 12px', background: '#050a12', border: '1px solid var(--line)', borderRadius: '6px', color: '#fff', marginBottom: '14px' }}
                  />
                </label>
                {transferError && <p className="member-form-error">{transferError}</p>}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" className="action-btn cancel-btn" onClick={() => setTransferModalOpen(false)}>Cancel</button>
                  <button type="submit" className="primary" style={{ minHeight: '36px', background: 'linear-gradient(105deg,#f59e0b,#d97706)' }}>
                    CONFIRM TRANSFER
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

// ----------------------------------------------------
// Universal Member Profile Management (Students & Admins)
// ----------------------------------------------------
function UniversalProfileView({ user, logout, onNavigate, onProfileUpdated }) {
  const [profile, setProfile] = useState(user.profile || {})
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [photoPreview, setPhotoPreview] = useState(user.profile?.profileImage || '')

  async function handleSave(e) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setMessage('')
    setError('')

    const payload = {
      name: String(form.get('name') || '').trim() || undefined,
      phone: String(form.get('phone') || '').trim() || null,
      bio: String(form.get('bio') || '').trim() || null,
      instagramUrl: String(form.get('instagramUrl') || '').trim() || null,
      githubUrl: String(form.get('githubUrl') || '').trim() || null,
      linkedinUrl: String(form.get('linkedinUrl') || '').trim() || null,
      portfolioUrl: String(form.get('portfolioUrl') || '').trim() || null,
      skills: String(form.get('skills') || '').trim() || null,
      profileImage: photoPreview || null,
    }

    setSubmitting(true)
    try {
      const res = await memberApi.updateProfile(payload)
      setProfile(res.user.profile || {})
      if (onProfileUpdated) onProfileUpdated(res.user)
      setMessage('Profile and avatar updated successfully.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <LivePortal user={user} logout={logout} activeTab={user.isAdminUser ? 'admin-profile' : 'student-profile'} onNavigate={onNavigate} title="MY PROFILE">
      <section className="member-management">
        <div className="member-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate(user.isAdminUser ? 'admin-dashboard' : 'student-dashboard')}>
              ← BACK TO DASHBOARD
            </button>
            <p className="eyebrow">IDENTITY & AVATAR</p>
            <h1>Personal Profile & Avatar</h1>
            <p>Upload your profile photo and customize your bio, skills, and portfolios.</p>
          </div>
          <span className="president-lock">MEMBER ID: {user.memberId}</span>
        </div>

        {message && <p className="member-form-success">{message}</p>}
        {error && <p className="member-form-error">{error}</p>}

        <div className="member-management-grid">
          <article className="account-form-card" style={{ maxWidth: '640px' }}>
            <form onSubmit={handleSave}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '20px', padding: '14px', background: '#050a12', borderRadius: '10px', border: '1px solid var(--line)' }}>
                {photoPreview ? (
                  <img src={photoPreview} alt="Profile" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #52bbf5' }} />
                ) : (
                  <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg,#2488d8,#18447e)', display: 'grid', placeItems: 'center', color: '#fff', font: '700 24px Syne' }}>
                    {user.initials}
                  </div>
                )}
                <div>
                  <b style={{ color: '#edf7ff', fontSize: '14px', display: 'block' }}>Profile Photo</b>
                  <p style={{ color: '#7e95a7', fontSize: '11px', margin: '2px 0 10px' }}>Upload a JPEG or PNG photo</p>
                  <label className="action-btn edit-btn" style={{ cursor: 'pointer', display: 'inline-block' }}>
                    Upload New Image
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) readImageFile(file, setPhotoPreview)
                      }}
                    />
                  </label>
                  {photoPreview && (
                    <button type="button" className="action-btn cancel-btn" onClick={() => setPhotoPreview('')} style={{ marginLeft: '8px' }}>
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <div className="member-form-grid">
                <label>
                  Full Name
                  <input name="name" defaultValue={profile.name || user.name} />
                </label>
                <label>
                  Phone Number
                  <input name="phone" defaultValue={profile.phone || ''} placeholder="Phone number" />
                </label>
                <label className="form-wide">
                  Short Bio
                  <input name="bio" defaultValue={profile.bio || ''} placeholder="e.g. Reverse engineering & CTF enthusiast" />
                </label>
                <label className="form-wide">
                  Cyber Security Skills
                  <input name="skills" defaultValue={profile.skills || ''} placeholder="e.g. Wireshark, Metasploit, Python, Reverse Engineering" />
                </label>
                <label>
                  GitHub Profile URL
                  <input name="githubUrl" defaultValue={profile.githubUrl || ''} placeholder="https://github.com/..." />
                </label>
                <label>
                  LinkedIn Profile URL
                  <input name="linkedinUrl" defaultValue={profile.linkedinUrl || ''} placeholder="https://linkedin.com/in/..." />
                </label>
              </div>

              <button className="primary member-submit" type="submit" disabled={submitting} style={{ marginTop: '18px', width: '100%' }}>
                {submitting ? 'SAVING PROFILE…' : 'SAVE PROFILE & AVATAR'}
              </button>
            </form>
          </article>

          {/* Profile Card Preview */}
          <article className="account-form-card" style={{ textAlign: 'center' }}>
            <p className="eyebrow">BADGE PREVIEW</p>
            <h2>My Member Badge</h2>
            <div style={{ marginTop: '20px', padding: '24px', background: '#050a12', borderRadius: '12px', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {photoPreview ? (
                <img src={photoPreview} alt="Profile" style={{ width: '96px', height: '96px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #52bbf5', marginBottom: '14px' }} />
              ) : (
                <div style={{ width: '96px', height: '96px', borderRadius: '50%', background: 'linear-gradient(135deg,#2488d8,#18447e)', display: 'grid', placeItems: 'center', color: '#fff', font: '700 30px Syne', marginBottom: '14px' }}>
                  {user.initials}
                </div>
              )}
              <h3 style={{ margin: '0 0 4px', font: '700 20px Syne', color: '#edf7ff' }}>{profile.name || user.name}</h3>
              <span className={`badge ${user.isPrimaryAdmin ? 'badge-president' : user.role === 'STUDENT' ? 'badge-student' : 'badge-admin'}`} style={{ marginBottom: '10px' }}>
                {user.isPrimaryAdmin ? '👑 PRESIDENT' : getRoleLabel(user.role)}
              </span>
              <p style={{ color: '#85d7ff', font: '500 11px "DM Mono", monospace', margin: '0 0 10px' }}>
                MEMBER ID: {user.memberId}
              </p>
              <p style={{ color: '#8aa2b4', fontSize: '12px', lineHeight: '1.6', margin: '0 0 14px' }}>
                {profile.bio || 'Authorized member of Cyber Security Club MRDU.'}
              </p>
            </div>
          </article>
        </div>
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Student & Admin Customer Support / Doubts Desk
// ----------------------------------------------------
function SupportDeskView({ user, logout, onNavigate }) {
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
      const res = await adminApi.updateSupportTicketStatus(ticket.id, newStatus)
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
          {isStudent && (
            <button className="primary" type="button" onClick={() => setShowCreateModal(true)}>
              ＋ &nbsp; ASK A DOUBT / QUERY
            </button>
          )}
        </div>

        {message && <p className="member-form-success">{message}</p>}
        {error && <p className="member-form-error">{error}</p>}

        <div className="member-management-grid">
          {/* Tickets List */}
          <article className="member-list-card">
            <div className="card-heading">
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
                        background: isSelected ? '#102235' : '#050a12',
                        border: isSelected ? '1px solid #52bbf5' : '1px solid var(--line)',
                        cursor: 'pointer',
                        transition: 'border-color 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div>
                          <span className="badge" style={{ background: '#1c2e42', color: '#ffb74d', border: '1px solid #ffb74d44', fontSize: '9px', marginRight: '6px' }}>
                            @{t.taggedRole}
                          </span>
                          <span className={`badge badge-${t.status.toLowerCase()}`}>
                            {t.status}
                          </span>
                        </div>
                        <small style={{ color: '#688296', font: '500 9px "DM Mono", monospace' }}>
                          {new Date(t.createdAt).toLocaleDateString()}
                        </small>
                      </div>
                      <h4 style={{ margin: '8px 0 4px', font: '700 14px Syne', color: '#edf7ff' }}>{t.subject}</h4>
                      <p style={{ color: '#8aa2b4', fontSize: '11px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.message}
                      </p>
                      <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <small style={{ color: '#7e95a7' }}>From: {t.user?.profile?.name || t.user?.memberId}</small>
                        <small style={{ color: '#85d7ff' }}>{t.replies?.length || 0} replies →</small>
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
                      <span className="badge" style={{ background: '#1c2e42', color: '#ffb74d', border: '1px solid #ffb74d44', fontSize: '10px', marginRight: '8px' }}>
                        TAGGED: @{selectedTicket.taggedRole}
                      </span>
                      <span className={`badge badge-${selectedTicket.status.toLowerCase()}`}>
                        {selectedTicket.status}
                      </span>
                      <h3 style={{ margin: '8px 0 4px', font: '700 18px Syne', color: '#edf7ff' }}>{selectedTicket.subject}</h3>
                      <small style={{ color: '#7e95a7' }}>
                        Asked by: <b style={{ color: '#85d7ff' }}>{selectedTicket.user?.profile?.name || selectedTicket.user?.memberId}</b> on {new Date(selectedTicket.createdAt).toLocaleString()}
                      </small>
                    </div>
                    {!isStudent && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {selectedTicket.status !== 'RESOLVED' ? (
                          <button type="button" className="action-btn save-btn" onClick={() => handleToggleStatus(selectedTicket, 'RESOLVED')}>
                            ✓ Mark Resolved
                          </button>
                        ) : (
                          <button type="button" className="action-btn cancel-btn" onClick={() => handleToggleStatus(selectedTicket, 'OPEN')}>
                            Re-Open
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <p style={{ color: '#cbdfe9', fontSize: '13px', lineHeight: '1.6', margin: '12px 0 0', padding: '12px', background: '#050a12', borderRadius: '8px', border: '1px solid var(--line)' }}>
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
                            background: isMe ? '#163854' : '#081320',
                            border: isReplierPresident ? '1px solid #ffb74d66' : isMe ? '1px solid #52bbf544' : '1px solid var(--line)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <b style={{ color: isReplierPresident ? '#ffb74d' : '#85d7ff', fontSize: '11px' }}>
                              {isReplierPresident ? '👑 ' : ''}{r.user?.profile?.name || r.user?.name || r.user?.memberId}
                            </b>
                            <span className="badge" style={{ fontSize: '8px', padding: '2px 6px' }}>
                              {isReplierPresident ? 'PRESIDENT' : getRoleLabel(replierRole)}
                            </span>
                            <small style={{ color: '#688296', fontSize: '9px', marginLeft: 'auto' }}>
                              {new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </small>
                          </div>
                          <p style={{ color: '#edf7ff', fontSize: '12px', margin: 0, lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
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
                      style={{ flex: 1, height: '42px', padding: '0 14px', background: '#050a12', border: '1px solid var(--line)', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                    />
                    <button className="primary" disabled={submittingReply || !replyText.trim()} style={{ minHeight: '42px', padding: '0 18px' }}>
                      {submittingReply ? 'SENDING…' : 'REPLY →'}
                    </button>
                  </form>
                ) : (
                  <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#1c1515', border: '1px solid #f8717144', color: '#fca5a5', fontSize: '11px', textAlign: 'center' }}>
                    🔒 Role Restriction: Only members of <b>@{selectedTicket.taggedRole}</b> or the President are authorized to reply to this query.
                  </div>
                )}
              </>
            ) : (
              <div style={{ margin: 'auto', textAlign: 'center', color: '#7e95a7' }}>
                <p>Select any doubt inquiry from the left to view the thread and respond.</p>
              </div>
            )}
          </article>
        </div>

        {/* Ask a Doubt Modal (Student) */}
        {showCreateModal && (
          <div className="photo-lightbox" onClick={() => setShowCreateModal(false)}>
            <div className="photo-lightbox-content" onClick={e => e.stopPropagation()} style={{ background: '#0d1522', padding: '28px', borderRadius: '14px', border: '1px solid var(--line)', maxWidth: '520px', width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: 0, font: '700 20px Syne', color: '#edf7ff' }}>Ask a Doubt / Query</h3>
                  <small style={{ color: '#7e95a7' }}>Tag a specific club leadership council team</small>
                </div>
                <button className="lightbox-close" onClick={() => setShowCreateModal(false)} style={{ position: 'static' }}>✕</button>
              </div>

              <form onSubmit={handleCreateTicket}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#b4c7d5', marginBottom: '6px' }}>
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

                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#b4c7d5', marginBottom: '6px' }}>
                  Subject / Question Topic *
                  <input
                    required
                    placeholder="e.g. Query regarding upcoming Wireshark lab requirements"
                    value={newSubject}
                    onChange={e => setNewSubject(e.target.value)}
                    style={{ width: '100%', height: '40px', padding: '0 12px', background: '#050a12', border: '1px solid var(--line)', borderRadius: '6px', color: '#fff', marginBottom: '14px' }}
                  />
                </label>

                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#b4c7d5', marginBottom: '6px' }}>
                  Description / Details *
                  <textarea
                    required
                    placeholder="Explain your doubt in detail..."
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    style={{ width: '100%', height: '90px', padding: '10px', background: '#050a12', border: '1px solid var(--line)', borderRadius: '6px', color: '#fff', marginBottom: '16px', resize: 'none' }}
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

// ----------------------------------------------------
// Subscription Management (Admin)
// ----------------------------------------------------
function SubscriptionManagement({ user, logout, onNavigate }) {
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
          <button className="outline" type="button" onClick={() => onNavigate('admin-settings')}>
            ⚙ SUBSCRIPTION SETTINGS
          </button>
        </div>

        {message && <p className="member-form-success">{message}</p>}
        {error && <p className="member-form-error">{error}</p>}

        {/* Top Statistics Cards */}
        <div className="sub-stats-grid">
          <div className="sub-stat-card blue">
            <i>👥</i>
            <div>
              <p>TOTAL STUDENTS</p>
              <b>{stats.totalStudents || 0}</b>
            </div>
          </div>
          <div className="sub-stat-card green">
            <i>✓</i>
            <div>
              <p>ACTIVE SUBSCRIPTIONS</p>
              <b>{stats.activeSubscriptions || 0}</b>
            </div>
          </div>
          <div className="sub-stat-card amber">
            <i>⏳</i>
            <div>
              <p>PENDING VERIFICATION</p>
              <b>{stats.pendingVerification || 0}</b>
            </div>
          </div>
          <div className="sub-stat-card purple">
            <i>⌛</i>
            <div>
              <p>EXPIRED SUBSCRIPTIONS</p>
              <b>{stats.expiredSubscriptions || 0}</b>
            </div>
          </div>
          <div className="sub-stat-card red">
            <i>✕</i>
            <div>
              <p>REJECTED PAYMENTS</p>
              <b>{stats.rejectedPayments || 0}</b>
            </div>
          </div>
        </div>

        {/* Pending Indicator Banner */}
        {stats.pendingVerification > 0 && (
          <div className="pending-alert-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>⚠️</span>
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
              style={{ height: '36px', padding: '0 12px', background: '#050a12', border: '1px solid var(--line)', borderRadius: '6px', color: '#fff', fontSize: '11px', minWidth: '240px' }}
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
                      <small style={{ color: '#85d7ff', display: 'block' }}>{sub.memberId}</small>
                    </div>
                    <div>
                      <strong style={{ color: '#70ddb4' }}>₹{sub.amount.toFixed(2)}</strong>
                      <small style={{ color: '#8aa2b4', display: 'block' }}>Ref: {sub.transactionRef}</small>
                    </div>
                    <div>
                      <small>{new Date(sub.submittedAt).toLocaleDateString()}</small>
                      <small style={{ color: '#688296', display: 'block' }}>{new Date(sub.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
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
                        <small style={{ color: '#5e7485' }}>No receipt</small>
                      )}
                    </div>
                    <div>
                      <span className={`badge badge-${sub.status.toLowerCase()}`}>
                        {sub.status}
                      </span>
                      {sub.expiresAt && sub.status === 'ACTIVE' && (
                        <small style={{ display: 'block', marginTop: '3px', color: '#85d7ff' }}>
                          Expires: {new Date(sub.expiresAt).toLocaleDateString()}
                        </small>
                      )}
                      {sub.rejectionReason && sub.status === 'REJECTED' && (
                        <small style={{ display: 'block', marginTop: '3px', color: '#ff9898' }}>
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
                        <small style={{ color: '#70ddb4' }}>Verified by {sub.verifiedBy}</small>
                      )}
                      {sub.status === 'EXPIRED' && (
                        <small style={{ color: '#8aa2b4' }}>Expired on {new Date(sub.expiresAt).toLocaleDateString()}</small>
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
            <div className="photo-lightbox-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', background: '#0b131e', padding: '20px', borderRadius: '12px', border: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <b style={{ color: '#85d7ff', fontSize: '13px' }}>PAYMENT RECEIPT PROOF</b>
                <button className="lightbox-close" onClick={() => setViewingReceipt(null)} style={{ position: 'static' }}>✕</button>
              </div>
              <img src={viewingReceipt} alt="Receipt Full" style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: '8px' }} />
            </div>
          </div>
        )}

        {/* Rejection Modal */}
        {rejectingSub && (
          <div className="photo-lightbox" onClick={() => setRejectingSub(null)}>
            <div className="photo-lightbox-content" onClick={e => e.stopPropagation()} style={{ background: '#0d1522', padding: '28px', borderRadius: '12px', border: '1px solid #f8717155', maxWidth: '420px' }}>
              <h3 style={{ margin: '0 0 8px', font: '700 18px Syne', color: '#f87171' }}>Reject Payment</h3>
              <p style={{ color: '#829bb0', fontSize: '12px', margin: '0 0 16px' }}>
                Reject payment for: <b style={{ color: '#fff' }}>{rejectingSub.name} ({rejectingSub.memberId})</b>
              </p>
              <textarea
                placeholder="Reason for rejection (e.g. Invalid UTR reference ID / Screenshot unreadable)"
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                style={{ width: '100%', height: '80px', padding: '10px', background: '#050a12', border: '1px solid var(--line)', borderRadius: '6px', color: '#fff', marginBottom: '14px', resize: 'none' }}
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

// ----------------------------------------------------
// Student Membership (Student Portal - UPI Only)
// ----------------------------------------------------
function StudentMembership({ user, logout, onNavigate }) {
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
      setMessage('Your UPI subscription payment was submitted successfully. An administrator will verify your membership shortly.')
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
    <LivePortal user={user} logout={logout} activeTab="student-membership" onNavigate={onNavigate} title="MEMBERSHIP SUBSCRIPTION">
      <section className="member-management">
        <div className="member-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('student-dashboard')}>
              ← BACK TO DASHBOARD
            </button>
            <p className="eyebrow">COMMUNITY MEMBERSHIP</p>
            <h1>Club Membership Status</h1>
            <p>Subscribe to unlock official event passes, hands-on lab access, and technical team support.</p>
          </div>
          <span className="president-lock">
            MEMBER ID: {user.memberId}
          </span>
        </div>

        {message && <p className="member-form-success">{message}</p>}
        {error && <p className="member-form-error">{error}</p>}

        {loading ? (
          <p className="directory-state">Loading membership information...</p>
        ) : isExempt ? (
          <div className="membership-status-box active-box">
            <h2 style={{ font: '700 22px Syne', color: '#70ddb4', margin: '0 0 6px' }}>👑 Leadership Account Active</h2>
            <p style={{ color: '#9bb7cc', fontSize: '13px', margin: 0 }}>
              As an authorized club leader ({getRoleLabel(user.role)}), you have full unlimited access to all features without a student subscription.
            </p>
          </div>
        ) : !isEnabled ? (
          <div className="membership-status-box active-box">
            <h2 style={{ font: '700 22px Syne', color: '#70ddb4', margin: '0 0 6px' }}>✓ Open Membership Access</h2>
            <p style={{ color: '#9bb7cc', fontSize: '13px', margin: 0 }}>
              Student membership subscription is currently open & free. You have full access to all club events and activities!
            </p>
          </div>
        ) : (
          <>
            {/* Status Card */}
            {activeSub ? (
              <div className="membership-status-box active-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <span className="badge badge-active" style={{ marginBottom: '8px' }}>✓ ACTIVE MEMBERSHIP</span>
                    <h2 style={{ font: '700 24px Syne', color: '#edf7ff', margin: '4px 0' }}>You are an Active Member</h2>
                    <p style={{ color: '#9bb7cc', fontSize: '13px', margin: '4px 0' }}>
                      Your membership is active and valid until <b style={{ color: '#85d7ff' }}>{new Date(activeSub.expiresAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })} at 23:59</b>.
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <small style={{ color: '#6f8da1', font: '500 9px "DM Mono", monospace' }}>SUBSCRIPTION FEE</small>
                    <div style={{ font: '700 22px Syne', color: '#70ddb4' }}>₹{Number(activeSub.amount).toFixed(2)}</div>
                  </div>
                </div>

                <div className="membership-benefits-list">
                  <div className="benefit-item"><i>✓</i> Official Event Pass Registrations</div>
                  <div className="benefit-item"><i>✓</i> Technical Team Support & Queries</div>
                  <div className="benefit-item"><i>✓</i> Full Club Gallery Access</div>
                  <div className="benefit-item"><i>✓</i> Hands-on CTF Defense Labs</div>
                </div>
              </div>
            ) : pendingSub ? (
              <div className="membership-status-box" style={{ borderColor: '#ffc10744', background: 'radial-gradient(circle at 100% 0, #78350f22, transparent 60%), #0c1522' }}>
                <span className="badge badge-pending" style={{ marginBottom: '8px' }}>⏳ VERIFICATION PENDING</span>
                <h2 style={{ font: '700 22px Syne', color: '#ffd54f', margin: '4px 0 8px' }}>Payment Verification in Progress</h2>
                <p style={{ color: '#9bb7cc', fontSize: '13px', margin: '0 0 14px' }}>
                  Your UPI subscription payment of <b style={{ color: '#fff' }}>₹{Number(pendingSub.amount).toFixed(2)}</b> (Ref: {pendingSub.transactionRef}) was submitted on {new Date(pendingSub.submittedAt).toLocaleDateString()}. An administrator will verify and activate your membership shortly.
                </p>
              </div>
            ) : (
              <div className="membership-status-box inactive-box">
                <span className="badge badge-disabled" style={{ marginBottom: '8px' }}>✕ MEMBERSHIP INACTIVE</span>
                <h2 style={{ font: '700 24px Syne', color: '#edf7ff', margin: '4px 0 8px' }}>Your membership is inactive.</h2>
                <p style={{ color: '#9bb7cc', fontSize: '13px', margin: '0 0 16px' }}>
                  Subscribe via UPI to unlock official event passes, technical support, and member-only club activities.
                </p>
                <div className="membership-benefits-list">
                  <div className="benefit-item"><i>🔒</i> Event Pass Registrations (Subscription Required)</div>
                  <div className="benefit-item"><i>🔒</i> Technical Team Support (Subscription Required)</div>
                  <div className="benefit-item"><i>🔒</i> Member-Only Gallery (Subscription Required)</div>
                </div>
              </div>
            )}

            {/* UPI Payment Form & QR Display Grid */}
            <div className="member-management-grid" style={{ marginTop: '24px' }}>
              <article className="account-form-card">
                <p className="eyebrow">UPI PAYMENT GATEWAY</p>
                <h2>Submit UPI Membership Fee</h2>
                <p style={{ color: '#7e95a7', fontSize: '12px', margin: '4px 0 18px' }}>
                  Monthly Membership Fee: <b style={{ color: '#70ddb4', fontSize: '16px' }}>₹{subStatus.monthlyAmount || 100}</b>
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
                    <div style={{ width: '180px', height: '180px', background: '#0a1522', border: '1px dashed #52bbf555', borderRadius: '8px', display: 'grid', placeContent: 'center', color: '#6f8da1', fontSize: '11px' }}>
                      UPI QR Code
                    </div>
                  )}
                  {subStatus.upiId && (
                    <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <code style={{ color: '#85d7ff', background: '#050a12', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', border: '1px solid var(--line)' }}>
                        {subStatus.upiId}
                      </code>
                      <button type="button" className="action-btn edit-btn" onClick={copyUpiId}>
                        {copiedUpi ? '✓ Copied' : 'Copy UPI ID'}
                      </button>
                    </div>
                  )}
                </div>
                <small style={{ color: '#72879a', fontSize: '11px', display: 'block' }}>
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

// ----------------------------------------------------
// Event Management & Studio
// ----------------------------------------------------
const initialEventForm = {
  title: '',
  eventType: 'Workshop',
  status: 'UPCOMING',
  dateTime: '',
  venue: '',
  location: '',
  shortDescription: '',
  description: '',
  agenda: '',
  rules: '',
  capacity: '',
  coordinatorName: '',
  coordinatorContact: '',
  organizingTeam: '',
  isPaid: false,
  paymentAmount: '',
  paymentUpiId: '',
  paymentInstructions: '',
  hasMultipleActivities: false,
}

function EventManagement({ user, logout, onNavigate }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('basic')

  const [formData, setFormData] = useState(initialEventForm)
  const [activities, setActivities] = useState([])
  const [formFields, setFormFields] = useState([])
  const [posterPreview, setPosterPreview] = useState('')
  const [qrPreview, setQrPreview] = useState('')

  const [editingEventId, setEditingEventId] = useState(null)
  const [analyticsModalEvent, setAnalyticsModalEvent] = useState(null)
  const [analyticsData, setAnalyticsData] = useState(null)
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)

  useEffect(() => {
    let mounted = true
    adminApi.listEvents()
      .then(({ events: list }) => { if (mounted) setEvents(list || []) })
      .catch(err => { if (mounted) setError(err.message) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  function updateFormField(field, value) {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  function addActivity() {
    setActivities(c => [...c, { name: '', description: '', price: 0, capacity: '' }])
  }
  function updateActivity(index, field, value) {
    setActivities(c => c.map((act, i) => (i === index ? { ...act, [field]: value } : act)))
  }
  function removeActivity(index) {
    setActivities(c => c.filter((_, i) => i !== index))
  }

  function addCustomField() {
    setFormFields(c => [...c, { fieldName: '', fieldType: 'text', isRequired: false, options: '' }])
  }
  function updateCustomField(index, field, value) {
    setFormFields(c => c.map((ff, i) => (i === index ? { ...ff, [field]: value } : ff)))
  }
  function removeCustomField(index) {
    setFormFields(c => c.filter((_, i) => i !== index))
  }

  function startEditEvent(ev) {
    setEditingEventId(ev.id)
    setFormData({
      title: ev.title || '',
      eventType: ev.eventType || 'Workshop',
      status: ev.status || 'UPCOMING',
      dateTime: ev.dateTime ? new Date(ev.dateTime).toISOString().slice(0, 16) : '',
      venue: ev.venue || '',
      location: ev.location || '',
      shortDescription: ev.shortDescription || '',
      description: ev.description || '',
      agenda: ev.agenda || '',
      rules: ev.rules || '',
      capacity: ev.capacity != null ? String(ev.capacity) : '',
      coordinatorName: ev.coordinatorName || '',
      coordinatorContact: ev.coordinatorContact || '',
      organizingTeam: ev.organizingTeam || '',
      isPaid: Boolean(ev.requiresPayment),
      paymentAmount: ev.paymentAmount != null ? String(ev.paymentAmount) : '',
      paymentUpiId: ev.paymentUpiId || '',
      paymentInstructions: ev.paymentInstructions || '',
      hasMultipleActivities: Boolean(ev.allowMultipleActivities),
    })
    setPosterPreview(ev.photoUrl || '')
    setQrPreview(ev.paymentQrUrl || '')
    setActivities(ev.activities ? ev.activities.map(a => ({ name: a.name || '', description: a.description || '', price: a.price || 0, capacity: a.capacity != null ? String(a.capacity) : '' })) : [])
    setFormFields(ev.formFields || [])
    setActiveTab('basic')
    setMessage('')
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingEventId(null)
    setFormData(initialEventForm)
    setPosterPreview('')
    setQrPreview('')
    setActivities([])
    setFormFields([])
    setActiveTab('basic')
    setMessage('')
    setError('')
  }

  async function handleEventSubmit(e) {
    e.preventDefault()
    setMessage('')
    setError('')

    const title = String(formData.title || '').trim()
    const eventType = String(formData.eventType || '').trim()
    const dateTime = String(formData.dateTime || '').trim()

    if (!title) {
      setActiveTab('basic')
      setError('Event Title is required (under Basic Info).')
      return
    }
    if (!eventType) {
      setActiveTab('basic')
      setError('Event Category / Type is required (under Basic Info).')
      return
    }
    if (!dateTime) {
      setActiveTab('basic')
      setError('Event Date & Time is required (under Basic Info).')
      return
    }

    const payload = {
      title,
      eventType,
      dateTime,
      shortDescription: String(formData.shortDescription || '').trim() || null,
      description: String(formData.description || '').trim() || null,
      venue: String(formData.venue || '').trim() || null,
      location: String(formData.location || '').trim() || null,
      capacity: formData.capacity ? Number(formData.capacity) : null,
      photoUrl: posterPreview || null,
      status: String(formData.status || 'UPCOMING'),
      coordinatorName: String(formData.coordinatorName || user.name).trim() || null,
      coordinatorContact: String(formData.coordinatorContact || user.memberId).trim() || null,
      organizingTeam: String(formData.organizingTeam || '').trim() || null,
      rules: String(formData.rules || '').trim() || null,
      agenda: String(formData.agenda || '').trim() || null,
      requiresPayment: Boolean(formData.isPaid),
      paymentAmount: formData.isPaid && formData.paymentAmount ? Number(formData.paymentAmount) : null,
      paymentQrUrl: formData.isPaid ? qrPreview || null : null,
      paymentUpiId: formData.isPaid ? String(formData.paymentUpiId || '').trim() || null : null,
      paymentInstructions: formData.isPaid ? String(formData.paymentInstructions || '').trim() || null : null,
      allowMultipleActivities: Boolean(formData.hasMultipleActivities),
      activities: formData.hasMultipleActivities
        ? activities.map(a => ({ name: a.name, description: a.description || null, price: Number(a.price || 0), capacity: a.capacity ? Number(a.capacity) : null }))
        : [],
      formFields,
    }

    setSubmitting(true)
    try {
      if (editingEventId) {
        const { event: updated } = await adminApi.updateEvent(editingEventId, payload)
        setEvents(c => c.map(ev => (ev.id === editingEventId ? updated : ev)))
        setMessage(`✓ Event "${updated.title}" updated successfully.`)
        cancelEdit()
      } else {
        const { event: created } = await adminApi.createEvent(payload)
        setEvents(c => [created, ...c])
        setMessage(`✓ Event "${created.title}" published! Created by ${user.name} (${user.memberId}).`)
        setFormData(initialEventForm)
        setPosterPreview('')
        setQrPreview('')
        setActivities([])
        setFormFields([])
        setActiveTab('basic')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function removeEvent(id) {
    if (!confirm('Are you sure you want to delete this event and all its registrations?')) return
    try {
      await adminApi.deleteEvent(id)
      setEvents(c => c.filter(e => e.id !== id))
      if (editingEventId === id) cancelEdit()
      setMessage('Event deleted.')
    } catch (err) {
      setError(err.message)
    }
  }

  async function openAnalytics(event) {
    setAnalyticsModalEvent(event)
    setLoadingAnalytics(true)
    try {
      const data = await adminApi.getEventDetailsWithStats(event.id)
      setAnalyticsData(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingAnalytics(false)
    }
  }

  return (
    <LivePortal user={user} logout={logout} activeTab="admin-events" onNavigate={onNavigate} title="EVENT STUDIO & ANALYTICS">
      <section className="event-management">
        <div className="event-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('admin-dashboard')}>
              ← COMMAND CENTER
            </button>
            <p className="eyebrow">COMPREHENSIVE WORKFLOW STUDIO</p>
            <h1>Club Events & Master Studio</h1>
            <p>Publish workshops, CTF competitions, seminars, and custom-tiered activity events.</p>
          </div>
          <div className="event-hero-stats">
            <span><b>{events.length}</b><small>Total Events</small></span>
            <span><b>{events.filter(e => e.status === 'UPCOMING').length}</b><small>Upcoming</small></span>
          </div>
        </div>

        {message && <p className="member-form-success">{message}</p>}
        {error && <p className="member-form-error">{error}</p>}

        <div className="event-management-grid">
          {/* Event Builder Studio Card */}
          <article className="account-form-card">
            <p className="eyebrow">{editingEventId ? 'EDITING EVENT' : 'EVENT BUILDER'}</p>
            <h2>{editingEventId ? 'Update Event Details' : 'Create & Publish New Event'}</h2>
            <p style={{ color: '#7e95a7', fontSize: '11px', margin: '4px 0 16px' }}>
              Coordinator: <b style={{ color: '#85d7ff' }}>{user.name} ({user.memberId})</b>
            </p>

            <div className="audit-tabs">
              <button type="button" className={`audit-tab-btn ${activeTab === 'basic' ? 'active' : ''}`} onClick={() => setActiveTab('basic')}>1. Basic Info</button>
              <button type="button" className={`audit-tab-btn ${activeTab === 'details' ? 'active' : ''}`} onClick={() => setActiveTab('details')}>2. Agenda & Rules</button>
              <button type="button" className={`audit-tab-btn ${activeTab === 'pricing' ? 'active' : ''}`} onClick={() => setActiveTab('pricing')}>3. Pricing & Tracks</button>
              <button type="button" className={`audit-tab-btn ${activeTab === 'fields' ? 'active' : ''}`} onClick={() => setActiveTab('fields')}>4. Registration Fields</button>
            </div>

            <form onSubmit={handleEventSubmit}>
              {/* Tab 1: Basic Info */}
              {activeTab === 'basic' && (
                <div className="member-form-grid">
                  <label className="form-wide">
                    Event Title *
                    <input
                      name="title"
                      required
                      placeholder="e.g. Offensive Cyber Operations Workshop 2026"
                      value={formData.title}
                      onChange={e => updateFormField('title', e.target.value)}
                    />
                  </label>
                  <label>
                    Category / Type *
                    <select
                      className="member-select"
                      name="eventType"
                      value={formData.eventType}
                      onChange={e => updateFormField('eventType', e.target.value)}
                    >
                      <option value="Workshop">Hands-on Workshop</option>
                      <option value="CTF">CTF Competition</option>
                      <option value="Seminar">Guest Seminar</option>
                      <option value="Bootcamp">Security Bootcamp</option>
                      <option value="Hackathon">Cyber Hackathon</option>
                    </select>
                  </label>
                  <label>
                    Status
                    <select
                      className="member-select"
                      name="status"
                      value={formData.status}
                      onChange={e => updateFormField('status', e.target.value)}
                    >
                      <option value="UPCOMING">Upcoming</option>
                      <option value="OPEN">Open for Registration</option>
                      <option value="LIVE">Live Now</option>
                      <option value="COMPLETED">Completed</option>
                    </select>
                  </label>
                  <label>
                    Date & Time *
                    <input
                      name="dateTime"
                      type="datetime-local"
                      required
                      value={formData.dateTime}
                      onChange={e => updateFormField('dateTime', e.target.value)}
                    />
                  </label>
                  <label>
                    Venue / Lab
                    <input
                      name="venue"
                      placeholder="e.g. Cyber Defense Lab 304"
                      value={formData.venue}
                      onChange={e => updateFormField('venue', e.target.value)}
                    />
                  </label>
                  <label>
                    Max Capacity (Optional)
                    <input
                      name="capacity"
                      type="number"
                      placeholder="e.g. 100 (leave blank for unlimited)"
                      value={formData.capacity}
                      onChange={e => updateFormField('capacity', e.target.value)}
                    />
                  </label>
                  <label className="form-wide">
                    Short Synopsis
                    <input
                      name="shortDescription"
                      placeholder="One-line summary for event catalog"
                      value={formData.shortDescription}
                      onChange={e => updateFormField('shortDescription', e.target.value)}
                    />
                  </label>
                  <label className="form-wide">
                    Event Poster / Banner
                    <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) readImageFile(f, setPosterPreview) }} />
                  </label>
                  {posterPreview && (
                    <div className="event-upload-preview form-wide">
                      <img src={posterPreview} alt="Poster" />
                      <button type="button" className="preview-remove" onClick={() => setPosterPreview('')}>✕</button>
                    </div>
                  )}

                  <div className="form-wide" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                    <button type="button" className="action-btn save-btn" onClick={() => setActiveTab('details')}>
                      Next: Agenda & Rules →
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 2: Agenda & Rules */}
              {activeTab === 'details' && (
                <div className="member-form-grid">
                  <label className="form-wide">
                    Full Description
                    <textarea
                      name="description"
                      placeholder="Comprehensive event overview..."
                      value={formData.description}
                      onChange={e => updateFormField('description', e.target.value)}
                      style={{ width: '100%', height: '80px', background: '#050a12', border: '1px solid var(--line)', borderRadius: '6px', color: '#fff', padding: '10px' }}
                    />
                  </label>
                  <label className="form-wide">
                    Agenda & Schedule
                    <textarea
                      name="agenda"
                      placeholder="10:00 AM - Keynote&#10;11:30 AM - Lab 1"
                      value={formData.agenda}
                      onChange={e => updateFormField('agenda', e.target.value)}
                      style={{ width: '100%', height: '80px', background: '#050a12', border: '1px solid var(--line)', borderRadius: '6px', color: '#fff', padding: '10px' }}
                    />
                  </label>
                  <label className="form-wide">
                    Rules & Code of Ethics
                    <textarea
                      name="rules"
                      placeholder="All testing must remain strictly within assigned subnets."
                      value={formData.rules}
                      onChange={e => updateFormField('rules', e.target.value)}
                      style={{ width: '100%', height: '80px', background: '#050a12', border: '1px solid var(--line)', borderRadius: '6px', color: '#fff', padding: '10px' }}
                    />
                  </label>
                  <label className="form-wide">
                    Specific Room / Location Details
                    <input
                      name="location"
                      placeholder="e.g. Block C, Floor 3, Terminal 12-40"
                      value={formData.location}
                      onChange={e => updateFormField('location', e.target.value)}
                    />
                  </label>

                  <div className="form-wide" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                    <button type="button" className="action-btn cancel-btn" onClick={() => setActiveTab('basic')}>
                      ← Back to Basic Info
                    </button>
                    <button type="button" className="action-btn save-btn" onClick={() => setActiveTab('pricing')}>
                      Next: Pricing & Tracks →
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 3: Pricing & Tracks */}
              {activeTab === 'pricing' && (
                <div className="member-form-grid">
                  <label className="form-wide" style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.isPaid}
                      onChange={e => updateFormField('isPaid', e.target.checked)}
                      style={{ width: 'auto', height: 'auto' }}
                    />
                    <b style={{ color: '#edf7ff', fontSize: '13px' }}>Requires Registration Payment</b>
                  </label>

                  {formData.isPaid && (
                    <>
                      <label>
                        Base Entry Fee (₹)
                        <input
                          name="paymentAmount"
                          type="number"
                          step="0.01"
                          placeholder="e.g. 150.00"
                          value={formData.paymentAmount}
                          onChange={e => updateFormField('paymentAmount', e.target.value)}
                        />
                      </label>
                      <label>
                        UPI ID for Event Payment
                        <input
                          name="paymentUpiId"
                          placeholder="club@okaxis"
                          value={formData.paymentUpiId}
                          onChange={e => updateFormField('paymentUpiId', e.target.value)}
                        />
                      </label>
                      <label className="form-wide">
                        Payment Instructions / Notes
                        <input
                          name="paymentInstructions"
                          placeholder="e.g. Include your Member ID in transaction remarks"
                          value={formData.paymentInstructions}
                          onChange={e => updateFormField('paymentInstructions', e.target.value)}
                        />
                      </label>
                      <label className="form-wide">
                        Payment QR Code
                        <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) readImageFile(f, setQrPreview) }} />
                      </label>
                      {qrPreview && (
                        <div className="event-upload-preview form-wide">
                          <img src={qrPreview} alt="QR preview" />
                          <button type="button" className="preview-remove" onClick={() => setQrPreview('')}>✕</button>
                        </div>
                      )}
                    </>
                  )}

                  <label className="form-wide" style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginTop: '12px' }}>
                    <input
                      type="checkbox"
                      checked={formData.hasMultipleActivities}
                      onChange={e => updateFormField('hasMultipleActivities', e.target.checked)}
                      style={{ width: 'auto', height: 'auto' }}
                    />
                    <b style={{ color: '#edf7ff', fontSize: '13px' }}>Offer Multiple Sub-Activities / Tracks</b>
                  </label>

                  {formData.hasMultipleActivities && (
                    <div className="form-wide" style={{ marginTop: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <b style={{ color: '#85d7ff', fontSize: '12px' }}>Track / Activity List</b>
                        <button type="button" className="action-btn save-btn" onClick={addActivity}>＋ Add Track</button>
                      </div>
                      {activities.map((act, i) => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '8px', marginBottom: '8px' }}>
                          <input placeholder="Track name" value={act.name} onChange={e => updateActivity(i, 'name', e.target.value)} />
                          <input type="number" placeholder="Price (₹)" value={act.price} onChange={e => updateActivity(i, 'price', e.target.value)} />
                          <input type="number" placeholder="Capacity" value={act.capacity} onChange={e => updateActivity(i, 'capacity', e.target.value)} />
                          <button type="button" className="action-btn delete-btn" onClick={() => removeActivity(i)}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="form-wide" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                    <button type="button" className="action-btn cancel-btn" onClick={() => setActiveTab('details')}>
                      ← Back to Agenda & Rules
                    </button>
                    <button type="button" className="action-btn save-btn" onClick={() => setActiveTab('fields')}>
                      Next: Registration Fields →
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 4: Registration Fields */}
              {activeTab === 'fields' && (
                <div className="member-form-grid">
                  <div className="form-wide">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <b style={{ color: '#85d7ff', fontSize: '12px' }}>Custom Registration Questions</b>
                      <button type="button" className="action-btn save-btn" onClick={addCustomField}>＋ Add Question</button>
                    </div>
                    {formFields.length === 0 ? (
                      <p style={{ color: '#7e95a7', fontSize: '12px', margin: '8px 0' }}>No custom questions added. Default member fields (Name, Member ID, Email) will be used.</p>
                    ) : (
                      formFields.map((ff, i) => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto auto', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                          <input placeholder="Question prompt" value={ff.fieldName} onChange={e => updateCustomField(i, 'fieldName', e.target.value)} />
                          <select value={ff.fieldType} onChange={e => updateCustomField(i, 'fieldType', e.target.value)} className="member-select" style={{ marginTop: 0 }}>
                            <option value="text">Short Text</option>
                            <option value="textarea">Paragraph</option>
                            <option value="select">Dropdown</option>
                          </select>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#829bb0' }}>
                            <input type="checkbox" checked={ff.isRequired} onChange={e => updateCustomField(i, 'isRequired', e.target.checked)} />
                            Req
                          </label>
                          <button type="button" className="action-btn delete-btn" onClick={() => removeCustomField(i)}>✕</button>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="form-wide" style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '10px' }}>
                    <button type="button" className="action-btn cancel-btn" onClick={() => setActiveTab('pricing')}>
                      ← Back to Pricing & Tracks
                    </button>
                  </div>
                </div>
              )}

              <div className="event-actions" style={{ marginTop: '22px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button type="submit" className="primary member-submit" disabled={submitting}>
                  {submitting ? 'SAVING EVENT…' : editingEventId ? '✓ &nbsp; UPDATE EVENT' : '＋ &nbsp; PUBLISH EVENT'}
                </button>
                {editingEventId && (
                  <button type="button" className="action-btn cancel-btn" onClick={cancelEdit}>
                    Cancel Editing
                  </button>
                )}
              </div>
            </form>
          </article>

          {/* Events Directory Card */}
          <article className="member-list-card">
            <div className="card-heading">
              <div>
                <p className="eyebrow">EVENT CATALOG</p>
                <h2>Published Events ({events.length})</h2>
              </div>
            </div>

            {loading ? (
              <p className="directory-state">Loading events...</p>
            ) : events.length === 0 ? (
              <p className="directory-state">No events published yet.</p>
            ) : (
              <div className="table-scroll-container">
                <div className="events-table">
                  <div className="table-header">
                    <span>EVENT TITLE</span>
                    <span>DATE</span>
                    <span>VENUE</span>
                    <span>PASSES</span>
                    <span>ACTIONS</span>
                  </div>
                  {events.map(ev => (
                    <div className="table-row" key={ev.id}>
                      <div>
                        <b>{ev.title}</b>
                        <small style={{ color: '#85d7ff', display: 'block' }}>{ev.eventType} {ev.coordinatorName ? `· Coord: ${ev.coordinatorName}` : ''}</small>
                      </div>
                      <div>
                        <small>{new Date(ev.dateTime).toLocaleDateString()}</small>
                        <small style={{ color: '#688296', display: 'block' }}>{new Date(ev.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                      </div>
                      <div>
                        <small>{ev.venue || ev.location || 'Campus'}</small>
                      </div>
                      <div>
                        <strong style={{ color: '#85d7ff' }}>{ev.registrationCount ?? ev._count?.registrations ?? 0}</strong>
                        <small> / {ev.capacity || '∞'}</small>
                      </div>
                      <div className="action-buttons">
                        <button className="action-btn" onClick={() => startEditEvent(ev)} style={{ background: '#193854', color: '#85d7ff', border: '1px solid #52bbf544' }}>Edit</button>
                        <button className="action-btn save-btn" onClick={() => openAnalytics(ev)}>Passes</button>
                        <button className="action-btn delete-btn" onClick={() => removeEvent(ev.id)}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </article>
        </div>

        {/* Analytics & Passes Modal */}
        {analyticsModalEvent && (
          <div className="photo-lightbox" onClick={() => setAnalyticsModalEvent(null)}>
            <div className="photo-lightbox-content" onClick={e => e.stopPropagation()} style={{ background: '#0d1522', padding: '28px', borderRadius: '12px', border: '1px solid var(--line)', maxWidth: '720px', maxHeight: '85vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <b style={{ color: '#85d7ff', fontSize: '16px' }}>{analyticsModalEvent.title}</b>
                  <small style={{ display: 'block', color: '#7e95a7' }}>Registration & Attendee Roster</small>
                </div>
                <button className="lightbox-close" onClick={() => setAnalyticsModalEvent(null)} style={{ position: 'static' }}>✕</button>
              </div>

              {loadingAnalytics ? (
                <p className="directory-state">Loading registrations...</p>
              ) : !analyticsData?.registrations || analyticsData.registrations.length === 0 ? (
                <p className="directory-state">No student registrations for this event yet.</p>
              ) : (
                <div className="table-scroll-container">
                  <div className="members-table">
                    <div className="table-header">
                      <span>STUDENT</span>
                      <span>REGISTERED AT</span>
                      <span>PASS STATUS</span>
                      <span>PAYMENT</span>
                    </div>
                    {analyticsData.registrations.map(r => (
                      <div className="table-row" key={r.id}>
                        <div>
                          <b>{r.user?.profile?.name || r.user?.memberId}</b>
                          <small style={{ color: '#85d7ff', display: 'block' }}>{r.user?.memberId}</small>
                        </div>
                        <div>
                          <small>{new Date(r.registeredAt).toLocaleString()}</small>
                        </div>
                        <div>
                          <span className="badge badge-registered">{r.status}</span>
                        </div>
                        <div>
                          <strong style={{ color: '#70ddb4' }}>{r.paymentStatus}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Event Detail & Registration Page (Student)
// ----------------------------------------------------
function StudentEventDetail({ user, eventId, logout, onNavigate }) {
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [selectedActivities, setSelectedActivities] = useState([])
  const [proofPreview, setProofPreview] = useState('')
  const [subRequired, setSubRequired] = useState(false)

  useEffect(() => {
    let mounted = true
    memberApi.getEventDetails(eventId)
      .then(res => { if (mounted) setEvent(res.event) })
      .catch(err => { if (mounted) setError(err.message) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [eventId])

  function toggleActivity(actId) {
    if (event?.allowMultipleActivities) {
      setSelectedActivities(c => (c.includes(actId) ? c.filter(id => id !== actId) : [...c, actId]))
    } else {
      setSelectedActivities([actId])
    }
  }

  async function handleRegister(e) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setError('')
    setMessage('')
    setSubRequired(false)

    const payload = {
      selectedActivityIds: selectedActivities,
      paymentReference: String(form.get('paymentReference') || '').trim() || null,
      paymentProofUrl: proofPreview || null,
      teamName: String(form.get('teamName') || '').trim() || null,
      emergencyContact: String(form.get('emergencyContact') || '').trim() || null,
    }

    setSubmitting(true)
    try {
      await memberApi.registerForEvent(eventId, payload)
      setMessage('Registration confirmed! Your QR Pass is available in "My Passes".')
      setEvent(ev => ({ ...ev, isRegistered: true }))
    } catch (err) {
      if (err.code === 'SUBSCRIPTION_REQUIRED' || err.message?.includes('membership is inactive')) {
        setSubRequired(true)
      }
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <LivePortal user={user} logout={logout} activeTab="student-events" onNavigate={onNavigate} title="EVENT DETAILS">
        <p className="directory-state">Loading event details...</p>
      </LivePortal>
    )
  }

  if (!event) {
    return (
      <LivePortal user={user} logout={logout} activeTab="student-events" onNavigate={onNavigate} title="EVENT DETAILS">
        <button className="back-button" onClick={() => onNavigate('student-events')}>← BACK TO EVENTS</button>
        <p className="directory-state">Event not found.</p>
      </LivePortal>
    )
  }

  const basePrice = event.paymentAmount || 0
  const activityPrice = (event.activities || [])
    .filter(a => selectedActivities.includes(a.id))
    .reduce((sum, a) => sum + (Number(a.price) || 0), 0)
  const totalPrice = basePrice + activityPrice

  return (
    <LivePortal user={user} logout={logout} activeTab="student-events" onNavigate={onNavigate} title="EVENT DETAILS">
      <section className="event-detail-page">
        <button className="back-button" onClick={() => onNavigate('student-events')}>← BACK TO EVENTS CATALOG</button>

        {message && <p className="member-form-success">{message}</p>}
        {error && <p className="member-form-error">{error}</p>}

        {subRequired && (
          <div className="pending-alert-banner" style={{ background: '#3a1818', borderColor: '#ef4444', color: '#ffcdd2' }}>
            <div>
              <b>Active Student Membership Required</b>
              <p style={{ margin: '2px 0 0', fontSize: '11px' }}>
                Please subscribe to unlock event passes and activities.
              </p>
            </div>
            <button type="button" onClick={() => onNavigate('student-membership')} style={{ background: '#ef4444', color: '#fff' }}>
              SUBSCRIBE NOW →
            </button>
          </div>
        )}

        <div className="event-detail-hero">
          <div className="event-detail-main">
            <div className="event-detail-banner">
              {event.photoUrl ? (
                <img src={event.photoUrl} alt={event.title} />
              ) : (
                <div className="event-banner-fallback" style={{ height: '100%' }}>
                  <strong>{event.eventType.toUpperCase()}</strong>
                </div>
              )}
            </div>

            <div className="event-info-box">
              <span className="badge badge-president">{event.eventType}</span>
              <h1 style={{ font: '700 clamp(24px, 3vw, 36px) Syne', color: '#edf7ff', margin: '12px 0 8px' }}>{event.title}</h1>
              <p style={{ color: '#9bb7cc', fontSize: '14px', lineHeight: '1.7' }}>{event.description || event.shortDescription}</p>

              {event.agenda && (
                <div style={{ marginTop: '24px' }}>
                  <b style={{ color: '#85d7ff', fontSize: '13px' }}>AGENDA & SCHEDULE</b>
                  <pre style={{ color: '#cbdfe9', font: '12px Manrope', whiteSpace: 'pre-wrap', marginTop: '8px' }}>{event.agenda}</pre>
                </div>
              )}

              {event.rules && (
                <div style={{ marginTop: '24px' }}>
                  <b style={{ color: '#85d7ff', fontSize: '13px' }}>RULES & ETHICS</b>
                  <pre style={{ color: '#cbdfe9', font: '12px Manrope', whiteSpace: 'pre-wrap', marginTop: '8px' }}>{event.rules}</pre>
                </div>
              )}
            </div>
          </div>

          {/* Registration Form Sidebar */}
          <div>
            <article className="account-form-card" style={{ position: 'sticky', top: '20px' }}>
              <p className="eyebrow">REGISTRATION PASS</p>
              <h2>{event.isRegistered ? 'Registration Confirmed' : 'Reserve Your Slot'}</h2>

              <div style={{ margin: '14px 0', padding: '12px', background: '#050a12', borderRadius: '8px', border: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#829bb0', marginBottom: '6px' }}>
                  <span>Date & Time:</span>
                  <b style={{ color: '#fff' }}>{new Date(event.dateTime).toLocaleDateString()}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#829bb0', marginBottom: '6px' }}>
                  <span>Venue:</span>
                  <b style={{ color: '#fff' }}>{event.venue || event.location || 'Campus'}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#829bb0' }}>
                  <span>Coordinator:</span>
                  <b style={{ color: '#85d7ff' }}>{event.coordinatorName || 'Club Leadership'}</b>
                </div>
              </div>

              {event.isRegistered ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <span className="badge badge-registered" style={{ fontSize: '12px', padding: '6px 14px' }}>✓ PASS ACTIVE</span>
                  <p style={{ color: '#829bb0', fontSize: '12px', marginTop: '10px' }}>
                    You have reserved a slot for this event. View your QR Pass under "My Passes".
                  </p>
                  <button className="outline" type="button" onClick={() => onNavigate('student-registrations')}>
                    VIEW MY PASSES →
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRegister}>
                  {event.activities && event.activities.length > 0 && (
                    <div style={{ margin: '14px 0' }}>
                      <b style={{ color: '#85d7ff', fontSize: '12px' }}>Select Activity / Track:</b>
                      <div className="activity-selector-list">
                        {event.activities.map(act => (
                          <div
                            key={act.id}
                            className={`activity-option ${selectedActivities.includes(act.id) ? 'selected' : ''}`}
                            onClick={() => toggleActivity(act.id)}
                          >
                            <div>
                              <b>{act.name}</b>
                              {act.description && <small style={{ display: 'block', color: '#7e95a7' }}>{act.description}</small>}
                            </div>
                            <span className="activity-price">{act.price > 0 ? `₹${act.price}` : 'INCLUDED'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {event.requiresPayment && (
                    <div style={{ margin: '14px 0' }}>
                      <div className="total-price-badge">
                        <span>Total Entry Fee:</span>
                        <span>₹{totalPrice.toFixed(2)}</span>
                      </div>

                      {event.paymentQrUrl && (
                        <div style={{ textAlign: 'center', margin: '10px 0' }}>
                          <img src={event.paymentQrUrl} alt="QR Code" style={{ maxWidth: '140px', borderRadius: '8px', border: '1px solid #52bbf544' }} />
                          {event.paymentUpiId && <small style={{ display: 'block', color: '#85d7ff', marginTop: '4px' }}>UPI: {event.paymentUpiId}</small>}
                        </div>
                      )}

                      <label style={{ display: 'block', fontSize: '11px', color: '#b4c7d5', marginBottom: '6px' }}>
                        Transaction / UTR Reference ID
                        <input name="paymentReference" required placeholder="UPI Reference or Bank Txn ID" style={{ width: '100%', height: '38px', background: '#050a12', border: '1px solid var(--line)', borderRadius: '6px', color: '#fff', padding: '0 10px', marginTop: '4px' }} />
                      </label>
                    </div>
                  )}

                  <button className="primary" disabled={submitting} style={{ width: '100%', minHeight: '44px', marginTop: '12px' }}>
                    {submitting ? 'CONFIRMING…' : 'CONFIRM REGISTRATION'}
                  </button>
                </form>
              )}
            </article>
          </div>
        </div>
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Payment Management (Admin - Event Payments)
// ----------------------------------------------------
function PaymentManagement({ user, logout, onNavigate }) {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    adminApi.listPayments()
      .then(({ registrations }) => { if (mounted) setPayments(registrations || []) })
      .catch(err => { if (mounted) setError(err.message) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  async function handleVerify(regId, status) {
    try {
      await adminApi.verifyPayment(regId, status)
      setPayments(c => c.map(p => (p.id === regId ? { ...p, paymentStatus: status } : p)))
      setMessage(`Payment updated to ${status}.`)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <LivePortal user={user} logout={logout} activeTab="admin-payments" onNavigate={onNavigate} title="EVENT PAYMENTS">
      <section className="member-management">
        <div className="member-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('admin-dashboard')}>
              ← COMMAND CENTER
            </button>
            <p className="eyebrow">FINANCIAL AUDIT</p>
            <h1>Event Registration Payments</h1>
            <p>Verify bank reference proofs and manage attendee payment states.</p>
          </div>
          <button className="outline" type="button" onClick={() => onNavigate('admin-subscriptions')}>
            💎 VIEW STUDENT MEMBERSHIP SUBSCRIPTIONS →
          </button>
        </div>

        {message && <p className="member-form-success">{message}</p>}
        {error && <p className="member-form-error">{error}</p>}

        <article className="member-list-card">
          {loading ? (
            <p className="directory-state">Loading payments...</p>
          ) : payments.length === 0 ? (
            <p className="directory-state">No event payments submitted yet.</p>
          ) : (
            <div className="table-scroll-container">
              <div className="sub-table">
                <div className="sub-table-header" style={{ gridTemplateColumns: '1.2fr 1.2fr 1fr 1fr 1fr' }}>
                  <span>STUDENT</span>
                  <span>EVENT</span>
                  <span>AMOUNT / REF</span>
                  <span>STATUS</span>
                  <span>ACTIONS</span>
                </div>
                {payments.map(p => (
                  <div className="sub-table-row" key={p.id} style={{ gridTemplateColumns: '1.2fr 1.2fr 1fr 1fr 1fr' }}>
                    <div>
                      <b>{p.user?.profile?.name || p.user?.memberId}</b>
                      <small style={{ color: '#85d7ff', display: 'block' }}>{p.user?.memberId}</small>
                    </div>
                    <div>
                      <b>{p.event?.title}</b>
                    </div>
                    <div>
                      <strong style={{ color: '#70ddb4' }}>₹{Number(p.totalAmount || 0).toFixed(2)}</strong>
                      <small style={{ color: '#8aa2b4', display: 'block' }}>Ref: {p.paymentReference || 'None'}</small>
                    </div>
                    <div>
                      <span className={`badge badge-${p.paymentStatus.toLowerCase()}`}>{p.paymentStatus}</span>
                    </div>
                    <div className="action-buttons">
                      {p.paymentStatus !== 'VERIFIED' && (
                        <button className="action-btn save-btn" onClick={() => handleVerify(p.id, 'VERIFIED')}>Verify</button>
                      )}
                      {p.paymentStatus !== 'REJECTED' && (
                        <button className="action-btn delete-btn" onClick={() => handleVerify(p.id, 'REJECTED')}>Reject</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </article>
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Interactive Photo Lightbox with Prev/Next Navigation
// ----------------------------------------------------
function GalleryLightbox({ photos = [], activePhoto, onClose, onSelectPhoto, onDeletePhoto, albumName }) {
  const [currentIndex, setCurrentIndex] = useState(() => {
    const idx = photos.findIndex(p => p.id === activePhoto?.id)
    return idx >= 0 ? idx : 0
  })

  useEffect(() => {
    if (activePhoto) {
      const idx = photos.findIndex(p => p.id === activePhoto.id)
      if (idx >= 0) setCurrentIndex(idx)
    }
  }, [activePhoto, photos])

  const currentPhoto = photos[currentIndex] || activePhoto
  const totalCount = photos.length || (currentPhoto ? 1 : 0)

  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < photos.length - 1

  function handlePrev(e) {
    if (e) e.stopPropagation()
    if (hasPrev) {
      const nextIdx = currentIndex - 1
      setCurrentIndex(nextIdx)
      if (onSelectPhoto && photos[nextIdx]) onSelectPhoto(photos[nextIdx])
    }
  }

  function handleNext(e) {
    if (e) e.stopPropagation()
    if (hasNext) {
      const nextIdx = currentIndex + 1
      setCurrentIndex(nextIdx)
      if (onSelectPhoto && photos[nextIdx]) onSelectPhoto(photos[nextIdx])
    }
  }

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'ArrowLeft') handlePrev()
      else if (e.key === 'ArrowRight') handleNext()
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentIndex, photos, hasPrev, hasNext])

  if (!currentPhoto) return null

  return (
    <div className="photo-lightbox" onClick={onClose}>
      <div className="photo-lightbox-content" onClick={e => e.stopPropagation()}>
        {/* Header Bar */}
        <div className="lightbox-header-bar">
          <span className="lightbox-counter-badge">
            📸 PHOTO {totalCount > 0 ? currentIndex + 1 : 1} OF {totalCount}
          </span>
          <button className="lightbox-close" onClick={onClose} title="Close (Esc)">✕</button>
        </div>

        {/* Main Photo Area with Left/Right Navigation Buttons */}
        <div className="photo-lightbox-main">
          {photos.length > 1 && (
            <button
              type="button"
              className="lightbox-nav-btn prev"
              onClick={handlePrev}
              disabled={!hasPrev}
              title="Previous Photo (← Left Arrow)"
            >
              ‹
            </button>
          )}

          <img src={currentPhoto.imageUrl} alt={currentPhoto.caption || albumName || 'Gallery Photo'} />

          {photos.length > 1 && (
            <button
              type="button"
              className="lightbox-nav-btn next"
              onClick={handleNext}
              disabled={!hasNext}
              title="Next Photo (→ Right Arrow)"
            >
              ›
            </button>
          )}
        </div>

        {/* Caption, Date & Admin Actions */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', padding: '0 6px' }}>
          <div>
            <p style={{ color: '#edf7ff', margin: 0, fontSize: '13px', fontWeight: 600 }}>
              {currentPhoto.caption || albumName || 'Club Gallery Photo'}
            </p>
            <small style={{ color: '#85d7ff', fontSize: '10px' }}>
              {currentPhoto.createdAt ? new Date(currentPhoto.createdAt).toLocaleDateString() : ''}
            </small>
          </div>

          {onDeletePhoto && (
            <button
              type="button"
              className="action-btn delete-btn"
              onClick={e => onDeletePhoto(currentPhoto.id, e)}
              style={{ padding: '5px 12px', fontSize: '11px' }}
            >
              🗑 Delete Photo
            </button>
          )}
        </div>

        {/* Miniature Thumbnails Strip */}
        {photos.length > 1 && (
          <div className="lightbox-thumbnail-strip">
            {photos.map((p, idx) => (
              <div
                key={p.id}
                className={`lightbox-thumb ${idx === currentIndex ? 'active' : ''}`}
                onClick={() => {
                  setCurrentIndex(idx)
                  if (onSelectPhoto) onSelectPhoto(p)
                }}
                title={p.caption || `Photo ${idx + 1}`}
              >
                <img src={p.imageUrl} alt={`Thumbnail ${idx + 1}`} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ----------------------------------------------------
// Gallery Studio (Admin)
// ----------------------------------------------------
function GalleryManagement({ user, logout, onNavigate }) {
  const [albums, setAlbums] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [selectedAlbum, setSelectedAlbum] = useState(null)
  const [albumCoverPreview, setAlbumCoverPreview] = useState('')
  const [stagedPhotos, setStagedPhotos] = useState([])
  const [batchCaption, setBatchCaption] = useState('')
  const [uploading, setUploading] = useState(false)
  const [activeLightbox, setActiveLightbox] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    let mounted = true
    adminApi.listGalleryAlbums()
      .then(({ albums: list }) => { if (mounted) setAlbums(list || []) })
      .catch(err => { if (mounted) setError(err.message) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  async function createAlbum(e) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setMessage('')
    setError('')
    try {
      const { album } = await adminApi.createGalleryAlbum({
        name: String(form.get('name') || '').trim(),
        description: String(form.get('description') || '').trim() || null,
        coverImage: albumCoverPreview || null,
      })
      setAlbums(c => [album, ...c])
      setSelectedAlbum(album)
      e.currentTarget.reset()
      setAlbumCoverPreview('')
      setMessage(`Album "${album.name}" created successfully.`)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handlePhotosSelected(e) {
    const files = e.target.files
    if (!files || files.length === 0) return
    setError('')
    try {
      const loaded = await readMultipleImageFiles(files)
      const newStaged = loaded.map(item => ({
        id: 'staged_' + Math.random().toString(36).slice(2, 9),
        name: item.name,
        size: item.size,
        dataUrl: item.dataUrl,
      }))
      setStagedPhotos(curr => [...curr, ...newStaged])
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      setError('Failed to read selected image files: ' + err.message)
    }
  }

  function removeStagedPhoto(id) {
    setStagedPhotos(curr => curr.filter(p => p.id !== id))
  }

  function clearStagedPhotos() {
    setStagedPhotos([])
    setBatchCaption('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function uploadStagedPhotos(e) {
    e.preventDefault()
    if (!selectedAlbum) return
    if (stagedPhotos.length === 0) {
      setError('Please select at least one photo to upload.')
      return
    }

    setUploading(true)
    setMessage('')
    setError('')

    try {
      const photosPayload = stagedPhotos.map(p => ({
        imageUrl: p.dataUrl,
        caption: batchCaption ? batchCaption.trim() : null,
      }))

      const res = await adminApi.addGalleryPhotos(selectedAlbum.id, photosPayload)
      const addedPhotos = res.photos || (res.photo ? [res.photo] : [])

      setSelectedAlbum(a => ({
        ...a,
        coverImage: a.coverImage || addedPhotos[0]?.imageUrl || null,
        photos: [...addedPhotos, ...(a.photos || [])],
      }))

      setAlbums(curr =>
        curr.map(a => {
          if (a.id === selectedAlbum.id) {
            return {
              ...a,
              coverImage: a.coverImage || addedPhotos[0]?.imageUrl || null,
              photos: [...addedPhotos, ...(a.photos || [])],
            }
          }
          return a
        })
      )

      clearStagedPhotos()
      setMessage(`✓ ${addedPhotos.length} photo${addedPhotos.length > 1 ? 's' : ''} uploaded successfully to "${selectedAlbum.name}".`)
    } catch (err) {
      setError(err.message || 'Failed to upload photos.')
    } finally {
      setUploading(false)
    }
  }

  async function removeAlbum(albumId, e) {
    if (e) e.stopPropagation()
    if (!confirm('Are you sure you want to delete this album and all its photos?')) return
    try {
      await adminApi.deleteGalleryAlbum(albumId)
      setAlbums(c => c.filter(a => a.id !== albumId))
      if (selectedAlbum?.id === albumId) setSelectedAlbum(null)
      setMessage('Album deleted.')
    } catch (err) {
      setError(err.message)
    }
  }

  async function removePhoto(albumId, photoId, e) {
    if (e) e.stopPropagation()
    if (!confirm('Are you sure you want to delete this photo?')) return
    try {
      await adminApi.deleteGalleryPhoto(albumId, photoId)
      setSelectedAlbum(a => ({ ...a, photos: a.photos.filter(p => p.id !== photoId) }))
      setAlbums(c => c.map(a => (a.id === albumId ? { ...a, photos: a.photos.filter(p => p.id !== photoId) } : a)))
      if (activeLightbox?.id === photoId) setActiveLightbox(null)
      setMessage('Photo deleted.')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <LivePortal user={user} logout={logout} activeTab="admin-gallery" onNavigate={onNavigate} title="GALLERY STUDIO">
      <section className="gallery-section">
        <div className="event-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('admin-dashboard')}>
              ← COMMAND CENTER
            </button>
            <p className="eyebrow">VISUAL REPOSITORY</p>
            <h1>Media & Gallery Studio</h1>
            <p>Create albums, upload multiple event photos at once, and manage club memories.</p>
          </div>
        </div>

        {message && <p className="member-form-success">{message}</p>}
        {error && <p className="member-form-error">{error}</p>}

        <div className="member-management-grid">
          {/* Create Album Card */}
          <article className="account-form-card">
            <p className="eyebrow">NEW ALBUM</p>
            <h2>Create Photo Album</h2>
            <form onSubmit={createAlbum}>
              <label>
                Album Name *
                <input name="name" required placeholder="e.g. Hackathon 2026 Highlights" />
              </label>
              <label>
                Description
                <input name="description" placeholder="Short summary..." />
              </label>
              <label>
                Cover Photo (Optional)
                <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) readImageFile(f, setAlbumCoverPreview) }} />
              </label>
              {albumCoverPreview && (
                <div style={{ margin: '8px 0' }}>
                  <img src={albumCoverPreview} alt="Cover Preview" style={{ maxHeight: '90px', borderRadius: '6px', border: '1px solid var(--line)' }} />
                </div>
              )}
              <button className="primary member-submit" style={{ marginTop: '12px' }}>
                ＋ &nbsp; CREATE ALBUM
              </button>
            </form>
          </article>

          {/* Upload Multiple Photos to Selected Album */}
          {selectedAlbum ? (
            <article className="account-form-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div>
                  <p className="eyebrow">MULTIPLE UPLOAD</p>
                  <h2>Add Photos to "{selectedAlbum.name}"</h2>
                </div>
                <span className="badge" style={{ background: '#0e2439', color: '#85d7ff', border: '1px solid #52bbf544' }}>
                  📸 {selectedAlbum.photos?.length || 0} in album
                </span>
              </div>

              <form onSubmit={uploadStagedPhotos}>
                <label>
                  Choose Images (Select Single or Multiple) *
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotosSelected}
                    style={{ marginTop: '4px' }}
                  />
                </label>

                <label style={{ marginTop: '8px', display: 'block' }}>
                  Caption for this batch (Optional)
                  <input
                    placeholder="e.g. Workshop hands-on session / Finals"
                    value={batchCaption}
                    onChange={e => setBatchCaption(e.target.value)}
                  />
                </label>

                {/* Staged Photos Preview Grid */}
                {stagedPhotos.length > 0 && (
                  <div style={{ marginTop: '14px', background: '#07101b', border: '1px solid #52bbf544', borderRadius: '8px', padding: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <b style={{ color: '#85d7ff', fontSize: '11px' }}>
                        📁 {stagedPhotos.length} Photo{stagedPhotos.length > 1 ? 's' : ''} Ready to Upload
                      </b>
                      <button
                        type="button"
                        onClick={clearStagedPhotos}
                        style={{ background: 'transparent', border: 0, color: '#f87171', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
                      >
                        ✕ Clear All
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '8px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
                      {stagedPhotos.map(p => (
                        <div key={p.id} style={{ position: 'relative', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--line)', background: '#0c1826' }}>
                          <img src={p.dataUrl} alt={p.name} style={{ width: '100%', height: '65px', objectFit: 'cover', display: 'block' }} />
                          <button
                            type="button"
                            onClick={() => removeStagedPhoto(p.id)}
                            title="Remove photo"
                            style={{
                              position: 'absolute',
                              top: '2px',
                              right: '2px',
                              width: '18px',
                              height: '18px',
                              borderRadius: '50%',
                              background: 'rgba(239, 68, 68, 0.9)',
                              color: '#fff',
                              border: 0,
                              fontSize: '10px',
                              display: 'grid',
                              placeItems: 'center',
                              cursor: 'pointer',
                              padding: 0,
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="primary member-submit"
                  disabled={uploading || stagedPhotos.length === 0}
                  style={{ marginTop: '14px' }}
                >
                  {uploading
                    ? `⏳ UPLOADING ${stagedPhotos.length} PHOTO${stagedPhotos.length > 1 ? 'S' : ''}…`
                    : stagedPhotos.length > 0
                    ? `＋ &nbsp; UPLOAD ${stagedPhotos.length} PHOTO${stagedPhotos.length > 1 ? 'S' : ''}`
                    : '＋ &nbsp; UPLOAD PHOTOS'}
                </button>
              </form>
            </article>
          ) : (
            <article className="account-form-card" style={{ display: 'grid', placeContent: 'center', textAlign: 'center', minHeight: '180px', color: '#8aa2b4' }}>
              <p>Click on any album below to select it and upload multiple photos.</p>
            </article>
          )}
        </div>

        {/* Albums List */}
        <div className="section-title" style={{ marginTop: '24px' }}>
          <div>
            <p className="eyebrow">ALBUM DIRECTORY</p>
            <h2>All Albums ({albums.length})</h2>
          </div>
        </div>

        {loading ? (
          <p className="directory-state">Loading gallery albums...</p>
        ) : albums.length === 0 ? (
          <p className="directory-state">No albums created yet.</p>
        ) : (
          <div className="gallery-grid">
            {albums.map(a => (
              <div
                key={a.id}
                className="album-card-box"
                onClick={() => setSelectedAlbum(a)}
                style={{ borderColor: selectedAlbum?.id === a.id ? '#48b7f4' : undefined }}
              >
                <div className="album-cover">
                  {a.coverImage || a.photos?.[0]?.imageUrl ? (
                    <img src={a.coverImage || a.photos[0].imageUrl} alt={a.name} />
                  ) : (
                    <div className="album-cover-placeholder">{a.name.slice(0, 2).toUpperCase()}</div>
                  )}
                  <span className="album-photo-count">{a.photos?.length || 0} photos</span>
                </div>
                <div className="album-details">
                  <h3>{a.name}</h3>
                  <p>{a.description || 'Club photo collection'}</p>
                </div>
                <div style={{ padding: '8px 12px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <small style={{ color: '#85d7ff' }}>{selectedAlbum?.id === a.id ? '✓ Selected' : 'Click to select'}</small>
                  <button type="button" className="action-btn delete-btn" onClick={e => removeAlbum(a.id, e)} title="Delete entire album">
                    🗑 Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Selected Album Photos Grid */}
        {selectedAlbum && (
          <div style={{ marginTop: '36px', borderTop: '1px solid var(--line)', paddingTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p className="eyebrow">SELECTED ALBUM PHOTOS</p>
                <h2>{selectedAlbum.name} ({selectedAlbum.photos?.length || 0} Photos)</h2>
              </div>
              <button type="button" className="action-btn delete-btn" onClick={e => removeAlbum(selectedAlbum.id, e)}>
                🗑 Delete Album
              </button>
            </div>

            {(!selectedAlbum.photos || selectedAlbum.photos.length === 0) ? (
              <p className="directory-state" style={{ marginTop: '16px' }}>No photos uploaded to this album yet. Use the "Upload Photo" card above.</p>
            ) : (
              <div className="gallery-grid" style={{ marginTop: '16px' }}>
                {selectedAlbum.photos.map(p => (
                  <div key={p.id} className="album-card-box" style={{ position: 'relative' }}>
                    <div className="album-cover" onClick={() => setActiveLightbox(p)} style={{ cursor: 'pointer' }}>
                      <img src={p.imageUrl} alt={p.caption || 'Event'} />
                    </div>
                    {p.caption && (
                      <div className="album-details" onClick={() => setActiveLightbox(p)} style={{ cursor: 'pointer' }}>
                        <p>{p.caption}</p>
                      </div>
                    )}
                    <div style={{ padding: '6px 10px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end' }}>
                      <button type="button" className="action-btn delete-btn" onClick={e => removePhoto(selectedAlbum.id, p.id, e)}>
                        🗑 Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Lightbox Modal with Full Navigation */}
        {activeLightbox && (
          <GalleryLightbox
            photos={selectedAlbum?.photos || []}
            activePhoto={activeLightbox}
            albumName={selectedAlbum?.name}
            onClose={() => setActiveLightbox(null)}
            onSelectPhoto={p => setActiveLightbox(p)}
            onDeletePhoto={selectedAlbum ? (photoId, e) => removePhoto(selectedAlbum.id, photoId, e) : null}
          />
        )}
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Team Leadership Management (Admin)
// ----------------------------------------------------
function TeamManagement({ user, logout, onNavigate }) {
  const [team, setTeam] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [photoPreview, setPhotoPreview] = useState('')

  useEffect(() => {
    let mounted = true
    adminApi.listClubTeam()
      .then(({ team: list }) => { if (mounted) setTeam(list || []) })
      .catch(err => { if (mounted) setError(err.message) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  async function createMember(e) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setMessage('')
    setError('')
    try {
      const { member } = await adminApi.createClubTeamMember({
        name: String(form.get('name') || '').trim(),
        roleTitle: String(form.get('roleTitle') || '').trim(),
        collegeEmail: String(form.get('collegeEmail') || '').trim() || null,
        bio: String(form.get('bio') || '').trim() || null,
        photoUrl: photoPreview || null,
        instagramUrl: String(form.get('instagramUrl') || '').trim() || null,
        linkedinUrl: String(form.get('linkedinUrl') || '').trim() || null,
        githubUrl: String(form.get('githubUrl') || '').trim() || null,
      })
      setTeam(c => [...c, member])
      e.currentTarget.reset()
      setPhotoPreview('')
      setMessage(`Added ${member.name} to leadership showcase.`)
    } catch (err) {
      setError(err.message)
    }
  }

  async function removeMember(id) {
    if (!confirm('Are you sure you want to remove this leader profile?')) return
    try {
      await adminApi.deleteClubTeamMember(id)
      setTeam(c => c.filter(m => m.id !== id))
      setMessage('Team member removed.')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <LivePortal user={user} logout={logout} activeTab="admin-team" onNavigate={onNavigate} title="TEAM LEADERSHIP">
      <section className="member-management">
        <div className="member-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('admin-dashboard')}>
              ← COMMAND CENTER
            </button>
            <p className="eyebrow">COUNCIL SHOWCASE</p>
            <h1>Team & Leadership Showcase</h1>
            <p>Manage public club council member profiles and social portfolios.</p>
          </div>
        </div>

        {message && <p className="member-form-success">{message}</p>}
        {error && <p className="member-form-error">{error}</p>}

        <div className="member-management-grid">
          <article className="account-form-card">
            <p className="eyebrow">NEW LEADER</p>
            <h2>Add Council Member</h2>
            <form onSubmit={createMember}>
              <div className="member-form-grid">
                <label>
                  Full Name *
                  <input name="name" required placeholder="Leader Name" />
                </label>
                <label>
                  Council Role Title *
                  <input name="roleTitle" required placeholder="e.g. Head of Cyber Defense" />
                </label>
                <label>
                  Official Email
                  <input name="collegeEmail" type="email" placeholder="leader@college.edu" />
                </label>
                <label>
                  Profile Photo
                  <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) readImageFile(f, setPhotoPreview) }} />
                </label>
                <label className="form-wide">
                  Short Bio
                  <input name="bio" placeholder="Specialization & achievements..." />
                </label>
                <label>
                  LinkedIn URL
                  <input name="linkedinUrl" placeholder="https://linkedin.com/in/..." />
                </label>
                <label>
                  GitHub URL
                  <input name="githubUrl" placeholder="https://github.com/..." />
                </label>
              </div>
              <button className="primary member-submit" style={{ marginTop: '14px' }}>
                ＋ &nbsp; ADD LEADER PROFILE
              </button>
            </form>
          </article>

          <article className="member-list-card">
            <div className="card-heading">
              <div>
                <p className="eyebrow">COUNCIL ROSTER</p>
                <h2>Active Leaders ({team.length})</h2>
              </div>
            </div>

            {loading ? (
              <p className="directory-state">Loading team...</p>
            ) : team.length === 0 ? (
              <p className="directory-state">No leadership profiles added yet.</p>
            ) : (
              <div className="team-grid" style={{ marginTop: '16px' }}>
                {team.map(l => (
                  <div className="leader-card" key={l.id}>
                    {l.photoUrl ? (
                      <img className="leader-photo" src={l.photoUrl} alt={l.name} />
                    ) : (
                      <div className="leader-photo-placeholder">{l.name.slice(0, 2).toUpperCase()}</div>
                    )}
                    <b style={{ color: '#edf7ff', fontSize: '15px' }}>{l.name}</b>
                    <small style={{ color: '#85d7ff', font: '600 10px "DM Mono", monospace', margin: '4px 0' }}>{l.roleTitle}</small>
                    <p style={{ color: '#7e95a7', fontSize: '11px', margin: '6px 0 12px' }}>{l.bio}</p>
                    <button className="action-btn delete-btn" onClick={() => removeMember(l.id)}>Remove</button>
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Club Settings & Priority Controls (Admin)
// ----------------------------------------------------
function ClubSettingsManager({ user, logout, onNavigate }) {
  const [settings, setSettings] = useState({})
  const [siteStatus, setSiteStatus] = useState('ACTIVE')
  const [subscriptionEnabled, setSubscriptionEnabled] = useState(false)
  const [subscriptionAmount, setSubscriptionAmount] = useState('100')
  const [subscriptionUpiId, setSubscriptionUpiId] = useState('')
  const [qrPreview, setQrPreview] = useState('')
  const [introVideoEnabled, setIntroVideoEnabled] = useState(true)
  const [introVideoUrl, setIntroVideoUrl] = useState('')
  const [introVideoRequireTwoMinutes, setIntroVideoRequireTwoMinutes] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let mounted = true
    adminApi.getClubSettings()
      .then(({ settings: dict }) => {
        if (!mounted) return
        setSettings(dict)
        setSiteStatus(dict.siteStatus || 'ACTIVE')
        setSubscriptionEnabled(dict.subscriptionEnabled === true || dict.subscriptionEnabled === 'true')
        setSubscriptionAmount(String(dict.subscriptionMonthlyAmount || '100'))
        setSubscriptionUpiId(dict.subscriptionUpiId || '')
        setQrPreview(dict.subscriptionQrUrl || '')
        setIntroVideoEnabled(dict.introVideoEnabled !== false && dict.introVideoEnabled !== 'false')
        setIntroVideoUrl(dict.introVideoUrl || '')
        setIntroVideoRequireTwoMinutes(dict.introVideoRequireTwoMinutes === true || dict.introVideoRequireTwoMinutes === 'true')
      })
      .catch(err => { if (mounted) setError(err.message) })
    return () => { mounted = false }
  }, [])

  async function handleSaveSettings(e) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setMessage('')
    setError('')

    const payload = {
      siteStatus,
      subscriptionEnabled,
      subscriptionMonthlyAmount: subscriptionAmount ? Number(subscriptionAmount) : 100,
      subscriptionUpiId: subscriptionUpiId || null,
      subscriptionQrUrl: qrPreview || null,
      introVideoEnabled,
      introVideoUrl: introVideoUrl || null,
      introVideoRequireTwoMinutes,
      instagramUrl: String(form.get('instagramUrl') || '').trim() || null,
      githubUrl: String(form.get('githubUrl') || '').trim() || null,
      linkedinUrl: String(form.get('linkedinUrl') || '').trim() || null,
      youtubeUrl: String(form.get('youtubeUrl') || '').trim() || null,
      discordUrl: String(form.get('discordUrl') || '').trim() || null,
      whatsappUrl: String(form.get('whatsappUrl') || '').trim() || null,
      websiteUrl: String(form.get('websiteUrl') || '').trim() || null,
    }

    setSubmitting(true)
    try {
      await adminApi.updateClubSettings(payload)
      setMessage('Club settings updated successfully.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <LivePortal user={user} logout={logout} activeTab="admin-settings" onNavigate={onNavigate} title="CLUB SETTINGS">
      <section className="member-management">
        <div className="member-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('admin-dashboard')}>
              ← COMMAND CENTER
            </button>
            <p className="eyebrow">CENTRAL CONFIGURATION</p>
            <h1>Global Controls & Club Media</h1>
            <p>Manage site availability, student subscriptions, mandatory intro briefing, and social channels.</p>
          </div>
          {user.isPrimaryAdmin && (
            <span className="president-lock">👑 PRIMARY PRESIDENT CONTROLS</span>
          )}
        </div>

        {message && <p className="member-form-success">{message}</p>}
        {error && <p className="member-form-error">{error}</p>}

        <form onSubmit={handleSaveSettings}>
          {/* Card 1: Site Status (Hibernation Mode) */}
          <article className="settings-section-card">
            <div className="settings-card-header">
              <div>
                <p className="eyebrow" style={{ color: '#ffb74d' }}>SYSTEM AVAILABILITY</p>
                <h3>Site Status & Hibernation Mode</h3>
              </div>
              <div className="toggle-switch-container">
                <button
                  type="button"
                  className={`switch-btn ${siteStatus === 'ACTIVE' ? 'on' : ''}`}
                  onClick={() => setSiteStatus('ACTIVE')}
                  disabled={!user.isPrimaryAdmin}
                >
                  ✓ ONLINE / ACTIVE
                </button>
                <button
                  type="button"
                  className={`switch-btn ${siteStatus === 'HIBERNATING' ? 'off' : ''}`}
                  onClick={() => setSiteStatus('HIBERNATING')}
                  disabled={!user.isPrimaryAdmin}
                >
                  🔒 HIBERNATION / OFF
                </button>
              </div>
            </div>
            <p style={{ color: '#8aa2b4', fontSize: '13px', lineHeight: '1.6', margin: 0 }}>
              {siteStatus === 'ACTIVE'
                ? '🟢 Normal Website Active: Public visitors and students have normal uninterrupted access.'
                : '🔴 Hibernation Active: Public visitors and students see the dedicated Hibernation screen with live timer. Only the Primary President and Admins can log in.'}
            </p>
          </article>

          {/* Card 2: Membership Subscription System */}
          <article className="settings-section-card">
            <div className="settings-card-header">
              <div>
                <p className="eyebrow" style={{ color: '#70ddb4' }}>MEMBERSHIP FEE</p>
                <h3>Student Membership Subscription System</h3>
              </div>
              <div className="toggle-switch-container">
                <button
                  type="button"
                  className={`switch-btn ${subscriptionEnabled ? 'on' : ''}`}
                  onClick={() => setSubscriptionEnabled(true)}
                  disabled={!user.isPrimaryAdmin}
                >
                  [ ON / ENABLED ]
                </button>
                <button
                  type="button"
                  className={`switch-btn ${!subscriptionEnabled ? 'off' : ''}`}
                  onClick={() => setSubscriptionEnabled(false)}
                  disabled={!user.isPrimaryAdmin}
                >
                  [ OFF / DISABLED ]
                </button>
              </div>
            </div>
            <p style={{ color: '#8aa2b4', fontSize: '12px', lineHeight: '1.6', margin: '0 0 16px' }}>
              {subscriptionEnabled
                ? 'When ON: Students must have an active verified subscription via UPI to register for events and access technical support. (Leadership accounts are exempt).'
                : 'When OFF: All students enjoy free access without subscription requirements. Payment history remains preserved.'}
            </p>

            <div className="member-form-grid">
              <label>
                Monthly Subscription Amount (₹)
                <input
                  type="number"
                  value={subscriptionAmount}
                  onChange={e => setSubscriptionAmount(e.target.value)}
                  placeholder="100"
                  disabled={!user.isPrimaryAdmin}
                />
              </label>
              <label>
                Club UPI ID for Subscriptions
                <input
                  value={subscriptionUpiId}
                  onChange={e => setSubscriptionUpiId(e.target.value)}
                  placeholder="club@okaxis"
                  disabled={!user.isPrimaryAdmin}
                />
              </label>
              <label className="form-wide">
                Upload Club Payment QR Code Image
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => { const f = e.target.files?.[0]; if (f) readImageFile(f, setQrPreview) }}
                  disabled={!user.isPrimaryAdmin}
                />
              </label>
            </div>

            {qrPreview && (
              <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <img src={qrPreview} alt="Subscription QR" style={{ height: '80px', borderRadius: '6px', border: '1px solid #52bbf544' }} />
                <button type="button" className="action-btn delete-btn" onClick={() => setQrPreview('')} disabled={!user.isPrimaryAdmin}>
                  Remove QR Code
                </button>
              </div>
            )}
          </article>

          {/* Card 3: Mandatory Intro Video Controls */}
          <article className="settings-section-card">
            <div className="settings-card-header">
              <div>
                <p className="eyebrow" style={{ color: '#85d7ff' }}>ONBOARDING BRIEFING</p>
                <h3>Mandatory Intro Video Controls</h3>
              </div>
              <div className="toggle-switch-container">
                <button
                  type="button"
                  className={`switch-btn ${introVideoEnabled ? 'on' : ''}`}
                  onClick={() => setIntroVideoEnabled(true)}
                  disabled={!user.isPrimaryAdmin}
                >
                  [ ON / ENABLED ]
                </button>
                <button
                  type="button"
                  className={`switch-btn ${!introVideoEnabled ? 'off' : ''}`}
                  onClick={() => setIntroVideoEnabled(false)}
                  disabled={!user.isPrimaryAdmin}
                >
                  [ OFF / DISABLED ]
                </button>
              </div>
            </div>

            <div className="member-form-grid">
              <label className="form-wide">
                YouTube Video URL (Watch, Shorts, youtu.be, or Embed)
                <input
                  value={introVideoUrl}
                  onChange={e => setIntroVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                  disabled={!user.isPrimaryAdmin}
                />
              </label>
              <div className="form-wide" style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap', marginTop: '6px' }}>
                <div style={{ padding: '8px 12px', borderRadius: '6px', background: '#050a12', border: '1px solid var(--line)', color: '#70ddb4', fontSize: '11px' }}>
                  🔒 5-Second Delay: <b>REQUIRED</b>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: '#edf7ff' }}>
                  <input
                    type="checkbox"
                    checked={introVideoRequireTwoMinutes}
                    onChange={e => setIntroVideoRequireTwoMinutes(e.target.checked)}
                    disabled={!user.isPrimaryAdmin}
                    style={{ width: 'auto', height: 'auto' }}
                  />
                  <b>Require 2-Minute Active Viewing Before Continuing</b>
                </label>
              </div>
            </div>
          </article>

          {/* Card 4: Club Social Media Channels */}
          <article className="settings-section-card">
            <div className="settings-card-header">
              <div>
                <p className="eyebrow">BRANDING & LINKS</p>
                <h3>Official Club Social Links</h3>
              </div>
            </div>

            <div className="member-form-grid">
              <label>
                Instagram Profile Link
                <input name="instagramUrl" placeholder="https://instagram.com/..." defaultValue={settings.instagramUrl || ''} />
              </label>
              <label>
                GitHub Organization Link
                <input name="githubUrl" placeholder="https://github.com/..." defaultValue={settings.githubUrl || ''} />
              </label>
              <label>
                LinkedIn Page Link
                <input name="linkedinUrl" placeholder="https://linkedin.com/company/..." defaultValue={settings.linkedinUrl || ''} />
              </label>
              <label>
                YouTube Channel Link
                <input name="youtubeUrl" placeholder="https://youtube.com/@..." defaultValue={settings.youtubeUrl || ''} />
              </label>
              <label>
                Discord Server Link
                <input name="discordUrl" placeholder="https://discord.gg/..." defaultValue={settings.discordUrl || ''} />
              </label>
              <label>
                WhatsApp Community Link
                <input name="whatsappUrl" placeholder="https://chat.whatsapp.com/..." defaultValue={settings.whatsappUrl || ''} />
              </label>
              <label className="form-wide">
                Official Website Link
                <input name="websiteUrl" placeholder="https://cybersecurity.mrdu.edu" defaultValue={settings.websiteUrl || ''} />
              </label>
            </div>
          </article>

          <button className="primary member-submit" type="submit" disabled={submitting} style={{ minHeight: '44px', width: '100%' }}>
            {submitting ? 'SAVING ALL SETTINGS…' : 'SAVE CONFIGURATION'}
          </button>
        </form>
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Student Events Catalog
// ----------------------------------------------------
function StudentEvents({ user, logout, onNavigate }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    memberApi.listEvents()
      .then(({ events: list }) => { if (mounted) setEvents(list || []) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  return (
    <LivePortal user={user} logout={logout} activeTab="student-events" onNavigate={onNavigate} title="EVENTS CATALOG">
      <section className="gallery-section">
        <div className="event-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('student-dashboard')}>
              ← BACK TO DASHBOARD
            </button>
            <p className="eyebrow">COMMUNITY CALENDAR</p>
            <h1>Upcoming Club Events</h1>
            <p>Participate in defensive workshops, certification bootcamps, and CTF challenges.</p>
          </div>
        </div>

        {loading ? (
          <p className="directory-state">Loading events catalog...</p>
        ) : events.length === 0 ? (
          <p className="directory-state">No upcoming events currently published. Check back soon!</p>
        ) : (
          <div className="student-events-container">
            {events.map(evt => (
              <article key={evt.id} className="live-event-card">
                <div className="event-banner">
                  {evt.photoUrl ? (
                    <img src={evt.photoUrl} alt={evt.title} />
                  ) : (
                    <div className="event-banner-fallback">
                      <strong>{evt.eventType.toUpperCase()}</strong>
                    </div>
                  )}
                  <span className="event-badge-overlay">{evt.eventType}</span>
                </div>
                <div className="card-content">
                  <h3>{evt.title}</h3>
                  <p>{evt.shortDescription || evt.description || 'Department of Cyber Security session.'}</p>
                  <div className="card-meta">
                    <span>📅 {new Date(evt.dateTime).toLocaleDateString()}</span>
                    <span>📍 {evt.venue || evt.location || 'Campus'}</span>
                    <span>💳 {evt.requiresPayment ? `₹${evt.paymentAmount || 'Tiered'}` : 'FREE'}</span>
                    <span>👥 {evt.registrationCount || 0} registered</span>
                  </div>
                  <div className="card-footer">
                    {evt.isRegistered ? (
                      <span className="badge badge-registered">✓ REGISTERED</span>
                    ) : (
                      <button className="register-btn" type="button" onClick={() => onNavigate(`event-detail/${evt.id}`)}>
                        VIEW DETAILS & REGISTER →
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Student Registrations & Passes
// ----------------------------------------------------
function StudentRegistrations({ user, logout, onNavigate }) {
  const [registrations, setRegistrations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    memberApi.listRegistrations()
      .then(({ registrations: list }) => { if (mounted) setRegistrations(list || []) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  return (
    <LivePortal user={user} logout={logout} activeTab="student-registrations" onNavigate={onNavigate} title="MY EVENT PASSES">
      <section className="gallery-section">
        <div className="event-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('student-dashboard')}>
              ← BACK TO DASHBOARD
            </button>
            <p className="eyebrow">CONFIRMED PASSES</p>
            <h1>My Event Passes & QR</h1>
            <p>Your confirmed attendance records and entry passes for all club sessions.</p>
          </div>
        </div>

        {loading ? (
          <p className="directory-state">Loading your passes...</p>
        ) : registrations.length === 0 ? (
          <p className="directory-state">You have not registered for any events yet.</p>
        ) : (
          <div className="student-events-container">
            {registrations.map(reg => (
              <article key={reg.id} className="live-event-card">
                <div className="card-content">
                  <span className="badge badge-registered" style={{ alignSelf: 'flex-start', marginBottom: '8px' }}>
                    {reg.status}
                  </span>
                  <h3>{reg.event?.title || 'Club Event'}</h3>
                  <p>{reg.event?.shortDescription || reg.event?.description}</p>
                  <div className="card-meta">
                    <span>📅 {reg.event?.dateTime ? new Date(reg.event.dateTime).toLocaleString() : ''}</span>
                    <span>📍 {reg.event?.venue || reg.event?.location || 'Campus'}</span>
                    <span>🎟 Pass ID: {reg.id.slice(0, 8)}</span>
                    <span>Payment: <b style={{ color: '#70ddb4' }}>{reg.paymentStatus}</b></span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Public Gallery (Student)
// ----------------------------------------------------
function StudentGallery({ user, logout, onNavigate }) {
  const [albums, setAlbums] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedAlbum, setSelectedAlbum] = useState(null)
  const [loadingAlbum, setLoadingAlbum] = useState(false)
  const [activeLightbox, setActiveLightbox] = useState(null)

  useEffect(() => {
    let mounted = true
    memberApi.listGallery()
      .then(({ albums: list }) => { if (mounted) setAlbums(list || []) })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  async function handleOpenAlbum(album) {
    setSelectedAlbum(album)
    setLoadingAlbum(true)
    try {
      const res = await memberApi.getGalleryAlbum(album.id)
      if (res?.album) {
        setSelectedAlbum(res.album)
        setAlbums(curr => curr.map(a => (a.id === res.album.id ? res.album : a)))
      }
    } catch {
      // Fallback: keep local album photos if any
    } finally {
      setLoadingAlbum(false)
    }
  }

  return (
    <LivePortal user={user} logout={logout} activeTab="student-gallery" onNavigate={onNavigate} title="CLUB GALLERY">
      <section className="gallery-section">
        {selectedAlbum ? (
          // Opened Album View with all photos
          <div>
            <div className="event-heading" style={{ marginBottom: '20px' }}>
              <div>
                <button className="back-button" type="button" onClick={() => setSelectedAlbum(null)}>
                  ← BACK TO ALL ALBUMS
                </button>
                <p className="eyebrow">ALBUM SHOWCASE</p>
                <h1>{selectedAlbum.name}</h1>
                <p>{selectedAlbum.description || 'Club photo collection & highlights'}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="badge" style={{ background: '#0e2439', color: '#85d7ff', border: '1px solid #52bbf544', padding: '6px 12px', fontSize: '11px' }}>
                  📸 {selectedAlbum.photos?.length || 0} Photos
                </span>
              </div>
            </div>

            {loadingAlbum ? (
              <p className="directory-state">Loading album photos...</p>
            ) : (!selectedAlbum.photos || selectedAlbum.photos.length === 0) ? (
              <article className="account-form-card" style={{ textAlign: 'center', padding: '40px 20px', color: '#8aa2b4' }}>
                <p style={{ margin: 0, fontSize: '13px' }}>No photos have been added to this album yet.</p>
              </article>
            ) : (
              <div className="gallery-grid">
                {selectedAlbum.photos.map(p => (
                  <div
                    key={p.id}
                    className="album-card-box"
                    onClick={() => setActiveLightbox(p)}
                    style={{ position: 'relative' }}
                    title="Click to view full-size photo"
                  >
                    <div className="album-cover">
                      <img src={p.imageUrl} alt={p.caption || selectedAlbum.name} />
                    </div>
                    {p.caption && (
                      <div className="album-details">
                        <p style={{ color: '#edf7ff', fontWeight: 500 }}>{p.caption}</p>
                      </div>
                    )}
                    <div style={{ padding: '6px 12px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <small style={{ color: '#688296', fontSize: '10px' }}>{new Date(p.createdAt).toLocaleDateString()}</small>
                      <small style={{ color: '#85d7ff', fontSize: '10px' }}>🔍 Expand</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          // Albums Directory List
          <div>
            <div className="event-heading">
              <div>
                <button className="back-button" type="button" onClick={() => onNavigate('student-dashboard')}>
                  ← BACK TO DASHBOARD
                </button>
                <p className="eyebrow">PHOTO MEMORIES</p>
                <h1>Cyber Security Club Gallery</h1>
                <p>Highlights, award ceremonies, and lab workshops. Click any album to view its photos.</p>
              </div>
            </div>

            {loading ? (
              <p className="directory-state">Loading gallery albums...</p>
            ) : albums.length === 0 ? (
              <p className="directory-state">No albums published yet.</p>
            ) : (
              <div className="gallery-grid">
                {albums.map(a => (
                  <div
                    key={a.id}
                    className="album-card-box"
                    onClick={() => handleOpenAlbum(a)}
                    title={`Open "${a.name}" album`}
                  >
                    <div className="album-cover">
                      {a.coverImage || a.photos?.[0]?.imageUrl ? (
                        <img src={a.coverImage || a.photos[0].imageUrl} alt={a.name} />
                      ) : (
                        <div className="album-cover-placeholder">{a.name.slice(0, 2).toUpperCase()}</div>
                      )}
                      <span className="album-photo-count">{a.photos?.length || 0} photos</span>
                    </div>
                    <div className="album-details">
                      <h3>{a.name}</h3>
                      <p>{a.description || 'Club photo highlights'}</p>
                    </div>
                    <div style={{ padding: '8px 14px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <small style={{ color: '#85d7ff', fontWeight: 600 }}>Open Album →</small>
                      <small style={{ color: '#688296' }}>{a.photos?.length || 0} photos</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Read-Only Photo Lightbox Modal with Full Navigation */}
        {activeLightbox && (
          <GalleryLightbox
            photos={selectedAlbum?.photos || []}
            activePhoto={activeLightbox}
            albumName={selectedAlbum?.name}
            onClose={() => setActiveLightbox(null)}
            onSelectPhoto={p => setActiveLightbox(p)}
          />
        )}
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Public Team Showcase (Student)
// ----------------------------------------------------
function OurTeamShowcase({ user, logout, onNavigate }) {
  const [team, setTeam] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    memberApi.listClubTeam()
      .then(({ team: list }) => { if (mounted) setTeam(list || []) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  return (
    <LivePortal user={user} logout={logout} activeTab="student-team" onNavigate={onNavigate} title="CLUB LEADERSHIP">
      <section className="member-management">
        <div className="member-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('student-dashboard')}>
              ← BACK TO DASHBOARD
            </button>
            <p className="eyebrow">STUDENT COUNCIL</p>
            <h1>Meet Our Leadership</h1>
            <p>The student coordinators and executive leads driving Cyber Security Club MRDU.</p>
          </div>
        </div>

        {loading ? (
          <p className="directory-state">Loading leadership profiles...</p>
        ) : team.length === 0 ? (
          <p className="directory-state">No team members published yet.</p>
        ) : (
          <div className="team-grid">
            {team.map(l => (
              <div className="leader-card" key={l.id}>
                {l.photoUrl ? (
                  <img className="leader-photo" src={l.photoUrl} alt={l.name} />
                ) : (
                  <div className="leader-photo-placeholder">{l.name.slice(0, 2).toUpperCase()}</div>
                )}
                <b style={{ color: '#edf7ff', fontSize: '15px' }}>{l.name}</b>
                <small style={{ color: '#85d7ff', font: '600 10px "DM Mono", monospace', margin: '4px 0' }}>{l.roleTitle}</small>
                <p style={{ color: '#7e95a7', fontSize: '11px', margin: '6px 0 12px' }}>{l.bio}</p>
                <div className="leader-socials">
                  {l.linkedinUrl && <a className="social-pill" href={l.linkedinUrl} target="_blank" rel="noreferrer">LinkedIn</a>}
                  {l.githubUrl && <a className="social-pill" href={l.githubUrl} target="_blank" rel="noreferrer">GitHub</a>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Admin Command Center Dashboard (Clean & Structured)
// ----------------------------------------------------
function LivePresidentDashboard({ user, logout, onNavigate }) {
  const [memberCount, setMemberCount] = useState(null)
  const [eventCount, setEventCount] = useState(null)
  const [subStats, setSubStats] = useState({ activeSubscriptions: 0, pendingVerification: 0 })

  useEffect(() => {
    let mounted = true
    Promise.all([
      adminApi.listMembers().catch(() => ({ users: [] })),
      adminApi.listEvents().catch(() => ({ events: [] })),
      adminApi.listSubscriptions().catch(() => ({ stats: {} })),
    ]).then(([m, e, s]) => {
      if (mounted) {
        setMemberCount(m.users?.length || 0)
        setEventCount(e.events?.length || 0)
        setSubStats(s.stats || {})
      }
    })
    return () => { mounted = false }
  }, [])

  return (
    <LivePortal user={user} logout={logout} activeTab="admin-dashboard" onNavigate={onNavigate} title="COMMAND CENTER">
      <section className="welcome admin-welcome">
        <div>
          <p className="eyebrow">ADMINISTRATION</p>
          <h1>Welcome, {user.name}.</h1>
          <p>{getRoleLabel(user.role)} Command Center · Manage club activities, registrations, and access controls.</p>
        </div>
        <button className="primary" type="button" onClick={() => onNavigate('admin-events')}>
          ＋ &nbsp; CREATE EVENT
        </button>
      </section>

      {/* Pending Subscriptions Alert */}
      {subStats.pendingVerification > 0 && (
        <div className="pending-alert-banner" style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>⚠️</span>
            <div>
              <b>{subStats.pendingVerification} student subscription payments waiting for verification</b>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#ffecb3' }}>
                Review and activate memberships to unlock event passes for students.
              </p>
            </div>
          </div>
          <button type="button" onClick={() => onNavigate('admin-subscriptions')}>
            REVIEW PAYMENTS →
          </button>
        </div>
      )}

      {/* Top Metrics Cards */}
      <section className="stats">
        <div className="stat"><i>♙</i><div><p>MEMBERS</p><h2>{memberCount === null ? '...' : memberCount}</h2><small>Registered Accounts</small></div></div>
        <div className="stat"><i>▢</i><div><p>EVENTS</p><h2>{eventCount === null ? '...' : eventCount}</h2><small>Club Catalog</small></div></div>
        <div className="stat green"><i>💎</i><div><p>ACTIVE SUBSCRIPTIONS</p><h2>{subStats.activeSubscriptions || 0}</h2><small>Verified Members</small></div></div>
        <div className="stat green"><i>✓</i><div><p>SYSTEM ROLE</p><h2>{user.isPrimaryAdmin ? 'PRIMARY' : user.role.slice(0, 7)}</h2><small>{getRoleLabel(user.role)}</small></div></div>
      </section>

      {/* Quick Action Hub */}
      <section style={{ marginTop: '16px' }}>
        <article className="quick">
          <div><p className="eyebrow">EXECUTIVE TOOLS</p><h2>Club Management Hub</h2></div>
          <section>
            <button type="button" onClick={() => onNavigate('admin-members')}>
              <i>♙</i><b>Members</b><small>Access & roles</small>
            </button>
            <button type="button" onClick={() => onNavigate('admin-events')}>
              <i>▢</i><b>Event Studio</b><small>Workshops & passes</small>
            </button>
            <button type="button" onClick={() => onNavigate('admin-subscriptions')}>
              <i>💎</i><b>Subscriptions</b><small>Verify payments</small>
            </button>
            <button type="button" onClick={() => onNavigate('admin-payments')}>
              <i>💳</i><b>Event Payments</b><small>Track pass fees</small>
            </button>
            <button type="button" onClick={() => onNavigate('admin-support')}>
              <i>💬</i><b>Helpdesk</b><small>Student doubts</small>
            </button>
            <button type="button" onClick={() => onNavigate('admin-gallery')}>
              <i>▧</i><b>Gallery</b><small>Photos & albums</small>
            </button>
            <button type="button" onClick={() => onNavigate('admin-team')}>
              <i>👥</i><b>Team Council</b><small>Leader profiles</small>
            </button>
            <button type="button" onClick={() => onNavigate('admin-settings')}>
              <i>⚙</i><b>Club Settings</b><small>Site & video controls</small>
            </button>
            <button type="button" onClick={() => onNavigate('admin-audit')}>
              <i>◫</i><b>Security Audit</b><small>Protected logs</small>
            </button>
          </section>
        </article>
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Student Member Hub (Student Dashboard)
// ----------------------------------------------------
function LiveStudentDashboard({ user, logout, onNavigate }) {
  const [events, setEvents] = useState([])
  const [subStatus, setSubStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    Promise.all([
      memberApi.listEvents().catch(() => ({ events: [] })),
      memberApi.getSubscriptionStatus().catch(() => null),
    ]).then(([e, s]) => {
      if (mounted) {
        setEvents(e.events || [])
        setSubStatus(s)
      }
    }).finally(() => {
      if (mounted) setLoading(false)
    })
    return () => { mounted = false }
  }, [])

  const needsSubscription = subStatus?.subscriptionEnabled && !subStatus?.hasActiveSubscription && !subStatus?.isExempt

  return (
    <LivePortal user={user} logout={logout} activeTab="student-dashboard" onNavigate={onNavigate} title="STUDENT MEMBER HUB">
      <section className="welcome">
        <div>
          <p className="eyebrow">DEPARTMENT OF CYBER SECURITY</p>
          <h1>Hello, {user.name} <span>👋</span></h1>
          <p>Welcome to the official Cyber Security Club student hub.</p>
        </div>
        <button className="outline" type="button" onClick={() => onNavigate('student-events')}>
          BROWSE ALL EVENTS &nbsp;→
        </button>
      </section>

      {/* Subscription Notice Banner */}
      {needsSubscription && (
        <div className="pending-alert-banner" style={{ marginTop: '20px', background: '#2d1f05', borderColor: '#f59e0b', color: '#fef3c7' }}>
          <div>
            <b>Your student membership is inactive</b>
            <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#fde68a' }}>
              Subscribe (₹{subStatus?.monthlyAmount || 100}/mo via UPI) to unlock event registrations, technical support, and member-only gallery.
            </p>
          </div>
          <button type="button" onClick={() => onNavigate('student-membership')} style={{ background: '#f59e0b', color: '#000' }}>
            SUBSCRIBE NOW →
          </button>
        </div>
      )}

      <section className="stats" style={{ margin: '28px 0' }}>
        <div className="stat"><i>▢</i><div><p>CLUB EVENTS</p><h2>{events.length}</h2><small>Workshops & CTFs</small></div></div>
        <div className="stat"><i>▤</i><div><p>MY PASSES</p><h2>{events.filter(e => e.isRegistered).length}</h2><small>Confirmed registrations</small></div></div>
        <div className={`stat ${subStatus?.hasActiveSubscription ? 'green' : 'amber'}`}>
          <i>💎</i>
          <div>
            <p>MEMBERSHIP</p>
            <h2>{subStatus?.hasActiveSubscription ? 'ACTIVE' : 'INACTIVE'}</h2>
            <small>{subStatus?.hasActiveSubscription ? 'Verified' : 'Subscribe via UPI'}</small>
          </div>
        </div>
        <div className="stat green"><i>👤</i><div><p>MEMBER ID</p><h2>{user.memberId}</h2><small>Authorized Account</small></div></div>
      </section>

      <div className="section-title">
        <div>
          <p className="eyebrow">FEATURED SESSIONS</p>
          <h2>Upcoming Club Events</h2>
        </div>
        <button type="button" onClick={() => onNavigate('student-events')}>EXPLORE ALL &nbsp;→</button>
      </div>

      {loading ? (
        <p className="directory-state">Loading events...</p>
      ) : events.length === 0 ? (
        <p className="directory-state">No published events currently. Check back soon!</p>
      ) : (
        <div className="student-events-container">
          {events.slice(0, 3).map(evt => (
            <article key={evt.id} className="live-event-card">
              <div className="event-banner">
                {evt.photoUrl ? (
                  <img src={evt.photoUrl} alt={evt.title} />
                ) : (
                  <div className="event-banner-fallback">
                    <strong>{evt.eventType.toUpperCase()}</strong>
                  </div>
                )}
                <span className="event-badge-overlay">{evt.eventType}</span>
              </div>
              <div className="card-content">
                <h3>{evt.title}</h3>
                <p>{evt.shortDescription || evt.description || 'Department of Cyber Security official session.'}</p>
                <div className="card-meta">
                  <span>📅 {new Date(evt.dateTime).toLocaleDateString()}</span>
                  <span>📍 {evt.venue || evt.location || 'Campus'}</span>
                  <span>💳 {evt.requiresPayment ? `₹${evt.paymentAmount || 'Tiered'}` : 'FREE'}</span>
                  <span>👥 {evt.registrationCount || 0} registered</span>
                </div>
                <div className="card-footer">
                  {evt.isRegistered ? (
                    <span className="badge badge-registered">✓ REGISTERED</span>
                  ) : (
                    <button className="register-btn" type="button" onClick={() => onNavigate(`event-detail/${evt.id}`)}>
                      VIEW & REGISTER
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </LivePortal>
  )
}

// ----------------------------------------------------
// Security Audit Log View (Categorized, Clean & Details Modal)
// ----------------------------------------------------
function getAuditCategory(action = '') {
  const a = action.toUpperCase()
  if (a.includes('PAYMENT') || a.includes('SUBSCRIPTION') || a.includes('FEE')) return 'PAYMENTS'
  if (a.includes('LOGIN') || a.includes('LOGOUT') || a.includes('AUTH') || a.includes('2FA') || a.includes('PASSWORD') || a.includes('PIN')) return 'AUTH'
  if (a.includes('MEMBER') || a.includes('ROLE') || a.includes('STATUS') || a.includes('ACCOUNT')) return 'MEMBERS'
  if (a.includes('EVENT') || a.includes('REGISTRATION') || a.includes('PASS')) return 'EVENTS'
  if (a.includes('SETTING') || a.includes('HIBERNATION') || a.includes('VIDEO') || a.includes('CONFIG') || a.includes('SUPPORT')) return 'SYSTEM'
  return 'GENERAL'
}

function getCategoryBadge(cat) {
  switch (cat) {
    case 'PAYMENTS': return { label: '💳 Payments', color: '#70ddb4', bg: '#10382e' }
    case 'AUTH': return { label: '🔑 Auth', color: '#52bbf5', bg: '#164366' }
    case 'MEMBERS': return { label: '👥 Members', color: '#d5baff', bg: '#382766' }
    case 'EVENTS': return { label: '▢ Events', color: '#ffb74d', bg: '#3a2a10' }
    case 'SYSTEM': return { label: '⚙ System', color: '#f87171', bg: '#3a1818' }
    default: return { label: '◫ General', color: '#8aa2b4', bg: '#182433' }
  }
}

function formatMetaKey(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .replace(/Url$/, ' URL')
    .replace(/Id$/, ' ID')
    .replace(/Upi/, 'UPI')
}

function formatMetaValue(val) {
  if (val === null || val === undefined) return 'None'
  if (typeof val === 'boolean') return val ? 'YES / ACTIVE' : 'NO / DISABLED'
  if (typeof val === 'object') return JSON.stringify(val, null, 2)
  return String(val)
}

function AuditLogView({ user, logout, onNavigate }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLog, setSelectedLog] = useState(null)

  // Clear Audit Modal (Primary President Only)
  const [clearModalOpen, setClearModalOpen] = useState(false)
  const [authCode, setAuthCode] = useState('')
  const [clearing, setClearing] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function loadLogs() {
    setLoading(true)
    adminApi.listAuditLogs()
      .then(({ auditLogs }) => { setLogs(auditLogs || []) })
      .finally(() => { setLoading(false) })
  }

  useEffect(() => {
    loadLogs()
  }, [])

  async function handleClearAudit(e) {
    e.preventDefault()
    setClearing(true)
    setError('')
    setMessage('')
    try {
      const res = await adminApi.clearAuditLogs(authCode)
      setMessage(res.message)
      setClearModalOpen(false)
      setAuthCode('')
      loadLogs()
    } catch (err) {
      setError(err.message)
    } finally {
      setClearing(false)
    }
  }

  const categories = [
    { id: 'ALL', label: 'All Audits', icon: '◫' },
    { id: 'PAYMENTS', label: 'Payments & Subscriptions', icon: '💳' },
    { id: 'AUTH', label: 'Authentication & PIN', icon: '🔑' },
    { id: 'MEMBERS', label: 'Members & Roles', icon: '👥' },
    { id: 'EVENTS', label: 'Events & Passes', icon: '▢' },
    { id: 'SYSTEM', label: 'System & Support', icon: '⚙' },
  ]

  const filteredLogs = logs.filter(entry => {
    const cat = getAuditCategory(entry.action)
    if (categoryFilter !== 'ALL' && cat !== categoryFilter) return false

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const matchAction = entry.action?.toLowerCase().includes(q)
      const matchActor = (entry.actor?.profile?.name || entry.actor?.name || '').toLowerCase().includes(q)
      const matchId = (entry.actor?.memberId || '').toLowerCase().includes(q)
      const matchIp = (entry.ipAddress || '').toLowerCase().includes(q)
      const matchMeta = JSON.stringify(entry.metadata || {}).toLowerCase().includes(q)
      if (!matchAction && !matchActor && !matchId && !matchIp && !matchMeta) return false
    }
    return true
  })

  return (
    <LivePortal user={user} logout={logout} activeTab="admin-audit" onNavigate={onNavigate} title="SECURITY AUDIT LOG">
      <section className="member-management">
        <div className="member-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('admin-dashboard')}>
              ← COMMAND CENTER
            </button>
            <p className="eyebrow">COMPLIANCE & TRACEABILITY</p>
            <h1>Security Audit Log</h1>
            <p>Protected immutable logs of administrative activities, logins, and configurations.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {user.isPrimaryAdmin && (
              <button
                type="button"
                className="action-btn delete-btn"
                onClick={() => setClearModalOpen(true)}
                style={{ padding: '7px 14px', fontSize: '11px', fontWeight: 'bold' }}
              >
                🗑 CLEAR ALL AUDIT LOGS
              </button>
            )}
            <span className="president-lock">PROTECTED RECORDS</span>
          </div>
        </div>

        {message && <p className="member-form-success">{message}</p>}
        {error && <p className="member-form-error">{error}</p>}

        {/* Category Filters */}
        <div className="audit-tabs">
          {categories.map(c => {
            const count = c.id === 'ALL' ? logs.length : logs.filter(l => getAuditCategory(l.action) === c.id).length
            return (
              <button
                key={c.id}
                type="button"
                className={`audit-tab-btn ${categoryFilter === c.id ? 'active' : ''}`}
                onClick={() => setCategoryFilter(c.id)}
              >
                <span>{c.icon}</span>
                <span>{c.label}</span>
                <small style={{ color: categoryFilter === c.id ? '#edf7ff' : '#688296' }}>({count})</small>
              </button>
            )
          })}
        </div>

        {/* Search Bar */}
        <div style={{ marginBottom: '16px' }}>
          <input
            style={{ width: '100%', height: '38px', padding: '0 14px', background: '#050a12', border: '1px solid var(--line)', borderRadius: '6px', color: '#fff', fontSize: '11px' }}
            placeholder="Search by Action, Member Name, Member ID, IP Address, or parameters..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <article className="member-list-card">
          {loading ? (
            <p className="directory-state">Loading audit logs...</p>
          ) : filteredLogs.length === 0 ? (
            <p className="directory-state">No audit log entries match your selected criteria.</p>
          ) : (
            <div className="table-scroll-container">
              <div className="members-table">
                <div className="audit-table-header">
                  <span>ACTION EVENT</span>
                  <span>ACTOR</span>
                  <span>IP & DEVICE</span>
                  <span>TIMESTAMP</span>
                  <span>DETAILS</span>
                </div>
                {filteredLogs.map(entry => {
                  const cat = getAuditCategory(entry.action)
                  const badge = getCategoryBadge(cat)
                  return (
                    <div className="audit-table-row" key={entry.id}>
                      <div>
                        <span className="badge" style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.color}44`, fontSize: '9px' }}>
                          {entry.action.replaceAll('_', ' ')}
                        </span>
                      </div>
                      <div>
                        <b>{entry.actor?.profile?.name || entry.actor?.name || 'System Administrator'}</b>
                        <small style={{ color: '#85d7ff', display: 'block' }}>
                          {entry.actor?.memberId ? `${entry.actor.memberId} (${getRoleLabel(entry.actor.role)})` : 'SYSTEM'}
                        </small>
                      </div>
                      <div>
                        <code style={{ color: '#85d7ff', fontSize: '11px', background: '#050a12', padding: '3px 6px', borderRadius: '4px' }}>
                          {entry.ipAddress || '127.0.0.1 (Internal)'}
                        </code>
                      </div>
                      <div>
                        <small>{new Date(entry.createdAt).toLocaleDateString()}</small>
                        <small style={{ color: '#688296', display: 'block' }}>{new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                      </div>
                      <div>
                        <button
                          type="button"
                          className="audit-info-btn"
                          onClick={() => setSelectedLog(entry)}
                          title="Click to view complete details"
                        >
                          ⓘ
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </article>

        {/* Clear Audit Confirmation Modal */}
        {clearModalOpen && (
          <div className="photo-lightbox" onClick={() => setClearModalOpen(false)}>
            <div className="photo-lightbox-content" onClick={e => e.stopPropagation()} style={{ background: '#0d1522', padding: '28px', borderRadius: '14px', border: '1px solid #f8717155', maxWidth: '440px', width: '100%' }}>
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '36px' }}>⚠️</span>
                <h3 style={{ margin: '8px 0 4px', font: '700 20px Syne', color: '#f87171' }}>Clear Audit Logs</h3>
                <p style={{ color: '#8aa2b4', fontSize: '12px', margin: 0 }}>
                  This will purge all previous compliance records from the database. Only the Primary President can execute this.
                </p>
              </div>

              <form onSubmit={handleClearAudit}>
                <label style={{ display: 'block', fontSize: '11px', color: '#b4c7d5', marginBottom: '6px' }}>
                  Enter Master Security PIN or Password *
                  <input
                    type="password"
                    required
                    placeholder="Enter PIN or password to authorize"
                    value={authCode}
                    onChange={e => setAuthCode(e.target.value)}
                    style={{ width: '100%', height: '40px', padding: '0 12px', background: '#050a12', border: '1px solid var(--line)', borderRadius: '6px', color: '#fff', marginTop: '4px' }}
                  />
                </label>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <button type="button" className="action-btn cancel-btn" onClick={() => setClearModalOpen(false)}>Cancel</button>
                  <button type="submit" className="primary" disabled={clearing || !authCode} style={{ background: '#dc2626' }}>
                    {clearing ? 'PURGING…' : 'CONFIRM PURGE'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Audit Details Modal */}
        {selectedLog && (
          <div className="photo-lightbox" onClick={() => setSelectedLog(null)}>
            <div className="photo-lightbox-content" onClick={e => e.stopPropagation()} style={{ background: '#0d1522', padding: '28px', borderRadius: '14px', border: '1px solid #52bbf555', maxWidth: '640px', width: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)', paddingBottom: '14px', marginBottom: '14px' }}>
                <div>
                  <span className="badge badge-president" style={{ marginBottom: '6px' }}>
                    {selectedLog.action}
                  </span>
                  <h3 style={{ margin: '4px 0 0', font: '700 18px Syne', color: '#edf7ff' }}>
                    Audit Event Details
                  </h3>
                </div>
                <button className="lightbox-close" onClick={() => setSelectedLog(null)} style={{ position: 'static' }}>✕</button>
              </div>

              {/* Actor & Device Grid */}
              <div className="audit-detail-grid">
                <div className="audit-detail-field">
                  <b>ACTOR NAME</b>
                  <p>{selectedLog.actor?.profile?.name || selectedLog.actor?.name || 'System / Primary Administrator'}</p>
                </div>
                <div className="audit-detail-field">
                  <b>MEMBER ID & ROLE</b>
                  <p style={{ color: '#85d7ff' }}>
                    {selectedLog.actor?.memberId ? `${selectedLog.actor.memberId} (${getRoleLabel(selectedLog.actor.role)})` : 'SYSTEM ACTION'}
                  </p>
                </div>
                <div className="audit-detail-field">
                  <b>CLIENT IP ADDRESS</b>
                  <p style={{ color: '#70ddb4', fontFamily: 'DM Mono' }}>{selectedLog.ipAddress || '127.0.0.1 (Internal)'}</p>
                </div>
                <div className="audit-detail-field">
                  <b>TIMESTAMP</b>
                  <p>{new Date(selectedLog.createdAt).toLocaleString()}</p>
                </div>
                <div className="audit-detail-field" style={{ gridColumn: '1 / -1' }}>
                  <b>USER AGENT / DEVICE</b>
                  <p style={{ fontSize: '11px', color: '#829bb0', wordBreak: 'break-all' }}>{selectedLog.userAgent || 'Mozilla/5.0 Web Client'}</p>
                </div>
              </div>

              {/* Metadata Key-Value Breakdown */}
              <b style={{ color: '#85d7ff', fontSize: '12px', display: 'block', margin: '14px 0 6px' }}>EVENT PARAMETERS & CHANGES:</b>
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 ? (
                <table className="audit-meta-table">
                  <tbody>
                    {Object.entries(selectedLog.metadata).map(([k, v]) => (
                      <tr key={k}>
                        <td>{formatMetaKey(k)}</td>
                        <td>{formatMetaValue(v)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ color: '#688296', fontSize: '12px', margin: '8px 0' }}>No extra parameters recorded for this operation.</p>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="primary" onClick={() => setSelectedLog(null)} style={{ minHeight: '36px' }}>
                  CLOSE DETAILS
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Executive Council Chat Room (Leads Only)
// ----------------------------------------------------
function CouncilChatView({ user, logout, onNavigate }) {
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
            🛡️ LEADS ONLY
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
                    <div style={{ background: isMe ? '#163854' : '#081320', border: isPresident ? '1px solid #ffb74d66' : isMe ? '1px solid #52bbf544' : '1px solid var(--line)', padding: '10px 14px', borderRadius: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <b style={{ color: isPresident ? '#ffb74d' : '#85d7ff', fontSize: '11px' }}>
                          {isPresident ? '👑 ' : ''}{m.user?.profile?.name || m.user?.memberId}
                        </b>
                        <span className="badge" style={{ fontSize: '8px', padding: '1px 5px' }}>
                          {isPresident ? 'PRESIDENT' : getRoleLabel(m.user?.role)}
                        </span>
                        <small style={{ color: '#688296', fontSize: '9px', marginLeft: 'auto' }}>
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </small>
                      </div>
                      <p style={{ color: '#edf7ff', fontSize: '12px', margin: 0, lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
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
              style={{ flex: 1, height: '44px', padding: '0 16px', background: '#050a12', border: '1px solid var(--line)', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
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

// ----------------------------------------------------
// Root App Controller with Path Preservation & Hibernation
// ----------------------------------------------------
function App() {
  const [user, setUser] = useState(null)
  const resetToken = new URLSearchParams(window.location.search).get('token')
  const [screen, setScreen] = useState(resetToken ? 'reset-password' : 'login')
  const [checkingSession, setCheckingSession] = useState(true)

  // Experience & System flags
  const [showIntroVideo, setShowIntroVideo] = useState(false)
  const [showWaitingQueue, setShowWaitingQueue] = useState(false)
  const [isHibernating, setIsHibernating] = useState(false)
  const [adminLoginModal, setAdminLoginModal] = useState(false)

  function getScreenFromPath(role) {
    const path = window.location.pathname.replace(/^\//, '')
    if (path.startsWith('event-detail/')) return path
    if (['events', 'student-events'].includes(path)) return 'student-events'
    if (['registrations', 'student-registrations'].includes(path)) return 'student-registrations'
    if (['membership', 'student-membership'].includes(path)) return 'student-membership'
    if (['support', 'student-support'].includes(path)) return 'student-support'
    if (['team', 'student-team'].includes(path)) return 'student-team'
    if (['gallery', 'student-gallery'].includes(path)) return 'student-gallery'
    if (['profile', 'student-profile'].includes(path)) return 'student-profile'
    if (['security'].includes(path)) return 'security'
    if (['admin/members', 'admin-members'].includes(path)) return 'admin-members'
    if (['admin/events', 'admin-events'].includes(path)) return 'admin-events'
    if (['admin/payments', 'admin-payments'].includes(path)) return 'admin-payments'
    if (['admin/subscriptions', 'admin-subscriptions'].includes(path)) return 'admin-subscriptions'
    if (['admin/support', 'admin-support'].includes(path)) return 'admin-support'
    if (['admin/chat', 'admin-chat'].includes(path)) return 'admin-chat'
    if (['admin/team', 'admin-team'].includes(path)) return 'admin-team'
    if (['admin/gallery', 'admin-gallery'].includes(path)) return 'admin-gallery'
    if (['admin/settings', 'admin-settings'].includes(path)) return 'admin-settings'
    if (['admin/audit', 'admin-audit'].includes(path)) return 'admin-audit'
    if (['admin/profile', 'admin-profile'].includes(path)) return 'admin-profile'
    return role === 'STUDENT' ? 'student-dashboard' : 'admin-dashboard'
  }

  function navigateTo(nextScreen) {
    setScreen(nextScreen)
    const urlPath = nextScreen.startsWith('event-detail/') ? `/${nextScreen}` : `/${nextScreen.replace('admin-', 'admin/').replace('student-', '')}`
    window.history.pushState({}, '', urlPath)
  }

  useEffect(() => {
    if (resetToken) {
      setCheckingSession(false)
      return undefined
    }
    let mounted = true
    authApi.me()
      .then(async ({ user: authUser }) => {
        if (!mounted) return
        const portalUser = toPortalUser(authUser)
        setUser(portalUser)

        try {
          const status = await memberApi.getSessionStatus()
          if (!status.introVideoCompleted && portalUser.role === 'STUDENT') {
            setShowIntroVideo(true)
          } else if (status.requiresWaitingQueue) {
            setShowWaitingQueue(true)
          }
        } catch {}

        setScreen(getScreenFromPath(portalUser.role))
      })
      .catch(err => {
        if (mounted) {
          if (err.hibernating || err.status === 503) {
            setIsHibernating(true)
          }
          setScreen('login')
        }
      })
      .finally(() => {
        if (mounted) setCheckingSession(false)
      })
    return () => { mounted = false }
  }, [resetToken])

  async function signedIn(memberId, password) {
    const result = await authApi.login(memberId, password)
    if (result.requiresTwoFactor) {
      setScreen('two-factor')
      setAdminLoginModal(false)
      return
    }
    const portalUser = toPortalUser(result.user)
    setUser(portalUser)
    setIsHibernating(false)
    setAdminLoginModal(false)

    try {
      const status = await memberApi.getSessionStatus()
      if (!status.introVideoCompleted && portalUser.role === 'STUDENT') {
        setShowIntroVideo(true)
      } else if (status.requiresWaitingQueue) {
        setShowWaitingQueue(true)
      }
    } catch {}

    navigateTo(portalUser.role === 'STUDENT' ? 'student-dashboard' : 'admin-dashboard')
  }

  async function verifyTwoFactor(code) {
    const { user: authUser } = await authApi.verifyTwoFactor(code)
    const portalUser = toPortalUser(authUser)
    setUser(portalUser)
    navigateTo(portalUser.role === 'STUDENT' ? 'student-dashboard' : 'admin-dashboard')
  }

  async function logout() {
    try {
      await authApi.logout()
    } finally {
      setUser(null)
      setShowIntroVideo(false)
      setShowWaitingQueue(false)
      setScreen('login')
      window.history.pushState({}, '', '/')
    }
  }

  if (checkingSession) {
    return (
      <main className="auth-loading" style={{ minHeight: '100vh', display: 'grid', placeContent: 'center', gap: 14, background: '#080c12', color: '#9ed9ff', textAlign: 'center' }}>
        <Crest small />
        <p style={{ font: "500 10px 'DM Mono', monospace", letterSpacing: '.12em' }}>VERIFYING SECURE SESSION…</p>
      </main>
    )
  }

  // Hibernation Mode: shown to unauthenticated users and students
  if (isHibernating && (!user || user.role === 'STUDENT') && !adminLoginModal) {
    return <HibernationScreen onAdminLogin={() => setAdminLoginModal(true)} />
  }

  if (screen === 'reset-password' && resetToken) return <PasswordReset token={resetToken} onComplete={() => setScreen('login')} />
  if (screen === 'password-reset-request') return <PasswordResetRequest onBack={() => setScreen('login')} />
  if (screen === 'two-factor') return <TwoFactorLogin onVerify={verifyTwoFactor} onBack={() => setScreen('login')} />

  if (user) {
    if (showIntroVideo) {
      return <IntroVideoExperience onComplete={() => setShowIntroVideo(false)} />
    }

    if (showWaitingQueue) {
      return <ConcurrentWaitingQueue onComplete={() => setShowWaitingQueue(false)} />
    }

    if (screen.startsWith('event-detail/')) {
      const eventId = screen.replace('event-detail/', '')
      return <StudentEventDetail user={user} eventId={eventId} logout={logout} onNavigate={navigateTo} />
    }

    // Admin Screens
    if (user.isAdminUser) {
      if (screen === 'admin-members') return <MemberManagement user={user} logout={logout} onNavigate={navigateTo} />
      if (screen === 'admin-events') return <EventManagement user={user} logout={logout} onNavigate={navigateTo} />
      if (screen === 'admin-payments') return <PaymentManagement user={user} logout={logout} onNavigate={navigateTo} />
      if (screen === 'admin-subscriptions') return <SubscriptionManagement user={user} logout={logout} onNavigate={navigateTo} />
      if (screen === 'admin-support') return <SupportDeskView user={user} logout={logout} onNavigate={navigateTo} />
      if (screen === 'admin-chat') return <CouncilChatView user={user} logout={logout} onNavigate={navigateTo} />
      if (screen === 'admin-gallery') return <GalleryManagement user={user} logout={logout} onNavigate={navigateTo} />
      if (screen === 'admin-team') return <TeamManagement user={user} logout={logout} onNavigate={navigateTo} />
      if (screen === 'admin-settings') return <ClubSettingsManager user={user} logout={logout} onNavigate={navigateTo} />
      if (screen === 'admin-audit') return <AuditLogView user={user} logout={logout} onNavigate={navigateTo} />
      if (screen === 'admin-profile') return <UniversalProfileView user={user} logout={logout} onNavigate={navigateTo} onProfileUpdated={u => setUser(toPortalUser(u))} />
      if (screen === 'security') return <AccountSecurity user={user} logout={logout} onNavigate={navigateTo} />
      return <LivePresidentDashboard user={user} logout={logout} onNavigate={navigateTo} />
    }

    // Student Screens
    if (screen === 'student-events') return <StudentEvents user={user} logout={logout} onNavigate={navigateTo} />
    if (screen === 'student-registrations') return <StudentRegistrations user={user} logout={logout} onNavigate={navigateTo} />
    if (screen === 'student-membership') return <StudentMembership user={user} logout={logout} onNavigate={navigateTo} />
    if (screen === 'student-support') return <SupportDeskView user={user} logout={logout} onNavigate={navigateTo} />
    if (screen === 'student-team') return <OurTeamShowcase user={user} logout={logout} onNavigate={navigateTo} />
    if (screen === 'student-gallery') return <StudentGallery user={user} logout={logout} onNavigate={navigateTo} />
    if (screen === 'student-profile') return <UniversalProfileView user={user} logout={logout} onNavigate={navigateTo} onProfileUpdated={u => setUser(toPortalUser(u))} />
    if (screen === 'security') return <AccountSecurity user={user} logout={logout} onNavigate={navigateTo} />
    return <LiveStudentDashboard user={user} logout={logout} onNavigate={navigateTo} />
  }

  return <FinalLogin onSignIn={signedIn} onForgotPassword={() => setScreen('password-reset-request')} />
}

export default App
