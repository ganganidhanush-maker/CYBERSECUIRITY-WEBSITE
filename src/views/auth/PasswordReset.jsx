import React, { useState } from 'react'
import { Crest } from '../../components/common/Crest'
import { Icon8 } from '../../components/icons'
import { authApi } from '../../lib/api'

export function PasswordResetRequest({ onBack }) {
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
        <div style={{ textAlign: 'center', marginBottom: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Crest small />
          <span className="badge badge-president" style={{ margin: '12px auto 6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            PASSWORD RECOVERY
          </span>
          <h2 style={{ font: '700 24px Syne', color: 'var(--text-main)', margin: '4px 0 6px' }}>Reset Your Password</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: 0 }}>
            Enter your Member ID to receive password recovery instructions.
          </p>
        </div>

        <form onSubmit={submit}>
          <div className="login-field-group">
            <label htmlFor="recovery-member-id">Member ID</label>
            <div className="login-input-wrapper">
              <span className="login-input-icon"><Icon8 name="idDocs" size={14} /></span>
              <input id="recovery-member-id" name="memberId" required maxLength={32} pattern="[A-Za-z0-9]+" autoComplete="username" placeholder="e.g. CSC2026M01" />
            </div>
          </div>

          {error && <p className="member-form-error">{error}</p>}
          {message && <p className="member-form-success">{message}</p>}

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

export function PasswordReset({ token, onComplete }) {
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
        <div style={{ textAlign: 'center', marginBottom: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Crest small />
          <h2 style={{ font: '700 24px Syne', color: 'var(--text-main)', margin: '10px 0 6px' }}>Set New Password</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: 0 }}>
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

          {error && <p className="member-form-error">{error}</p>}

          <button className="primary" disabled={loading} style={{ width: '100%', minHeight: '44px', marginTop: '10px' }}>
            {loading ? 'UPDATING…' : 'UPDATE PASSWORD & SIGN IN'}
          </button>
        </form>
      </section>
    </main>
  )
}
