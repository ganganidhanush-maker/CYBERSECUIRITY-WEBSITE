import React, { useEffect, useState } from 'react'
import { IconDownload } from '../../components/icons'
import { LivePortal } from '../../components/layout/LivePortal'
import { usePlatformTheme } from '../../context/PlatformThemeContext'
import { adminApi } from '../../lib/api'
import { getRoleLabel } from '../../lib/constants'
import { downloadCsv } from '../../lib/export-csv'

function getAuditCategory(action = '') {
  const a = action.toUpperCase()
  if (a.includes('PAYMENT') || a.includes('SUBSCRIPTION') || a.includes('FEE')) return 'PAYMENTS'
  if (a.includes('LOGIN') || a.includes('LOGOUT') || a.includes('AUTH') || a.includes('2FA') || a.includes('PASSWORD') || a.includes('PIN')) return 'AUTH'
  if (a.includes('MEMBER') || a.includes('ROLE') || a.includes('STATUS') || a.includes('ACCOUNT')) return 'MEMBERS'
  if (a.includes('EVENT') || a.includes('REGISTRATION') || a.includes('PASS')) return 'EVENTS'
  if (a.includes('SETTING') || a.includes('HIBERNATION') || a.includes('VIDEO') || a.includes('CONFIG') || a.includes('SUPPORT')) return 'SYSTEM'
  return 'GENERAL'
}

function getCategoryBadge(cat, isMrdu = false) {
  switch (cat) {
    case 'PAYMENTS': return { label: 'Payments', color: '#70ddb4', bg: '#10382e' }
    case 'AUTH': return isMrdu
      ? { label: 'Auth', color: '#ff9a9a', bg: 'rgba(211,47,47,0.15)' }
      : { label: 'Auth', color: '#52bbf5', bg: '#164366' }
    case 'MEMBERS': return { label: 'Members', color: '#d5baff', bg: '#382766' }
    case 'EVENTS': return { label: 'Events', color: '#ffb74d', bg: '#3a2a10' }
    case 'SYSTEM': return { label: 'System', color: '#f87171', bg: '#3a1818' }
    default: return { label: 'General', color: '#8aa2b4', bg: '#182433' }
  }
}

const AUDIT_ACTION_TITLES = {
  EVENT_ENTRY_GRANTED: 'Event Gate Entry & Attendance Checked In',
  EVENT_PAYMENT_VERIFIED: 'Event Pass Payment Verified',
  PASS_PAYMENT_VERIFIED: 'Event Pass Payment Verified',
  EVENT_CREATED: 'New Event Created & Published',
  EVENT_UPDATED: 'Event Schedule & Details Updated',
  EVENT_DELETED: 'Event Deleted',
  EVENT_REGISTERED: 'Student Event Registration Submitted',
  TEAM_INVITE_SENT: 'Team Squad Invitation Dispatched',
  TEAM_INVITE_RESPONDED: 'Team Squad Invitation Response',
  ACCOUNT_CREATED: 'New Member Account Provisioned',
  GUEST_REGISTERED: 'Guest Student Registered Account',
  BULK_STUDENTS_CREATED: 'Batch Student Accounts Provisioned',
  ACCOUNT_STATUS_CHANGED: 'Member Account Access Status Changed',
  ACCOUNT_AUTO_DISABLED_INACTIVITY: 'Account Auto-Disabled (Inactivity > 3 Days)',
  ACCOUNT_PERMISSIONS_CHANGED: 'Administrative Permissions Updated',
  ACCOUNT_UPDATED: 'Member Profile Information Updated',
  ADMIN_PASSWORD_RESET: 'Member Password Reset by Administrator',
  TWO_FACTOR_RESET_BY_ADMIN: 'Member 2FA Reset by Administrator',
  MEMBER_DELETED: 'Member Account Deleted',
  PRIMARY_PRESIDENT_LOGIN_SUCCESS: 'Primary President Sign-in',
  PRESIDENT_LOGIN_SUCCESS: 'President Sign-in',
  LOGIN_SUCCESS: 'Member Sign-in',
  TWO_FACTOR_LOGIN_SUCCESS: '2FA Security Code Verified',
  TWO_FACTOR_LOGIN_FAILED: 'Failed 2FA Security Attempt',
  LOGOUT: 'Member Sign-out',
  LOGOUT_ALL_DEVICES: 'All Device Sessions Terminated',
  LOGIN_BLOCKED: 'Sign-in Attempt Blocked',
  ACCOUNT_LOCKED: 'Account Locked Due to Failed Attempts',
  PASSWORD_RESET_REQUESTED: 'Password Reset Requested',
  PASSWORD_RESET_COMPLETED: 'Password Reset Completed',
  TWO_FACTOR_ENABLED: 'Two-Factor Authentication Enabled',
  TWO_FACTOR_DISABLED: 'Two-Factor Authentication Disabled',
  MASTER_SECURITY_PIN_CHANGED: 'President Master Security PIN Changed',
  FULL_DATABASE_EXPORT_SQL: 'Full Database SQL Snapshot Exported',
  DATABASE_EXPORT_REJECTED_INVALID_PASSWORD: 'Database Export Blocked (Invalid Password)',
  GALLERY_ALBUM_CREATED: 'New Photo Gallery Album Created',
  GALLERY_PHOTO_ADDED: 'Photo Uploaded to Gallery',
  GALLERY_PHOTOS_ADDED: 'Batch Photos Uploaded to Gallery',
  GALLERY_PHOTO_DELETED: 'Photo Deleted from Gallery',
  GALLERY_ALBUM_DELETED: 'Gallery Album Deleted',
  CAMPUS_REEL_PUBLISHED: 'New Campus Reel Published',
  CAMPUS_REEL_DELETED: 'Campus Reel Deleted',
  CLUB_SETTINGS_UPDATED: 'Global Club Settings & Links Saved',
  CLUB_TEAM_MEMBER_ADDED: 'New Leadership Profile Added',
  CLUB_TEAM_MEMBER_REMOVED: 'Leadership Profile Removed',
  CLUB_TEAM_MEMBER_UPDATED: 'Leadership Profile Updated',
  SUBSCRIPTION_VERIFIED: 'Student Pass Membership Approved',
  SUBSCRIPTION_REJECTED: 'Student Pass Membership Rejected',
  COMPLAINT_STATUS_UPDATED: 'Helpdesk Doubt Inquiry Status Updated',
  AUDIT_LOGS_PURGED: 'Compliance Audit Logs Purged',
}

