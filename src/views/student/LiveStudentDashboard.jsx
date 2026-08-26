import React, { useEffect, useState } from 'react'
import {
  Icon8,
  IconAlertTriangle,
  IconCalendar,
  IconCreditCard,
  IconDiscord,
  IconGitHub,
  IconHeadset,
  IconInstagram,
  IconLocationPin,
  IconMail,
  IconShieldCheck,
  IconSparkles,
  IconUserSvg,
  IconVideo,
  IconWhatsApp,
  IconYouTube,
} from '../../components/icons'
import { LivePortal } from '../../components/layout/LivePortal'
import { usePlatformTheme } from '../../context/PlatformThemeContext'
import { memberApi } from '../../lib/api'

export function LiveStudentDashboard({ user, logout, onNavigate }) {
  const { platformMode, reelsEnabled, clubSettings: sharedClubSettings } = usePlatformTheme()
  const isMrdu = platformMode === 'MRDU_EVENTS'
  const [events, setEvents] = useState([])
  const [subStatus, setSubStatus] = useState(null)
  const [clubSettings, setClubSettings] = useState(() => sharedClubSettings)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    Promise.all([
      memberApi.listEvents().catch(() => ({ events: [] })),
      memberApi.getSubscriptionStatus().catch(() => null),
      memberApi.getPublicClubSettings().catch(() => ({ settings: null })),
    ]).then(([e, s, cs]) => {
      if (mounted) {
        setEvents(e.events || [])
        setSubStatus(s)
        setClubSettings(cs?.settings || null)
      }
    }).finally(() => {
      if (mounted) setLoading(false)
    })
    return () => { mounted = false }
  }, [])

  const needsSubscription = subStatus?.subscriptionEnabled && !subStatus?.hasActiveSubscription && !subStatus?.isExempt

  // Time-based professional greeting
  const hour = new Date().getHours()
  const timeGreeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening'

  return (
    <LivePortal user={user} logout={logout} activeTab="student-dashboard" onNavigate={onNavigate} title={isMrdu ? 'MRDU EVENTS CENTRAL HUB' : 'STUDENT MEMBER HUB'}>
      {/* High-Tech Command Hero HUD */}
      <section
        className="welcome"
        style={{
          background: isMrdu ? 'linear-gradient(135deg, rgba(211, 47, 47, 0.08) 0%, rgba(56, 13, 13, 0.6) 100%)' : 'linear-gradient(135deg, rgba(82, 187, 245, 0.08) 0%, rgba(13, 31, 56, 0.6) 100%)',
          border: '1px solid var(--brand-border-subtle)',
          borderRadius: '18px',
          padding: '32px 28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'relative', zIndex: 2, maxWidth: '640px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <span className="badge" style={{ background: 'var(--brand-badge-bg)', color: 'var(--brand-primary)', border: '1px solid var(--brand-border-subtle)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em' }}>
              {isMrdu ? 'MALLA REDDY UNIVERSITY' : 'DEPARTMENT OF CYBER SECURITY'}
            </span>
            <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', fontSize: '10px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <IconShieldCheck size={12} /> VERIFIED STUDENT ACCOUNT
            </span>
          </div>

          <h1 style={{ margin: '0 0 8px', fontSize: '26px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            {timeGreeting}, {user.name}
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            {isMrdu
              ? 'Welcome to the official MRDU central events portal. Access digital passes, register for technical summits, and watch campus reels.'
              : 'Welcome to the Cyber Security Club portal. Access CTF sandboxes, workshop passes, exclusive campus reels, and technical mentor support.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', zIndex: 2 }}>
          <button
            type="button"
            className="primary"
            onClick={() => onNavigate('student-events')}
            style={{ fontSize: '12px', padding: '10px 18px', fontWeight: 700, letterSpacing: '0.04em' }}
          >
            EXPLORE EVENTS CATALOG →
          </button>
          <button
            type="button"
            className="outline"
            onClick={() => onNavigate('student-passes')}
            style={{ fontSize: '12px', padding: '10px 18px', fontWeight: 700 }}
          >
            DIGITAL PASS WALLET
          </button>
        </div>
      </section>

      {/* Subscription Notice Banner */}
      {subStatus?.subscriptionEnabled && needsSubscription && (
        <div className="pending-alert-banner" style={{ marginTop: '20px', background: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.4)', color: '#fef3c7', borderRadius: '12px', padding: '16px 20px' }}>
          <div>
            <b style={{ color: '#f59e0b', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <IconAlertTriangle size={14} /> {isMrdu ? 'Student Event Pass Inactive' : 'Student Club Membership Inactive'}
            </b>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
              Subscribe (₹{subStatus?.monthlyAmount || 100}/mo via UPI) to unlock event registrations, digital pass wallet, and technical support desk.
            </p>
          </div>
          <button type="button" onClick={() => onNavigate('student-membership')} style={{ background: '#f59e0b', color: '#000', fontWeight: 700, fontSize: '11px', padding: '8px 16px', borderRadius: '6px', border: 0, cursor: 'pointer' }}>
            ACTIVATE NOW →
          </button>
        </div>
      )}

      {/* 4 Interactive Metric HUD Cards */}
      <section className="stats" style={{ margin: '24px 0', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="stat" onClick={() => onNavigate('student-events')} style={{ cursor: 'pointer', borderRadius: '14px', border: '1px solid var(--brand-border-subtle)' }}>
          <i><IconSparkles size={24} style={{ color: 'var(--brand-primary)' }} /></i>
          <div>
            <p>{isMrdu ? 'UNIVERSITY EVENTS' : 'CLUB EVENTS'}</p>
            <h2>{events.length}</h2>
            <small>{isMrdu ? 'Active Summits & Fests' : 'Live Workshops & CTFs'}</small>
          </div>
        </div>

        <div className="stat" onClick={() => onNavigate('student-passes')} style={{ cursor: 'pointer', borderRadius: '14px', border: '1px solid var(--brand-border-subtle)' }}>
          <i><Icon8 name="idDocs" size={24} /></i>
          <div>
            <p>{isMrdu ? 'MY EVENT PASSES' : 'MY PASSES'}</p>
            <h2>{events.filter(e => e.isRegistered).length}</h2>
            <small>Confirmed Registrations</small>
          </div>
        </div>

        {subStatus?.subscriptionEnabled ? (
          <div className={`stat ${subStatus?.hasActiveSubscription ? 'green' : 'amber'}`} onClick={() => onNavigate('student-membership')} style={{ cursor: 'pointer', borderRadius: '14px' }}>
            <i><Icon8 name="access" size={24} /></i>
            <div>
              <p>{isMrdu ? 'STUDENT PASS' : 'MEMBERSHIP'}</p>
              <h2>{subStatus?.hasActiveSubscription ? 'ACTIVE' : 'INACTIVE'}</h2>
              <small>{subStatus?.hasActiveSubscription ? 'Verified Account' : 'UPI Payment Required'}</small>
            </div>
          </div>
        ) : (
          <div className="stat green" style={{ borderRadius: '14px' }}>
            <i><IconShieldCheck size={24} style={{ color: '#10b981' }} /></i>
            <div>
              <p>DEPARTMENT & YEAR</p>
              <h2>{user.profile?.department || 'CSE'}</h2>
              <small>{user.profile?.year ? `Year ${user.profile.year} · Verified` : 'Enrolled Student'}</small>
            </div>
          </div>
        )}

        <div className="stat green" style={{ borderRadius: '14px' }}>
          <i><Icon8 name="fingerprint" size={24} /></i>
          <div>
            <p>{isMrdu ? 'STUDENT ID' : 'MEMBER ID'}</p>
            <h2>{user.memberId}</h2>
            <small>Roll / Authorized ID</small>
          </div>
        </div>
      </section>

      {/* Quick Command Hub Grid (6 Interactive Tiles) */}
      <div style={{ marginBottom: '32px' }}>
        <p className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
          <Icon8 name="access" size={14} /> QUICK COMMAND HUB
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
          <div
            onClick={() => onNavigate('student-passes')}
            className="account-form-card"
            style={{
              padding: '16px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              borderRadius: '12px',
              border: '1px solid var(--brand-border-subtle)',
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{ display: 'inline-flex', padding: '10px', borderRadius: '10px', background: 'var(--brand-badge-bg)', color: 'var(--brand-primary)', width: 'fit-content' }}>
              <IconCreditCard size={18} />
            </span>
            <b style={{ fontSize: '13px', color: 'var(--text-main)' }}>Digital Pass Wallet</b>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>View QR boarding passes & download printable IDs.</p>
          </div>

          {reelsEnabled && (
            <div
              onClick={() => onNavigate('student-reels')}
              className="account-form-card"
              style={{
                padding: '16px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                borderRadius: '12px',
                border: '1px solid var(--brand-border-subtle)',
                transition: 'all 0.2s ease',
              }}
            >
              <span style={{ display: 'inline-flex', padding: '10px', borderRadius: '10px', background: 'rgba(236, 72, 153, 0.12)', color: '#ec4899', width: 'fit-content' }}>
                <IconVideo size={18} />
              </span>
              <b style={{ fontSize: '13px', color: 'var(--text-main)' }}>Campus Reels</b>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>Short-form video highlights, CTF demos & event teasers.</p>
            </div>
          )}

          <div
            onClick={() => onNavigate('student-events')}
            className="account-form-card"
            style={{
              padding: '16px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              borderRadius: '12px',
              border: '1px solid var(--brand-border-subtle)',
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{ display: 'inline-flex', padding: '10px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', width: 'fit-content' }}>
              <IconCalendar size={18} />
            </span>
            <b style={{ fontSize: '13px', color: 'var(--text-main)' }}>Events Catalog</b>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>Register for upcoming hackathons, labs, and summits.</p>
          </div>

          <div
            onClick={() => onNavigate('student-complaints')}
            className="account-form-card"
            style={{
              padding: '16px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              borderRadius: '12px',
              border: '1px solid var(--brand-border-subtle)',
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{ display: 'inline-flex', padding: '10px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', width: 'fit-content' }}>
              <IconHeadset size={18} />
            </span>
            <b style={{ fontSize: '13px', color: 'var(--text-main)' }}>24/7 Doubt Desk</b>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>Submit queries, get technical support & mentor guidance.</p>
          </div>

          <div
            onClick={() => onNavigate('student-gallery')}
            className="account-form-card"
            style={{
              padding: '16px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              borderRadius: '12px',
              border: '1px solid var(--brand-border-subtle)',
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{ display: 'inline-flex', padding: '10px', borderRadius: '10px', background: 'rgba(168, 85, 247, 0.12)', color: '#a855f7', width: 'fit-content' }}>
              <IconSparkles size={18} />
            </span>
            <b style={{ fontSize: '13px', color: 'var(--text-main)' }}>Photo Gallery</b>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>Browse high-resolution event albums and campus fests.</p>
          </div>

          <div
            onClick={() => onNavigate('student-team')}
            className="account-form-card"
            style={{
              padding: '16px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              borderRadius: '12px',
              border: '1px solid var(--brand-border-subtle)',
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{ display: 'inline-flex', padding: '10px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', width: 'fit-content' }}>
              <IconUserSvg size={18} />
            </span>
            <b style={{ fontSize: '13px', color: 'var(--text-main)' }}>Club Council</b>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>Connect with student leads, office bearers, and mentors.</p>
          </div>
        </div>
      </div>

      {/* Featured Sessions & Events Catalog */}
      <div className="section-title">
        <div>
          <p className="eyebrow">{isMrdu ? 'CAMPUS HIGHLIGHTS' : 'FEATURED SESSIONS'}</p>
          <h2>{isMrdu ? 'Featured University Events' : 'Upcoming Club Events'}</h2>
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
                <p>{evt.shortDescription || evt.description || (isMrdu ? 'MRDU University official event session.' : 'Department of Cyber Security official session.')}</p>
                <div className="card-meta">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><IconCalendar size={13} /> {new Date(evt.dateTime).toLocaleDateString()}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><IconLocationPin size={13} /> {evt.venue || evt.location || 'Campus'}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><IconCreditCard size={13} /> {evt.requiresPayment ? `₹${evt.paymentAmount || 'Tiered'}` : 'FREE'}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><IconUserSvg size={13} /> {evt.registrationCount || 0} registered</span>
                </div>
                <div className="card-footer">
                  {evt.isRegistered ? (
                    <span className="badge badge-registered" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <IconShieldCheck size={13} /> REGISTERED
                    </span>
                  ) : (
                    <button className="register-btn" type="button" onClick={() => onNavigate(`event-detail/${evt.id}`)}>
                      VIEW & REGISTER &rarr;
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Sleek Official About & Channels Section at the Bottom */}
      <footer
        style={{
          marginTop: '48px',
          padding: '28px 24px',
          background: 'var(--panel-subtle)',
          border: '1px solid var(--line)',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
          <div style={{ maxWidth: '580px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{ color: 'var(--brand-primary)', display: 'inline-flex' }}>
                {isMrdu ? <IconSparkles size={16} /> : <IconShieldCheck size={16} />}
              </span>
              <b style={{ color: 'var(--text-main)', fontSize: '14px' }}>
                {isMrdu ? 'About Malla Reddy University Events Portal' : 'About Cyber Security Club · MRDU'}
              </b>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.6, margin: 0 }}>
              {isMrdu
                ? 'Malla Reddy (Deemed to be University) · NAAC A++ Accredited. The central gateway for university workshops, national symposiums, hackathons, and multi-department student initiatives.'
                : 'The official student cyber defense organisation at Malla Reddy University. Advancing ethical hacking, live CTF competitions, security research, and student technical empowerment.'}
            </p>
          </div>

          {/* Quick Support & Helpline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <small style={{ color: 'var(--text-dim)', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>
              Official Student Support
            </small>
            <a
              href={`mailto:${clubSettings?.contactEmail || 'cybersecurityclub@mrdu.edu'}`}
              style={{ color: 'var(--brand-primary)', fontSize: '12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <IconMail size={13} /> {clubSettings?.contactEmail || 'cybersecurityclub@mrdu.edu'}
            </a>
            {clubSettings?.technicalSupportEmail && (
              <a
                href={`mailto:${clubSettings.technicalSupportEmail}`}
                style={{ color: 'var(--text-muted)', fontSize: '11.5px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <IconHeadset size={13} /> {clubSettings.technicalSupportEmail}
              </a>
            )}
          </div>
        </div>

        {/* Inline Social Icons & Links Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', paddingTop: '16px', borderTop: '1px solid var(--line)' }}>
          <small style={{ color: 'var(--text-dim)', fontSize: '11px' }}>
            © {new Date().getFullYear()} {isMrdu ? 'Malla Reddy University' : 'Cyber Security Club'}. All rights reserved.
          </small>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            {clubSettings?.instagramUrl && (
              <a
                href={clubSettings.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--text-muted)', fontSize: '12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', transition: 'color 0.15s ease' }}
              >
                <IconInstagram size={14} /> Instagram
              </a>
            )}
            {clubSettings?.youtubeUrl && (
              <a
                href={clubSettings.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--text-muted)', fontSize: '12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', transition: 'color 0.15s ease' }}
              >
                <IconYouTube size={14} /> YouTube
              </a>
            )}
            {(clubSettings?.whatsappUrl || clubSettings?.discordUrl) && (
              <a
                href={clubSettings.whatsappUrl || clubSettings.discordUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--text-muted)', fontSize: '12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', transition: 'color 0.15s ease' }}
              >
                {clubSettings.whatsappUrl ? <IconWhatsApp size={14} /> : <IconDiscord size={14} />} Community
              </a>
            )}
            {clubSettings?.githubUrl && (
              <a
                href={clubSettings.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--text-muted)', fontSize: '12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', transition: 'color 0.15s ease' }}
              >
                <IconGitHub size={14} /> GitHub
              </a>
            )}
          </div>
        </div>
      </footer>
    </LivePortal>
  )
}
