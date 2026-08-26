import React, { useEffect, useState } from 'react'
import { Crest } from '../../components/common/Crest'
import { memberApi } from '../../lib/api'

export function ConcurrentWaitingQueue({ onComplete }) {
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          memberApi.completeWaitingQueue().finally(() => onComplete())
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [onComplete])

  return (
    <div className="queue-overlay">
      <div className="queue-card">
        <Crest small />
        <h2 style={{ font: '700 22px Syne', color: 'var(--text-main)', margin: '16px 0 6px' }}>High Member Activity</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.6' }}>
          More than 20 students are actively connected. Allocating secure session slot...
        </p>
        <div className="queue-timer">{countdown}</div>
        <small style={{ color: 'var(--text-dim)', font: '500 10px "DM Mono", monospace' }}>ENTERING AUTOMATICALLY...</small>
      </div>
    </div>
  )
}
