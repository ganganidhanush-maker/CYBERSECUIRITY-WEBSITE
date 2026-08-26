import React, { useEffect, useRef, useState } from 'react'
import { IconCheckCircle, IconSparkles } from '../../components/icons'
import { memberApi } from '../../lib/api'
import { parseYouTubeVideoId } from '../../lib/video'

export function IntroVideoExperience({ onComplete }) {
  const [videoUrl, setVideoUrl] = useState('https://www.youtube.com/watch?v=gokPW83s7nA')
  const [secondsWatched, setSecondsWatched] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [canProceed, setCanProceed] = useState(false)
  const [completing, setCompleting] = useState(false)
  const iframeRef = useRef(null)

  const REQUIRED_DURATION = 120 // Compulsory 2 minutes (120 seconds)

  // 1. Fetch configured video URL from club settings
  useEffect(() => {
    let mounted = true
    memberApi.getPublicClubSettings()
      .then(({ settings }) => {
        if (!mounted) return
        if (settings?.introVideoUrl && typeof settings.introVideoUrl === 'string' && settings.introVideoUrl.trim()) {
          setVideoUrl(settings.introVideoUrl.trim())
        }
      })
      .catch(() => {})
    return () => { mounted = false }
  }, [])

  const youtubeId = parseYouTubeVideoId(videoUrl) || 'gokPW83s7nA'

  // 2. Active timer: ticks every 1 second continuously while video orientation screen is active
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsWatched(prev => {
        const next = prev + 1
        if (next >= REQUIRED_DURATION) {
          setCanProceed(true)
        }
        return next
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [REQUIRED_DURATION])

  // 3. YouTube postMessage Listener for video events
  useEffect(() => {
    function handleMessage(event) {
      if (!event.data) return
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
        let playerState = undefined
        if (data.event === 'onStateChange' && data.data !== undefined) {
          playerState = data.data
        } else if (data.info && data.info.playerState !== undefined) {
          playerState = data.info.playerState
        }

        if (playerState === 1) { // PLAYING
          setIsPlaying(true)
        } else if (playerState === 2) { // PAUSED
          setIsPlaying(false)
        } else if (playerState === 0) { // ENDED
          setCanProceed(true)
        }
      } catch {}
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  async function handleFinish() {
    if (!canProceed || completing) return
    setCompleting(true)
    try {
      await memberApi.completeIntroVideo()
    } catch {}
    onComplete()
  }

  const remainingSeconds = Math.max(0, REQUIRED_DURATION - secondsWatched)
  const progressPercent = Math.min(100, Math.round((secondsWatched / REQUIRED_DURATION) * 100))

  return (
    <div className="intro-video-overlay" style={{ zIndex: 999999, background: 'rgba(2, 6, 12, 0.96)', backdropFilter: 'blur(16px)' }}>
      <div className="intro-video-container" style={{ maxWidth: '980px', width: '100%', borderRadius: '16px', border: '1px solid var(--brand-border-subtle)', background: 'var(--bg-card)', boxShadow: '0 0 80px rgba(0,0,0,0.9)' }}>
        {/* Header with Live Countdown & Status */}
        <div className="intro-video-header" style={{ padding: '16px 24px', background: 'var(--bg-input)', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: canProceed ? '#70ddb4' : 'var(--brand-primary)', boxShadow: `0 0 8px ${canProceed ? '#70ddb4' : 'var(--brand-primary)'}` }} />
              <b style={{ font: '700 14px Syne', color: 'var(--text-main)', letterSpacing: '.04em' }}>
                MANDATORY STUDENT ONBOARDING BRIEFING
              </b>
            </div>
            <small style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>
              Please watch the official 2-minute orientation video completely to unlock access to your portal and events.
            </small>
          </div>

          {/* Big Digital Timer Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: canProceed ? 'rgba(16, 185, 129, 0.15)' : 'var(--brand-badge-bg)',
              border: `1px solid ${canProceed ? '#10b981' : 'var(--brand-primary)'}`,
              padding: '6px 14px',
              borderRadius: '8px',
              textAlign: 'right',
            }}>
              <span style={{
                color: canProceed ? '#70ddb4' : 'var(--brand-primary)',
                font: '700 13px "DM Mono", monospace',
                letterSpacing: '.08em',
                display: 'block',
              }}>
                {canProceed ? '✓ 2:00 COMPLETED' : `TIME: ${Math.floor(secondsWatched / 60)}:${String(secondsWatched % 60).padStart(2, '0')} / 2:00`}
              </span>
              <small style={{ color: 'var(--text-muted)', fontSize: '9px', font: '500 9px "DM Mono", monospace' }}>
                {canProceed ? 'REQUIREMENT SATISFIED' : `${remainingSeconds}s REMAINING (${progressPercent}%)`}
              </small>
            </div>
          </div>
        </div>

        {/* Animated Progress Bar Strip */}
        <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.06)', position: 'relative' }}>
          <div style={{
            height: '100%',
            width: `${progressPercent}%`,
            background: canProceed ? 'linear-gradient(90deg, #10b981, #70ddb4)' : 'var(--brand-gradient)',
            transition: 'width 1s linear',
            boxShadow: canProceed ? '0 0 12px #70ddb4' : '0 0 12px var(--brand-glow)',
          }} />
        </div>

        {/* YouTube Video Player */}
        <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', minHeight: '440px', background: '#000000', overflow: 'hidden' }}>
          <iframe
            id="youtube-player-iframe"
            ref={iframeRef}
            src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&controls=1&rel=0&playsinline=1&enablejsapi=1&modestbranding=1`}
            title="Student Onboarding Orientation Video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            style={{ width: '100%', height: '100%', border: 0, position: 'absolute', top: 0, left: 0 }}
          />
        </div>

        {/* Footer with Live Instructions and Entry Action */}
        <div style={{ padding: '18px 24px', background: 'var(--bg-input)', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ display: 'inline-flex', padding: '6px', borderRadius: '50%', background: canProceed ? 'rgba(16, 185, 129, 0.15)' : 'var(--brand-badge-bg)', color: canProceed ? '#10b981' : 'var(--brand-primary)' }}>
              {canProceed ? <IconCheckCircle size={18} /> : <IconSparkles size={18} />}
            </span>
            <div>
              <p style={{ margin: 0, color: 'var(--text-main)', fontSize: '12px', fontWeight: 600 }}>
                {canProceed
                  ? 'Orientation video requirement complete!'
                  : `Watching orientation briefing... (${remainingSeconds} seconds remaining)`}
              </p>
              <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                {canProceed
                  ? 'Click the button below to proceed to your student dashboard.'
                  : 'Click the video player if autoplay was paused by your browser.'}
              </small>
            </div>
          </div>

          <button
            className="primary"
            type="button"
            disabled={!canProceed || completing}
            onClick={handleFinish}
            style={{
              padding: '0 28px',
              minHeight: '44px',
              fontSize: '11px',
              background: canProceed ? 'linear-gradient(105deg, #059669, #10b981)' : undefined,
              borderColor: canProceed ? '#10b981' : undefined,
              color: canProceed ? '#ffffff' : undefined,
              cursor: canProceed ? 'pointer' : 'not-allowed',
            }}
          >
            {completing
              ? 'PREPARING DASHBOARD…'
              : canProceed
              ? 'ENTER PORTAL DASHBOARD →'
              : `COMPLETE VIDEO (${remainingSeconds}s)`}
          </button>
        </div>
      </div>
    </div>
  )
}
