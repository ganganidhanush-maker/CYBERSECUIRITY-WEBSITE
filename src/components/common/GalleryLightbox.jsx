import React, { useEffect, useState } from 'react'

export function GalleryLightbox({ photos = [], activePhoto, onClose, onSelectPhoto, onDeletePhoto, albumName }) {
  const [currentIndex, setCurrentIndex] = useState(() => {
    const idx = photos.findIndex(p => p.id === activePhoto?.id)
    return idx >= 0 ? idx : 0
  })

  useEffect(() => {
    if (activePhoto) {
      const idx = photos.findIndex(p => p.id === activePhoto.id)
      if (idx >= 0) setCurrentIndex(idx)
    }
  }, [activePhoto, photos])

  const currentPhoto = photos[currentIndex] || activePhoto
  const totalCount = photos.length || (currentPhoto ? 1 : 0)

  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < photos.length - 1

  function handlePrev(e) {
    if (e) e.stopPropagation()
    if (hasPrev) {
      const nextIdx = currentIndex - 1
      setCurrentIndex(nextIdx)
      if (onSelectPhoto && photos[nextIdx]) onSelectPhoto(photos[nextIdx])
    }
  }

  function handleNext(e) {
    if (e) e.stopPropagation()
    if (hasNext) {
      const nextIdx = currentIndex + 1
      setCurrentIndex(nextIdx)
      if (onSelectPhoto && photos[nextIdx]) onSelectPhoto(photos[nextIdx])
    }
  }

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'ArrowLeft') handlePrev()
      else if (e.key === 'ArrowRight') handleNext()
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentIndex, photos, hasPrev, hasNext])

  if (!currentPhoto) return null

  return (
    <div className="photo-lightbox" onClick={onClose}>
      <div className="photo-lightbox-content" onClick={e => e.stopPropagation()}>
        {/* Header Bar */}
        <div className="lightbox-header-bar">
          <span className="lightbox-counter-badge">
            PHOTO {totalCount > 0 ? currentIndex + 1 : 1} OF {totalCount}
          </span>
          <button className="lightbox-close" onClick={onClose} title="Close (Esc)">✕</button>
        </div>

        {/* Main Photo Area with Left/Right Navigation Buttons */}
        <div className="photo-lightbox-main">
          {photos.length > 1 && (
            <button
              type="button"
              className="lightbox-nav-btn prev"
              onClick={handlePrev}
              disabled={!hasPrev}
              title="Previous Photo (← Left Arrow)"
            >
              ‹
            </button>
          )}

          <img src={currentPhoto.imageUrl} alt={currentPhoto.caption || albumName || 'Gallery Photo'} />

          {photos.length > 1 && (
            <button
              type="button"
              className="lightbox-nav-btn next"
              onClick={handleNext}
              disabled={!hasNext}
              title="Next Photo (→ Right Arrow)"
            >
              ›
            </button>
          )}
        </div>

        {/* Caption, Date & Admin Actions */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', padding: '0 6px' }}>
          <div>
            <p style={{ color: 'var(--text-main)', margin: 0, fontSize: '13px', fontWeight: 600 }}>
              {currentPhoto.caption || albumName || 'Club Gallery Photo'}
            </p>
            <small style={{ color: 'var(--brand-primary)', fontSize: '10px' }}>
              {currentPhoto.createdAt ? new Date(currentPhoto.createdAt).toLocaleDateString() : ''}
            </small>
          </div>

          {onDeletePhoto && (
            <button
              type="button"
              className="action-btn delete-btn"
              onClick={e => onDeletePhoto(currentPhoto.id, e)}
              style={{ padding: '5px 12px', fontSize: '11px' }}
            >
              Delete Photo
            </button>
          )}
        </div>

        {/* Miniature Thumbnails Strip */}
        {photos.length > 1 && (
          <div className="lightbox-thumbnail-strip">
            {photos.map((p, idx) => (
              <div
                key={p.id}
                className={`lightbox-thumb ${idx === currentIndex ? 'active' : ''}`}
                onClick={() => {
                  setCurrentIndex(idx)
                  if (onSelectPhoto) onSelectPhoto(p)
                }}
                title={p.caption || `Photo ${idx + 1}`}
              >
                <img src={p.imageUrl} alt={`Thumbnail ${idx + 1}`} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
