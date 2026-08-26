import React, { useState } from 'react'
import { IconCrown } from '../../components/icons'
import { LivePortal } from '../../components/layout/LivePortal'
import { memberApi, readImageFile } from '../../lib/api'
import { getRoleLabel } from '../../lib/constants'

export function UniversalProfileView({ user, logout, onNavigate, onProfileUpdated }) {
  const [profile, setProfile] = useState(user.profile || {})
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [photoPreview, setPhotoPreview] = useState(user.profile?.profileImage || '')

  async function handleSave(e) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setMessage('')
    setError('')

    const rawAge = String(form.get('age') || '').trim()
    const payload = {
      name: String(form.get('name') || '').trim() || undefined,
      gender: String(form.get('gender') || 'MALE'),
      age: rawAge ? Number(rawAge) : null,
      phone: String(form.get('phone') || '').trim() || null,
      bio: String(form.get('bio') || '').trim() || null,
      instagramUrl: String(form.get('instagramUrl') || '').trim() || null,
      githubUrl: String(form.get('githubUrl') || '').trim() || null,
      linkedinUrl: String(form.get('linkedinUrl') || '').trim() || null,
      portfolioUrl: String(form.get('portfolioUrl') || '').trim() || null,
      skills: String(form.get('skills') || '').trim() || null,
      profileImage: photoPreview || null,
    }

    setSubmitting(true)
    try {
      const res = await memberApi.updateProfile(payload)
      setProfile(res.user.profile || {})
      if (onProfileUpdated) onProfileUpdated(res.user)
      setMessage('Profile and avatar updated successfully.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <LivePortal user={user} logout={logout} activeTab={user.isAdminUser ? 'admin-profile' : 'student-profile'} onNavigate={onNavigate} title="MY PROFILE">
      <section className="member-management">
        <div className="member-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate(user.isAdminUser ? 'admin-dashboard' : 'student-dashboard')}>
              ← BACK TO DASHBOARD
            </button>
            <p className="eyebrow">IDENTITY & AVATAR</p>
            <h1>Personal Profile & Avatar</h1>
            <p>Upload your profile photo and customize your bio, skills, and portfolios.</p>
          </div>
          <span className="president-lock">MEMBER ID: {user.memberId}</span>
        </div>

        {message && <p className="member-form-success">{message}</p>}
        {error && <p className="member-form-error">{error}</p>}

        <div className="member-management-grid">
          <article className="account-form-card" style={{ maxWidth: '640px' }}>
            <form onSubmit={handleSave}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '20px', padding: '14px', background: 'var(--panel-subtle)', borderRadius: '10px', border: '1px solid var(--line)' }}>
                {photoPreview ? (
                  <img src={photoPreview} alt="Profile" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--brand-primary)' }} />
                ) : (
                  <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg,#2488d8,#18447e)', display: 'grid', placeItems: 'center', color: '#fff', font: '700 24px Syne' }}>
                    {user.initials}
                  </div>
                )}
                <div>
                  <b style={{ color: 'var(--text-main)', fontSize: '14px', display: 'block' }}>Profile Photo</b>
                  <p style={{ color: 'var(--text-muted)', fontSize: '11px', margin: '2px 0 10px' }}>Upload a JPEG or PNG photo</p>
                  <label className="action-btn edit-btn" style={{ cursor: 'pointer', display: 'inline-block' }}>
                    Upload New Image
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) readImageFile(file, setPhotoPreview)
                      }}
                    />
                  </label>
                  {photoPreview && (
                    <button type="button" className="action-btn cancel-btn" onClick={() => setPhotoPreview('')} style={{ marginLeft: '8px' }}>
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <div className="member-form-grid">
                <label>
                  Full Name
                  <input name="name" defaultValue={profile.name || user.name} />
                </label>
                <label>
                  Phone Number
                  <input name="phone" defaultValue={profile.phone || ''} placeholder="Phone number" />
                </label>
                <label>
                  Gender
                  <select className="member-select" name="gender" defaultValue={profile.gender || 'MALE'}>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>
                <label>
                  Age
                  <input name="age" type="number" min={15} max={65} defaultValue={profile.age || ''} placeholder="Age (e.g. 20)" />
                </label>
                <label className="form-wide">
                  Short Bio
                  <input name="bio" defaultValue={profile.bio || ''} placeholder="e.g. Reverse engineering & CTF enthusiast" />
                </label>
                <label className="form-wide">
                  Cyber Security Skills
                  <input name="skills" defaultValue={profile.skills || ''} placeholder="e.g. Wireshark, Metasploit, Python, Reverse Engineering" />
                </label>
                <label>
                  GitHub Profile URL
                  <input name="githubUrl" defaultValue={profile.githubUrl || ''} placeholder="https://github.com/..." />
                </label>
                <label>
                  LinkedIn Profile URL
                  <input name="linkedinUrl" defaultValue={profile.linkedinUrl || ''} placeholder="https://linkedin.com/in/..." />
                </label>
              </div>

              <button className="primary member-submit" type="submit" disabled={submitting} style={{ marginTop: '18px', width: '100%' }}>
                {submitting ? 'SAVING PROFILE…' : 'SAVE PROFILE & AVATAR'}
              </button>
            </form>
          </article>

          {/* Profile Card Preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <article className="account-form-card" style={{ textAlign: 'center' }}>
              <p className="eyebrow">BADGE PREVIEW</p>
              <h2>My Member Badge</h2>
              <div style={{ marginTop: '20px', padding: '24px', background: 'var(--bg-input)', borderRadius: '12px', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {photoPreview ? (
                  <img src={photoPreview} alt="Profile" style={{ width: '96px', height: '96px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--brand-primary)', marginBottom: '14px' }} />
                ) : (
                  <div style={{ width: '96px', height: '96px', borderRadius: '50%', background: 'var(--brand-gradient)', display: 'grid', placeItems: 'center', color: 'var(--brand-text)', font: '700 30px Syne', marginBottom: '14px' }}>
                    {user.initials}
                  </div>
                )}
                <h3 style={{ margin: '0 0 4px', font: '700 20px Syne', color: 'var(--text-main)' }}>{profile.name || user.name}</h3>
                <span className={`badge ${user.isPrimaryAdmin ? 'badge-president' : user.role === 'STUDENT' ? 'badge-student' : 'badge-admin'}`} style={{ marginBottom: '10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  {user.isPrimaryAdmin ? <><IconCrown size={12} /> PRESIDENT</> : getRoleLabel(user.role)}
                </span>
                <p style={{ color: 'var(--brand-primary)', font: '500 11px "DM Mono", monospace', margin: '0 0 10px' }}>
                  MEMBER ID: {user.memberId}
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.6', margin: '0 0 14px' }}>
                  {profile.bio || 'Authorized member · Malla Reddy (MR) Deemed to be University.'}
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>
    </LivePortal>
  )
}
