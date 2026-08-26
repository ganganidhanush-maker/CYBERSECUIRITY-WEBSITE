import React from 'react'
import clubLogo from '../../assets/branding/cyber-security-club-logo.jpg'
import mrduBanner from '../../assets/branding/mrdu-header-banner.png'
import mrduOfficialLogo from '../../assets/branding/mrdu-official-logo.png'

export function Crest({ platformMode = 'CYBER_SECURITY_CLUB', small = false, showBanner = false }) {
  const isMrdu = platformMode === 'MRDU_EVENTS'

  if (isMrdu) {
    if (showBanner) {
      return (
        <div className="crest official-crest" style={{ display: 'inline-flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ background: '#ffffff', padding: '6px 14px', borderRadius: '10px', border: '1px solid rgba(211, 47, 47, 0.3)', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
            <img
              className="brand-logo"
              src={mrduBanner}
              alt="Malla Reddy (MR) Deemed to be University"
              style={{ maxHeight: small ? 38 : 64, objectFit: 'contain', width: 'auto' }}
            />
          </div>
          {!small && (
            <div className="wordmark">
              <span style={{ font: '700 13px "Plus Jakarta Sans", sans-serif', letterSpacing: '.12em', color: 'var(--brand-eyebrow, #ea580c)' }}>MALLA REDDY UNIVERSITY</span>
              <strong style={{ font: '800 24px "Plus Jakarta Sans", sans-serif', letterSpacing: '.04em', color: 'var(--text-main)', display: 'block' }}>CENTRAL EVENTS PORTAL</strong>
              <small style={{ color: 'var(--text-muted)', font: '500 9px "DM Mono", monospace', letterSpacing: '.08em', marginTop: '2px', display: 'block' }}>
                ALL DEPARTMENTS, INSTITUTES & TECHNICAL SOCIETIES
              </small>
            </div>
          )}
        </div>
      )
    }

    return (
      <div className={`crest official-crest ${small ? 'small' : ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: small ? '10px' : '14px' }}>
        <img
          className="brand-logo"
          src={mrduOfficialLogo}
          alt="Malla Reddy (MR) Deemed to be University"
          style={{
            height: small ? 38 : 56,
            width: 'auto',
            objectFit: 'contain',
            filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.1))',
          }}
        />
        {!small && (
          <div className="wordmark">
            <span style={{ font: '700 13px "Plus Jakarta Sans", sans-serif', letterSpacing: '.08em', color: 'var(--brand-eyebrow, #ea580c)' }}>MALLA REDDY (MR)</span>
            <strong style={{ font: '800 20px "Plus Jakarta Sans", sans-serif', letterSpacing: '-.02em', color: 'var(--text-main)' }}>DEEMED TO BE UNIVERSITY</strong>
            <small style={{ color: 'var(--text-muted)', font: '500 9px "DM Mono", monospace', letterSpacing: '.08em', marginTop: '3px' }}>
              OFFICIAL CENTRAL EVENTS PORTAL
            </small>
          </div>
        )}
      </div>
    )
  }

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
          boxShadow: '0 0 16px rgba(61, 165, 255, .25)',
          background: '#040911',
        }}
      />
      {!small && (
        <div className="wordmark">
          <span style={{ font: '600 15px Syne', letterSpacing: '.08em' }}>CYBER SECURITY</span>
          <strong style={{ font: '800 26px Syne', letterSpacing: '.14em', color: 'var(--text-main)' }}>CLUB</strong>
          <small style={{ color: 'var(--brand-eyebrow)', font: '500 9px "DM Mono", monospace', letterSpacing: '.08em', marginTop: '4px' }}>
            MRDU · DEPARTMENT OF CYBER SECURITY
          </small>
        </div>
      )}
    </div>
  )
}
