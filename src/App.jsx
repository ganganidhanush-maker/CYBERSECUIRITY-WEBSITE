import { useEffect, useState } from 'react'
import clubLogo from './assets/branding/cyber-security-club-logo.jpeg'
import { adminApi, authApi, memberApi, readImageFile } from './lib/api'
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
    <div className={`crest official-crest ${small ? 'small' : ''}`}>
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
          <span>CYBER SECURITY</span>
          <strong>CLUB</strong>
          <small>MRDU · DEPARTMENT OF CYBER SECURITY</small>
        </div>
      )}
    </div>
  )
}

function toPortalUser(user) {
  const isPresidentRole = user.role === 'PRESIDENT'
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

const toSafeUser = toPortalUser

// ----------------------------------------------------
// Intro Video Experience (Students on Login)
// ----------------------------------------------------
function IntroVideoExperience({ onComplete }) {
  const [videoUrl, setVideoUrl] = useState('')
  const [duration, setDuration] = useState(120)
  const [currentTime, setCurrentTime] = useState(0)
  const [canProceed, setCanProceed] = useState(false)

  useEffect(() => {
    let mounted = true
    memberApi.getPublicClubSettings()
      .then(({ settings }) => {
        if (mounted && settings?.introVideoUrl) {
          setVideoUrl(settings.introVideoUrl)
        }
      })
      .catch(() => {})
    return () => { mounted = false }
  }, [])

  const isYouTube = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')
  let embedUrl = videoUrl
  if (isYouTube) {
    const videoId = videoUrl.includes('youtu.be/')
      ? videoUrl.split('youtu.be/')[1]?.split('?')[0]
      : new URLSearchParams(new URL(videoUrl.startsWith('http') ? videoUrl : `https://${videoUrl}`).search).get('v')
    if (videoId) {
      embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&rel=0&modestbranding=1`
    }
  }

  // Timer for fallback or YouTube embed
  useEffect(() => {
    if (videoUrl && !isYouTube) return
    const timer = setInterval(() => {
      setCurrentTime(prev => {
        if (prev + 1 >= duration) {
          clearInterval(timer)
          setCanProceed(true)
          return duration
        }
        return prev + 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [duration, videoUrl, isYouTube])

  async function handleFinish() {
    try {
      await memberApi.completeIntroVideo()
    } catch {
      // session update
    }
    onComplete()
  }

  function handleVideoEnded() {
    setCanProceed(true)
  }

  function handleTimeUpdate(e) {
    const curr = Math.floor(e.target.currentTime)
    const dur = Math.floor(e.target.duration)
    setCurrentTime(curr)
    if (dur && Number.isFinite(dur) && dur > 0) {
      setDuration(dur)
    }
    if (curr >= dur && dur > 0) {
      setCanProceed(true)
    }
  }

  function handleLoadedMetadata(e) {
    const dur = Math.floor(e.target.duration)
    if (dur && Number.isFinite(dur) && dur > 0) {
      setDuration(dur)
    }
  }

  const secondsRemaining = Math.max(0, duration - currentTime)

  return (
    <div className="intro-video-overlay">
      <div className="intro-video-container">
        <div className="intro-video-header">
          <b>CYBER SECURITY CLUB · MANDATORY COMMUNITY BRIEFING</b>
          <span>
            {canProceed
              ? '✓ BRIEFING COMPLETE'
              : `MANDATORY INTRO · ${Math.floor(currentTime / 60)}:${String(currentTime % 60).padStart(2, '0')} / ${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`}
          </span>
        </div>

        <div style={{ position: 'relative', background: '#000', aspectRatio: '16/9', overflow: 'hidden' }}>
          {videoUrl && !isYouTube ? (
            <video
              src={videoUrl}
              autoPlay
              playsInline
              controls={false}
              disablePictureInPicture
              controlsList="nodownload nofullscreen noremoteplayback"
              onEnded={handleVideoEnded}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          ) : isYouTube && embedUrl ? (
            <iframe
              src={embedUrl}
              title="Club Intro Video"
              allow="autoplay; encrypted-media"
              style={{ width: '100%', height: '100%', border: 0 }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'grid', placeContent: 'center', textAlign: 'center', padding: '20px' }}>
              <div style={{ maxWidth: '640px' }}>
                <Crest small />
                <h2 style={{ font: '700 24px Syne', color: '#edf7ff', margin: '18px 0 8px' }}>
                  Welcome to the Cyber Security Club
                </h2>
                <p style={{ color: '#8aa2b4', fontSize: '13px', lineHeight: '1.7', margin: '0 0 20px' }}>
                  Welcome to the Department of Cyber Security official student network. We empower students with hands-on defense labs, capture-the-flag competitions, industry certifications, and ethical cybersecurity practices.
                </p>
                <div style={{ padding: '12px', borderRadius: '8px', background: '#08121e', border: '1px solid #48b7f433', color: '#72e0b4', font: '600 11px "DM Mono", monospace' }}>
                  🔒 SECURE MEMBER INITIALIZATION IN PROGRESS... ({secondsRemaining}s remaining)
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="intro-video-footer">
          {canProceed ? (
            <button className="primary" type="button" onClick={handleFinish} style={{ width: '100%' }}>
              ENTER THE CYBER SECURITY PORTAL &nbsp; →
            </button>
          ) : (
            <span>Please watch the club video to complete member initialization ({secondsRemaining}s remaining)</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------------------
// Concurrent Waiting Queue (>20 Active Students)
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
// Navigation & Portal Frame
// ----------------------------------------------------
function Sidebar({ user, logout, activeTab, onNavigate }) {
  const perms = user.permissions || []
  const has = perm => user.isPrimaryAdmin || perms.includes(perm)

  const navItems = user.isAdminUser
    ? [
        ['▦', 'Dashboard', 'admin-dashboard', true],
        ['♙', 'Members', 'admin-members', has('ACCOUNT_MANAGEMENT')],
        ['▢', 'Event Studio', 'admin-events', has('EVENTS_VIEW') || has('EVENT_MANAGE')],
        ['💳', 'Payments', 'admin-payments', has('PAYMENTS_VIEW')],
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
        ['👥', 'Our Team', 'student-team', true],
        ['▧', 'Gallery', 'student-gallery', true],
        ['👤', 'My Profile', 'student-profile', true],
        ['▣', 'Security', 'security', true],
      ]

  return (
    <aside className="sidebar">
      <div className="side-logo">
        <Crest small />
        <strong>CSC <small>MRDU</small></strong>
      </div>
      <nav>
        {navItems.map(([icon, label, target]) => (
          <button
            key={target}
            type="button"
            className={activeTab === target ? 'active' : ''}
            onClick={() => onNavigate(target)}
          >
            <span>{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="side-bottom">
        <button type="button" onClick={logout}>
          <span>↪</span>Sign out
        </button>
        <small>SECURE SESSION</small>
      </div>
    </aside>
  )
}

function Header({ user, title, onSecurity }) {
  return (
    <header className="header">
      <div>
        <b>{title || (user.isAdminUser ? getRoleLabel(user.role).toUpperCase() : 'STUDENT MEMBER PORTAL')}</b>
        <small>CYBER SECURITY CLUB · MRDU</small>
      </div>
      <div className="header-tools">
        {onSecurity && (
          <button
            type="button"
            className="profile profile-button"
            onClick={onSecurity}
            aria-label="Open account security"
          >
            <span>{user.initials}</span>
            <p>
              <b>{user.name}</b>
              <small>{user.isPrimaryAdmin ? 'Primary President' : `${getRoleLabel(user.role)} · ${user.memberId}`}</small>
            </p>
          </button>
        )}
      </div>
    </header>
  )
}

function LivePortal({ user, logout, activeTab, onNavigate, title, children }) {
  return (
    <main className="portal">
      <Sidebar user={user} logout={logout} activeTab={activeTab} onNavigate={onNavigate} />
      <div className="workspace">
        <Header user={user} title={title} onSecurity={() => onNavigate('security')} />
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
            <input id="recovery-member-id" name="memberId" required maxLength={32} pattern="[A-Za-z0-9]+" autoComplete="username" placeholder="e.g. 25EU07R0015" />
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
            <h1>Account security & 2FA</h1>
            <p>Configure multi-factor authentication and manage credential protection.</p>
          </div>
          <span className="president-lock">
            {user.twoFactorEnabled ? '2FA ACTIVE' : '2FA NOT CONFIGURED'}
          </span>
        </div>
        <article className="account-form-card security-card">
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

  // Modals
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
      setMessage(`Account created for ${created.name} (${getRoleLabel(created.role)}) · ID: ${created.memberId}`)
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
    if (member.isPrimaryAdmin) {
      alert('The Primary President cannot be deleted through normal controls.')
      return
    }
    if (!confirm(`Are you sure you want to delete member ${member.memberId}?`)) return
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
      // refresh directory
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

        <div className="member-management-grid">
          <article className="account-form-card">
            <div>
              <p className="eyebrow">CREATE ACCOUNT</p>
              <h2>Add club member</h2>
            </div>
            <form onSubmit={createAccount} noValidate>
              <div className="member-form-grid">
                <label>
                  Club Role
                  <select
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    className="member-select"
                  >
                    {CLUB_ROLES.map(r => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Full Name
                  <input name="name" required maxLength={120} placeholder="e.g. Harsha Vardhan" />
                </label>
                <label>
                  Member ID
                  <input name="memberId" required maxLength={32} placeholder="e.g. 25EU07R0102" />
                </label>
                <label className="form-wide">
                  Initial Password
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={e => setPasswordInput(e.target.value)}
                    required
                    placeholder="At least 12 characters"
                  />
                </label>
              </div>

              <div className="pwd-rules">
                <div className={`pwd-rule ${hasLength ? 'valid' : ''}`}><i>{hasLength ? '✓' : '○'}</i> 12+ Chars</div>
                <div className={`pwd-rule ${hasLower ? 'valid' : ''}`}><i>{hasLower ? '✓' : '○'}</i> Lowercase</div>
                <div className={`pwd-rule ${hasUpper ? 'valid' : ''}`}><i>{hasUpper ? '✓' : '○'}</i> Uppercase</div>
                <div className={`pwd-rule ${hasNumber ? 'valid' : ''}`}><i>{hasNumber ? '✓' : '○'}</i> Number</div>
                <div className={`pwd-rule ${hasSymbol ? 'valid' : ''}`}><i>{hasSymbol ? '✓' : '○'}</i> Symbol</div>
              </div>

              <div className="member-form-grid">
                <label>
                  Roll Number
                  <input name="rollNumber" placeholder="e.g. 25EU07R0102" />
                </label>
                <label>
                  Year
                  <input name="year" type="number" min={1} max={8} placeholder="e.g. 2" />
                </label>
                <label>
                  Department / Branch
                  <input name="department" placeholder="e.g. Cyber Security" />
                </label>
                <label>
                  Email Address
                  <input name="email" type="email" placeholder="e.g. member@college.edu" />
                </label>
                <label className="form-wide">
                  Phone Number
                  <input name="phone" placeholder="Optional contact phone" />
                </label>
              </div>

              <div className="role-help">
                Permissions for <b>{getRoleLabel(role)}</b> will be automatically assigned based on club policy.
              </div>

              {error && <div className="error" role="alert">{error}</div>}
              {message && <div className="member-form-success" role="status">{message}</div>}

              <button className="primary login-button" type="submit" disabled={submitting} style={{ marginTop: '12px' }}>
                {submitting ? 'CREATING...' : 'CREATE MEMBER ACCOUNT'}
              </button>
            </form>
          </article>

          <article className="members-list-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', gap: '10px' }}>
              <div>
                <p className="eyebrow">DIRECTORY</p>
                <h2>Members ({members.length})</h2>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search..."
                style={{ height: '32px', padding: '0 10px', borderRadius: '6px', background: '#04080e', border: '1px solid var(--line)', color: '#fff', fontSize: '11px', width: '150px' }}
              />
            </div>

            {loading ? (
              <p className="directory-state">Loading members...</p>
            ) : (
              <div className="members-table">
                <div className="table-header">
                  <span>ID & Name</span>
                  <span>Role & Status</span>
                  <span>Contact</span>
                  <span>Actions</span>
                </div>
                {filteredMembers.map(m => (
                  editingId === m.id ? (
                    <div key={m.id} className="table-row editing">
                      <div className="edit-fields-grid">
                        <input
                          type="text"
                          value={editData.name ?? m.name ?? ''}
                          onChange={e => setEditData(c => ({ ...c, name: e.target.value }))}
                          placeholder="Name"
                        />
                        <select
                          value={editData.role ?? m.role}
                          onChange={e => setEditData(c => ({ ...c, role: e.target.value }))}
                          disabled={m.isPrimaryAdmin}
                        >
                          {CLUB_ROLES.map(r => (
                            <option key={r.id} value={r.id}>{r.label}</option>
                          ))}
                        </select>
                        <input
                          type="email"
                          value={editData.email ?? m.email ?? ''}
                          onChange={e => setEditData(c => ({ ...c, email: e.target.value }))}
                          placeholder="Email"
                        />
                        <input
                          type="text"
                          value={editData.rollNumber ?? m.profile?.rollNumber ?? ''}
                          onChange={e => setEditData(c => ({ ...c, rollNumber: e.target.value }))}
                          placeholder="Roll Number"
                        />
                      </div>
                      <div className="action-buttons">
                        <button type="button" onClick={() => updateMember(m.id)} className="action-btn save-btn">SAVE</button>
                        <button type="button" onClick={() => setEditingId(null)} className="action-btn cancel-btn">CANCEL</button>
                      </div>
                    </div>
                  ) : (
                    <div key={m.id} className="table-row">
                      <div>
                        <b>{m.name || m.memberId}</b>
                        <small style={{ color: '#7a91a3' }}>ID: {m.memberId}</small>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <span className={`badge ${m.isPrimaryAdmin ? 'badge-president' : m.role === 'STUDENT' ? 'badge-student' : 'badge-admin'}`}>
                          {m.isPrimaryAdmin ? 'PRIMARY PRESIDENT' : getRoleLabel(m.role)}
                        </span>
                        <span className={`badge ${m.accountStatus === 'ACTIVE' ? 'badge-active' : 'badge-disabled'}`}>
                          {m.accountStatus}
                        </span>
                      </div>
                      <div>
                        <small>{m.email || 'No email'}</small>
                      </div>
                      <div className="action-buttons">
                        {m.isPrimaryAdmin ? (
                          <span className="badge badge-president">PROTECTED</span>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="action-btn edit-btn"
                              onClick={() => {
                                setEditingId(m.id)
                                setEditData({ name: m.name, role: m.role, email: m.email, rollNumber: m.profile?.rollNumber })
                              }}
                            >
                              EDIT
                            </button>
                            <button
                              type="button"
                              className="action-btn"
                              style={{ background: '#252140', color: '#cbabff' }}
                              onClick={() => setResetModalUser(m)}
                            >
                              RESET PWD
                            </button>
                            <button
                              type="button"
                              className="action-btn toggle-status-btn"
                              onClick={() => toggleStatus(m)}
                            >
                              {m.accountStatus === 'ACTIVE' ? 'DISABLE' : 'ENABLE'}
                            </button>
                            <button
                              type="button"
                              className="action-btn delete-btn"
                              onClick={() => removeMember(m)}
                            >
                              DEL
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                ))}
              </div>
            )}
          </article>
        </div>

        {/* Transfer Leadership Modal */}
        {transferModalOpen && (
          <div className="photo-lightbox" onClick={() => setTransferModalOpen(false)}>
            <div className="photo-lightbox-content" onClick={e => e.stopPropagation()} style={{ background: '#0b1420', padding: '28px', borderRadius: '14px', border: '1px solid #48b7f455', maxWidth: '480px' }}>
              <button className="lightbox-close" onClick={() => setTransferModalOpen(false)}>✕</button>
              <p className="eyebrow">PRIMARY PRESIDENT TRANSFER</p>
              <h2>Transfer Primary Leadership</h2>
              <p style={{ color: '#8aa2b4', fontSize: '12px', margin: '8px 0 16px' }}>
                Select the successor. They will become the sole Primary Administrator. This requires your 2FA authentication code.
              </p>
              <form onSubmit={handleTransferLeadership}>
                <label style={{ display: 'block', marginBottom: '12px', color: '#edf7ff', fontSize: '11px' }}>
                  Select New President
                  <select
                    className="member-select"
                    value={transferTargetId}
                    onChange={e => setTransferTargetId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose member --</option>
                    {members.filter(m => !m.isPrimaryAdmin).map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.memberId}) - {getRoleLabel(m.role)}</option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'block', marginBottom: '16px', color: '#edf7ff', fontSize: '11px' }}>
                  Your 6-Digit 2FA Code
                  <input
                    type="text"
                    value={transferAuthCode}
                    onChange={e => setTransferAuthCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    required
                    style={{ width: '100%', height: '42px', padding: '0 10px', borderRadius: '6px', background: '#040810', border: '1px solid var(--line)', color: '#fff' }}
                  />
                </label>
                {transferError && <p className="error">{transferError}</p>}
                <button className="primary" type="submit" style={{ width: '100%' }}>
                  CONFIRM LEADERSHIP TRANSFER
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Admin Reset Password Modal */}
        {resetModalUser && (
          <div className="photo-lightbox" onClick={() => setResetModalUser(null)}>
            <div className="photo-lightbox-content" onClick={e => e.stopPropagation()} style={{ background: '#0b1420', padding: '28px', borderRadius: '14px', border: '1px solid var(--line)', maxWidth: '440px' }}>
              <button className="lightbox-close" onClick={() => setResetModalUser(null)}>✕</button>
              <p className="eyebrow">RESET PASSWORD</p>
              <h2>Set New Password for {resetModalUser.name}</h2>
              <form onSubmit={handleAdminResetPassword} style={{ marginTop: '16px' }}>
                <label style={{ display: 'block', marginBottom: '16px', color: '#edf7ff', fontSize: '11px' }}>
                  New Password (12+ chars, upper, lower, number, symbol)
                  <input
                    type="password"
                    value={newPasswordInput}
                    onChange={e => setNewPasswordInput(e.target.value)}
                    required
                    placeholder="Enter secure new password"
                    style={{ width: '100%', height: '42px', padding: '0 10px', borderRadius: '6px', background: '#040810', border: '1px solid var(--line)', color: '#fff' }}
                  />
                </label>
                {resetError && <p className="error">{resetError}</p>}
                <button className="primary" type="submit" style={{ width: '100%' }}>
                  APPLY NEW PASSWORD
                </button>
              </form>
            </div>
          </div>
        )}
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Event Studio (Configurable Events, Activities, Form Fields)
// ----------------------------------------------------
function EventManagement({ user, logout, onNavigate }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('basic')

  // Form State
  const [isPaid, setIsPaid] = useState(false)
  const [hasMultipleActivities, setHasMultipleActivities] = useState(false)
  const [activities, setActivities] = useState([])
  const [formFields, setFormFields] = useState([])
  const [posterPreview, setPosterPreview] = useState('')
  const [speakerPreview, setSpeakerPreview] = useState('')
  const [qrPreview, setQrPreview] = useState('')

  // Editing & Analytics State
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
      coordinatorName: String(form.get('coordinatorName') || '').trim() || null,
      coordinatorContact: String(form.get('coordinatorContact') || '').trim() || null,
      organizingTeam: String(form.get('organizingTeam') || '').trim() || null,
      speakerName: String(form.get('speakerName') || '').trim() || null,
      speakerPhoto: speakerPreview || null,
      speakerDesignation: String(form.get('speakerDesignation') || '').trim() || null,
      registrationDeadline: form.get('registrationDeadline') || null,
      contactEmail: String(form.get('contactEmail') || '').trim() || null,
      contactPhone: String(form.get('contactPhone') || '').trim() || null,
      rules: String(form.get('rules') || '').trim() || null,
      eligibility: String(form.get('eligibility') || '').trim() || null,
      requiredMaterials: String(form.get('requiredMaterials') || '').trim() || null,
      agenda: String(form.get('agenda') || '').trim() || null,
      notes: String(form.get('notes') || '').trim() || null,
      requiresPayment: isPaid,
      paymentAmount: isPaid && !hasMultipleActivities && form.get('paymentAmount') ? Number(form.get('paymentAmount')) : null,
      paymentQrUrl: isPaid ? qrPreview || null : null,
      paymentUpiId: isPaid ? String(form.get('paymentUpiId') || '').trim() || null : null,
      paymentInstructions: isPaid ? String(form.get('paymentInstructions') || '').trim() || null : null,
      requirePaymentProof: isPaid && Boolean(form.get('requirePaymentProof')),
      allowMultipleActivities: hasMultipleActivities,
      activities: hasMultipleActivities ? activities.filter(a => a.name.trim()) : [],
      formFields: formFields.filter(f => f.fieldName.trim()),
    }

    setSubmitting(true)
    try {
      if (editingEventId) {
        const { event: updated } = await adminApi.updateEvent(editingEventId, payload)
        setEvents(c => c.map(item => (item.id === editingEventId ? updated : item)))
        setMessage(`Event "${updated.title}" updated.`)
        setEditingEventId(null)
      } else {
        const { event: created } = await adminApi.createEvent(payload)
        setEvents(c => [created, ...c])
        setMessage(`Event "${created.title}" published.`)
        e.currentTarget.reset()
        setPosterPreview('')
        setSpeakerPreview('')
        setQrPreview('')
        setActivities([])
        setFormFields([])
        setIsPaid(false)
        setHasMultipleActivities(false)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function openAnalytics(eventId) {
    setAnalyticsModalEvent(eventId)
    setLoadingAnalytics(true)
    try {
      const data = await adminApi.getEventDetailsWithStats(eventId)
      setAnalyticsData(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingAnalytics(false)
    }
  }

  function startEdit(evt) {
    setEditingEventId(evt.id)
    setIsPaid(Boolean(evt.requiresPayment))
    setHasMultipleActivities(Boolean(evt.allowMultipleActivities) || (evt.activities && evt.activities.length > 0))
    setActivities(evt.activities || [])
    setFormFields(evt.formFields || [])
    setPosterPreview(evt.photoUrl || '')
    setQrPreview(evt.paymentQrUrl || '')
    setSpeakerPreview(evt.speakerPhoto || '')
  }

  async function removeEvent(id) {
    if (!confirm('Are you sure you want to delete this event and all its registrations?')) return
    try {
      await adminApi.deleteEvent(id)
      setEvents(c => c.filter(item => item.id !== id))
      setMessage('Event removed.')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <LivePortal user={user} logout={logout} activeTab="admin-events" onNavigate={onNavigate} title="EVENT STUDIO">
      <section className="event-management">
        <div className="event-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('admin-dashboard')}>
              ← COMMAND CENTER
            </button>
            <p className="eyebrow">EVENT CREATION & MANAGEMENT</p>
            <h1>Club Event Studio</h1>
            <p>Publish workshops, CTFs, and briefings with multi-tiered activity pricing and custom fields.</p>
          </div>
          <div className="event-hero-stats">
            <span><b>{events.length}</b><small>Total Events</small></span>
          </div>
        </div>

        <div className="event-management-grid">
          <article className="account-form-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p className="eyebrow">{editingEventId ? 'UPDATE EVENT' : 'NEW EVENT'}</p>
                <h2>{editingEventId ? 'Edit Event' : 'Create Event'}</h2>
              </div>
              {editingEventId && (
                <button className="action-btn cancel-btn" type="button" onClick={() => setEditingEventId(null)}>
                  CANCEL EDIT
                </button>
              )}
            </div>

            <div className="studio-tabs" style={{ marginTop: '14px' }}>
              <button type="button" className={`studio-tab-btn ${activeTab === 'basic' ? 'active' : ''}`} onClick={() => setActiveTab('basic')}>Basic Info</button>
              <button type="button" className={`studio-tab-btn ${activeTab === 'optional' ? 'active' : ''}`} onClick={() => setActiveTab('optional')}>Speaker & Details</button>
              <button type="button" className={`studio-tab-btn ${activeTab === 'pricing' ? 'active' : ''}`} onClick={() => setActiveTab('pricing')}>Free / Paid & Activities</button>
              <button type="button" className={`studio-tab-btn ${activeTab === 'fields' ? 'active' : ''}`} onClick={() => setActiveTab('fields')}>Custom Registration Form</button>
            </div>

            <form onSubmit={handleEventSubmit} noValidate>
              <div style={{ display: activeTab === 'basic' ? 'block' : 'none' }}>
                <div className="member-form-grid">
                  <label className="form-wide">
                    Event Title *
                    <input name="title" required placeholder="e.g. Cyber Defense Workshop 2026" defaultValue={events.find(e => e.id === editingEventId)?.title || ''} />
                  </label>
                  <label>
                    Category / Type *
                    <input name="eventType" required placeholder="Workshop, CTF, Seminar" defaultValue={events.find(e => e.id === editingEventId)?.eventType || ''} />
                  </label>
                  <label>
                    Event Date *
                    <input name="dateTime" type="datetime-local" required defaultValue={events.find(e => e.id === editingEventId)?.dateTime ? new Date(events.find(e => e.id === editingEventId).dateTime).toISOString().slice(0, 16) : ''} />
                  </label>
                  <label>
                    Start Time
                    <input name="startTime" placeholder="e.g. 10:00 AM" defaultValue={events.find(e => e.id === editingEventId)?.startTime || ''} />
                  </label>
                  <label>
                    End Time
                    <input name="endTime" placeholder="e.g. 04:00 PM" defaultValue={events.find(e => e.id === editingEventId)?.endTime || ''} />
                  </label>
                  <label>
                    Venue / Room
                    <input name="venue" placeholder="e.g. Cyber Lab 02 / Auditorium" defaultValue={events.find(e => e.id === editingEventId)?.venue || ''} />
                  </label>
                  <label>
                    Maximum Capacity
                    <input name="capacity" type="number" min="1" placeholder="Seats (e.g. 80)" defaultValue={events.find(e => e.id === editingEventId)?.capacity || ''} />
                  </label>
                  <label className="form-wide">
                    Short Description
                    <input name="shortDescription" placeholder="One-line summary for event cards" defaultValue={events.find(e => e.id === editingEventId)?.shortDescription || ''} />
                  </label>
                  <label className="form-wide">
                    Full Description
                    <textarea name="description" rows={4} placeholder="Full event syllabus, overview, and schedule..." defaultValue={events.find(e => e.id === editingEventId)?.description || ''} />
                  </label>
                  <label className="form-wide">
                    Cover Banner Upload
                    <input type="file" accept="image/*" onChange={e => {
                      const f = e.target.files?.[0]
                      if (f) readImageFile(f, setPosterPreview)
                    }} />
                  </label>
                  {posterPreview && (
                    <div className="event-upload-preview form-wide">
                      <img src={posterPreview} alt="Cover preview" />
                      <button type="button" className="preview-remove" onClick={() => setPosterPreview('')}>✕</button>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: activeTab === 'optional' ? 'block' : 'none' }}>
                <div className="member-form-grid">
                  <label>
                    Coordinator Name
                    <input name="coordinatorName" placeholder="Faculty / Student Coordinator" defaultValue={events.find(e => e.id === editingEventId)?.coordinatorName || ''} />
                  </label>
                  <label>
                    Coordinator Contact
                    <input name="coordinatorContact" placeholder="Phone or Email" defaultValue={events.find(e => e.id === editingEventId)?.coordinatorContact || ''} />
                  </label>
                  <label>
                    Speaker / Guest Name
                    <input name="speakerName" placeholder="e.g. Dr. Jane Smith" defaultValue={events.find(e => e.id === editingEventId)?.speakerName || ''} />
                  </label>
                  <label>
                    Speaker Designation
                    <input name="speakerDesignation" placeholder="e.g. Principal Security Researcher" defaultValue={events.find(e => e.id === editingEventId)?.speakerDesignation || ''} />
                  </label>
                  <label className="form-wide">
                    Speaker Photo Upload
                    <input type="file" accept="image/*" onChange={e => {
                      const f = e.target.files?.[0]
                      if (f) readImageFile(f, setSpeakerPreview)
                    }} />
                  </label>
                  {speakerPreview && (
                    <div className="event-upload-preview form-wide">
                      <img src={speakerPreview} alt="Speaker preview" />
                      <button type="button" className="preview-remove" onClick={() => setSpeakerPreview('')}>✕</button>
                    </div>
                  )}
                  <label className="form-wide">
                    Rules & Guidelines
                    <textarea name="rules" rows={3} placeholder="Rules for participants..." defaultValue={events.find(e => e.id === editingEventId)?.rules || ''} />
                  </label>
                  <label className="form-wide">
                    Eligibility & Prerequisites
                    <textarea name="eligibility" rows={2} placeholder="e.g. 2nd-4th year CSE / IT students with laptops" defaultValue={events.find(e => e.id === editingEventId)?.eligibility || ''} />
                  </label>
                  <label className="form-wide">
                    Agenda / Schedule
                    <textarea name="agenda" rows={3} placeholder="10:00 AM - Keynote; 11:30 AM - Lab 1..." defaultValue={events.find(e => e.id === editingEventId)?.agenda || ''} />
                  </label>
                  <label>
                    Contact Email
                    <input name="contactEmail" type="email" placeholder="club@mrdu.edu" defaultValue={events.find(e => e.id === editingEventId)?.contactEmail || ''} />
                  </label>
                  <label>
                    Registration Deadline
                    <input name="registrationDeadline" type="datetime-local" defaultValue={events.find(e => e.id === editingEventId)?.registrationDeadline ? new Date(events.find(e => e.id === editingEventId).registrationDeadline).toISOString().slice(0, 16) : ''} />
                  </label>
                </div>
              </div>

              <div style={{ display: activeTab === 'pricing' ? 'block' : 'none' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', gap: '20px', padding: '14px', background: '#070f1a', borderRadius: '8px', border: '1px solid var(--line)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#edf7ff', fontSize: '12px' }}>
                      <input type="radio" name="paidOption" checked={!isPaid} onChange={() => setIsPaid(false)} />
                      <span>🎉 Free Event (No payment required)</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#edf7ff', fontSize: '12px' }}>
                      <input type="radio" name="paidOption" checked={isPaid} onChange={() => setIsPaid(true)} />
                      <span>💳 Paid Event (Requires fee / QR payment)</span>
                    </label>
                  </div>

                  {isPaid && (
                    <div className="member-form-grid">
                      <div className="form-wide" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <input type="checkbox" id="multi-act" checked={hasMultipleActivities} onChange={e => setHasMultipleActivities(e.target.checked)} />
                        <label htmlFor="multi-act" style={{ cursor: 'pointer', color: '#85d7ff' }}>
                          Enable multiple activities with different prices (e.g. Workshop ₹50, CTF ₹100, Combo ₹130)
                        </label>
                      </div>

                      {!hasMultipleActivities && (
                        <label>
                          Base Registration Fee (₹)
                          <input name="paymentAmount" type="number" min="0" placeholder="e.g. 100" defaultValue={events.find(e => e.id === editingEventId)?.paymentAmount || ''} />
                        </label>
                      )}

                      <label>
                        UPI ID / Account
                        <input name="paymentUpiId" placeholder="e.g. cyberclub@upi" defaultValue={events.find(e => e.id === editingEventId)?.paymentUpiId || ''} />
                      </label>
                      <label className="form-wide">
                        Payment Instructions
                        <textarea name="paymentInstructions" rows={2} placeholder="Scan QR code, pay fee, and upload screenshot with UTR reference..." defaultValue={events.find(e => e.id === editingEventId)?.paymentInstructions || ''} />
                      </label>
                      <label className="form-wide">
                        Payment QR Image
                        <input type="file" accept="image/*" onChange={e => {
                          const f = e.target.files?.[0]
                          if (f) readImageFile(f, setQrPreview)
                        }} />
                      </label>
                      {qrPreview && (
                        <div className="event-upload-preview form-wide">
                          <img src={qrPreview} alt="QR preview" />
                          <button type="button" className="preview-remove" onClick={() => setQrPreview('')}>✕</button>
                        </div>
                      )}
                      <div className="form-wide" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input type="checkbox" name="requirePaymentProof" id="req-proof" defaultChecked={events.find(e => e.id === editingEventId)?.requirePaymentProof} />
                        <label htmlFor="req-proof" style={{ color: '#edf7ff', fontSize: '11px' }}>Require student to upload payment screenshot and UTR number</label>
                      </div>
                    </div>
                  )}

                  {hasMultipleActivities && (
                    <div style={{ marginTop: '12px', borderTop: '1px solid var(--line)', paddingTop: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <b>Event Activities ({activities.length})</b>
                        <button className="action-btn save-btn" type="button" onClick={addActivity}>＋ Add Activity</button>
                      </div>
                      {activities.map((act, index) => (
                        <div key={index} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr auto', gap: '8px', alignItems: 'center', marginBottom: '8px', padding: '8px', background: '#050a12', borderRadius: '6px' }}>
                          <input type="text" placeholder="Activity Name (e.g. CTF Solo)" value={act.name} onChange={e => updateActivity(index, 'name', e.target.value)} />
                          <input type="number" placeholder="Price (₹)" min="0" value={act.price} onChange={e => updateActivity(index, 'price', e.target.value)} />
                          <input type="number" placeholder="Capacity" min="1" value={act.capacity || ''} onChange={e => updateActivity(index, 'capacity', e.target.value)} />
                          <button type="button" className="action-btn delete-btn" onClick={() => removeActivity(index)}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: activeTab === 'fields' ? 'block' : 'none' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <p style={{ margin: 0, color: '#8aa2b4', fontSize: '12px' }}>
                      Add custom fields for this event (e.g. GitHub Username, T-Shirt size, Team Name).
                    </p>
                    <button className="action-btn save-btn" type="button" onClick={addCustomField}>＋ Add Question</button>
                  </div>
                  {formFields.length === 0 ? (
                    <p className="directory-state">No custom fields added. Standard registration fields will apply.</p>
                  ) : (
                    formFields.map((f, index) => (
                      <div key={index} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr auto auto', gap: '8px', alignItems: 'center', marginBottom: '8px', padding: '10px', background: '#050a12', borderRadius: '6px' }}>
                        <input type="text" placeholder="Field Question (e.g. GitHub Profile)" value={f.fieldName} onChange={e => updateCustomField(index, 'fieldName', e.target.value)} />
                        <select value={f.fieldType} onChange={e => updateCustomField(index, 'fieldType', e.target.value)}>
                          <option value="text">Short Text</option>
                          <option value="textarea">Long Text</option>
                          <option value="number">Number</option>
                          <option value="dropdown">Dropdown (comma separated)</option>
                          <option value="checkbox">Checkbox</option>
                        </select>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#edf7ff', fontSize: '10px' }}>
                          <input type="checkbox" checked={f.isRequired} onChange={e => updateCustomField(index, 'isRequired', e.target.checked)} />
                          Required
                        </label>
                        <button type="button" className="action-btn delete-btn" onClick={() => removeCustomField(index)}>✕</button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {error && <div className="error" role="alert" style={{ marginTop: '14px' }}>{error}</div>}
              {message && <div className="member-form-success" role="status" style={{ marginTop: '14px' }}>{message}</div>}

              <button className="primary login-button" type="submit" disabled={submitting} style={{ marginTop: '18px' }}>
                {submitting ? 'SAVING...' : editingEventId ? 'UPDATE EVENT' : 'PUBLISH EVENT'}
              </button>
            </form>
          </article>

          <article className="events-list-card events-directory-card">
            <div className="card-heading">
              <div>
                <p className="eyebrow">PUBLISHED EVENTS</p>
                <h2>Event Catalog ({events.length})</h2>
              </div>
            </div>

            {loading ? (
              <p className="directory-state">Loading events...</p>
            ) : (
              <div className="events-table">
                <div className="table-header">
                  <span>Title & Category</span>
                  <span>Pricing</span>
                  <span>Date & Venue</span>
                  <span>Regs</span>
                  <span>Actions</span>
                </div>
                {events.map(evt => (
                  <div key={evt.id} className="table-row">
                    <div>
                      <b>{evt.title}</b>
                      <small style={{ color: '#7a91a3' }}>{evt.eventType}</small>
                    </div>
                    <div>
                      <span className={`badge ${evt.requiresPayment ? 'badge-admin' : 'badge-student'}`}>
                        {evt.requiresPayment ? `PAID (₹${evt.paymentAmount || 'Tiered'})` : 'FREE'}
                      </span>
                    </div>
                    <div>
                      <small>{new Date(evt.dateTime).toLocaleDateString()}</small>
                      <small style={{ display: 'block', color: '#6f8da1' }}>{evt.venue || evt.location || 'Campus'}</small>
                    </div>
                    <div>
                      <button
                        type="button"
                        className="action-btn"
                        style={{ background: '#10283c', color: '#85d7ff' }}
                        onClick={() => openAnalytics(evt.id)}
                      >
                        📊 {evt.registrationCount || 0} Regs
                      </button>
                    </div>
                    <div className="action-buttons">
                      <button type="button" className="action-btn edit-btn" onClick={() => startEdit(evt)}>EDIT</button>
                      <button type="button" className="action-btn delete-btn" onClick={() => removeEvent(evt.id)}>DEL</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>

        {/* Analytics & Registrations Modal with CSV Export */}
        {analyticsModalEvent && (
          <div className="photo-lightbox" onClick={() => setAnalyticsModalEvent(null)}>
            <div className="photo-lightbox-content" onClick={e => e.stopPropagation()} style={{ background: '#09121e', padding: '28px', borderRadius: '14px', border: '1px solid var(--line)', width: '920px', maxHeight: '85vh', overflowY: 'auto' }}>
              <button className="lightbox-close" onClick={() => setAnalyticsModalEvent(null)}>✕</button>
              {loadingAnalytics || !analyticsData ? (
                <p>Loading event statistics...</p>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                    <div>
                      <p className="eyebrow">EVENT MANAGEMENT ANALYTICS</p>
                      <h2>{analyticsData.event.title}</h2>
                      <small style={{ color: '#8aa2b4' }}>{new Date(analyticsData.event.dateTime).toLocaleString()} · {analyticsData.event.venue || 'Campus'}</small>
                    </div>
                    <a
                      href={`/api/v1/admin/events/${analyticsData.event.id}/export-csv`}
                      download
                      className="primary"
                      style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', height: '36px' }}
                    >
                      📥 EXPORT CSV
                    </a>
                  </div>

                  <div className="stats" style={{ margin: '14px 0 24px' }}>
                    <div className="stat"><i>👥</i><div><p>TOTAL REGS</p><h2>{analyticsData.stats.totalRegistrations}</h2></div></div>
                    <div className="stat green"><i>✓</i><div><p>CONFIRMED</p><h2>{analyticsData.stats.confirmed}</h2></div></div>
                    <div className="stat amber"><i>⏳</i><div><p>PENDING</p><h2>{analyticsData.stats.pending}</h2></div></div>
                    <div className="stat green"><i>₹</i><div><p>VERIFIED REVENUE</p><h2>₹{analyticsData.stats.totalVerifiedRevenue}</h2></div></div>
                  </div>

                  {analyticsData.stats.activityStats?.length > 0 && (
                    <div style={{ marginBottom: '20px', padding: '14px', background: '#040810', borderRadius: '8px' }}>
                      <p className="eyebrow">BREAKDOWN BY ACTIVITY</p>
                      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                        {analyticsData.stats.activityStats.map(act => (
                          <div key={act.id} style={{ padding: '8px 12px', background: '#091522', borderRadius: '6px', border: '1px solid #1a2f45' }}>
                            <b>{act.name}</b> · ₹{act.price}
                            <small style={{ display: 'block', color: '#79dcb3', marginTop: '2px' }}>{act.participantCount} participants · ₹{act.revenue} revenue</small>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="eyebrow">REGISTRATION ROSTER</p>
                  <div className="members-table">
                    <div className="table-header">
                      <span>Name & ID</span>
                      <span>Selected Activity</span>
                      <span>Amount / Status</span>
                      <span>Payment Reference</span>
                    </div>
                    {analyticsData.registrations.map(r => (
                      <div key={r.id} className="table-row">
                        <div>
                          <b>{r.memberName}</b>
                          <small style={{ color: '#7a91a3' }}>{r.rollNumber || r.memberId}</small>
                        </div>
                        <div>
                          <small>{Array.isArray(r.selectedActivities) ? r.selectedActivities.map(a => a.name).join(', ') : 'Standard Entry'}</small>
                        </div>
                        <div>
                          <b>₹{r.totalAmount}</b>
                          <span className={`badge ${r.paymentStatus === 'VERIFIED' || r.status === 'CONFIRMED' ? 'badge-active' : 'badge-disabled'}`} style={{ marginLeft: '6px' }}>
                            {r.paymentStatus || r.status}
                          </span>
                        </div>
                        <div>
                          <small>{r.paymentReference || 'None'}</small>
                          {r.paymentProofUrl && (
                            <a href={r.paymentProofUrl} target="_blank" rel="noreferrer" style={{ color: '#85d7ff', display: 'block', fontSize: '9px' }}>
                              View Proof ↗
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Payment Management & Verification Center
// ----------------------------------------------------
function PaymentManagement({ user, logout, onNavigate }) {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('ALL')
  const [selectedProof, setSelectedProof] = useState(null)

  useEffect(() => {
    let mounted = true
    adminApi.listPayments()
      .then(({ payments: list }) => { if (mounted) setPayments(list) })
      .catch(err => { if (mounted) setError(err.message) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  async function handleVerify(regId, status) {
    try {
      const { registration } = await adminApi.verifyPayment(regId, status, 'Verified via Admin Center')
      setPayments(c => c.map(p => (p.id === regId ? { ...p, paymentStatus: registration.paymentStatus, status: registration.status } : p)))
      setMessage(`Payment status set to ${status}.`)
    } catch (err) {
      setError(err.message)
    }
  }

  const filtered = payments.filter(p => (filter === 'ALL' ? true : p.paymentStatus === filter))

  return (
    <LivePortal user={user} logout={logout} activeTab="admin-payments" onNavigate={onNavigate} title="PAYMENT MANAGEMENT">
      <section className="member-management">
        <div className="member-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('admin-dashboard')}>
              ← COMMAND CENTER
            </button>
            <p className="eyebrow">TREASURY & AUDIT</p>
            <h1>Event Payments & Verification</h1>
            <p>Review student fee submissions, UTR reference numbers, and payment proofs.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['ALL', 'SUBMITTED', 'PENDING', 'VERIFIED', 'REJECTED'].map(st => (
              <button
                key={st}
                type="button"
                className={`action-btn ${filter === st ? 'save-btn' : 'cancel-btn'}`}
                onClick={() => setFilter(st)}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {message && <p className="member-form-success">{message}</p>}
        {error && <p className="member-form-error">{error}</p>}

        <article className="member-list-card">
          {loading ? (
            <p className="directory-state">Loading payments...</p>
          ) : filtered.length === 0 ? (
            <p className="directory-state">No payments found matching criteria.</p>
          ) : (
            <div className="members-table">
              <div className="table-header">
                <span>Student & Event</span>
                <span>Amount & UTR</span>
                <span>Proof & Date</span>
                <span>Status & Actions</span>
              </div>
              {filtered.map(p => (
                <div key={p.id} className="table-row">
                  <div>
                    <b>{p.memberName}</b>
                    <small style={{ color: '#7a91a3' }}>{p.event?.title || 'Club Event'}</small>
                  </div>
                  <div>
                    <b>₹{p.totalAmount}</b>
                    <small style={{ display: 'block', color: '#6f8da1' }}>UTR: {p.paymentReference || 'Not provided'}</small>
                  </div>
                  <div>
                    <small>{new Date(p.registeredAt).toLocaleDateString()}</small>
                    {p.paymentProofUrl ? (
                      <button
                        type="button"
                        className="action-btn"
                        style={{ background: '#122b40', color: '#85d7ff', display: 'block', marginTop: '4px' }}
                        onClick={() => setSelectedProof(p.paymentProofUrl)}
                      >
                        🖼 View Screenshot
                      </button>
                    ) : (
                      <small style={{ display: 'block', color: '#ff9898' }}>No proof uploaded</small>
                    )}
                  </div>
                  <div className="action-buttons">
                    <span className={`badge ${p.paymentStatus === 'VERIFIED' ? 'badge-active' : p.paymentStatus === 'REJECTED' ? 'badge-disabled' : 'badge-admin'}`}>
                      {p.paymentStatus}
                    </span>
                    {p.paymentStatus !== 'VERIFIED' && (
                      <button type="button" className="action-btn save-btn" onClick={() => handleVerify(p.id, 'VERIFIED')}>
                        VERIFY
                      </button>
                    )}
                    {p.paymentStatus !== 'REJECTED' && (
                      <button type="button" className="action-btn delete-btn" onClick={() => handleVerify(p.id, 'REJECTED')}>
                        REJECT
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        {selectedProof && (
          <div className="photo-lightbox" onClick={() => setSelectedProof(null)}>
            <div className="photo-lightbox-content" onClick={e => e.stopPropagation()}>
              <button className="lightbox-close" onClick={() => setSelectedProof(null)}>✕</button>
              <img src={selectedProof} alt="Payment Proof Screenshot" style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: '8px' }} />
            </div>
          </div>
        )}
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Team / Leadership Management & "Our Team" Showcase
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
      .then(({ team: list }) => { if (mounted) setTeam(list) })
      .catch(err => { if (mounted) setError(err.message) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  async function addLeader(e) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setMessage('')
    setError('')

    const payload = {
      name: String(form.get('name') || '').trim(),
      roleTitle: String(form.get('roleTitle') || '').trim(),
      photoUrl: photoPreview || null,
      bio: String(form.get('bio') || '').trim() || null,
      collegeEmail: String(form.get('collegeEmail') || '').trim() || null,
      instagramUrl: String(form.get('instagramUrl') || '').trim() || null,
      githubUrl: String(form.get('githubUrl') || '').trim() || null,
      linkedinUrl: String(form.get('linkedinUrl') || '').trim() || null,
      sortOrder: Number(form.get('sortOrder') || 0),
    }

    try {
      const { member } = await adminApi.createClubTeamMember(payload)
      setTeam(c => [...c, member].sort((a, b) => a.sortOrder - b.sortOrder))
      e.currentTarget.reset()
      setPhotoPreview('')
      setMessage(`Leader ${member.name} added.`)
    } catch (err) {
      setError(err.message)
    }
  }

  async function removeLeader(id) {
    if (!confirm('Remove this leader from the official showcase?')) return
    try {
      await adminApi.deleteClubTeamMember(id)
      setTeam(c => c.filter(item => item.id !== id))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <LivePortal user={user} logout={logout} activeTab="admin-team" onNavigate={onNavigate} title="LEADERSHIP DIRECTORY">
      <section className="gallery-section">
        <div className="event-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('admin-dashboard')}>
              ← COMMAND CENTER
            </button>
            <p className="eyebrow">CLUB LEADERS</p>
            <h1>Our Team & Leadership Structure</h1>
            <p>Manage public leader profiles, executive designations, and display rankings.</p>
          </div>
        </div>

        {message && <p className="member-form-success">{message}</p>}
        {error && <p className="member-form-error">{error}</p>}

        <div className="member-management-grid" style={{ marginBottom: '28px' }}>
          <article className="account-form-card">
            <div>
              <p className="eyebrow">NEW LEADER</p>
              <h2>Add Leadership Profile</h2>
            </div>
            <form onSubmit={addLeader}>
              <div className="member-form-grid">
                <label>
                  Full Name *
                  <input name="name" required placeholder="e.g. Harsha Vardhan" />
                </label>
                <label>
                  Role Title *
                  <input name="roleTitle" required placeholder="e.g. Tech Lead / Vice President" />
                </label>
                <label>
                  College Email
                  <input name="collegeEmail" type="email" placeholder="harsha@college.edu" />
                </label>
                <label>
                  Display Order
                  <input name="sortOrder" type="number" defaultValue={0} placeholder="Rank (0, 1, 2...)" />
                </label>
                <label className="form-wide">
                  Short Bio
                  <input name="bio" placeholder="Brief statement on cybersecurity focus" />
                </label>
                <label>
                  LinkedIn Profile URL
                  <input name="linkedinUrl" placeholder="https://linkedin.com/in/username" />
                </label>
                <label>
                  GitHub Profile URL
                  <input name="githubUrl" placeholder="https://github.com/username" />
                </label>
                <label className="form-wide">
                  Profile Photo Upload
                  <input type="file" accept="image/*" onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) readImageFile(f, setPhotoPreview)
                  }} />
                </label>
              </div>
              {photoPreview && (
                <div className="event-upload-preview" style={{ margin: '10px 0' }}>
                  <img src={photoPreview} alt="Leader Preview" style={{ width: '80px', height: '80px', borderRadius: '50%' }} />
                </div>
              )}
              <button className="primary login-button" type="submit" style={{ marginTop: '12px' }}>
                ADD LEADER TO SHOWCASE
              </button>
            </form>
          </article>
        </div>

        <div className="team-grid">
          {team.map(m => (
            <div key={m.id} className="leader-card">
              {m.photoUrl ? (
                <img className="leader-photo" src={m.photoUrl} alt={m.name} />
              ) : (
                <div className="leader-photo-placeholder">{m.name.slice(0, 2).toUpperCase()}</div>
              )}
              <h3 style={{ margin: '0 0 4px', color: '#edf7ff', font: '700 16px Syne' }}>{m.name}</h3>
              <span className="badge badge-admin" style={{ marginBottom: '8px' }}>{m.roleTitle}</span>
              {m.bio && <p style={{ color: '#8aa2b4', fontSize: '11px', lineHeight: '1.5', margin: '4px 0' }}>{m.bio}</p>}
              <div className="leader-socials">
                {m.collegeEmail && <a className="social-pill" href={`mailto:${m.collegeEmail}`}>Email</a>}
                {m.linkedinUrl && <a className="social-pill" href={m.linkedinUrl} target="_blank" rel="noreferrer">LinkedIn</a>}
                {m.githubUrl && <a className="social-pill" href={m.githubUrl} target="_blank" rel="noreferrer">GitHub</a>}
              </div>
              <button type="button" className="action-btn delete-btn" style={{ marginTop: '14px' }} onClick={() => removeLeader(m.id)}>
                REMOVE LEADER
              </button>
            </div>
          ))}
        </div>
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Public "Our Team" for Students
// ----------------------------------------------------
function OurTeamShowcase({ user, logout, onNavigate }) {
  const [team, setTeam] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    memberApi.listClubTeam()
      .then(({ team: list }) => { if (mounted) setTeam(list) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  return (
    <LivePortal user={user} logout={logout} activeTab="student-team" onNavigate={onNavigate} title="OUR TEAM">
      <section className="gallery-section">
        <div className="event-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('student-dashboard')}>
              ← BACK TO DASHBOARD
            </button>
            <p className="eyebrow">CLUB LEADERSHIP</p>
            <h1>Meet the Cyber Security Club Team</h1>
            <p>Connect with the executive committee, technical leads, and event coordinators.</p>
          </div>
        </div>

        {loading ? (
          <p className="directory-state">Loading team...</p>
        ) : team.length === 0 ? (
          <p className="directory-state">Leadership profiles will be posted soon.</p>
        ) : (
          <div className="team-grid">
            {team.map(m => (
              <div key={m.id} className="leader-card">
                {m.photoUrl ? (
                  <img className="leader-photo" src={m.photoUrl} alt={m.name} />
                ) : (
                  <div className="leader-photo-placeholder">{m.name.slice(0, 2).toUpperCase()}</div>
                )}
                <h3 style={{ margin: '0 0 4px', color: '#edf7ff', font: '700 17px Syne' }}>{m.name}</h3>
                <span className="badge badge-admin" style={{ marginBottom: '8px' }}>{m.roleTitle}</span>
                {m.bio && <p style={{ color: '#8aa2b4', fontSize: '12px', lineHeight: '1.5', margin: '4px 0' }}>{m.bio}</p>}
                <div className="leader-socials">
                  {m.collegeEmail && <a className="social-pill" href={`mailto:${m.collegeEmail}`}>✉ Email</a>}
                  {m.linkedinUrl && <a className="social-pill" href={m.linkedinUrl} target="_blank" rel="noreferrer">LinkedIn ↗</a>}
                  {m.githubUrl && <a className="social-pill" href={m.githubUrl} target="_blank" rel="noreferrer">GitHub ↗</a>}
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
// Club Settings & Central Social Links
// ----------------------------------------------------
function ClubSettingsManager({ user, logout, onNavigate }) {
  const [settings, setSettings] = useState({})
  const [videoPreview, setVideoPreview] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let mounted = true
    adminApi.getClubSettings()
      .then(({ settings: dict }) => {
        if (mounted) {
          setSettings(dict)
          setVideoPreview(dict.introVideoUrl || '')
        }
      })
      .catch(err => { if (mounted) setError(err.message) })
    return () => { mounted = false }
  }, [])

  function handleVideoFile(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setVideoPreview(reader.result)
    }
    reader.readAsDataURL(file)
  }

  async function handleSave(e) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setMessage('')
    setError('')

    const urlInput = String(form.get('introVideoUrl') || '').trim()
    const finalVideoUrl = videoPreview || urlInput || null

    const payload = {
      introVideoUrl: finalVideoUrl,
      instagramUrl: String(form.get('instagramUrl') || '').trim() || null,
      githubUrl: String(form.get('githubUrl') || '').trim() || null,
      linkedinUrl: String(form.get('linkedinUrl') || '').trim() || null,
      youtubeUrl: String(form.get('youtubeUrl') || '').trim() || null,
      twitterUrl: String(form.get('twitterUrl') || '').trim() || null,
      discordUrl: String(form.get('discordUrl') || '').trim() || null,
      whatsappUrl: String(form.get('whatsappUrl') || '').trim() || null,
      websiteUrl: String(form.get('websiteUrl') || '').trim() || null,
    }

    setSubmitting(true)
    try {
      await adminApi.updateClubSettings(payload)
      setMessage('Settings & Social Links updated successfully.')
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
            <h1>Social Links & Club Media</h1>
            <p>Upload mandatory student intro briefing videos of any length, and configure official club social channels.</p>
          </div>
        </div>

        {message && <p className="member-form-success">{message}</p>}
        {error && <p className="member-form-error">{error}</p>}

        <article className="account-form-card" style={{ maxWidth: '780px' }}>
          <form onSubmit={handleSave}>
            <div className="member-form-grid">
              <label className="form-wide">
                Upload Mandatory Intro Video (Any Length — MP4 / WebM)
                <input
                  type="file"
                  accept="video/*"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) handleVideoFile(file)
                  }}
                />
              </label>

              <label className="form-wide">
                Or Paste Video URL / Stream / YouTube Embed Link
                <input
                  name="introVideoUrl"
                  placeholder="https://... (Direct MP4 URL or YouTube link)"
                  value={videoPreview}
                  onChange={e => setVideoPreview(e.target.value)}
                />
              </label>

              {videoPreview && (
                <div className="form-wide" style={{ background: '#050a12', padding: '12px', borderRadius: '8px', border: '1px solid var(--line)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <b style={{ color: '#72e0b4', fontSize: '11px', font: '600 11px "DM Mono", monospace' }}>▶ INTRO VIDEO PREVIEW</b>
                    <button type="button" className="action-btn delete-btn" onClick={() => setVideoPreview('')}>Remove Video</button>
                  </div>
                  {videoPreview.includes('youtube.com') || videoPreview.includes('youtu.be') ? (
                    <p style={{ color: '#8aa2b4', fontSize: '12px' }}>YouTube Video Linked: {videoPreview}</p>
                  ) : (
                    <video src={videoPreview} controls style={{ width: '100%', maxHeight: '240px', borderRadius: '6px' }} />
                  )}
                </div>
              )}

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

            <button className="primary member-submit" type="submit" disabled={submitting} style={{ marginTop: '18px' }}>
              {submitting ? 'SAVING...' : 'SAVE SETTINGS & SOCIAL LINKS'}
            </button>
          </form>
        </article>
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Member Self-Profile Management
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
              <label>
                GitHub Profile
                <input name="githubUrl" defaultValue={profile.githubUrl || ''} placeholder="https://github.com/..." />
              </label>
              <label>
                LinkedIn Profile
                <input name="linkedinUrl" defaultValue={profile.linkedinUrl || ''} placeholder="https://linkedin.com/in/..." />
              </label>
              <label className="form-wide">
                Cybersecurity Skills / Focus
                <input name="skills" defaultValue={profile.skills || ''} placeholder="e.g. Web Security, Network Pentesting, Cryptography" />
              </label>
              <label className="form-wide">
                Profile Photo Upload
                <input type="file" accept="image/*" onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) readImageFile(f, setPhotoPreview)
                }} />
              </label>
            </div>
            {photoPreview && (
              <div className="event-upload-preview" style={{ margin: '10px 0' }}>
                <img src={photoPreview} alt="Avatar" style={{ width: '80px', height: '80px', borderRadius: '50%' }} />
              </div>
            )}
            <button className="primary member-submit" type="submit" disabled={submitting} style={{ marginTop: '14px' }}>
              {submitting ? 'SAVING...' : 'UPDATE PROFILE'}
            </button>
          </form>
        </article>
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Public Event Detail & Interactive Registration Flow
// ----------------------------------------------------
function StudentEventDetail({ user, eventId, logout, onNavigate }) {
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  // Interactive Registration Form State
  const [selectedActivityIds, setSelectedActivityIds] = useState([])
  const [proofPreview, setProofPreview] = useState('')
  const [customFormAnswers, setCustomFormAnswers] = useState({})

  useEffect(() => {
    let mounted = true
    memberApi.getEventDetails(eventId)
      .then(({ event: e }) => {
        if (mounted) {
          setEvent(e)
          if (e.activities?.length > 0) {
            setSelectedActivityIds([e.activities[0].id])
          }
        }
      })
      .catch(err => { if (mounted) setError(err.message) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [eventId])

  function toggleActivity(id) {
    if (event.allowMultipleActivities) {
      setSelectedActivityIds(c => (c.includes(id) ? c.filter(item => item !== id) : [...c, id]))
    } else {
      setSelectedActivityIds([id])
    }
  }

  // Calculate live total price
  let liveTotal = 0
  if (event?.activities?.length > 0 && selectedActivityIds.length > 0) {
    const map = new Map(event.activities.map(a => [a.id, a.price]))
    selectedActivityIds.forEach(id => {
      liveTotal += Number(map.get(id) || 0)
    })
  } else if (event?.requiresPayment && event?.paymentAmount) {
    liveTotal = Number(event.paymentAmount)
  }

  async function handleRegister(e) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setMessage('')
    setError('')

    const payload = {
      selectedActivityIds: event.activities?.length ? selectedActivityIds : undefined,
      paymentReference: String(form.get('paymentReference') || '').trim() || null,
      paymentProofUrl: proofPreview || null,
      branch: String(form.get('branch') || '').trim() || null,
      section: String(form.get('section') || '').trim() || null,
      year: form.get('year') ? Number(form.get('year')) : null,
      emergencyContact: String(form.get('emergencyContact') || '').trim() || null,
      teamName: String(form.get('teamName') || '').trim() || null,
      github: String(form.get('github') || '').trim() || null,
      formData: customFormAnswers,
    }

    setSubmitting(true)
    try {
      const { registration } = await memberApi.registerForEvent(event.id, payload)
      setEvent(c => ({
        ...c,
        isRegistered: true,
        userRegistration: registration,
        registrationStatus: registration.status,
      }))
      setMessage('Registration submitted successfully!')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <LivePortal user={user} logout={logout} activeTab="student-events" onNavigate={onNavigate}><p>Loading event...</p></LivePortal>
  if (error || !event) return <LivePortal user={user} logout={logout} activeTab="student-events" onNavigate={onNavigate}><p className="error">{error || 'Event not found'}</p></LivePortal>

  return (
    <LivePortal user={user} logout={logout} activeTab="student-events" onNavigate={onNavigate} title={event.title.toUpperCase()}>
      <section className="event-detail-page">
        <button className="back-button" type="button" onClick={() => onNavigate('student-events')}>
          ← BROWSE ALL EVENTS
        </button>

        <div className="event-detail-hero">
          <div className="event-detail-main">
            <div className="event-detail-banner">
              {event.photoUrl ? (
                <img src={event.photoUrl} alt={event.title} />
              ) : (
                <div className="event-banner-fallback">
                  <strong>{event.eventType.toUpperCase()}</strong>
                </div>
              )}
              <span className="event-badge-overlay">{event.eventType}</span>
            </div>

            <div className="event-info-box">
              <span className={`badge ${event.requiresPayment ? 'badge-admin' : 'badge-student'}`} style={{ marginBottom: '8px' }}>
                {event.requiresPayment ? `PAID EVENT (₹${event.paymentAmount || 'Tiered'})` : 'FREE EVENT'}
              </span>
              <h1 style={{ margin: '0 0 10px', font: '700 clamp(24px, 3vw, 32px) Syne', color: '#edf7ff' }}>{event.title}</h1>
              <p style={{ color: '#abc0d0', fontSize: '13px', lineHeight: '1.7', margin: '0 0 18px' }}>
                {event.description || event.shortDescription || 'Hands-on session by the Department of Cyber Security.'}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', padding: '14px', background: '#070f1a', borderRadius: '8px', border: '1px solid var(--line)', color: '#8aa2b4', font: '500 11px "DM Mono", monospace' }}>
                <div>📅 <b>Date:</b> {new Date(event.dateTime).toLocaleDateString()}</div>
                <div>⏰ <b>Time:</b> {event.startTime || '10:00 AM'} - {event.endTime || 'End'}</div>
                <div>📍 <b>Venue:</b> {event.venue || event.location || 'Campus'}</div>
                <div>👥 <b>Capacity:</b> {event.capacity ? `${event.capacity} seats` : 'Open'}</div>
              </div>
            </div>

            {event.speakerName && (
              <div className="event-info-box">
                <p className="eyebrow">FEATURED SPEAKER</p>
                <div className="event-speaker-card">
                  {event.speakerPhoto ? (
                    <img className="speaker-avatar" src={event.speakerPhoto} alt={event.speakerName} />
                  ) : (
                    <div className="speaker-avatar" style={{ background: '#102235', display: 'grid', placeItems: 'center', color: '#85d7ff', font: '700 18px Syne' }}>
                      {event.speakerName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 style={{ margin: 0, color: '#edf7ff', font: '700 16px Syne' }}>{event.speakerName}</h3>
                    <small style={{ color: '#79dcb3' }}>{event.speakerDesignation || 'Guest Lecturer / Industry Specialist'}</small>
                  </div>
                </div>
              </div>
            )}

            {event.rules && (
              <div className="event-info-box">
                <p className="eyebrow">RULES & GUIDELINES</p>
                <p style={{ color: '#8aa2b4', fontSize: '12px', lineHeight: '1.6', whiteSpace: 'pre-line' }}>{event.rules}</p>
              </div>
            )}

            {event.agenda && (
              <div className="event-info-box">
                <p className="eyebrow">AGENDA & SCHEDULE</p>
                <p style={{ color: '#8aa2b4', fontSize: '12px', lineHeight: '1.6', whiteSpace: 'pre-line' }}>{event.agenda}</p>
              </div>
            )}
          </div>

          {/* Registration Box */}
          <div className="event-detail-sidebar">
            <div className="account-form-card" style={{ position: 'sticky', top: '24px' }}>
              <p className="eyebrow">REGISTRATION</p>
              <h2>{event.isRegistered ? 'Your Confirmed Pass' : 'Register Now'}</h2>

              {message && <p className="member-form-success" style={{ margin: '10px 0' }}>{message}</p>}
              {error && <p className="member-form-error" style={{ margin: '10px 0' }}>{error}</p>}

              {event.isRegistered ? (
                <div style={{ marginTop: '16px', padding: '16px', background: '#05121e', borderRadius: '10px', border: '1px solid #48b7f444' }}>
                  <span className="badge badge-registered">✓ REGISTRATION ACTIVE</span>
                  <h3 style={{ margin: '12px 0 6px', color: '#edf7ff' }}>Pass ID: {event.userRegistration?.id?.slice(0, 8)}</h3>
                  <p style={{ color: '#8aa2b4', fontSize: '11px', margin: 0 }}>
                    Status: <b style={{ color: '#72e0b4' }}>{event.registrationStatus || 'REGISTERED'}</b>
                  </p>
                  {event.userRegistration?.totalAmount > 0 && (
                    <p style={{ color: '#8aa2b4', fontSize: '11px', marginTop: '6px' }}>
                      Payment: <b>{event.userRegistration.paymentStatus}</b> (₹{event.userRegistration.totalAmount})
                    </p>
                  )}
                </div>
              ) : (
                <form onSubmit={handleRegister} noValidate style={{ marginTop: '14px' }}>
                  {event.activities?.length > 0 && (
                    <div>
                      <label style={{ display: 'block', color: '#85d7ff', fontSize: '11px', fontWeight: 'bold' }}>
                        {event.allowMultipleActivities ? 'Select Activities (Multiple allowed)' : 'Select Activity Option'}
                      </label>
                      <div className="activity-selector-list">
                        {event.activities.map(act => (
                          <div
                            key={act.id}
                            className={`activity-option ${selectedActivityIds.includes(act.id) ? 'selected' : ''}`}
                            onClick={() => toggleActivity(act.id)}
                          >
                            <div>
                              <b>{act.name}</b>
                              {act.description && <small style={{ display: 'block', color: '#7a91a3' }}>{act.description}</small>}
                            </div>
                            <span className="activity-price">{act.price > 0 ? `₹${act.price}` : 'FREE'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="total-price-badge">
                    <span>Total Fee:</span>
                    <span style={{ color: '#72e0b4', font: '700 16px "DM Mono", monospace' }}>
                      {liveTotal > 0 ? `₹${liveTotal}` : 'FREE'}
                    </span>
                  </div>

                  <div className="member-form-grid" style={{ marginTop: '10px' }}>
                    <label>
                      Full Name
                      <input name="name" defaultValue={user.name} required />
                    </label>
                    <label>
                      Roll Number
                      <input name="rollNumber" defaultValue={user.profile?.rollNumber || ''} placeholder="e.g. 25EU07R0101" />
                    </label>
                    <label>
                      Branch / Department
                      <input name="branch" defaultValue={user.profile?.department || ''} placeholder="e.g. Cyber Security" />
                    </label>
                    <label>
                      Year
                      <input name="year" type="number" defaultValue={user.profile?.year || ''} placeholder="e.g. 2" />
                    </label>
                  </div>

                  {event.formFields?.length > 0 && (
                    <div style={{ marginTop: '12px' }}>
                      <p className="eyebrow">ADDITIONAL QUESTIONS</p>
                      {event.formFields.map(f => (
                        <label key={f.id} style={{ display: 'block', marginBottom: '10px', color: '#edf7ff', fontSize: '11px' }}>
                          {f.fieldName} {f.isRequired && '*'}
                          <input
                            type={f.fieldType === 'number' ? 'number' : 'text'}
                            required={f.isRequired}
                            placeholder={f.fieldName}
                            onChange={e => setCustomFormAnswers(c => ({ ...c, [f.fieldName]: e.target.value }))}
                          />
                        </label>
                      ))}
                    </div>
                  )}

                  {liveTotal > 0 && (
                    <div style={{ marginTop: '14px', padding: '14px', background: '#050a12', borderRadius: '8px', border: '1px solid #48b7f433' }}>
                      <p className="eyebrow">PAYMENT INSTRUCTIONS</p>
                      {event.paymentUpiId && <p style={{ color: '#85d7ff', fontSize: '11px', margin: '4px 0' }}>UPI ID: <b>{event.paymentUpiId}</b></p>}
                      {event.paymentInstructions && <p style={{ color: '#8aa2b4', fontSize: '11px', margin: '4px 0' }}>{event.paymentInstructions}</p>}
                      {event.paymentQrUrl && (
                        <div style={{ textAlign: 'center', margin: '10px 0' }}>
                          <img src={event.paymentQrUrl} alt="Payment QR" style={{ width: '150px', height: '150px', borderRadius: '8px', border: '2px solid white' }} />
                          <small style={{ display: 'block', color: '#789', marginTop: '4px' }}>Scan with PhonePe, GPay, or Paytm</small>
                        </div>
                      )}
                      <label style={{ display: 'block', margin: '8px 0', color: '#edf7ff', fontSize: '11px' }}>
                        Transaction UTR / Reference ID *
                        <input name="paymentReference" required placeholder="12-digit UTR number" />
                      </label>
                      <label style={{ display: 'block', margin: '8px 0', color: '#edf7ff', fontSize: '11px' }}>
                        Upload Payment Screenshot
                        <input type="file" accept="image/*" onChange={e => {
                          const f = e.target.files?.[0]
                          if (f) readImageFile(f, setProofPreview)
                        }} />
                      </label>
                    </div>
                  )}

                  <button className="primary login-button" type="submit" disabled={submitting} style={{ marginTop: '16px' }}>
                    {submitting ? 'PROCESSING...' : liveTotal > 0 ? 'SUBMIT PAYMENT & REGISTER' : 'CONFIRM FREE REGISTRATION'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Student Dashboard & Catalog
// ----------------------------------------------------
function LiveStudentDashboard({ user, logout, onNavigate }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    memberApi.listEvents()
      .then(({ events: list }) => { if (mounted) setEvents(list) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  return (
    <LivePortal user={user} logout={logout} activeTab="student-dashboard" onNavigate={onNavigate} title="STUDENT MEMBER HUB">
      <section className="welcome">
        <div>
          <p className="eyebrow">DEPARTMENT OF CYBER SECURITY</p>
          <h1>Hello, {user.name} <span>👋</span></h1>
          <p>Welcome to the official Cyber Security Club member hub.</p>
        </div>
        <button className="outline" type="button" onClick={() => onNavigate('student-events')}>
          BROWSE ALL EVENTS &nbsp;→
        </button>
      </section>

      <section className="action-grid">
        <article className="hero-action events-action">
          <i>▢</i>
          <p>CLUB EVENTS</p>
          <h2>{events.length} <span>Live</span></h2>
          <small>Workshops, CTFs & Seminars</small>
          <button type="button" onClick={() => onNavigate('student-events')}>VIEW EVENTS &nbsp;→</button>
        </article>

        <article className="hero-action pass-action">
          <i>▤</i>
          <p>MY PASSES</p>
          <h2>{events.filter(e => e.isRegistered).length} <span>Active</span></h2>
          <small>Your confirmed event registrations</small>
          <button type="button" onClick={() => onNavigate('student-registrations')}>VIEW PASSES &nbsp;→</button>
        </article>

        <article className="mini-action" style={{ cursor: 'pointer' }} onClick={() => onNavigate('student-team')}>
          <i>👥</i>
          <b>OUR LEADERSHIP</b>
          <small>Meet club leaders <em>›</em></small>
        </article>

        <article className="mini-action" style={{ cursor: 'pointer' }} onClick={() => onNavigate('student-profile')}>
          <i>👤</i>
          <b>MY PROFILE</b>
          <small>Update skills & bio <em>›</em></small>
        </article>
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
                      REGISTER NOW
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

function StudentEvents({ user, logout, onNavigate }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    memberApi.listEvents()
      .then(({ events: list }) => { if (mounted) setEvents(list) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  return (
    <LivePortal user={user} logout={logout} activeTab="student-events" onNavigate={onNavigate} title="CLUB EVENTS">
      <section className="gallery-section">
        <div className="event-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('student-dashboard')}>
              ← BACK TO DASHBOARD
            </button>
            <p className="eyebrow">BROWSE SESSIONS</p>
            <h1>Upcoming Club Events</h1>
            <p>Register for hands-on defense workshops, capture the flag games, and guest seminars.</p>
          </div>
        </div>

        {loading ? (
          <p className="directory-state">Loading catalog...</p>
        ) : events.length === 0 ? (
          <p className="directory-state">No events available right now.</p>
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
                  <p>{evt.shortDescription || evt.description || 'Hands-on session by the Cyber Security Club.'}</p>
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
      </section>
    </LivePortal>
  )
}

function StudentRegistrations({ user, logout, onNavigate }) {
  const [registrations, setRegistrations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    memberApi.listRegistrations()
      .then(({ registrations: list }) => { if (mounted) setRegistrations(list) })
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
            <p className="eyebrow">CONFIRMED REGISTRATIONS</p>
            <h1>My Event Passes</h1>
            <p>Your confirmed participation records and QR attendance passes.</p>
          </div>
        </div>

        {loading ? (
          <p className="directory-state">Loading passes...</p>
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
                    <span>Payment: <b style={{ color: '#72e0b4' }}>{reg.paymentStatus}</b></span>
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
// Gallery & Media Studio
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

  async function removeAlbum(albumId, e) {
    if (e) e.stopPropagation()
    if (!confirm('Are you sure you want to permanently delete this album and all its photos?')) return
    setMessage('')
    setError('')
    try {
      await adminApi.deleteGalleryAlbum(albumId)
      setAlbums(c => c.filter(a => a.id !== albumId))
      if (selectedAlbum?.id === albumId) setSelectedAlbum(null)
      if (activeLightbox) setActiveLightbox(null)
      setMessage('Album deleted successfully.')
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
      setAlbums(c => c.map(a => (a.id === selectedAlbum.id ? { ...a, photos: [photo, ...(a.photos || [])] } : a)))
      setSelectedAlbum(c => (c ? { ...c, photos: [photo, ...(c.photos || [])] } : c))
      e.currentTarget.reset()
      setPhotoPreview('')
      setMessage('Photo uploaded to album successfully.')
    } catch (err) {
      setError(err.message)
    }
  }

  async function removePhoto(albumId, photoId, e) {
    if (e) e.stopPropagation()
    if (!confirm('Are you sure you want to delete this photo from the album?')) return
    setMessage('')
    setError('')
    try {
      await adminApi.deleteGalleryPhoto(albumId, photoId)
      setAlbums(c => c.map(a => {
        if (a.id === albumId) {
          return { ...a, photos: (a.photos || []).filter(p => p.id !== photoId) }
        }
        return a
      }))
      setSelectedAlbum(c => (c ? { ...c, photos: (c.photos || []).filter(p => p.id !== photoId) } : c))
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
            <p className="eyebrow">EXCLUSIVE MEDIA MANAGEMENT</p>
            <h1>Event Albums & Photo Gallery</h1>
            <p>Create, update, add photos, or delete albums. Only authorized club administrators have permission to edit.</p>
          </div>
        </div>

        {message && <p className="member-form-success">{message}</p>}
        {error && <p className="member-form-error">{error}</p>}

        <div className="member-management-grid" style={{ marginBottom: '28px' }}>
          <article className="account-form-card">
            <p className="eyebrow">NEW ALBUM</p>
            <h2>Create New Album</h2>
            <form onSubmit={createAlbum}>
              <div className="member-form-grid">
                <label>
                  Album Name *
                  <input name="name" required placeholder="e.g. NullCon CTF 2026" />
                </label>
                <label>
                  Description
                  <input name="description" placeholder="Optional album summary" />
                </label>
                <label className="form-wide">
                  Cover Photo Upload
                  <input type="file" accept="image/*" onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) readImageFile(f, setPhotoPreview)
                  }} />
                </label>
                {photoPreview && !selectedAlbum && (
                  <div className="event-upload-preview form-wide">
                    <img src={photoPreview} alt="Cover preview" />
                    <button type="button" className="preview-remove" onClick={() => setPhotoPreview('')}>✕</button>
                  </div>
                )}
              </div>
              <button className="primary login-button" type="submit" style={{ marginTop: '12px' }}>CREATE ALBUM</button>
            </form>
          </article>

          {selectedAlbum ? (
            <article className="account-form-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p className="eyebrow">UPLOAD PHOTO</p>
                  <h2>Add to: {selectedAlbum.name}</h2>
                </div>
                <button
                  type="button"
                  className="action-btn delete-btn"
                  onClick={(e) => removeAlbum(selectedAlbum.id, e)}
                  style={{ padding: '6px 12px' }}
                >
                  🗑 Delete Album
                </button>
              </div>

              <form onSubmit={addPhoto} style={{ marginTop: '10px' }}>
                <label style={{ display: 'block', marginBottom: '8px' }}>
                  Photo File *
                  <input type="file" accept="image/*" required onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) readImageFile(f, setPhotoPreview)
                  }} />
                </label>
                {photoPreview && (
                  <div className="event-upload-preview" style={{ marginBottom: '10px' }}>
                    <img src={photoPreview} alt="Photo upload preview" />
                    <button type="button" className="preview-remove" onClick={() => setPhotoPreview('')}>✕</button>
                  </div>
                )}
                <label style={{ display: 'block', marginBottom: '12px' }}>
                  Caption
                  <input name="caption" placeholder="e.g. Workshop Lab Session" />
                </label>
                <button className="primary login-button" type="submit">UPLOAD PHOTO</button>
              </form>
            </article>
          ) : (
            <article className="account-form-card" style={{ display: 'grid', placeContent: 'center', textAlign: 'center', minHeight: '180px', color: '#8aa2b4' }}>
              <p>Click on any album below to upload photos or manage its contents.</p>
            </article>
          )}
        </div>

        <div className="section-title" style={{ marginTop: '24px' }}>
          <div>
            <p className="eyebrow">ALBUM DIRECTORY</p>
            <h2>All Albums ({albums.length})</h2>
          </div>
        </div>

        {loading ? (
          <p className="directory-state">Loading gallery albums...</p>
        ) : albums.length === 0 ? (
          <p className="directory-state">No albums created yet. Use the form above to add your first album.</p>
        ) : (
          <div className="gallery-grid">
            {albums.map(a => (
              <div
                key={a.id}
                className="album-card-box"
                onClick={() => setSelectedAlbum(a)}
                style={{
                  borderColor: selectedAlbum?.id === a.id ? '#48b7f4' : undefined,
                  cursor: 'pointer',
                  position: 'relative',
                }}
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
                  <small style={{ color: '#85d7ff' }}>{selectedAlbum?.id === a.id ? '✓ Selected' : 'Click to manage'}</small>
                  <button
                    type="button"
                    className="action-btn delete-btn"
                    onClick={(e) => removeAlbum(a.id, e)}
                    style={{ fontSize: '10px', padding: '4px 8px' }}
                    title="Delete entire album"
                  >
                    🗑 Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedAlbum && (
          <div style={{ marginTop: '36px', borderTop: '1px solid var(--line)', paddingTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p className="eyebrow">SELECTED ALBUM PHOTOS</p>
                <h2>{selectedAlbum.name} ({selectedAlbum.photos?.length || 0} Photos)</h2>
              </div>
              <button
                type="button"
                className="action-btn delete-btn"
                onClick={(e) => removeAlbum(selectedAlbum.id, e)}
              >
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
                      <button
                        type="button"
                        className="action-btn delete-btn"
                        onClick={(e) => removePhoto(selectedAlbum.id, p.id, e)}
                        style={{ fontSize: '10px', padding: '4px 8px' }}
                      >
                        🗑 Remove Photo
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeLightbox && (
          <div className="photo-lightbox" onClick={() => setActiveLightbox(null)}>
            <div className="photo-lightbox-content" onClick={e => e.stopPropagation()}>
              <button className="lightbox-close" onClick={() => setActiveLightbox(null)}>✕</button>
              <img src={activeLightbox.imageUrl} alt="Lightbox preview" />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                {activeLightbox.caption ? <p style={{ color: '#fff', margin: 0 }}>{activeLightbox.caption}</p> : <span />}
                {selectedAlbum && (
                  <button
                    type="button"
                    className="action-btn delete-btn"
                    onClick={(e) => removePhoto(selectedAlbum.id, activeLightbox.id, e)}
                  >
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

function StudentGallery({ user, logout, onNavigate }) {
  const [albums, setAlbums] = useState([])
  const [loading, setLoading] = useState(true)
  const [activePhoto, setActivePhoto] = useState(null)

  useEffect(() => {
    let mounted = true
    memberApi.listGallery()
      .then(({ albums: list }) => { if (mounted) setAlbums(list) })
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
            <p className="eyebrow">EVENT MEMORIES</p>
            <h1>Photo Gallery</h1>
            <p>Browse moments from workshops, hackathons, and guest seminars.</p>
          </div>
        </div>

        {loading ? (
          <p className="directory-state">Loading gallery...</p>
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
                  <p>{a.description || 'Club activity collection'}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {albums.some(a => a.photos?.length > 0) && (
          <div style={{ marginTop: '36px' }}>
            <div className="section-title">
              <div><p className="eyebrow">RECENT HIGHLIGHTS</p><h2>Latest Photos</h2></div>
            </div>
            <div className="gallery-grid" style={{ marginTop: '16px' }}>
              {albums.flatMap(a => a.photos || []).map(p => (
                <div key={p.id} className="album-card-box" onClick={() => setActivePhoto(p)}>
                  <div className="album-cover"><img src={p.imageUrl} alt={p.caption || 'Photo'} /></div>
                  {p.caption && <div className="album-details"><p>{p.caption}</p></div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {activePhoto && (
          <div className="photo-lightbox" onClick={() => setActivePhoto(null)}>
            <div className="photo-lightbox-content" onClick={e => e.stopPropagation()}>
              <button className="lightbox-close" onClick={() => setActivePhoto(null)}>✕</button>
              <img src={activePhoto.imageUrl} alt="Photo" />
              {activePhoto.caption && <p style={{ color: '#fff', textAlign: 'center', marginTop: '8px' }}>{activePhoto.caption}</p>}
            </div>
          </div>
        )}
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Admin Command Center Dashboard
// ----------------------------------------------------
function LivePresidentDashboard({ user, logout, onNavigate }) {
  const [memberCount, setMemberCount] = useState(null)
  const [eventCount, setEventCount] = useState(null)
  const [auditLogs, setAuditLogs] = useState([])

  useEffect(() => {
    let mounted = true
    Promise.all([
      adminApi.listMembers().catch(() => ({ users: [] })),
      adminApi.listEvents().catch(() => ({ events: [] })),
      adminApi.listAuditLogs().catch(() => ({ auditLogs: [] })),
    ]).then(([m, e, a]) => {
      if (mounted) {
        setMemberCount(m.users?.length || 0)
        setEventCount(e.events?.length || 0)
        setAuditLogs(a.auditLogs?.slice(0, 5) || [])
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

      <section className="stats">
        <div className="stat"><i>♙</i><div><p>MEMBERS</p><h2>{memberCount === null ? '...' : memberCount}</h2><small>Registered Accounts</small></div></div>
        <div className="stat"><i>▢</i><div><p>EVENTS</p><h2>{eventCount === null ? '...' : eventCount}</h2><small>Club Catalog</small></div></div>
        <div className={`stat ${user.twoFactorEnabled ? 'green' : 'amber'}`}><i>▣</i><div><p>2FA STATUS</p><h2>{user.twoFactorEnabled ? 'ON' : 'OFF'}</h2><small>Account Protection</small></div></div>
        <div className="stat green"><i>✓</i><div><p>SYSTEM ROLE</p><h2>{user.isPrimaryAdmin ? 'PRIMARY' : user.role.slice(0, 7)}</h2><small>{getRoleLabel(user.role)}</small></div></div>
      </section>

      <section className="admin-bottom">
        <article className="panel activity">
          <div className="section-title">
            <div>
              <p className="eyebrow">AUDIT STREAM</p>
              <h2>Recent Security Events</h2>
            </div>
          </div>
          {auditLogs.length === 0 ? (
            <p className="directory-state">No recent activity.</p>
          ) : (
            auditLogs.map(entry => (
              <div className="activity" key={entry.id}>
                <i>✓</i>
                <div>
                  <b>{entry.action.replaceAll('_', ' ')}</b>
                  <p>{new Date(entry.createdAt).toLocaleString()} · IP: {entry.ipAddress || 'Internal'}</p>
                </div>
              </div>
            ))
          )}
          <button className="outline" type="button" onClick={() => onNavigate('admin-audit')} style={{ marginTop: '14px' }}>
            VIEW FULL AUDIT LOG
          </button>
        </article>

        <article className="quick">
          <div><p className="eyebrow">QUICK ACCESS</p><h2>Management Tools</h2></div>
          <section>
            <button type="button" onClick={() => onNavigate('admin-members')}>
              <i>♙</i><b>Members</b><small>Access control</small>
            </button>
            <button type="button" onClick={() => onNavigate('admin-events')}>
              <i>▢</i><b>Events</b><small>Studio & stats</small>
            </button>
            <button type="button" onClick={() => onNavigate('admin-payments')}>
              <i>💳</i><b>Payments</b><small>Verify proofs</small>
            </button>
            <button type="button" onClick={() => onNavigate('admin-team')}>
              <i>👥</i><b>Team</b><small>Leader profiles</small>
            </button>
            <button type="button" onClick={() => onNavigate('admin-gallery')}>
              <i>▧</i><b>Gallery</b><small>Media studio</small>
            </button>
            <button type="button" onClick={() => onNavigate('admin-settings')}>
              <i>⚙</i><b>Settings</b><small>Social links</small>
            </button>
          </section>
        </article>
      </section>
    </LivePortal>
  )
}

function AuditLogView({ user, logout, onNavigate }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    adminApi.listAuditLogs()
      .then(({ auditLogs }) => { if (mounted) setLogs(auditLogs) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

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
            <p>Immutable log of administrative changes, logins, and registrations.</p>
          </div>
          <span className="president-lock">PROTECTED RECORDS</span>
        </div>

        <article className="member-list-card">
          {loading ? (
            <p className="directory-state">Loading logs...</p>
          ) : logs.length === 0 ? (
            <p className="directory-state">No audit logs recorded yet.</p>
          ) : (
            logs.map(entry => (
              <div className="directory-member" key={entry.id}>
                <span className="directory-avatar">{entry.action.slice(0, 2)}</span>
                <div>
                  <b>{entry.action.replaceAll('_', ' ')}</b>
                  <small>{new Date(entry.createdAt).toLocaleString()} · IP: {entry.ipAddress || 'Internal'}</small>
                  {entry.metadata && <p>{JSON.stringify(entry.metadata)}</p>}
                </div>
              </div>
            ))
          )}
        </article>
      </section>
    </LivePortal>
  )
}

// ----------------------------------------------------
// Root App Controller with Path Preservation
// ----------------------------------------------------
function App() {
  const [user, setUser] = useState(null)
  const resetToken = new URLSearchParams(window.location.search).get('token')
  const [screen, setScreen] = useState(resetToken ? 'reset-password' : 'login')
  const [checkingSession, setCheckingSession] = useState(true)

  // Experience flags
  const [showIntroVideo, setShowIntroVideo] = useState(false)
  const [showWaitingQueue, setShowWaitingQueue] = useState(false)

  // Parse path on initial load to preserve refresh state
  function getScreenFromPath(role) {
    const path = window.location.pathname.replace(/^\//, '')
    if (path.startsWith('event-detail/')) return path
    if (['events', 'student-events'].includes(path)) return 'student-events'
    if (['registrations', 'student-registrations'].includes(path)) return 'student-registrations'
    if (['team', 'student-team'].includes(path)) return 'student-team'
    if (['gallery', 'student-gallery'].includes(path)) return 'student-gallery'
    if (['profile', 'student-profile'].includes(path)) return 'student-profile'
    if (['security'].includes(path)) return 'security'
    if (['admin/members', 'admin-members'].includes(path)) return 'admin-members'
    if (['admin/events', 'admin-events'].includes(path)) return 'admin-events'
    if (['admin/payments', 'admin-payments'].includes(path)) return 'admin-payments'
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

        // Check session status (intro video & queue)
        try {
          const status = await memberApi.getSessionStatus()
          if (!status.introVideoCompleted && portalUser.role === 'STUDENT') {
            setShowIntroVideo(true)
          } else if (status.requiresWaitingQueue) {
            setShowWaitingQueue(true)
          }
        } catch {
          // fallback
        }

        setScreen(getScreenFromPath(portalUser.role))
      })
      .catch(() => {
        if (mounted) setScreen('login')
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
      return
    }
    const portalUser = toPortalUser(result.user)
    setUser(portalUser)

    try {
      const status = await memberApi.getSessionStatus()
      if (!status.introVideoCompleted && portalUser.role === 'STUDENT') {
        setShowIntroVideo(true)
      } else if (status.requiresWaitingQueue) {
        setShowWaitingQueue(true)
      }
    } catch {
      // fallback
    }

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

  if (screen === 'reset-password' && resetToken) return <PasswordReset token={resetToken} onComplete={() => setScreen('login')} />
  if (screen === 'password-reset-request') return <PasswordResetRequest onBack={() => setScreen('login')} />
  if (screen === 'two-factor') return <TwoFactorLogin onVerify={verifyTwoFactor} onBack={() => setScreen('login')} />

  if (user) {
    // Intro video modal overlay for students on first login of session
    if (showIntroVideo) {
      return <IntroVideoExperience onComplete={() => setShowIntroVideo(false)} />
    }

    // High traffic waiting queue countdown
    if (showWaitingQueue) {
      return <ConcurrentWaitingQueue onComplete={() => setShowWaitingQueue(false)} />
    }

    // Detail Route
    if (screen.startsWith('event-detail/')) {
      const eventId = screen.replace('event-detail/', '')
      return <StudentEventDetail user={user} eventId={eventId} logout={logout} onNavigate={navigateTo} />
    }

    // Admin Screens
    if (user.isAdminUser) {
      if (screen === 'admin-members') return <MemberManagement user={user} logout={logout} onNavigate={navigateTo} />
      if (screen === 'admin-events') return <EventManagement user={user} logout={logout} onNavigate={navigateTo} />
      if (screen === 'admin-payments') return <PaymentManagement user={user} logout={logout} onNavigate={navigateTo} />
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
    if (screen === 'student-team') return <OurTeamShowcase user={user} logout={logout} onNavigate={navigateTo} />
    if (screen === 'student-gallery') return <StudentGallery user={user} logout={logout} onNavigate={navigateTo} />
    if (screen === 'student-profile') return <StudentProfile user={user} logout={logout} onNavigate={navigateTo} />
    if (screen === 'security') return <AccountSecurity user={user} logout={logout} onNavigate={navigateTo} />
    return <LiveStudentDashboard user={user} logout={logout} onNavigate={navigateTo} />
  }

  return <FinalLogin onSignIn={signedIn} onForgotPassword={() => setScreen('password-reset-request')} />
}

export default App
