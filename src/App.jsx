import { useEffect, useRef, useState } from 'react'
import clubLogo from './assets/branding/cyber-security-club-logo.jpeg'
import { adminApi, authApi, memberApi, readImageFile } from './lib/api'
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
// Navigation & Portal Frame (Responsive Flexbox & Drawer)
// ----------------------------------------------------
function Sidebar({ user, logout, activeTab, onNavigate, isOpen, onClose }) {
  const perms = user.permissions || []
  const has = perm => user.isPrimaryAdmin || perms.includes(perm)

  const navItems = user.isAdminUser
    ? [
        ['▦', 'Dashboard', 'admin-dashboard', true],
        ['♙', 'Members', 'admin-members', has('ACCOUNT_MANAGEMENT')],
        ['▢', 'Event Studio', 'admin-events', has('EVENTS_VIEW') || has('EVENT_MANAGE')],
        ['💳', 'Event Payments', 'admin-payments', has('PAYMENTS_VIEW')],
        ['💎', 'Subscriptions', 'admin-subscriptions', has('PAYMENTS_VIEW') || user.role === 'TREASURER' || user.role === 'PRESIDENT'],
        ['▧', 'Gallery', 'admin-gallery', has('GALLERY_VIEW') || has('GALLERY_MANAGE')],
        ['👥', 'Team / Leaders', 'admin-team', has('TEAM_MANAGE')],
        ['⚙', 'Settings & Links', 'admin-settings', has('SETTINGS_MANAGE')],
        ['◫', 'Audit Log', 'admin-audit', has('AUDIT_VIEW')],
        ['▣', 'Security', 'security', true],
      ].filter(item => item[3])
    : [
        ['▦', 'Dashboard', 'student-dashboard', true],
        ['▢', 'Events Catalog', 'student-events', true],
        ['▤', 'My Passes', 'student-registrations', true],
        ['💎', 'Membership', 'student-membership', true],
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

function Header({ user, title, onSecurity, onToggleNav }) {
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
      <div className="header-tools">
        {onSecurity && (
          <button
            type="button"
            className="profile profile-button"
            onClick={onSecurity}
            aria-label="Open account security"
            style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(16, 26, 39, 0.7)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--line)', cursor: 'pointer' }}
          >
            <span style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'linear-gradient(135deg, #2488d8, #18447e)', display: 'grid', placeItems: 'center', color: '#fff', font: '700 11px Syne' }}>
              {user.initials}
            </span>
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

function LivePortal({ user, logout, activeTab, onNavigate, title, children }) {
  const [navOpen, setNavOpen] = useState(false)

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
          onSecurity={() => onNavigate('security')}
          onToggleNav={() => setNavOpen(o => !o)}
        />
        <div className="dashboard">{children}</div>
      </div>
    </main>
  )
}

// ----------------------------------------------------
// Login & Auth Recovery Screens
// ----------------------------------------------------
function FinalLogin({ onSignIn, onForgotPassword }) {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
      <section className="showcase">
        <div className="grid-overlay" />
        <div className="showcase-top">
          <i /> MRDU OFFICIAL STUDENT COMMUNITY
        </div>
        <div className="showcase-inner">
          <Crest />
          <div className="showcase-copy">
            <p className="eyebrow">DEPARTMENT OF CYBER SECURITY</p>
            <h1>Secure today.<br /><em>Protect tomorrow.</em></h1>
            <p>Sign in to access your Cyber Security Club command center and portal.</p>
          </div>
        </div>
        <div className="network">
          <span>◉</span>
          <div>
            <b>NETWORK STATUS</b>
            <small>All systems operational</small>
          </div>
          <label>SECURE ACCESS</label>
        </div>
        <small className="coordinates">MRDU // HYD-17.443 / 78.349</small>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <div className="security-label">SECURE MEMBER ACCESS</div>
          <h2>Welcome back.</h2>
          <p>Sign in to access the club portal.</p>
          <form onSubmit={submit} noValidate>
            <label htmlFor="final-member-id">Member ID</label>
            <div className="field">
              <input
                id="final-member-id"
                name="memberId"
                required
                maxLength={32}
                pattern="[A-Za-z0-9]+"
                autoComplete="username"
                placeholder="Enter your Member ID"
              />
            </div>
            <label htmlFor="final-password">Password</label>
            <div className="field">
              <input
                id="final-password"
                name="password"
                type="password"
                required
                minLength={12}
                maxLength={128}
                autoComplete="current-password"
                placeholder="Enter your password"
              />
            </div>
            {error && <div className="error" role="alert">{error}</div>}
            <button className="primary login-button" disabled={loading}>
              {loading ? 'AUTHENTICATING...' : 'LOG IN'}
            </button>
          </form>
          <button className="back-button" type="button" onClick={onForgotPassword} style={{ marginTop: '16px' }}>
            Forgot your password?
          </button>
          <div className="authorized">AUTHORIZED MEMBERS ONLY</div>
        </div>
        <footer>© 2026 CYBER SECURITY CLUB, MRDU · SECURED PORTAL</footer>
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
    <main className="auth-loading" style={{ minHeight: '100vh', display: 'grid', placeContent: 'center' }}>
      <section className="login-card" style={{ background: '#0d1520', padding: '32px', borderRadius: '14px', border: '1px solid var(--line)' }}>
        <div className="security-label">TWO-FACTOR AUTHENTICATION</div>
        <h2>Verify your sign-in</h2>
        <p>Enter the six-digit code from your authenticator app.</p>
        <form onSubmit={submit}>
          <label htmlFor="two-factor-code">Authentication code</label>
          <div className="field">
            <input
              id="two-factor-code"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              required
            />
          </div>
          {error && <div className="error" role="alert">{error}</div>}
          <button className="primary login-button" disabled={loading || code.length !== 6}>
            {loading ? 'VERIFYING...' : 'VERIFY AND CONTINUE'}
          </button>
        </form>
        <button className="back-button" type="button" onClick={onBack} style={{ marginTop: '16px' }}>
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
    <main className="auth-loading" style={{ minHeight: '100vh', display: 'grid', placeContent: 'center' }}>
      <section className="login-card" style={{ background: '#0d1520', padding: '32px', borderRadius: '14px', border: '1px solid var(--line)' }}>
        <div className="security-label">PASSWORD RECOVERY</div>
        <h2>Recover your account</h2>
        <p>Enter your Member ID. If an email is on record, recovery instructions will be provided.</p>
        <form onSubmit={submit}>
          <label htmlFor="recovery-member-id">Member ID</label>
          <div className="field">
            <input id="recovery-member-id" name="memberId" required maxLength={32} pattern="[A-Za-z0-9]+" autoComplete="username" placeholder="e.g. MEMBER12345" />
          </div>
          {error && <div className="error" role="alert">{error}</div>}
          {message && <p className="member-form-success" role="status">{message}</p>}
          <button className="primary login-button" disabled={loading}>
            {loading ? 'SENDING...' : 'SEND RESET LINK'}
          </button>
        </form>
        <button className="back-button" type="button" onClick={onBack} style={{ marginTop: '16px' }}>
          ← Back to sign in
        </button>
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
    <main className="auth-loading" style={{ minHeight: '100vh', display: 'grid', placeContent: 'center' }}>
      <section className="login-card" style={{ background: '#0d1520', padding: '32px', borderRadius: '14px', border: '1px solid var(--line)' }}>
        <div className="security-label">SECURE PASSWORD RESET</div>
        <h2>Choose a new password</h2>
        <p>Must be at least 12 characters with uppercase, lowercase, number, and symbol.</p>
        <form onSubmit={submit}>
          <label htmlFor="new-password">New password</label>
          <div className="field">
            <input id="new-password" name="password" type="password" minLength={12} required autoComplete="new-password" placeholder="At least 12 characters" />
          </div>
          <label htmlFor="confirm-password">Confirm password</label>
          <div className="field">
            <input id="confirm-password" name="confirmPassword" type="password" minLength={12} required autoComplete="new-password" placeholder="Repeat new password" />
          </div>
          {error && <div className="error" role="alert">{error}</div>}
          <button className="primary login-button" disabled={loading}>
            {loading ? 'UPDATING...' : 'UPDATE PASSWORD'}
          </button>
        </form>
      </section>
    </main>
  )
}

