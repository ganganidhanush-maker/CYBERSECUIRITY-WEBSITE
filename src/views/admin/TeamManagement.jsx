import React, { useEffect, useState } from 'react'
import { IconDownload } from '../../components/icons'
import { LivePortal } from '../../components/layout/LivePortal'
import { adminApi, readImageFile } from '../../lib/api'
import { downloadCsv } from '../../lib/export-csv'

export function TeamManagement({ user, logout, onNavigate }) {
  const [team, setTeam] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [photoPreview, setPhotoPreview] = useState('')
  const [editingMember, setEditingMember] = useState(null)
  const [editPhotoPreview, setEditPhotoPreview] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function loadTeam() {
    setLoading(true)
    adminApi.listClubTeam()
      .then(({ team: list }) => {
        const sorted = (list || []).slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        setTeam(sorted)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadTeam()
  }, [])

  async function createMember(e) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setMessage('')
    setError('')
    try {
      const { member } = await adminApi.createClubTeamMember({
        name: String(form.get('name') || '').trim(),
        roleTitle: String(form.get('roleTitle') || '').trim(),
        collegeEmail: String(form.get('collegeEmail') || '').trim() || null,
        bio: String(form.get('bio') || '').trim() || null,
        photoUrl: photoPreview || null,
        instagramUrl: String(form.get('instagramUrl') || '').trim() || null,
        linkedinUrl: String(form.get('linkedinUrl') || '').trim() || null,
        githubUrl: String(form.get('githubUrl') || '').trim() || null,
        sortOrder: team.length + 1,
      })
      setTeam(c => [...c, member])
      e.currentTarget.reset()
      setPhotoPreview('')
      setMessage(`Added ${member.name} to leadership council.`)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleUpdateMember(e) {
    e.preventDefault()
    if (!editingMember) return
    const form = new FormData(e.currentTarget)
    setMessage('')
    setError('')
    setSubmitting(true)
    try {
      const payload = {
        name: String(form.get('name') || '').trim(),
        roleTitle: String(form.get('roleTitle') || '').trim(),
        collegeEmail: String(form.get('collegeEmail') || '').trim() || null,
        bio: String(form.get('bio') || '').trim() || null,
        photoUrl: editPhotoPreview || editingMember.photoUrl || null,
        instagramUrl: String(form.get('instagramUrl') || '').trim() || null,
        linkedinUrl: String(form.get('linkedinUrl') || '').trim() || null,
        githubUrl: String(form.get('githubUrl') || '').trim() || null,
      }
      const { member: updated } = await adminApi.updateClubTeamMember(editingMember.id, payload)
      setTeam(c => c.map(m => (m.id === editingMember.id ? updated : m)))
      setEditingMember(null)
      setEditPhotoPreview('')
      setMessage(`Profile updated for ${updated.name}. Changes reflected across the website.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function moveMember(index, direction) {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= team.length) return
    const updated = [...team]
    const [moved] = updated.splice(index, 1)
    updated.splice(targetIndex, 0, moved)
    setTeam(updated)
    setMessage('')
    setError('')

    try {
      await adminApi.reorderClubTeam(updated.map(m => m.id))
      setMessage(`Priority order updated: ${moved.name} is now #${targetIndex + 1}.`)
    } catch (err) {
      setError(err.message || 'Failed to save priority order.')
      loadTeam()
    }
  }

  async function removeMember(id) {
    if (!confirm('Are you sure you want to remove this leader profile?')) return
    try {
      await adminApi.deleteClubTeamMember(id)
      setTeam(c => c.filter(m => m.id !== id))
      setMessage('Team member removed.')
    } catch (err) {
      setError(err.message)
    }
  }

  function handleDownloadLeadersCsv() {
    const headers = [
      'Priority #',
      'Full Name',
      'Council Role Title',
      'Official Email',
      'Short Bio',
      'LinkedIn URL',
      'GitHub URL',
      'Instagram URL',
    ]
    const rows = team.map((l, idx) => [
      idx + 1,
      l.name,
      l.roleTitle,
      l.collegeEmail,
      l.bio,
      l.linkedinUrl,
      l.githubUrl,
      l.instagramUrl,
    ])
    downloadCsv('club_leadership_directory.csv', headers, rows)
  }

  return (
    <LivePortal user={user} logout={logout} activeTab="admin-team" onNavigate={onNavigate} title="TEAM LEADERSHIP">
      <section className="member-management">
        <div className="member-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('admin-dashboard')}>
              ← COMMAND CENTER
            </button>
            <p className="eyebrow">COUNCIL SHOWCASE & PRIORITY</p>
            <h1>Team & Leadership Showcase</h1>
            <p>Manage public club council member profiles, edit leader info, and configure display priority order.</p>
          </div>
          <button
            type="button"
            className="outline"
            onClick={handleDownloadLeadersCsv}
            disabled={team.length === 0}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '6px 12px' }}
            title="Download leadership directory as CSV"
          >
            <IconDownload size={14} /> DOWNLOAD LEADERS CSV
          </button>
        </div>

        {message && <p className="member-form-success">{message}</p>}
        {error && <p className="member-form-error">{error}</p>}

        <div className="member-management-grid">
          <article className="account-form-card">
            <p className="eyebrow">NEW LEADER</p>
            <h2>Add Council Member</h2>
            <form onSubmit={createMember}>
              <div className="member-form-grid">
                <label>
                  Full Name *
                  <input name="name" required placeholder="Leader Name" />
                </label>
                <label>
                  Council Role Title *
                  <input name="roleTitle" required placeholder="e.g. Head of Cyber Defense" />
                </label>
                <label>
                  Official Email
                  <input name="collegeEmail" type="email" placeholder="leader@college.edu" />
                </label>
                <label>
                  Profile Photo
                  <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) readImageFile(f, setPhotoPreview) }} />
                </label>
                <label className="form-wide">
                  Short Bio
                  <input name="bio" placeholder="Specialization & achievements..." />
                </label>
                <label>
                  LinkedIn URL
                  <input name="linkedinUrl" placeholder="https://linkedin.com/in/..." />
                </label>
                <label>
                  GitHub URL
                  <input name="githubUrl" placeholder="https://github.com/..." />
                </label>
              </div>

              {photoPreview && (
                <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <img src={photoPreview} alt="Preview" style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #52bbf5' }} />
                  <button type="button" className="action-btn delete-btn" onClick={() => setPhotoPreview('')}>Remove Photo</button>
                </div>
              )}

              <button className="primary member-submit" style={{ marginTop: '14px' }}>
                ＋ &nbsp; ADD LEADER PROFILE
              </button>
            </form>
          </article>

          <article className="member-list-card">
            <div className="card-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <p className="eyebrow">COUNCIL ROSTER & DISPLAY PRIORITY</p>
                <h2>Active Leaders ({team.length})</h2>
              </div>
              <button
                type="button"
                className="outline"
                onClick={handleDownloadLeadersCsv}
                disabled={team.length === 0}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '6px 12px' }}
                title="Download leadership directory as CSV"
              >
                <IconDownload size={14} /> DOWNLOAD LEADERS CSV
              </button>
            </div>
            <p style={{ color: '#7e95a7', fontSize: '11px', margin: '4px 0 14px' }}>
              Use <b>▲ Up</b> and <b>▼ Down</b> to control display priority on the website and the onboarding fallback slideshow.
            </p>

            {loading ? (
              <p className="directory-state">Loading team...</p>
            ) : team.length === 0 ? (
              <p className="directory-state">No leadership profiles added yet.</p>
            ) : (
              <div className="team-grid" style={{ marginTop: '16px' }}>
                {team.map((l, idx) => (
                  <div className="leader-card" key={l.id}>
                    {/* Header with Priority Order Badge and Reorder Buttons */}
                    <div className="leader-card-header">
                      <span className="leader-order-badge">#{idx + 1} PRIORITY</span>
                      <div className="leader-order-controls">
                        <button
                          type="button"
                          className="order-btn"
                          disabled={idx === 0}
                          onClick={() => moveMember(idx, -1)}
                          title="Move Up in Priority"
                        >
                          ▲ Up
                        </button>
                        <button
                          type="button"
                          className="order-btn"
                          disabled={idx === team.length - 1}
                          onClick={() => moveMember(idx, 1)}
                          title="Move Down in Priority"
                        >
                          ▼ Down
                        </button>
                      </div>
                    </div>

                    {l.photoUrl ? (
                      <img className="leader-photo" src={l.photoUrl} alt={l.name} />
                    ) : (
                      <div className="leader-photo-placeholder">{l.name.slice(0, 2).toUpperCase()}</div>
                    )}
                    <b style={{ color: 'var(--text-main)', fontSize: '15px' }}>{l.name}</b>
                    <small style={{ color: 'var(--brand-primary)', font: '600 10px "DM Mono", monospace', margin: '4px 0' }}>{l.roleTitle}</small>
                    <p style={{ color: 'var(--text-muted)', fontSize: '11px', margin: '6px 0 12px' }}>{l.bio || 'No bio provided.'}</p>

                    <div className="leader-card-actions">
                      <button
                        type="button"
                        className="action-btn edit-btn"
                        onClick={() => {
                          setEditingMember(l)
                          setEditPhotoPreview(l.photoUrl || '')
                        }}
                      >
                        Edit Profile
                      </button>
                      <button
                        type="button"
                        className="action-btn delete-btn"
                        onClick={() => removeMember(l.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>

        {/* Edit Leader Profile Modal */}
        {editingMember && (
          <div className="photo-lightbox" onClick={() => setEditingMember(null)}>
            <div className="guest-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px' }}>
              <button className="lightbox-close" onClick={() => setEditingMember(null)}>✕</button>
              <p className="eyebrow">UPDATE COUNCIL PROFILE</p>
              <h3 style={{ color: 'var(--text-main)', font: '700 20px Syne', margin: '4px 0 8px' }}>
                Edit Leader Profile: {editingMember.name}
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '11px', margin: '0 0 16px' }}>
                Changes will immediately update across the website and in the onboarding briefing slideshow.
              </p>

              <form onSubmit={handleUpdateMember}>
                <div className="member-form-grid">
                  <label>
                    Full Name *
                    <input name="name" required defaultValue={editingMember.name} />
                  </label>
                  <label>
                    Council Role Title *
                    <input name="roleTitle" required defaultValue={editingMember.roleTitle} />
                  </label>
                  <label>
                    Official Email
                    <input name="collegeEmail" type="email" defaultValue={editingMember.collegeEmail || ''} />
                  </label>
                  <label>
                    Update Photo
                    <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) readImageFile(f, setEditPhotoPreview) }} />
                  </label>
                  <label className="form-wide">
                    Short Bio
                    <input name="bio" defaultValue={editingMember.bio || ''} placeholder="Specialization & achievements..." />
                  </label>
                  <label>
                    LinkedIn URL
                    <input name="linkedinUrl" defaultValue={editingMember.linkedinUrl || ''} placeholder="https://linkedin.com/in/..." />
                  </label>
                  <label>
                    GitHub URL
                    <input name="githubUrl" defaultValue={editingMember.githubUrl || ''} placeholder="https://github.com/..." />
                  </label>
                </div>

                {editPhotoPreview && (
                  <div style={{ margin: '12px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img src={editPhotoPreview} alt="Preview" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #52bbf5' }} />
                    <button type="button" className="action-btn delete-btn" onClick={() => setEditPhotoPreview('')}>Remove Photo</button>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                  <button type="button" className="action-btn cancel-btn" style={{ flex: 1 }} onClick={() => setEditingMember(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="primary" style={{ flex: 2, minHeight: '40px', fontSize: '11px' }} disabled={submitting}>
                    {submitting ? 'SAVING CHANGES…' : '✓ SAVE PROFILE CHANGES'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </section>
    </LivePortal>
  )
}
