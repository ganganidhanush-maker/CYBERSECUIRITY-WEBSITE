import React, { useEffect, useState } from 'react'
import {
  Icon8,
  IconCreditCard,
  IconDownload,
  IconQrCode,
  IconSparkles,
} from '../../components/icons'
import { LivePortal } from '../../components/layout/LivePortal'
import { adminApi, readImageFile } from '../../lib/api'
import { downloadCsv } from '../../lib/export-csv'

const initialEventForm = {
  title: '',
  eventType: 'Workshop',
  status: 'UPCOMING',
  dateTime: '',
  venue: '',
  location: '',
  shortDescription: '',
  description: '',
  agenda: '',
  rules: '',
  capacity: '',
  coordinatorName: '',
  coordinatorContact: '',
  organizingTeam: '',
  isTeamEvent: false,
  minTeamSize: 2,
  maxTeamSize: 4,
  teamRules: '',
  isPaid: false,
  paymentAmount: '',
  paymentUpiId: '',
  paymentInstructions: '',
  hasMultipleActivities: false,
}

export function EventManagement({ user, logout, onNavigate }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('basic')
  // View Mode: 'CATALOG' (Published Events Catalog) vs 'BUILDER' (Create / Edit Studio)
  const [eventView, setEventView] = useState('CATALOG')

  const [formData, setFormData] = useState(initialEventForm)
  const [activities, setActivities] = useState([])
  const [formFields, setFormFields] = useState([])
  const [posterPreview, setPosterPreview] = useState('')
  const [qrPreview, setQrPreview] = useState('')

  const [editingEventId, setEditingEventId] = useState(null)
  const [analyticsModalEvent, setAnalyticsModalEvent] = useState(null)
  const [analyticsData, setAnalyticsData] = useState(null)
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)
  const [rosterSearch, setRosterSearch] = useState('')
  const [selectedRosterPass, setSelectedRosterPass] = useState(null)

  useEffect(() => {
    let mounted = true
    adminApi.listEvents()
      .then(({ events: list }) => { if (mounted) setEvents(list || []) })
      .catch(err => { if (mounted) setError(err.message) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  function updateFormField(field, value) {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  function addActivity() {
    setActivities(c => [...c, { name: '', description: '', price: 0, capacity: '' }])
  }
  function updateActivity(index, field, value) {
    setActivities(c => c.map((act, i) => (i === index ? { ...act, [field]: value } : act)))
  }
  function removeActivity(index) {
    setActivities(c => c.filter((_, i) => i !== index))
  }

  function addCustomField() {
    setFormFields(c => [...c, { fieldName: '', fieldType: 'text', isRequired: false, options: '' }])
  }
  function updateCustomField(index, field, value) {
    setFormFields(c => c.map((ff, i) => (i === index ? { ...ff, [field]: value } : ff)))
  }
  function removeCustomField(index) {
    setFormFields(c => c.filter((_, i) => i !== index))
  }

  function startEditEvent(ev) {
    setEditingEventId(ev.id)
    setFormData({
      title: ev.title || '',
      eventType: ev.eventType || 'Workshop',
      status: ev.status || 'UPCOMING',
      dateTime: ev.dateTime ? new Date(ev.dateTime).toISOString().slice(0, 16) : '',
      venue: ev.venue || '',
      location: ev.location || '',
      shortDescription: ev.shortDescription || '',
      description: ev.description || '',
      agenda: ev.agenda || '',
      rules: ev.rules || '',
      capacity: ev.capacity != null ? String(ev.capacity) : '',
      coordinatorName: ev.coordinatorName || '',
      coordinatorContact: ev.coordinatorContact || '',
      organizingTeam: ev.organizingTeam || '',
      isTeamEvent: Boolean(ev.isTeamEvent),
      minTeamSize: ev.minTeamSize || 2,
      maxTeamSize: ev.maxTeamSize || 4,
      teamRules: ev.teamRules || '',
      isPaid: Boolean(ev.requiresPayment || (ev.paymentAmount && ev.paymentAmount > 0)),
      paymentAmount: ev.paymentAmount != null ? String(ev.paymentAmount) : '',
      paymentUpiId: ev.paymentUpiId || '',
      paymentInstructions: ev.paymentInstructions || '',
      hasMultipleActivities: Boolean(ev.allowMultipleActivities),
    })
    setPosterPreview(ev.photoUrl || '')
    setQrPreview(ev.paymentQrUrl || '')
    setActivities(ev.activities ? ev.activities.map(a => ({ name: a.name || '', description: a.description || '', price: a.price || 0, capacity: a.capacity != null ? String(a.capacity) : '' })) : [])
    setFormFields(ev.formFields || [])
    setActiveTab('basic')
    setMessage('')
    setError('')
    setEventView('BUILDER')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingEventId(null)
    setFormData(initialEventForm)
    setPosterPreview('')
    setQrPreview('')
    setActivities([])
    setFormFields([])
    setActiveTab('basic')
    setMessage('')
    setError('')
    setEventView('CATALOG')
  }

  async function handleEventSubmit(e) {
    e.preventDefault()
    setMessage('')
    setError('')

    const title = String(formData.title || '').trim()
    const eventType = String(formData.eventType || '').trim()
    const dateTime = String(formData.dateTime || '').trim()

    if (!title) {
      setActiveTab('basic')
      setError('Event Title is required (under Basic Info).')
      return
    }
    if (!eventType) {
      setActiveTab('basic')
      setError('Event Category / Type is required (under Basic Info).')
      return
    }
    if (!dateTime) {
      setActiveTab('basic')
      setError('Event Date & Time is required (under Basic Info).')
      return
    }

    if (formData.isPaid && !formData.paymentAmount && !activities.length) {
      setActiveTab('pricing')
      setError('Please specify the registration fee for this paid event.')
      return
    }

    const payload = {
      title,
      eventType,
      dateTime,
      shortDescription: String(formData.shortDescription || '').trim() || null,
      description: String(formData.description || '').trim() || null,
      venue: String(formData.venue || '').trim() || null,
      location: String(formData.location || '').trim() || null,
      capacity: formData.capacity ? Number(formData.capacity) : null,
      photoUrl: posterPreview || null,
      status: String(formData.status || 'UPCOMING'),
      coordinatorName: String(formData.coordinatorName || user.name).trim() || null,
      coordinatorContact: String(formData.coordinatorContact || user.memberId).trim() || null,
      organizingTeam: String(formData.organizingTeam || '').trim() || null,
      rules: String(formData.rules || '').trim() || null,
      agenda: String(formData.agenda || '').trim() || null,
      isTeamEvent: Boolean(formData.isTeamEvent),
      minTeamSize: formData.isTeamEvent ? Number(formData.minTeamSize || 2) : 1,
      maxTeamSize: formData.isTeamEvent ? Number(formData.maxTeamSize || 4) : 1,
      teamRules: formData.isTeamEvent ? String(formData.teamRules || '').trim() || null : null,
      requiresPayment: Boolean(formData.isPaid),
      paymentAmount: formData.isPaid && formData.paymentAmount ? Number(formData.paymentAmount) : null,
      paymentQrUrl: formData.isPaid ? qrPreview || null : null,
      paymentUpiId: formData.isPaid ? String(formData.paymentUpiId || '').trim() || null : null,
      paymentInstructions: formData.isPaid ? String(formData.paymentInstructions || '').trim() || null : null,
      allowMultipleActivities: Boolean(formData.hasMultipleActivities),
      activities: formData.hasMultipleActivities
        ? activities.map(a => ({ name: a.name, description: a.description || null, price: Number(a.price || 0), capacity: a.capacity ? Number(a.capacity) : null }))
        : [],
      formFields,
    }

    setSubmitting(true)
    try {
      if (editingEventId) {
        const { event: updated } = await adminApi.updateEvent(editingEventId, payload)
        setEvents(c => c.map(ev => (ev.id === editingEventId ? updated : ev)))
        setMessage(`Event "${updated.title}" updated successfully.`)
        cancelEdit()
      } else {
        const { event: created } = await adminApi.createEvent(payload)
        setEvents(c => [created, ...c])
        setMessage(`Event "${created.title}" published! Created by ${user.name} (${user.memberId}).`)
        setFormData(initialEventForm)
        setPosterPreview('')
        setQrPreview('')
        setActivities([])
        setFormFields([])
        setActiveTab('basic')
        setEventView('CATALOG')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function removeEvent(id) {
    if (!confirm('Are you sure you want to delete this event and all its registrations?')) return
    try {
      await adminApi.deleteEvent(id)
      setEvents(c => c.filter(e => e.id !== id))
      if (editingEventId === id) cancelEdit()
      setMessage('Event deleted.')
    } catch (err) {
      setError(err.message)
    }
  }

  async function openAnalytics(event) {
    setAnalyticsModalEvent(event)
    setRosterSearch('')
    setSelectedRosterPass(null)
    setLoadingAnalytics(true)
    try {
      const data = await adminApi.getEventDetailsWithStats(event.id)
      setAnalyticsData(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingAnalytics(false)
    }
  }

  async function handleVerifyRosterUTR(regId) {
    try {
      await adminApi.verifyPassPayment(regId)
      setAnalyticsData(prev => {
        if (!prev) return prev
        return {
          ...prev,
          registrations: (prev.registrations || []).map(r => (r.id === regId ? { ...r, paymentStatus: 'VERIFIED', status: 'REGISTERED' } : r)),
        }
      })
      if (selectedRosterPass && selectedRosterPass.id === regId) {
        setSelectedRosterPass(p => ({ ...p, paymentStatus: 'VERIFIED', status: 'REGISTERED' }))
      }
      setMessage('Payment verified successfully! Digital pass activated.')
    } catch (err) {
      setError(err.message || 'Failed to verify payment.')
    }
  }

  async function handleCheckInRoster(regId) {
    try {
      await adminApi.grantEventEntry(regId)
      const nowIso = new Date().toISOString()
      setAnalyticsData(prev => {
        if (!prev) return prev
        return {
          ...prev,
          registrations: (prev.registrations || []).map(r => (r.id === regId ? { ...r, attendanceMarked: true, attendedAt: nowIso } : r)),
        }
      })
      if (selectedRosterPass && selectedRosterPass.id === regId) {
        setSelectedRosterPass(p => ({ ...p, attendanceMarked: true, attendedAt: nowIso }))
      }
      setMessage('Attendee admitted and gate attendance recorded!')
    } catch (err) {
      setError(err.message || 'Failed to mark gate entry.')
    }
  }

  function handleDownloadEventsList() {
    const headers = [
      'Event ID',
      'Event Title',
      'Category',
      'Mode',
      'Min Team',
      'Max Team',
      'Status',
      'Date & Time',
      'Venue / Lab',
      'Capacity',
      'Registered Count',
      'Coordinator Name',
      'Price (₹)',
      'Short Description',
    ]
    const rows = events.map(ev => [
      ev.id,
      ev.title,
      ev.eventType,
      ev.isTeamEvent ? 'Team' : 'Individual',
      ev.minTeamSize || 1,
      ev.maxTeamSize || 1,
      ev.status,
      ev.dateTime ? new Date(ev.dateTime).toLocaleString() : null,
      ev.venue || ev.location,
      ev.capacity,
      ev.registrationCount ?? ev._count?.registrations ?? 0,
      ev.coordinatorName,
      ev.paymentAmount || ev.price || 0,
      ev.shortDescription,
    ])
    downloadCsv('club_events_catalog.csv', headers, rows)
  }

  function handleDownloadEventRegistrations(ev, regs) {
    const headers = [
      'Registration ID',
      'Event Title',
      'Member ID',
      'Full Name',
      'College / Institution',
      'Department / Branch',
      'Academic Year',
      'College Roll Number',
      'Gender',
      'Age',
      'Official Email',
      'Phone Number',
      'Emergency Contact',
      'Residency Type',
      'Commute / Hostel Mode',
      'Participation Mode',
      'Team Name',
      'Is Team Leader',
      'Registration Fee (₹)',
      'Payment Status',
      'Payment UTR Reference',
      'Gate Attendance',
      'Check-in Timestamp',
      'Registration Date',
    ]
    const rows = (regs || []).map(r => [
      r.id,
      ev?.title,
      r.memberId || r.user?.memberId,
      r.name || r.memberName || r.user?.profile?.name || r.user?.name,
      r.department || r.user?.profile?.department,
      r.branch || r.department || r.user?.profile?.department,
      r.year || r.user?.profile?.year,
      r.rollNumber || r.user?.profile?.rollNumber || r.formData?.rollNumber,
      r.gender || r.user?.profile?.gender || 'UNSPECIFIED',
      r.age || r.user?.profile?.age || null,
      r.email || r.user?.profile?.email,
      r.phone || r.user?.profile?.phone,
      r.emergencyContact,
      r.residencyType || 'DAY_SCHOLAR',
      r.residencyType === 'HOSTELLER' ? (r.hostelType || 'COLLEGE_HOSTEL') : (r.transportMode || 'OWN_TRANSPORT'),
      r.teamName ? 'Team' : 'Individual',
      r.teamName || 'N/A',
      r.isTeamLeader ? 'Yes' : 'No',
      Number(r.totalAmount) || 0,
      r.paymentStatus,
      r.paymentReference || 'N/A',
      r.attendanceMarked ? 'Admitted / Present' : 'Not Admitted',
      r.attendedAt ? new Date(r.attendedAt).toLocaleString() : 'N/A',
      r.registeredAt ? new Date(r.registeredAt).toLocaleString() : null,
    ])
    downloadCsv(`event_${ev.id}_registrations.csv`, headers, rows)
  }

  return (
    <LivePortal user={user} logout={logout} activeTab="admin-events" onNavigate={onNavigate} title="EVENT STUDIO & ANALYTICS">
      <section className="event-management">
        <div className="event-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('admin-dashboard')}>
              ← COMMAND CENTER
            </button>
            <p className="eyebrow">COMPREHENSIVE WORKFLOW STUDIO</p>
            <h1>Club Events & Master Studio</h1>
            <p>Publish workshops, CTF competitions, seminars, and team hackathons with clean pricing & pass tracking.</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="primary"
              onClick={() => onNavigate('admin-passes')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '6px 14px' }}
              title="View all registered student passes and UTR records"
            >
              <IconCreditCard size={16} /> PASSES & CHECK-IN ROSTER
            </button>
            <button
              type="button"
              className="outline"
              onClick={() => onNavigate('admin-qr-scanner')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '6px 14px' }}
              title="Scan attendee event passes and verify tickets"
            >
              <Icon8 name="irisScan" size={16} /> SCAN AT ENTRY GATE
            </button>
            <button
              type="button"
              className="outline"
              onClick={handleDownloadEventsList}
              disabled={events.length === 0}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '6px 12px' }}
              title="Download events catalog as CSV"
            >
              <IconDownload size={14} /> DOWNLOAD EVENTS CSV
            </button>
          </div>
        </div>

        {message && <p className="member-form-success">{message}</p>}
        {error && <p className="member-form-error">{error}</p>}

        <div className="event-view-switcher" style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={eventView === 'CATALOG' ? 'primary' : 'outline'}
            onClick={() => setEventView('CATALOG')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '8px 18px', fontWeight: 700 }}
          >
            <IconSparkles size={14} /> PUBLISHED EVENTS CATALOG ({events.length})
          </button>
          <button
            type="button"
            className={eventView === 'BUILDER' ? 'primary' : 'outline'}
            onClick={() => {
              if (!editingEventId) setFormData(initialEventForm)
              setEventView('BUILDER')
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '8px 18px', fontWeight: 700 }}
          >
            <Icon8 name="customForms" size={14} /> {editingEventId ? 'EDITING EVENT' : '＋ CREATE & PUBLISH EVENT'}
          </button>
        </div>

        {eventView === 'BUILDER' ? (
          /* Full-Width Event Builder Studio Card */
          <article className="account-form-card" style={{ maxWidth: '960px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <p className="eyebrow">{editingEventId ? 'EDITING EVENT' : 'EVENT BUILDER STUDIO'}</p>
                <h2>{editingEventId ? 'Update Event Details' : 'Create & Publish New Event'}</h2>
              </div>
              <button
                type="button"
                className="outline"
                onClick={cancelEdit}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}
              >
                ← BACK TO EVENTS CATALOG
              </button>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '0 0 16px' }}>
              Coordinator: <b style={{ color: 'var(--brand-primary)' }}>{user.name} ({user.memberId})</b>
            </p>

            <div className="audit-tabs" style={{ marginBottom: '20px' }}>
              <button type="button" className={`audit-tab-btn ${activeTab === 'basic' ? 'active' : ''}`} onClick={() => setActiveTab('basic')}>1. Basic & Schedule</button>
              <button type="button" className={`audit-tab-btn ${activeTab === 'teams' ? 'active' : ''}`} onClick={() => setActiveTab('teams')}>2. Participation & Teams</button>
              <button type="button" className={`audit-tab-btn ${activeTab === 'pricing' ? 'active' : ''}`} onClick={() => setActiveTab('pricing')}>3. Pricing & UPI</button>
              <button type="button" className={`audit-tab-btn ${activeTab === 'fields' ? 'active' : ''}`} onClick={() => setActiveTab('fields')}>4. Custom Fields</button>
            </div>

            <form onSubmit={handleEventSubmit}>
              {/* Tab 1: Basic Info & Schedule */}
              {activeTab === 'basic' && (
                <div className="member-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                  <label className="form-wide" style={{ gridColumn: '1 / -1' }}>
                    Event Title *
                    <input
                      name="title"
                      required
                      placeholder="e.g. Offensive Cyber Operations Workshop 2026"
                      value={formData.title}
                      onChange={e => updateFormField('title', e.target.value)}
                    />
                  </label>
                  <label>
                    Category / Type *
                    <select
                      className="member-select"
                      name="eventType"
                      value={formData.eventType}
                      onChange={e => updateFormField('eventType', e.target.value)}
                    >
                      <option value="Workshop">Hands-on Workshop</option>
                      <option value="CTF">CTF Competition</option>
                      <option value="Seminar">Guest Seminar</option>
                      <option value="Bootcamp">Security Bootcamp</option>
                      <option value="Hackathon">Cyber Hackathon</option>
                      <option value="Summit">Security Summit</option>
                      <option value="Cultural">Cultural / Campus Event</option>
                    </select>
                  </label>
                  <label>
                    Status
                    <select
                      className="member-select"
                      name="status"
                      value={formData.status}
                      onChange={e => updateFormField('status', e.target.value)}
                    >
                      <option value="UPCOMING">Upcoming</option>
                      <option value="LIVE">Live Now</option>
                      <option value="COMPLETED">Completed</option>
                    </select>
                  </label>
                  <label>
                    Date & Time *
                    <input
                      type="datetime-local"
                      name="dateTime"
                      required
                      value={formData.dateTime}
                      onChange={e => updateFormField('dateTime', e.target.value)}
                    />
                  </label>
                  <label>
                    Venue / Campus Location
                    <input
                      name="venue"
                      placeholder="e.g. Cyber Defense Lab 304 / Main Auditorium"
                      value={formData.venue}
                      onChange={e => updateFormField('venue', e.target.value)}
                    />
                  </label>
                  <label>
                    Max Seat Capacity (Optional)
                    <input
                      type="number"
                      name="capacity"
                      min="1"
                      placeholder="Leave blank for unlimited"
                      value={formData.capacity}
                      onChange={e => updateFormField('capacity', e.target.value)}
                    />
                  </label>
                  <label className="form-wide" style={{ gridColumn: '1 / -1' }}>
                    Short Synopsis (Catalog Banner)
                    <input
                      name="shortDescription"
                      placeholder="One-line summary shown on event catalog and cards"
                      value={formData.shortDescription}
                      onChange={e => updateFormField('shortDescription', e.target.value)}
                    />
                  </label>
                  <label className="form-wide" style={{ gridColumn: '1 / -1' }}>
                    Event Poster / Banner Image (Optional)
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => { const f = e.target.files?.[0]; if (f) readImageFile(f, setPosterPreview) }}
                    />
                  </label>
                  {posterPreview && (
                    <div style={{ gridColumn: '1 / -1', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <img src={posterPreview} alt="Event Poster Preview" style={{ width: '120px', height: '68px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--brand-border-subtle)' }} />
                      <button type="button" className="action-btn cancel-btn" onClick={() => setPosterPreview('')}>Remove Poster</button>
                    </div>
                  )}
                  <label className="form-wide" style={{ gridColumn: '1 / -1' }}>
                    Detailed Event Description & Overview
                    <textarea
                      rows={4}
                      name="description"
                      placeholder="Comprehensive details, what students will learn, takeaways, and prerequisites."
                      value={formData.description}
                      onChange={e => updateFormField('description', e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)', fontSize: '12px' }}
                    />
                  </label>
                  <div className="form-wide" style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                    <button type="button" className="action-btn save-btn" onClick={() => setActiveTab('teams')}>Next: Participation & Teams →</button>
                  </div>
                </div>
              )}

              {/* Tab 2: Participation & Teams */}
              {activeTab === 'teams' && (
                <div className="member-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                  <label>
                    Participation Type
                    <select
                      className="member-select"
                      value={formData.isTeamEvent ? 'TEAM' : 'INDIVIDUAL'}
                      onChange={e => updateFormField('isTeamEvent', e.target.value === 'TEAM')}
                    >
                      <option value="INDIVIDUAL">Individual Participation</option>
                      <option value="TEAM">Team / Group Participation</option>
                    </select>
                  </label>

                  {formData.isTeamEvent && (
                    <>
                      <label>
                        Min Team Members
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={formData.minTeamSize}
                          onChange={e => updateFormField('minTeamSize', e.target.value)}
                        />
                      </label>
                      <label>
                        Max Team Members
                        <input
                          type="number"
                          min="1"
                          max="30"
                          value={formData.maxTeamSize}
                          onChange={e => updateFormField('maxTeamSize', e.target.value)}
                        />
                      </label>
                      <label className="form-wide" style={{ gridColumn: '1 / -1' }}>
                        Team Formation Rules / Guidelines
                        <textarea
                          rows={3}
                          placeholder="e.g. Cross-department teams are allowed. Team leader must submit registration for all members."
                          value={formData.teamRules}
                          onChange={e => updateFormField('teamRules', e.target.value)}
                          style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)', fontSize: '12px' }}
                        />
                      </label>
                    </>
                  )}

                  <label className="form-wide" style={{ gridColumn: '1 / -1' }}>
                    Event Agenda / Schedule Breakdown
                    <textarea
                      rows={3}
                      placeholder="e.g. 10:00 AM - Opening Keynote | 11:30 AM - Live Sandbox | 02:00 PM - Final Showdown"
                      value={formData.agenda}
                      onChange={e => updateFormField('agenda', e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)', fontSize: '12px' }}
                    />
                  </label>
                  <label className="form-wide" style={{ gridColumn: '1 / -1' }}>
                    Competition Rules / Eligibility Criteria
                    <textarea
                      rows={3}
                      placeholder="e.g. Open to all MRDU engineering and management students. Laptops required."
                      value={formData.rules}
                      onChange={e => updateFormField('rules', e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)', fontSize: '12px' }}
                    />
                  </label>
                  <div className="form-wide" style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                    <button type="button" className="action-btn cancel-btn" onClick={() => setActiveTab('basic')}>← Back</button>
                    <button type="button" className="action-btn save-btn" onClick={() => setActiveTab('pricing')}>Next: Pricing & UPI →</button>
                  </div>
                </div>
              )}

              {/* Tab 3: Pricing & UPI Gateway */}
              {activeTab === 'pricing' && (
                <div>
                  <div className="event-builder-box">
                    <div className="event-builder-box-title">
                      <IconCreditCard size={14} /> EVENT PRICING & PAYMENT GATEWAY
                    </div>
                    <div className="event-mode-grid">
                      <div
                        className={`event-mode-card ${!formData.isPaid ? 'selected selected-free' : ''}`}
                        onClick={() => updateFormField('isPaid', false)}
                      >
                        <div className="event-mode-card-header">
                          <span className="event-mode-card-icon">
                            <IconSparkles size={16} />
                          </span>
                          <div className="event-mode-radio">
                            {!formData.isPaid && <div className="event-mode-radio-dot" />}
                          </div>
                        </div>
                        <h4 className="event-mode-title">Free Event (₹0)</h4>
                        <p className="event-mode-desc">Open registration. Passes are issued immediately upon sign-up with instant QR generation.</p>
                      </div>

                      <div
                        className={`event-mode-card ${formData.isPaid ? 'selected' : ''}`}
                        onClick={() => updateFormField('isPaid', true)}
                      >
                        <div className="event-mode-card-header">
                          <span className="event-mode-card-icon">
                            <IconQrCode size={16} />
                          </span>
                          <div className="event-mode-radio">
                            {formData.isPaid && <div className="event-mode-radio-dot" />}
                          </div>
                        </div>
                        <h4 className="event-mode-title">Paid Event (UPI / Cash)</h4>
                        <p className="event-mode-desc">Requires students to submit a 12-digit UPI UTR transaction ID for admin verification before entry.</p>
                      </div>
                    </div>

                    {formData.isPaid && (
                      <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--line)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                          <label>
                            Registration Fee (₹) *
                            <input
                              type="number"
                              min="1"
                              placeholder="e.g. 150"
                              value={formData.paymentAmount}
                              onChange={e => updateFormField('paymentAmount', e.target.value)}
                            />
                          </label>
                          <label>
                            Club UPI ID for Payments
                            <input
                              placeholder="e.g. mrduclub@okaxis"
                              value={formData.paymentUpiId}
                              onChange={e => updateFormField('paymentUpiId', e.target.value)}
                            />
                          </label>
                        </div>
                        <label className="form-wide">
                          Payment Instructions
                          <input
                            placeholder="e.g. Scan QR using PhonePe/GPay, pay the fee, and enter your 12-digit UTR number below."
                            value={formData.paymentInstructions}
                            onChange={e => updateFormField('paymentInstructions', e.target.value)}
                          />
                        </label>
                      </div>
                    )}
                  </div>

                  <div className="form-wide" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                    <button type="button" className="action-btn cancel-btn" onClick={() => setActiveTab('teams')}>← Back</button>
                    <button type="button" className="action-btn save-btn" onClick={() => setActiveTab('fields')}>Next: Custom Questions →</button>
                  </div>
                </div>
              )}

              {/* Tab 4: Custom Questions */}
              {activeTab === 'fields' && (
                <div>
                  <div className="event-builder-box">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                      <div className="event-builder-box-title" style={{ margin: 0 }}>
                        <Icon8 name="customForms" size={14} /> CUSTOM REGISTRATION QUESTIONS
                      </div>
                      <button type="button" className="action-btn save-btn" onClick={addCustomField} style={{ fontSize: '11px', padding: '6px 12px' }}>
                        ＋ Add Question
                      </button>
                    </div>
                    {formFields.length === 0 ? (
                      <div style={{ padding: '24px 16px', textAlign: 'center', background: 'var(--bg-input)', borderRadius: '8px', border: '1px dashed var(--line)' }}>
                        <p style={{ color: 'var(--text-main)', fontSize: '13px', fontWeight: 600, margin: '0 0 4px' }}>Standard Student Profile Form Only</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '11.5px', margin: 0 }}>Default fields (Full Name, Member ID, Roll Number, Gender, Age, Department & College) are captured automatically. Click "Add Question" to ask custom event-specific queries.</p>
                      </div>
                    ) : (
                      formFields.map((ff, i) => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr auto auto', gap: '10px', marginBottom: '10px', alignItems: 'center', padding: '10px', background: 'var(--bg-input)', borderRadius: '8px', border: '1px solid var(--line)' }}>
                          <input placeholder="Question prompt (e.g. GitHub URL / Dietary Preference)" value={ff.fieldName} onChange={e => updateCustomField(i, 'fieldName', e.target.value)} />
                          <select value={ff.fieldType} onChange={e => updateCustomField(i, 'fieldType', e.target.value)}>
                            <option value="text">Short Text</option>
                            <option value="textarea">Long Text</option>
                            <option value="select">Dropdown Choice</option>
                          </select>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={ff.isRequired} onChange={e => updateCustomField(i, 'isRequired', e.target.checked)} /> Required
                          </label>
                          <button type="button" className="action-btn delete-btn" onClick={() => removeCustomField(i)}>✕</button>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="form-wide" style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '10px' }}>
                    <button type="button" className="action-btn cancel-btn" onClick={() => setActiveTab('pricing')}>
                      ← Back to Pricing & UPI
                    </button>
                  </div>
                </div>
              )}

              <div className="event-actions" style={{ marginTop: '22px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button type="submit" className="primary member-submit" disabled={submitting} style={{ padding: '12px 24px', fontWeight: 700 }}>
                  {submitting ? 'SAVING EVENT…' : editingEventId ? '✓ UPDATE EVENT' : '＋ PUBLISH EVENT'}
                </button>
                <button type="button" className="action-btn cancel-btn" onClick={cancelEdit}>
                  Cancel
                </button>
              </div>
            </form>
          </article>
        ) : (
          /* Full-Width Published Events Catalog Card */
          <article className="member-list-card" style={{ width: '100%' }}>
            <div className="card-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
              <div>
                <p className="eyebrow">EVENT CATALOG & PASSES</p>
                <h2>Published Events & Sessions ({events.length})</h2>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="primary"
                  onClick={() => {
                    if (!editingEventId) setFormData(initialEventForm)
                    setEventView('BUILDER')
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '6px 14px' }}
                >
                  <Icon8 name="customForms" size={14} /> ＋ CREATE NEW EVENT
                </button>
                <button
                  type="button"
                  className="outline"
                  onClick={handleDownloadEventsList}
                  disabled={events.length === 0}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '6px 12px' }}
                  title="Download events catalog as CSV"
                >
                  <IconDownload size={14} /> DOWNLOAD EVENTS CSV
                </button>
              </div>
            </div>

            {loading ? (
              <p className="directory-state" style={{ marginTop: '24px' }}>Loading events...</p>
            ) : events.length === 0 ? (
              <p className="directory-state" style={{ marginTop: '24px' }}>No events published yet. Click "Create New Event" above to publish your first session.</p>
            ) : (
              <div className="table-scroll-container" style={{ marginTop: '16px' }}>
                <div className="events-table">
                  <div className="table-header" style={{ gridTemplateColumns: '1.8fr 1.2fr 1.2fr 1fr 1.2fr', gap: '14px' }}>
                    <span>EVENT TITLE & DETAILS</span>
                    <span>SCHEDULE & TIMING</span>
                    <span>VENUE / LOCATION</span>
                    <span>PASSES & SEATS</span>
                    <span>ACTIONS</span>
                  </div>
                  {events.map(ev => (
                    <div className="table-row" key={ev.id} style={{ gridTemplateColumns: '1.8fr 1.2fr 1.2fr 1fr 1.2fr', gap: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {ev.photoUrl ? (
                          <img src={ev.photoUrl} alt={ev.title} style={{ width: '48px', height: '36px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--brand-border-subtle)', flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: '48px', height: '36px', borderRadius: '6px', background: 'var(--panel-subtle)', display: 'grid', placeItems: 'center', color: 'var(--brand-primary)', border: '1px solid var(--line)', flexShrink: 0 }}>
                            <IconSparkles size={16} />
                          </div>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <b style={{ color: 'var(--text-main)', fontSize: '13px', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.title}</b>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                            <span className="badge" style={{ background: 'var(--brand-badge-bg)', color: 'var(--brand-primary)', fontSize: '9px' }}>{ev.eventType}</span>
                            {ev.requiresPayment || (ev.paymentAmount && ev.paymentAmount > 0) ? (
                              <span className="badge badge-admin" style={{ fontSize: '9px' }}>₹{ev.paymentAmount}</span>
                            ) : (
                              <span className="badge badge-student" style={{ fontSize: '9px' }}>FREE</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-main)', fontSize: '12px', fontWeight: 600, display: 'block' }}>{new Date(ev.dateTime).toLocaleDateString()}</span>
                        <small style={{ color: 'var(--text-dim)', fontSize: '11px', display: 'block', marginTop: '2px' }}>{new Date(ev.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-main)', fontSize: '12px', display: 'block' }}>{ev.venue || ev.location || 'Campus / Online'}</span>
                        {ev.coordinatorName && (
                          <small style={{ color: 'var(--text-dim)', fontSize: '10.5px', display: 'block', marginTop: '2px' }}>Coord: {ev.coordinatorName}</small>
                        )}
                      </div>
                      <div>
                        <strong style={{ color: 'var(--brand-primary)', fontSize: '13px' }}>{ev.registrationCount ?? ev._count?.registrations ?? 0}</strong>
                        <small style={{ color: 'var(--text-dim)', fontSize: '11px' }}> / {ev.capacity || '∞'}</small>
                      </div>
                      <div className="action-buttons" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        <button className="action-btn edit-btn" onClick={() => startEditEvent(ev)} title="Edit event settings">Edit</button>
                        <button className="action-btn save-btn" onClick={() => openAnalytics(ev)} title="View attendee passes and check-in roster">Passes</button>
                        <button className="action-btn delete-btn" onClick={() => removeEvent(ev.id)} title="Delete event">Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </article>
        )}

        {/* Analytics & Passes Modal */}
        {analyticsModalEvent && (
          <div className="photo-lightbox" onClick={() => setAnalyticsModalEvent(null)}>
            <div className="photo-lightbox-content" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-modal)', padding: '24px', borderRadius: '16px', border: '1px solid var(--line)', maxWidth: '1100px', width: '96vw', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <b style={{ color: 'var(--brand-primary)', fontSize: '18px' }}>{analyticsModalEvent.title}</b>
                    <span className="badge badge-president" style={{ fontSize: '10px' }}>{analyticsModalEvent.eventType}</span>
                  </div>
                  <small style={{ display: 'block', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Comprehensive Attendee Pass Roster · {analyticsModalEvent.venue || analyticsModalEvent.location || 'Campus'}
                  </small>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="outline"
                    onClick={() => handleDownloadEventRegistrations(analyticsModalEvent, analyticsData?.registrations)}
                    disabled={!analyticsData?.registrations || analyticsData.registrations.length === 0}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '6px 12px' }}
                    title="Download complete event registrations roster as CSV"
                  >
                    <IconDownload size={13} /> DOWNLOAD ROSTER CSV
                  </button>
                  <button className="lightbox-close" onClick={() => setAnalyticsModalEvent(null)} style={{ position: 'static' }}>✕</button>
                </div>
              </div>

              {/* Stats Summary Bar */}
              {analyticsData?.stats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ background: 'var(--panel-subtle)', border: '1px solid var(--line)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                    <small style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px' }}>TOTAL REGISTERED</small>
                    <strong style={{ color: 'var(--brand-primary)', fontSize: '16px' }}>{analyticsData.stats.totalRegistrations}</strong>
                  </div>
                  <div style={{ background: 'var(--panel-subtle)', border: '1px solid var(--line)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                    <small style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px' }}>CONFIRMED / PAID</small>
                    <strong style={{ color: '#10b981', fontSize: '16px' }}>{analyticsData.stats.confirmed}</strong>
                  </div>
                  <div style={{ background: 'var(--panel-subtle)', border: '1px solid var(--line)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                    <small style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px' }}>PENDING UTR</small>
                    <strong style={{ color: '#f59e0b', fontSize: '16px' }}>{analyticsData.stats.pending}</strong>
                  </div>
                  <div style={{ background: 'var(--panel-subtle)', border: '1px solid var(--line)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                    <small style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px' }}>VERIFIED REVENUE</small>
                    <strong style={{ color: '#70ddb4', fontSize: '16px' }}>₹{analyticsData.stats.totalVerifiedRevenue}</strong>
                  </div>
                  <div style={{ background: 'var(--panel-subtle)', border: '1px solid var(--line)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                    <small style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px' }}>SEATS REMAINING</small>
                    <strong style={{ color: 'var(--text-main)', fontSize: '16px' }}>{analyticsData.stats.seatsRemaining ?? '∞'}</strong>
                  </div>
                </div>
              )}

              {/* Roster Search Bar */}
              <div style={{ marginBottom: '14px' }}>
                <input
                  placeholder="Search by student name, member ID, college, roll number, email, phone, UTR, team..."
                  value={rosterSearch}
                  onChange={e => setRosterSearch(e.target.value)}
                  style={{ width: '100%', height: '38px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)', padding: '0 12px', fontSize: '12px' }}
                />
              </div>

              {loadingAnalytics ? (
                <p className="directory-state">Loading complete registration details...</p>
              ) : !analyticsData?.registrations || analyticsData.registrations.length === 0 ? (
                <p className="directory-state">No student registrations for this event yet.</p>
              ) : (
                (() => {
                  const q = rosterSearch.trim().toLowerCase()
                  const list = (analyticsData.registrations || []).filter(r => {
                    if (!q) return true
                    return (
                      (r.name && r.name.toLowerCase().includes(q)) ||
                      (r.memberName && r.memberName.toLowerCase().includes(q)) ||
                      (r.memberId && r.memberId.toLowerCase().includes(q)) ||
                      (r.rollNumber && r.rollNumber.toLowerCase().includes(q)) ||
                      (r.department && r.department.toLowerCase().includes(q)) ||
                      (r.email && r.email.toLowerCase().includes(q)) ||
                      (r.phone && r.phone.toLowerCase().includes(q)) ||
                      (r.teamName && r.teamName.toLowerCase().includes(q)) ||
                      (r.paymentReference && r.paymentReference.toLowerCase().includes(q)) ||
                      (r.paymentStatus && r.paymentStatus.toLowerCase().includes(q))
                    )
                  })

                  if (list.length === 0) {
                    return <p className="directory-state">No attendees match your search "{rosterSearch}".</p>
                  }

                  return (
                    <div className="table-scroll-container">
                      <div className="sub-table" style={{ minWidth: '980px' }}>
                        <div className="sub-table-header" style={{ gridTemplateColumns: '1.4fr 1.2fr 1fr 1.2fr 1fr 1.1fr' }}>
                          <span>STUDENT & ACADEMICS</span>
                          <span>CONTACT & LOGISTICS</span>
                          <span>SQUAD / MODE</span>
                          <span>PAYMENT & UTR</span>
                          <span>GATE ENTRY</span>
                          <span>ACTIONS</span>
                        </div>
                        {list.map(r => (
                          <div className="sub-table-row" key={r.id} style={{ gridTemplateColumns: '1.4fr 1.2fr 1fr 1.2fr 1fr 1.1fr', alignItems: 'center' }}>
                            {/* Student Column */}
                            <div>
                              <b style={{ color: 'var(--text-main)', fontSize: '13px' }}>{r.name || r.memberName || r.user?.profile?.name || r.memberId}</b>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                                <span style={{ color: 'var(--brand-primary)', fontFamily: 'monospace', fontSize: '11px', fontWeight: 600 }}>
                                  {r.memberId || r.user?.memberId}
                                </span>
                                <span className="badge" style={{ fontSize: '9px', padding: '1px 6px', background: 'var(--panel-subtle)', color: 'var(--text-muted)' }}>
                                  {r.gender || r.user?.profile?.gender || 'MALE'} {r.age || r.user?.profile?.age ? `· ${r.age || r.user?.profile?.age}y` : ''}
                                </span>
                              </div>
                              <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '2px', lineHeight: '1.3' }}>
                                {r.department || r.user?.profile?.department || r.branch || 'CSE'} {r.year || r.user?.profile?.year ? `· Year ${r.year || r.user?.profile?.year}` : ''}
                              </small>
                              {r.rollNumber && (
                                <small style={{ color: 'var(--text-dim)', display: 'block', fontSize: '10px' }}>
                                  Roll: {r.rollNumber}
                                </small>
                              )}
                            </div>

                            {/* Contact & Logistics */}
                            <div>
                              <small style={{ color: 'var(--text-main)', display: 'block', wordBreak: 'break-all' }}>
                                {r.email || r.user?.profile?.email || 'No email'}
                              </small>
                              <small style={{ color: 'var(--brand-primary)', display: 'block', marginTop: '2px' }}>
                                {r.phone || r.user?.profile?.phone || 'No phone'}
                              </small>
                              <span className="badge" style={{ marginTop: '4px', fontSize: '9px', display: 'inline-block', background: 'var(--panel-subtle)', color: 'var(--text-muted)' }}>
                                {r.residencyType === 'HOSTELLER'
                                  ? (r.hostelType === 'PRIVATE_HOSTEL' ? 'Private PG' : 'College Hostel')
                                  : (r.transportMode === 'COLLEGE_BUS' ? 'College Bus' : r.transportMode === 'PUBLIC_BUS' ? 'Public Bus' : 'Day Scholar')}
                              </span>
                            </div>

                            {/* Squad / Mode */}
                            <div>
                              {r.teamName ? (
                                <div>
                                  <span className="badge" style={{ fontSize: '10px', background: r.isTeamLeader ? 'var(--brand-glow)' : 'var(--panel-subtle)', color: r.isTeamLeader ? 'var(--brand-primary)' : 'var(--text-main)', border: '1px solid var(--line)' }}>
                                    {r.teamName} {r.isTeamLeader ? '(Leader)' : ''}
                                  </span>
                                </div>
                              ) : (
                                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Individual</small>
                              )}
                              {Array.isArray(r.selectedActivities) && r.selectedActivities.length > 0 && (
                                <small style={{ color: '#70ddb4', display: 'block', fontSize: '10px', marginTop: '2px' }}>
                                  {r.selectedActivities.map(a => a.name).join(', ')}
                                </small>
                              )}
                            </div>

                            {/* Payment & UTR */}
                            <div>
                              <strong style={{ color: '#70ddb4', fontSize: '13px' }}>
                                {r.totalAmount > 0 ? `₹${r.totalAmount}` : 'Free Entry'}
                              </strong>
                              {r.paymentReference && (
                                <small style={{ color: 'var(--brand-primary)', display: 'block', fontFamily: 'monospace', fontSize: '10px', marginTop: '2px' }}>
                                  UTR: {r.paymentReference}
                                </small>
                              )}
                              <span className={`badge badge-${(r.paymentStatus || 'free').toLowerCase()}`} style={{ marginTop: '3px', display: 'inline-block', fontSize: '9px' }}>
                                {r.paymentStatus}
                              </span>
                            </div>

                            {/* Gate Entry */}
                            <div>
                              {r.attendanceMarked ? (
                                <div>
                                  <span className="badge" style={{ background: '#064e3b', color: '#6ee7b7', border: '1px solid #10b981', fontSize: '10px' }}>
                                    ✓ ADMITTED
                                  </span>
                                  {r.attendedAt && (
                                    <small style={{ color: 'var(--text-dim)', display: 'block', fontSize: '9px', marginTop: '2px' }}>
                                      {new Date(r.attendedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </small>
                                  )}
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="action-btn"
                                  onClick={() => handleCheckInRoster(r.id)}
                                  style={{ fontSize: '10px', padding: '4px 8px', background: 'var(--panel-subtle)', color: 'var(--text-main)', border: '1px solid var(--line)' }}
                                >
                                  Check-in
                                </button>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="action-buttons" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              {(r.paymentStatus === 'SUBMITTED' || r.paymentStatus === 'PENDING') && r.totalAmount > 0 && (
                                <button
                                  className="action-btn save-btn"
                                  onClick={() => handleVerifyRosterUTR(r.id)}
                                  style={{ fontSize: '10px', padding: '4px 8px' }}
                                >
                                  Verify UTR
                                </button>
                              )}
                              <button
                                className="action-btn"
                                onClick={() => setSelectedRosterPass(r)}
                                style={{ fontSize: '10px', padding: '4px 8px', background: 'var(--brand-glow)', color: 'var(--brand-primary)', border: '1px solid var(--line)' }}
                              >
                                Full Details
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()
              )}
            </div>
          </div>
        )}

        {/* Attendee Full Detail Card Modal */}
        {selectedRosterPass && (
          <div className="photo-lightbox" onClick={() => setSelectedRosterPass(null)}>
            <div className="photo-lightbox-content" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-modal)', padding: '28px', borderRadius: '16px', border: '1px solid var(--line)', maxWidth: '620px', width: '95vw', maxHeight: '88vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span className="badge badge-president">{selectedRosterPass.eventTitle || analyticsModalEvent?.title || 'ATTENDEE PASS'}</span>
                <button className="lightbox-close" onClick={() => setSelectedRosterPass(null)} style={{ position: 'static' }}>✕</button>
              </div>

              {selectedRosterPass.qrCodeData && (
                <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                  <div style={{ background: '#fff', padding: '12px', borderRadius: '12px', display: 'inline-block' }}>
                    <img src={selectedRosterPass.qrCodeData} alt="Pass QR" style={{ width: '150px', height: '150px', imageRendering: 'pixelated' }} />
                  </div>
                </div>
              )}

              <h2 style={{ font: '700 20px Syne', color: 'var(--text-main)', margin: '0 0 4px', textAlign: 'center' }}>
                {selectedRosterPass.name || selectedRosterPass.memberName || selectedRosterPass.user?.profile?.name || selectedRosterPass.memberId}
              </h2>
              <p style={{ color: 'var(--brand-primary)', fontFamily: 'monospace', fontSize: '12px', margin: '0 0 16px', textAlign: 'center' }}>
                PASS ID: {selectedRosterPass.id} · MEMBER: {selectedRosterPass.memberId || selectedRosterPass.user?.memberId}
              </p>

              {/* Full Details Grid */}
              <div style={{ background: 'var(--panel-subtle)', borderRadius: '12px', padding: '16px', fontSize: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', color: 'var(--text-muted)', border: '1px solid var(--line)' }}>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>COLLEGE / INSTITUTION</span>
                  <b style={{ color: 'var(--text-main)', display: 'block', marginTop: '2px' }}>
                    {selectedRosterPass.department || selectedRosterPass.user?.profile?.department || 'Malla Reddy (MR) Deemed to be University'}
                  </b>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ACADEMIC YEAR & ROLL</span>
                  <b style={{ color: 'var(--text-main)', display: 'block', marginTop: '2px' }}>
                    Year {selectedRosterPass.year || selectedRosterPass.user?.profile?.year || '1'} · Roll: {selectedRosterPass.rollNumber || selectedRosterPass.user?.profile?.rollNumber || '---'}
                  </b>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>EMAIL ADDRESS</span>
                  <b style={{ color: 'var(--text-main)', display: 'block', marginTop: '2px', wordBreak: 'break-all' }}>
                    {selectedRosterPass.email || selectedRosterPass.user?.profile?.email || '---'}
                  </b>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PHONE & EMERGENCY</span>
                  <b style={{ color: 'var(--text-main)', display: 'block', marginTop: '2px' }}>
                    {selectedRosterPass.phone || selectedRosterPass.user?.profile?.phone || '---'} {selectedRosterPass.emergencyContact ? `(Emerg: ${selectedRosterPass.emergencyContact})` : ''}
                  </b>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>GENDER & AGE</span>
                  <b style={{ color: 'var(--text-main)', display: 'block', marginTop: '2px' }}>
                    {selectedRosterPass.gender || selectedRosterPass.user?.profile?.gender || 'MALE'} · {selectedRosterPass.age || selectedRosterPass.user?.profile?.age || '---'} yrs
                  </b>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>RESIDENCY & COMMUTE</span>
                  <b style={{ color: 'var(--text-main)', display: 'block', marginTop: '2px' }}>
                    {selectedRosterPass.residencyType === 'HOSTELLER'
                      ? (selectedRosterPass.hostelType === 'PRIVATE_HOSTEL' ? 'Private PG / Hostel' : 'College Hostel')
                      : (selectedRosterPass.transportMode === 'COLLEGE_BUS' ? 'College Bus Commuter' : selectedRosterPass.transportMode === 'PUBLIC_BUS' ? 'Public Bus' : 'Day Scholar')}
                  </b>
                </div>
                {selectedRosterPass.teamName && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>TEAM SQUAD</span>
                    <b style={{ color: 'var(--brand-primary)', display: 'block', marginTop: '2px' }}>
                      {selectedRosterPass.teamName} {selectedRosterPass.isTeamLeader ? '★ Squad Leader' : '· Squad Member'}
                    </b>
                  </div>
                )}
                <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--line)', paddingTop: '10px', marginTop: '4px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PAYMENT & UTR</span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <strong style={{ color: '#70ddb4', fontSize: '14px' }}>
                        {selectedRosterPass.totalAmount > 0 ? `₹${selectedRosterPass.totalAmount}` : 'Free Entry'}
                      </strong>
                      <span className={`badge badge-${(selectedRosterPass.paymentStatus || 'free').toLowerCase()}`} style={{ marginLeft: '8px' }}>
                        {selectedRosterPass.paymentStatus}
                      </span>
                      {selectedRosterPass.paymentReference && (
                        <span style={{ display: 'block', color: 'var(--brand-primary)', fontFamily: 'monospace', fontSize: '11px', marginTop: '2px' }}>
                          UTR: {selectedRosterPass.paymentReference}
                        </span>
                      )}
                    </div>
                    {selectedRosterPass.paymentProofUrl && (
                      <a
                        href={selectedRosterPass.paymentProofUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="action-btn"
                        style={{ fontSize: '10px', padding: '4px 10px', background: 'var(--panel-elevated)', color: 'var(--brand-primary)', border: '1px solid var(--line)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        VIEW PAYMENT PROOF ↗
                      </a>
                    )}
                  </div>
                </div>

                {/* Custom Form Data (if any) */}
                {selectedRosterPass.formData && typeof selectedRosterPass.formData === 'object' && Object.keys(selectedRosterPass.formData).length > 0 && (
                  <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--line)', paddingTop: '10px', marginTop: '4px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>CUSTOM FORM RESPONSES</span>
                    <div style={{ marginTop: '6px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      {Object.entries(selectedRosterPass.formData).map(([k, v]) => (
                        <div key={k} style={{ background: 'var(--bg-input)', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--line)' }}>
                          <small style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px' }}>{k}</small>
                          <span style={{ color: 'var(--text-main)', fontSize: '11px', fontWeight: 600 }}>{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginTop: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {(selectedRosterPass.paymentStatus === 'SUBMITTED' || selectedRosterPass.paymentStatus === 'PENDING') && selectedRosterPass.totalAmount > 0 && (
                  <button
                    type="button"
                    className="primary"
                    onClick={() => handleVerifyRosterUTR(selectedRosterPass.id)}
                    style={{ flex: 1, height: '38px', fontSize: '11px' }}
                  >
                    VERIFY UTR & ACTIVATE
                  </button>
                )}
                {!selectedRosterPass.attendanceMarked && (
                  <button
                    type="button"
                    className="action-btn save-btn"
                    onClick={() => handleCheckInRoster(selectedRosterPass.id)}
                    style={{ flex: 1, height: '38px', fontSize: '11px' }}
                  >
                    RECORD GATE ENTRY
                  </button>
                )}
                <button
                  type="button"
                  className="action-btn"
                  onClick={() => setSelectedRosterPass(null)}
                  style={{ height: '38px', padding: '0 16px', background: 'var(--panel-elevated)', color: 'var(--text-main)', border: '1px solid var(--line)', fontSize: '11px' }}
                >
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </LivePortal>
  )
}
