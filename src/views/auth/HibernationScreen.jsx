import React, { useEffect, useState } from 'react'
import { Crest } from '../../components/common/Crest'
import { IconAlertTriangle, IconCrown } from '../../components/icons'
import { memberApi } from '../../lib/api'

export function HibernationScreen({ onAdminLogin }) {
  const [startedAt, setStartedAt] = useState(null)
  const [elapsed, setElapsed] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    let mounted = true
    memberApi.getPublicClubSettings()
      .then(({ settings }) => {
        if (mounted && settings?.hibernationStartedAt) {
          setStartedAt(new Date(settings.hibernationStartedAt))
        }
      })
      .catch(() => {})
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    function calculateElapsed() {
      const start = startedAt ? new Date(startedAt).getTime() : Date.now()
      const diff = Math.max(0, Date.now() - start)

      const seconds = Math.floor((diff / 1000) % 60)
      const minutes = Math.floor((diff / (1000 * 60)) % 60)
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))

      setElapsed({ days, hours, minutes, seconds })
    }

    calculateElapsed()
    const timer = setInterval(calculateElapsed, 1000)
    return () => clearInterval(timer)
  }, [startedAt])

  return (
    <div className="hibernation-page">
      <div className="grid-overlay" />
      <div className="hibernation-card">
        <Crest />
        <span className="hibernation-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <IconAlertTriangle size={13} /> SITE STATUS · HIBERNATION ACTIVE
        </span>
        <h1 className="hibernation-title">PORTAL IN HIBERNATION</h1>
        <p className="hibernation-desc">
          The Cyber Security Club website is temporarily in hibernation mode for scheduled community maintenance.
        </p>

        <div className="hibernation-timer-box">
          <div className="hibernation-timer-label">ELAPSED HIBERNATION DURATION</div>
          <div className="hibernation-timer-grid">
            <div className="timer-block">
              <span className="timer-num">{String(elapsed.days).padStart(2, '0')}</span>
              <span className="timer-unit">DAYS</span>
            </div>
            <div className="timer-block">
              <span className="timer-num">{String(elapsed.hours).padStart(2, '0')}</span>
              <span className="timer-unit">HOURS</span>
            </div>
            <div className="timer-block">
              <span className="timer-num">{String(elapsed.minutes).padStart(2, '0')}</span>
              <span className="timer-unit">MINUTES</span>
            </div>
            <div className="timer-block">
              <span className="timer-num">{String(elapsed.seconds).padStart(2, '0')}</span>
              <span className="timer-unit">SECONDS</span>
            </div>
          </div>
        </div>

        <button type="button" className="hibernation-admin-btn" onClick={onAdminLogin} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <IconCrown size={14} /> President & Admin Gateway &rarr;
        </button>
      </div>
    </div>
  )
}
