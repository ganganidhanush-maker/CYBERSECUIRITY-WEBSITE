import React, { useState } from 'react'
import { Crest } from '../../components/common/Crest'
import { Icon8 } from '../../components/icons'

export function TwoFactorLogin({ onVerify, onBack }) {
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
        <h2 style={{ font: '700 24px Syne', color: 'var(--text-main)', margin: '4px 0 8px' }}>Security Verification</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '0 0 20px' }}>
          Enter the six-digit verification code from your authenticator app (or President Master PIN).
        </p>

        <form onSubmit={submit}>
          <div className="login-field-group" style={{ textAlign: 'left' }}>
            <label htmlFor="two-factor-code">6-Digit Security Code / PIN</label>
            <div className="login-input-wrapper">
              <span className="login-input-icon"><Icon8 name="keySecurity" size={14} /></span>
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
              {error}
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
