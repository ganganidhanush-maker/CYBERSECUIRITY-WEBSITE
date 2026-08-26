import React, { useEffect, useState } from 'react'
import { LivePortal } from '../../components/layout/LivePortal'
import { usePlatformTheme } from '../../context/PlatformThemeContext'
import { memberApi } from '../../lib/api'

export function OurTeamShowcase({ user, logout, onNavigate }) {
  const { platformMode } = usePlatformTheme()
  const isMrdu = platformMode === 'MRDU_EVENTS'
  const [team, setTeam] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    memberApi.listClubTeam()
      .then(({ team: list }) => { if (mounted) setTeam(list || []) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  return (
    <LivePortal user={user} logout={logout} activeTab="student-team" onNavigate={onNavigate} title={isMrdu ? 'ORGANIZING COMMITTEE' : 'CLUB LEADERSHIP'}>
      <section className="member-management">
        <div className="member-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('student-dashboard')}>
              ← BACK TO DASHBOARD
            </button>
            <p className="eyebrow">{isMrdu ? 'CENTRAL ORGANIZING COMMITTEE' : 'STUDENT COUNCIL'}</p>
            <h1>{isMrdu ? 'Meet Our Organizing Committee' : 'Meet Our Leadership'}</h1>
            <p>{isMrdu ? 'The faculty coordinators, event convenors, and student organizers managing MRDU Events.' : 'The student coordinators and executive leads driving Cyber Security Club MRDU.'}</p>
          </div>
        </div>

        {loading ? (
          <p className="directory-state">Loading leadership profiles...</p>
        ) : team.length === 0 ? (
          <p className="directory-state">No team members published yet.</p>
        ) : (
          <div className="team-grid">
            {team.map(l => (
              <div className="leader-card" key={l.id}>
                {l.photoUrl ? (
                  <img className="leader-photo" src={l.photoUrl} alt={l.name} />
                ) : (
                  <div className="leader-photo-placeholder">{l.name.slice(0, 2).toUpperCase()}</div>
                )}
                <b style={{ color: 'var(--text-main)', fontSize: '15px' }}>{l.name}</b>
                <small style={{ color: 'var(--brand-primary)', font: '600 10px "DM Mono", monospace', margin: '4px 0' }}>{l.roleTitle}</small>
                <p style={{ color: 'var(--text-muted)', fontSize: '11px', margin: '6px 0 12px' }}>{l.bio}</p>
                <div className="leader-socials">
                  {l.linkedinUrl && <a className="social-pill" href={l.linkedinUrl} target="_blank" rel="noreferrer">LinkedIn</a>}
                  {l.githubUrl && <a className="social-pill" href={l.githubUrl} target="_blank" rel="noreferrer">GitHub</a>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </LivePortal>
  )
}
