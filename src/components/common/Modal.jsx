import React, { useEffect } from 'react'

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = '540px',
  showCloseButton = true,
  closeOnBackdrop = true,
  headerAction = null,
}) {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'grid',
        placeItems: 'center',
        padding: '16px',
        zIndex: 1000,
        overflowY: 'auto',
      }}
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget && onClose) {
          onClose()
        }
      }}
    >
      <div
        className="modal-panel"
        style={{
          width: '100%',
          maxWidth,
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--line, #e2e8f0)',
          borderRadius: '16px',
          boxShadow: '0 20px 45px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          animation: 'fadeInModal 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || showCloseButton || headerAction) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '18px 22px',
              borderBottom: '1px solid var(--line, #e2e8f0)',
              background: 'var(--panel-subtle, #f8fafc)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {typeof title === 'string' ? (
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-main, #0f172a)' }}>
                  {title}
                </h3>
              ) : (
                title
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {headerAction}
              {showCloseButton && onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="outline"
                  aria-label="Close dialog"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: '18px',
                    lineHeight: 1,
                    padding: '6px 10px',
                    borderRadius: '8px',
                    color: 'var(--text-muted, #64748b)',
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )}

        <div style={{ padding: '22px', overflowY: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
