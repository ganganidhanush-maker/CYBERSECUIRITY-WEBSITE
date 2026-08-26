import React, { useEffect, useMemo, useState } from 'react'
import {
  Icon8,
  IconCopy,
  IconCrown,
  IconDownload,
  IconEye,
  IconEyeOff,
  IconHeadset,
  IconMail,
  IconUserSvg,
} from '../../components/icons'
import { LivePortal } from '../../components/layout/LivePortal'
import { usePlatformTheme } from '../../context/PlatformThemeContext'
import { adminApi } from '../../lib/api'
import {
  ACADEMIC_YEARS,
  BRANCH_OPTIONS,
  CLUB_ROLES,
  CSE_SPECIALIZATIONS,
  getRoleLabel,
} from '../../lib/constants'
import { downloadCsv } from '../../lib/export-csv'

export function MemberManagement({ user, logout, onNavigate }) {
  const { platformMode } = usePlatformTheme()
  const isMrdu = platformMode === 'MRDU_EVENTS'
  const [members, setMembers] = useState([])
  const [role, setRole] = useState('STUDENT')
  const [passwordInput, setPasswordInput] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState({})
  // View Mode: 'ROSTER' (Active Directory) vs 'CREATE' (Account Provisioning Studio)
  const [managementView, setManagementView] = useState('ROSTER')
  const [roleFilter, setRoleFilter] = useState('ALL')

  // Bulk Account Creation States
  const [accountMode, setAccountMode] = useState('single')
  const [bulkText, setBulkText] = useState('')
  const [bulkYear, setBulkYear] = useState(1)
  const [bulkCollegeChoice, setBulkCollegeChoice] = useState('Malla Reddy (MR) Deemed to be University')
  const [bulkCollegeCustom, setBulkCollegeCustom] = useState('')
  const [bulkBranch, setBulkBranch] = useState('CSE')
  const [bulkSpecialization, setBulkSpecialization] = useState('AIML')
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const [bulkResultModal, setBulkResultModal] = useState(null)

  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [transferTargetId, setTransferTargetId] = useState('')
  const [transferAuthCode, setTransferAuthCode] = useState('')
  const [transferError, setTransferError] = useState('')

  const [resetModalUser, setResetModalUser] = useState(null)
  const [newPasswordInput, setNewPasswordInput] = useState('')
  const [resetError, setResetError] = useState('')
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [resetSubmitting, setResetSubmitting] = useState(false)
  const [resetCopied, setResetCopied] = useState(false)

  const hasLength = passwordInput.length >= 12
  const hasLower = /[a-z]/.test(passwordInput)
  const hasUpper = /[A-Z]/.test(passwordInput)
  const hasNumber = /\d/.test(passwordInput)
  const hasSymbol = /[^A-Za-z0-9]/.test(passwordInput)

  const effectiveBulkCollege = bulkCollegeChoice === 'Other' ? bulkCollegeCustom.trim() : bulkCollegeChoice
  const bulkSpecText = bulkSpecialization ? ` - ${bulkSpecialization}` : ''
  const bulkDepartment = `${bulkBranch}${bulkBranch === 'CSE' ? bulkSpecText : ''} (${effectiveBulkCollege || 'MRDU'})`

  const existingMemberIds = useMemo(() => new Set(members.map(m => m.memberId.toUpperCase())), [members])

  const parsedBulkStudents = useMemo(() => {
    if (!bulkText || !bulkText.trim()) return []
    const lines = bulkText.split(/\r?\n/).filter(line => line.trim().length > 0)
    const batchMemberIds = new Set()

    return lines.map((line, index) => {
      let parts = line.split('\t')
      if (parts.length < 2) {
        parts = line.split(/\s{2,}|\s*,\s*|\s*;\s*/)
      }
      if (parts.length < 2) {
        const spaceParts = line.trim().split(/\s+/)
        if (spaceParts.length >= 3) {
          const pass = spaceParts.pop()
          const roll = spaceParts.pop()
          const name = spaceParts.join(' ')
          parts = [name, roll, pass]
        }
      }

      const name = String(parts[0] || '').trim()
      const memberId = String(parts[1] || '').trim().toUpperCase()
      const password = String(parts[2] || '').trim()

      const errors = []
      if (!name) errors.push('Missing Name')
      if (!memberId) {
        errors.push('Missing Roll Number')
      } else if (!/^[A-Za-z0-9]{4,32}$/.test(memberId)) {
        errors.push('Alphanumeric 4-32 chars')
      } else if (existingMemberIds.has(memberId)) {
        errors.push('Roll No / Member ID already exists')
      } else if (batchMemberIds.has(memberId)) {
        errors.push('Duplicate in this batch')
      } else {
        batchMemberIds.add(memberId)
      }

      if (!password) {
        errors.push('Missing Password')
      } else if (password.length < 8) {
        errors.push('Password min 8 chars')
      }

      return {
        index: index + 1,
        name,
        memberId,
        rollNumber: memberId,
        password,
        year: Number(bulkYear) || 1,
        department: bulkDepartment,
        isValid: errors.length === 0,
        errors,
      }
    })
  }, [bulkText, bulkYear, bulkDepartment, existingMemberIds])

  const validBulkCount = parsedBulkStudents.filter(s => s.isValid).length
  const invalidBulkCount = parsedBulkStudents.length - validBulkCount

  function loadMembers() {
    setLoading(true)
    adminApi.listMembers()
      .then(({ users }) => setMembers(users))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadMembers()
  }, [platformMode])

  async function createAccount(e) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setMessage('')
    setError('')

    const rawYear = String(form.get('year') || '').trim()
    const rawAge = String(form.get('age') || '').trim()
    const account = {
      memberId: String(form.get('memberId') || '').trim().toUpperCase(),
      password: passwordInput,
      role,
      profile: {
        name: String(form.get('name') || '').trim(),
        gender: String(form.get('gender') || 'MALE'),
        age: rawAge ? Number(rawAge) : null,
        rollNumber: String(form.get('rollNumber') || '').trim() || null,
        department: String(form.get('department') || '').trim() || null,
        year: rawYear ? Number(rawYear) : null,
        email: String(form.get('email') || '').trim() || null,
        phone: String(form.get('phone') || '').trim() || null,
      },
    }

    setSubmitting(true)
    try {
      const { user: created } = await adminApi.createMember(account)
      setMembers(c => [created, ...c])
      e.currentTarget.reset()
      setPasswordInput('')
      setRole('STUDENT')
      setMessage(`Account created for ${created.name} (${getRoleLabel(created.role)}) · Member ID: ${created.memberId}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleBulkSubmit(e) {
    e.preventDefault()
    const validRows = parsedBulkStudents.filter(s => s.isValid)
    if (validRows.length === 0) {
      setError('Please resolve all validation errors in the student batch before creating accounts.')
      return
    }

    setBulkSubmitting(true)
    setError('')
    setMessage('')

    try {
      const payload = validRows.map(r => ({
        name: r.name,
        memberId: r.memberId,
        password: r.password,
        rollNumber: r.rollNumber,
        year: r.year,
        department: r.department,
      }))

      const res = await adminApi.bulkCreateMembers(payload)
      if (res.createdUsers && res.createdUsers.length > 0) {
        setMembers(prev => [...res.createdUsers, ...prev])
      }

      setBulkResultModal(res)
      if (res.failedCount === 0) {
        setBulkText('')
        setMessage(`Successfully created all ${res.successCount} student accounts!`)
      } else {
        setMessage(`Batch completed: ${res.successCount} created, ${res.failedCount} failed.`)
      }
    } catch (err) {
      setError(err.message || 'Bulk account creation failed.')
    } finally {
      setBulkSubmitting(false)
    }
  }

  async function updateMember(id) {
    setMessage('')
    setError('')
    setSubmitting(true)
    try {
      const { user: updated } = await adminApi.editMember(id, editData)
      setMembers(c => c.map(m => (m.id === id ? updated : m)))
      setEditingId(null)
      setEditData({})
      setMessage('Member details updated.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleStatus(member) {
    if (member.isPrimaryAdmin) return
    const nextStatus = member.accountStatus === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
    try {
      const { user: updated } = await adminApi.updateMemberStatus(member.id, nextStatus)
      setMembers(c => c.map(m => (m.id === member.id ? updated : m)))
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDisable2FA(member) {
    if (!confirm(`Are you sure you want to disable 2FA for ${member.name} (${member.memberId})?`)) return
    try {
      const res = await adminApi.disableMemberTwoFactor(member.id)
      setMessage(res.message)
      loadMembers()
    } catch (err) {
      setError(err.message)
    }
  }

  async function removeMember(member) {
    if (member.isPrimaryAdmin || member.role === 'PRESIDENT') {
      alert('The Primary President account cannot be deleted. Primary President status must first be transferred.')
      return
    }
    if (!confirm(`Are you sure you want to delete member ${member.name} (${member.memberId})?`)) return
    try {
      await adminApi.deleteMember(member.id)
      setMembers(c => c.filter(m => m.id !== member.id))
      setMessage(`Member ${member.memberId} removed.`)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleAdminResetPassword(e) {
    e.preventDefault()
    setResetError('')
    setResetSubmitting(true)
    try {
      const res = await adminApi.adminResetPassword(resetModalUser.id, newPasswordInput)
      setMessage(res.message || `Password reset successfully for ${resetModalUser.memberId}.`)
      setResetModalUser(null)
      setNewPasswordInput('')
      setShowResetPassword(false)
    } catch (err) {
      setResetError(err.message || 'Failed to reset password.')
    } finally {
      setResetSubmitting(false)
    }
  }

  function handleGenerateAdminPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*'
    let pwd = ''
    pwd += 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]
    pwd += 'abcdefghijkmnopqrstuvwxyz'[Math.floor(Math.random() * 24)]
    pwd += '23456789'[Math.floor(Math.random() * 8)]
    pwd += '!@#$%&*'[Math.floor(Math.random() * 7)]
    for (let i = 0; i < 10; i++) {
      pwd += chars[Math.floor(Math.random() * chars.length)]
    }
    const generated = pwd.split('').sort(() => 0.5 - Math.random()).join('')
    setNewPasswordInput(generated)
    setShowResetPassword(true)
  }

  function handleCopyResetPassword() {
    if (!newPasswordInput) return
    navigator.clipboard?.writeText(newPasswordInput)
    setResetCopied(true)
    setTimeout(() => setResetCopied(false), 2000)
  }

  async function handleTransferLeadership(e) {
    e.preventDefault()
    setTransferError('')
    try {
      const res = await adminApi.transferPresidentRole(transferTargetId, transferAuthCode)
      setMessage(res.message)
      setTransferModalOpen(false)
      setTransferAuthCode('')
      loadMembers()
    } catch (err) {
      setTransferError(err.message)
    }
  }

  const filteredMembers = members.filter(m => {
    if (roleFilter === 'STUDENT' && m.role !== 'STUDENT') return false
    if (roleFilter === 'ADMIN' && m.role === 'STUDENT') return false
    if (roleFilter === '2FA' && !m.twoFactorEnabled) return false
    const q = searchQuery.toLowerCase()
    return (
      m.memberId?.toLowerCase().includes(q) ||
      m.name?.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q) ||
      m.role?.toLowerCase().includes(q) ||
      m.rollNumber?.toLowerCase().includes(q) ||
      m.profile?.rollNumber?.toLowerCase().includes(q) ||
      m.department?.toLowerCase().includes(q) ||
      m.profile?.department?.toLowerCase().includes(q)
    )
  })

  function handleDownloadMembersCsv() {
    const headers = [
      'Member ID',
      'Full Name',
      'Role',
      'Roll Number',
      'Department / Branch',
      'Academic Year',
      'Official Email',
      'Phone Number',
      'Account Status',
      'Two-Factor Enabled',
      'Joined Date',
    ]
    const rows = filteredMembers.map(m => [
      m.memberId,
      m.name,
      getRoleLabel(m.role),
      m.rollNumber || m.profile?.rollNumber,
      m.department || m.profile?.department,
      m.year || m.profile?.year,
      m.email || m.profile?.email,
      m.phone || m.profile?.phone,
      m.accountStatus,
      m.twoFactorEnabled ? 'Enabled' : 'Disabled',
      m.createdAt ? new Date(m.createdAt).toLocaleDateString() : null,
    ])
    downloadCsv('club_members_roster.csv', headers, rows)
  }

  return (
    <LivePortal user={user} logout={logout} activeTab="admin-members" onNavigate={onNavigate} title="MEMBER & ROLE DIRECTORY">
      <section className="member-management">
        <div className="member-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('admin-dashboard')}>
              ← COMMAND CENTER
            </button>
            <p className="eyebrow">ROLE-BASED ACCESS CONTROL</p>
            <h1>Club Members & Leaders</h1>
            <p>Add new club members, assign predefined roles, manage 2FA locks, and oversee authorized access.</p>
          </div>
          {user.isPrimaryAdmin && (
            <button className="outline" type="button" onClick={() => setTransferModalOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <IconCrown size={14} /> TRANSFER PRIMARY LEADERSHIP
            </button>
          )}
        </div>

        {message && <p className="member-form-success">{message}</p>}
        {error && <p className="member-form-error">{error}</p>}

        <div className="member-view-switcher" style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={managementView === 'ROSTER' ? 'primary' : 'outline'}
            onClick={() => setManagementView('ROSTER')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '8px 18px', fontWeight: 700 }}
          >
            <Icon8 name="idDocs" size={14} /> ACTIVE MEMBER DIRECTORY ({members.length})
          </button>
          <button
            type="button"
            className={managementView === 'CREATE' ? 'primary' : 'outline'}
            onClick={() => setManagementView('CREATE')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '8px 18px', fontWeight: 700 }}
          >
            <IconUserSvg size={14} /> ＋ PROVISION NEW ACCOUNT
          </button>
        </div>

        {managementView === 'CREATE' ? (
          /* Full-Width Account Creation Studio */
          <article className="account-form-card" style={{ maxWidth: '960px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <p className="eyebrow">{accountMode === 'single' ? 'PROVISION MEMBER ACCOUNT' : 'BATCH STUDENT PROVISIONING'}</p>
                <h2>{accountMode === 'single' ? 'Create New Member Account' : 'Bulk Student Accounts Provisioning'}</h2>
              </div>
              <button
                type="button"
                className="outline"
                onClick={() => setManagementView('ROSTER')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}
              >
                ← BACK TO MEMBER DIRECTORY
              </button>
            </div>

            {/* Tab Switcher: Individual Account vs Bulk Accounts */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--line)', paddingBottom: '12px' }}>
              <button
                type="button"
                className={`tab-btn ${accountMode === 'single' ? 'active' : ''}`}
                onClick={() => setAccountMode('single')}
                style={{
                  background: accountMode === 'single' ? 'var(--brand-glow)' : 'transparent',
                  color: accountMode === 'single' ? 'var(--brand-primary)' : 'var(--text-muted)',
                  border: accountMode === 'single' ? '1px solid var(--brand-primary)' : '1px solid transparent',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <IconUserSvg size={14} /> Individual Account
              </button>
              <button
                type="button"
                className={`tab-btn ${accountMode === 'bulk' ? 'active' : ''}`}
                onClick={() => setAccountMode('bulk')}
                style={{
                  background: accountMode === 'bulk' ? 'var(--brand-glow)' : 'transparent',
                  color: accountMode === 'bulk' ? 'var(--brand-primary)' : 'var(--text-muted)',
                  border: accountMode === 'bulk' ? '1px solid var(--brand-primary)' : '1px solid transparent',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <IconDownload size={14} /> Bulk Accounts (Excel / CSV Batch)
              </button>
            </div>

            {accountMode === 'single' ? (
              <>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '0 0 16px' }}>
                  Provisioning authorized account as: <b style={{ color: 'var(--brand-primary)' }}>{user.name} ({user.memberId})</b>
                </p>

                <form onSubmit={createAccount}>
                  <div className="member-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                    <label>
                      Member ID (Unique) *
                      <input name="memberId" required placeholder="e.g. CSC2026M01" />
                    </label>
                    <label>
                      Assigned Club Role *
                      <select
                        className="member-select"
                        value={role}
                        onChange={e => setRole(e.target.value)}
                      >
                        {CLUB_ROLES.map(r => (
                          <option key={r.id} value={r.id}>
                            {r.label} ({r.roleType.toUpperCase()})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Full Name *
                      <input name="name" required placeholder="Full Name" />
                    </label>
                    <label>
                      Gender
                      <select className="member-select" name="gender" defaultValue="MALE">
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </label>
                    <label>
                      Age
                      <input name="age" type="number" min={15} max={65} placeholder="Age (e.g. 20)" />
                    </label>
                    <label>
                      College Roll Number
                      <input name="rollNumber" placeholder="e.g. 25EU07R0015" />
                    </label>
                    <label>
                      Department / Branch
                      <input name="department" placeholder="e.g. Cyber Security" />
                    </label>
                    <label>
                      Academic Year
                      <select className="member-select" name="year" defaultValue="1">
                        {ACADEMIC_YEARS.map(y => (
                          <option key={y.value} value={y.value}>{y.label}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Official Email
                      <input name="email" type="email" placeholder="student@college.edu" />
                    </label>
                    <label>
                      Phone Number
                      <input name="phone" placeholder="Phone number" />
                    </label>
                    <label className="form-wide" style={{ gridColumn: '1 / -1' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span>Account Password *</span>
                        <button
                          type="button"
                          className="outline"
                          onClick={() => {
                            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*'
                            let pwd = 'A' + 'a' + '9' + '@'
                            for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)]
                            setPasswordInput(pwd.split('').sort(() => 0.5 - Math.random()).join(''))
                            setShowPassword(true)
                          }}
                          style={{ padding: '2px 8px', fontSize: '10px', fontWeight: 600 }}
                        >
                          ⚡ Generate Strong Password
                        </button>
                      </div>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={passwordInput}
                          onChange={e => setPasswordInput(e.target.value)}
                          required
                          placeholder="Min 12 chars (Upper, Lower, Number, Symbol)"
                          style={{ width: '100%', paddingRight: '40px' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(p => !p)}
                          style={{
                            position: 'absolute',
                            right: '8px',
                            background: 'none',
                            border: 0,
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '4px',
                          }}
                        >
                          {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                        </button>
                      </div>
                    </label>
                  </div>

                  <div className="pwd-rules" style={{ margin: '14px 0' }}>
                    <span className={`pwd-rule ${hasLength ? 'valid' : ''}`}><i>{hasLength ? '✓' : '○'}</i> 12+ Characters</span>
                    <span className={`pwd-rule ${hasUpper ? 'valid' : ''}`}><i>{hasUpper ? '✓' : '○'}</i> Uppercase Letter</span>
                    <span className={`pwd-rule ${hasLower ? 'valid' : ''}`}><i>{hasLower ? '✓' : '○'}</i> Lowercase Letter</span>
                    <span className={`pwd-rule ${hasNumber ? 'valid' : ''}`}><i>{hasNumber ? '✓' : '○'}</i> Number</span>
                    <span className={`pwd-rule ${hasSymbol ? 'valid' : ''}`}><i>{hasSymbol ? '✓' : '○'}</i> Symbol (!@#$)</span>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button className="primary member-submit" disabled={submitting || !hasLength || !hasLower || !hasUpper || !hasNumber || !hasSymbol} style={{ padding: '12px 24px', fontWeight: 700 }}>
                      {submitting ? 'PROVISIONING…' : '＋ CREATE MEMBER ACCOUNT'}
                    </button>
                    <button type="button" className="outline" onClick={() => setManagementView('ROSTER')}>Cancel</button>
                  </div>
                </form>
              </>
            ) : (
              /* Bulk Account Creation Interface */
              <div className="bulk-accounts-container">
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '0 0 16px' }}>
                  Paste rows directly from Excel or CSV. Roll Number is automatically assigned as the Member ID.
                </p>

                <form onSubmit={handleBulkSubmit}>
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ color: 'var(--text-muted)', font: '600 11px "DM Mono", monospace' }}>
                        1. Paste Student Data (Name | Roll Number | Password)
                      </label>
                      <small style={{ color: '#059669', fontSize: '10px', font: '500 10px "DM Mono", monospace' }}>
                        Excel / Tab / Comma Delimited
                      </small>
                    </div>
                    <textarea
                      className="bulk-textarea"
                      placeholder={`Paste rows from Excel or text editor:\nStudent 1\t25EU07R0001\tPassword1!\nStudent 2\t25EU07R0002\tPassword2!\nStudent 3\t25EU07R0003\tPassword3!`}
                      value={bulkText}
                      onChange={e => setBulkText(e.target.value)}
                      style={{ minHeight: '140px' }}
                    />
                  </div>

                  {/* Common Information Settings */}
                  <div style={{ background: 'var(--panel-subtle)', border: '1px solid var(--line)', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
                    <label style={{ color: 'var(--brand-primary)', font: '700 11px "DM Mono", monospace', display: 'block', marginBottom: '10px' }}>
                      2. Common Batch Information (Applies to All Uploaded Accounts)
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                      <div>
                        <label style={{ color: 'var(--text-dim)', fontSize: '10px', display: 'block', marginBottom: '4px' }}>ACADEMIC YEAR</label>
                        <select
                          value={bulkYear}
                          onChange={e => setBulkYear(Number(e.target.value))}
                          style={{ width: '100%', height: '38px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', padding: '0 8px', fontSize: '11px' }}
                        >
                          {ACADEMIC_YEARS.map(y => (
                            <option key={y.value} value={y.value}>{y.label}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ color: 'var(--text-dim)', fontSize: '10px', display: 'block', marginBottom: '4px' }}>COLLEGE</label>
                        <select
                          value={bulkCollegeChoice}
                          onChange={e => setBulkCollegeChoice(e.target.value)}
                          style={{ width: '100%', height: '38px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', padding: '0 8px', fontSize: '11px' }}
                        >
                          <option value="Malla Reddy (MR) Deemed to be University">Malla Reddy (MR) Deemed to be University</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      {bulkCollegeChoice === 'Other' && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={{ color: 'var(--text-dim)', fontSize: '10px', display: 'block', marginBottom: '4px' }}>CUSTOM COLLEGE NAME</label>
                          <input
                            placeholder="Enter College Name"
                            value={bulkCollegeCustom}
                            onChange={e => setBulkCollegeCustom(e.target.value)}
                            style={{ width: '100%', height: '38px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', padding: '0 10px', fontSize: '11px' }}
                          />
                        </div>
                      )}

                      <div>
                        <label style={{ color: 'var(--text-dim)', fontSize: '10px', display: 'block', marginBottom: '4px' }}>BRANCH</label>
                        <select
                          value={bulkBranch}
                          onChange={e => setBulkBranch(e.target.value)}
                          style={{ width: '100%', height: '38px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', padding: '0 8px', fontSize: '11px' }}
                        >
                          {BRANCH_OPTIONS.map(b => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </div>

                      {bulkBranch === 'CSE' && (
                        <div>
                          <label style={{ color: 'var(--text-dim)', fontSize: '10px', display: 'block', marginBottom: '4px' }}>CSE SPECIALIZATION</label>
                          <select
                            value={bulkSpecialization}
                            onChange={e => setBulkSpecialization(e.target.value)}
                            style={{ width: '100%', height: '38px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', padding: '0 8px', fontSize: '11px' }}
                          >
                            {CSE_SPECIALIZATIONS.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Live Validation & Preview Table */}
                  {parsedBulkStudents.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <label style={{ color: 'var(--text-muted)', font: '600 11px "DM Mono", monospace' }}>
                          3. Batch Preview & Validation ({parsedBulkStudents.length} Students)
                        </label>
                        <span className={invalidBulkCount === 0 ? 'bulk-badge-valid' : 'bulk-badge-invalid'}>
                          {invalidBulkCount === 0 ? `ALL ${validBulkCount} VALID` : `${validBulkCount} VALID · ${invalidBulkCount} ISSUES`}
                        </span>
                      </div>

                      <div className="bulk-preview-wrap">
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                          <thead>
                            <tr style={{ background: 'var(--panel-subtle)', color: 'var(--brand-primary)', borderBottom: '1px solid var(--line)', position: 'sticky', top: 0 }}>
                              <th style={{ padding: '8px 10px', textAlign: 'left' }}>#</th>
                              <th style={{ padding: '8px 10px', textAlign: 'left' }}>NAME</th>
                              <th style={{ padding: '8px 10px', textAlign: 'left' }}>ROLL NO / MEMBER ID</th>
                              <th style={{ padding: '8px 10px', textAlign: 'left' }}>PASSWORD</th>
                              <th style={{ padding: '8px 10px', textAlign: 'left' }}>STATUS</th>
                            </tr>
                          </thead>
                          <tbody>
                            {parsedBulkStudents.map(s => (
                              <tr key={s.index} style={{ borderBottom: '1px solid var(--line)', background: s.isValid ? 'transparent' : 'rgba(239, 68, 68, 0.08)' }}>
                                <td style={{ padding: '6px 10px', color: 'var(--text-dim)' }}>{s.index}</td>
                                <td style={{ padding: '6px 10px', color: 'var(--text-main)', fontWeight: 500 }}>{s.name || '<Empty>'}</td>
                                <td style={{ padding: '6px 10px', color: 'var(--brand-primary)', fontFamily: 'monospace' }}>{s.memberId || '<Empty>'}</td>
                                <td style={{ padding: '6px 10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{s.password ? '••••••••' : '<Empty>'}</td>
                                <td style={{ padding: '6px 10px' }}>
                                  {s.isValid ? (
                                    <span style={{ color: '#059669', fontWeight: 600 }}>Valid</span>
                                  ) : (
                                    <span style={{ color: '#dc2626', fontWeight: 500 }}>{s.errors.join(', ')}</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="primary"
                    disabled={bulkSubmitting || validBulkCount === 0}
                    style={{ width: '100%', minHeight: '44px', fontSize: '11px', fontWeight: 700 }}
                  >
                    {bulkSubmitting ? 'CREATING STUDENT ACCOUNTS…' : `CREATE ${validBulkCount} STUDENT ACCOUNTS`}
                  </button>
                </form>
              </div>
            )}
          </article>
        ) : (
          /* Full-Width Member List Directory Card */
          <article className="member-list-card" style={{ width: '100%' }}>
            <div className="card-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
              <div>
                <p className="eyebrow">ROSTER DIRECTORY</p>
                <h2>Active Member Accounts ({members.length})</h2>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="primary"
                  onClick={() => setManagementView('CREATE')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '6px 14px' }}
                >
                  <IconUserSvg size={14} /> ＋ ADD MEMBER
                </button>
                <button
                  type="button"
                  className="outline"
                  onClick={handleDownloadMembersCsv}
                  disabled={filteredMembers.length === 0}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '6px 12px' }}
                  title="Download filtered members list as CSV"
                >
                  <IconDownload size={14} /> DOWNLOAD CSV
                </button>
              </div>
            </div>

            {/* Filter and Search Bar Row */}
            <div style={{ marginTop: '16px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 280px' }}>
                <input
                  style={{ width: '100%', height: '40px', padding: '0 14px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)', fontSize: '12px' }}
                  placeholder="Search by Member ID, Roll Number, Name, Role, Dept, or Email..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Role Filter Chips */}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`tab-btn ${roleFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setRoleFilter('ALL')}
                  style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '6px', background: roleFilter === 'ALL' ? 'var(--brand-glow)' : 'transparent', color: roleFilter === 'ALL' ? 'var(--brand-primary)' : 'var(--text-muted)', border: roleFilter === 'ALL' ? '1px solid var(--brand-primary)' : '1px solid var(--line)' }}
                >
                  All ({members.length})
                </button>
                <button
                  type="button"
                  className={`tab-btn ${roleFilter === 'STUDENT' ? 'active' : ''}`}
                  onClick={() => setRoleFilter('STUDENT')}
                  style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '6px', background: roleFilter === 'STUDENT' ? 'var(--brand-glow)' : 'transparent', color: roleFilter === 'STUDENT' ? 'var(--brand-primary)' : 'var(--text-muted)', border: roleFilter === 'STUDENT' ? '1px solid var(--brand-primary)' : '1px solid var(--line)' }}
                >
                  Students ({members.filter(m => m.role === 'STUDENT').length})
                </button>
                <button
                  type="button"
                  className={`tab-btn ${roleFilter === 'ADMIN' ? 'active' : ''}`}
                  onClick={() => setRoleFilter('ADMIN')}
                  style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '6px', background: roleFilter === 'ADMIN' ? 'var(--brand-glow)' : 'transparent', color: roleFilter === 'ADMIN' ? 'var(--brand-primary)' : 'var(--text-muted)', border: roleFilter === 'ADMIN' ? '1px solid var(--brand-primary)' : '1px solid var(--line)' }}
                >
                  Leaders & Admins ({members.filter(m => m.role !== 'STUDENT').length})
                </button>
                <button
                  type="button"
                  className={`tab-btn ${roleFilter === '2FA' ? 'active' : ''}`}
                  onClick={() => setRoleFilter('2FA')}
                  style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '6px', background: roleFilter === '2FA' ? 'var(--brand-glow)' : 'transparent', color: roleFilter === '2FA' ? 'var(--brand-primary)' : 'var(--text-muted)', border: roleFilter === '2FA' ? '1px solid var(--brand-primary)' : '1px solid var(--line)' }}
                >
                  2FA Active ({members.filter(m => m.twoFactorEnabled).length})
                </button>
              </div>
            </div>

            {loading ? (
              <p className="directory-state" style={{ marginTop: '24px' }}>Loading accounts...</p>
            ) : filteredMembers.length === 0 ? (
              <p className="directory-state" style={{ marginTop: '24px' }}>No matching members found.</p>
            ) : (
              <div className="table-scroll-container" style={{ marginTop: '16px' }}>
                <div className="members-table">
                  <div className="table-header" style={{ gridTemplateColumns: '1.4fr 1.3fr 1.2fr 1.5fr 1.3fr', gap: '14px' }}>
                    <span>MEMBER &amp; ROLL NO</span>
                    <span>{isMrdu ? 'MRDU ROLE & 2FA' : 'CLUB ROLE & 2FA'}</span>
                    <span>DEPARTMENT &amp; YEAR</span>
                    <span>CONTACT INFO</span>
                    <span>ACTIONS</span>
                  </div>
                  {filteredMembers.map(m => {
                    const isEditing = editingId === m.id
                    return (
                      <div className={`table-row ${isEditing ? 'editing' : ''}`} key={m.id} style={{ gridTemplateColumns: isEditing ? '1fr' : '1.4fr 1.3fr 1.2fr 1.5fr 1.3fr', gap: '14px' }}>
                        {isEditing ? (
                          <div>
                            <div className="edit-fields-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                              <input
                                placeholder="Name"
                                defaultValue={m.name}
                                onChange={e => setEditData(d => ({ ...d, name: e.target.value }))}
                              />
                              <input
                                placeholder="Email"
                                defaultValue={m.email || ''}
                                onChange={e => setEditData(d => ({ ...d, email: e.target.value }))}
                              />
                              <input
                                placeholder="Phone"
                                defaultValue={m.phone || ''}
                                onChange={e => setEditData(d => ({ ...d, phone: e.target.value }))}
                              />
                              <select
                                defaultValue={m.role}
                                onChange={e => setEditData(d => ({ ...d, role: e.target.value }))}
                                disabled={m.isPrimaryAdmin}
                              >
                                {CLUB_ROLES.map(r => (
                                  <option key={r.id} value={r.id}>{r.label}</option>
                                ))}
                              </select>
                            </div>
                            <div className="action-buttons" style={{ marginTop: '10px' }}>
                              <button className="action-btn save-btn" onClick={() => updateMember(m.id)}>Save {isMrdu ? 'MRDU Role' : 'Club Role'}</button>
                              <button className="action-btn cancel-btn" onClick={() => { setEditingId(null); setEditData({}) }}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* Member & Roll No */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              {m.profileImage ? (
                                <img src={m.profileImage} alt={m.name} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--brand-border-subtle)', flexShrink: 0 }} />
                              ) : (
                                <span style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--panel-subtle)', display: 'grid', placeItems: 'center', color: 'var(--brand-primary)', font: '700 11px Syne', border: '1px solid var(--line)', flexShrink: 0 }}>
                                  {m.initials}
                                </span>
                              )}
                              <div style={{ minWidth: 0 }}>
                                <b style={{ color: 'var(--text-main)', fontSize: '13px', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</b>
                                <span style={{ color: 'var(--brand-primary)', font: '600 11px "DM Mono", monospace', display: 'block' }}>{m.memberId}</span>
                                {(m.rollNumber || m.profile?.rollNumber) && (
                                  <small style={{ color: 'var(--text-dim)', fontSize: '10px', display: 'block' }}>Roll: {m.rollNumber || m.profile?.rollNumber}</small>
                                )}
                              </div>
                            </div>

                            {/* Role & 2FA */}
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                <span className={`badge ${m.isPrimaryAdmin ? 'badge-president' : m.role === 'STUDENT' ? 'badge-student' : 'badge-admin'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  {m.isPrimaryAdmin ? <><IconCrown size={12} /> PRESIDENT</> : getRoleLabel(m.role)}
                                </span>
                                {m.twoFactorEnabled && (
                                  <span className="badge badge-active" style={{ fontSize: '9px', display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                                    <Icon8 name="authentication" size={10} /> 2FA ON
                                  </span>
                                )}
                              </div>
                              {!m.isPrimaryAdmin && (
                                <small style={{ color: 'var(--text-dim)', fontSize: '10px', display: 'block', marginTop: '4px' }}>
                                  {isMrdu
                                    ? `CSC Club Role: ${getRoleLabel(m.cscRole || 'STUDENT')}`
                                    : `MRDU Mode: ${getRoleLabel(m.mrduRole || 'STUDENT')}`}
                                </small>
                              )}
                            </div>

                            {/* Department & Academic Year */}
                            <div>
                              <span style={{ color: 'var(--text-main)', fontSize: '12px', fontWeight: 600, display: 'block' }}>
                                {m.department || m.profile?.department || 'General'}
                              </span>
                              <small style={{ color: 'var(--text-dim)', fontSize: '11px', display: 'block', marginTop: '2px' }}>
                                {m.year || m.profile?.year ? `Year ${m.year || m.profile?.year}` : 'Undergraduate'}
                              </small>
                            </div>

                            {/* Contact Info */}
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: m.email ? 'var(--text-main)' : 'var(--text-dim)', fontSize: '11.5px' }}>
                                <IconMail size={12} style={{ flexShrink: 0, color: 'var(--brand-primary)' }} />
                                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.email || 'No email provided'}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: m.phone ? 'var(--text-muted)' : 'var(--text-dim)', fontSize: '11px', marginTop: '4px' }}>
                                <IconHeadset size={12} style={{ flexShrink: 0, color: 'var(--text-dim)' }} />
                                <span>{m.phone || 'No phone provided'}</span>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="action-buttons" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              <button className="action-btn edit-btn" onClick={() => { setEditingId(m.id); setEditData({}) }} title="Edit profile information">Edit</button>
                              <button className="action-btn toggle-status-btn" onClick={() => toggleStatus(m)} disabled={m.isPrimaryAdmin} title="Toggle account activation">
                                {m.accountStatus === 'ACTIVE' ? 'Active' : 'Disabled'}
                              </button>
                              <button className="action-btn edit-btn" onClick={() => setResetModalUser(m)} title="Reset member password">Password</button>
                              {m.twoFactorEnabled && (
                                <button className="action-btn cancel-btn" onClick={() => handleDisable2FA(m)} title="Disable 2FA if member is locked out">
                                  Reset 2FA
                                </button>
                              )}
                              {!m.isPrimaryAdmin && (
                                <button className="action-btn delete-btn" onClick={() => removeMember(m)} title="Permanently delete account">Delete</button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </article>
        )}

        {/* Reset Password Modal */}
        {resetModalUser && (
          <div className="photo-lightbox" onClick={() => { if (!resetSubmitting) setResetModalUser(null) }}>
            <div className="photo-lightbox-content" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-modal)', padding: '28px', borderRadius: '12px', border: '1px solid var(--line)', maxWidth: '440px', width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ margin: 0, font: '700 18px Syne', color: 'var(--text-main)' }}>Reset Member Password</h3>
                <button type="button" className="lightbox-close" onClick={() => setResetModalUser(null)} style={{ position: 'static' }}>✕</button>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '0 0 16px' }}>
                Resetting password for: <b style={{ color: 'var(--brand-primary)' }}>{resetModalUser.name}</b> (<span style={{ color: '#059669', fontFamily: 'DM Mono' }}>{resetModalUser.memberId}</span>)
              </p>

              <form onSubmit={handleAdminResetPassword}>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  New Password (12+ characters, uppercase, lowercase, number, symbol) *
                </label>
                <div style={{ position: 'relative', marginBottom: '12px' }}>
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    placeholder="Enter or generate new password"
                    value={newPasswordInput}
                    onChange={e => setNewPasswordInput(e.target.value)}
                    style={{ width: '100%', height: '42px', padding: '0 40px 0 12px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', fontSize: '13px', fontFamily: showResetPassword ? 'DM Mono, monospace' : 'inherit' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--brand-primary)', cursor: 'pointer', fontSize: '11px', padding: '4px' }}
                    title={showResetPassword ? 'Hide password' : 'Show password'}
                  >
                    {showResetPassword ? 'Hide' : 'Show'}
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="outline"
                    onClick={handleGenerateAdminPassword}
                    style={{ fontSize: '11px', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Icon8 name="keySecurity" size={13} /> Generate Strong Password
                  </button>
                  {newPasswordInput && (
                    <button
                      type="button"
                      className="outline"
                      onClick={handleCopyResetPassword}
                      style={{ fontSize: '11px', padding: '5px 10px', color: resetCopied ? '#059669' : 'var(--brand-primary)', borderColor: resetCopied ? '#059669' : 'var(--line)' }}
                    >
                      <IconCopy size={11} /> {resetCopied ? 'Copied!' : 'Copy'}
                    </button>
                  )}
                </div>

                {resetError && <p className="member-form-error" style={{ marginBottom: '14px' }}>{resetError}</p>}

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" className="action-btn cancel-btn" disabled={resetSubmitting} onClick={() => setResetModalUser(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="primary" disabled={resetSubmitting || !newPasswordInput} style={{ minHeight: '36px' }}>
                    {resetSubmitting ? 'UPDATING…' : 'RESET PASSWORD'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Transfer Leadership Modal */}
        {transferModalOpen && (
          <div className="photo-lightbox" onClick={() => setTransferModalOpen(false)}>
            <div className="photo-lightbox-content" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-modal)', padding: '28px', borderRadius: '12px', border: '1px solid #f59e0b', maxWidth: '460px' }}>
              <h3 style={{ margin: '0 0 8px', font: '700 18px Syne', color: '#d97706' }}>Transfer Primary Leadership</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '0 0 16px' }}>
                Select the administrator who will become the new Primary President.
              </p>
              <form onSubmit={handleTransferLeadership}>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '11px', marginBottom: '6px' }}>
                  Select New Primary President
                  <select
                    className="member-select"
                    required
                    value={transferTargetId}
                    onChange={e => setTransferTargetId(e.target.value)}
                    style={{ marginBottom: '14px' }}
                  >
                    <option value="">-- Choose Administrator --</option>
                    {members.filter(m => !m.isPrimaryAdmin && m.role !== 'STUDENT').map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.memberId} · {getRoleLabel(m.role)})</option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '11px', marginBottom: '6px' }}>
                  Your 6-Digit Master Security PIN or Password
                  <input
                    required
                    placeholder="Enter Security PIN or Password"
                    value={transferAuthCode}
                    onChange={e => setTransferAuthCode(e.target.value)}
                    style={{ width: '100%', height: '40px', padding: '0 12px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text-main)', marginBottom: '14px' }}
                  />
                </label>
                {transferError && <p className="member-form-error">{transferError}</p>}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" className="action-btn cancel-btn" onClick={() => setTransferModalOpen(false)}>Cancel</button>
                  <button type="submit" className="primary" style={{ minHeight: '36px', background: 'linear-gradient(105deg,#f59e0b,#d97706)' }}>
                    CONFIRM TRANSFER
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Bulk Account Creation Results Modal */}
        {bulkResultModal && (
          <div className="photo-lightbox" onClick={() => setBulkResultModal(null)}>
            <div className="guest-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
              <button className="lightbox-close" onClick={() => setBulkResultModal(null)}>✕</button>
              <h3 style={{ color: 'var(--text-main)', font: '700 20px Syne', margin: '0 0 8px' }}>
                Batch Account Creation Results
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '0 0 16px' }}>
                {bulkResultModal.message}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div style={{ background: 'var(--panel-subtle)', border: '1px solid rgba(5, 150, 105, 0.3)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                  <span style={{ color: '#059669', fontSize: '24px', fontWeight: 700, display: 'block' }}>{bulkResultModal.successCount}</span>
                  <small style={{ color: 'var(--brand-primary)', font: '600 10px "DM Mono", monospace' }}>SUCCESSFULLY CREATED</small>
                </div>
                <div style={{ background: bulkResultModal.failedCount > 0 ? '#fee2e2' : 'var(--panel-subtle)', border: bulkResultModal.failedCount > 0 ? '1px solid #fca5a5' : '1px solid var(--line)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                  <span style={{ color: bulkResultModal.failedCount > 0 ? '#b91c1c' : 'var(--text-dim)', fontSize: '24px', fontWeight: 700, display: 'block' }}>{bulkResultModal.failedCount}</span>
                  <small style={{ color: 'var(--text-muted)', font: '600 10px "DM Mono", monospace' }}>FAILED / SKIPPED</small>
                </div>
              </div>

              {bulkResultModal.failedItems && bulkResultModal.failedItems.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ color: '#b91c1c', font: '600 11px "DM Mono", monospace', display: 'block', marginBottom: '6px' }}>
                    FAILED STUDENT RECORDS ({bulkResultModal.failedItems.length})
                  </label>
                  <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #fca5a5', borderRadius: '6px', background: 'var(--bg-input)' }}>
                    <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#fee2e2', color: '#b91c1c', borderBottom: '1px solid #fca5a5' }}>
                          <th style={{ padding: '6px 10px', textAlign: 'left' }}>ROW</th>
                          <th style={{ padding: '6px 10px', textAlign: 'left' }}>ROLL NO / MEMBER ID</th>
                          <th style={{ padding: '6px 10px', textAlign: 'left' }}>NAME</th>
                          <th style={{ padding: '6px 10px', textAlign: 'left' }}>REASON</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkResultModal.failedItems.map((f, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--line)' }}>
                            <td style={{ padding: '6px 10px', color: 'var(--brand-primary)' }}>#{f.row}</td>
                            <td style={{ padding: '6px 10px', color: 'var(--text-main)', fontFamily: 'monospace' }}>{f.memberId}</td>
                            <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>{f.name}</td>
                            <td style={{ padding: '6px 10px', color: '#b91c1c' }}>{f.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <button className="primary" type="button" onClick={() => setBulkResultModal(null)} style={{ width: '100%', height: '42px', fontSize: '11px' }}>
                CLOSE SUMMARY
              </button>
            </div>
          </div>
        )}
      </section>
    </LivePortal>
  )
}
