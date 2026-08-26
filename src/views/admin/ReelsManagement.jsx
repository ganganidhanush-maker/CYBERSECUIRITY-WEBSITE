import React, { useEffect, useMemo, useState } from 'react'
import {
  IconFlame,
  IconHeart,
  IconInstagram,
  IconRefresh,
  IconTrash,
  IconVideo,
} from '../../components/icons'
import { LivePortal } from '../../components/layout/LivePortal'
import { usePlatformTheme } from '../../context/PlatformThemeContext'
import { adminApi } from '../../lib/api'

export function ReelsManagement({ user, logout, onNavigate }) {
  const { platformMode } = usePlatformTheme()
  const isMrdu = platformMode === 'MRDU_EVENTS'
  const [reels, setReels] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [directorySearch, setDirectorySearch] = useState('')
  const [directoryCategory, setDirectoryCategory] = useState('ALL')
  const [page, setPage] = useState(1)
  const pageSize = 12

  // Form states
  const [creatorTab, setCreatorTab] = useState('SINGLE') // 'SINGLE' | 'PROFILE'
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [authorHandle, setAuthorHandle] = useState('cybersecurityclub_mrdu')
  const [audioTitle, setAudioTitle] = useState('cybersecurityclub_mrdu • Original audio')
  const [category, setCategory] = useState('CAMPUS_LIFE')
  const [reelPlatformMode, setReelPlatformMode] = useState(isMrdu ? 'MRDU_EVENTS' : 'ALL')
  const [isFeatured, setIsFeatured] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Profile Sync states
  const [profileUrl, setProfileUrl] = useState('https://www.instagram.com/cybersecurityclub_mrdu/')
  const [profileHandle, setProfileHandle] = useState('cybersecurityclub_mrdu')
  const [profilePostLinks, setProfilePostLinks] = useState('')
  const [profileCategory, setProfileCategory] = useState('CAMPUS_LIFE')
  const [profileStreamMode, setProfileStreamMode] = useState(isMrdu ? 'MRDU_EVENTS' : 'ALL')
  const [profileTitlePrefix, setProfileTitlePrefix] = useState('Campus Highlights')
  const [profileSyncing, setProfileSyncing] = useState(false)

  // Parse URL for real-time live embed preview
  const liveParsed = useMemo(() => {
    const raw = (url || '').trim()
    if (!raw) return null
    if (raw.includes('youtube.com/shorts/') || raw.includes('youtu.be/') || raw.includes('youtube.com/watch') || raw.includes('youtube.com/embed/')) {
      const match = raw.match(/(?:shorts\/|v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]+)/i)
      const id = match ? match[1] : null
      return id ? { type: 'YOUTUBE_SHORT', embedUrl: `https://www.youtube.com/embed/${id}?autoplay=0&loop=1&rel=0` } : null
    }
    const igMatch = raw.match(/instagram\.com\/(?:[a-zA-Z0-9_.]+\/)?(?:reel|reels|p|tv|share\/reel)\/([a-zA-Z0-9_-]+)/i)
    if (igMatch) {
      return { type: 'INSTAGRAM', embedUrl: `https://www.instagram.com/reel/${igMatch[1]}/embed/` }
    }
    if (/\.(mp4|webm|mov)(\?.*)?$/i.test(raw)) {
      return { type: 'DIRECT_VIDEO', embedUrl: raw }
    }
    return { type: 'EXTERNAL', embedUrl: raw }
  }, [url])

  function loadReels() {
    setLoading(true)
    adminApi.listReels()
      .then(res => setReels(res.reels || []))
      .catch(err => setError(err.message || 'Failed to load reels.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadReels()
  }, [])

  async function handlePublishReel(e) {
    e.preventDefault()
    if (!url.trim() || !title.trim()) {
      setError('Please provide both a video URL and a title.')
      return
    }
    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      await adminApi.createReel({
        url: url.trim(),
        title: title.trim(),
        description: description.trim(),
        authorHandle: authorHandle.trim(),
        audioTitle: audioTitle.trim(),
        category,
        platformMode: reelPlatformMode,
        isFeatured,
      })
      setMessage('✓ Campus Reel published successfully! Pushed as TOP PRIORITY for all students.')
      setUrl('')
      setTitle('')
      setDescription('')
      setIsFeatured(false)
      loadReels()
    } catch (err) {
      setError(err.message || 'Failed to publish reel.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSyncProfile(e) {
    e.preventDefault()
    if (!profileUrl.trim() && !profileHandle.trim()) {
      setError('Please provide an Instagram profile URL or handle.')
      return
    }
    setProfileSyncing(true)
    setError('')
    setMessage('')
    try {
      const res = await adminApi.importProfileReels({
        profileUrl: profileUrl.trim(),
        handle: profileHandle.trim(),
        category: profileCategory,
        platformMode: profileStreamMode,
        postLinks: profilePostLinks.trim(),
        titlePrefix: profileTitlePrefix.trim(),
        count: 5,
      })
      setMessage(res.message || '✓ Instagram profile posts synced successfully into random student playback!')
      setProfilePostLinks('')
      loadReels()
    } catch (err) {
      setError(err.message || 'Failed to sync Instagram profile.')
    } finally {
      setProfileSyncing(false)
    }
  }

  async function toggleReelStatus(reel) {
    try {
      await adminApi.updateReel(reel.id, { isActive: !reel.isActive })
      setReels(curr => curr.map(r => r.id === reel.id ? { ...r, isActive: !r.isActive } : r))
    } catch (err) {
      setError(err.message || 'Failed to update reel status.')
    }
  }

  async function toggleFeatured(reel) {
    try {
      await adminApi.updateReel(reel.id, { isFeatured: !reel.isFeatured })
      setReels(curr => curr.map(r => r.id === reel.id ? { ...r, isFeatured: !r.isFeatured } : r))
    } catch (err) {
      setError(err.message || 'Failed to toggle featured status.')
    }
  }

  async function handleDeleteReel(id) {
    if (!window.confirm('Are you sure you want to delete this reel?')) return
    try {
      await adminApi.deleteReel(id)
      setReels(curr => curr.filter(r => r.id !== id))
      setMessage('✓ Reel deleted successfully.')
    } catch (err) {
      setError(err.message || 'Failed to delete reel.')
    }
  }

  return (
    <LivePortal user={user} logout={logout} activeTab="admin-reels" onNavigate={onNavigate} title={isMrdu ? 'MRDU REELS STUDIO' : 'CAMPUS REELS STUDIO'}>
      <section className="gallery-section">
        <div className="event-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('admin-dashboard')}>
              ← COMMAND CENTER
            </button>
            <p className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <IconVideo size={14} /> SHORT-FORM CAMPUS MEDIA & HIGHLIGHTS
            </p>
            <h1>{isMrdu ? 'MRDU Campus Reels Studio' : 'Campus & Event Reels Studio'}</h1>
            <p>Publish and curate Instagram reels and video highlights for students. Admin uploads are automatically prioritized in student feeds.</p>
          </div>
        </div>

        {message && <p className="member-form-success">{message}</p>}
        {error && <p className="member-form-error">{error}</p>}

        {/* Creator Mode Switcher Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: 'var(--panel-subtle)', padding: '6px', borderRadius: '12px', width: 'fit-content', border: '1px solid var(--line)' }}>
          <button
            type="button"
            onClick={() => setCreatorTab('SINGLE')}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: 0,
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: creatorTab === 'SINGLE' ? 'var(--brand-primary)' : 'transparent',
              color: creatorTab === 'SINGLE' ? '#050c14' : 'var(--text-muted)',
              transition: 'all 0.15s ease',
            }}
          >
            <IconVideo size={15} /> Single Reel / Post (Top Priority Push)
          </button>
          <button
            type="button"
            onClick={() => setCreatorTab('PROFILE')}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: 0,
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: creatorTab === 'PROFILE' ? 'var(--brand-primary)' : 'transparent',
              color: creatorTab === 'PROFILE' ? '#050c14' : 'var(--text-muted)',
              transition: 'all 0.15s ease',
            }}
          >
            <IconInstagram size={15} /> Upload Profile Link (Random Discovery Stream)
          </button>
        </div>

        {/* Side-by-Side Creator Layout: Form on Left, Live Preview on Right */}
        <div className="reel-creator-layout">
          {/* Left Column: Mode 1 (Single Reel) or Mode 2 (Profile Sync) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {creatorTab === 'SINGLE' ? (
              <article className="account-form-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <p className="eyebrow" style={{ margin: 0 }}>DIRECT ADMIN UPLOAD</p>
                  <span className="badge" style={{ background: 'var(--brand-badge-bg)', color: 'var(--brand-primary)', fontSize: '10px', fontWeight: 800 }}>
                    ★ TOP PRIORITY 1 FOR STUDENTS
                  </span>
                </div>
                <h2>Publish Campus Reel</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.5, margin: '0 0 16px' }}>
                  Paste an Instagram Reel, YouTube Short, or MP4 link. The video will be highlighted at the top of all students' feeds immediately.
                </p>

                <form onSubmit={handlePublishReel} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                      Instagram Reel / Video Link URL *
                    </label>
                    <input
                      value={url}
                      onChange={e => setUrl(e.target.value)}
                      placeholder="https://www.instagram.com/reel/C8qL_k1S9gW/ or video URL"
                      required
                      style={{ width: '100%', height: '42px', padding: '0 14px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)' }}
                    />
                    <small style={{ display: 'block', color: 'var(--text-dim)', fontSize: '11px', marginTop: '4px' }}>
                      Paste any Instagram reel link. The live preview on the right will update in real time.
                    </small>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                      Title / Caption Headline *
                    </label>
                    <input
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="e.g. Grand Induction & Live CTF Defense Battle 2026"
                      required
                      style={{ width: '100%', height: '42px', padding: '0 14px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                        Instagram Account / Handle
                      </label>
                      <input
                        value={authorHandle}
                        onChange={e => setAuthorHandle(e.target.value)}
                        placeholder="cybersecurityclub_mrdu"
                        style={{ width: '100%', height: '42px', padding: '0 12px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)' }}
                      />
                      <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                        <button
                          type="button"
                          onClick={() => { setAuthorHandle('cybersecurityclub_mrdu'); setAudioTitle('cybersecurityclub_mrdu • Original audio') }}
                          style={{ fontSize: '10px', padding: '2px 6px', background: 'var(--panel-subtle)', border: '1px solid var(--line)', borderRadius: '4px', color: 'var(--brand-primary)', cursor: 'pointer' }}
                        >
                          @cybersecurityclub_mrdu
                        </button>
                        <button
                          type="button"
                          onClick={() => { setAuthorHandle('mrdu_official'); setAudioTitle('mrdu_official • Original audio') }}
                          style={{ fontSize: '10px', padding: '2px 6px', background: 'var(--panel-subtle)', border: '1px solid var(--line)', borderRadius: '4px', color: 'var(--brand-primary)', cursor: 'pointer' }}
                        >
                          @mrdu_official
                        </button>
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                        Audio Track Title
                      </label>
                      <input
                        value={audioTitle}
                        onChange={e => setAudioTitle(e.target.value)}
                        placeholder="cybersecurityclub_mrdu • Original audio"
                        style={{ width: '100%', height: '42px', padding: '0 12px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                      Full Post Caption & Hashtags (Optional)
                    </label>
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Highlights from the event... #MRDU #CyberSecurity #Hackathon"
                      rows={3}
                      style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)', resize: 'vertical' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                        Category
                      </label>
                      <select
                        value={category}
                        onChange={e => setCategory(e.target.value)}
                        style={{ width: '100%', height: '42px', padding: '0 12px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)' }}
                      >
                        <option value="CAMPUS_LIFE">Campus Life & Highlights</option>
                        <option value="HACKATHONS">Hackathons & CTF Competitions</option>
                        <option value="WORKSHOPS">Technical Workshops & Labs</option>
                        <option value="CULTURAL">Cultural & University Fests</option>
                        <option value="TECH_NEWS">Cyber Security & Tech Updates</option>
                        <option value="MRDU_SPECIAL">MRDU Central Highlights</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                        Platform Stream
                      </label>
                      <select
                        value={reelPlatformMode}
                        onChange={e => setReelPlatformMode(e.target.value)}
                        style={{ width: '100%', height: '42px', padding: '0 12px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)' }}
                      >
                        <option value="ALL">All Portals (Global)</option>
                        <option value="CSC">Cyber Security Club Stream</option>
                        <option value="MRDU_EVENTS">MRDU Central Events Stream</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px' }}>
                    <input
                      type="checkbox"
                      id="featured-toggle"
                      checked={isFeatured}
                      onChange={e => setIsFeatured(e.target.checked)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <label htmlFor="featured-toggle" style={{ margin: 0, fontSize: '12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--text-main)' }}>
                      <IconFlame size={14} style={{ color: '#f59e0b' }} /> Pin as Featured Reel
                    </label>
                  </div>

                  <button className="primary member-submit" disabled={submitting} style={{ height: '46px', fontSize: '13px', fontWeight: 700, letterSpacing: '0.04em' }}>
                    {submitting ? 'PUBLISHING REEL...' : 'PUBLISH & PUSH TO STUDENTS (PRIORITY 1) →'}
                  </button>
                </form>
              </article>
            ) : (
              /* Mode 2: Instagram Profile Sync */
              <article className="account-form-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <p className="eyebrow" style={{ margin: 0, color: '#ec4899' }}>INSTAGRAM PROFILE STREAM SYNC</p>
                  <span className="badge" style={{ background: 'rgba(236,72,153,0.12)', color: '#ec4899', fontSize: '10px', fontWeight: 800 }}>
                    RANDOM DISCOVERY POOL
                  </span>
                </div>
                <h2>Sync Instagram Profile Feed</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.6', margin: '0 0 16px' }}>
                  Upload an Instagram profile link so all posts and reels from that account play randomly in the students' Reels Feed. When you upload a new reel directly, it automatically becomes the #1 main priority!
                </p>

                <form onSubmit={handleSyncProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                        Instagram Profile URL *
                      </label>
                      <input
                        value={profileUrl}
                        onChange={e => {
                          setProfileUrl(e.target.value)
                          const m = e.target.value.match(/instagram\.com\/([a-zA-Z0-9_.]+)/i)
                          if (m && m[1]) setProfileHandle(m[1].replace(/\/$/, ''))
                        }}
                        placeholder="https://www.instagram.com/cybersecurityclub_mrdu/"
                        required
                        style={{ width: '100%', height: '42px', padding: '0 12px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                        Handle / Username
                      </label>
                      <input
                        value={profileHandle}
                        onChange={e => setProfileHandle(e.target.value)}
                        placeholder="cybersecurityclub_mrdu"
                        required
                        style={{ width: '100%', height: '42px', padding: '0 12px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                      Title Prefix
                    </label>
                    <input
                      value={profileTitlePrefix}
                      onChange={e => setProfileTitlePrefix(e.target.value)}
                      placeholder="Campus Highlights"
                      style={{ width: '100%', height: '42px', padding: '0 12px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                      Specific Post/Reel URLs from this Profile (Optional, one per line)
                    </label>
                    <textarea
                      value={profilePostLinks}
                      onChange={e => setProfilePostLinks(e.target.value)}
                      placeholder={'https://www.instagram.com/reel/C8qL_k1S9gW/\nhttps://www.instagram.com/p/C8tM_p2R7hX/'}
                      rows={4}
                      style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)', resize: 'vertical', fontFamily: 'monospace', fontSize: '11px' }}
                    />
                    <small style={{ display: 'block', color: 'var(--text-dim)', fontSize: '11px', marginTop: '4px' }}>
                      Leave empty to auto-sync the profile stream discovery pool, or paste multiple post URLs to import in batch.
                    </small>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                        Category
                      </label>
                      <select
                        value={profileCategory}
                        onChange={e => setProfileCategory(e.target.value)}
                        style={{ width: '100%', height: '42px', padding: '0 12px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)' }}
                      >
                        <option value="CAMPUS_LIFE">Campus Life & Highlights</option>
                        <option value="HACKATHONS">Hackathons & CTF Competitions</option>
                        <option value="WORKSHOPS">Technical Workshops & Labs</option>
                        <option value="CULTURAL">Cultural & University Fests</option>
                        <option value="TECH_NEWS">Cyber Security & Tech Updates</option>
                        <option value="MRDU_SPECIAL">MRDU Central Highlights</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                        Platform Stream
                      </label>
                      <select
                        value={profileStreamMode}
                        onChange={e => setProfileStreamMode(e.target.value)}
                        style={{ width: '100%', height: '42px', padding: '0 12px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)' }}
                      >
                        <option value="ALL">All Portals (Global)</option>
                        <option value="CSC">Cyber Security Club Stream</option>
                        <option value="MRDU_EVENTS">MRDU Central Events Stream</option>
                      </select>
                    </div>
                  </div>

                  <button className="primary member-submit" disabled={profileSyncing} style={{ height: '46px', fontSize: '13px', fontWeight: 700, letterSpacing: '0.04em', background: 'linear-gradient(135deg, #ec4899, #8b5cf6)', borderColor: '#ec4899' }}>
                    {profileSyncing ? 'SYNCING PROFILE POSTS...' : `SYNC @${profileHandle || 'PROFILE'} POSTS & REELS POOL →`}
                  </button>
                </form>
              </article>
            )}
          </div>

          {/* Right Column: Sticky Live Embed Preview Player */}
          <article
            className="account-form-card"
            style={{
              position: 'sticky',
              top: '20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-start',
              background: 'var(--bg-card)',
              padding: '20px 16px',
              border: '1px solid var(--brand-border-subtle)',
              borderRadius: '18px',
              boxShadow: '0 10px 35px rgba(0,0,0,0.06)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '14px', padding: '0 4px' }}>
              <p className="eyebrow" style={{ margin: 0, fontSize: '10px' }}>LIVE PLAYER PREVIEW</p>
              {liveParsed && (
                <span className="badge" style={{ fontSize: '9px', fontWeight: 700, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  ● {liveParsed.type.replace('_', ' ')}
                </span>
              )}
            </div>

            {/* Simulated Phone Shell */}
            <div
              style={{
                width: '100%',
                maxWidth: '300px',
                height: '520px',
                background: '#000000',
                borderRadius: '24px',
                border: '3px solid #1e293b',
                boxShadow: '0 16px 45px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.1)',
                overflow: 'hidden',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Top Camera Notch */}
              <div style={{ position: 'absolute', top: '8px', left: '50%', transform: 'translateX(-50%)', width: '60px', height: '14px', background: '#111827', borderRadius: '10px', zIndex: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#1e293b' }} />
              </div>

              {/* Video Player Canvas */}
              <div style={{ width: '100%', height: '100%', position: 'relative', background: '#000000', overflow: 'hidden' }}>
                {liveParsed ? (
                  liveParsed.type === 'DIRECT_VIDEO' ? (
                    <video src={liveParsed.embedUrl} autoPlay loop muted playsInline controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <iframe
                      src={liveParsed.embedUrl}
                      title="Live Preview"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      scrolling="no"
                      style={{ width: '100%', height: '100%', border: 0, overflow: 'hidden', background: '#000000' }}
                    />
                  )
                ) : (
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', color: 'var(--text-muted)', textAlign: 'center' }}>
                    <span style={{ display: 'inline-flex', padding: '14px', borderRadius: '50%', background: 'var(--brand-badge-bg)', color: 'var(--brand-primary)', marginBottom: '12px' }}>
                      <IconVideo size={28} />
                    </span>
                    <b style={{ color: 'var(--text-main)', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Interactive Preview</b>
                    <p style={{ fontSize: '11px', margin: 0, lineHeight: 1.5 }}>
                      Type or paste an Instagram Reel URL on the left to test playback live in this simulated screen.
                    </p>
                  </div>
                )}

                {/* Simulated Bottom Overlay */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '24px 12px 12px',
                    background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.4) 70%, transparent 100%)',
                    color: '#ffffff',
                    zIndex: 20,
                    pointerEvents: 'none',
                  }}
                >
                  <p style={{ margin: '0 0 2px', fontSize: '11px', fontWeight: 700, color: '#ffffff' }}>
                    @{authorHandle || 'cybersecurityclub_mrdu'}
                  </p>
                  <p style={{ margin: 0, fontSize: '10px', color: '#cbd5e1', lineHeight: 1.3, maxHeight: '28px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {title || 'Reel Caption Headline…'}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: '9px', color: '#94a3b8', fontFamily: 'monospace' }}>
                    ♫ {audioTitle || 'Original audio'}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Actions / Tips under Preview */}
            <div style={{ width: '100%', maxWidth: '300px', marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-dim)' }}>
                <span>Real-time Sync Active</span>
                <button
                  type="button"
                  onClick={() => { setUrl(''); setTitle(''); setDescription('') }}
                  style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', fontSize: '11px', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                >
                  Clear Inputs
                </button>
              </div>
            </div>
          </article>
        </div>

        {/* Published Reels Directory */}
        <div style={{ marginTop: '40px', borderTop: '1px solid var(--line)', paddingTop: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <p className="eyebrow">PUBLISHED FEED DIRECTORY</p>
              <h2>Manage Published Reels ({reels.length})</h2>
            </div>
            <button type="button" className="outline" onClick={loadReels} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '6px 14px' }}>
              <IconRefresh size={13} /> Refresh Feed
            </button>
          </div>

          {/* Directory Search & Filter Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', background: 'var(--bg-card)', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--brand-border-subtle)' }}>
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px', maxWidth: '100%' }}>
              {[
                { id: 'ALL', label: 'All Categories' },
                { id: 'CAMPUS_LIFE', label: 'Campus Life' },
                { id: 'HACKATHONS', label: 'Hackathons' },
                { id: 'WORKSHOPS', label: 'Workshops' },
                { id: 'CULTURAL', label: 'Cultural' },
                { id: 'TECH_NEWS', label: 'Tech News' },
              ].map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => { setDirectoryCategory(cat.id); setPage(1) }}
                  style={{
                    fontSize: '11px',
                    padding: '4px 10px',
                    borderRadius: '16px',
                    whiteSpace: 'nowrap',
                    background: directoryCategory === cat.id ? 'var(--brand-primary)' : 'var(--panel-subtle)',
                    color: directoryCategory === cat.id ? '#ffffff' : 'var(--text-muted)',
                    border: '1px solid var(--line)',
                    cursor: 'pointer',
                    fontWeight: directoryCategory === cat.id ? 700 : 500,
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div style={{ position: 'relative', width: '220px', minWidth: '160px' }}>
              <input
                type="text"
                placeholder="Filter by title / handle…"
                value={directorySearch}
                onChange={e => { setDirectorySearch(e.target.value); setPage(1) }}
                style={{ width: '100%', height: '32px', padding: '0 10px', fontSize: '11px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--bg-input)', color: 'var(--text-main)' }}
              />
            </div>
          </div>

          {loading ? (
            <p className="directory-state">Loading reels...</p>
          ) : reels.length === 0 ? (
            <p className="directory-state">No reels published yet. Use the form above to publish your first college reel!</p>
          ) : (() => {
            const filtered = reels.filter(r => {
              if (directoryCategory !== 'ALL' && r.category !== directoryCategory) return false
              if (directorySearch.trim()) {
                const q = directorySearch.toLowerCase().trim()
                const t = (r.title || '').toLowerCase()
                const d = (r.description || '').toLowerCase()
                const h = (r.authorHandle || '').toLowerCase()
                if (!t.includes(q) && !d.includes(q) && !h.includes(q)) return false
              }
              return true
            })
            const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
            const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

            if (filtered.length === 0) {
              return <p className="directory-state">No reels matched your filter. Try adjusting your search query.</p>
            }

            return (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '20px' }}>
                  {paginated.map(r => (
                    <article
                      key={r.id}
                      className="account-form-card"
                      style={{
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        opacity: r.isActive ? 1 : 0.6,
                        border: r.isFeatured ? '1px solid #f59e0b' : '1px solid var(--brand-border-subtle)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span className="badge" style={{ background: 'var(--brand-badge-bg)', color: 'var(--brand-badge-color)', fontSize: '10px', fontWeight: 600 }}>
                          {r.category.replace('_', ' ')}
                        </span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {r.isFeatured && (
                            <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)', fontSize: '9px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <IconFlame size={11} /> FEATURED
                            </span>
                          )}
                          <span className="badge" style={{ background: r.isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.15)', color: r.isActive ? '#10b981' : '#94a3b8', border: `1px solid ${r.isActive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(100, 116, 139, 0.3)'}`, fontSize: '9px', fontWeight: 700 }}>
                            {r.isActive ? 'LIVE' : 'HIDDEN'}
                          </span>
                        </div>
                      </div>

                      {/* Embedded Compact Preview */}
                      <div style={{ width: '100%', height: '220px', background: '#000000', borderRadius: '12px', overflow: 'hidden', marginBottom: '12px' }}>
                        {r.embedType === 'DIRECT_VIDEO' ? (
                          <video src={r.url} muted playsInline controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <iframe src={r.url} title={r.title} allowFullScreen scrolling="no" style={{ width: '100%', height: '100%', border: 0, overflow: 'hidden' }} />
                        )}
                      </div>

                      <h3 style={{ margin: '0 0 6px', fontSize: '14px', color: 'var(--text-main)' }}>{r.title}</h3>
                      {r.description && <p style={{ margin: '0 0 10px', fontSize: '11px', color: 'var(--text-muted)' }}>{r.description}</p>}

                      <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-dim)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <span>{r.viewsCount} views</span>
                          <span>·</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <IconHeart size={12} filled={r.likesCount > 0} /> {r.likesCount}
                          </span>
                        </span>
                        <small>By: {r.postedBy}</small>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                        <button
                          type="button"
                          className="outline"
                          onClick={() => toggleReelStatus(r)}
                          style={{ flex: 1, fontSize: '10px', padding: '6px' }}
                        >
                          {r.isActive ? 'Hide' : 'Publish'}
                        </button>
                        <button
                          type="button"
                          className="outline"
                          onClick={() => toggleFeatured(r)}
                          style={{ flex: 1, fontSize: '10px', padding: '6px', color: r.isFeatured ? '#f59e0b' : 'inherit' }}
                        >
                          {r.isFeatured ? 'Unpin' : 'Pin to Top'}
                        </button>
                        <button
                          type="button"
                          className="action-btn delete-btn"
                          onClick={() => handleDeleteReel(r.id)}
                          style={{ fontSize: '10px', padding: '6px 10px' }}
                          title="Delete reel"
                        >
                          <IconTrash size={12} />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '24px' }}>
                    <button
                      type="button"
                      className="outline"
                      disabled={page <= 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      style={{ fontSize: '11px', padding: '6px 14px' }}
                    >
                      ← Previous Page
                    </button>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'DM Mono' }}>
                      Page {page} of {totalPages}
                    </span>
                    <button
                      type="button"
                      className="outline"
                      disabled={page >= totalPages}
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      style={{ fontSize: '11px', padding: '6px 14px' }}
                    >
                      Next Page →
                    </button>
                  </div>
                )}
              </>
            )
          })()}
        </div>
      </section>
    </LivePortal>
  )
}
