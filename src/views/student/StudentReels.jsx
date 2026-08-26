import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Icon8,
  IconChevronDown,
  IconChevronUp,
  IconFlame,
  IconHeart,
  IconLink,
  IconVideo,
} from '../../components/icons'
import { LivePortal } from '../../components/layout/LivePortal'
import { usePlatformTheme } from '../../context/PlatformThemeContext'
import { memberApi } from '../../lib/api'

export function StudentReels({ user, logout, onNavigate }) {
  const { platformMode } = usePlatformTheme()
  const isMrdu = platformMode === 'MRDU_EVENTS'
  const [reels, setReels] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('PLAYER') // 'PLAYER' | 'GRID'
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedCategory, setSelectedCategory] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [likedReels, setLikedReels] = useState(new Set())
  const [copiedLink, setCopiedLink] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [expandedCaption, setExpandedCaption] = useState(false)
  const [heartAnim, setHeartAnim] = useState(false)
  const lastScrollTime = useRef(0)
  const touchStartY = useRef(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    memberApi.listReels({ platformMode: isMrdu ? 'MRDU_EVENTS' : 'ALL' })
      .then(res => {
        if (mounted) {
          const list = res.reels || []
          setReels(list)
          const initialLiked = new Set(list.filter(r => r.isLiked).map(r => r.id))
          setLikedReels(initialLiked)
          setCurrentIndex(0)
        }
      })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [isMrdu])

  const filteredReels = useMemo(() => {
    return reels.filter(r => {
      if (selectedCategory !== 'ALL' && r.category !== selectedCategory) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const t = (r.title || '').toLowerCase()
        const d = (r.description || '').toLowerCase()
        const h = (r.authorHandle || '').toLowerCase()
        const c = (r.category || '').toLowerCase()
        if (!t.includes(q) && !d.includes(q) && !h.includes(q) && !c.includes(q)) return false
      }
      return true
    })
  }, [reels, selectedCategory, searchQuery])

  const activeReel = (viewMode === 'PLAYER' ? filteredReels[currentIndex] : null) || filteredReels[0] || reels[0] || null

  // Record view on reel display
  useEffect(() => {
    if (activeReel?.id && viewMode === 'PLAYER') {
      setExpandedCaption(false)
      const timer = setTimeout(() => {
        memberApi.recordReelView(activeReel.id).catch(() => {})
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [activeReel?.id, viewMode])

  // Keyboard navigation for player mode
  useEffect(() => {
    if (viewMode !== 'PLAYER') return
    function handleKeyDown(e) {
      if (filteredReels.length === 0) return
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault()
        handleNextReel()
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault()
        handlePrevReel()
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault()
        if (activeReel) handleToggleLike(activeReel)
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault()
        setIsMuted(m => !m)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentIndex, filteredReels, activeReel, viewMode])

  function handleNextReel() {
    if (currentIndex < filteredReels.length - 1) {
      setCurrentIndex(curr => curr + 1)
    }
  }

  function handlePrevReel() {
    if (currentIndex > 0) {
      setCurrentIndex(curr => curr - 1)
    }
  }

  function handleWheel(e) {
    if (viewMode !== 'PLAYER') return
    const now = Date.now()
    if (now - lastScrollTime.current < 450) return
    if (Math.abs(e.deltaY) > 30) {
      lastScrollTime.current = now
      if (e.deltaY > 0) handleNextReel()
      else handlePrevReel()
    }
  }

  function handleTouchStart(e) {
    touchStartY.current = e.touches[0]?.clientY
  }

  function handleTouchEnd(e) {
    if (touchStartY.current === null || viewMode !== 'PLAYER') return
    const touchEndY = e.changedTouches[0]?.clientY
    const diff = touchStartY.current - touchEndY
    if (Math.abs(diff) > 40) {
      if (diff > 0) handleNextReel()
      else handlePrevReel()
    }
    touchStartY.current = null
  }

  function handleToggleLike(reel) {
    const isCurrentlyLiked = likedReels.has(reel.id)
    setLikedReels(prev => {
      const next = new Set(prev)
      if (isCurrentlyLiked) next.delete(reel.id)
      else next.add(reel.id)
      return next
    })
    setReels(curr => curr.map(r => {
      if (r.id === reel.id) {
        return {
          ...r,
          likesCount: isCurrentlyLiked ? Math.max(0, r.likesCount - 1) : r.likesCount + 1,
          isLiked: !isCurrentlyLiked,
        }
      }
      return r
    }))
    memberApi.likeReel(reel.id).catch(() => {})
  }

  function handleDoubleTap(reel) {
    if (!likedReels.has(reel.id)) {
      handleToggleLike(reel)
    }
    setHeartAnim(true)
    setTimeout(() => setHeartAnim(false), 850)
  }

  function handleCopyShare(reel) {
    const shareUrl = reel.externalPostUrl || (reel.url.includes('embed') ? reel.url.replace('/embed/', '').replace('/embed', '') : reel.url)
    navigator.clipboard?.writeText(shareUrl).then(() => {
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2200)
    }).catch(() => {})
  }

  function jumpToReelInPlayer(index) {
    setCurrentIndex(index)
    setViewMode('PLAYER')
  }

  const authorHandle = activeReel?.authorHandle || (activeReel?.postedBy ? activeReel.postedBy.toLowerCase().replace(/\s+/g, '_') : 'cybersecurityclub_mrdu')
  const authorAvatar = activeReel?.authorAvatar || 'https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=150&auto=format&fit=crop&q=80'
  const audioTitle = activeReel?.audioTitle || `${authorHandle} • Original audio`
  const externalLink = activeReel?.externalPostUrl || (activeReel?.url.includes('instagram.com') ? activeReel.url.replace('/embed/', '/').replace('/embed', '') : `https://www.instagram.com/${authorHandle}`)
  const isUnwatchedAdminPush = activeReel?.isAdminUpload && !activeReel?.isWatched

  const categories = [
    { id: 'ALL', label: 'All Highlights' },
    { id: 'CAMPUS_LIFE', label: 'Campus Life' },
    { id: 'HACKATHONS', label: 'Hackathons & CTF' },
    { id: 'WORKSHOPS', label: 'Workshops' },
    { id: 'CULTURAL', label: 'Cultural & Fests' },
    { id: 'TECH_NEWS', label: 'Tech Updates' },
  ]

  return (
    <LivePortal user={user} logout={logout} activeTab="student-reels" onNavigate={onNavigate} title={isMrdu ? 'MRDU REELS & POSTS' : 'CAMPUS REELS & SOCIAL FEED'}>
      <section style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 8px 30px' }}>
        {/* Navigation Toolbar & View Switcher */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button className="back-button" type="button" onClick={() => onNavigate('student-dashboard')} style={{ margin: 0 }}>
              ← DASHBOARD
            </button>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
              Official Social Media & Reels
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className={viewMode === 'PLAYER' ? 'primary' : 'outline'}
              onClick={() => setViewMode('PLAYER')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '6px 14px', fontWeight: 700 }}
            >
              <IconVideo size={14} /> REEL PLAYER
            </button>
            <button
              type="button"
              className={viewMode === 'GRID' ? 'primary' : 'outline'}
              onClick={() => setViewMode('GRID')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '6px 14px', fontWeight: 700 }}
            >
              <Icon8 name="irisScan" size={14} /> EXPLORE GRID ({reels.length})
            </button>
          </div>
        </div>

        {/* Category Filters and Search Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', background: 'var(--bg-card)', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--brand-border-subtle)' }}>
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', maxWidth: '100%' }}>
            {categories.map(cat => (
              <button
                key={cat.id}
                type="button"
                className={`tab-btn ${selectedCategory === cat.id ? 'active' : ''}`}
                onClick={() => { setSelectedCategory(cat.id); setCurrentIndex(0) }}
                style={{
                  fontSize: '11px',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  whiteSpace: 'nowrap',
                  background: selectedCategory === cat.id ? 'var(--brand-primary)' : 'var(--panel-subtle)',
                  color: selectedCategory === cat.id ? '#ffffff' : 'var(--text-muted)',
                  border: '1px solid var(--line)',
                  cursor: 'pointer',
                  fontWeight: selectedCategory === cat.id ? 700 : 500,
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', width: '220px', minWidth: '160px' }}>
            <input
              type="text"
              placeholder="Search reels or handles…"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentIndex(0) }}
              style={{ width: '100%', height: '32px', padding: '0 10px', fontSize: '11px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--bg-input)', color: 'var(--text-main)' }}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', height: '60vh', color: 'var(--text-muted)' }}>
            <div style={{ textAlign: 'center' }}>
              <div className="spinner" style={{ width: '32px', height: '32px', margin: '0 auto 12px' }} />
              <p style={{ fontSize: '12px', letterSpacing: '0.04em' }}>Loading Reels Feed…</p>
            </div>
          </div>
        ) : filteredReels.length === 0 ? (
          <article className="account-form-card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <span style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: 'var(--brand-badge-bg)', color: 'var(--brand-primary)', marginBottom: '14px' }}>
              <IconVideo size={36} />
            </span>
            <h3 style={{ margin: '0 0 8px', color: 'var(--text-main)' }}>No reels found in this category</h3>
            <p style={{ margin: '0 0 16px', fontSize: '13px' }}>Try selecting "All Highlights" or searching for a different keyword.</p>
            <button type="button" className="outline" onClick={() => { setSelectedCategory('ALL'); setSearchQuery('') }}>
              Reset Filters
            </button>
          </article>
        ) : viewMode === 'GRID' ? (
          /* ==================================================== */
          /* EXPLORE ALL REELS & POSTS (GRID DISCOVERY MODE)     */
          /* ==================================================== */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '18px' }}>
            {filteredReels.map((r, idx) => (
              <article
                key={r.id}
                className="account-form-card"
                onClick={() => jumpToReelInPlayer(idx)}
                style={{
                  padding: '14px',
                  cursor: 'pointer',
                  borderRadius: '14px',
                  border: r.isFeatured ? '1px solid #f59e0b' : '1px solid var(--brand-border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Header author badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'linear-gradient(45deg, #f09433, #dc2743)', display: 'grid', placeItems: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#fff', fontWeight: 800 }}>IG</span>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-main)' }}>
                      @{r.authorHandle || 'cybersecurityclub_mrdu'}
                    </span>
                  </div>
                  <span className="badge" style={{ fontSize: '9px', fontWeight: 600, background: 'var(--brand-badge-bg)', color: 'var(--brand-badge-color)' }}>
                    {r.category.replace('_', ' ')}
                  </span>
                </div>

                {/* Preview Box */}
                <div style={{ width: '100%', height: '200px', background: '#000000', borderRadius: '10px', overflow: 'hidden', position: 'relative', marginBottom: '10px', display: 'grid', placeItems: 'center' }}>
                  {r.embedType === 'DIRECT_VIDEO' ? (
                    <video src={r.url} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <iframe src={r.url} title={r.title} scrolling="no" style={{ width: '100%', height: '100%', border: 0, pointerEvents: 'none' }} />
                  )}
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.2)', display: 'grid', placeItems: 'center', transition: 'background 0.2s' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', color: '#ffffff', border: '1px solid rgba(255,255,255,0.3)' }}>
                      <IconVideo size={20} />
                    </div>
                  </div>
                </div>

                {/* Title & Description */}
                <h4 style={{ margin: '0 0 6px', fontSize: '13px', color: 'var(--text-main)', lineHeight: 1.3, fontWeight: 700 }}>
                  {r.title}
                </h4>
                {r.description && (
                  <p style={{ margin: '0 0 10px', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {r.description}
                  </p>
                )}

                {/* Action Footer */}
                <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <IconHeart size={12} color="#ef4444" filled={r.likesCount > 0} /> {r.likesCount} · {r.viewsCount} views
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--brand-primary)', fontWeight: 700 }}>
                    Watch Reel →
                  </span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          /* ==================================================== */
          /* PURE INSTAGRAM-STYLE VERTICAL REEL PLAYER            */
          /* ==================================================== */
          <div
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              position: 'relative',
              userSelect: 'none',
              padding: '10px 0',
            }}
          >
            {/* Phone/Reel Canvas Container */}
            <div
              onDoubleClick={() => activeReel && handleDoubleTap(activeReel)}
              style={{
                width: '100%',
                maxWidth: '410px',
                height: 'calc(86vh - 60px)',
                minHeight: '520px',
                maxHeight: '740px',
                background: '#000000',
                borderRadius: '20px',
                overflow: 'hidden',
                position: 'relative',
                boxShadow: `0 25px 60px rgba(0, 0, 0, 0.8), 0 0 30px ${isMrdu ? 'rgba(211, 47, 47, 0.18)' : 'rgba(82, 187, 245, 0.12)'}`,
                border: isUnwatchedAdminPush ? '2px solid var(--brand-primary)' : '1px solid rgba(255, 255, 255, 0.12)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Active Reel Embed */}
              <div style={{ width: '100%', height: '100%', position: 'relative', background: '#000000', overflow: 'hidden' }}>
                {activeReel.embedType === 'DIRECT_VIDEO' ? (
                  <video
                    src={activeReel.url}
                    autoPlay
                    loop
                    muted={isMuted}
                    playsInline
                    controls={false}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <iframe
                    key={activeReel.id}
                    src={activeReel.url}
                    title={activeReel.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    scrolling="no"
                    style={{ width: '100%', height: '100%', border: 0, overflow: 'hidden', background: '#000000', pointerEvents: 'auto' }}
                  />
                )}

                {/* Double-tap Floating Heart Animation */}
                {heartAnim && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'grid',
                      placeItems: 'center',
                      zIndex: 35,
                      pointerEvents: 'none',
                      animation: 'reelHeartPop 0.8s ease-out forwards',
                    }}
                  >
                    <div style={{ transform: 'scale(1.8)', filter: 'drop-shadow(0 0 20px rgba(239, 68, 68, 0.8))' }}>
                      <IconHeart size={56} filled color="#ef4444" />
                    </div>
                  </div>
                )}

                {/* Top Priority / Direct App Pill */}
                <div style={{ position: 'absolute', top: '12px', left: '12px', right: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 22, pointerEvents: 'auto' }}>
                  {isUnwatchedAdminPush ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'var(--brand-gradient)',
                        color: '#050c14',
                        padding: '4px 10px',
                        borderRadius: '16px',
                        fontWeight: 800,
                        fontSize: '10px',
                        letterSpacing: '0.04em',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
                      }}
                    >
                      <IconFlame size={12} /> NEW HIGHLIGHT
                    </div>
                  ) : (
                    <span style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', padding: '3px 8px', borderRadius: '12px', fontSize: '10px', color: '#ffffff', fontWeight: 600 }}>
                      {currentIndex + 1} of {filteredReels.length}
                    </span>
                  )}

                  {/* Direct Launch Instagram App Pill */}
                  <a
                    href={externalLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      background: 'rgba(236, 72, 153, 0.85)',
                      color: '#ffffff',
                      textDecoration: 'none',
                      padding: '4px 10px',
                      borderRadius: '16px',
                      fontSize: '10px',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                    }}
                  >
                    <IconVideo size={11} /> Open in Instagram
                  </a>
                </div>

                {/* Instagram Floating Right Action Bar */}
                <div
                  style={{
                    position: 'absolute',
                    right: '12px',
                    bottom: '95px',
                    zIndex: 25,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '16px',
                  }}
                >
                  {/* Like Button */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleToggleLike(activeReel) }}
                      style={{
                        background: 'rgba(20, 20, 20, 0.65)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.18)',
                        borderRadius: '50%',
                        width: '44px',
                        height: '44px',
                        display: 'grid',
                        placeItems: 'center',
                        color: likedReels.has(activeReel.id) ? '#ef4444' : '#ffffff',
                        cursor: 'pointer',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                        transition: 'transform 0.15s',
                      }}
                      title={likedReels.has(activeReel.id) ? 'Unlike' : 'Like'}
                    >
                      <IconHeart size={22} filled={likedReels.has(activeReel.id)} color={likedReels.has(activeReel.id) ? '#ef4444' : '#ffffff'} />
                    </button>
                    <span style={{ fontSize: '11px', color: '#ffffff', fontWeight: 700, textShadow: '0 2px 4px rgba(0,0,0,0.9)', fontFamily: 'DM Mono' }}>
                      {activeReel.likesCount || 0}
                    </span>
                  </div>

                  {/* Share Link Button */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleCopyShare(activeReel) }}
                      style={{
                        background: 'rgba(20, 20, 20, 0.65)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.18)',
                        borderRadius: '50%',
                        width: '44px',
                        height: '44px',
                        display: 'grid',
                        placeItems: 'center',
                        color: '#ffffff',
                        cursor: 'pointer',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                      }}
                      title="Copy Share Link"
                    >
                      <IconLink size={18} />
                    </button>
                    <span style={{ fontSize: '10px', color: '#ffffff', fontWeight: 600, textShadow: '0 2px 4px rgba(0,0,0,0.9)' }}>
                      {copiedLink ? 'Copied!' : 'Share'}
                    </span>
                  </div>

                  {/* External Instagram Link */}
                  <a
                    href={externalLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      background: 'rgba(20, 20, 20, 0.65)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.18)',
                      borderRadius: '50%',
                      width: '44px',
                      height: '44px',
                      display: 'grid',
                      placeItems: 'center',
                      color: '#ffffff',
                      textDecoration: 'none',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                    }}
                    title="Open on Instagram"
                  >
                    <IconVideo size={18} />
                  </a>

                  {/* Sound Toggle */}
                  {activeReel.embedType === 'DIRECT_VIDEO' && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setIsMuted(m => !m) }}
                      style={{
                        background: 'rgba(20, 20, 20, 0.65)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.18)',
                        borderRadius: '50%',
                        width: '38px',
                        height: '38px',
                        display: 'grid',
                        placeItems: 'center',
                        color: '#ffffff',
                        cursor: 'pointer',
                      }}
                      title={isMuted ? 'Unmute' : 'Mute'}
                    >
                      <span style={{ fontSize: '12px' }}>{isMuted ? 'MUTE' : 'ON'}</span>
                    </button>
                  )}
                </div>

                {/* Instagram Bottom Overlay (Profile, Caption, Audio) */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '30px 60px 16px 14px',
                    background: 'linear-gradient(to top, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.65) 55%, transparent 100%)',
                    color: '#ffffff',
                    zIndex: 20,
                    pointerEvents: 'auto',
                  }}
                >
                  {/* Author Profile Row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <div
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '50%',
                        padding: '2px',
                        background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)',
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <img
                        src={authorAvatar}
                        alt={authorHandle}
                        style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                      />
                    </div>

                    <a
                      href={externalLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '13px',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                      }}
                    >
                      @{authorHandle}
                      <span style={{ color: '#38bdf8', fontSize: '12px' }}>✓</span>
                    </a>

                    <a
                      href={externalLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        border: '1px solid rgba(255, 255, 255, 0.4)',
                        background: 'rgba(255, 255, 255, 0.1)',
                        color: '#ffffff',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '10px',
                        fontWeight: 700,
                        textDecoration: 'none',
                        marginLeft: '4px',
                      }}
                    >
                      Follow
                    </a>
                  </div>

                  {/* Title & Caption */}
                  <div style={{ marginBottom: '8px' }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '12px',
                        lineHeight: 1.45,
                        color: '#f1f5f9',
                        textShadow: '0 1px 3px rgba(0,0,0,0.9)',
                        maxHeight: expandedCaption ? '220px' : '38px',
                        overflow: expandedCaption ? 'y-auto' : 'hidden',
                        textOverflow: 'ellipsis',
                        transition: 'max-height 0.2s ease',
                      }}
                    >
                      <b>{activeReel.title}</b>
                      {activeReel.description && (
                        <span> — {activeReel.description}</span>
                      )}
                    </p>

                    {activeReel.description && activeReel.description.length > 60 && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setExpandedCaption(exp => !exp) }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#94a3b8',
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: 0,
                          marginTop: '2px',
                          cursor: 'pointer',
                        }}
                      >
                        {expandedCaption ? 'less' : '...more'}
                      </button>
                    )}
                  </div>

                  {/* Audio Track Ticker */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '11px',
                      color: '#cbd5e1',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span style={{ fontSize: '11px' }}>♫</span>
                    <span style={{ fontFamily: 'DM Mono', fontSize: '10px', opacity: 0.9 }}>
                      {audioTitle}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Desktop Side Navigation Arrows */}
            <div style={{ position: 'absolute', right: 'calc(50% - 275px)', display: 'flex', flexDirection: 'column', gap: '12px', zIndex: 30 }}>
              <button
                type="button"
                className="outline"
                disabled={currentIndex === 0}
                onClick={handlePrevReel}
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  background: 'var(--panel-subtle)',
                  borderColor: 'var(--line)',
                  cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
                  opacity: currentIndex === 0 ? 0.3 : 1,
                  color: 'var(--text-main)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}
                title="Previous Reel (Up Arrow)"
              >
                <IconChevronUp size={18} />
              </button>
              <div style={{ textAlign: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', fontFamily: 'DM Mono' }}>
                {currentIndex + 1}/{filteredReels.length}
              </div>
              <button
                type="button"
                className="outline"
                disabled={currentIndex === filteredReels.length - 1}
                onClick={handleNextReel}
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  background: 'var(--panel-subtle)',
                  borderColor: 'var(--line)',
                  cursor: currentIndex === filteredReels.length - 1 ? 'not-allowed' : 'pointer',
                  opacity: currentIndex === filteredReels.length - 1 ? 0.3 : 1,
                  color: 'var(--text-main)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}
                title="Next Reel (Down Arrow)"
              >
                <IconChevronDown size={18} />
              </button>
            </div>
          </div>
        )}
      </section>
    </LivePortal>
  )
}
