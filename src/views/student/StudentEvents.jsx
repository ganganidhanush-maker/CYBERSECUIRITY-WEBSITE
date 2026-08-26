import React, { useEffect, useState } from 'react'
import {
  Icon8,
  IconCalendar,
  IconCreditCard,
  IconLocationPin,
  IconUserSvg,
} from '../../components/icons'
import { LivePortal } from '../../components/layout/LivePortal'
import { usePlatformTheme } from '../../context/PlatformThemeContext'
import { memberApi } from '../../lib/api'

export function StudentEvents({ user, logout, onNavigate }) {
  const { platformMode } = usePlatformTheme()
  const isMrdu = platformMode === 'MRDU_EVENTS'
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    memberApi.listEvents()
      .then(({ events: list }) => { if (mounted) setEvents(list || []) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  return (
    <LivePortal user={user} logout={logout} activeTab="student-events" onNavigate={onNavigate} title={isMrdu ? 'MRDU EVENTS CATALOG' : 'EVENTS CATALOG'}>
      <section className="gallery-section">
        <div className="event-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('student-dashboard')}>
              ← BACK TO DASHBOARD
            </button>
            <p className="eyebrow">{isMrdu ? 'MRDU UNIVERSITY CALENDAR' : 'COMMUNITY CALENDAR'}</p>
            <h1>{isMrdu ? 'University Events & Fests' : 'Upcoming Club Events'}</h1>
            <p>{isMrdu ? 'Register for university-wide technical symposiums, hackathons, cultural fests, and workshops.' : 'Participate in defensive workshops, certification bootcamps, and CTF challenges.'}</p>
          </div>
        </div>

        {loading ? (
          <p className="directory-state">Loading events catalog...</p>
        ) : events.length === 0 ? (
          <p className="directory-state">No upcoming events currently published. Check back soon!</p>
        ) : (
          <div className="student-events-container">
            {events.map(evt => (
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
                  <p>{evt.shortDescription || evt.description || (isMrdu ? 'MRDU University official event session.' : 'Department of Cyber Security session.')}</p>
                  <div className="card-meta">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><IconCalendar size={13} /> {new Date(evt.dateTime).toLocaleDateString()}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><IconLocationPin size={13} /> {evt.venue || evt.location || 'Campus'}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><IconCreditCard size={13} /> {evt.requiresPayment ? `₹${evt.paymentAmount || 'Tiered'}` : 'FREE'}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><IconUserSvg size={13} /> {evt.registrationCount || 0} registered</span>
                  </div>
                  <div className="card-footer">
                    {evt.isRegistered ? (
                      <span className="badge badge-registered" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Icon8 name="authentication" size={12} /> REGISTERED
                      </span>
                    ) : (
                      <button className="register-btn" type="button" onClick={() => onNavigate(`event-detail/${evt.id}`)}>
                        VIEW DETAILS & REGISTER &rarr;
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </LivePortal>
  )
}
