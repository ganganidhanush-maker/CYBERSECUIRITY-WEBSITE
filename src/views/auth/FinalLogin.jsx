import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Crest } from '../../components/common/Crest'
import { Icon8, IconAlertTriangle, IconDownload, IconHeadset, IconLifebuoy, IconShieldCheck, IconSparkles, IconUserSvg } from '../../components/icons'
import MrduOfficialLanding from '../../components/MrduOfficialLanding'
import { usePlatformTheme } from '../../context/PlatformThemeContext'
import { authApi } from '../../lib/api'
import { ACADEMIC_YEARS, BRANCH_OPTIONS, CSE_SPECIALIZATIONS, OFFICIAL_COLLEGES_LIST } from '../../lib/constants'
import { downloadIdPass } from '../../lib/id-pass'

export function GuestRegisterModal({ isOpen, onClose, onSuccess }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [gender, setGender] = useState('MALE')
  const [age, setAge] = useState(19)
  const [year, setYear] = useState(1)
  const [collegeChoice, setCollegeChoice] = useState('Malla Reddy (MR) Deemed to be University, Maisammaguda, Hyderabad')
  const [customCollege, setCustomCollege] = useState('')
  const [branch, setBranch] = useState('CSE')
  const [specialization, setSpecialization] = useState('AIML')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!isOpen) return null

  const isCustomCollege = collegeChoice === 'Other / External University (Specify Below)' || collegeChoice === 'Other'
  const effectiveCollege = isCustomCollege ? customCollege.trim() : collegeChoice

  async function handleRegister(e) {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Please enter your full name.')
      return
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.')
      return
    }
    if (isCustomCollege && !customCollege.trim()) {
      setError('Please enter your college name.')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        name: name.trim(),
        email: email.trim(),
        gender,
        age: age ? Number(age) : null,
        year: year ? Number(year) : 1,
        college: effectiveCollege,
        branch,
        specialization: branch === 'CSE' ? specialization : null,
      }

      const res = await authApi.registerGuest(payload)
      // Automatically download official ID Pass.png
      await downloadIdPass({
        name: payload.name,
        college: payload.college,
        branch: payload.branch,
        year: payload.year,
        specialization: payload.specialization,
        memberId: res.memberId,
        password: res.password,
      })

      onSuccess({
        name: payload.name,
        college: payload.college,
        branch: payload.branch,
        year: payload.year,
        specialization: payload.specialization,
        memberId: res.memberId,
        password: res.password,
      })
    } catch (err) {
      setError(err.message || 'Unable to create guest account. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="photo-lightbox" onClick={onClose}>
      <div className="guest-modal-content" onClick={e => e.stopPropagation()}>
        <button className="lightbox-close" onClick={onClose}>✕</button>

        <div style={{ textAlign: 'center', marginBottom: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Crest small />
          <span className="badge badge-registered" style={{ margin: '12px auto 6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            STUDENT PORTAL REGISTRATION
          </span>
          <h2 style={{ font: '700 22px Syne', color: 'var(--text-main)', margin: '4px 0 4px' }}>
            Create Student Account
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: 0 }}>
            Guest & External Student Portal Access · MRDU & Partner Colleges
          </p>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid #ef444455', color: '#fca5a5', fontSize: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }} role="alert">
            <IconAlertTriangle size={14} /> {error}
          </div>
        )}

        <form onSubmit={handleRegister}>
          <div className="guest-field-group">
            <label>Full Name *</label>
            <input
              required
              placeholder="e.g. Rahul Sharma"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div className="guest-field-group">
            <label>Official Email Address *</label>
            <input
              type="email"
              required
              placeholder="e.g. rahul.sharma@gmail.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div className="guest-field-group" style={{ margin: 0 }}>
              <label>Gender *</label>
              <select
                value={gender}
                onChange={e => setGender(e.target.value)}
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other / Non-Binary</option>
              </select>
            </div>
            <div className="guest-field-group" style={{ margin: 0 }}>
              <label>Age *</label>
              <input
                type="number"
                min="15"
                max="60"
                required
                placeholder="19"
                value={age}
                onChange={e => setAge(e.target.value)}
              />
            </div>
          </div>

          <div className="guest-field-group">
            <label>College / Institution Name *</label>
            <select
              value={collegeChoice}
              onChange={e => setCollegeChoice(e.target.value)}
            >
              {OFFICIAL_COLLEGES_LIST.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {isCustomCollege && (
            <div className="guest-field-group">
              <label>Enter College / University Name *</label>
              <input
                required
                placeholder="e.g. JNTU Hyderabad / Osmania University"
                value={customCollege}
                onChange={e => setCustomCollege(e.target.value)}
              />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div className="guest-field-group" style={{ margin: 0 }}>
              <label>Academic Year *</label>
              <select
                value={year}
                onChange={e => setYear(Number(e.target.value))}
              >
                {ACADEMIC_YEARS.map(y => (
                  <option key={y.value} value={y.value}>{y.label}</option>
                ))}
              </select>
            </div>

            <div className="guest-field-group" style={{ margin: 0 }}>
              <label>Branch / Department *</label>
              <select
                value={branch}
                onChange={e => setBranch(e.target.value)}
              >
                {BRANCH_OPTIONS.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          </div>

          {branch === 'CSE' && (
            <div className="guest-field-group">
              <label>CSE Specialization *</label>
              <select
                value={specialization}
                onChange={e => setSpecialization(e.target.value)}
              >
                {CSE_SPECIALIZATIONS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ background: 'var(--panel-subtle)', border: '1px solid var(--line)', borderRadius: '8px', padding: '12px', margin: '16px 0', fontSize: '11px', color: 'var(--brand-primary)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
              <IconShieldCheck size={14} /> Automated Credentials & ID Pass Generation:
            </span>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              Your unique <b>Guest Member ID</b> (e.g. <code>GUEST2026001</code>) and a <b>14-character secure password</b> will be automatically generated. An official <b>ID Pass.png</b> will be downloaded directly to your device.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button
              type="button"
              className="action-btn"
              onClick={onClose}
              style={{ flex: 1, height: '42px', background: 'var(--panel-elevated)', color: 'var(--text-main)', border: '1px solid var(--line)' }}
            >
              CANCEL
            </button>
            <button
              type="submit"
              className="primary"
              disabled={submitting}
              style={{ flex: 2, height: '42px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              {submitting ? 'GENERATING ID PASS…' : <><IconSparkles size={13} /> CREATE ACCOUNT & DOWNLOAD PASS</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function GuestCredentialsSuccessModal({ data, onClose, onProceedToLogin }) {
  if (!data) return null

  return (
    <div className="photo-lightbox">
      <div className="guest-modal-content" style={{ textAlign: 'center', maxWidth: '520px' }}>
        <span style={{ display: 'inline-flex', padding: '14px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', marginBottom: '12px' }}>
          <IconShieldCheck size={36} />
        </span>
        <h2 style={{ color: 'var(--text-main)', font: '700 22px Syne', margin: '0 0 4px' }}>
          Account Created Successfully!
        </h2>
        <p style={{ color: '#059669', fontSize: '12px', fontWeight: 600, margin: '0 0 16px' }}>
          ✓ Official ID Pass.png has been automatically downloaded to your device
        </p>

        <div className="guest-credentials-card">
          <div className="cred-row">
            <span className="cred-label">STUDENT NAME</span>
            <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{data.name}</span>
          </div>
          <div className="cred-row">
            <span className="cred-label">COLLEGE / INSTITUTION</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{data.college}</span>
          </div>
          <div className="cred-row">
            <span className="cred-label">ACADEMIC YEAR</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
              {ACADEMIC_YEARS.find(y => y.value === Number(data.year))?.label || `Year ${data.year || 1}`}
            </span>
          </div>
          <div className="cred-row">
            <span className="cred-label">BRANCH</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{data.branch}{data.specialization ? ` (${data.specialization})` : ''}</span>
          </div>
          <div className="cred-row">
            <span className="cred-label">MEMBER ID (USERNAME)</span>
            <span className="cred-value">{data.memberId}</span>
          </div>
          <div className="cred-row">
            <span className="cred-label">GENERATED PASSWORD</span>
            <span className="cred-value" style={{ color: '#059669', border: '1px solid rgba(5, 150, 105, 0.3)' }}>{data.password}</span>
          </div>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '11px', lineHeight: '1.5', margin: '0 0 20px' }}>
          Please keep an offline copy of your credentials. You can use this Member ID and Password to sign in to the portal anytime.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            type="button"
            className="action-btn"
            onClick={() => downloadIdPass(data)}
            style={{ width: '100%', height: '40px', background: 'var(--panel-elevated)', color: 'var(--brand-primary)', border: '1px solid var(--brand-border-subtle)', fontSize: '11px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <IconDownload size={13} /> DOWNLOAD ID PASS.PNG AGAIN
          </button>
          <button
            type="button"
            className="primary"
            onClick={onProceedToLogin}
            style={{ width: '100%', height: '44px', fontSize: '11px' }}
          >
            PROCEED TO LOGIN →
          </button>
        </div>
      </div>
    </div>
  )
}

export function ForgotPasswordModal({ isOpen, onClose }) {
  const [copied, setCopied] = useState(false)
  if (!isOpen) return null

  function handleCopy() {
    navigator.clipboard?.writeText('cybersecurityclub@mrdu.edu').then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    }).catch(() => {})
  }

  return (
    <div className="photo-lightbox" onClick={onClose}>
      <div className="guest-modal-content" onClick={e => e.stopPropagation()} style={{ textAlign: 'center', maxWidth: '480px' }}>
        <button className="lightbox-close" onClick={onClose}>✕</button>
        <span style={{ display: 'inline-flex', padding: '14px', borderRadius: '50%', background: 'var(--brand-badge-bg)', color: 'var(--brand-primary)', marginBottom: '12px' }}>
          <IconHeadset size={32} />
        </span>
        <h2 style={{ color: 'var(--text-main)', font: '700 20px Syne', margin: '0 0 6px' }}>
          Account Recovery & Support
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.6', margin: '0 0 20px' }}>
          For account recovery, password reset, or credential lookup, please reach out to the Club Executive Team or visit the Department Office with your College ID.
        </p>

        <div style={{ background: 'var(--panel-subtle)', border: '1px solid var(--line)', borderRadius: '10px', padding: '14px', marginBottom: '20px', textAlign: 'left' }}>
          <small style={{ color: 'var(--text-dim)', fontSize: '10px', fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>OFFICIAL HELPDESK EMAIL</small>
          <code style={{ fontSize: '13px', color: 'var(--brand-primary)', display: 'block', marginTop: '4px', wordBreak: 'break-all' }}>cybersecurityclub@mrdu.edu</code>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="action-btn"
            onClick={handleCopy}
            style={{ flex: 1, height: '42px', background: 'var(--panel-elevated)', color: 'var(--brand-primary)', border: '1px solid var(--brand-border-subtle)', fontSize: '11px', fontWeight: 600 }}
          >
            {copied ? '✓ COPIED TO CLIPBOARD' : 'COPY EMAIL ADDRESS'}
          </button>
          <button
            type="button"
            className="primary"
            onClick={onClose}
            style={{ flex: 1, height: '42px', fontSize: '11px' }}
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  )
}

export function FinalLogin({ onSignIn, onForgotPassword }) {
  const [error, setError] = useState('')
  const [errorCode, setErrorCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [memberIdVal, setMemberIdVal] = useState('')
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [guestSuccessData, setGuestSuccessData] = useState(null)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [publicEvents, setPublicEvents] = useState([])

  const { platformMode } = usePlatformTheme()
  const isMrdu = platformMode === 'MRDU_EVENTS'

  // Cursor-reactive grid
  const showcaseRef = useRef(null)
  const handleShowcaseMouseMove = useCallback((e) => {
    const el = showcaseRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const pctX = (x / rect.width) * 100
    const pctY = (y / rect.height) * 100
    const ox = ((x / rect.width) - 0.5) * 16
    const oy = ((y / rect.height) - 0.5) * 16
    el.style.setProperty('--gx', `${pctX}%`)
    el.style.setProperty('--gy', `${pctY}%`)
    el.style.setProperty('--ox', `${ox}px`)
    el.style.setProperty('--oy', `${oy}px`)
  }, [])
  const handleShowcaseMouseLeave = useCallback(() => {
    const el = showcaseRef.current
    if (!el) return
    el.style.setProperty('--gx', '50%')
    el.style.setProperty('--gy', '40%')
    el.style.setProperty('--ox', '0px')
    el.style.setProperty('--oy', '0px')
  }, [])

  // Interactive Login Card Dynamic Spotlight
  const loginCardRef = useRef(null)
  const handleCardMouseMove = useCallback((e) => {
    const el = loginCardRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const pctX = (x / rect.width) * 100
    const pctY = (y / rect.height) * 100
    el.style.setProperty('--card-x', `${pctX}%`)
    el.style.setProperty('--card-y', `${pctY}%`)
  }, [])
  const handleCardMouseLeave = useCallback(() => {
    const el = loginCardRef.current
    if (!el) return
    el.style.setProperty('--card-x', '50%')
    el.style.setProperty('--card-y', '30%')
  }, [])

  useEffect(() => {
    if (isMrdu) {
      authApi.getPublicEvents()
        .then(res => setPublicEvents(res.events || []))
        .catch(() => {})
    }
  }, [isMrdu])

  async function submit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const memberId = String(form.get('memberId') || '').trim().toUpperCase()
    const password = String(form.get('password') || '')
    if (!/^[A-Z0-9]{5,32}$/.test(memberId) || password.length < 12) {
      setError('Enter a valid Member ID and password (12+ characters).')
      setErrorCode('')
      return
    }
    setError('')
    setErrorCode('')
    setLoading(true)
    try {
      await onSignIn(memberId, password)
    } catch (requestError) {
      setError(requestError.message || 'Unable to sign in.')
      setErrorCode(requestError.code || '')
    } finally {
      setLoading(false)
    }
  }

  const isAccountDisabled = errorCode === 'ACCOUNT_DISABLED' || error.toLowerCase().includes('disabled') || error.toLowerCase().includes('technical team')

  if (isMrdu) {
    return (
      <main className="mrdu-landing-wrapper">
        <MrduOfficialLanding
          onOpenAuth={() => setShowLoginModal(true)}
          onOpenRegister={() => setShowRegisterModal(true)}
          events={publicEvents}
        />

        {/* Modal for Portal Sign In */}
        {showLoginModal && (
          <div
            className="modal-backdrop"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(7, 22, 44, 0.75)',
              backdropFilter: 'blur(8px)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
            }}
            onClick={() => setShowLoginModal(false)}
          >
            <div
              className="login-card"
              style={{
                maxWidth: '460px',
                width: '100%',
                background: '#ffffff',
                border: '1px solid rgba(11, 30, 54, 0.15)',
                borderRadius: '20px',
                padding: '36px 32px',
                boxShadow: '0 24px 60px rgba(0, 0, 0, 0.3)',
                position: 'relative',
              }}
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setShowLoginModal(false)}
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '14px',
                  color: '#475569',
                }}
              >
                ✕
              </button>

              <div style={{ textAlign: 'center', marginBottom: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Crest platformMode={platformMode} small />
                <span className="badge badge-president" style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#fff7ed', color: '#ea580c', border: '1px solid rgba(234, 88, 12, 0.2)' }}>
                  OFFICIAL UNIVERSITY ACCESS
                </span>
                <h2 style={{ font: '800 24px "Plus Jakarta Sans", sans-serif', color: '#0b1e36', margin: '10px 0 4px' }}>Sign in to Portal</h2>
                <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
                  Enter your university credentials to access events & passes.
                </p>
              </div>

              <form onSubmit={submit} noValidate>
                <div className="login-field-group">
                  <label htmlFor="modal-member-id" style={{ color: '#0b1e36', fontWeight: 600 }}>Member / Student ID</label>
                  <div className="login-input-wrapper">
                    <span className="login-input-icon" style={{ color: '#64748b' }}><IconUserSvg size={14} /></span>
                    <input
                      id="modal-member-id"
                      name="memberId"
                      required
                      maxLength={32}
                      pattern="[A-Za-z0-9]+"
                      autoComplete="username"
                      placeholder="e.g. 25EU07R0015"
                      value={memberIdVal}
                      onChange={e => setMemberIdVal(e.target.value.toUpperCase())}
                      style={{ color: '#0f172a', background: '#f8fafc', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                </div>

                <div className="login-field-group">
                  <label htmlFor="modal-password" style={{ color: '#0b1e36', fontWeight: 600 }}>Account Password</label>
                  <div className="login-input-wrapper">
                    <span className="login-input-icon" style={{ color: '#64748b' }}><Icon8 name="password" size={14} /></span>
                    <input
                      id="modal-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={12}
                      maxLength={128}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      style={{ color: '#0f172a', background: '#f8fafc', border: '1px solid #cbd5e1' }}
                    />
                    <button
                      type="button"
                      className="login-pwd-toggle"
                      onClick={() => setShowPassword(p => !p)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      <Icon8 name="showPassword" size={15} />
                    </button>
                  </div>
                </div>

                {error && (
                  <div
                    style={{
                      padding: '14px 16px',
                      borderRadius: '10px',
                      background: isAccountDisabled ? '#fef2f2' : 'rgba(239, 68, 68, 0.12)',
                      border: isAccountDisabled ? '1.5px solid #f87171' : '1px solid #ef444455',
                      color: isAccountDisabled ? '#991b1b' : '#b91c1c',
                      fontSize: '12px',
                      marginBottom: '16px',
                      lineHeight: '1.55',
                    }}
                    role="alert"
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <span style={{ color: '#dc2626', flexShrink: 0, marginTop: '2px' }}><IconAlertTriangle size={18} /></span>
                      <div>
                        <b style={{ color: '#dc2626', display: 'block', fontSize: '13px', fontWeight: 800, marginBottom: '3px', letterSpacing: '0.02em' }}>
                          {isAccountDisabled ? 'ACCOUNT ACCESS DISABLED' : 'AUTHENTICATION FAILED'}
                        </b>
                        <span>{error}</span>
                        {isAccountDisabled && (
                          <div style={{ marginTop: '10px' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setShowLoginModal(false)
                                setShowForgotModal(true)
                              }}
                              style={{
                                background: '#dc2626',
                                color: '#ffffff',
                                border: 'none',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                              }}
                            >
                              <IconLifebuoy size={13} /> Contact Technical Helpdesk ➔
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <button
                  className="primary"
                  disabled={loading}
                  style={{
                    width: '100%',
                    minHeight: '46px',
                    fontSize: '12px',
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #ff5722, #dc2626)',
                    boxShadow: '0 4px 16px rgba(255, 87, 34, 0.35)',
                    borderRadius: '10px',
                  }}
                >
                  {loading ? 'AUTHENTICATING SECURE SESSION…' : 'SIGN IN TO UNIVERSITY PORTAL ➔'}
                </button>
              </form>

              <div className="login-footer-links" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '18px' }}>
                <button
                  className="back-button"
                  type="button"
                  onClick={() => {
                    setShowLoginModal(false)
                    setShowRegisterModal(true)
                  }}
                  style={{ margin: 0, fontSize: '12px', color: '#ff5722', fontWeight: 700 }}
                >
                  Register as Guest
                </button>
                <span style={{ color: '#cbd5e1', fontSize: '12px' }}>|</span>
                <button
                  className="back-button"
                  type="button"
                  onClick={() => {
                    setShowLoginModal(false)
                    setShowForgotModal(true)
                  }}
                  style={{ margin: 0, fontSize: '12px', color: '#475569' }}
                >
                  Forgot Password?
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Guest Student Registration Modal */}
        {showRegisterModal && (
          <GuestRegisterModal
            isOpen={showRegisterModal}
            onClose={() => setShowRegisterModal(false)}
            onSuccess={data => {
              setShowRegisterModal(false)
              setGuestSuccessData(data)
            }}
          />
        )}

        {/* Auto-Downloaded Credentials Confirmation Modal */}
        {guestSuccessData && (
          <GuestCredentialsSuccessModal
            data={guestSuccessData}
            onClose={() => setGuestSuccessData(null)}
            onProceedToLogin={() => {
              setMemberIdVal(guestSuccessData.memberId)
              setGuestSuccessData(null)
              setShowLoginModal(true)
            }}
          />
        )}

        {/* Forgot Password / Support Modal */}
        {showForgotModal && (
          <ForgotPasswordModal
            isOpen={showForgotModal}
            onClose={() => setShowForgotModal(false)}
          />
        )}
      </main>
    )
  }

  return (
    <main className="login-page">
      <section
        className="login-showcase"
        ref={showcaseRef}
        onMouseMove={handleShowcaseMouseMove}
        onMouseLeave={handleShowcaseMouseLeave}
        style={{
          '--gx': '50%',
          '--gy': '40%',
          '--ox': '0px',
          '--oy': '0px',
        }}
      >
        <div className="grid-overlay" />
        <div className="login-showcase-spotlight" />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--brand-eyebrow)', font: '600 10px "DM Mono", monospace', letterSpacing: '.12em', zIndex: 2 }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--brand-accent)', boxShadow: '0 0 10px var(--brand-accent)', display: 'inline-block' }} />
          {isMrdu ? 'MALLA REDDY (DEEMED TO BE UNIVERSITY) · NAAC A++' : 'OFFICIAL STUDENT COMMUNITY · MRDU'}
        </div>

        <div style={{ position: 'relative', zIndex: 2, maxWidth: '560px', margin: '40px 0' }}>
          <Crest platformMode={platformMode} showBanner={isMrdu} />
          <div style={{ marginTop: '28px' }}>
            <p className="eyebrow">{isMrdu ? 'MALLA REDDY UNIVERSITY' : 'DEPARTMENT OF CYBER SECURITY'}</p>
            <h1 style={{ font: '800 clamp(32px, 4vw, 54px)/1.08 Syne', color: 'var(--text-main)', margin: '8px 0 16px', letterSpacing: '-.04em' }}>
              {isMrdu ? (
                <>
                  Empowering innovation.<br />
                  <em style={{ color: 'var(--brand-primary)', fontStyle: 'normal' }}>Central Events Portal.</em>
                </>
              ) : (
                <>
                  Defend the digital frontier.<br />
                  <em style={{ color: 'var(--brand-primary)', fontStyle: 'normal' }}>Empower tomorrow.</em>
                </>
              )}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.7', margin: 0 }}>
              {isMrdu
                ? 'The official university gateway for students, faculty, and participants across all departments to register for events, workshops, hackathons, and technical symposiums.'
                : 'The official hub for student cybersecurity operations, ethical hacking sandboxes, live CTFs, and certified technical workshops.'}
            </p>
          </div>
        </div>

        <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '10px', width: 'fit-content' }}>
          <span style={{ color: 'var(--brand-accent)', display: 'inline-flex' }}>{isMrdu ? <IconSparkles size={16} /> : <IconShieldCheck size={16} />}</span>
          <div>
            <b style={{ color: 'var(--text-main)', fontSize: '11px', display: 'block' }}>{isMrdu ? 'MRDU EVENTS CENTRAL PORTAL' : 'CYBER SECURITY CLUB PORTAL'}</b>
            <small style={{ color: 'var(--text-dim)', font: '500 9px "DM Mono", monospace' }}>{isMrdu ? 'OFFICIAL UNIVERSITY EVENT SYSTEM · ALL CAMPUSES' : 'OFFICIAL STUDENT & FACULTY ACCESS · MRDU'}</small>
          </div>
        </div>
      </section>

      <section className="login-panel">
        <div
          className="login-card"
          ref={loginCardRef}
          onMouseMove={handleCardMouseMove}
          onMouseLeave={handleCardMouseLeave}
          style={{
            '--card-x': '50%',
            '--card-y': '30%',
          }}
        >
          <div className="login-card-spotlight" />
          <div className="login-card-header">
            <div className="login-card-mobile-crest">
              <Crest platformMode={platformMode} small />
            </div>
            <span className="badge badge-president" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
              {isMrdu ? 'SECURE PARTICIPANT ACCESS' : 'SECURE MEMBER ACCESS'}
            </span>
            <h2 style={{ font: '700 24px Syne', color: 'var(--text-main)', margin: '0 0 6px 0' }}>Sign in to Portal</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: 0 }}>
              Enter your authorized Member ID and password.
            </p>
          </div>

          <form onSubmit={submit} noValidate>
            <div className="login-field-group">
              <label htmlFor="final-member-id">Member ID</label>
              <div className="login-input-wrapper">
                <span className="login-input-icon"><IconUserSvg size={14} /></span>
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
                <span className="login-input-icon"><Icon8 name="password" size={14} /></span>
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
                  <Icon8 name="showPassword" size={15} />
                </button>
              </div>
            </div>

            {error && (
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '10px',
                  background: isAccountDisabled ? 'rgba(239, 68, 68, 0.16)' : 'rgba(239, 68, 68, 0.12)',
                  border: isAccountDisabled ? '1.5px solid rgba(239, 68, 68, 0.5)' : '1px solid #ef444455',
                  color: '#fca5a5',
                  fontSize: '12px',
                  marginBottom: '16px',
                  lineHeight: '1.55',
                }}
                role="alert"
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <span style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }}><IconAlertTriangle size={18} /></span>
                  <div>
                    <b style={{ color: '#ef4444', display: 'block', fontSize: '13px', fontWeight: 800, marginBottom: '3px', letterSpacing: '0.02em' }}>
                      {isAccountDisabled ? 'ACCOUNT ACCESS DISABLED' : 'AUTHENTICATION FAILED'}
                    </b>
                    <span>{error}</span>
                    {isAccountDisabled && (
                      <div style={{ marginTop: '10px' }}>
                        <button
                          type="button"
                          onClick={() => setShowForgotModal(true)}
                          style={{
                            background: '#dc2626',
                            color: '#ffffff',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <IconLifebuoy size={13} /> Contact Technical Helpdesk ➔
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <button className="primary" disabled={loading} style={{ width: '100%', minHeight: '46px', fontSize: '11px' }}>
              {loading ? 'AUTHENTICATING SECURE SESSION…' : 'AUTHENTICATE & SIGN IN →'}
            </button>
          </form>

          <div className="login-footer-links" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
            <button
              className="back-button"
              type="button"
              onClick={() => setShowRegisterModal(true)}
              style={{ margin: 0, fontSize: '11px', color: '#85d7ff', fontWeight: 600 }}
            >
              Create Account
            </button>
            <span style={{ color: '#334b60', fontSize: '12px' }}>|</span>
            <button
              className="back-button"
              type="button"
              onClick={() => setShowForgotModal(true)}
              style={{ margin: 0, fontSize: '11px' }}
            >
              Forgot Password?
            </button>
          </div>
        </div>
      </section>

      {/* Guest Student Registration Modal */}
      {showRegisterModal && (
        <GuestRegisterModal
          isOpen={showRegisterModal}
          onClose={() => setShowRegisterModal(false)}
          onSuccess={data => {
            setShowRegisterModal(false)
            setGuestSuccessData(data)
          }}
        />
      )}

      {/* Auto-Downloaded Credentials Confirmation Modal */}
      {guestSuccessData && (
        <GuestCredentialsSuccessModal
          data={guestSuccessData}
          onClose={() => setGuestSuccessData(null)}
          onProceedToLogin={() => {
            setMemberIdVal(guestSuccessData.memberId)
            setGuestSuccessData(null)
          }}
        />
      )}

      {/* Forgot Password / Support Modal */}
      {showForgotModal && (
        <ForgotPasswordModal
          isOpen={showForgotModal}
          onClose={() => setShowForgotModal(false)}
        />
      )}
    </main>
  )
}