// ----------------------------------------------------
// Account Security (2FA)
// ----------------------------------------------------
function AccountSecurity({ user, logout, onNavigate }) {
  const [setup, setSetup] = useState(null)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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

  return (
    <LivePortal user={user} logout={logout} activeTab="security" onNavigate={onNavigate} title="ACCOUNT SECURITY">
      <section className="member-management">
        <div className="member-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate(user.isAdminUser ? 'admin-dashboard' : 'student-dashboard')}>
              ← BACK
            </button>
            <p className="eyebrow">AUTHENTICATION PROTECTION</p>
            <h1>Account Security & 2FA</h1>
            <p>Configure multi-factor authentication and manage credential protection.</p>
          </div>
          <span className="president-lock">
            {user.twoFactorEnabled ? '2FA ACTIVE' : '2FA NOT CONFIGURED'}
          </span>
        </div>
        <article className="account-form-card security-card" style={{ maxWidth: '720px' }}>
          {!user.twoFactorEnabled && !setup && (
            <>
              <h2>Set up Authenticator App</h2>
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
// Member Management & Leadership Transfer
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

  useEffect(() => {
    let mounted = true
    adminApi.listMembers()
      .then(({ users }) => { if (mounted) setMembers(users) })
      .catch(err => { if (mounted) setError(err.message) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
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
      const { users } = await adminApi.listMembers()
      setMembers(users)
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
            <p>Add new club members, assign predefined roles, and oversee authorized access.</p>
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
                  <input name="memberId" required placeholder="e.g. 25EU07R0099" />
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
                    <span>ROLE & PERMS</span>
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
                            <div>
                              <b>{m.name}</b>
                              <small style={{ color: '#85d7ff', display: 'block' }}>{m.memberId}</small>
                            </div>
                            <div>
                              <span className={`badge ${m.isPrimaryAdmin ? 'badge-president' : m.role === 'STUDENT' ? 'badge-student' : 'badge-admin'}`}>
                                {m.isPrimaryAdmin ? '👑 PRESIDENT' : getRoleLabel(m.role)}
                              </span>
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
                Select the administrator who will become the new Primary President. This requires your active 2FA code.
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
                  Your 6-Digit 2FA Authentication Code
                  <input
                    required
                    placeholder="000000"
                    maxLength={6}
                    value={transferAuthCode}
                    onChange={e => setTransferAuthCode(e.target.value.replace(/\D/g, ''))}
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
function EventManagement({ user, logout, onNavigate }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('basic')

  const [isPaid, setIsPaid] = useState(false)
  const [hasMultipleActivities, setHasMultipleActivities] = useState(false)
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
      .then(({ events: list }) => { if (mounted) setEvents(list) })
      .catch(err => { if (mounted) setError(err.message) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

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

  async function handleEventSubmit(e) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setMessage('')
    setError('')

    const title = String(form.get('title') || '').trim()
    const eventType = String(form.get('eventType') || '').trim()
    const dateTime = String(form.get('dateTime') || '').trim()

    if (!title || !eventType || !dateTime) {
      setError('Title, category, and date are required.')
      return
    }

    const payload = {
      title,
      eventType,
      dateTime,
      shortDescription: String(form.get('shortDescription') || '').trim() || null,
      description: String(form.get('description') || '').trim() || null,
      startTime: String(form.get('startTime') || '').trim() || null,
      endTime: String(form.get('endTime') || '').trim() || null,
      venue: String(form.get('venue') || '').trim() || null,
      location: String(form.get('location') || '').trim() || null,
      capacity: form.get('capacity') ? Number(form.get('capacity')) : null,
      photoUrl: posterPreview || null,
      status: String(form.get('status') || 'UPCOMING'),
      coordinatorName: String(form.get('coordinatorName') || user.name).trim() || null,
      coordinatorContact: String(form.get('coordinatorContact') || user.memberId).trim() || null,
      organizingTeam: String(form.get('organizingTeam') || '').trim() || null,
      rules: String(form.get('rules') || '').trim() || null,
      agenda: String(form.get('agenda') || '').trim() || null,
      requiresPayment: isPaid,
      paymentAmount: isPaid && form.get('paymentAmount') ? Number(form.get('paymentAmount')) : null,
      paymentQrUrl: isPaid ? qrPreview || null : null,
      paymentUpiId: isPaid ? String(form.get('paymentUpiId') || '').trim() || null : null,
      paymentInstructions: isPaid ? String(form.get('paymentInstructions') || '').trim() || null : null,
      allowMultipleActivities: hasMultipleActivities,
      activities: hasMultipleActivities ? activities.map(a => ({ ...a, price: Number(a.price || 0), capacity: a.capacity ? Number(a.capacity) : null })) : [],
      formFields,
    }

    setSubmitting(true)
    try {
      if (editingEventId) {
        const { event: updated } = await adminApi.updateEvent(editingEventId, payload)
        setEvents(c => c.map(ev => (ev.id === editingEventId ? updated : ev)))
        setMessage(`Event "${updated.title}" updated successfully.`)
        setEditingEventId(null)
      } else {
        const { event: created } = await adminApi.createEvent(payload)
        setEvents(c => [created, ...c])
        setMessage(`Event "${created.title}" published! Created by ${user.name} (${user.memberId}).`)
      }
      e.currentTarget.reset()
      setPosterPreview('')
      setQrPreview('')
      setActivities([])
      setFormFields([])
      setIsPaid(false)
      setHasMultipleActivities(false)
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
              {activeTab === 'basic' && (
                <div className="member-form-grid">
                  <label className="form-wide">
                    Event Title *
                    <input name="title" required placeholder="e.g. Offensive Cyber Operations Workshop 2026" />
                  </label>
                  <label>
                    Category / Type *
                    <select className="member-select" name="eventType" defaultValue="Workshop">
                      <option value="Workshop">Hands-on Workshop</option>
                      <option value="CTF">CTF Competition</option>
                      <option value="Seminar">Guest Seminar</option>
                      <option value="Bootcamp">Security Bootcamp</option>
                      <option value="Hackathon">Cyber Hackathon</option>
                    </select>
                  </label>
                  <label>
                    Status
                    <select className="member-select" name="status" defaultValue="UPCOMING">
                      <option value="UPCOMING">Upcoming</option>
                      <option value="OPEN">Open for Registration</option>
                      <option value="LIVE">Live Now</option>
                      <option value="COMPLETED">Completed</option>
                    </select>
                  </label>
                  <label>
                    Date & Time *
                    <input name="dateTime" type="datetime-local" required />
                  </label>
                  <label>
                    Venue / Lab
                    <input name="venue" placeholder="e.g. Cyber Defense Lab 304" />
                  </label>
                  <label className="form-wide">
                    Short Synopsis
                    <input name="shortDescription" placeholder="One-line summary for event catalog" />
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
                </div>
              )}

              {activeTab === 'details' && (
                <div className="member-form-grid">
                  <label className="form-wide">
                    Full Description
                    <textarea name="description" placeholder="Comprehensive event overview..." style={{ width: '100%', height: '80px', background: '#050a12', border: '1px solid var(--line)', borderRadius: '6px', color: '#fff', padding: '10px' }} />
                  </label>
                  <label className="form-wide">
                    Agenda & Schedule
                    <textarea name="agenda" placeholder="10:00 AM - Keynote&#10;11:30 AM - Lab 1" style={{ width: '100%', height: '80px', background: '#050a12', border: '1px solid var(--line)', borderRadius: '6px', color: '#fff', padding: '10px' }} />
                  </label>
                  <label className="form-wide">
                    Rules & Code of Ethics
                    <textarea name="rules" placeholder="All testing must remain strictly within assigned subnets." style={{ width: '100%', height: '80px', background: '#050a12', border: '1px solid var(--line)', borderRadius: '6px', color: '#fff', padding: '10px' }} />
                  </label>
                </div>
              )}

              {activeTab === 'pricing' && (
                <div className="member-form-grid">
                  <label className="form-wide" style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={isPaid} onChange={e => setIsPaid(e.target.checked)} style={{ width: 'auto', height: 'auto' }} />
                    <b style={{ color: '#edf7ff', fontSize: '13px' }}>Requires Registration Payment</b>
                  </label>

                  {isPaid && (
                    <>
                      <label>
                        Base Entry Fee (₹)
                        <input name="paymentAmount" type="number" step="0.01" placeholder="e.g. 150.00" />
                      </label>
                      <label>
                        UPI ID for Event Payment
                        <input name="paymentUpiId" placeholder="club@okaxis" />
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
                    <input type="checkbox" checked={hasMultipleActivities} onChange={e => setHasMultipleActivities(e.target.checked)} style={{ width: 'auto', height: 'auto' }} />
                    <b style={{ color: '#edf7ff', fontSize: '13px' }}>Offer Multiple Sub-Activities / Tracks</b>
                  </label>

                  {hasMultipleActivities && (
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
                </div>
              )}

              {activeTab === 'fields' && (
                <div className="member-form-grid">
                  <div className="form-wide">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <b style={{ color: '#85d7ff', fontSize: '12px' }}>Custom Registration Questions</b>
                      <button type="button" className="action-btn save-btn" onClick={addCustomField}>＋ Add Question</button>
                    </div>
                    {formFields.map((ff, i) => (
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
                    ))}
                  </div>
                </div>
              )}

              <div className="event-actions" style={{ marginTop: '18px' }}>
                <button className="primary" disabled={submitting}>
                  {submitting ? 'SAVING EVENT…' : editingEventId ? 'UPDATE EVENT' : '＋ &nbsp; PUBLISH EVENT'}
                </button>
                {editingEventId && (
                  <button type="button" className="action-btn cancel-btn" onClick={() => setEditingEventId(null)}>
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
// Gallery Studio (Admin)
// ----------------------------------------------------
function GalleryManagement({ user, logout, onNavigate }) {
  const [albums, setAlbums] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [selectedAlbum, setSelectedAlbum] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [activeLightbox, setActiveLightbox] = useState(null)

  useEffect(() => {
    let mounted = true
    adminApi.listGalleryAlbums()
      .then(({ albums: list }) => { if (mounted) setAlbums(list) })
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
        coverImage: photoPreview || null,
      })
      setAlbums(c => [album, ...c])
      setSelectedAlbum(album)
      e.currentTarget.reset()
      setPhotoPreview('')
      setMessage(`Album "${album.name}" created successfully.`)
    } catch (err) {
      setError(err.message)
    }
  }

  async function addPhoto(e) {
    e.preventDefault()
    if (!selectedAlbum) return
    const form = new FormData(e.currentTarget)
    setMessage('')
    setError('')
    try {
      const { photo } = await adminApi.addGalleryPhoto(selectedAlbum.id, {
        imageUrl: photoPreview,
        caption: String(form.get('caption') || '').trim() || null,
      })
      setSelectedAlbum(a => ({ ...a, photos: [photo, ...(a.photos || [])] }))
      setAlbums(c => c.map(a => (a.id === selectedAlbum.id ? { ...a, photos: [photo, ...(a.photos || [])] } : a)))
      e.currentTarget.reset()
      setPhotoPreview('')
      setMessage('Photo uploaded.')
    } catch (err) {
      setError(err.message)
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
            <p>Create albums, upload event photos, and manage club memories.</p>
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
                Cover Photo
                <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) readImageFile(f, setPhotoPreview) }} />
              </label>
              <button className="primary member-submit" style={{ marginTop: '12px' }}>
                ＋ &nbsp; CREATE ALBUM
              </button>
            </form>
          </article>

          {/* Upload Photo to Selected Album */}
          {selectedAlbum ? (
            <article className="account-form-card">
              <p className="eyebrow">UPLOAD TO ALBUM</p>
              <h2>Add Photo to "{selectedAlbum.name}"</h2>
              <form onSubmit={addPhoto}>
                <label>
                  Photo File *
                  <input type="file" accept="image/*" required onChange={e => { const f = e.target.files?.[0]; if (f) readImageFile(f, setPhotoPreview) }} />
                </label>
                <label>
                  Caption
                  <input name="caption" placeholder="e.g. Final round winners" />
                </label>
                {photoPreview && (
                  <div style={{ margin: '10px 0' }}>
                    <img src={photoPreview} alt="Preview" style={{ maxHeight: '120px', borderRadius: '6px' }} />
                  </div>
                )}
                <button className="primary member-submit" disabled={!photoPreview} style={{ marginTop: '12px' }}>
                  ＋ &nbsp; UPLOAD PHOTO
                </button>
              </form>
            </article>
          ) : (
            <article className="account-form-card" style={{ display: 'grid', placeContent: 'center', textAlign: 'center', minHeight: '180px', color: '#8aa2b4' }}>
              <p>Click on any album below to upload photos or manage its contents.</p>
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

        {/* Lightbox Modal */}
        {activeLightbox && (
          <div className="photo-lightbox" onClick={() => setActiveLightbox(null)}>
            <div className="photo-lightbox-content" onClick={e => e.stopPropagation()}>
              <button className="lightbox-close" onClick={() => setActiveLightbox(null)}>✕</button>
              <img src={activeLightbox.imageUrl} alt="Lightbox preview" />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                {activeLightbox.caption ? <p style={{ color: '#fff', margin: 0 }}>{activeLightbox.caption}</p> : <span />}
                {selectedAlbum && (
                  <button type="button" className="action-btn delete-btn" onClick={e => removePhoto(selectedAlbum.id, activeLightbox.id, e)}>
                    🗑 Delete Photo
                  </button>
                )}
              </div>
            </div>
          </div>
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
// Member Self-Profile Management (Student)
// ----------------------------------------------------
function StudentProfile({ user, logout, onNavigate }) {
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
      setMessage('Profile updated successfully.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <LivePortal user={user} logout={logout} activeTab="student-profile" onNavigate={onNavigate} title="MY PROFILE">
      <section className="member-management">
        <div className="member-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('student-dashboard')}>
              ← BACK TO DASHBOARD
            </button>
            <p className="eyebrow">MEMBER PROFILE</p>
            <h1>Personal Profile & Socials</h1>
            <p>Customize your bio, cybersecurity skills, and external portfolios.</p>
          </div>
          <span className="president-lock">MEMBER ID: {user.memberId}</span>
        </div>

        {message && <p className="member-form-success">{message}</p>}
        {error && <p className="member-form-error">{error}</p>}

        <article className="account-form-card" style={{ maxWidth: '780px' }}>
          <form onSubmit={handleSave}>
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
              <label className="form-wide">
                Profile Photo
                <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) readImageFile(f, setPhotoPreview) }} />
              </label>
            </div>

            {photoPreview && (
              <div style={{ marginTop: '12px' }}>
                <img src={photoPreview} alt="Profile" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #52bbf5' }} />
              </div>
            )}

            <button className="primary member-submit" type="submit" disabled={submitting} style={{ marginTop: '18px' }}>
              {submitting ? 'SAVING PROFILE…' : 'SAVE PROFILE DETAILS'}
            </button>
          </form>
        </article>
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
  const [subRequired, setSubRequired] = useState(false)

  useEffect(() => {
    let mounted = true
    memberApi.listGallery()
      .then(({ albums: list }) => { if (mounted) setAlbums(list || []) })
      .catch(err => {
        if (mounted && (err.code === 'SUBSCRIPTION_REQUIRED' || err.message?.includes('membership is inactive'))) {
          setSubRequired(true)
        }
      })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  return (
    <LivePortal user={user} logout={logout} activeTab="student-gallery" onNavigate={onNavigate} title="CLUB GALLERY">
      <section className="gallery-section">
        <div className="event-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('student-dashboard')}>
              ← BACK TO DASHBOARD
            </button>
            <p className="eyebrow">PHOTO MEMORIES</p>
            <h1>Cyber Security Club Gallery</h1>
            <p>Highlights, award ceremonies, and lab workshops.</p>
          </div>
        </div>

        {subRequired && (
          <div className="pending-alert-banner" style={{ background: '#3a1818', borderColor: '#ef4444', color: '#ffcdd2', marginBottom: '20px' }}>
            <div>
              <b>Member Gallery Locked</b>
              <p style={{ margin: '2px 0 0', fontSize: '11px' }}>
                Active student membership is required to view full photo galleries.
              </p>
            </div>
            <button type="button" onClick={() => onNavigate('student-membership')} style={{ background: '#ef4444', color: '#fff' }}>
              SUBSCRIBE NOW →
            </button>
          </div>
        )}

        {loading ? (
          <p className="directory-state">Loading gallery...</p>
        ) : albums.length === 0 ? (
          <p className="directory-state">No albums published yet.</p>
        ) : (
          <div className="gallery-grid">
            {albums.map(a => (
              <div key={a.id} className="album-card-box">
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
              </div>
            ))}
          </div>
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
  if (a.includes('LOGIN') || a.includes('LOGOUT') || a.includes('AUTH') || a.includes('2FA') || a.includes('PASSWORD')) return 'AUTH'
  if (a.includes('MEMBER') || a.includes('ROLE') || a.includes('STATUS') || a.includes('ACCOUNT')) return 'MEMBERS'
  if (a.includes('EVENT') || a.includes('REGISTRATION') || a.includes('PASS')) return 'EVENTS'
  if (a.includes('SETTING') || a.includes('HIBERNATION') || a.includes('VIDEO') || a.includes('CONFIG')) return 'SYSTEM'
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

  useEffect(() => {
    let mounted = true
    adminApi.listAuditLogs()
      .then(({ auditLogs }) => { if (mounted) setLogs(auditLogs || []) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  const categories = [
    { id: 'ALL', label: 'All Audits', icon: '◫' },
    { id: 'PAYMENTS', label: 'Payments & Subscriptions', icon: '💳' },
    { id: 'AUTH', label: 'Authentication & 2FA', icon: '🔑' },
    { id: 'MEMBERS', label: 'Members & Roles', icon: '👥' },
    { id: 'EVENTS', label: 'Events & Passes', icon: '▢' },
    { id: 'SYSTEM', label: 'System & Controls', icon: '⚙' },
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
          <span className="president-lock">PROTECTED RECORDS</span>
        </div>

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
    if (['team', 'student-team'].includes(path)) return 'student-team'
    if (['gallery', 'student-gallery'].includes(path)) return 'student-gallery'
    if (['profile', 'student-profile'].includes(path)) return 'student-profile'
    if (['security'].includes(path)) return 'security'
    if (['admin/members', 'admin-members'].includes(path)) return 'admin-members'
    if (['admin/events', 'admin-events'].includes(path)) return 'admin-events'
    if (['admin/payments', 'admin-payments'].includes(path)) return 'admin-payments'
    if (['admin/subscriptions', 'admin-subscriptions'].includes(path)) return 'admin-subscriptions'
    if (['admin/team', 'admin-team'].includes(path)) return 'admin-team'
    if (['admin/gallery', 'admin-gallery'].includes(path)) return 'admin-gallery'
    if (['admin/settings', 'admin-settings'].includes(path)) return 'admin-settings'
    if (['admin/audit', 'admin-audit'].includes(path)) return 'admin-audit'
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
      if (screen === 'admin-gallery') return <GalleryManagement user={user} logout={logout} onNavigate={navigateTo} />
      if (screen === 'admin-team') return <TeamManagement user={user} logout={logout} onNavigate={navigateTo} />
      if (screen === 'admin-settings') return <ClubSettingsManager user={user} logout={logout} onNavigate={navigateTo} />
      if (screen === 'admin-audit') return <AuditLogView user={user} logout={logout} onNavigate={navigateTo} />
      if (screen === 'security') return <AccountSecurity user={user} logout={logout} onNavigate={navigateTo} />
      return <LivePresidentDashboard user={user} logout={logout} onNavigate={navigateTo} />
    }

    // Student Screens
    if (screen === 'student-events') return <StudentEvents user={user} logout={logout} onNavigate={navigateTo} />
    if (screen === 'student-registrations') return <StudentRegistrations user={user} logout={logout} onNavigate={navigateTo} />
    if (screen === 'student-membership') return <StudentMembership user={user} logout={logout} onNavigate={navigateTo} />
    if (screen === 'student-team') return <OurTeamShowcase user={user} logout={logout} onNavigate={navigateTo} />
    if (screen === 'student-gallery') return <StudentGallery user={user} logout={logout} onNavigate={navigateTo} />
    if (screen === 'student-profile') return <StudentProfile user={user} logout={logout} onNavigate={navigateTo} />
    if (screen === 'security') return <AccountSecurity user={user} logout={logout} onNavigate={navigateTo} />
    return <LiveStudentDashboard user={user} logout={logout} onNavigate={navigateTo} />
  }

  return <FinalLogin onSignIn={signedIn} onForgotPassword={() => setScreen('password-reset-request')} />
}

export default App
