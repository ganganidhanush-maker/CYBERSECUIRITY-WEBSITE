import React, { useEffect, useState } from 'react'
import { IconShieldCheck, IconSparkles } from '../../components/icons'
import { LivePortal } from '../../components/layout/LivePortal'
import { memberApi } from '../../lib/api'

export function StudentEventDetail({ user, eventId, logout, onNavigate }) {
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [selectedActivities, setSelectedActivities] = useState([])
  const [proofPreview, setProofPreview] = useState('')
  const [subRequired, setSubRequired] = useState(false)

  // Logistics & Demographics State
  const [gender, setGender] = useState(user.profile?.gender || 'MALE')
  const [age, setAge] = useState(user.profile?.age || 19)
  const [residencyType, setResidencyType] = useState('DAY_SCHOLAR')
  const [transportMode, setTransportMode] = useState('COLLEGE_BUS')
  const [hostelType, setHostelType] = useState('COLLEGE_HOSTEL')
  const [emergencyContact, setEmergencyContact] = useState('')
  const [paymentReference, setPaymentReference] = useState('')

  // Team Formation State
  const [teamNameInput, setTeamNameInput] = useState('')
  const [memberLookupInput, setMemberLookupInput] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState('')
  const [draftMembers, setDraftMembers] = useState([])
  const [teamSubmitting, setTeamSubmitting] = useState(false)

  // My Invites State
  const [pendingInvites, setPendingInvites] = useState([])
  const [respondingInviteId, setRespondingInviteId] = useState(null)

  function loadEventAndInvites() {
    let mounted = true
    setLoading(true)
    Promise.all([
      memberApi.getEventDetails(eventId),
      memberApi.listMyTeamInvites().catch(() => ({ invites: [] })),
    ])
      .then(([evRes, invRes]) => {
        if (!mounted) return
        setEvent(evRes.event)
        const relevantInvites = (invRes.invites || []).filter(i => i.eventId === eventId)
        setPendingInvites(relevantInvites)
      })
      .catch(err => { if (mounted) setError(err.message) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }

  useEffect(() => {
    return loadEventAndInvites()
  }, [eventId])

  function toggleActivity(actId) {
    if (event?.allowMultipleActivities) {
      setSelectedActivities(c => (c.includes(actId) ? c.filter(id => id !== actId) : [...c, actId]))
    } else {
      setSelectedActivities([actId])
    }
  }

  async function handleLookupMember() {
    const q = memberLookupInput.trim().toUpperCase()
    if (!q || q.length < 3) {
      setLookupError('Enter at least 3 characters of Member ID.')
      return
    }
    if (q === user.memberId?.toUpperCase()) {
      setLookupError('You are already the team leader.')
      return
    }
    if (draftMembers.some(m => m.memberId?.toUpperCase() === q)) {
      setLookupError('Member already added to team draft.')
      return
    }

    setLookupLoading(true)
    setLookupError('')
    try {
      const res = await memberApi.lookupMember(q)
      setDraftMembers(c => [...c, res.member])
      setMemberLookupInput('')
    } catch (err) {
      setLookupError(err.message || 'Student not found.')
    } finally {
      setLookupLoading(false)
    }
  }

  function removeDraftMember(mId) {
    setDraftMembers(c => c.filter(m => m.id !== mId))
  }

  async function handleCreateTeam() {
    if (!teamNameInput.trim()) {
      setError('Please provide a team name.')
      return
    }
    setTeamSubmitting(true)
    setError('')
    setMessage('')
    try {
      await memberApi.createEventTeam(eventId, {
        teamName: teamNameInput.trim(),
        invitedMemberIds: draftMembers.map(m => m.id),
      })
      setMessage(`Team "${teamNameInput.trim()}" created! Invitations dispatched to team members.`)
      setTeamNameInput('')
      setDraftMembers([])
      loadEventAndInvites()
    } catch (err) {
      setError(err.message || 'Unable to create team.')
    } finally {
      setTeamSubmitting(false)
    }
  }

  async function handleRespondInvite(inviteId, accept) {
    setRespondingInviteId(inviteId)
    setError('')
    setMessage('')
    try {
      const res = await memberApi.respondTeamInvite(inviteId, accept)
      setMessage(res.message)
      loadEventAndInvites()
    } catch (err) {
      setError(err.message || 'Failed to respond to team invite.')
    } finally {
      setRespondingInviteId(null)
    }
  }

  async function handleRemoveTeamMember(teamId, memberUserId) {
    if (!confirm('Are you sure you want to remove this member from your team?')) return
    setError('')
    try {
      await memberApi.removeTeamMember(teamId, memberUserId)
      setMessage('Member removed from team.')
      loadEventAndInvites()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleRegister(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    setSubRequired(false)

    // Team validation
    if (event.isTeamEvent) {
      if (!event.userTeam) {
        setError('Please create or join a team first before registering.')
        return
      }
      if (!event.userTeam.isLeader) {
        setError('Only the team leader can submit the final team registration & payment.')
        return
      }
      const acceptedCount = (event.userTeam.members || []).filter(m => m.status === 'ACCEPTED').length
      const minReq = event.minTeamSize || 2
      if (acceptedCount < minReq) {
        setError(`Your team requires at least ${minReq} accepted members to register (currently ${acceptedCount} accepted).`)
        return
      }

      // If team rules mention female / girl requirement
      if (event.teamRules && /female|girl|woman/i.test(event.teamRules)) {
        const hasFemale = (event.userTeam.members || []).some(m => m.gender === 'FEMALE') || gender === 'FEMALE'
        if (!hasFemale) {
          setError('Event rules require at least 1 female team member. Please invite a female participant to join your team.')
          return
        }
      }
    }

    if (totalPrice > 0 && !paymentReference.trim()) {
      setError('Please enter your 12-digit UPI UTR / Transaction Reference ID for payment verification.')
      return
    }

    const payload = {
      selectedActivityIds: selectedActivities,
      paymentReference: paymentReference.trim() || null,
      paymentProofUrl: proofPreview || null,
      gender,
      age: age ? Number(age) : null,
      residencyType,
      transportMode: residencyType === 'DAY_SCHOLAR' ? transportMode : null,
      hostelType: residencyType === 'HOSTELLER' ? hostelType : null,
      emergencyContact: emergencyContact.trim() || null,
      teamName: event.userTeam?.teamName || null,
      teamId: event.userTeam?.id || null,
      isTeamLeader: Boolean(event.userTeam?.isLeader),
    }

    setSubmitting(true)
    try {
      await memberApi.registerForEvent(eventId, payload)
      setMessage(totalPrice > 0
        ? 'Registration & UPI reference submitted! Your digital pass is pending payment verification.'
        : 'Registration confirmed! Digital passes generated for all team members.')
      loadEventAndInvites()
    } catch (err) {
      if (err.code === 'SUBSCRIPTION_REQUIRED' || err.message?.includes('membership is inactive')) {
        setSubRequired(true)
      }
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <LivePortal user={user} logout={logout} activeTab="student-events" onNavigate={onNavigate} title="EVENT DETAILS">
        <p className="directory-state">Loading event details...</p>
      </LivePortal>
    )
  }

  if (!event) {
    return (
      <LivePortal user={user} logout={logout} activeTab="student-events" onNavigate={onNavigate} title="EVENT DETAILS">
        <button className="back-button" onClick={() => onNavigate('student-events')}>← BACK TO EVENTS</button>
        <p className="directory-state">Event not found.</p>
      </LivePortal>
    )
  }

  const basePrice = event.paymentAmount || 0
  const activityPrice = (event.activities || [])
    .filter(a => selectedActivities.includes(a.id))
    .reduce((sum, a) => sum + (Number(a.price) || 0), 0)
  const totalPrice = basePrice + activityPrice

  const userTeam = event.userTeam
  const isLeader = userTeam?.isLeader
  const acceptedMembersCount = userTeam ? userTeam.members.filter(m => m.status === 'ACCEPTED').length : 0
  const satisfiesMinTeam = !event.isTeamEvent || (userTeam && acceptedMembersCount >= (event.minTeamSize || 2))
  const ruleRequiresFemale = event.isTeamEvent && event.teamRules && /female|girl|woman/i.test(event.teamRules)
  const hasFemaleMember = userTeam && (userTeam.members.some(m => m.gender === 'FEMALE') || gender === 'FEMALE')

  return (
    <LivePortal user={user} logout={logout} activeTab="student-events" onNavigate={onNavigate} title="EVENT DETAILS">
      <section className="event-detail-page">
        <button className="back-button" onClick={() => onNavigate('student-events')}>← BACK TO EVENTS CATALOG</button>

        {message && <p className="member-form-success" style={{ marginTop: '10px' }}>{message}</p>}
        {error && <p className="member-form-error" style={{ marginTop: '10px' }}>{error}</p>}

        {subRequired && (
          <div className="pending-alert-banner" style={{ background: '#3a1818', borderColor: '#ef4444', color: '#ffcdd2', marginTop: '14px' }}>
            <div>
              <b>Active Student Membership Required</b>
              <p style={{ margin: '2px 0 0', fontSize: '11px' }}>
                Please subscribe to unlock event passes and activities.
              </p>
            </div>
            <button type="button" onClick={() => onNavigate('student-membership')} style={{ background: '#ef4444', color: '#fff' }}>
              SUBSCRIBE NOW →
            </button>
          </div>
        )}

        <div className="event-detail-hero" style={{ marginTop: '16px' }}>
          <div className="event-detail-main">
            <div className="event-detail-banner">
              {event.photoUrl ? (
                <img src={event.photoUrl} alt={event.title} />
              ) : (
                <div className="event-banner-fallback" style={{ height: '100%' }}>
                  <strong>{event.eventType.toUpperCase()}</strong>
                </div>
              )}
            </div>

            <div className="event-info-box">
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="badge badge-president">{event.eventType}</span>
                {event.isTeamEvent ? (
                  <span className="badge" style={{ background: 'var(--brand-badge-bg)', color: 'var(--brand-badge-color)' }}>
                    TEAM EVENT ({event.minTeamSize} - {event.maxTeamSize} Members)
                  </span>
                ) : (
                  <span className="badge" style={{ background: 'var(--panel-subtle)', color: 'var(--text-muted)' }}>
                    INDIVIDUAL ENTRY
                  </span>
                )}
                {event.requiresPayment ? (
                  <span className="badge" style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#fef08a', border: '1px solid #eab30866' }}>
                    PAID · ₹{event.paymentAmount}
                  </span>
                ) : (
                  <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#6ee7b7', border: '1px solid #10b98166' }}>
                    FREE ENTRY
                  </span>
                )}
              </div>

              <h1 style={{ font: '700 clamp(24px, 3vw, 36px) Syne', color: 'var(--text-main)', margin: '14px 0 8px' }}>{event.title}</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.7' }}>{event.description || event.shortDescription}</p>

              {event.teamRules && (
                <div style={{ marginTop: '20px', padding: '14px', borderRadius: '8px', background: 'var(--panel-subtle)', border: '1px solid var(--line)' }}>
                  <b style={{ color: 'var(--brand-primary)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <IconShieldCheck size={14} /> TEAM COMPOSITION & GUIDELINES:
                  </b>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-main)', lineHeight: '1.5' }}>
                    {event.teamRules}
                  </p>
                </div>
              )}

              {event.agenda && (
                <div style={{ marginTop: '24px' }}>
                  <b style={{ color: 'var(--brand-primary)', fontSize: '13px' }}>AGENDA & SCHEDULE</b>
                  <pre style={{ color: 'var(--text-main)', font: '12px Manrope', whiteSpace: 'pre-wrap', marginTop: '8px', padding: '14px', background: 'var(--bg-input)', borderRadius: '8px', border: '1px solid var(--line)' }}>{event.agenda}</pre>
                </div>
              )}

              {event.rules && (
                <div style={{ marginTop: '24px' }}>
                  <b style={{ color: 'var(--brand-primary)', fontSize: '13px' }}>RULES & ETHICS</b>
                  <pre style={{ color: 'var(--text-main)', font: '12px Manrope', whiteSpace: 'pre-wrap', marginTop: '8px', padding: '14px', background: 'var(--bg-input)', borderRadius: '8px', border: '1px solid var(--line)' }}>{event.rules}</pre>
                </div>
              )}
            </div>
          </div>

          {/* Registration Form & Team Squad Sidebar */}
          <div>
            <article className="account-form-card" style={{ position: 'sticky', top: '20px' }}>
              <p className="eyebrow">REGISTRATION & PASS</p>
              <h2>{event.isRegistered ? 'Registration Confirmed' : 'Reserve Your Slot'}</h2>

              <div style={{ margin: '14px 0', padding: '12px', background: 'var(--panel-subtle)', borderRadius: '8px', border: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  <span>Date:</span>
                  <b style={{ color: 'var(--text-main)' }}>{new Date(event.dateTime).toLocaleDateString()}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  <span>Venue:</span>
                  <b style={{ color: 'var(--text-main)' }}>{event.venue || event.location || 'Campus'}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#829bb0' }}>
                  <span>Coordinator:</span>
                  <b style={{ color: '#85d7ff' }}>{event.coordinatorName || 'Club Leadership'}</b>
                </div>
              </div>

              {event.isRegistered ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  {event.paymentStatus === 'SUBMITTED' ? (
                    <span className="badge" style={{ fontSize: '12px', padding: '6px 14px', background: '#78350f', color: '#fef08a', border: '1px solid #eab308' }}>
                      PENDING VERIFICATION (UTR SUBMITTED)
                    </span>
                  ) : (
                    <span className="badge badge-registered" style={{ fontSize: '12px', padding: '6px 14px' }}>
                      PASS ACTIVE & VERIFIED
                    </span>
                  )}
                  <p style={{ color: '#829bb0', fontSize: '12px', marginTop: '10px' }}>
                    {event.userRegistration?.teamName ? `Team: ${event.userRegistration.teamName} · ` : ''}
                    Your digital pass QR is available in your Pass Wallet.
                  </p>
                  <button className="outline" type="button" onClick={() => onNavigate('student-registrations')} style={{ marginTop: '12px' }}>
                    VIEW MY PASSES →
                  </button>
                </div>
              ) : (
                <div>
                  {/* Pending Team Invitations for this event */}
                  {pendingInvites.length > 0 && !userTeam && (
                    <div style={{ background: 'var(--brand-glow)', border: '1px solid var(--brand-primary)', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
                      <b style={{ color: 'var(--brand-primary)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <IconSparkles size={14} /> PENDING TEAM INVITATION
                      </b>
                      {pendingInvites.map(inv => (
                        <div key={inv.inviteId} style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-main)' }}>
                          <p style={{ margin: '0 0 8px' }}>
                            <b>{inv.leaderName}</b> ({inv.leaderMemberId}) invited you to join <b>"{inv.teamName}"</b>.
                          </p>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              type="button"
                              className="primary"
                              disabled={respondingInviteId === inv.inviteId}
                              onClick={() => handleRespondInvite(inv.inviteId, true)}
                              style={{ padding: '6px 12px', fontSize: '11px', flex: 1 }}
                            >
                              ACCEPT
                            </button>
                            <button
                              type="button"
                              className="action-btn cancel-btn"
                              disabled={respondingInviteId === inv.inviteId}
                              onClick={() => handleRespondInvite(inv.inviteId, false)}
                              style={{ padding: '6px 12px', fontSize: '11px', flex: 1 }}
                            >
                              DECLINE
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Team Participation Flow */}
                  {event.isTeamEvent && (
                    <div style={{ background: 'var(--panel-subtle)', border: '1px solid var(--line)', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
                      <b style={{ color: 'var(--brand-primary)', fontSize: '12px', display: 'block', marginBottom: '8px' }}>
                        TEAM FORMATION ({event.minTeamSize} - {event.maxTeamSize} MEMBERS)
                      </b>

                      {userTeam ? (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                              Team: {userTeam.teamName}
                            </span>
                            <span className="badge" style={{ fontSize: '10px', background: isLeader ? 'var(--brand-badge-bg)' : 'var(--panel-elevated)', color: isLeader ? 'var(--brand-primary)' : 'var(--text-muted)' }}>
                              {isLeader ? 'LEADER' : 'MEMBER'}
                            </span>
                          </div>

                          {/* Member List */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', margin: '10px 0' }}>
                            {userTeam.members.map(m => (
                              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'var(--bg-input)', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '11px' }}>
                                <div>
                                  <b style={{ color: 'var(--text-main)' }}>{m.name}</b>
                                  <small style={{ color: 'var(--text-muted)', display: 'block' }}>
                                    {m.memberId} {m.gender ? `· ${m.gender}` : ''}
                                  </small>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span className="badge" style={{
                                    fontSize: '9px',
                                    background: m.status === 'ACCEPTED' ? '#064e3b' : m.status === 'REJECTED' ? '#7f1d1d' : '#78350f',
                                    color: m.status === 'ACCEPTED' ? '#6ee7b7' : m.status === 'REJECTED' ? '#fca5a5' : '#fde68a',
                                  }}>
                                    {m.status}
                                  </span>
                                  {isLeader && m.userId !== user.id && (
                                    <button type="button" onClick={() => handleRemoveTeamMember(userTeam.id, m.userId)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px' }} title="Remove member">
                                      ✕
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Team Rules Live Checklist */}
                          <div style={{ padding: '8px 10px', background: 'var(--bg-card)', borderRadius: '6px', fontSize: '11px', margin: '10px 0' }}>
                            <div style={{ color: satisfiesMinTeam ? '#10b981' : '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{satisfiesMinTeam ? '✓' : '○'}</span>
                              <span>Minimum {event.minTeamSize} accepted members: <b>{acceptedMembersCount} / {event.minTeamSize}</b></span>
                            </div>
                            {ruleRequiresFemale && (
                              <div style={{ color: hasFemaleMember ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                <span>{hasFemaleMember ? '✓' : '○'}</span>
                                <span>Gender Rule: {hasFemaleMember ? 'Female participant included' : 'Requires at least 1 female team member'}</span>
                              </div>
                            )}
                          </div>

                          {!isLeader && (
                            <p style={{ margin: '8px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                              Your team leader ({userTeam.members.find(m => m.userId === userTeam.leaderId)?.name || 'Leader'}) will submit the final registration pass.
                            </p>
                          )}
                        </div>
                      ) : (
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                            Team Name *
                          </label>
                          <input
                            placeholder="e.g. CyberVanguard"
                            value={teamNameInput}
                            onChange={e => setTeamNameInput(e.target.value)}
                            style={{ width: '100%', height: '36px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', padding: '0 10px', fontSize: '12px' }}
                          />

                          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', margin: '10px 0 4px' }}>
                            Invite Team Members by Member ID
                          </label>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <input
                              placeholder="e.g. CSC2026M02 or Roll No"
                              value={memberLookupInput}
                              onChange={e => setMemberLookupInput(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleLookupMember() } }}
                              style={{ flex: 1, height: '36px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', padding: '0 10px', fontSize: '12px' }}
                            />
                            <button
                              type="button"
                              className="outline"
                              onClick={handleLookupMember}
                              disabled={lookupLoading}
                              style={{ height: '36px', padding: '0 12px', fontSize: '11px' }}
                            >
                              {lookupLoading ? '...' : '＋ ADD'}
                            </button>
                          </div>
                          {lookupError && <small style={{ color: '#fca5a5', display: 'block', marginTop: '4px', fontSize: '11px' }}>{lookupError}</small>}

                          {draftMembers.length > 0 && (
                            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <b style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Members to Invite:</b>
                              {draftMembers.map(m => (
                                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--bg-input)', borderRadius: '6px', fontSize: '11px' }}>
                                  <span><b>{m.name}</b> ({m.memberId}) · {m.gender}</span>
                                  <button type="button" onClick={() => removeDraftMember(m.id)} style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer' }}>✕</button>
                                </div>
                              ))}
                            </div>
                          )}

                          <button
                            type="button"
                            className="primary"
                            disabled={teamSubmitting || !teamNameInput.trim()}
                            onClick={handleCreateTeam}
                            style={{ width: '100%', height: '36px', marginTop: '12px', fontSize: '11px' }}
                          >
                            {teamSubmitting ? 'CREATING SQUAD…' : 'CREATE TEAM & SEND INVITES'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Main Event Registration Form */}
                  <form onSubmit={handleRegister}>
                    {/* Mandatory Demographic & Logistics Section */}
                    <div style={{ background: 'var(--panel-subtle)', border: '1px solid var(--line)', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
                      <b style={{ color: 'var(--brand-primary)', fontSize: '12px', display: 'block', marginBottom: '10px' }}>
                        ATTENDEE LOGISTICS & DETAILS
                      </b>

                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px', marginBottom: '12px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Gender *</label>
                          <select
                            value={gender}
                            onChange={e => setGender(e.target.value)}
                            className="member-select"
                            style={{ width: '100%', height: '36px', marginTop: 0 }}
                          >
                            <option value="MALE">Male</option>
                            <option value="FEMALE">Female</option>
                            <option value="OTHER">Other</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Age *</label>
                          <input
                            type="number"
                            min="15"
                            max="60"
                            required
                            value={age}
                            onChange={e => setAge(e.target.value)}
                            style={{ width: '100%', height: '36px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', padding: '0 10px', fontSize: '12px' }}
                          />
                        </div>
                      </div>

                      {/* Residency Selector */}
                      <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                        Residency Type *
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                        <button
                          type="button"
                          onClick={() => setResidencyType('DAY_SCHOLAR')}
                          style={{
                            padding: '8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            border: residencyType === 'DAY_SCHOLAR' ? '1px solid var(--brand-primary)' : '1px solid var(--line)',
                            background: residencyType === 'DAY_SCHOLAR' ? 'var(--brand-glow)' : 'var(--bg-input)',
                            color: residencyType === 'DAY_SCHOLAR' ? 'var(--brand-primary)' : 'var(--text-muted)',
                          }}
                        >
                          Day Scholar
                        </button>
                        <button
                          type="button"
                          onClick={() => setResidencyType('HOSTELLER')}
                          style={{
                            padding: '8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            border: residencyType === 'HOSTELLER' ? '1px solid var(--brand-primary)' : '1px solid var(--line)',
                            background: residencyType === 'HOSTELLER' ? 'var(--brand-glow)' : 'var(--bg-input)',
                            color: residencyType === 'HOSTELLER' ? 'var(--brand-primary)' : 'var(--text-muted)',
                          }}
                        >
                          Hosteller
                        </button>
                      </div>

                      {/* If Day Scholar: Commute mode */}
                      {residencyType === 'DAY_SCHOLAR' && (
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                            Daily Commute Mode *
                          </label>
                          <select
                            value={transportMode}
                            onChange={e => setTransportMode(e.target.value)}
                            className="member-select"
                            style={{ width: '100%', height: '36px', marginTop: 0 }}
                          >
                            <option value="COLLEGE_BUS">College Bus</option>
                            <option value="PUBLIC_BUS">Public Bus / RTC</option>
                            <option value="OWN_TRANSPORT">Own Transport / Personal Vehicle</option>
                          </select>
                        </div>
                      )}

                      {/* If Hosteller: Hostel type */}
                      {residencyType === 'HOSTELLER' && (
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                            Hostel Accommodation *
                          </label>
                          <select
                            value={hostelType}
                            onChange={e => setHostelType(e.target.value)}
                            className="member-select"
                            style={{ width: '100%', height: '36px', marginTop: 0 }}
                          >
                            <option value="COLLEGE_HOSTEL">College Campus Hostel</option>
                            <option value="PRIVATE_HOSTEL">Private Hostel / PG</option>
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Multi-Track Sub-Activities */}
                    {event.activities && event.activities.length > 0 && (
                      <div style={{ margin: '14px 0' }}>
                        <b style={{ color: 'var(--brand-primary)', fontSize: '12px' }}>Select Optional Track:</b>
                        <div className="activity-selector-list" style={{ marginTop: '8px' }}>
                          {event.activities.map(act => (
                            <div
                              key={act.id}
                              className={`activity-option ${selectedActivities.includes(act.id) ? 'selected' : ''}`}
                              onClick={() => toggleActivity(act.id)}
                            >
                              <div>
                                <b>{act.name}</b>
                                {act.description && <small style={{ display: 'block', color: '#7e95a7' }}>{act.description}</small>}
                              </div>
                              <span className="activity-price">{act.price > 0 ? `₹${act.price}` : 'INCLUDED'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Paid Event Payment Gateway */}
                    {event.requiresPayment && (
                      <div style={{ background: 'var(--panel-subtle)', border: '1px solid var(--line)', borderRadius: '10px', padding: '14px', margin: '16px 0' }}>
                        <div className="total-price-badge">
                          <span>Total Registration Fee:</span>
                          <span>₹{totalPrice.toFixed(2)}</span>
                        </div>

                        {event.paymentQrUrl && (
                          <div style={{ textAlign: 'center', margin: '14px 0' }}>
                            <img src={event.paymentQrUrl} alt="Payment QR" style={{ maxWidth: '140px', borderRadius: '8px', border: '1px solid var(--line)', background: '#fff', padding: '6px' }} />
                            {event.paymentUpiId && (
                              <p style={{ margin: '6px 0 0', color: 'var(--brand-primary)', fontSize: '12px', fontWeight: 600 }}>
                                UPI ID: {event.paymentUpiId}
                              </p>
                            )}
                          </div>
                        )}

                        <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                          12-Digit UPI Reference / UTR Number *
                        </label>
                        <input
                          required
                          value={paymentReference}
                          onChange={e => setPaymentReference(e.target.value)}
                          placeholder="e.g. 523412984512 (from PhonePe / GPay / Paytm)"
                          style={{ width: '100%', height: '38px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', padding: '0 10px', fontSize: '12px' }}
                        />
                        <small style={{ display: 'block', marginTop: '4px', color: 'var(--text-muted)', fontSize: '10px' }}>
                          Payment reference will be verified by the club coordinators.
                        </small>
                      </div>
                    )}

                    <button
                      className="primary"
                      type="submit"
                      disabled={submitting || (event.isTeamEvent && !isLeader)}
                      style={{ width: '100%', minHeight: '44px', marginTop: '12px', fontSize: '12px', fontWeight: 700 }}
                    >
                      {submitting ? 'CONFIRMING PASS…' : event.isTeamEvent ? 'CONFIRM & ISSUE TEAM PASSES' : 'CONFIRM REGISTRATION & GET PASS'}
                    </button>
                  </form>
                </div>
              )}
            </article>
          </div>
        </div>
      </section>
    </LivePortal>
  )
}
