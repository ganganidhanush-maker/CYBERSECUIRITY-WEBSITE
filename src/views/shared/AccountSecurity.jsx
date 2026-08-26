import React, { useState } from 'react'
import { Icon8 } from '../../components/icons'
import { LivePortal } from '../../components/layout/LivePortal'
import { adminApi, authApi } from '../../lib/api'

export function AccountSecurity({ user, logout, onNavigate }) {
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

  if (!user.isAdminUser) {
    return (
      <LivePortal user={user} logout={logout} activeTab="student-dashboard" onNavigate={onNavigate} title="DASHBOARD">
        <section className="member-management">
          <p className="directory-state">Security & administrative authorization controls are reserved for council accounts.</p>
        </section>
      </LivePortal>
    )
  }

  return (
    <LivePortal user={user} logout={logout} activeTab="security" onNavigate={onNavigate} title="ACCOUNT SECURITY">
      <section className="member-management">
        <div className="member-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('admin-dashboard')}>
              ← BACK
            </button>
            <p className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Icon8 name="password" size={14} /> AUTHENTICATION PROTECTION
            </p>
            <h1>Account Security & Locks</h1>
            <p>Configure two-factor protection and manage secondary authorization controls.</p>
          </div>
          <span className="president-lock" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Icon8 name="authentication" size={14} />
            {user.twoFactorEnabled ? '2FA ACTIVE' : '2FA OPTIONAL'}
          </span>
        </div>

        {/* Primary President Dual Lock Master PIN Card */}
        {user.isPrimaryAdmin && (
          <article className="account-form-card security-card" style={{ maxWidth: '720px', marginBottom: '24px', border: '1px solid #ffb74d55' }}>
            <p className="eyebrow" style={{ color: '#ffb74d', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Icon8 name="keySecurity" size={16} /> PRIMARY PRESIDENT SECURITY
            </p>
            <h2 style={{ color: '#ffb74d', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon8 name="keySecurity" size={24} /> Dual 6-Digit Master Security PIN (Two Locks)
            </h2>
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
              {pinError && <p className="member-form-error">{pinError}</p>}
              {pinMessage && <p className="member-form-success">{pinMessage}</p>}
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