const FRIENDLY_PARAM_LABELS = {
  eventTitle: 'Event Name',
  title: 'Event / Item Title',
  name: 'Full Name',
  attendeeName: 'Student Name',
  attendeeMemberId: 'Student Roll No / Member ID',
  verifiedBy: 'Verified By (Admin ID)',
  paymentReference: 'UPI UTR Reference',
  paymentStatus: 'Payment Status',
  paymentAmount: 'Amount (₹)',
  amount: 'Amount (₹)',
  totalAmount: 'Total Amount (₹)',
  requiresPayment: 'Payment Required',
  isTeamEvent: 'Participation Mode',
  isTeam: 'Participation Mode',
  teamName: 'Team Squad Name',
  minTeamSize: 'Minimum Team Size',
  maxTeamSize: 'Maximum Team Size',
  teamRules: 'Team Composition Rules',
  residencyType: 'Residency Type',
  transportMode: 'Commute Mode',
  hostelType: 'Hostel Accommodation',
  gender: 'Gender',
  age: 'Age',
  department: 'Department',
  rollNumber: 'Roll Number',
  phone: 'Phone Number',
  email: 'Email Address',
  role: 'Account Role',
  cscRole: 'Club Role',
  mrduRole: 'MRDU Role',
  reason: 'Reason / Note',
  lockMinutes: 'Lock Duration (Minutes)',
  ticketSubject: 'Doubt Subject',
  ticketCategory: 'Category',
  status: 'Updated Status',
  from: 'Previous Value',
  to: 'New Value',
  filename: 'Exported File Name',
  sizeBytes: 'Backup File Size',
  purgedBy: 'Purged By (Admin)',
  count: 'Total Count',
  ip: 'Network IP Address',
  category: 'Category',
  authorRole: 'Author Role',
  response: 'Response Decision',
}

const TECHNICAL_ID_KEYS = new Set([
  'eventId', 'registrationId', 'albumId', 'photoId', 'reelId', 'complaintId', 'userId', 'actorUserId', 'targetUserId', 'teamId', 'ticketId'
])

function isTechnicalUuid(val) {
  if (typeof val !== 'string') return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val) || /^c[a-z0-9]{24}$/i.test(val)
}

function getFriendlyActionTitle(action) {
  return AUDIT_ACTION_TITLES[action] || action.replaceAll('_', ' ')
}

function formatMetaKey(key) {
  if (FRIENDLY_PARAM_LABELS[key]) return FRIENDLY_PARAM_LABELS[key]
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .replace(/Url$/, ' Link / URL')
    .replace(/Id$/, '')
    .replace(/Upi/, 'UPI')
}

