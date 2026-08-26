import jsQR from 'jsqr'
import React, { useEffect, useRef, useState } from 'react'
import {
  Icon8,
  IconCalendar,
  IconCreditCard,
  IconLocationPin,
} from '../../components/icons'
import { LivePortal } from '../../components/layout/LivePortal'
import { usePlatformTheme } from '../../context/PlatformThemeContext'
import { adminApi } from '../../lib/api'

export function AdminQrScanner({ user, logout, onNavigate }) {
  const { platformMode } = usePlatformTheme()
  const isMrdu = platformMode === 'MRDU_EVENTS'

  const [inputCode, setInputCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [scanResult, setScanResult] = useState(null)
  const [recentScans, setRecentScans] = useState([])
  const [cameraActive, setCameraActive] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [laserActive, setLaserActive] = useState(false)

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const animFrameRef = useRef(null)
  const lastScannedRef = useRef({ code: '', time: 0 })
  const fileInputRef = useRef(null)

  function playScanBeep() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      gain.gain.setValueAtTime(0.2, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.16)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.16)
      navigator.vibrate?.([90])
    } catch {}
  }

  // Real-time Camera Stream and jsQR Frame Processor
  useEffect(() => {
    if (!cameraActive) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
        animFrameRef.current = null
      }
      return
    }

    let isMounted = true

    async function startCamera() {
      setError('')
      try {
        const constraints = {
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        }
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        if (!isMounted) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.setAttribute('playsinline', 'true')
          await videoRef.current.play().catch(() => {})
        }

        // Set up continuous canvas-based decoding with jsQR
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d', { willReadFrequently: true })

        function scanTick() {
          if (!isMounted) return

          const video = videoRef.current
          if (video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight

            // 1. Direct raw frame pass
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            const rawData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            let code = jsQR(rawData.data, rawData.width, rawData.height, {
              inversionAttempts: 'attemptBoth',
            })

            // 2. Horizontal Flip Pass (in case pass is mirrored)
            if (!code) {
              ctx.clearRect(0, 0, canvas.width, canvas.height)
              ctx.save()
              ctx.translate(canvas.width, 0)
              ctx.scale(-1, 1)
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
              ctx.restore()
              const flippedH = ctx.getImageData(0, 0, canvas.width, canvas.height)
              code = jsQR(flippedH.data, flippedH.width, flippedH.height, {
                inversionAttempts: 'attemptBoth',
              })
            }

            if (code && code.data && code.data.trim()) {
              const detected = code.data.trim()
              const now = Date.now()
              if (detected !== lastScannedRef.current.code || now - lastScannedRef.current.time > 2500) {
                lastScannedRef.current = { code: detected, time: now }
                playScanBeep()
                setLaserActive(true)
                setTimeout(() => setLaserActive(false), 800)
                handleProcessScan(detected)
              }
            }
          }

          animFrameRef.current = requestAnimationFrame(scanTick)
        }

        animFrameRef.current = requestAnimationFrame(scanTick)
      } catch (err) {
        setError(`Camera access error: ${err.message || 'Please allow camera permission or use manual/file upload input.'}`)
        setCameraActive(false)
      }
    }

    startCamera()

    return () => {
      isMounted = false
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
        animFrameRef.current = null
      }
    }
  }, [cameraActive])

  async function handleProcessScan(codeToScan) {
    const rawCode = String(codeToScan || '').trim()
    if (!rawCode) return

    setLoading(true)
    setError('')
    setSuccessMessage('')

    try {
      const res = await adminApi.scanQrCode(rawCode)
      setScanResult(res)

      // Add to recent scans
      const attendeeName = res.scanType === 'EVENT_PASS'
        ? (res.registration?.user?.name || res.registration?.user?.memberId)
        : (res.event?.title || 'Event')
      const eventOrId = res.scanType === 'EVENT_PASS'
        ? res.registration?.event?.title
        : `Event · ${res.event?.venue || 'Campus'}`

      setRecentScans(prev => [
        {
          id: Date.now(),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          name: attendeeName,
          type: res.scanType,
          info: eventOrId,
          alreadyCheckedIn: Boolean(res.registration?.attendanceMarked),
        },
        ...prev.slice(0, 9),
      ])
    } catch (err) {
      const msg = err.message && err.message !== 'Request failed.'
        ? err.message
        : 'Unrecognized Event Pass QR. Please ensure this pass is for a registered event attendee.'
      setError(msg)
      setScanResult(null)
    } finally {
      setLoading(false)
    }
  }

  function handleManualSubmit(e) {
    e.preventDefault()
    if (!inputCode.trim()) return
    handleProcessScan(inputCode.trim())
    setInputCode('')
  }

  // Upload and decode QR from saved photo / screenshot
  function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setSuccessMessage('')

    const reader = new FileReader()
    reader.onload = evt => {
      const img = new Image()
      img.onload = () => {
        const c = document.createElement('canvas')
        c.width = img.width
        c.height = img.height
        const cCtx = c.getContext('2d')
        cCtx.drawImage(img, 0, 0)
        const imgData = cCtx.getImageData(0, 0, c.width, c.height)
        let decoded = jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts: 'attemptBoth' })

        // If not found, try horizontal flip
        if (!decoded) {
          cCtx.save()
          cCtx.translate(c.width, 0)
          cCtx.scale(-1, 1)
          cCtx.drawImage(img, 0, 0)
          cCtx.restore()
          const flippedData = cCtx.getImageData(0, 0, c.width, c.height)
          decoded = jsQR(flippedData.data, flippedData.width, flippedData.height, { inversionAttempts: 'attemptBoth' })
        }

        if (decoded && decoded.data) {
          playScanBeep()
          handleProcessScan(decoded.data)
        } else {
          setError('No readable QR code detected in the uploaded image. Please ensure the QR code is clear and in focus.')
        }
      }
      img.src = evt.target.result
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function handleGrantEntry(regId) {
    if (!regId) return
    setActionLoading(true)
    setError('')
    setSuccessMessage('')

    try {
      const res = await adminApi.grantEventEntry(regId)
      setSuccessMessage(res.message || '✓ Entry granted & attendance verified successfully!')

      // Update current scanResult state
      setScanResult(curr => {
        if (!curr) return null
        if (curr.scanType === 'EVENT_PASS' && curr.registration?.id === regId) {
          return {
            ...curr,
            registration: {
              ...curr.registration,
              attendanceMarked: true,
              attendedAt: new Date().toISOString(),
              attendanceVerifiedBy: user.memberId || user.name || 'Coordinator',
            },
          }
        }
        return curr
      })
    } catch (err) {
      setError(err.message || 'Failed to grant entry.')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <LivePortal user={user} logout={logout} activeTab="admin-qr-scanner" onNavigate={onNavigate} title="EVENT PASS GATE SCANNER">
      <section className="member-management">
        <div className="member-heading">
          <div>
            <button className="back-button" type="button" onClick={() => onNavigate('admin-events')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              ← BACK TO EVENT MANAGEMENT
            </button>
            <p className="eyebrow">EVENT TICKET VERIFICATION & GATE ENTRY</p>
            <h1>Event Pass QR Scanner</h1>
            <p>Scan attendee Event QR passes to verify registration credentials, confirm payment, and record entrance attendance.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
            <button
              type="button"
              className="outline"
              onClick={() => fileInputRef.current?.click()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '8px 14px' }}
              title="Upload an image or screenshot of a QR pass"
            >
              <Icon8 name="document" size={16} /> UPLOAD PASS IMAGE
            </button>
            <button
              type="button"
              className={cameraActive ? 'primary' : 'outline'}
              onClick={() => setCameraActive(a => !a)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '8px 14px' }}
            >
              <Icon8 name="irisScan" size={16} /> {cameraActive ? 'STOP CAMERA SCANNER' : 'START CAMERA SCANNER'}
            </button>
            <button
              type="button"
              className="outline"
              onClick={() => onNavigate('admin-events')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '8px 14px' }}
            >
              <IconCalendar size={14} /> EVENTS CATALOG
            </button>
          </div>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef444466', color: '#fca5a5', fontSize: '13px', margin: '0 0 16px' }}>
            {error}
          </div>
        )}

        {successMessage && (
          <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b98166', color: '#6ee7b7', fontSize: '13px', margin: '0 0 16px', fontWeight: 600 }}>
            {successMessage}
          </div>
        )}

        <div className="member-management-grid">
          {/* Left Column: Scanner View & Manual Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Camera Viewport */}
            {cameraActive ? (
              <article className="account-form-card" style={{ padding: '16px', textAlign: 'center', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981' }} />
                    LIVE SCANNER ACTIVE (DEFAULT MIRROR)
                  </span>
                </div>

                <div style={{ position: 'relative', width: '100%', height: '280px', background: '#000', borderRadius: '12px', overflow: 'hidden', border: laserActive ? '2px solid #10b981' : '2px solid var(--brand-primary)', boxShadow: laserActive ? '0 0 24px rgba(16, 185, 129, 0.5)' : 'none', transition: 'all 0.2s' }}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transform: 'scaleX(-1)',
                      transition: 'transform 0.2s ease',
                    }}
                  />
                  {/* Cyber Target Overlay */}
                  <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
                    <div style={{ width: '190px', height: '190px', border: laserActive ? '2px solid #10b981' : `2px dashed ${isMrdu ? '#d32f2f' : '#52bbf5'}`, borderRadius: '12px', boxShadow: laserActive ? '0 0 25px #10b981' : `0 0 20px ${isMrdu ? 'rgba(211,47,47,0.4)' : 'rgba(82,187,245,0.3)'}` }} />
                  </div>
                  {/* Laser Scan line */}
                  <div
                    style={{
                      position: 'absolute',
                      left: '10%',
                      right: '10%',
                      height: '2px',
                      background: laserActive ? '#10b981' : `linear-gradient(90deg, transparent, ${isMrdu ? '#ef5350' : '#38bdf8'}, transparent)`,
                      boxShadow: laserActive ? '0 0 14px #10b981' : `0 0 12px ${isMrdu ? '#d32f2f' : '#38bdf8'}`,
                      top: '50%',
                      animation: 'scanline 2s ease-in-out infinite alternate',
                    }}
                  />
                </div>
                <small style={{ display: 'block', marginTop: '8px', color: 'var(--text-muted)', fontSize: '11px' }}>
                  Point camera steadily at the Event Pass QR code · Auto-decoder is active
                </small>
              </article>
            ) : null}

            {/* Manual / USB Barcode Scanner Input */}
            <article className="account-form-card">
              <p className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Icon8 name="captcha" size={14} /> DIRECT PASS LOOKUP
              </p>
              <h3 style={{ margin: '4px 0 12px', color: 'var(--text-main)' }}>USB Barcode Scanner or Pass ID</h3>
              <form onSubmit={handleManualSubmit}>
                <div className="login-field-group">
                  <label style={{ color: 'var(--text-dim)', fontSize: '11px' }}>
                    Scan Event QR Code or Enter Pass ID / Member ID
                  </label>
                  <div className="login-input-wrapper">
                    <span className="login-input-icon"><Icon8 name="irisScan" size={16} /></span>
                    <input
                      type="text"
                      placeholder="e.g. EVENT_PASS:... or registration ID"
                      value={inputCode}
                      onChange={e => setInputCode(e.target.value)}
                      autoFocus
                      style={{ background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '13px' }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                  <button
                    type="button"
                    className="outline"
                    onClick={() => fileInputRef.current?.click()}
                    style={{ flex: 1, height: '40px', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <Icon8 name="document" size={14} /> UPLOAD FILE
                  </button>
                  <button
                    type="submit"
                    className="primary"
                    disabled={loading || !inputCode.trim()}
                    style={{ flex: 2, height: '40px', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    <Icon8 name="authentication" size={16} />
                    {loading ? 'VERIFYING PASS…' : 'VERIFY EVENT PASS ➔'}
                  </button>
                </div>
              </form>
            </article>

            {/* Recent Scans Session Feed */}
            {recentScans.length > 0 && (
              <article className="account-form-card" style={{ padding: '16px' }}>
                <p className="eyebrow" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Icon8 name="realtime" size={14} /> LIVE GATE LOG
                </p>
                <h4 style={{ margin: '4px 0 12px', fontSize: '13px', color: 'var(--text-main)' }}>Recent Pass Scans in This Session</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                  {recentScans.map(s => (
                    <div
                      key={s.id}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: 'var(--panel-subtle)',
                        border: '1px solid var(--line)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '11px',
                      }}
                    >
                      <div>
                        <b style={{ color: 'var(--text-main)' }}>{s.name}</b>
                        <small style={{ display: 'block', color: 'var(--text-muted)' }}>{s.info}</small>
                      </div>
                      <span className="badge" style={{ background: s.alreadyCheckedIn ? '#78350f' : '#064e3b', color: s.alreadyCheckedIn ? '#fde68a' : '#6ee7b7', fontSize: '9px' }}>
                        {s.time}
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            )}
          </div>

          {/* Right Column: Event Pass Scan Result & Entry Action */}
          <div>
            {scanResult ? (
              <article
                className="account-form-card"
                style={{
                  padding: '24px',
                  border: scanResult.scanType === 'EVENT_PASS' && scanResult.registration?.attendanceMarked ? '2px solid #ef4444' : '2px solid var(--brand-primary)',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                }}
              >
                {/* EVENT PASS SCAN RESULT */}
                {scanResult.scanType === 'EVENT_PASS' && (
                  <div>
                    {/* Header Alert Banner */}
                    {scanResult.registration.attendanceMarked ? (
                      <div
                        style={{
                          padding: '14px',
                          borderRadius: '10px',
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid #ef4444',
                          color: '#fca5a5',
                          marginBottom: '20px',
                        }}
                      >
                        <b style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Icon8 name="protect" size={18} /> DUPLICATE ENTRY PROHIBITED
                        </b>
                        <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#fecaca' }}>
                          Attendance was <b>already granted</b> for this pass on{' '}
                          {scanResult.registration.attendedAt ? new Date(scanResult.registration.attendedAt).toLocaleString() : 'earlier'}{' '}
                          by <b>{scanResult.registration.attendanceVerifiedBy || 'Coordinator'}</b>.
                        </p>
                      </div>
                    ) : (
                      <div
                        style={{
                          padding: '14px',
                          borderRadius: '10px',
                          background: 'rgba(16, 185, 129, 0.15)',
                          border: '1px solid #10b981',
                          color: '#6ee7b7',
                          marginBottom: '20px',
                        }}
                      >
                        <b style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Icon8 name="authentication" size={18} /> VALID EVENT PASS — READY FOR ENTRY
                        </b>
                        <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#a7f3d0' }}>
                          Registration verified in system records. Click below to admit attendee and record gate attendance.
                        </p>
                      </div>
                    )}

                    {/* Event Details Card */}
                    <div style={{ padding: '16px', borderRadius: '12px', background: 'var(--panel-subtle)', border: '1px solid var(--line)', marginBottom: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span className="badge" style={{ background: 'var(--brand-badge-bg)', color: 'var(--brand-badge-color)', fontSize: '10px' }}>
                          {scanResult.registration.event.eventType}
                        </span>
                        <small style={{ color: 'var(--brand-primary)', font: '600 10px monospace' }}>
                          EVENT ID: {scanResult.registration.event.id.slice(0, 8)}...
                        </small>
                      </div>

                      <h2 style={{ margin: '4px 0 8px', font: '700 22px Syne', color: 'var(--text-main)' }}>
                        {scanResult.registration.event.title}
                      </h2>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px', marginTop: '12px', color: 'var(--text-muted)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <IconCalendar size={14} /> {scanResult.registration.event.dateTime ? new Date(scanResult.registration.event.dateTime).toLocaleString() : 'TBA'}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <IconLocationPin size={14} /> {scanResult.registration.event.venue || 'Campus Auditorium'}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <IconCreditCard size={14} /> Payment: <b style={{ color: '#70ddb4', marginLeft: 4 }}>{scanResult.registration.paymentStatus}</b>
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <Icon8 name="access" size={14} /> Pass ID: {scanResult.registration.id.slice(0, 12)}...
                        </span>
                      </div>
                    </div>

                    {/* Attendee Ticket Details */}
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', padding: '14px', borderRadius: '10px', background: 'var(--bg-input)', border: '1px solid var(--line)', marginBottom: '20px' }}>
                      {scanResult.registration.user.profileImage ? (
                        <img
                          src={scanResult.registration.user.profileImage}
                          alt="Attendee Avatar"
                          style={{ width: '56px', height: '56px', borderRadius: '10px', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{ width: '56px', height: '56px', borderRadius: '10px', background: 'var(--brand-gradient)', display: 'grid', placeItems: 'center' }}>
                          <Icon8 name="user" size={26} />
                        </div>
                      )}
                      <div>
                        <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '16px' }}>{scanResult.registration.user.name}</h3>
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--brand-primary)', fontFamily: 'monospace' }}>
                          Roll No / ID: {scanResult.registration.user.rollNumber || scanResult.registration.user.memberId}
                        </p>
                        <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                          {scanResult.registration.user.department || 'Engineering'} {scanResult.registration.user.year ? `· Year ${scanResult.registration.user.year}` : ''}
                        </small>
                      </div>
                    </div>

                    {/* Entry Action Button */}
                    <button
                      type="button"
                      className="primary"
                      disabled={actionLoading || scanResult.registration.attendanceMarked}
                      onClick={() => handleGrantEntry(scanResult.registration.id)}
                      style={{
                        width: '100%',
                        minHeight: '48px',
                        fontSize: '13px',
                        fontWeight: 700,
                        background: scanResult.registration.attendanceMarked ? '#374151' : 'linear-gradient(135deg, #10b981, #059669)',
                        borderColor: scanResult.registration.attendanceMarked ? '#4b5563' : '#10b981',
                        cursor: scanResult.registration.attendanceMarked ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        marginBottom: '12px',
                      }}
                    >
                      <Icon8 name={scanResult.registration.attendanceMarked ? 'protect' : 'faceId'} size={18} />
                      {actionLoading ? 'RECORDING CHECK-IN…' : scanResult.registration.attendanceMarked ? 'ENTRY ALREADY GRANTED' : 'GRANT EVENT ENTRY & MARK ATTENDANCE'}
                    </button>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        type="button"
                        className="outline"
                        onClick={() => {
                          setScanResult(null)
                          setInputCode('')
                        }}
                        style={{ flex: 1, fontSize: '11px', height: '38px' }}
                      >
                        SCAN NEXT PASS
                      </button>
                      <button
                        type="button"
                        className="outline"
                        onClick={() => onNavigate('admin-events')}
                        style={{ flex: 1, fontSize: '11px', height: '38px' }}
                      >
                        VIEW IN EVENT STUDIO →
                      </button>
                    </div>
                  </div>
                )}

                {/* DIRECT EVENT OVERVIEW */}
                {scanResult.scanType === 'EVENT_DIRECT' && (
                  <div style={{ textAlign: 'center', padding: '20px 10px' }}>
                    <span className="badge" style={{ background: 'var(--brand-badge-bg)', color: 'var(--brand-badge-color)', fontSize: '10px' }}>
                      {scanResult.event.eventType}
                    </span>
                    <h2 style={{ margin: '8px 0', font: '700 22px Syne', color: 'var(--text-main)' }}>
                      {scanResult.event.title}
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                      {scanResult.event.venue} · {scanResult.event.dateTime ? new Date(scanResult.event.dateTime).toLocaleString() : 'TBA'}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', margin: '20px 0' }}>
                      <div className="stat" style={{ padding: '12px 20px', minWidth: '120px' }}>
                        <p>REGISTERED</p>
                        <h2>{scanResult.event.totalRegistrations}</h2>
                      </div>
                      <div className="stat green" style={{ padding: '12px 20px', minWidth: '120px' }}>
                        <p>ATTENDED</p>
                        <h2>{scanResult.event.attendedCount}</h2>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="primary"
                      onClick={() => onNavigate('admin-events')}
                      style={{ width: '100%', height: '42px', fontSize: '12px' }}
                    >
                      OPEN EVENT IN STUDIO →
                    </button>
                  </div>
                )}
              </article>
            ) : (
              <article className="account-form-card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                <span style={{ display: 'block', marginBottom: '14px' }}>
                  <Icon8 name="irisScan" size={48} />
                </span>
                <h3 style={{ color: 'var(--text-main)', margin: '0 0 6px' }}>Ready to Scan Event Pass</h3>
                <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.6 }}>
                  Point the camera at an attendee's Event QR pass, or upload a pass image to verify registration and record gate attendance.
                </p>
              </article>
            )}
          </div>
        </div>
      </section>
    </LivePortal>
  )
}
