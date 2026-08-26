import React, { useEffect, useState } from 'react'
import {
  Icon8,
  IconAlertTriangle,
  IconCrown,
  IconDiscord,
  IconDownload,
  IconExternalLink,
  IconGitHub,
  IconGlobe,
  IconHeadset,
  IconInstagram,
  IconLinkedIn,
  IconMail,
  IconShieldCheck,
  IconSparkles,
  IconTrash,
  IconWhatsApp,
  IconYouTube,
} from '../../components/icons'
import { LivePortal } from '../../components/layout/LivePortal'
import { usePlatformTheme } from '../../context/PlatformThemeContext'
import { adminApi, readImageFile } from '../../lib/api'
import { parseYouTubeVideoId } from '../../lib/video'

export function ClubSettingsManager({ user, logout, onNavigate }) {
  const { platformMode, setPlatformMode, setClubSettings } = usePlatformTheme()
  const [selectedPlatform, setSelectedPlatform] = useState(platformMode || 'CYBER_SECURITY_CLUB')
  const [siteStatus, setSiteStatus] = useState('ACTIVE')
  const [subscriptionEnabled, setSubscriptionEnabled] = useState(false)
  const [subscriptionAmount, setSubscriptionAmount] = useState('100')
  const [subscriptionUpiId, setSubscriptionUpiId] = useState('')
  const [qrPreview, setQrPreview] = useState('')
  const [reelsEnabled, setReelsEnabled] = useState(true)
  const [introVideoEnabled, setIntroVideoEnabled] = useState(true)
  const [onboardingBriefingMode, setOnboardingBriefingMode] = useState('VIDEO')
  const [introVideoUrl, setIntroVideoUrl] = useState('')
  const [introVideoRequireTwoMinutes, setIntroVideoRequireTwoMinutes] = useState(true)

  // Official Contact & Technical Support Suite
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [technicalSupportEmail, setTechnicalSupportEmail] = useState('')
  const [technicalSupportPhone, setTechnicalSupportPhone] = useState('')

  // Official Social Media Channels
  const [instagramUrl, setInstagramUrl] = useState('')
  const [githubUrl, setGithubUrl] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [discordUrl, setDiscordUrl] = useState('')
  const [whatsappUrl, setWhatsappUrl] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // One-Click Full Database (.sql) Export States
  const [sqlExportModalOpen, setSqlExportModalOpen] = useState(false)
  const [sqlExportPassword, setSqlExportPassword] = useState('')
  const [sqlExportSubmitting, setSqlExportSubmitting] = useState(false)
  const [sqlExportError, setSqlExportError] = useState('')
  const [sqlExportSuccess, setSqlExportSuccess] = useState('')

  useEffect(() => {
    let mounted = true
    adminApi.getClubSettings()
      .then(({ settings: dict }) => {
        if (!mounted || !dict) return
        if (dict.platformMode) {
          setSelectedPlatform(dict.platformMode)
          setPlatformMode(dict.platformMode)
        }
        setSiteStatus(dict.siteStatus || 'ACTIVE')
        setSubscriptionEnabled(dict.subscriptionEnabled === true || dict.subscriptionEnabled === 'true')
        setSubscriptionAmount(String(dict.subscriptionMonthlyAmount || '100'))
        setSubscriptionUpiId(dict.subscriptionUpiId || '')
        setQrPreview(dict.subscriptionQrUrl || '')
        setReelsEnabled(dict.reelsEnabled !== false && dict.reelsEnabled !== 'false')
        setIntroVideoEnabled(dict.introVideoEnabled !== false && dict.introVideoEnabled !== 'false')
        setOnboardingBriefingMode(dict.onboardingBriefingMode || dict.introBriefingMode || 'VIDEO')
        setIntroVideoUrl(dict.introVideoUrl || '')
        setIntroVideoRequireTwoMinutes(dict.introVideoRequireTwoMinutes !== false && dict.introVideoRequireTwoMinutes !== 'false')

        setContactEmail(dict.contactEmail || '')
        setContactPhone(dict.contactPhone || '')
        setTechnicalSupportEmail(dict.technicalSupportEmail || '')
        setTechnicalSupportPhone(dict.technicalSupportPhone || '')

        setInstagramUrl(dict.instagramUrl || '')
        setGithubUrl(dict.githubUrl || '')
        setLinkedinUrl(dict.linkedinUrl || '')
        setYoutubeUrl(dict.youtubeUrl || '')
        setDiscordUrl(dict.discordUrl || '')
        setWhatsappUrl(dict.whatsappUrl || '')
        setWebsiteUrl(dict.websiteUrl || '')
      })
      .catch(err => { if (mounted) setError(err.message) })
    return () => { mounted = false }
  }, [setPlatformMode])

  async function handleSaveSettings(e) {
    e.preventDefault()
    setMessage('')
    setError('')

    const payload = {
      platformMode: selectedPlatform,
      siteStatus,
      subscriptionEnabled,
      subscriptionMonthlyAmount: subscriptionAmount ? Number(subscriptionAmount) : 100,
      subscriptionUpiId: subscriptionUpiId.trim() || null,
      subscriptionQrUrl: qrPreview || null,
      reelsEnabled,
      introVideoEnabled,
      onboardingBriefingMode,
      introBriefingMode: onboardingBriefingMode,
      introVideoUrl: introVideoUrl.trim() || null,
      introVideoRequireTwoMinutes,
      contactEmail: contactEmail.trim() || null,
      contactPhone: contactPhone.trim() || null,
      technicalSupportEmail: technicalSupportEmail.trim() || null,
      technicalSupportPhone: technicalSupportPhone.trim() || null,
      instagramUrl: instagramUrl.trim() || null,
      githubUrl: githubUrl.trim() || null,
      linkedinUrl: linkedinUrl.trim() || null,
      youtubeUrl: youtubeUrl.trim() || null,
      discordUrl: discordUrl.trim() || null,
      whatsappUrl: whatsappUrl.trim() || null,
      websiteUrl: websiteUrl.trim() || null,
    }

    setSubmitting(true)
    try {
      const { settings: updated } = await adminApi.updateClubSettings(payload)
      setPlatformMode(selectedPlatform)
      if (setClubSettings) setClubSettings(updated || payload)
      try {
        localStorage.setItem('cached_club_settings', JSON.stringify(updated || payload))
      } catch (err) {}
      setMessage('✓ Platform settings, social media, and technical support channels saved successfully.')
    } catch (err) {
      setError(err.message || 'Failed to update settings.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleExecuteSqlExport(e) {
    e.preventDefault()
    setSqlExportError('')
    setSqlExportSuccess('')
    if (!sqlExportPassword) {
      setSqlExportError('Please enter your account password.')
      return
    }

    setSqlExportSubmitting(true)
    try {
      const res = await adminApi.exportDatabaseSql(sqlExportPassword)
      const blob = new Blob([res.sqlContent], { type: 'application/sql;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = res.filename || `mrdu_csc_full_database_backup_${Date.now()}.sql`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      setSqlExportSuccess(`✓ Full database export (${(res.sqlContent.length / 1024).toFixed(1)} KB) generated and downloaded successfully!`)
      setSqlExportPassword('')
      setTimeout(() => {
        setSqlExportModalOpen(false)
        setSqlExportSuccess('')
      }, 2500)
    } catch (err) {
      setSqlExportError(err.message || 'Failed to export database.')
    } finally {
      setSqlExportSubmitting(false)
    }
  }

  return (
    <LivePortal user={user} logout={logout} activeTab="admin-settings" onNavigate={onNavigate} title={selectedPlatform === 'MRDU_EVENTS' ? 'PORTAL SETTINGS' : 'CLUB SETTINGS'}>
      <section className="member-management">
        <div className="member-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('admin-dashboard')}>
              ← COMMAND CENTER
            </button>
            <p className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Icon8 name="keySecurity" size={14} /> CENTRAL CONFIGURATION & BRANDING
            </p>
            <h1>Global Controls & Platform Identity</h1>
            <p>Configure platform modes, interface themes, site availability, official social media, and technical support helpdesk.</p>
          </div>
          {user.isPrimaryAdmin && (
            <span className="president-lock" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <IconCrown size={13} /> PRIMARY PRESIDENT CONTROLS
            </span>
          )}
        </div>

        {message && <p className="member-form-success">{message}</p>}
        {error && <p className="member-form-error">{error}</p>}

        {/* Card: Full Database Backup (.SQL One-Click Export) */}
        {user.isPrimaryAdmin && (
          <article className="settings-section-card" style={{ border: '1px solid rgba(234, 88, 12, 0.35)', background: 'linear-gradient(180deg, rgba(234, 88, 12, 0.05) 0%, var(--bg-card) 100%)', marginBottom: '24px' }}>
            <div className="settings-card-header">
              <div>
                <p className="eyebrow" style={{ color: '#ea580c' }}>DISASTER RECOVERY & ARCHIVAL</p>
                <h3 style={{ color: 'var(--text-main)' }}>Full Database Backup (.SQL One-Click Export)</h3>
              </div>
              <span className="platform-active-pill" style={{ background: '#fff7ed', color: '#ea580c', borderColor: 'rgba(234, 88, 12, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <IconCrown size={13} /> PRIMARY PRESIDENT SECURE TOOL
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.6', margin: '0 0 16px' }}>
              Download a complete, unencrypted <b>.SQL database dump</b> containing all 19 system tables (all members, accounts, profiles, events, registrations, settings, gallery, complaints, support tickets, and audit records). The downloaded file can be imported directly into any MySQL database with a single click.
            </p>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="primary"
                onClick={() => {
                  setSqlExportPassword('')
                  setSqlExportError('')
                  setSqlExportSuccess('')
                  setSqlExportModalOpen(true)
                }}
                style={{
                  background: 'linear-gradient(135deg, #ea580c, #c2410c)',
                  borderColor: '#ea580c',
                  color: '#ffffff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  fontWeight: 700,
                  fontSize: '12px',
                  borderRadius: '8px',
                }}
              >
                <IconDownload size={15} /> DOWNLOAD ALL WEBSITE DATA (.SQL)
              </button>
              <small style={{ color: 'var(--text-dim)', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Icon8 name="keySecurity" size={13} /> Requires Primary President account password for authorization
              </small>
            </div>
          </article>
        )}

        <form onSubmit={handleSaveSettings}>
          {/* Card 0: Platform Identity & Mode (Primary Admin Switcher) */}
          <article className="settings-section-card" style={{ border: '1px solid var(--brand-border-subtle)', background: 'var(--bg-card)' }}>
            <div className="settings-card-header">
              <div>
                <p className="eyebrow" style={{ color: 'var(--brand-eyebrow)' }}>PLATFORM IDENTITY & BRANDING</p>
                <h3 style={{ color: 'var(--text-main)' }}>Platform Mode Switcher (Primary Admin)</h3>
              </div>
              <span className="platform-active-pill">
                ACTIVE: {selectedPlatform === 'MRDU_EVENTS' ? 'MRDU EVENTS' : 'CYBER SECURITY CLUB'}
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.6', margin: '0 0 16px' }}>
              Switch the complete website and portal identity between <b>Cyber Security Club</b> and <b>MRDU Events</b>. All features, data, events, registrations, and admin controls remain 100% active and identical across both modes.
            </p>

            <div className="platform-mode-switcher-grid">
              <button
                type="button"
                className={`platform-mode-card ${selectedPlatform === 'CYBER_SECURITY_CLUB' ? 'active' : ''}`}
                onClick={() => {
                  if (!user.isPrimaryAdmin) return
                  setSelectedPlatform('CYBER_SECURITY_CLUB')
                  setPlatformMode('CYBER_SECURITY_CLUB')
                }}
                disabled={!user.isPrimaryAdmin}
              >
                <div className="platform-mode-card-header">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                    <IconShieldCheck size={16} /> Cyber Security Club
                  </span>
                  {selectedPlatform === 'CYBER_SECURITY_CLUB' && <span className="platform-active-pill">SELECTED</span>}
                </div>
                <p>
                  Official Cyber Security Club identity. Uses cyber defense crest, dark neon cyan accents, CTF sandbox references, and cybersecurity department themes.
                </p>
              </button>

              <button
                type="button"
                className={`platform-mode-card ${selectedPlatform === 'MRDU_EVENTS' ? 'active' : ''}`}
                onClick={() => {
                  if (!user.isPrimaryAdmin) return
                  setSelectedPlatform('MRDU_EVENTS')
                  setPlatformMode('MRDU_EVENTS')
                }}
                disabled={!user.isPrimaryAdmin}
              >
                <div className="platform-mode-card-header">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                    <IconSparkles size={16} /> MRDU Events Portal
                  </span>
                  {selectedPlatform === 'MRDU_EVENTS' && <span className="platform-active-pill">SELECTED</span>}
                </div>
                <p>
                  Official Malla Reddy University Events identity. Uses official university banner/crest, academic garnet & gold accents, and multi-department event hub themes.
                </p>
              </button>
            </div>
          </article>

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
                  ONLINE / ACTIVE
                </button>
                <button
                  type="button"
                  className={`switch-btn ${siteStatus === 'HIBERNATING' ? 'off' : ''}`}
                  onClick={() => setSiteStatus('HIBERNATING')}
                  disabled={!user.isPrimaryAdmin}
                >
                  HIBERNATION / OFF
                </button>
              </div>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.6', margin: 0 }}>
              {siteStatus === 'ACTIVE'
                ? 'Website Active: Public visitors and students have normal uninterrupted access.'
                : 'Hibernation Active: Public visitors and students see the dedicated Hibernation countdown screen. Only the Primary President and Admins can log in.'}
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
                  ENABLED
                </button>
                <button
                  type="button"
                  className={`switch-btn ${!subscriptionEnabled ? 'off' : ''}`}
                  onClick={() => setSubscriptionEnabled(false)}
                  disabled={!user.isPrimaryAdmin}
                >
                  DISABLED
                </button>
              </div>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.6', margin: '0 0 16px' }}>
              {subscriptionEnabled
                ? 'When ENABLED: Students must have an active verified subscription via UPI to register for events and access technical support.'
                : 'When DISABLED: All students enjoy free access without subscription requirements. Payment history remains preserved.'}
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
                  <IconTrash size={13} /> Remove QR Code
                </button>
              </div>
            )}
          </article>

          {/* Card 2b: Campus Reels & Instagram Section Toggle */}
          <article className="settings-section-card">
            <div className="settings-card-header">
              <div>
                <p className="eyebrow" style={{ color: 'var(--brand-primary)' }}>CAMPUS MEDIA SECTION</p>
                <h3>Campus Reels &amp; Instagram Feed</h3>
              </div>
              <div className="toggle-switch-container">
                <button
                  type="button"
                  className={`switch-btn ${reelsEnabled ? 'on' : ''}`}
                  onClick={() => setReelsEnabled(true)}
                  disabled={!user.isPrimaryAdmin}
                >
                  ENABLED
                </button>
                <button
                  type="button"
                  className={`switch-btn ${!reelsEnabled ? 'off' : ''}`}
                  onClick={() => setReelsEnabled(false)}
                  disabled={!user.isPrimaryAdmin}
                >
                  DISABLED
                </button>
              </div>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.6', margin: '0 0 16px' }}>
              {reelsEnabled
                ? 'ENABLED: The Campus Reels & Instagram section is visible in student accounts. Students can browse and view reels published by the admin team.'
                : 'DISABLED: The Campus Reels section is hidden from all student accounts. Existing reels are preserved and will reappear when re-enabled.'}
            </p>
            {!reelsEnabled && (
              <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', color: '#fca5a5', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <IconAlertTriangle size={14} />
                Reels section will be hidden from student sidebar and home dashboard.
              </div>
            )}
          </article>

          {/* Card 3: Student Onboarding Video */}
          <article className="settings-section-card">
            <div className="settings-card-header">
              <div>
                <p className="eyebrow" style={{ color: '#85d7ff' }}>MANDATORY STUDENT ONBOARDING</p>
                <h3>2-Minute YouTube Orientation Video</h3>
              </div>
              <div className="toggle-switch-container">
                <button
                  type="button"
                  className={`switch-btn ${introVideoEnabled ? 'on' : ''}`}
                  onClick={() => setIntroVideoEnabled(true)}
                  disabled={!user.isPrimaryAdmin}
                >
                  ENABLED
                </button>
                <button
                  type="button"
                  className={`switch-btn ${!introVideoEnabled ? 'off' : ''}`}
                  onClick={() => setIntroVideoEnabled(false)}
                  disabled={!user.isPrimaryAdmin}
                >
                  DISABLED
                </button>
              </div>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.6', margin: '0 0 16px' }}>
              {introVideoEnabled
                ? 'ENABLED: Newly logged-in students must watch the mandatory 2-minute YouTube orientation video before gaining access to the portal dashboard.'
                : 'DISABLED: Students bypass the orientation video and proceed directly to their dashboard.'}
            </p>

            <div style={{ background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '10px', padding: '16px' }}>
              <div className="member-form-grid">
                <label className="form-wide">
                  <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600 }}>YouTube Onboarding Video URL</span>
                    {parseYouTubeVideoId(introVideoUrl || 'https://www.youtube.com/watch?v=gokPW83s7nA') ? (
                      <span style={{ color: '#70ddb4', fontSize: '11px', fontWeight: 600 }}>
                        ✓ Detected ID: <code>{parseYouTubeVideoId(introVideoUrl || 'https://www.youtube.com/watch?v=gokPW83s7nA')}</code>
                      </span>
                    ) : introVideoUrl ? (
                      <span style={{ color: '#f87171', fontSize: '11px', fontWeight: 600 }}>
                        Invalid YouTube URL
                      </span>
                    ) : null}
                  </span>
                  <input
                    value={introVideoUrl}
                    onChange={e => setIntroVideoUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=gokPW83s7nA"
                    disabled={!user.isPrimaryAdmin}
                    style={{ marginTop: '6px' }}
                  />
                </label>
              </div>

              {parseYouTubeVideoId(introVideoUrl || 'https://www.youtube.com/watch?v=gokPW83s7nA') && (
                <div style={{ marginTop: '14px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--brand-border-subtle)', background: '#000' }}>
                  <iframe
                    src={`https://www.youtube.com/embed/${parseYouTubeVideoId(introVideoUrl || 'https://www.youtube.com/watch?v=gokPW83s7nA')}?controls=1&rel=0&modestbranding=1`}
                    title="Orientation Video Preview"
                    style={{ width: '100%', height: '240px', border: 0, display: 'block' }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}
            </div>
          </article>

          {/* Card 4: Official Club Communications & Technical Support */}
          <article className="settings-section-card">
            <div className="settings-card-header">
              <div>
                <p className="eyebrow" style={{ color: 'var(--brand-primary)' }}>COMMUNICATIONS & SUPPORT SUITE</p>
                <h3>Official Club Contact & Technical Support</h3>
              </div>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.6', margin: '0 0 16px' }}>
              Publish official club contacts and dedicated technical support helpdesk channels. These links and emails will be displayed on student dashboards and support desk.
            </p>

            <div className="member-form-grid">
              <label>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <IconMail size={14} /> Official Club Email ID
                </span>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={e => setContactEmail(e.target.value)}
                  placeholder="cybersecurityclub@mrdu.edu"
                />
              </label>
              <label>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Icon8 name="idDocs" size={14} /> Club Office / Contact Phone
                </span>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={e => setContactPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </label>
              <label>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <IconHeadset size={14} /> Dedicated Technical Support Email
                </span>
                <input
                  type="email"
                  value={technicalSupportEmail}
                  onChange={e => setTechnicalSupportEmail(e.target.value)}
                  placeholder="techsupport@mrdu.edu"
                />
              </label>
              <label>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <IconWhatsApp size={14} /> Technical Support Helpline / WhatsApp
                </span>
                <input
                  type="tel"
                  value={technicalSupportPhone}
                  onChange={e => setTechnicalSupportPhone(e.target.value)}
                  placeholder="+91 98765 01234"
                />
              </label>
            </div>
          </article>

          {/* Card 5: Official Social Media & Community Channels */}
          <article className="settings-section-card">
            <div className="settings-card-header">
              <div>
                <p className="eyebrow" style={{ color: '#ec4899' }}>BRANDING & SOCIAL CHANNELS</p>
                <h3>Official Social Media & Communities</h3>
              </div>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.6', margin: '0 0 16px' }}>
              Publish all official club social handles and online platforms. Students can 1-click navigate directly from their student dashboard.
            </p>

            <div className="member-form-grid">
              <label>
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <IconInstagram size={14} /> Instagram Profile URL
                  </span>
                  {instagramUrl && (
                    <a href={instagramUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-primary)', fontSize: '11px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      Test <IconExternalLink size={11} />
                    </a>
                  )}
                </span>
                <input
                  value={instagramUrl}
                  onChange={e => setInstagramUrl(e.target.value)}
                  placeholder="https://instagram.com/mrdu_cybersecurity"
                />
              </label>

              <label>
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <IconYouTube size={14} /> YouTube Channel URL
                  </span>
                  {youtubeUrl && (
                    <a href={youtubeUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-primary)', fontSize: '11px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      Test <IconExternalLink size={11} />
                    </a>
                  )}
                </span>
                <input
                  value={youtubeUrl}
                  onChange={e => setYoutubeUrl(e.target.value)}
                  placeholder="https://youtube.com/@mrdu_csc"
                />
              </label>

              <label>
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <IconLinkedIn size={14} /> LinkedIn Page URL
                  </span>
                  {linkedinUrl && (
                    <a href={linkedinUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-primary)', fontSize: '11px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      Test <IconExternalLink size={11} />
                    </a>
                  )}
                </span>
                <input
                  value={linkedinUrl}
                  onChange={e => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/company/mrdu-csc"
                />
              </label>

              <label>
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <IconGitHub size={14} /> GitHub Organization URL
                  </span>
                  {githubUrl && (
                    <a href={githubUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-primary)', fontSize: '11px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      Test <IconExternalLink size={11} />
                    </a>
                  )}
                </span>
                <input
                  value={githubUrl}
                  onChange={e => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/mrdu-csc"
                />
              </label>

              <label>
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <IconDiscord size={14} /> Discord Server Invite
                  </span>
                  {discordUrl && (
                    <a href={discordUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-primary)', fontSize: '11px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      Test <IconExternalLink size={11} />
                    </a>
                  )}
                </span>
                <input
                  value={discordUrl}
                  onChange={e => setDiscordUrl(e.target.value)}
                  placeholder="https://discord.gg/invite_code"
                />
              </label>

              <label>
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <IconWhatsApp size={14} /> WhatsApp Community / Group
                  </span>
                  {whatsappUrl && (
                    <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-primary)', fontSize: '11px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      Test <IconExternalLink size={11} />
                    </a>
                  )}
                </span>
                <input
                  value={whatsappUrl}
                  onChange={e => setWhatsappUrl(e.target.value)}
                  placeholder="https://chat.whatsapp.com/invite_code"
                />
              </label>

              <label className="form-wide">
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <IconGlobe size={14} /> Official Website / Portal URL
                  </span>
                  {websiteUrl && (
                    <a href={websiteUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-primary)', fontSize: '11px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      Test <IconExternalLink size={11} />
                    </a>
                  )}
                </span>
                <input
                  value={websiteUrl}
                  onChange={e => setWebsiteUrl(e.target.value)}
                  placeholder="https://cybersecurity.mrdu.edu"
                />
              </label>
            </div>
          </article>

          <button className="primary member-submit" type="submit" disabled={submitting} style={{ minHeight: '46px', width: '100%', fontSize: '13px', fontWeight: 700, letterSpacing: '0.04em' }}>
            {submitting ? 'SAVING CONFIGURATION…' : 'SAVE ALL SETTINGS & PUBLISH'}
          </button>
        </form>

        {/* Modal for SQL Export Password Confirmation */}
        {sqlExportModalOpen && (
          <div
            className="modal-backdrop"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(7, 22, 44, 0.85)',
              backdropFilter: 'blur(8px)',
              zIndex: 1100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
            }}
            onClick={() => setSqlExportModalOpen(false)}
          >
            <div
              className="modal-card"
              style={{
                maxWidth: '460px',
                width: '100%',
                background: 'var(--bg-modal, #0b1522)',
                border: '1px solid rgba(234, 88, 12, 0.4)',
                borderRadius: '16px',
                padding: '28px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <span style={{ display: 'inline-flex', padding: '12px', borderRadius: '50%', background: 'rgba(234, 88, 12, 0.12)', color: '#ea580c', marginBottom: '12px' }}>
                  <IconCrown size={28} />
                </span>
                <h3 style={{ margin: '0 0 6px', color: 'var(--text-main)', fontSize: '20px', fontWeight: 700 }}>
                  Primary President Verification
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Enter your Primary President account password to authorize and generate the full <b>.SQL database dump</b>.
                </p>
              </div>

              {sqlExportError && (
                <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#450a0a', border: '1px solid #f87171', color: '#fca5a5', fontSize: '12px', marginBottom: '16px' }}>
                  {sqlExportError}
                </div>
              )}

              {sqlExportSuccess && (
                <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#052e16', border: '1px solid #4ade80', color: '#86efac', fontSize: '12px', marginBottom: '16px' }}>
                  {sqlExportSuccess}
                </div>
              )}

              <form onSubmit={handleExecuteSqlExport}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                  Account Password *
                  <input
                    type="password"
                    required
                    placeholder="Enter your account password"
                    value={sqlExportPassword}
                    onChange={e => setSqlExportPassword(e.target.value)}
                    style={{ width: '100%', height: '42px', padding: '0 14px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)', marginTop: '4px' }}
                    autoFocus
                  />
                </label>

                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                  <button
                    type="button"
                    className="outline"
                    onClick={() => setSqlExportModalOpen(false)}
                    style={{ flex: 1, height: '42px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="primary"
                    disabled={sqlExportSubmitting || !sqlExportPassword}
                    style={{ flex: 2, height: '42px', background: 'linear-gradient(135deg, #ea580c, #c2410c)', borderColor: '#ea580c' }}
                  >
                    {sqlExportSubmitting ? 'GENERATING SQL...' : 'CONFIRM & EXPORT'}
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