function formatMetaValue(val, key) {
  if (val === null || val === undefined) return 'None'
  if (typeof val === 'boolean') return val ? 'Yes' : 'No'
  if (key === 'sizeBytes' || key === 'size') {
    const num = Number(val)
    if (!isNaN(num)) return `${(num / 1024).toFixed(1)} KB`
  }
  if (key === 'residencyType') {
    return val === 'DAY_SCHOLAR' ? 'Day Scholar' : val === 'HOSTELLER' ? 'Hosteller' : val
  }
  if (key === 'isTeamEvent' || key === 'isTeam') {
    return val ? 'Team Squad' : 'Individual'
  }
  if (key === 'role' || key === 'cscRole' || key === 'mrduRole' || key === 'authorRole') {
    return getRoleLabel(val)
  }
  if (typeof val === 'object') {
    if (Array.isArray(val)) return val.join(', ')
    return JSON.stringify(val, null, 2)
  }
  return String(val).replace(/_/g, ' ')
}

function formatAuditSummary(entry) {
  if (!entry) return 'Action recorded in system audit logs.'
  const meta = entry.metadata || {}
  const targetUser = entry.target?.profile?.name || entry.target?.name || meta.targetName || meta.name || entry.target?.memberId || meta.targetMemberId || meta.memberId

  switch (entry.action) {
    case 'EVENT_ENTRY_GRANTED':
      return `Admitted attendee ${meta.attendeeName || targetUser || 'student'}${meta.attendeeMemberId ? ` (${meta.attendeeMemberId})` : ''} at gate and verified attendance for "${meta.eventTitle || 'Event'}".`
    case 'EVENT_PAYMENT_VERIFIED':
    case 'PASS_PAYMENT_VERIFIED':
      return `Verified ${meta.paymentReference ? `UPI transaction (UTR: ${meta.paymentReference})` : 'payment'} and activated event pass for ${meta.attendeeName || targetUser || 'attendee'}${meta.attendeeMemberId ? ` (${meta.attendeeMemberId})` : ''} for "${meta.eventTitle || 'Event'}".`
    case 'EVENT_CREATED':
      return `Created and published new event "${meta.title || meta.eventTitle || 'Event'}"${meta.requiresPayment ? ` with fee of ₹${meta.paymentAmount || 0}` : ' (Free Event)'}${meta.isTeamEvent ? ' [Team Participation Mode]' : ''}.`
    case 'EVENT_UPDATED':
      return `Updated event schedule, venue, or configuration for "${meta.title || meta.eventTitle || 'Event'}".`
    case 'EVENT_DELETED':
      return `Removed event "${meta.title || meta.eventTitle || 'Event'}" from the university portal.`
    case 'EVENT_REGISTERED':
      return `Submitted registration for event "${meta.eventTitle || 'Event'}"${meta.isTeam ? ` as squad "${meta.teamName}"` : ' as individual'}${meta.paymentReference ? ` (UTR: ${meta.paymentReference})` : ''}.`
    case 'TEAM_INVITE_SENT':
      return `Invited member ${meta.memberId || ''} to join team squad "${meta.teamName || ''}".`
    case 'TEAM_INVITE_RESPONDED':
      return `Responded ${meta.response || ''} to team squad invitation for "${meta.teamName || ''}".`
    case 'ACCOUNT_CREATED':
      return `Provisioned new account for ${meta.name || targetUser || 'member'} (${meta.memberId || 'ID'}, Role: ${getRoleLabel(meta.role || 'STUDENT')}).`
    case 'GUEST_REGISTERED':
      return `Self-registered new guest account for ${meta.name || targetUser || ''} (${meta.memberId || ''}${meta.department ? `, Dept: ${meta.department}` : ''}).`
    case 'BULK_STUDENTS_CREATED':
      return `Bulk provisioned ${meta.count || 0} student accounts with secure credentials.`
    case 'ACCOUNT_STATUS_CHANGED':
      return `Changed account access status of ${targetUser || meta.name || 'member'} from ${meta.from || 'PREV'} to ${meta.to || 'NEW'}.`
    case 'ACCOUNT_AUTO_DISABLED_INACTIVITY':
      return `Account automatically disabled due to inactivity (over 3 days without sign-in) for ${meta.name || targetUser || 'member'} (${meta.memberId || ''}). Reactivation requires Technical Team authorization.`
    case 'ACCOUNT_PERMISSIONS_CHANGED':
      return `Updated administrative permissions for ${targetUser || 'user'}.`
    case 'ACCOUNT_UPDATED':
      return `Updated profile information for ${targetUser || 'user'}.`
    case 'ADMIN_PASSWORD_RESET':
      return `Admin reset the login password for ${meta.targetName || targetUser || 'member'} (${meta.targetMemberId || ''}).`
    case 'TWO_FACTOR_RESET_BY_ADMIN':
      return `Disabled 2FA security lock for ${meta.targetName || targetUser || 'member'} (${meta.targetMemberId || ''}).`
    case 'MEMBER_DELETED':
      return `Permanently removed account for ${meta.targetName || targetUser || 'member'} (${meta.targetMemberId || ''}).`
    case 'MASTER_SECURITY_PIN_CHANGED':
      return `Updated 6-digit Master Security PIN for presidential command authorizations.`
    case 'FULL_DATABASE_EXPORT_SQL':
      return `Generated and exported full database SQL snapshot (${meta.filename || 'backup.sql'}, ${(Number(meta.sizeBytes || 0) / 1024).toFixed(1)} KB).`
    case 'DATABASE_EXPORT_REJECTED_INVALID_PASSWORD':
      return `Blocked database export attempt due to incorrect presidential master password.`
    case 'GALLERY_ALBUM_CREATED':
      return `Created new photo gallery album: "${meta.name || 'Album'}".`
    case 'GALLERY_PHOTO_ADDED':
    case 'GALLERY_PHOTOS_ADDED':
      return `Uploaded ${meta.count ? `${meta.count} photos` : 'photo(s)'} to photo gallery.`
    case 'GALLERY_PHOTO_DELETED':
      return `Deleted photo from photo gallery album.`
    case 'GALLERY_ALBUM_DELETED':
      return `Deleted photo gallery album "${meta.name || 'Album'}" and all its photos.`
    case 'CAMPUS_REEL_PUBLISHED':
      return `Published new short-form campus reel: "${meta.title || 'Reel'}" (${meta.category ? meta.category.replace(/_/g, ' ') : 'Campus'}).`
    case 'CAMPUS_REEL_DELETED':
      return `Deleted campus reel: "${meta.title || 'Reel'}".`
    case 'CLUB_SETTINGS_UPDATED':
      return `Updated global portal settings, links, and contact channels.`
    case 'CLUB_TEAM_MEMBER_ADDED':
      return `Added leadership profile for ${meta.name || 'member'} to the Organizing Team.`
    case 'CLUB_TEAM_MEMBER_REMOVED':
      return `Removed leadership profile for ${meta.name || 'member'} from the Organizing Team.`
    case 'CLUB_TEAM_MEMBER_UPDATED':
      return `Updated leadership profile details for ${meta.name || 'member'}.`
    case 'SUBSCRIPTION_VERIFIED':
      return `Verified UPI payment and activated student membership pass for ${targetUser || meta.targetName || 'student'}${meta.amount ? ` (₹${meta.amount})` : ''}.`
    case 'SUBSCRIPTION_REJECTED':
      return `Rejected membership pass payment for ${targetUser || meta.targetName || 'student'}${meta.reason ? ` (Reason: ${meta.reason})` : ''}.`
    case 'COMPLAINT_STATUS_UPDATED':
      return `Updated status of doubt helpdesk inquiry to "${meta.status || 'UPDATED'}".`
    case 'PRIMARY_PRESIDENT_LOGIN_SUCCESS':
      return 'Primary President logged in with full administrative privileges.'
    case 'PRESIDENT_LOGIN_SUCCESS':
      return 'President logged in successfully.'
    case 'LOGIN_SUCCESS':
      return 'Member logged in successfully.'
    case 'TWO_FACTOR_LOGIN_SUCCESS':
      return 'Two-factor authentication code verified successfully.'
    case 'TWO_FACTOR_LOGIN_FAILED':
      return 'Failed 2FA verification attempt.'
    case 'LOGOUT':
      return 'Logged out of active web session.'
    case 'LOGOUT_ALL_DEVICES':
      return 'Terminated all active user sessions across all devices.'
    case 'LOGIN_BLOCKED':
      return `Sign-in attempt was blocked (${meta.reason === 'ACCOUNT_DISABLED' ? 'Account Disabled' : meta.reason === 'ACCOUNT_LOCKED' ? 'Account Locked' : meta.reason || 'Security Policy'}).`
    case 'ACCOUNT_LOCKED':
      return `Account locked after repeated failed login attempts.`
    case 'PASSWORD_RESET_REQUESTED':
      return 'Password recovery instructions requested.'
    case 'PASSWORD_RESET_COMPLETED':
      return 'Password was successfully reset and updated.'
    case 'TWO_FACTOR_ENABLED':
      return 'Enabled two-factor authentication for account security.'
    case 'TWO_FACTOR_DISABLED':
      return 'Disabled two-factor authentication.'
    case 'AUDIT_LOGS_PURGED':
      return 'Purged security compliance records with Master PIN authorization.'
    default: {
      const parts = []
      if (meta.eventTitle || meta.title) parts.push(`"${meta.eventTitle || meta.title}"`)
      if (meta.attendeeName) parts.push(`Attendee: ${meta.attendeeName}`)
      if (meta.name && meta.name !== targetUser) parts.push(`Name: ${meta.name}`)
      if (meta.paymentReference) parts.push(`UTR: ${meta.paymentReference}`)
      if (meta.status) parts.push(`Status: ${meta.status}`)
      if (parts.length > 0) return `${entry.action.replaceAll('_', ' ')} — ${parts.join(', ')}`
      return entry.action.replaceAll('_', ' ')
    }
  }
}

