import React, { useEffect, useRef, useState } from 'react'
import { GalleryLightbox } from '../../components/common/GalleryLightbox'
import { Icon8 } from '../../components/icons'
import { LivePortal } from '../../components/layout/LivePortal'
import { adminApi, readImageFile, readMultipleImageFiles } from '../../lib/api'

export function GalleryManagement({ user, logout, onNavigate }) {
  const [albums, setAlbums] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [selectedAlbum, setSelectedAlbum] = useState(null)
  const [albumCoverPreview, setAlbumCoverPreview] = useState('')
  const [stagedPhotos, setStagedPhotos] = useState([])
  const [batchCaption, setBatchCaption] = useState('')
  const [uploading, setUploading] = useState(false)
  const [activeLightbox, setActiveLightbox] = useState(null)
  const fileInputRef = useRef(null)

  const [albumName, setAlbumName] = useState('')
  const [albumDescription, setAlbumDescription] = useState('')
  const [creatingAlbum, setCreatingAlbum] = useState(false)
  const coverInputRef = useRef(null)

  useEffect(() => {
    let mounted = true
    adminApi.listGalleryAlbums()
      .then(({ albums: list }) => { if (mounted) setAlbums(list || []) })
      .catch(err => { if (mounted) setError(err.message) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  async function createAlbum(e) {
    e.preventDefault()
    if (!albumName.trim()) {
      setError('Please enter an album name.')
      return
    }
    setCreatingAlbum(true)
    setMessage('')
    setError('')
    try {
      const { album } = await adminApi.createGalleryAlbum({
        name: albumName.trim(),
        description: albumDescription.trim() || null,
        coverImage: albumCoverPreview || null,
      })
      setAlbums(c => [album, ...c])
      setSelectedAlbum(album)
      setAlbumName('')
      setAlbumDescription('')
      setAlbumCoverPreview('')
      if (coverInputRef.current) coverInputRef.current.value = ''
      setMessage(`Album "${album.name}" created successfully. You can now add photos to it.`)
      setTimeout(() => setMessage(''), 4000)
    } catch (err) {
      setError(err.message || 'Failed to create album.')
    } finally {
      setCreatingAlbum(false)
    }
  }

  async function handlePhotosSelected(e) {
    const files = e.target.files
    if (!files || files.length === 0) return
    setError('')
    try {
      const loaded = await readMultipleImageFiles(files)
      const newStaged = loaded.map(item => ({
        id: 'staged_' + Math.random().toString(36).slice(2, 9),
        name: item.name,
        size: item.size,
        dataUrl: item.dataUrl,
      }))
      setStagedPhotos(curr => [...curr, ...newStaged])
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      setError('Failed to read selected image files: ' + err.message)
    }
  }

  function removeStagedPhoto(id) {
    setStagedPhotos(curr => curr.filter(p => p.id !== id))
  }

  function clearStagedPhotos() {
    setStagedPhotos([])
    setBatchCaption('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function uploadStagedPhotos(e) {
    e.preventDefault()
    if (!selectedAlbum) return
    if (stagedPhotos.length === 0) {
      setError('Please select at least one photo to upload.')
      return
    }

    setUploading(true)
    setMessage('')
    setError('')

    try {
      const photosPayload = stagedPhotos.map(p => ({
        imageUrl: p.dataUrl,
        caption: batchCaption ? batchCaption.trim() : null,
      }))

      const res = await adminApi.addGalleryPhotos(selectedAlbum.id, photosPayload)
      const addedPhotos = res.photos || (res.photo ? [res.photo] : [])

      setSelectedAlbum(a => ({
        ...a,
        coverImage: a.coverImage || addedPhotos[0]?.imageUrl || null,
        photos: [...addedPhotos, ...(a.photos || [])],
      }))

      setAlbums(curr =>
        curr.map(a => {
          if (a.id === selectedAlbum.id) {
            return {
              ...a,
              coverImage: a.coverImage || addedPhotos[0]?.imageUrl || null,
              photos: [...addedPhotos, ...(a.photos || [])],
            }
          }
          return a
        })
      )

      clearStagedPhotos()
      setMessage(`✓ ${addedPhotos.length} photo${addedPhotos.length > 1 ? 's' : ''} uploaded successfully to "${selectedAlbum.name}".`)
      setTimeout(() => setMessage(''), 4000)
    } catch (err) {
      setError(err.message || 'Failed to upload photos.')
    } finally {
      setUploading(false)
    }
  }

  async function removeAlbum(albumId, e) {
    if (e) e.stopPropagation()
    if (!confirm('Are you sure you want to delete this album and all its photos?')) return
    try {
      await adminApi.deleteGalleryAlbum(albumId)
      setAlbums(c => c.filter(a => a.id !== albumId))
      if (selectedAlbum?.id === albumId) setSelectedAlbum(null)
      setMessage('Album deleted.')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setError(err.message)
    }
  }

  async function removePhoto(albumId, photoId, e) {
    if (e) e.stopPropagation()
    if (!confirm('Are you sure you want to delete this photo?')) return
    try {
      await adminApi.deleteGalleryPhoto(albumId, photoId)
      setSelectedAlbum(a => ({ ...a, photos: a.photos.filter(p => p.id !== photoId) }))
      setAlbums(c => c.map(a => (a.id === albumId ? { ...a, photos: a.photos.filter(p => p.id !== photoId) } : a)))
      if (activeLightbox?.id === photoId) setActiveLightbox(null)
      setMessage('Photo deleted.')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <LivePortal user={user} logout={logout} activeTab="admin-gallery" onNavigate={onNavigate} title="GALLERY STUDIO">
      <section className="gallery-section">
        <div className="event-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('admin-dashboard')}>
              ← COMMAND CENTER
            </button>
            <p className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Icon8 name="irisScan" size={14} /> VISUAL MEDIA REPOSITORY
            </p>
            <h1>Media & Gallery Studio</h1>
            <p>Create event photo albums, stage high-resolution batch uploads, and curate official club memories.</p>
          </div>
        </div>

        {message && <p className="member-form-success" style={{ marginBottom: '16px' }}>{message}</p>}
        {error && <p className="member-form-error" style={{ marginBottom: '16px' }}>{error}</p>}

        {/* Studio Command Grid (Create Album & Batch Uploader) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '20px', marginBottom: '32px' }}>
          
          {/* Card 1: Professional Create Photo Album Form */}
          <article className="account-form-card" style={{ padding: '24px', background: 'var(--panel-bg)', borderRadius: '16px', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <span style={{ display: 'inline-flex', padding: '8px', borderRadius: '10px', background: 'var(--brand-glow)', color: 'var(--brand-primary)' }}>
                <Icon8 name="irisScan" size={18} />
              </span>
              <div>
                <p className="eyebrow" style={{ margin: 0, fontSize: '10px', color: 'var(--brand-primary)', letterSpacing: '0.06em' }}>
                  NEW ALBUM
                </p>
                <h2 style={{ font: '700 18px Syne', color: 'var(--text-main)', margin: '2px 0 0' }}>
                  Create Photo Album
                </h2>
              </div>
            </div>

            <form onSubmit={createAlbum} style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px', letterSpacing: '0.02em' }}>
                  Album Name *
                </label>
                <input
                  required
                  placeholder="e.g. National Cyber Hackathon 2026 / Orientation Fest"
                  value={albumName}
                  onChange={e => setAlbumName(e.target.value)}
                  style={{ width: '100%', height: '40px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)', padding: '0 12px', fontSize: '12px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px', letterSpacing: '0.02em' }}>
                  Description / Event Context
                </label>
                <input
                  placeholder="e.g. Keynote speeches, live CTF rounds, and award ceremony..."
                  value={albumDescription}
                  onChange={e => setAlbumDescription(e.target.value)}
                  style={{ width: '100%', height: '40px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)', padding: '0 12px', fontSize: '12px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px', letterSpacing: '0.02em' }}>
                  Album Cover Image (Optional)
                </label>
                
                {albumCoverPreview ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: 'var(--bg-input)', borderRadius: '10px', border: '1px solid var(--brand-border-subtle)' }}>
                    <img
                      src={albumCoverPreview}
                      alt="Cover Preview"
                      style={{ width: '64px', height: '64px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--line)', flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b style={{ fontSize: '12px', color: 'var(--text-main)', display: 'block' }}>Cover Image Selected</b>
                      <small style={{ color: '#10b981', fontSize: '11px', display: 'block' }}>Ready to set as album hero thumbnail</small>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setAlbumCoverPreview(''); if (coverInputRef.current) coverInputRef.current.value = '' }}
                      style={{ background: 'transparent', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171', borderRadius: '6px', padding: '4px 8px', fontSize: '10px', cursor: 'pointer' }}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => coverInputRef.current?.click()}
                    style={{
                      border: '1px dashed var(--line)',
                      borderRadius: '10px',
                      padding: '16px',
                      textAlign: 'center',
                      background: 'var(--bg-input)',
                      cursor: 'pointer',
                      transition: 'border-color 0.2s ease',
                    }}
                  >
                    <Icon8 name="irisScan" size={24} style={{ color: 'var(--brand-primary)', opacity: 0.8, marginBottom: '6px' }} />
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-main)', fontWeight: 600 }}>Click to browse album cover</p>
                    <small style={{ color: 'var(--text-dim)', fontSize: '10px', display: 'block', marginTop: '2px' }}>PNG, JPG, or WEBP (Recommended ratio 16:9 or 4:3)</small>
                  </div>
                )}
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  onChange={e => { const f = e.target.files?.[0]; if (f) readImageFile(f, setAlbumCoverPreview) }}
                  style={{ display: 'none' }}
                />
              </div>

              <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
                <button
                  type="submit"
                  className="primary member-submit"
                  disabled={creatingAlbum}
                  style={{ width: '100%', height: '42px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em' }}
                >
                  {creatingAlbum ? 'CREATING ALBUM…' : '+ CREATE PHOTO ALBUM'}
                </button>
              </div>
            </form>
          </article>

          {/* Card 2: Professional Multiple Photo Uploader */}
          <article className="account-form-card" style={{ padding: '24px', background: 'var(--panel-bg)', borderRadius: '16px', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column' }}>
            {selectedAlbum ? (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <p className="eyebrow" style={{ margin: 0, fontSize: '10px', color: 'var(--brand-primary)', letterSpacing: '0.06em' }}>
                      BATCH PHOTO UPLOADER
                    </p>
                    <h2 style={{ font: '700 18px Syne', color: 'var(--text-main)', margin: '2px 0 0' }}>
                      Add Photos to "{selectedAlbum.name}"
                    </h2>
                  </div>
                  <span className="badge" style={{ background: 'var(--panel-subtle)', color: 'var(--brand-primary)', border: '1px solid var(--line)', padding: '3px 9px', fontSize: '11px' }}>
                    {selectedAlbum.photos?.length || 0} in album
                  </span>
                </div>

                <form onSubmit={uploadStagedPhotos} style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
                  {/* Multi-Photo Dropzone */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: '1px dashed var(--brand-primary)',
                      borderRadius: '12px',
                      padding: '18px',
                      textAlign: 'center',
                      background: 'var(--brand-badge-bg)',
                      cursor: 'pointer',
                    }}
                  >
                    <Icon8 name="irisScan" size={28} style={{ color: 'var(--brand-primary)', marginBottom: '6px' }} />
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-main)', fontWeight: 700 }}>
                      Click to choose photos (Select Single or Multiple)
                    </p>
                    <small style={{ color: 'var(--brand-primary)', fontSize: '10px', display: 'block', marginTop: '2px' }}>
                      JPG, PNG, WebP · High resolution supported
                    </small>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotosSelected}
                      style={{ display: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px', letterSpacing: '0.02em' }}>
                      Batch Caption (Optional)
                    </label>
                    <input
                      placeholder="e.g. Stage presentations, coding round, and award ceremony..."
                      value={batchCaption}
                      onChange={e => setBatchCaption(e.target.value)}
                      style={{ width: '100%', height: '40px', background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text-main)', padding: '0 12px', fontSize: '12px' }}
                    />
                  </div>

                  {/* Staged Photos Preview Grid */}
                  {stagedPhotos.length > 0 && (
                    <div style={{ background: 'var(--bg-input)', border: '1px solid var(--line)', borderRadius: '10px', padding: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <b style={{ color: 'var(--brand-primary)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          ✓ {stagedPhotos.length} Photo{stagedPhotos.length > 1 ? 's' : ''} Staged for Upload
                        </b>
                        <button
                          type="button"
                          onClick={clearStagedPhotos}
                          style={{ background: 'transparent', border: 0, color: '#f87171', fontSize: '10px', cursor: 'pointer', fontWeight: 600 }}
                        >
                          ✕ Clear All
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: '8px', maxHeight: '160px', overflowY: 'auto', paddingRight: '4px' }}>
                        {stagedPhotos.map(p => (
                          <div key={p.id} style={{ position: 'relative', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--line)', background: '#000' }}>
                            <img src={p.dataUrl} alt={p.name} style={{ width: '100%', height: '56px', objectFit: 'cover', display: 'block' }} />
                            <button
                              type="button"
                              onClick={() => removeStagedPhoto(p.id)}
                              title="Remove photo"
                              style={{
                                position: 'absolute',
                                top: '2px',
                                right: '2px',
                                width: '16px',
                                height: '16px',
                                borderRadius: '50%',
                                background: 'rgba(239, 68, 68, 0.9)',
                                color: '#fff',
                                border: 0,
                                fontSize: '9px',
                                display: 'grid',
                                placeItems: 'center',
                                cursor: 'pointer',
                                padding: 0,
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
                    <button
                      type="submit"
                      className="primary member-submit"
                      disabled={uploading || stagedPhotos.length === 0}
                      style={{ width: '100%', height: '42px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em' }}
                    >
                      {uploading
                        ? `UPLOADING ${stagedPhotos.length} PHOTO${stagedPhotos.length > 1 ? 'S' : ''}…`
                        : stagedPhotos.length > 0
                        ? `+ UPLOAD ${stagedPhotos.length} PHOTO${stagedPhotos.length > 1 ? 'S' : ''} TO ALBUM`
                        : 'SELECT PHOTOS TO UPLOAD'}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', flex: 1, padding: '24px 16px', background: 'var(--panel-subtle)', borderRadius: '12px', border: '1px dashed var(--line)' }}>
                <Icon8 name="irisScan" size={32} style={{ color: 'var(--brand-primary)', opacity: 0.6, marginBottom: '10px' }} />
                <h3 style={{ font: '700 16px Syne', color: 'var(--text-main)', margin: '0 0 4px' }}>
                  No Album Selected
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', maxWidth: '320px', lineHeight: 1.5 }}>
                  Select an existing album below to upload photos, or create a new album using the form on the left.
                </p>

                {albums.length > 0 && (
                  <div style={{ marginTop: '16px', width: '100%' }}>
                    <small style={{ display: 'block', fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                      Quick Select Recent Album:
                    </small>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
                      {albums.slice(0, 4).map(a => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => setSelectedAlbum(a)}
                          style={{
                            fontSize: '11px',
                            padding: '4px 10px',
                            borderRadius: '16px',
                            background: 'var(--bg-input)',
                            border: '1px solid var(--line)',
                            color: 'var(--text-main)',
                            cursor: 'pointer',
                          }}
                        >
                          {a.name} ({a.photos?.length || 0})
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </article>
        </div>

        {/* Albums Directory Section */}
        <div className="section-title" style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <p className="eyebrow" style={{ margin: '0 0 4px', fontSize: '10px', color: 'var(--brand-primary)', letterSpacing: '0.06em' }}>
              ALBUM DIRECTORY
            </p>
            <h2 style={{ font: '700 20px Syne', color: 'var(--text-main)', margin: 0 }}>
              All Albums ({albums.length})
            </h2>
          </div>
        </div>

        {loading ? (
          <p className="directory-state">Loading gallery albums...</p>
        ) : albums.length === 0 ? (
          <p className="directory-state">No albums created yet. Use the creation card above to create your first album.</p>
        ) : (
          <div className="gallery-grid" style={{ marginTop: '16px' }}>
            {albums.map(a => {
              const isSelected = selectedAlbum?.id === a.id
              return (
                <div
                  key={a.id}
                  className="album-card-box"
                  onClick={() => setSelectedAlbum(a)}
                  style={{
                    borderColor: isSelected ? 'var(--brand-primary)' : undefined,
                    boxShadow: isSelected ? '0 0 16px rgba(72, 183, 244, 0.25)' : undefined,
                    cursor: 'pointer',
                  }}
                >
                  <div className="album-cover">
                    {a.coverImage || a.photos?.[0]?.imageUrl ? (
                      <img src={a.coverImage || a.photos[0].imageUrl} alt={a.name} />
                    ) : (
                      <div className="album-cover-placeholder">{a.name.slice(0, 2).toUpperCase()}</div>
                    )}
                    <span className="album-photo-count">{a.photos?.length || 0} photos</span>
                  </div>
                  <div className="album-details">
                    <h3>{a.name}</h3>
                    <p>{a.description || 'Club photo collection'}</p>
                  </div>
                  <div style={{ padding: '8px 12px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <small style={{ color: isSelected ? 'var(--brand-primary)' : 'var(--text-dim)', fontWeight: isSelected ? 700 : 400 }}>
                      {isSelected ? '✓ Active Album' : 'Click to Manage'}
                    </small>
                    <button type="button" className="action-btn delete-btn" onClick={e => removeAlbum(a.id, e)} title="Delete entire album">
                      Delete
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Selected Album Photos Grid */}
        {selectedAlbum && (
          <div style={{ marginTop: '36px', borderTop: '1px solid var(--line)', paddingTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <p className="eyebrow" style={{ margin: '0 0 4px', fontSize: '10px', color: 'var(--brand-primary)', letterSpacing: '0.06em' }}>
                  ACTIVE ALBUM PHOTOS
                </p>
                <h2 style={{ font: '700 20px Syne', color: 'var(--text-main)', margin: 0 }}>
                  {selectedAlbum.name} ({selectedAlbum.photos?.length || 0} Photos)
                </h2>
              </div>
              <button type="button" className="action-btn delete-btn" onClick={e => removeAlbum(selectedAlbum.id, e)}>
                Delete Entire Album
              </button>
            </div>

            {(!selectedAlbum.photos || selectedAlbum.photos.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '36px 20px', background: 'var(--panel-subtle)', borderRadius: '12px', border: '1px dashed var(--line)', marginTop: '16px' }}>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
                  No photos uploaded to "{selectedAlbum.name}" yet. Use the Batch Photo Uploader above to add event photos.
                </p>
              </div>
            ) : (
              <div className="gallery-grid" style={{ marginTop: '16px' }}>
                {selectedAlbum.photos.map(p => (
                  <div key={p.id} className="album-card-box" style={{ position: 'relative' }}>
                    <div className="album-cover" onClick={() => setActiveLightbox(p)} style={{ cursor: 'pointer' }}>
                      <img src={p.imageUrl} alt={p.caption || 'Event'} />
                    </div>
                    {p.caption && (
                      <div className="album-details" onClick={() => setActiveLightbox(p)} style={{ cursor: 'pointer' }}>
                        <p>{p.caption}</p>
                      </div>
                    )}
                    <div style={{ padding: '6px 10px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end' }}>
                      <button type="button" className="action-btn delete-btn" onClick={e => removePhoto(selectedAlbum.id, p.id, e)}>
                        Remove Photo
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Lightbox Modal with Full Navigation */}
        {activeLightbox && (
          <GalleryLightbox
            photos={selectedAlbum?.photos || []}
            activePhoto={activeLightbox}
            albumName={selectedAlbum?.name}
            onClose={() => setActiveLightbox(null)}
            onSelectPhoto={p => setActiveLightbox(p)}
            onDeletePhoto={selectedAlbum ? (photoId, e) => removePhoto(selectedAlbum.id, photoId, e) : null}
          />
        )}
      </section>
    </LivePortal>
  )
}
