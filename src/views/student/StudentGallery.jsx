import React, { useEffect, useState } from 'react'
import { GalleryLightbox } from '../../components/common/GalleryLightbox'
import { LivePortal } from '../../components/layout/LivePortal'
import { usePlatformTheme } from '../../context/PlatformThemeContext'
import { memberApi } from '../../lib/api'

export function StudentGallery({ user, logout, onNavigate }) {
  const { platformMode } = usePlatformTheme()
  const isMrdu = platformMode === 'MRDU_EVENTS'
  const [albums, setAlbums] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedAlbum, setSelectedAlbum] = useState(null)
  const [loadingAlbum, setLoadingAlbum] = useState(false)
  const [activeLightbox, setActiveLightbox] = useState(null)

  useEffect(() => {
    let mounted = true
    memberApi.listGallery()
      .then(({ albums: list }) => { if (mounted) setAlbums(list || []) })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  async function handleOpenAlbum(album) {
    setSelectedAlbum(album)
    setLoadingAlbum(true)
    try {
      const res = await memberApi.getGalleryAlbum(album.id)
      if (res?.album) {
        setSelectedAlbum(res.album)
        setAlbums(curr => curr.map(a => (a.id === res.album.id ? res.album : a)))
      }
    } catch {
      // Fallback: keep local album photos if any
    } finally {
      setLoadingAlbum(false)
    }
  }

  return (
    <LivePortal user={user} logout={logout} activeTab="student-gallery" onNavigate={onNavigate} title={isMrdu ? 'MRDU EVENT GALLERY' : 'CLUB GALLERY'}>
      <section className="gallery-section">
        {selectedAlbum ? (
          // Opened Album View with all photos
          <div>
            <div className="event-heading" style={{ marginBottom: '20px' }}>
              <div>
                <button className="back-button" type="button" onClick={() => setSelectedAlbum(null)}>
                  ← BACK TO ALL ALBUMS
                </button>
                <p className="eyebrow">{isMrdu ? 'MRDU ALBUM SHOWCASE' : 'ALBUM SHOWCASE'}</p>
                <h1>{selectedAlbum.name}</h1>
                <p>{selectedAlbum.description || (isMrdu ? 'University event photo collection & highlights' : 'Club photo collection & highlights')}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="badge" style={{ background: '#0e2439', color: '#85d7ff', border: '1px solid #52bbf544', padding: '6px 12px', fontSize: '11px' }}>
                  {selectedAlbum.photos?.length || 0} Photos
                </span>
              </div>
            </div>

            {loadingAlbum ? (
              <p className="directory-state">Loading album photos...</p>
            ) : (!selectedAlbum.photos || selectedAlbum.photos.length === 0) ? (
              <article className="account-form-card" style={{ textAlign: 'center', padding: '40px 20px', color: '#8aa2b4' }}>
                <p style={{ margin: 0, fontSize: '13px' }}>No photos have been added to this album yet.</p>
              </article>
            ) : (
              <div className="gallery-grid">
                {selectedAlbum.photos.map(p => (
                  <div
                    key={p.id}
                    className="album-card-box"
                    onClick={() => setActiveLightbox(p)}
                    style={{ position: 'relative' }}
                    title="Click to view full-size photo"
                  >
                    <div className="album-cover">
                      <img src={p.imageUrl} alt={p.caption || selectedAlbum.name} />
                    </div>
                    {p.caption && (
                      <div className="album-details">
                        <p style={{ color: 'var(--text-main)', fontWeight: 500 }}>{p.caption}</p>
                      </div>
                    )}
                    <div style={{ padding: '6px 12px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <small style={{ color: 'var(--text-dim)', fontSize: '10px' }}>{new Date(p.createdAt).toLocaleDateString()}</small>
                      <small style={{ color: 'var(--brand-primary)', fontSize: '10px' }}>Expand</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          // Albums Directory List
          <div>
            <div className="event-heading">
              <div>
                <button className="back-button" type="button" onClick={() => onNavigate('student-dashboard')}>
                  ← BACK TO DASHBOARD
                </button>
                <p className="eyebrow">{isMrdu ? 'EVENT PHOTO ARCHIVES' : 'PHOTO MEMORIES'}</p>
                <h1>{isMrdu ? 'MRDU Events & Fests Gallery' : 'Cyber Security Club Gallery'}</h1>
                <p>{isMrdu ? 'Highlights, ceremonies, and celebrations across MRDU university events. Click any album to view photos.' : 'Highlights, award ceremonies, and lab workshops. Click any album to view its photos.'}</p>
              </div>
            </div>

            {loading ? (
              <p className="directory-state">Loading gallery albums...</p>
            ) : albums.length === 0 ? (
              <p className="directory-state">No albums published yet.</p>
            ) : (
              <div className="gallery-grid">
                {albums.map(a => (
                  <div
                    key={a.id}
                    className="album-card-box"
                    onClick={() => handleOpenAlbum(a)}
                    title={`Open "${a.name}" album`}
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
                      <p>{a.description || (isMrdu ? 'MRDU event photo highlights' : 'Club photo highlights')}</p>
                    </div>
                    <div style={{ padding: '8px 14px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <small style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>Open Album →</small>
                      <small style={{ color: 'var(--text-dim)' }}>{a.photos?.length || 0} photos</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Read-Only Photo Lightbox Modal with Full Navigation */}
        {activeLightbox && (
          <GalleryLightbox
            photos={selectedAlbum?.photos || []}
            activePhoto={activeLightbox}
            albumName={selectedAlbum?.name}
            onClose={() => setActiveLightbox(null)}
            onSelectPhoto={p => setActiveLightbox(p)}
          />
        )}
      </section>
    </LivePortal>
  )
}