export function AuditLogView({ user, logout, onNavigate }) {
  const { platformMode } = usePlatformTheme()
  const isMrdu = platformMode === 'MRDU_EVENTS'
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLog, setSelectedLog] = useState(null)

  // Clear Audit Modal (Primary President Only)
  const [clearModalOpen, setClearModalOpen] = useState(false)
  const [authCode, setAuthCode] = useState('')
  const [clearing, setClearing] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function loadLogs() {
    setLoading(true)
    adminApi.listAuditLogs()
      .then(({ auditLogs }) => { setLogs(auditLogs || []) })
      .finally(() => { setLoading(false) })
  }

  useEffect(() => {
    loadLogs()
  }, [])

  async function handleClearAudit(e) {
    e.preventDefault()
    setClearing(true)
    setError('')
    setMessage('')
    try {
      const res = await adminApi.clearAuditLogs(authCode)
      setMessage(res.message)
      setClearModalOpen(false)
      setAuthCode('')
      loadLogs()
    } catch (err) {
      setError(err.message)
    } finally {
      setClearing(false)
    }
  }

  const categories = [
    { id: 'ALL', label: 'All Audits', icon: 'ALL' },
    { id: 'PAYMENTS', label: 'Payments & Subscriptions', icon: 'PAY' },
    { id: 'AUTH', label: 'Authentication & PIN', icon: 'AUTH' },
    { id: 'MEMBERS', label: 'Members & Roles', icon: 'MEMBERS' },
    { id: 'EVENTS', label: 'Events & Passes', icon: 'EVENTS' },
    { id: 'SYSTEM', label: 'System & Support', icon: 'SYS' },
  ]

  const filteredLogs = logs.filter(entry => {
    const cat = getAuditCategory(entry.action)
    if (categoryFilter !== 'ALL' && cat !== categoryFilter) return false

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const actorName = (entry.actor?.profile?.name || entry.actor?.name || entry.metadata?.name || '').toLowerCase()
      const actorId = (entry.actor?.memberId || entry.metadata?.memberId || '').toLowerCase()
      const actorRole = (entry.actor?.role || entry.metadata?.role || '').toLowerCase()
      const targetName = (entry.target?.profile?.name || entry.target?.name || entry.metadata?.targetName || '').toLowerCase()
      const targetId = (entry.target?.memberId || entry.metadata?.targetMemberId || '').toLowerCase()
      const summary = formatAuditSummary(entry).toLowerCase()
      const matchAction = entry.action?.toLowerCase().includes(q)
      const matchMeta = JSON.stringify(entry.metadata || {}).toLowerCase().includes(q)
      if (!matchAction && !actorName.includes(q) && !actorId.includes(q) && !actorRole.includes(q) && !targetName.includes(q) && !targetId.includes(q) && !summary.includes(q) && !matchMeta) return false
    }
    return true
  })

  function handleDownloadAuditLogsCsv() {
    const headers = [
      'Log ID',
      'Date & Time',
      'Member ID',
      'Profile Name',
      'Role',
      'Action / What They Did',
      'Changes / Activity Summary',
      'Target Member ID',
      'Parameters / Details',
    ]
    const rows = filteredLogs.map(l => {
      const actorName = l.actor?.profile?.name || l.actor?.name || l.metadata?.name || (l.actor?.isPrimaryAdmin ? 'Primary President' : l.actorUserId ? 'Authorized Member' : 'System Action')
      const actorId = l.actor?.memberId || l.metadata?.memberId || null
      const actorRole = l.actor?.role || l.metadata?.role || null
      const summary = formatAuditSummary(l)
      return [
        l.id,
        l.createdAt ? new Date(l.createdAt).toLocaleString() : null,
        actorId,
        actorName,
        actorRole,
        l.action,
        summary,
        l.target?.memberId || l.targetUserId || l.targetId,
        l.metadata ? JSON.stringify(l.metadata) : null,
      ]
    })
    downloadCsv('security_audit_logs.csv', headers, rows)
  }

  return (
    <LivePortal user={user} logout={logout} activeTab="admin-audit" onNavigate={onNavigate} title="SECURITY AUDIT LOG">
      <section className="member-management">
        <div className="member-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('admin-dashboard')}>
              ← COMMAND CENTER
            </button>
            <p className="eyebrow">COMPLIANCE & ACTIVITY TRACEABILITY</p>
            <h1>Security Audit Log</h1>
            <p>Protected immutable logs of member activities, administrative actions, and configuration changes.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="outline"
              onClick={handleDownloadAuditLogsCsv}
              disabled={filteredLogs.length === 0}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '6px 12px' }}
              title="Download filtered audit logs as CSV"
            >
              <IconDownload size={14} /> DOWNLOAD AUDIT CSV
            </button>
            {user.isPrimaryAdmin && (
              <button
                type="button"
                className="action-btn delete-btn"
                onClick={() => setClearModalOpen(true)}
                style={{ padding: '7px 14px', fontSize: '11px', fontWeight: 'bold' }}
              >
                CLEAR ALL AUDIT LOGS
              </button>
            )}
            <span className="president-lock">PROTECTED RECORDS</span>
          </div>
        </div>

        {message && <p className="member-form-success">{message}</p>}
        {error && <p className="member-form-error">{error}</p>}

        {/* Category Filters */}
        <div className="audit-tabs">
          {categories.map(c => {
            const count = c.id === 'ALL' ? logs.length : logs.filter(l => getAuditCategory(l.action) === c.id).length
            return (
              <button
                key={c.id}
                type="button"
                className={`audit-tab-btn ${categoryFilter === c.id ? 'active' : ''}`}
                onClick={() => setCategoryFilter(c.id)}
              >
                <span>{c.icon}</span>
                <span>{c.label}</span>
                <small style={{ color: categoryFilter === c.id ? 'var(--brand-primary)' : 'var(--text-dim)' }}>({count})</small>
              </button>
            )
          })}
        </div>

        {/* Search Bar */}
        <div style={{ marginBottom: '16px' }}>
          <input
            style={{ width: '100%', height: '38px', padding: '0 14px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', fontSize: '11px' }}
            placeholder="Search by Member ID, Name, Role, Action, or Changes..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <article className="member-list-card">
          {loading ? (
            <p className="directory-state">Loading audit logs...</p>
          ) : filteredLogs.length === 0 ? (
            <p className="directory-state">No audit log entries match your selected criteria.</p>
          ) : (
            <div className="table-scroll-container">
              <div className="members-table">
                <div className="audit-table-header">
                  <span>MEMBER ID</span>
                  <span>PROFILE NAME</span>
                  <span>ROLE</span>
                  <span>WHAT THEY DID / ACTION</span>
                  <span>DATE & TIMING</span>
                  <span>DETAILS</span>
                </div>
                {filteredLogs.map(entry => {
                  const cat = getAuditCategory(entry.action)
                  const badge = getCategoryBadge(cat, isMrdu)
                  const actorName = entry.actor?.profile?.name || entry.actor?.name || entry.metadata?.name || entry.metadata?.actorName || (entry.actor?.isPrimaryAdmin ? 'Primary President' : entry.actorUserId ? 'Club Member' : 'System Administrator')
                  const actorMemberId = entry.actor?.memberId || entry.metadata?.memberId || entry.metadata?.actorMemberId || (entry.actorUserId ? 'MEMBER' : 'SYSTEM')
                  const actorRole = entry.actor?.role || entry.metadata?.role || entry.metadata?.actorRole || (entry.actorUserId ? 'STUDENT' : 'SYSTEM')
                  const summary = formatAuditSummary(entry)

                  return (
                    <div className="audit-table-row" key={entry.id}>
                      <div>
                        <span style={{ color: 'var(--brand-primary)', fontWeight: 700, fontFamily: 'DM Mono', fontSize: '12px' }}>
                          {actorMemberId}
                        </span>
                      </div>
                      <div>
                        <b style={{ color: 'var(--text-main)', fontSize: '13px', display: 'block' }}>
                          {actorName}
                        </b>
                      </div>
                      <div>
                        <span className="badge" style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.color}44`, fontSize: '10px' }}>
                          {getRoleLabel(actorRole)}
                        </span>
                      </div>
                      <div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <b style={{ color: badge.color, fontSize: '11px', letterSpacing: '0.02em' }}>
                            {getFriendlyActionTitle(entry.action)}
                          </b>
                          <span style={{ color: 'var(--text-muted)', fontSize: '11px', lineHeight: 1.4 }}>
                            {summary}
                          </span>
                        </div>
                      </div>
                      <div>
                        <small style={{ color: 'var(--text-main)', display: 'block', fontSize: '11px' }}>
                          {new Date(entry.createdAt).toLocaleDateString()}
                        </small>
                        <small style={{ color: 'var(--brand-primary)', display: 'block', fontWeight: 600, fontSize: '11px', fontFamily: 'DM Mono' }}>
                          {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </small>
                      </div>
                      <div>
                        <button
                          type="button"
                          className="action-btn edit-btn"
                          onClick={() => setSelectedLog(entry)}
                          style={{ fontSize: '10px', padding: '4px 8px' }}
                          title="Click to view complete details"
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </article>

        {/* Clear Audit Confirmation Modal */}
        {clearModalOpen && (
          <div className="photo-lightbox" onClick={() => setClearModalOpen(false)}>
            <div className="photo-lightbox-content" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-modal)', padding: '28px', borderRadius: '14px', border: '1px solid #f8717155', maxWidth: '440px', width: '100%' }}>
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: '8px 0 4px', font: '700 20px Syne', color: '#dc2626' }}>Clear Audit Logs</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: 0 }}>
                  This will purge all previous compliance records from the database. Only the Primary President can execute this.
                </p>
              </div>

              <form onSubmit={handleClearAudit}>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Enter Master Security PIN or Password *
                  <input
                    type="password"
                    required
                    placeholder="Enter PIN or password to authorize"
                    value={authCode}
                    onChange={e => setAuthCode(e.target.value)}
                    style={{ width: '100%', height: '40px', padding: '0 12px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', marginTop: '4px' }}
                  />
                </label>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <button type="button" className="action-btn cancel-btn" onClick={() => setClearModalOpen(false)}>Cancel</button>
                  <button type="submit" className="primary" disabled={clearing || !authCode} style={{ background: '#dc2626' }}>
                    {clearing ? 'PURGING…' : 'CONFIRM PURGE'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Audit Details Modal */}
        {selectedLog && (() => {
          const actorName = selectedLog.actor?.profile?.name || selectedLog.actor?.name || selectedLog.metadata?.name || (selectedLog.actor?.isPrimaryAdmin ? 'Primary President' : selectedLog.actorUserId ? 'Authorized Member' : 'System Administrator')
          const actorMemberId = selectedLog.actor?.memberId || selectedLog.metadata?.memberId || null
          const actorRole = selectedLog.actor?.role || selectedLog.metadata?.role || null
          const targetName = selectedLog.target?.profile?.name || selectedLog.target?.name || selectedLog.metadata?.targetName || selectedLog.metadata?.attendeeName || null
          const targetMemberId = selectedLog.target?.memberId || selectedLog.metadata?.targetMemberId || selectedLog.metadata?.attendeeMemberId || null
          const targetRole = selectedLog.target?.role || selectedLog.metadata?.targetRole || null
          const summary = formatAuditSummary(selectedLog)
          const friendlyTitle = getFriendlyActionTitle(selectedLog.action)

          // Separate user-facing human parameters from raw internal technical IDs
          const metaEntries = selectedLog.metadata ? Object.entries(selectedLog.metadata) : []
          const humanEntries = metaEntries.filter(([k, v]) => {
            if (TECHNICAL_ID_KEYS.has(k)) return false
            if (isTechnicalUuid(v)) return false
            if (k === 'updatedFields' && Array.isArray(v) && v.length === 0) return false
            return true
          })

          const technicalRefs = metaEntries.filter(([k, v]) => {
            return TECHNICAL_ID_KEYS.has(k) || isTechnicalUuid(v)
          })

          return (
            <div className="photo-lightbox" onClick={() => setSelectedLog(null)}>
              <div className="photo-lightbox-content" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-modal)', padding: '28px', borderRadius: '14px', border: '1px solid var(--brand-border-subtle)', maxWidth: '640px', width: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--line)', paddingBottom: '14px', marginBottom: '16px' }}>
                  <div>
                    <span className="badge badge-president" style={{ marginBottom: '6px', fontSize: '10px' }}>
                      {selectedLog.action}
                    </span>
                    <h3 style={{ margin: '4px 0 0', font: '700 18px Syne', color: 'var(--text-main)' }}>
                      {friendlyTitle}
                    </h3>
                  </div>
                  <button className="lightbox-close" onClick={() => setSelectedLog(null)} style={{ position: 'static' }}>✕</button>
                </div>

                {/* Member, Action & Timing Grid */}
                <div className="audit-detail-grid">
                  <div className="audit-detail-field">
                    <b>PERFORMED BY (ADMIN / MEMBER)</b>
                    <p style={{ color: 'var(--text-main)', fontWeight: 600, fontSize: '13px' }}>{actorName}</p>
                    <small style={{ color: 'var(--brand-primary)', fontFamily: 'DM Mono', fontSize: '11px' }}>
                      {actorMemberId ? `${actorMemberId} • ${getRoleLabel(actorRole)}` : 'System Automated Operation'}
                    </small>
                  </div>
                  <div className="audit-detail-field">
                    <b>DATE & EXACT RECORDED TIME</b>
                    <p style={{ color: '#059669', fontFamily: 'DM Mono', fontWeight: 600, fontSize: '12px' }}>
                      {new Date(selectedLog.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' })}
                    </p>
                    <small style={{ color: 'var(--text-dim)', fontSize: '10px' }}>Immutable Security Timestamp</small>
                  </div>

                  {targetMemberId && (
                    <div className="audit-detail-field" style={{ gridColumn: '1 / -1', background: 'var(--panel-subtle)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--line)' }}>
                      <b style={{ color: '#d97706', fontSize: '10px' }}>APPLIED TO TARGET STUDENT / ATTENDEE</b>
                      <p style={{ margin: '4px 0 0', color: 'var(--text-main)', fontSize: '13px', fontWeight: 600 }}>
                        {targetName || targetMemberId} <span style={{ color: 'var(--brand-primary)', fontFamily: 'DM Mono', fontSize: '11px', fontWeight: 'normal' }}>({targetMemberId})</span>
                        {targetRole && <span className="badge" style={{ marginLeft: '8px', fontSize: '9px' }}>{getRoleLabel(targetRole)}</span>}
                      </p>
                    </div>
                  )}

                  <div className="audit-detail-field" style={{ gridColumn: '1 / -1', background: 'var(--panel-subtle)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--brand-border-subtle)' }}>
                    <b style={{ color: 'var(--brand-primary)', fontSize: '10px', letterSpacing: '0.06em' }}>ACTIVITY NARRATIVE & SUMMARY</b>
                    <p style={{ margin: '6px 0 0', color: 'var(--text-main)', fontSize: '13px', lineHeight: 1.6, fontWeight: 500 }}>
                      {summary}
                    </p>
                  </div>
                </div>

                {/* Clear Human-Readable Parameters Breakdown */}
                {humanEntries.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <b style={{ color: 'var(--brand-primary)', fontSize: '11px', letterSpacing: '0.04em', display: 'block', marginBottom: '8px' }}>
                      RECORDED EVENT PARAMETERS:
                    </b>
                    <table className="audit-meta-table">
                      <tbody>
                        {humanEntries.map(([k, v]) => (
                          <tr key={k}>
                            <td>{formatMetaKey(k)}</td>
                            <td>{formatMetaValue(v, k)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Technical References (Neat and Unobtrusive) */}
                {technicalRefs.length > 0 && (
                  <div style={{ marginTop: '14px', padding: '8px 12px', background: 'var(--panel-subtle)', borderRadius: '6px', border: '1px solid var(--line)', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                    <small style={{ color: 'var(--text-dim)', fontSize: '10px', fontWeight: 600 }}>System Reference Keys:</small>
                    {technicalRefs.map(([k, v]) => (
                      <span key={k} style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'var(--bg-input)', color: 'var(--brand-primary)', border: '1px solid var(--line)' }}>
                        {formatMetaKey(k)}: #{String(v).slice(0, 8)}
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                  <button type="button" className="primary" onClick={() => setSelectedLog(null)} style={{ minHeight: '38px', padding: '0 20px' }}>
                    CLOSE DETAILS
                  </button>
                </div>
              </div>
            </div>
          )
        })()}
      </section>
    </LivePortal>
  )
}
